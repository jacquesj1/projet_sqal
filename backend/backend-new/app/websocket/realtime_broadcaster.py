"""
WebSocket Broadcaster - Diffuse les données aux dashboards SQAL
Endpoint: /ws/realtime/
"""

from fastapi import WebSocket, WebSocketDisconnect
from typing import Set, Dict, Any
import asyncio
import json
import logging
from datetime import datetime

from app.models.sqal import SensorDataMessage

logger = logging.getLogger(__name__)


class RealtimeBroadcaster:
    """
    Gestionnaire WebSocket pour broadcast temps réel vers dashboards

    Flux:
    1. Dashboards connectés → /ws/realtime/
    2. Réception données depuis sensors_consumer
    3. Broadcast à tous les dashboards connectés
    4. Gestion déconnexions/reconnexions
    """

    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self.connection_metadata: Dict[WebSocket, Dict[str, Any]] = {}

    async def connect(self, websocket: WebSocket, client_info: Dict[str, Any] = None):
        """
        Accepte une nouvelle connexion dashboard

        Args:
            websocket: WebSocket du dashboard
            client_info: Métadonnées client (user_id, dashboard_type, etc.)
        """
        await websocket.accept()
        self.active_connections.add(websocket)

        # Stocke métadonnées
        self.connection_metadata[websocket] = client_info or {}
        self.connection_metadata[websocket]["connected_at"] = datetime.utcnow()

        logger.info(
            f"Dashboard connecté. Total: {len(self.active_connections)} | "
            f"Info: {client_info}"
        )

        # Message de bienvenue
        await websocket.send_json({
            "type": "connection_established",
            "timestamp": datetime.utcnow().isoformat(),
            "message": "Connecté au flux temps réel SQAL",
            "active_connections": len(self.active_connections)
        })

        # Envoie dernier échantillon si disponible
        await self._send_latest_sample(websocket)

    def disconnect(self, websocket: WebSocket):
        """Déconnecte un dashboard"""
        self.active_connections.discard(websocket)
        self.connection_metadata.pop(websocket, None)
        logger.info(f"Dashboard déconnecté. Total: {len(self.active_connections)}")

    async def listen(self, websocket: WebSocket):
        """
        Boucle d'écoute pour un dashboard (heartbeat, subscriptions, etc.)

        Args:
            websocket: WebSocket du dashboard
        """
        try:
            while True:
                # Attend messages du dashboard (heartbeat, filtres, etc.)
                data = await websocket.receive_json()
                await self._handle_dashboard_message(websocket, data)

        except WebSocketDisconnect:
            self.disconnect(websocket)
            logger.info("Dashboard déconnecté proprement")

        except Exception as e:
            logger.error(f"Erreur écoute dashboard: {e}", exc_info=True)
            self.disconnect(websocket)
            try:
                await websocket.close(code=1011, reason=str(e))
            except:
                pass

    async def _handle_dashboard_message(self, websocket: WebSocket, data: dict):
        """
        Traite un message du dashboard

        Types de messages supportés:
        - heartbeat: Ping pour maintenir connexion
        - subscribe: S'abonner à un device/site spécifique
        - unsubscribe: Se désabonner

        Args:
            websocket: WebSocket source
            data: Message JSON
        """
        msg_type = data.get("type", "unknown")

        if msg_type == "heartbeat":
            # Répond au ping
            await websocket.send_json({
                "type": "heartbeat_ack",
                "timestamp": datetime.utcnow().isoformat()
            })

        elif msg_type == "subscribe":
            # Mise à jour filtres abonnement
            filters = data.get("filters", {})
            self.connection_metadata[websocket]["filters"] = filters
            logger.info(f"Dashboard abonné à: {filters}")

            await websocket.send_json({
                "type": "subscribe_ack",
                "filters": filters,
                "timestamp": datetime.utcnow().isoformat()
            })

        elif msg_type == "unsubscribe":
            # Supprime filtres
            self.connection_metadata[websocket].pop("filters", None)
            logger.info("Dashboard désabonné des filtres")

            await websocket.send_json({
                "type": "unsubscribe_ack",
                "timestamp": datetime.utcnow().isoformat()
            })

        else:
            logger.warning(f"Type de message inconnu: {msg_type}")

    async def broadcast_sensor_data(self, sensor_data: SensorDataMessage):
        """
        Broadcast données capteur à tous les dashboards

        Envoie 3 messages séparés (comme attendu par le frontend SQAL):
        1. sensor_data VL53L8CH
        2. sensor_data AS7341
        3. analysis_result Fusion

        Args:
            sensor_data: Données capteur validées
        """
        if not self.active_connections:
            logger.debug("Aucun dashboard connecté, skip broadcast")
            return

        # Message 1: VL53L8CH
        vl53l8ch_msg = {
            "type": "sensor_data",
            "sensor": "VL53L8CH",
            "timestamp": sensor_data.timestamp.isoformat(),
            "sample_id": sensor_data.sample_id,
            "device_id": sensor_data.device_id,
            "data": {
                "raw": {
                    "distance_matrix": sensor_data.vl53l8ch.raw.distance_matrix,
                    "reflectance_matrix": sensor_data.vl53l8ch.raw.reflectance_matrix,
                    "amplitude_matrix": sensor_data.vl53l8ch.raw.amplitude_matrix
                },
                "analysis": {
                    "volume_mm3": sensor_data.vl53l8ch.analysis.volume_mm3,
                    "surface_uniformity": sensor_data.vl53l8ch.analysis.surface_uniformity,
                    "quality_score": sensor_data.vl53l8ch.analysis.quality_score,
                    "grade": sensor_data.vl53l8ch.analysis.grade,
                    "avg_distance_mm": sensor_data.vl53l8ch.analysis.avg_distance_mm,
                    "std_distance_mm": sensor_data.vl53l8ch.analysis.std_distance_mm,
                    "avg_reflectance": sensor_data.vl53l8ch.analysis.avg_reflectance
                }
            }
        }

        # Message 2: AS7341
        as7341_msg = {
            "type": "sensor_data",
            "sensor": "AS7341",
            "timestamp": sensor_data.timestamp.isoformat(),
            "sample_id": sensor_data.sample_id,
            "device_id": sensor_data.device_id,
            "data": {
                "raw": sensor_data.as7341.raw.to_dict(),
                "analysis": {
                    "freshness_index": sensor_data.as7341.analysis.freshness_index,
                    "fat_quality_index": sensor_data.as7341.analysis.fat_quality_index,
                    "oxidation_index": sensor_data.as7341.analysis.oxidation_index,
                    "quality_score": sensor_data.as7341.analysis.quality_score,
                    "ratio_red_nir": sensor_data.as7341.analysis.ratio_red_nir,
                    "ratio_clear_nir": sensor_data.as7341.analysis.ratio_clear_nir
                }
            }
        }

        # Message 3: Fusion
        fusion_msg = {
            "type": "analysis_result",
            "timestamp": sensor_data.timestamp.isoformat(),
            "sample_id": sensor_data.sample_id,
            "device_id": sensor_data.device_id,
            "site_code": sensor_data.site_code,
            "lot_id": sensor_data.lot_id,
            "data": {
                "final_score": sensor_data.fusion.final_score,
                "final_grade": sensor_data.fusion.final_grade,
                "is_compliant": sensor_data.fusion.is_compliant,
                "weight_tof": sensor_data.fusion.weight_tof,
                "weight_spectral": sensor_data.fusion.weight_spectral,
                "confidence_level": sensor_data.fusion.confidence_level
            }
        }

        # Broadcast à tous les dashboards (avec filtres)
        disconnected = set()

        for websocket in self.active_connections:
            # Vérifie filtres abonnement
            if not self._should_send_to_client(websocket, sensor_data):
                continue

            try:
                # Envoie les 3 messages séquentiellement
                await websocket.send_json(vl53l8ch_msg)
                await asyncio.sleep(0.01)  # Micro-pause pour ordre

                await websocket.send_json(as7341_msg)
                await asyncio.sleep(0.01)

                await websocket.send_json(fusion_msg)

            except Exception as e:
                logger.error(f"Erreur broadcast vers dashboard: {e}")
                disconnected.add(websocket)

        # Nettoie connexions mortes
        for ws in disconnected:
            self.disconnect(ws)

        logger.debug(
            f"📡 Broadcast à {len(self.active_connections)} dashboards | "
            f"Sample: {sensor_data.sample_id} | Grade: {sensor_data.fusion.final_grade}"
        )

    def _should_send_to_client(self, websocket: WebSocket, sensor_data: SensorDataMessage) -> bool:
        """
        Vérifie si données doivent être envoyées à un dashboard (filtres)

        Args:
            websocket: WebSocket du dashboard
            sensor_data: Données capteur

        Returns:
            True si doit envoyer, False sinon
        """
        metadata = self.connection_metadata.get(websocket, {})
        filters = metadata.get("filters", {})

        # Pas de filtres → envoie tout
        if not filters:
            return True

        # Filtre par device_id
        if "device_id" in filters and filters["device_id"] != sensor_data.device_id:
            return False

        # Filtre par site_code
        if "site_code" in filters and filters["site_code"] != sensor_data.site_code:
            return False

        # Filtre par grade minimum
        if "min_grade" in filters:
            grade_order = {"A+": 5, "A": 4, "B": 3, "C": 2, "REJECT": 1}
            min_grade = filters["min_grade"]
            if grade_order.get(sensor_data.fusion.final_grade, 0) < grade_order.get(min_grade, 0):
                return False

        return True

    async def _send_latest_sample(self, websocket: WebSocket):
        """
        Envoie le dernier échantillon disponible à un nouveau dashboard

        Args:
            websocket: WebSocket du nouveau dashboard
        """
        try:
            # Import ici pour éviter circular import
            from app.services.sqal_service import SQALService

            service = SQALService()
            latest = await service.get_latest_sample()

            if latest:
                await websocket.send_json({
                    "type": "latest_sample",
                    "timestamp": datetime.utcnow().isoformat(),
                    "data": latest
                })
                logger.info(f"Dernier échantillon envoyé au nouveau dashboard")

        except Exception as e:
            logger.error(f"Erreur envoi dernier échantillon: {e}")

    async def broadcast_alert(self, alert_data: Dict[str, Any]):
        """
        Broadcast une alerte à tous les dashboards

        Args:
            alert_data: Données d'alerte
        """
        if not self.active_connections:
            return

        message = {
            "type": "alert",
            "timestamp": datetime.utcnow().isoformat(),
            "data": alert_data
        }

        disconnected = set()

        for websocket in self.active_connections:
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.error(f"Erreur broadcast alerte: {e}")
                disconnected.add(websocket)

        for ws in disconnected:
            self.disconnect(ws)

        logger.info(f"🚨 Alerte broadcastée à {len(self.active_connections)} dashboards")


# Instance globale (singleton)
realtime_broadcaster = RealtimeBroadcaster()
