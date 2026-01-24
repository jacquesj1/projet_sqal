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
from app.services.sqal_service import SQALService

logger = logging.getLogger(__name__)


class SensorsConsumer:
    """
    Gestionnaire WebSocket pour réception données simulateur

    Flux:
    1. Simulateur → WebSocket /ws/sensors/
    2. Validation Pydantic (SensorDataMessage)
    3. Sauvegarde TimescaleDB (sqal_sensor_samples)
    4. Génération alertes si qualité < seuils
    5. Broadcast aux dashboards via realtime_broadcaster
    """

    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self.service = SQALService()

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

    async def _process_sensor_message(self, data: dict, websocket: WebSocket):
        """
        Traite un message de données capteur

        Args:
            data: Dictionnaire JSON reçu
            websocket: WebSocket source
        """
        try:
            # 1. VALIDATION PYDANTIC
            sensor_data = SensorDataMessage(**data)
            logger.debug(f"Message validé: {sensor_data.sample_id} - Grade {sensor_data.fusion.final_grade}")

            # 2. SAUVEGARDE TIMESCALEDB
            saved = await self.service.save_sensor_sample(sensor_data)
            if not saved:
                raise Exception("Échec sauvegarde TimescaleDB")

            # 3. VÉRIFICATION ALERTES
            await self._check_and_create_alerts(sensor_data)

            # 4. BROADCAST AUX DASHBOARDS
            # Import ici pour éviter circular import
            from app.websocket.realtime_broadcaster import realtime_broadcaster
            await realtime_broadcaster.broadcast_sensor_data(sensor_data)

            # 5. ACK AU SIMULATEUR
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
