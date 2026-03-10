"""
Service Layer pour SQAL - Opérations base de données TimescaleDB
"""

import asyncpg
import json
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta, timezone
import logging
import os

from app.core.logging_config import get_logger

from sqlalchemy.exc import IntegrityError
from sqlalchemy import case, desc, func, select

from app.models.sqal import (
    SensorDataMessage,
    AlertCreate,
    SensorSampleDB,
    DeviceDB,
    HourlyStatsDB,
    SiteStatsDB,
    AlertDB
)

from app.db.sqlalchemy import AsyncSessionLocal
from app.db.models.sensor_sample import SensorSample
from app.db.models.sqal_device import SQALDevice
from app.db.models.sqal_alert import SQALAlert
from app.db.models.ai_model import AIModel
from app.db.models.prediction import Prediction

logger = get_logger("app.services")


class SQALService:
    """
    Service pour opérations SQAL sur TimescaleDB

    Méthodes:
    - save_sensor_sample: Sauvegarde échantillon capteur
    - create_alert: Crée une alerte
    - get_latest_sample: Récupère dernier échantillon
    - get_device_stats: Statistiques par dispositif
    - get_site_stats: Statistiques par site
    """

    def __init__(self):
        self.pool: Optional[asyncpg.Pool] = None
        self._owns_pool: bool = False

    async def _ensure_pool(self):
        if self.pool is not None:
            return

        database_url = os.getenv(
            "DATABASE_URL",
            "postgresql://gaveurs_admin:gaveurs_secure_2024@timescaledb:5432/gaveurs_db"
        )
        self.pool = await asyncpg.create_pool(database_url, min_size=2, max_size=10, ssl=False)
        self._owns_pool = True
        logger.warning("SQAL pool was not initialized at startup; created lazily")

    async def init_pool(self, database_url: str, shared_pool: Optional[asyncpg.Pool] = None):
        """Initialise le pool de connexions PostgreSQL"""
        if shared_pool is not None:
            self.pool = shared_pool
            self._owns_pool = False
            logger.info("Pool de connexions SQAL initialisé (shared pool)")
            return

        self.pool = await asyncpg.create_pool(database_url, min_size=2, max_size=10, ssl=False)
        self._owns_pool = True
        logger.info("Pool de connexions SQAL initialisé")

    async def close_pool(self):
        """Ferme le pool de connexions"""
        if self.pool and self._owns_pool:
            await self.pool.close()
            logger.info("Pool de connexions SQAL fermé")

    async def save_sensor_sample(self, sensor_data: SensorDataMessage) -> bool:
        """
        Sauvegarde un échantillon capteur dans sensor_samples

        Args:
            sensor_data: Données capteur validées

        Returns:
            True si sauvegarde réussie, False sinon
        """
        try:
            async with self.pool.acquire() as conn:
                # Ensure we can persist code_lot for reliable joins (gavage <-> SQAL)
                try:
                    await conn.execute(
                        """
                        ALTER TABLE sensor_samples
                        ADD COLUMN IF NOT EXISTS code_lot VARCHAR(20)
                        """
                    )
                    await conn.execute(
                        """
                        CREATE INDEX IF NOT EXISTS idx_sensor_samples_code_lot
                        ON sensor_samples(code_lot)
                        """
                    )
                except Exception as schema_err:
                    logger.warning(f"Failed to ensure sensor_samples.code_lot schema: {schema_err}")

                # Resolve lot_id from code_lot when missing (avoid 'latest lot of site' ambiguity)
                resolved_lot_id = sensor_data.lot_id
                resolved_code_lot = sensor_data.code_lot
                if resolved_lot_id is None and resolved_code_lot:
                    try:
                        resolved_lot_id = await conn.fetchval(
                            """
                            SELECT id
                            FROM lots_gavage
                            WHERE code_lot = $1
                            LIMIT 1
                            """,
                            resolved_code_lot,
                        )
                    except Exception as resolve_err:
                        logger.warning(f"Failed to resolve lot_id from code_lot={resolved_code_lot}: {resolve_err}")
                        resolved_lot_id = None
                # Ensure device exists to satisfy FK on sensor_samples.device_id
                config_profile = None
                try:
                    if sensor_data.meta and isinstance(sensor_data.meta, dict):
                        config_profile = sensor_data.meta.get("config_profile") or sensor_data.meta.get("meta_config_profile")
                except Exception:
                    config_profile = None

                await conn.execute(
                    """
                    INSERT INTO sqal_devices (
                        device_id,
                        device_name,
                        firmware_version,
                        site_code,
                        status,
                        config_profile,
                        created_at,
                        updated_at,
                        last_seen
                    )
                    VALUES (
                        $1, $2, $3, $4, $5, $6,
                        NOW(), NOW(), $7
                    )
                    ON CONFLICT (device_id) DO UPDATE
                    SET
                        firmware_version = COALESCE(EXCLUDED.firmware_version, sqal_devices.firmware_version),
                        site_code = COALESCE(EXCLUDED.site_code, sqal_devices.site_code),
                        config_profile = COALESCE(EXCLUDED.config_profile, sqal_devices.config_profile),
                        status = COALESCE(EXCLUDED.status, sqal_devices.status),
                        last_seen = GREATEST(COALESCE(sqal_devices.last_seen, EXCLUDED.last_seen), EXCLUDED.last_seen),
                        updated_at = NOW()
                    """,
                    sensor_data.device_id,
                    None,
                    sensor_data.firmware_version,
                    sensor_data.site_code,
                    "active",
                    config_profile,
                    sensor_data.timestamp,
                )

                # Convertit matrices 8x8 en JSONB
                distance_json = json.dumps(sensor_data.vl53l8ch.raw.distance_matrix)
                reflectance_json = json.dumps(sensor_data.vl53l8ch.raw.reflectance_matrix)
                amplitude_json = json.dumps(sensor_data.vl53l8ch.raw.amplitude_matrix)

                # Convertit channels en JSONB (raw peut être dict ou AS7341RawData)
                if isinstance(sensor_data.as7341.raw, dict):
                    channels_json = json.dumps(sensor_data.as7341.raw)
                else:
                    channels_json = json.dumps(sensor_data.as7341.raw.to_dict())

                # Extract grades
                vl53_grade = str(sensor_data.vl53l8ch.analysis.grade.value) if hasattr(sensor_data.vl53l8ch.analysis.grade, 'value') else str(sensor_data.vl53l8ch.analysis.grade)
                fusion_grade = str(sensor_data.fusion.final_grade.value) if hasattr(sensor_data.fusion.final_grade, 'value') else str(sensor_data.fusion.final_grade)

                poids_foie_estime_g = None
                try:
                    if sensor_data.vl53l8ch.analysis.volume_mm3 is not None:
                        poids_foie_estime_g = round((float(sensor_data.vl53l8ch.analysis.volume_mm3) / 1000.0) * 0.947, 1)
                except Exception:
                    poids_foie_estime_g = None

                try:
                    async with AsyncSessionLocal() as session:
                        sample = SensorSample(
                            timestamp=sensor_data.timestamp,
                            device_id=sensor_data.device_id,
                            sample_id=sensor_data.sample_id,
                            lot_id=resolved_lot_id,
                            code_lot=resolved_code_lot,
                            vl53l8ch_distance_matrix=sensor_data.vl53l8ch.raw.distance_matrix,
                            vl53l8ch_reflectance_matrix=sensor_data.vl53l8ch.raw.reflectance_matrix,
                            vl53l8ch_amplitude_matrix=sensor_data.vl53l8ch.raw.amplitude_matrix,
                            vl53l8ch_volume_mm3=sensor_data.vl53l8ch.analysis.volume_mm3,
                            vl53l8ch_surface_uniformity=sensor_data.vl53l8ch.analysis.surface_uniformity,
                            vl53l8ch_quality_score=sensor_data.vl53l8ch.analysis.quality_score,
                            vl53l8ch_grade=vl53_grade,
                            as7341_channels=(sensor_data.as7341.raw if isinstance(sensor_data.as7341.raw, dict) else sensor_data.as7341.raw.to_dict()),
                            as7341_freshness_index=sensor_data.as7341.analysis.freshness_index,
                            as7341_fat_quality_index=sensor_data.as7341.analysis.fat_quality_index,
                            as7341_oxidation_index=sensor_data.as7341.analysis.oxidation_index,
                            as7341_quality_score=sensor_data.as7341.analysis.quality_score,
                            fusion_final_score=sensor_data.fusion.final_score,
                            fusion_final_grade=fusion_grade,
                            poids_foie_estime_g=poids_foie_estime_g,
                            created_at=datetime.utcnow(),
                        )

                        session.add(sample)
                        await session.commit()

                except IntegrityError:
                    logger.info(f"ORM sensor_samples: sample_id already exists ({sensor_data.sample_id})")
                except Exception as e:
                    logger.warning(f"ORM sensor_samples insert failed: {e}")

                # Met à jour last_seen du device
                await conn.execute(
                    """
                    UPDATE sqal_devices
                    SET last_seen = $1
                    WHERE device_id = $2
                    """,
                    sensor_data.timestamp,
                    sensor_data.device_id
                )

                logger.debug(f"✅ Échantillon sauvegardé: {sensor_data.sample_id}")
                return True

        except Exception as e:
            logger.error(f"❌ Erreur sauvegarde échantillon: {e}", exc_info=True)
            return False

    async def create_alert(self, alert: AlertCreate) -> Optional[int]:
        """
        Crée une alerte dans sqal_alerts

        Args:
            alert: Données d'alerte

        Returns:
            ID de l'alerte créée, ou None si échec
        """
        try:
            async with self.pool.acquire() as conn:
                cols_rows = await conn.fetch(
                    """
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'sqal_alerts'
                    """
                )
                cols = {str(r["column_name"]) for r in cols_rows}

                # Always serialize to JSON string for asyncpg (never pass a dict directly)
                data_context_json = json.dumps(alert.data_context) if alert.data_context is not None else None

                now_ts = datetime.now(timezone.utc)
                severity_value = str(getattr(alert.severity, "value", alert.severity))

                if "data_context" in cols:
                    # Legacy schema: message + data_context
                    if "is_acknowledged" in cols:
                        alert_id = await conn.fetchval(
                            """
                            INSERT INTO sqal_alerts (
                                time, device_id, sample_id, alert_type, severity, message, data_context, is_acknowledged
                            )
                            VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE)
                            RETURNING alert_id
                            """,
                            now_ts,
                            alert.device_id,
                            alert.sample_id,
                            alert.alert_type,
                            severity_value,
                            alert.message,
                            data_context_json,
                        )
                    else:
                        alert_id = await conn.fetchval(
                            """
                            INSERT INTO sqal_alerts (
                                time, device_id, sample_id, alert_type, severity, message, data_context
                            )
                            VALUES ($1, $2, $3, $4, $5, $6, $7)
                            RETURNING alert_id
                            """,
                            now_ts,
                            alert.device_id,
                            alert.sample_id,
                            alert.alert_type,
                            severity_value,
                            alert.message,
                            data_context_json,
                        )
                else:
                    # Current schema: title + defect_details (JSONB)
                    title_value = str(alert.alert_type).strip() or "sqal_alert"
                    if "acknowledged" in cols:
                        alert_id = await conn.fetchval(
                            """
                            INSERT INTO sqal_alerts (
                                time, device_id, sample_id, alert_type, severity, title, message, defect_details, acknowledged
                            )
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, FALSE)
                            RETURNING alert_id
                            """,
                            now_ts,
                            alert.device_id,
                            alert.sample_id,
                            alert.alert_type,
                            severity_value,
                            title_value,
                            alert.message,
                            data_context_json,
                        )
                    else:
                        alert_id = await conn.fetchval(
                            """
                            INSERT INTO sqal_alerts (
                                time, device_id, sample_id, alert_type, severity, title, message, defect_details
                            )
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
                            RETURNING alert_id
                            """,
                            now_ts,
                            alert.device_id,
                            alert.sample_id,
                            alert.alert_type,
                            severity_value,
                            title_value,
                            alert.message,
                            data_context_json,
                        )

                logger.info(f"🚨 Alerte créée: {alert_id} - {alert.alert_type}")
                return alert_id

        except Exception as e:
            logger.error(f"❌ Erreur création alerte: {e}", exc_info=True)
            return None

    async def get_latest_sample(self, device_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Récupère le dernier échantillon

        Args:
            device_id: Filtrer par device (optionnel)

        Returns:
            Dictionnaire avec données échantillon, ou None
        """
        try:
            async with AsyncSessionLocal() as session:
                stmt = select(SensorSample).order_by(desc(SensorSample.timestamp)).limit(1)
                if device_id:
                    stmt = stmt.where(SensorSample.device_id == device_id)

                sample = await session.scalar(stmt)

                if not sample:
                    return None

                logger.debug("get_latest_sample: ORM sensor_samples")
                return {
                    "time": sample.timestamp,
                    "sample_id": sample.sample_id,
                    "device_id": sample.device_id,
                    "lot_id": sample.lot_id,
                    "vl53l8ch_distance_matrix": sample.vl53l8ch_distance_matrix,
                    "vl53l8ch_reflectance_matrix": sample.vl53l8ch_reflectance_matrix,
                    "vl53l8ch_amplitude_matrix": sample.vl53l8ch_amplitude_matrix,
                    "vl53l8ch_integration_time": None,
                    "vl53l8ch_temperature_c": None,
                    "vl53l8ch_volume_mm3": sample.vl53l8ch_volume_mm3,
                    "vl53l8ch_avg_height_mm": sample.vl53l8ch_avg_height_mm,
                    "vl53l8ch_max_height_mm": sample.vl53l8ch_max_height_mm,
                    "vl53l8ch_min_height_mm": sample.vl53l8ch_min_height_mm,
                    "vl53l8ch_surface_uniformity": sample.vl53l8ch_surface_uniformity,
                    "vl53l8ch_bins_analysis": sample.vl53l8ch_bins_analysis,
                    "vl53l8ch_reflectance_analysis": sample.vl53l8ch_reflectance_analysis,
                    "vl53l8ch_amplitude_consistency": sample.vl53l8ch_amplitude_consistency,
                    "vl53l8ch_quality_score": sample.vl53l8ch_quality_score,
                    "vl53l8ch_grade": sample.vl53l8ch_grade,
                    "vl53l8ch_score_breakdown": sample.vl53l8ch_score_breakdown,
                    "vl53l8ch_defects": sample.vl53l8ch_defects,
                    "as7341_channels": sample.as7341_channels,
                    "as7341_integration_time": sample.as7341_integration_time,
                    "as7341_gain": sample.as7341_gain,
                    "as7341_freshness_index": sample.as7341_freshness_index,
                    "as7341_fat_quality_index": sample.as7341_fat_quality_index,
                    "as7341_oxidation_index": sample.as7341_oxidation_index,
                    "as7341_spectral_analysis": sample.as7341_spectral_analysis,
                    "as7341_color_analysis": sample.as7341_color_analysis,
                    "as7341_quality_score": sample.as7341_quality_score,
                    "as7341_grade": sample.as7341_grade,
                    "as7341_score_breakdown": sample.as7341_score_breakdown,
                    "as7341_defects": sample.as7341_defects,
                    "fusion_final_score": sample.fusion_final_score,
                    "fusion_final_grade": sample.fusion_final_grade,
                    "fusion_vl53l8ch_score": sample.fusion_vl53l8ch_score,
                    "fusion_as7341_score": sample.fusion_as7341_score,
                    "fusion_defects": sample.fusion_defects,
                    "fusion_is_compliant": (sample.fusion_final_grade != "REJECT") if sample.fusion_final_grade else None,
                    "meta_firmware_version": sample.meta_firmware_version,
                    "meta_temperature_c": sample.meta_temperature_c,
                    "meta_humidity_percent": sample.meta_humidity_percent,
                    "meta_config_profile": sample.meta_config_profile,
                    "created_at": sample.created_at,
                    "poids_foie_estime_g": sample.poids_foie_estime_g,
                }

        except Exception as e:
            logger.error(f"❌ Erreur récupération dernier échantillon: {e}")
            return None

    async def get_samples_period(
        self,
        start_time: datetime,
        end_time: datetime,
        device_id: Optional[str] = None,
        limit: int = 1000
    ) -> List[Dict[str, Any]]:
        """
        Récupère les échantillons sur une période

        Args:
            start_time: Début période
            end_time: Fin période
            device_id: Filtrer par device (optionnel)
            limit: Nombre max résultats

        Returns:
            Liste de dictionnaires
        """
        try:
            async with AsyncSessionLocal() as session:
                stmt = (
                    select(SensorSample)
                    .where(SensorSample.timestamp.between(start_time, end_time))
                    .order_by(desc(SensorSample.timestamp))
                    .limit(limit)
                )
                if device_id:
                    stmt = stmt.where(SensorSample.device_id == device_id)

                samples = (await session.scalars(stmt)).all()
                results: List[Dict[str, Any]] = []
                for sample in samples:
                    results.append(
                        {
                            "time": sample.timestamp,
                            "sample_id": sample.sample_id,
                            "device_id": sample.device_id,
                            "lot_id": sample.lot_id,
                            "vl53l8ch_distance_matrix": sample.vl53l8ch_distance_matrix,
                            "vl53l8ch_reflectance_matrix": sample.vl53l8ch_reflectance_matrix,
                            "vl53l8ch_amplitude_matrix": sample.vl53l8ch_amplitude_matrix,
                            "vl53l8ch_integration_time": None,
                            "vl53l8ch_temperature_c": None,
                            "vl53l8ch_volume_mm3": sample.vl53l8ch_volume_mm3,
                            "vl53l8ch_avg_height_mm": sample.vl53l8ch_avg_height_mm,
                            "vl53l8ch_max_height_mm": sample.vl53l8ch_max_height_mm,
                            "vl53l8ch_min_height_mm": sample.vl53l8ch_min_height_mm,
                            "vl53l8ch_surface_uniformity": sample.vl53l8ch_surface_uniformity,
                            "vl53l8ch_bins_analysis": sample.vl53l8ch_bins_analysis,
                            "vl53l8ch_reflectance_analysis": sample.vl53l8ch_reflectance_analysis,
                            "vl53l8ch_amplitude_consistency": sample.vl53l8ch_amplitude_consistency,
                            "vl53l8ch_quality_score": sample.vl53l8ch_quality_score,
                            "vl53l8ch_grade": sample.vl53l8ch_grade,
                            "vl53l8ch_score_breakdown": sample.vl53l8ch_score_breakdown,
                            "vl53l8ch_defects": sample.vl53l8ch_defects,
                            "as7341_channels": sample.as7341_channels,
                            "as7341_integration_time": sample.as7341_integration_time,
                            "as7341_gain": sample.as7341_gain,
                            "as7341_freshness_index": sample.as7341_freshness_index,
                            "as7341_fat_quality_index": sample.as7341_fat_quality_index,
                            "as7341_oxidation_index": sample.as7341_oxidation_index,
                            "as7341_spectral_analysis": sample.as7341_spectral_analysis,
                            "as7341_color_analysis": sample.as7341_color_analysis,
                            "as7341_quality_score": sample.as7341_quality_score,
                            "as7341_grade": sample.as7341_grade,
                            "as7341_score_breakdown": sample.as7341_score_breakdown,
                            "as7341_defects": sample.as7341_defects,
                            "fusion_final_score": sample.fusion_final_score,
                            "fusion_final_grade": sample.fusion_final_grade,
                            "fusion_vl53l8ch_score": sample.fusion_vl53l8ch_score,
                            "fusion_as7341_score": sample.fusion_as7341_score,
                            "fusion_defects": sample.fusion_defects,
                            "fusion_is_compliant": (sample.fusion_final_grade != "REJECT") if sample.fusion_final_grade else None,
                            "meta_firmware_version": sample.meta_firmware_version,
                            "meta_temperature_c": sample.meta_temperature_c,
                            "meta_humidity_percent": sample.meta_humidity_percent,
                            "meta_config_profile": sample.meta_config_profile,
                            "created_at": sample.created_at,
                            "poids_foie_estime_g": sample.poids_foie_estime_g,
                        }
                    )

                logger.debug("get_samples_period: ORM sensor_samples")
                return results

        except Exception as e:
            logger.error(f"❌ Erreur récupération échantillons période: {e}")
            return []

    async def get_hourly_stats(
        self,
        start_time: datetime,
        end_time: datetime,
        device_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Récupère les statistiques horaires

        Args:
            start_time: Début période
            end_time: Fin période
            device_id: Filtrer par device (optionnel)

        Returns:
            Liste de statistiques horaires
        """
        try:
            async with AsyncSessionLocal() as session:
                bucket = func.date_trunc("hour", SensorSample.timestamp).label("bucket")

                stmt = (
                    select(
                        bucket,
                        SensorSample.device_id.label("device_id"),
                        func.count().label("sample_count"),
                        func.avg(SensorSample.fusion_final_score).label("avg_quality_score"),
                        func.sum(case((SensorSample.fusion_final_grade == "A+", 1), else_=0)).label("count_a_plus"),
                        func.sum(case((SensorSample.fusion_final_grade == "A", 1), else_=0)).label("count_a"),
                        func.sum(case((SensorSample.fusion_final_grade == "B", 1), else_=0)).label("count_b"),
                        func.sum(case((SensorSample.fusion_final_grade == "C", 1), else_=0)).label("count_c"),
                        func.sum(case((SensorSample.fusion_final_grade == "REJECT", 1), else_=0)).label("count_reject"),
                        func.avg(SensorSample.vl53l8ch_volume_mm3).label("avg_volume_mm3"),
                        func.avg(SensorSample.as7341_freshness_index).label("avg_freshness_index"),
                        func.sum(case((SensorSample.fusion_final_grade != "REJECT", 1), else_=0)).label("compliant_count"),
                    )
                    .where(SensorSample.timestamp.between(start_time, end_time))
                    .group_by(bucket, SensorSample.device_id)
                    .order_by(desc(bucket))
                )

                if device_id:
                    stmt = stmt.where(SensorSample.device_id == device_id)

                rows = (await session.execute(stmt)).all()

                logger.info("get_hourly_stats: ORM sensor_samples")
                logger.debug("get_hourly_stats: ORM sensor_samples")

                results: List[Dict[str, Any]] = []
                for r in rows:
                    sample_count = int(r.sample_count or 0)
                    compliant_count = int(r.compliant_count or 0)
                    compliance_rate_pct = (compliant_count / sample_count * 100) if sample_count > 0 else 0

                    results.append(
                        {
                            "bucket": r.bucket,
                            "device_id": r.device_id,
                            "sample_count": sample_count,
                            "avg_quality_score": float(r.avg_quality_score) if r.avg_quality_score is not None else 0,
                            "count_a_plus": int(r.count_a_plus or 0),
                            "count_a": int(r.count_a or 0),
                            "count_b": int(r.count_b or 0),
                            "count_c": int(r.count_c or 0),
                            "count_reject": int(r.count_reject or 0),
                            "avg_volume_mm3": float(r.avg_volume_mm3) if r.avg_volume_mm3 is not None else 0,
                            "avg_freshness_index": float(r.avg_freshness_index) if r.avg_freshness_index is not None else 0,
                            "compliance_rate_pct": compliance_rate_pct,
                        }
                    )

                return results

        except Exception as e:
            logger.error(f"❌ Erreur récupération stats horaires: {e}")
            return []

    async def get_site_stats(
        self,
        start_time: datetime,
        end_time: datetime,
        site_code: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Récupère les statistiques par site

        Args:
            start_time: Début période
            end_time: Fin période
            site_code: Filtrer par site (LL/LS/MT) (optionnel)

        Returns:
            Liste de statistiques par site
        """
        try:
            async with AsyncSessionLocal() as session:
                bucket = func.date_trunc("day", SensorSample.timestamp).label("bucket")

                stmt = (
                    select(
                        bucket,
                        SQALDevice.site_code.label("site_code"),
                        func.count().label("total_samples"),
                        func.avg(SensorSample.fusion_final_score).label("avg_quality_score"),
                        func.sum(case((SensorSample.fusion_final_grade == "A+", 1), else_=0)).label("count_a_plus"),
                        func.sum(case((SensorSample.fusion_final_grade == "A", 1), else_=0)).label("count_a"),
                        func.sum(case((SensorSample.fusion_final_grade == "B", 1), else_=0)).label("count_b"),
                        func.sum(case((SensorSample.fusion_final_grade == "C", 1), else_=0)).label("count_c"),
                        func.sum(case((SensorSample.fusion_final_grade == "REJECT", 1), else_=0)).label("count_reject"),
                        func.sum(case((SensorSample.fusion_final_grade != "REJECT", 1), else_=0)).label("compliant_count"),
                    )
                    .select_from(SensorSample)
                    .join(SQALDevice, SQALDevice.device_id == SensorSample.device_id)
                    .where(SensorSample.timestamp.between(start_time, end_time))
                    .where(SQALDevice.site_code.is_not(None))
                    .group_by(bucket, SQALDevice.site_code)
                    .order_by(desc(bucket), SQALDevice.site_code)
                )

                if site_code:
                    stmt = stmt.where(SQALDevice.site_code == site_code)

                rows = (await session.execute(stmt)).all()
                logger.info("get_site_stats: ORM sensor_samples + sqal_devices")

                results: List[Dict[str, Any]] = []
                for r in rows:
                    total_samples = int(r.total_samples or 0)
                    compliant_count = int(r.compliant_count or 0)
                    compliance_rate_pct = (compliant_count / total_samples * 100) if total_samples > 0 else 0

                    results.append(
                        {
                            "bucket": r.bucket,
                            "site_code": r.site_code,
                            "total_samples": total_samples,
                            "avg_quality_score": float(r.avg_quality_score) if r.avg_quality_score is not None else 0,
                            "compliance_rate_pct": compliance_rate_pct,
                            "count_a_plus": int(r.count_a_plus or 0),
                            "count_a": int(r.count_a or 0),
                            "count_b": int(r.count_b or 0),
                            "count_c": int(r.count_c or 0),
                            "count_reject": int(r.count_reject or 0),
                        }
                    )

                return results

        except Exception as e:
            logger.error(f"❌ Erreur récupération stats sites: {e}")
            return []

    async def get_devices(self, site_code: Optional[str] = None, status: Optional[str] = None) -> List[DeviceDB]:
        """
        Récupère la liste des dispositifs

        Args:
            site_code: Filtrer par site (optionnel)
            status: Filtrer par statut (optionnel)

        Returns:
            Liste de DeviceDB
        """
        try:
            try:
                async with AsyncSessionLocal() as session:
                    stmt = select(SQALDevice).order_by(SQALDevice.device_name)

                    if site_code:
                        stmt = stmt.where(SQALDevice.site_code == site_code)
                    if status:
                        stmt = stmt.where(SQALDevice.status == status)

                    devices = (await session.execute(stmt)).scalars().all()
                    if devices:
                        logger.info("get_devices: ORM sqal_devices")
                        return [DeviceDB.model_validate(d) for d in devices]

            except Exception as e:
                logger.warning(f"ORM sqal_devices read failed: {e}")

            await self._ensure_pool()
            async with self.pool.acquire() as conn:
                logger.info("get_devices: legacy sqal_devices")

                if site_code and status:
                    rows = await conn.fetch(
                        """
                        SELECT * FROM sqal_devices
                        WHERE site_code = $1
                          AND status = $2
                        ORDER BY device_name
                        """,
                        site_code,
                        status
                    )
                elif site_code:
                    rows = await conn.fetch(
                        """
                        SELECT * FROM sqal_devices
                        WHERE site_code = $1
                        ORDER BY device_name
                        """,
                        site_code
                    )
                elif status:
                    rows = await conn.fetch(
                        """
                        SELECT * FROM sqal_devices
                        WHERE status = $1
                        ORDER BY device_name
                        """,
                        status
                    )
                else:
                    rows = await conn.fetch(
                        """
                        SELECT * FROM sqal_devices
                        ORDER BY device_name
                        """
                    )

                return [DeviceDB(**dict(row)) for row in rows]

        except Exception as e:
            logger.error(f"❌ Erreur récupération devices: {e}")
            return []

    async def get_device(self, device_id: str) -> Optional[DeviceDB]:
        """Récupère un device par ID (ORM-first avec fallback legacy)."""
        try:
            try:
                async with AsyncSessionLocal() as session:
                    stmt = select(SQALDevice).where(SQALDevice.device_id == device_id)
                    device = (await session.execute(stmt)).scalars().first()
                    if device:
                        logger.info("get_device: ORM sqal_devices")
                        return DeviceDB.model_validate(device)

            except Exception as e:
                logger.warning(f"ORM sqal_devices read failed (get_device): {e}")

            await self._ensure_pool()
            async with self.pool.acquire() as conn:
                logger.info("get_device: legacy sqal_devices")
                row = await conn.fetchrow(
                    """
                    SELECT * FROM sqal_devices
                    WHERE device_id = $1
                    """,
                    device_id,
                )
                if not row:
                    return None
                return DeviceDB(**dict(row))

        except Exception as e:
            logger.error(f"❌ Erreur récupération device {device_id}: {e}")
            return None

    async def get_alerts(
        self,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        severity: Optional[str] = None,
        is_acknowledged: Optional[bool] = None,
        limit: int = 100
    ) -> List[AlertDB]:
        """
        Récupère les alertes avec filtres

        Args:
            start_time: Début période (optionnel, défaut: 24h)
            end_time: Fin période (optionnel, défaut: maintenant)
            severity: Filtrer par sévérité (optionnel)
            is_acknowledged: Filtrer par statut acquittement (optionnel)
            limit: Nombre max résultats

        Returns:
            Liste de AlertDB
        """
        try:
            if not end_time:
                end_time = datetime.now(timezone.utc)
            if not start_time:
                start_time = end_time - timedelta(days=1)

            try:
                async with AsyncSessionLocal() as session:
                    if start_time.tzinfo is None:
                        start_time = start_time.replace(tzinfo=timezone.utc)
                    if end_time.tzinfo is None:
                        end_time = end_time.replace(tzinfo=timezone.utc)

                    stmt = select(SQALAlert).where(SQALAlert.time.between(start_time, end_time))

                    if severity:
                        stmt = stmt.where(SQALAlert.severity == severity)
                    if is_acknowledged is not None:
                        stmt = stmt.where(SQALAlert.acknowledged == is_acknowledged)

                    stmt = stmt.order_by(desc(SQALAlert.time)).limit(limit)
                    alerts = (await session.execute(stmt)).scalars().all()
                    if alerts:
                        logger.info("get_alerts: ORM sqal_alerts")
                        out: List[AlertDB] = []
                        for a in alerts:
                            data_context = a.defect_details
                            if isinstance(data_context, str):
                                try:
                                    data_context = json.loads(data_context)
                                except Exception:
                                    data_context = None

                            out.append(
                                AlertDB(
                                    time=a.time,
                                    alert_id=a.alert_id,
                                    device_id=a.device_id or "",
                                    sample_id=a.sample_id or "",
                                    alert_type=a.alert_type,
                                    severity=a.severity,
                                    message=(a.message or a.title or ""),
                                    data_context=data_context,
                                    is_acknowledged=bool(a.acknowledged) if a.acknowledged is not None else False,
                                    acknowledged_at=a.acknowledged_at,
                                    acknowledged_by=a.acknowledged_by,
                                )
                            )

                        return out

            except Exception as e:
                logger.warning(f"ORM sqal_alerts read failed: {e}")

            await self._ensure_pool()

            async with self.pool.acquire() as conn:
                logger.info("get_alerts: legacy sqal_alerts")

                # Try schema variant 1: (message, data_context, is_acknowledged)
                try:
                    query = """
                    SELECT
                      time,
                      alert_id,
                      device_id,
                      sample_id,
                      alert_type,
                      severity,
                      message,
                      data_context,
                      is_acknowledged,
                      acknowledged_at,
                      acknowledged_by
                    FROM sqal_alerts
                    WHERE time BETWEEN $1::timestamptz AND $2::timestamptz
                    """
                    params = [start_time, end_time]
                    param_idx = 3

                    if severity:
                        query += f" AND severity = ${param_idx}"
                        params.append(severity)
                        param_idx += 1

                    if is_acknowledged is not None:
                        query += f" AND is_acknowledged = ${param_idx}"
                        params.append(is_acknowledged)
                        param_idx += 1

                    query += f" ORDER BY time DESC LIMIT ${param_idx}"
                    params.append(limit)

                    rows = await conn.fetch(query, *params)
                    return [AlertDB(**dict(r)) for r in rows]

                except Exception:
                    # Try schema variant 2: (title, defect_details, acknowledged)
                    query = """
                    SELECT
                      time,
                      alert_id,
                      device_id,
                      sample_id,
                      alert_type,
                      severity,
                      COALESCE(message, title) AS message,
                      defect_details AS data_context,
                      acknowledged AS is_acknowledged,
                      acknowledged_at,
                      acknowledged_by
                    FROM sqal_alerts
                    WHERE time BETWEEN $1::timestamptz AND $2::timestamptz
                    """
                    params = [start_time, end_time]
                    param_idx = 3

                    if severity:
                        query += f" AND severity = ${param_idx}"
                        params.append(severity)
                        param_idx += 1

                    if is_acknowledged is not None:
                        query += f" AND acknowledged = ${param_idx}"
                        params.append(is_acknowledged)
                        param_idx += 1

                    query += f" ORDER BY time DESC LIMIT ${param_idx}"
                    params.append(limit)

                    rows = await conn.fetch(query, *params)
                    return [AlertDB(**dict(r)) for r in rows]

        except Exception as e:
            logger.error(f"❌ Erreur récupération alertes: {e}")
            return []

    async def acknowledge_alert(self, alert_id: int, acknowledged_by: str) -> bool:
        """
        Acquitte une alerte

        Args:
            alert_id: ID de l'alerte
            acknowledged_by: Utilisateur acquittant

        Returns:
            True si succès, False sinon
        """
        try:
            await self._ensure_pool()
            async with self.pool.acquire() as conn:
                try:
                    await conn.execute(
                        """
                        UPDATE sqal_alerts
                        SET is_acknowledged = TRUE,
                            acknowledged_at = $1,
                            acknowledged_by = $2
                        WHERE alert_id = $3
                        """,
                        datetime.now(timezone.utc),
                        acknowledged_by,
                        alert_id
                    )
                except Exception:
                    await conn.execute(
                        """
                        UPDATE sqal_alerts
                        SET acknowledged = TRUE,
                            acknowledged_at = $1,
                            acknowledged_by = $2
                        WHERE alert_id = $3
                        """,
                        datetime.now(timezone.utc),
                        acknowledged_by,
                        alert_id
                    )
                logger.info(f"✅ Alerte {alert_id} acquittée par {acknowledged_by}")
                return True

        except Exception as e:
            logger.error(f"❌ Erreur acquittement alerte: {e}")
            return False

    async def get_grade_distribution(
        self,
        start_time: datetime,
        end_time: datetime,
        site_code: Optional[str] = None
    ) -> Dict[str, int]:
        """
        Récupère la distribution des grades sur une période

        Args:
            start_time: Début période
            end_time: Fin période
            site_code: Filtrer par site (optionnel)

        Returns:
            Dictionnaire {grade: count}
        """
        try:
            async with AsyncSessionLocal() as session:
                stmt = (
                    select(
                        SensorSample.fusion_final_grade.label("fusion_final_grade"),
                        func.count().label("count"),
                    )
                    .where(SensorSample.timestamp.between(start_time, end_time))
                )

                if site_code:
                    stmt = (
                        stmt.join(SQALDevice, SQALDevice.device_id == SensorSample.device_id)
                        .where(SQALDevice.site_code == site_code)
                    )

                stmt = stmt.group_by(SensorSample.fusion_final_grade)
                rows = (await session.execute(stmt)).all()

                logger.info("get_grade_distribution: ORM sensor_samples")
                logger.debug("get_grade_distribution: ORM sensor_samples")

                dist: Dict[str, int] = {str(r.fusion_final_grade): int(r.count) for r in rows}
                for g in ["A+", "A", "B", "C", "REJECT"]:
                    dist.setdefault(g, 0)

                return dist

        except Exception as e:
            logger.error(f"❌ Erreur distribution grades: {e}")
            return {}

    async def predict(self, sample_id: str) -> Dict[str, Any]:
        try:
            async with AsyncSessionLocal() as session:
                sample = await session.scalar(
                    select(SensorSample).where(SensorSample.sample_id == sample_id).limit(1)
                )
                if not sample:
                    raise ValueError(f"Sample not found: {sample_id}")

                model = await session.scalar(
                    select(AIModel)
                    .where(AIModel.is_active.is_(True))
                    .order_by(desc(AIModel.created_at))
                    .limit(1)
                )

                model_name = model.name if model else "sqal-mvp"
                model_version = model.version if model else "0.1"

                score = sample.fusion_final_score
                grade = sample.fusion_final_grade
                explanations = {
                    "source": "sensor_samples",
                    "fields": {
                        "fusion_final_score": score,
                        "fusion_final_grade": grade,
                    },
                }

                pred = Prediction(
                    sample_id=sample.sample_id,
                    device_id=sample.device_id,
                    model_name=model_name,
                    model_version=model_version,
                    score=score,
                    grade=grade,
                    explanations=explanations,
                )

                session.add(pred)
                await session.commit()
                await session.refresh(pred)

                return {
                    "prediction_id": str(pred.id),
                    "sample_id": pred.sample_id,
                    "device_id": pred.device_id,
                    "model_name": pred.model_name,
                    "model_version": pred.model_version,
                    "score": pred.score,
                    "grade": pred.grade,
                    "predicted_at": pred.predicted_at,
                    "explanations": pred.explanations,
                }
        except Exception as e:
            logger.error(f"❌ Erreur prediction SQAL: {e}")
            raise


# Instance globale (singleton)
sqal_service = SQALService()
