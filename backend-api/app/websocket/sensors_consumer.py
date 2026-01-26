"""
WebSocket Consumer - Reçoit les données du simulateur SQAL
Endpoint: /ws/sensors/
"""

from fastapi import WebSocket, WebSocketDisconnect
from typing import Set
import asyncio
import json
import logging
from datetime import datetime

from app.models.sqal import (
    SensorDataMessage,
    AlertCreate,
    AlertSeverity,
    QualityGrade
)
from app.services.sqal_service import sqal_service  # Use global singleton instead of SQALService class

logger = logging.getLogger(__name__)


class SensorsConsumer:
    """
    Gestionnaire WebSocket pour réception données simulateur

    Flux:
    1. Simulateur → WebSocket /ws/sensors/
    2. Validation Pydantic (SensorDataMessage)
    3. Sauvegarde TimescaleDB (sensor_samples)
    4. Génération alertes si qualité < seuils
    5. Broadcast aux dashboards via realtime_broadcaster
    """

    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        # Use global singleton service (initialized in main.py startup)
        self.service = sqal_service

    async def connect(self, websocket: WebSocket):
        """Accepte une nouvelle connexion simulateur"""
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info(f"Simulateur connecté. Total connexions: {len(self.active_connections)}")

        # Envoie message de bienvenue
        await websocket.send_json({
            "type": "connection_established",
            "timestamp": datetime.utcnow().isoformat(),
            "message": "Connecté au backend SQAL"
        })

    def disconnect(self, websocket: WebSocket):
        """Déconnecte un simulateur"""
        self.active_connections.discard(websocket)
        logger.info(f"Simulateur déconnecté. Total connexions: {len(self.active_connections)}")

    async def receive_sensor_data(self, websocket: WebSocket):
        """
        Boucle principale de réception des données capteur

        Args:
            websocket: WebSocket du simulateur
        """
        try:
            while True:
                # Reçoit message JSON du simulateur
                data = await websocket.receive_json()

                # Traite le message
                await self._process_sensor_message(data, websocket)

        except WebSocketDisconnect:
            self.disconnect(websocket)
            logger.info("Simulateur déconnecté proprement")

        except Exception as e:
            logger.error(f"Erreur réception données capteur: {e}", exc_info=True)
            self.disconnect(websocket)
            try:
                await websocket.close(code=1011, reason=str(e))
            except:
                pass

    def _adapt_simulator_data(self, data: dict) -> dict:
        """
        Adapte les données du simulateur vers le format Pydantic attendu

        Le simulateur envoie une structure plate :
        {
            "vl53l8ch": {"timestamp": ..., "stats": ..., "quality_score": ..., "distance_matrix": ...},
            "as7341": {"channels": {...}, "quality_score": ..., "freshness_index": ...},
            "fusion": {"final_score": ..., "final_grade": ...}
        }

        Pydantic attend une structure imbriquée :
        {
            "vl53l8ch": {
                "raw": {"distance_matrix": ..., "reflectance_matrix": ..., "amplitude_matrix": ...},
                "analysis": {"quality_score": ..., "volume_mm3": ..., "surface_uniformity": ..., ...}
            },
            "as7341": {
                "raw": {"F1_415nm": ..., "F2_445nm": ..., ...} (10 channels directement),
                "analysis": {"quality_score": ..., "freshness_index": ..., "oxidation_index": ...}
            },
            "fusion": {"final_score": ..., "final_grade": ..., "is_compliant": ...}
        }

        Args:
            data: Données brutes du simulateur

        Returns:
            Données adaptées au format Pydantic
        """
        adapted = data.copy()

        # Adaptation VL53L8CH : Séparer raw et analysis
        if "vl53l8ch" in data and isinstance(data["vl53l8ch"], dict):
            vl53_data = data["vl53l8ch"]

            # Champs qui vont dans "raw" (matrices 8x8)
            raw_fields = ["distance_matrix", "reflectance_matrix", "amplitude_matrix", "status_matrix", "ambient_matrix"]

            raw_data = {}
            for k in raw_fields:
                if k in vl53_data:
                    matrix = vl53_data[k]
                    # Convert float matrices to int (simulator sends floats, Pydantic expects ints)
                    # AND clamp values to valid ranges
                    if isinstance(matrix, list) and len(matrix) > 0 and isinstance(matrix[0], list):
                        if k == "distance_matrix":
                            # Distance: 0-4000mm
                            raw_data[k] = [[max(0, min(4000, int(round(val)))) if isinstance(val, (int, float)) else val for val in row] for row in matrix]
                        elif k == "reflectance_matrix":
                            # Reflectance: 0-255
                            raw_data[k] = [[max(0, min(255, int(round(val)))) if isinstance(val, (int, float)) else val for val in row] for row in matrix]
                        elif k == "amplitude_matrix":
                            # Amplitude: 0-4095 (avoid saturation that makes the map constant)
                            raw_data[k] = [[max(0, min(4095, int(round(val)))) if isinstance(val, (int, float)) else val for val in row] for row in matrix]
                        elif k == "status_matrix":
                            # Status: 0-255
                            raw_data[k] = [[max(0, min(255, int(round(val)))) if isinstance(val, (int, float)) else val for val in row] for row in matrix]
                        elif k == "ambient_matrix":
                            # Ambient: 0-4095
                            raw_data[k] = [[max(0, min(4095, int(round(val)))) if isinstance(val, (int, float)) else val for val in row] for row in matrix]
                        else:
                            raw_data[k] = [[int(round(val)) if isinstance(val, (int, float)) else val for val in row] for row in matrix]
                    else:
                        raw_data[k] = matrix

            # Tous les autres champs vont dans "analysis"
            analysis_data = {k: v for k, v in vl53_data.items() if k not in raw_fields}

            # Ensure avg/std distance are present for dashboards
            # If simulator/analyzer did not provide them, compute from raw distance matrix
            try:
                if (analysis_data.get("avg_distance_mm") is None) and ("distance_matrix" in raw_data) and raw_data.get("distance_matrix"):
                    vals = [v for row in raw_data["distance_matrix"] for v in row if isinstance(v, (int, float))]
                    if vals:
                        mean = sum(vals) / len(vals)
                        var = sum((v - mean) ** 2 for v in vals) / len(vals)
                        analysis_data["avg_distance_mm"] = float(mean)
                        analysis_data["std_distance_mm"] = float(var ** 0.5)
            except Exception:
                # Never fail ingestion due to optional derived metrics
                pass

            # Normaliser le grade : "REJET" → "REJECT", enlever les suffixes
            if "grade" in analysis_data:
                grade_str = str(analysis_data["grade"]).upper()
                if "REJET" in grade_str or "REJECT" in grade_str:
                    analysis_data["grade"] = "REJECT"
                elif "A+" in grade_str:
                    analysis_data["grade"] = "A+"
                elif "A" in grade_str:
                    analysis_data["grade"] = "A"
                elif "B" in grade_str:
                    analysis_data["grade"] = "B"
                elif "C" in grade_str:
                    analysis_data["grade"] = "C"

            adapted["vl53l8ch"] = {
                "raw": raw_data,
                "analysis": analysis_data
            }

        # Adaptation AS7341 : Séparer raw et analysis
        if "as7341" in data and isinstance(data["as7341"], dict):
            as7341_data = data["as7341"]

            # AS7341RawData attend directement les 10 canaux (F1_415nm, F2_445nm, ..., Clear, NIR)
            # Le simulateur les envoie dans un dict "channels"
            raw_data = {}
            if "channels" in as7341_data and isinstance(as7341_data["channels"], dict):
                # Les channels sont déjà au bon format (F1_415nm, F2_445nm, etc.)
                raw_data = as7341_data["channels"]

            # Champs qui vont dans "analysis"
            # Exclure: channels, integration_time, gain (ce sont des métadonnées raw)
            exclude_from_analysis = ["channels", "integration_time", "gain"]
            analysis_data = {k: v for k, v in as7341_data.items() if k not in exclude_from_analysis}

            # Normaliser le grade AS7341
            if "grade" in analysis_data:
                grade_str = str(analysis_data["grade"]).upper()
                if "REJET" in grade_str or "REJECT" in grade_str:
                    analysis_data["grade"] = "REJECT"
                elif "A+" in grade_str:
                    analysis_data["grade"] = "A+"
                elif "A" in grade_str:
                    analysis_data["grade"] = "A"
                elif "B" in grade_str:
                    analysis_data["grade"] = "B"
                elif "C" in grade_str:
                    analysis_data["grade"] = "C"

            adapted["as7341"] = {
                "raw": raw_data,
                "analysis": analysis_data
            }

        # Fusion : Vérifier que les champs requis sont présents
        if "fusion" in data and isinstance(data["fusion"], dict):
            fusion_data = data["fusion"]

            # Normaliser le grade fusion
            if "final_grade" in fusion_data:
                grade_str = str(fusion_data["final_grade"]).upper()
                if "REJET" in grade_str or "REJECT" in grade_str:
                    fusion_data["final_grade"] = "REJECT"
                elif "A+" in grade_str:
                    fusion_data["final_grade"] = "A+"
                elif "A" in grade_str:
                    fusion_data["final_grade"] = "A"
                elif "B" in grade_str:
                    fusion_data["final_grade"] = "B"
                elif "C" in grade_str:
                    fusion_data["final_grade"] = "C"

            # Assurer que is_compliant est présent (requis par Pydantic)
            if "is_compliant" not in fusion_data:
                # is_compliant = True si final_grade != REJECT
                fusion_data["is_compliant"] = fusion_data.get("final_grade") not in ["REJECT", "REJET"]

            adapted["fusion"] = fusion_data

        return adapted

    async def _process_sensor_message(self, data: dict, websocket: WebSocket):
        """
        Traite un message de données capteur

        Args:
            data: Dictionnaire JSON reçu
            websocket: WebSocket source
        """
        try:
            # Handle different message types
            msg_type = data.get("type", "sensor_data")

            # ESP32 HELLO message - just acknowledge
            if msg_type == "esp32_hello":
                device_id = data.get("device_id", "unknown")
                logger.info(f"Received HELLO from {device_id}")
                await websocket.send_json({
                    "type": "hello_ack",
                    "timestamp": datetime.utcnow().isoformat(),
                    "message": f"HELLO acknowledged for {device_id}"
                })
                return

            # Ping/pong for keepalive
            if msg_type == "ping":
                await websocket.send_json({"type": "pong", "timestamp": datetime.utcnow().isoformat()})
                return

            # ADAPTATION DES DONNÉES SIMULATEUR
            adapted_data = self._adapt_simulator_data(data)

            # 1. VALIDATION PYDANTIC (only for sensor_data messages)
            sensor_data = SensorDataMessage(**adapted_data)
            logger.debug(f"Message valide: {sensor_data.sample_id} - Grade {sensor_data.fusion.final_grade}")

            # Enrichir site_code si absent (utile pour filtres dashboard /ws/realtime/)
            if sensor_data.site_code is None:
                parts = str(sensor_data.device_id).split('_')
                if len(parts) >= 3 and parts[1].upper() in ('DEMO', 'DOCKER'):
                    candidate = parts[2].upper()
                elif len(parts) >= 2:
                    candidate = parts[1].upper()
                else:
                    candidate = None
                if candidate and len(candidate) == 2 and candidate.isalpha():
                    sensor_data.site_code = candidate

            # 2. SAUVEGARDE TIMESCALEDB
            try:
                saved = await self.service.save_sensor_sample(sensor_data)
                if not saved:
                    raise Exception("Échec sauvegarde TimescaleDB (save_sensor_sample returned False)")
            except Exception as save_err:
                logger.error(f"Erreur détaillée sauvegarde: {save_err}", exc_info=True)
                raise Exception(f"Échec sauvegarde TimescaleDB: {str(save_err)}")

            # 3. VÉRIFICATION ALERTES
            await self._check_and_create_alerts(sensor_data)

            # 4. GÉNÉRATION QR CODE (asynchrone via Celery)
            # Déclenche génération QR code uniquement si échantillon conforme (grade != REJECT)
            if sensor_data.fusion.is_compliant and sensor_data.fusion.final_grade != QualityGrade.REJECT:
                try:
                    from app.tasks.export_tasks import generate_qr_code_async

                    # Extraire site_code depuis device_id
                    # Formats rencontrés:
                    # - ESP32_LL_01 -> LL
                    # - ESP32_DEMO_LL_01 -> LL
                    parts = str(sensor_data.device_id).split('_')
                    site_code = 'LL'
                    if len(parts) >= 3 and parts[1].upper() in ('DEMO', 'DOCKER'):
                        candidate = parts[2].upper()
                    elif len(parts) >= 2:
                        candidate = parts[1].upper()
                    else:
                        candidate = 'LL'

                    # N'accepter qu'un code site de 2 lettres (LL/LS/MT...).
                    # Sinon fallback LL pour éviter les troncatures type DEMO->DE / DOCKER->DO.
                    if len(candidate) == 2 and candidate.isalpha():
                        site_code = candidate

                    # Le schéma consumer_products référence lots_gavage(id) (int).
                    # Or certains simulateurs SQAL n'envoient pas de lot_id -> fallback sur le dernier lot actif du site.
                    lot_id = sensor_data.lot_id
                    if lot_id is None:
                        try:
                            async with self.service.pool.acquire() as conn:
                                lot_id = await conn.fetchval(
                                    """
                                    SELECT id
                                    FROM lots_gavage
                                    WHERE site_code = $1
                                    ORDER BY updated_at DESC NULLS LAST, id DESC
                                    LIMIT 1
                                    """,
                                    site_code
                                )
                        except Exception as lot_err:
                            logger.warning(f"⚠️ Failed to resolve lot_id for site {site_code}: {lot_err}")
                            lot_id = None

                    if lot_id is None:
                        logger.warning(
                            f"⚠️ Skipping QR generation (no lot_id). sample={sensor_data.sample_id} device={sensor_data.device_id}"
                        )
                    else:
                        # Déclencher tâche Celery asynchrone
                        generate_qr_code_async.delay(
                            lot_id=int(lot_id),
                            sample_id=sensor_data.sample_id,
                            site_code=site_code
                        )
                        logger.info(
                            f"🏷️ QR code generation triggered: sample={sensor_data.sample_id} lot_id={lot_id} site={site_code}"
                        )
                except Exception as qr_error:
                    # Ne pas bloquer le flux si génération QR échoue
                    logger.warning(f"⚠️ Failed to trigger QR code generation: {qr_error}")

            # 5. BROADCAST AUX DASHBOARDS
            # Import ici pour éviter circular import
            from app.websocket.realtime_broadcaster import realtime_broadcaster
            # Passer les données originales adaptées pour conserver bins_analysis, etc.
            await realtime_broadcaster.broadcast_sensor_data(sensor_data, adapted_data)

            # 6. ACK AU SIMULATEUR
            await websocket.send_json({
                "type": "ack",
                "sample_id": sensor_data.sample_id,
                "timestamp": datetime.utcnow().isoformat(),
                "status": "saved",
                "fusion_score": sensor_data.fusion.final_score,
                "fusion_grade": sensor_data.fusion.final_grade
            })

            logger.info(
                f"✅ Échantillon traité: {sensor_data.sample_id} | "
                f"Device: {sensor_data.device_id} | "
                f"Score: {sensor_data.fusion.final_score:.3f} | "
                f"Grade: {sensor_data.fusion.final_grade}"
            )

        except Exception as e:
            logger.error(f"Erreur traitement message capteur: {e}", exc_info=True)

            # NACK au simulateur
            await websocket.send_json({
                "type": "error",
                "timestamp": datetime.utcnow().isoformat(),
                "error": str(e),
                "data": data
            })

    async def _check_and_create_alerts(self, sensor_data: SensorDataMessage):
        """
        Vérifie si des alertes doivent être générées

        Critères:
        - Fusion score < 0.6 → WARNING
        - Fusion score < 0.4 → CRITICAL
        - Grade = REJECT → CRITICAL
        - Oxidation index > 0.7 → WARNING

        Args:
            sensor_data: Données capteur validées
        """
        alerts = []

        # Alerte qualité globale basse
        if sensor_data.fusion.final_score < 0.4:
            alerts.append(AlertCreate(
                device_id=sensor_data.device_id,
                sample_id=sensor_data.sample_id,
                alert_type="quality_critical",
                severity=AlertSeverity.CRITICAL,
                message=f"Score qualité critique: {sensor_data.fusion.final_score:.2f} (seuil: 0.40)",
                data_context={
                    "fusion_score": sensor_data.fusion.final_score,
                    "fusion_grade": sensor_data.fusion.final_grade,
                    "tof_score": sensor_data.vl53l8ch.analysis.quality_score,
                    "spectral_score": sensor_data.as7341.analysis.quality_score
                }
            ))
        elif sensor_data.fusion.final_score < 0.6:
            alerts.append(AlertCreate(
                device_id=sensor_data.device_id,
                sample_id=sensor_data.sample_id,
                alert_type="quality_low",
                severity=AlertSeverity.WARNING,
                message=f"Score qualité faible: {sensor_data.fusion.final_score:.2f} (seuil: 0.60)",
                data_context={
                    "fusion_score": sensor_data.fusion.final_score,
                    "fusion_grade": sensor_data.fusion.final_grade
                }
            ))

        # Alerte grade REJECT
        if sensor_data.fusion.final_grade == QualityGrade.REJECT:
            alerts.append(AlertCreate(
                device_id=sensor_data.device_id,
                sample_id=sensor_data.sample_id,
                alert_type="grade_reject",
                severity=AlertSeverity.CRITICAL,
                message=f"Échantillon REJETÉ - Non conforme qualité",
                data_context={
                    "fusion_score": sensor_data.fusion.final_score,
                    "is_compliant": sensor_data.fusion.is_compliant
                }
            ))

        # Alerte oxydation élevée
        if sensor_data.as7341.analysis.oxidation_index > 0.7:
            alerts.append(AlertCreate(
                device_id=sensor_data.device_id,
                sample_id=sensor_data.sample_id,
                alert_type="oxidation_high",
                severity=AlertSeverity.WARNING,
                message=f"Indice oxydation élevé: {sensor_data.as7341.analysis.oxidation_index:.2f} (seuil: 0.70)",
                data_context={
                    "oxidation_index": sensor_data.as7341.analysis.oxidation_index,
                    "fat_quality_index": sensor_data.as7341.analysis.fat_quality_index
                }
            ))

        # Alerte fraîcheur faible
        if sensor_data.as7341.analysis.freshness_index < 0.5:
            alerts.append(AlertCreate(
                device_id=sensor_data.device_id,
                sample_id=sensor_data.sample_id,
                alert_type="freshness_low",
                severity=AlertSeverity.WARNING,
                message=f"Indice fraîcheur faible: {sensor_data.as7341.analysis.freshness_index:.2f} (seuil: 0.50)",
                data_context={
                    "freshness_index": sensor_data.as7341.analysis.freshness_index
                }
            ))

        # Sauvegarde toutes les alertes
        for alert in alerts:
            await self.service.create_alert(alert)
            logger.warning(
                f"🚨 Alerte {alert.severity.value}: {alert.alert_type} - {alert.message}"
            )


# Instance globale (singleton)
sensors_consumer = SensorsConsumer()
