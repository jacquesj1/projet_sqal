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
                try:
                    # Attend messages du dashboard avec timeout de 30s
                    data = await asyncio.wait_for(
                        websocket.receive_json(),
                        timeout=30.0
                    )
                    await self._handle_dashboard_message(websocket, data)
                except asyncio.TimeoutError:
                    # Envoyer un ping pour maintenir la connexion
                    try:
                        await websocket.send_json({
                            "type": "ping",
                            "timestamp": datetime.utcnow().isoformat()
                        })
                    except Exception:
                        # Connexion fermée
                        break

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

    async def broadcast_sensor_data(self, sensor_data: SensorDataMessage, original_data: Dict[str, Any] = None):
        """
        Broadcast données capteur à tous les dashboards

        Envoie un message unifié 'sensor_update' contenant toutes les données
        (format attendu par le frontend SQAL websocket.ts)

        Args:
            sensor_data: Données capteur validées par Pydantic
            original_data: Données originales du simulateur (contient bins_analysis, etc.)
        """
        if not self.active_connections:
            logger.debug("Aucun dashboard connecté, skip broadcast")
            return

        # Extraire données détaillées depuis original_data si disponible
        # Note: adapted_data a une structure imbriquée {"raw": {...}, "analysis": {...}}
        # Les données détaillées (bins_analysis, etc.) sont dans "analysis"
        vl53l8ch_original = original_data.get("vl53l8ch", {}) if original_data else {}
        vl53l8ch_analysis = vl53l8ch_original.get("analysis", {}) if isinstance(vl53l8ch_original, dict) else {}

        # Optional documentation/tooltips for UI (provided by simulator in vl53l8ch.meta.user_guide)
        # Keep it outside Pydantic models; forward it as-is through the websocket message.
        vl53l8ch_user_guide = None
        try:
            if isinstance(vl53l8ch_original, dict):
                # Most common: consumer adaptation puts "meta" inside the analysis block
                if isinstance(vl53l8ch_analysis, dict) and isinstance(vl53l8ch_analysis.get("meta"), dict):
                    vl53l8ch_user_guide = vl53l8ch_analysis.get("meta", {}).get("user_guide")
                # Fallbacks (depending on simulator/adaptation)
                if vl53l8ch_user_guide is None and isinstance(vl53l8ch_original.get("meta"), dict):
                    vl53l8ch_user_guide = vl53l8ch_original.get("meta", {}).get("user_guide")
                if vl53l8ch_user_guide is None and isinstance(vl53l8ch_original.get("raw"), dict):
                    meta = vl53l8ch_original.get("raw", {}).get("meta")
                    if isinstance(meta, dict):
                        vl53l8ch_user_guide = meta.get("user_guide")
        except Exception:
            vl53l8ch_user_guide = None

        as7341_original = original_data.get("as7341", {}) if original_data else {}
        as7341_analysis = as7341_original.get("analysis", {}) if isinstance(as7341_original, dict) else {}

        fusion_original = original_data.get("fusion", {}) if original_data else {}

        # Normalize defects: simulator may send a dict mapping defect_type -> params,
        # but the frontend expects an array.
        vl53l8ch_defects = vl53l8ch_analysis.get("defects", []) if isinstance(vl53l8ch_analysis, dict) else []
        if isinstance(vl53l8ch_defects, dict):
            normalized = []
            for defect_type, params in vl53l8ch_defects.items():
                if not isinstance(params, dict):
                    params = {}
                pos = params.get("position") or params.get("pos")
                x = None
                y = None
                if isinstance(pos, (list, tuple)) and len(pos) >= 2:
                    # convention used in simulator: (row, col) => (y, x)
                    y = pos[0]
                    x = pos[1]
                normalized.append({
                    "type": defect_type,
                    "pos": list(pos) if isinstance(pos, (list, tuple)) else None,
                    "x": x,
                    "y": y,
                    "severity": params.get("severity"),
                    "description": params.get("description"),
                })
            vl53l8ch_defects = normalized

        # Message unifié sensor_update (format attendu par frontend)
        # Combine données Pydantic validées + données originales du simulateur
        sensor_update_msg = {
            "type": "sensor_update",
            "timestamp": sensor_data.timestamp.isoformat(),
            "sample_id": sensor_data.sample_id,
            "device_id": sensor_data.device_id,
            "vl53l8ch": {
                "raw": {
                    "distance_matrix": sensor_data.vl53l8ch.raw.distance_matrix,
                    "reflectance_matrix": sensor_data.vl53l8ch.raw.reflectance_matrix,
                    "amplitude_matrix": sensor_data.vl53l8ch.raw.amplitude_matrix,
                    "status_matrix": sensor_data.vl53l8ch.raw.status_matrix,
                    "ambient_matrix": sensor_data.vl53l8ch.raw.ambient_matrix,
                    "meta": {
                        "user_guide": vl53l8ch_user_guide
                    } if vl53l8ch_user_guide is not None else None,
                },
                "analysis": {
                    "volume_mm3": sensor_data.vl53l8ch.analysis.volume_mm3,
                    "surface_uniformity": sensor_data.vl53l8ch.analysis.surface_uniformity,
                    "quality_score": sensor_data.vl53l8ch.analysis.quality_score,
                    "grade": sensor_data.vl53l8ch.analysis.grade,
                    "avg_distance_mm": sensor_data.vl53l8ch.analysis.avg_distance_mm,
                    "std_distance_mm": sensor_data.vl53l8ch.analysis.std_distance_mm,
                    "avg_reflectance": sensor_data.vl53l8ch.analysis.avg_reflectance,
                    # Données détaillées depuis original_data.vl53l8ch.analysis
                    "bins_analysis": vl53l8ch_analysis.get("bins_analysis"),
                    "reflectance_analysis": vl53l8ch_analysis.get("reflectance_analysis"),
                    "amplitude_consistency": vl53l8ch_analysis.get("amplitude_consistency"),
                    "score_breakdown": vl53l8ch_analysis.get("score_breakdown"),
                    "defects": vl53l8ch_defects,
                    "stats": vl53l8ch_analysis.get("stats"),
                }
            },
            "as7341": {
                "raw": sensor_data.as7341.raw.to_dict(),
                "analysis": {
                    "freshness_index": sensor_data.as7341.analysis.freshness_index,
                    "fat_quality_index": sensor_data.as7341.analysis.fat_quality_index,
                    "oxidation_index": sensor_data.as7341.analysis.oxidation_index,
                    "quality_score": sensor_data.as7341.analysis.quality_score,
                    "ratio_red_nir": sensor_data.as7341.analysis.ratio_red_nir,
                    "ratio_clear_nir": sensor_data.as7341.analysis.ratio_clear_nir,
                    # Données détaillées depuis original_data.as7341.analysis
                    "channels": as7341_analysis.get("channels"),
                    "spectral_ratios": as7341_analysis.get("spectral_ratios"),
                    "quality_metrics": as7341_analysis.get("quality_metrics"),
                    "color_uniformity": as7341_analysis.get("color_uniformity"),
                    "defects": as7341_analysis.get("defects", []),
                }
            },
            "fusion": {
                "final_score": sensor_data.fusion.final_score,
                "final_grade": sensor_data.fusion.final_grade,
                "is_compliant": sensor_data.fusion.is_compliant,
                "weight_tof": sensor_data.fusion.weight_tof,
                "weight_spectral": sensor_data.fusion.weight_spectral,
                "confidence_level": sensor_data.fusion.confidence_level,
                # Données détaillées depuis original_data
                "tof_score": fusion_original.get("tof_score"),
                "spectral_score": fusion_original.get("spectral_score"),
                "tof_contribution": fusion_original.get("tof_contribution"),
                "spectral_contribution": fusion_original.get("spectral_contribution"),
                "combined_defects": fusion_original.get("combined_defects", []),
                "num_defects": fusion_original.get("num_defects", 0),
                "metrics": fusion_original.get("metrics"),
                "foie_gras_metrics": fusion_original.get("foie_gras_metrics"),
            }
        }

        # Broadcast à tous les dashboards (avec filtres)
        disconnected = set()

        for websocket in self.active_connections:
            # Vérifie filtres abonnement
            if not self._should_send_to_client(websocket, sensor_data):
                continue

            try:
                await websocket.send_json(sensor_update_msg)
            except Exception as e:
                logger.error(f"Erreur broadcast vers dashboard: {e}")
                disconnected.add(websocket)

        # Nettoie connexions mortes
        for ws in disconnected:
            self.disconnect(ws)

        logger.info(
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
            # Utiliser le singleton initialisé au startup (pool DB prêt)
            from app.services.sqal_service import sqal_service

            latest = await sqal_service.get_latest_sample()

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

    async def broadcast_gavage_data(self, gavage_message: Dict[str, Any]):
        """
        Broadcast données gavage temps réel à tous les dashboards (gaveurs + euralis)

        Args:
            gavage_message: Message de gavage formaté
        """
        if not self.active_connections:
            logger.debug("Aucun dashboard connecté pour gavage, skip broadcast")
            return

        disconnected = set()

        for websocket in self.active_connections:
            # Vérifie si le dashboard veut les données gavage (via filtres)
            metadata = self.connection_metadata.get(websocket, {})
            filters = metadata.get("filters", {})

            # Si filtre spécifie "sqal_only", skip gavage
            if filters.get("data_type") == "sqal_only":
                continue

            try:
                await websocket.send_json(gavage_message)
            except Exception as e:
                logger.error(f"Erreur broadcast gavage: {e}")
                disconnected.add(websocket)

        # Nettoie connexions mortes
        for ws in disconnected:
            self.disconnect(ws)

        logger.debug(
            f"📡 Gavage broadcast à {len(self.active_connections)} dashboards | "
            f"Lot: {gavage_message.get('data', {}).get('code_lot', 'N/A')}"
        )


# Instance globale (singleton)
realtime_broadcaster = RealtimeBroadcaster()
