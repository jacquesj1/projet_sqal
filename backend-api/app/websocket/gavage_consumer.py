"""
WebSocket Consumer - Reçoit les données du simulateur Gavage Temps Réel
Endpoint: /ws/gavage
"""

from fastapi import WebSocket, WebSocketDisconnect
from typing import Set, Optional
import asyncio
import json
import logging
from datetime import datetime
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# ============================================
# MODELS PYDANTIC POUR WEBSOCKET GAVAGE
# ============================================

class GavageRealtimeMessage(BaseModel):
    """Message WebSocket du simulateur gavage temps réel"""

    # Identification lot
    code_lot: str = Field(..., description="Code unique du lot (ex: LL2512001)")
    gaveur_id: int = Field(..., description="ID du gaveur")
    gaveur_nom: str = Field(..., description="Nom du gaveur")
    site: str = Field(..., description="Site Euralis (LL, LS, MT)")
    genetique: str = Field(..., description="Génétique des canards (Mulard, Barbarie, Pékin)")

    # État du gavage
    jour: int = Field(..., ge=-1, description="Jour du gavage (J-1 = préparation, J0-J14 = gavage)")
    moment: str = Field(..., description="Moment du gavage (matin ou soir)")

    # Données de gavage
    dose_theorique: float = Field(..., ge=0, description="Dose théorique calculée (grammes)")
    dose_reelle: float = Field(..., ge=0, description="Dose réelle administrée (grammes)")

    # État du lot
    poids_moyen: float = Field(..., ge=0, description="Poids moyen des canards vivants (grammes)")
    nb_canards_vivants: int = Field(..., ge=0, description="Nombre de canards vivants")
    taux_mortalite: float = Field(..., ge=0, le=100, description="Taux de mortalité (%)")

    # Conditions environnementales
    temperature_stabule: float = Field(..., description="Température stabule (°C)")
    humidite_stabule: float = Field(..., ge=0, le=100, description="Humidité stabule (%)")

    # Métadonnées
    timestamp: str = Field(..., description="Timestamp ISO du gavage")
    pret_abattage: Optional[bool] = Field(default=False, description="Lot prêt pour abattage")


class GavageConsumer:
    """
    Gestionnaire WebSocket pour réception données simulateur gavage temps réel

    Flux:
    1. Simulateur → WebSocket /ws/gavage
    2. Validation Pydantic (GavageRealtimeMessage)
    3. Sauvegarde TimescaleDB (gavage_data + lots_gavage)
    4. Broadcast aux frontends (gaveurs + euralis)
    5. Synchronisation SQAL si lot terminé
    """

    def __init__(self, db_pool=None):
        self.active_connections: Set[WebSocket] = set()
        self.db_pool = db_pool

    def set_db_pool(self, pool):
        """Configure le pool de connexions DB"""
        self.db_pool = pool

    async def connect(self, websocket: WebSocket):
        """Accepte une nouvelle connexion simulateur"""
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info(f"Simulateur gavage connecté. Total connexions: {len(self.active_connections)}")

        # Envoie message de bienvenue
        await websocket.send_json({
            "type": "connection_established",
            "timestamp": datetime.utcnow().isoformat(),
            "message": "Connecté au backend Gavage Temps Réel"
        })

    def disconnect(self, websocket: WebSocket):
        """Déconnecte un simulateur"""
        self.active_connections.discard(websocket)
        logger.info(f"Simulateur gavage déconnecté. Total connexions: {len(self.active_connections)}")

    async def receive_gavage_data(self, websocket: WebSocket):
        """
        Boucle principale de réception des données gavage

        Args:
            websocket: WebSocket du simulateur
        """
        try:
            while True:
                # Reçoit message JSON du simulateur
                data = await websocket.receive_json()

                # Traite le message
                await self._process_gavage_message(data, websocket)

        except WebSocketDisconnect:
            self.disconnect(websocket)
            logger.info("Simulateur gavage déconnecté proprement")

        except Exception as e:
            logger.error(f"Erreur réception données gavage: {e}", exc_info=True)
            self.disconnect(websocket)
            try:
                await websocket.close(code=1011, reason=str(e))
            except:
                pass

    async def _process_gavage_message(self, data: dict, websocket: WebSocket):
        """
        Traite un message de données gavage

        Args:
            data: Dictionnaire JSON reçu
            websocket: WebSocket source
        """
        try:
            # 1. VALIDATION PYDANTIC
            gavage_data = GavageRealtimeMessage(**data)
            logger.debug(
                f"Message validé: {gavage_data.code_lot} J{gavage_data.jour} "
                f"{gavage_data.moment} - Dose: {gavage_data.dose_reelle}g"
            )

            # 2. SAUVEGARDE TIMESCALEDB
            saved = await self._save_to_database(gavage_data)
            if not saved:
                raise Exception("Échec sauvegarde TimescaleDB")

            # 3. BROADCAST AUX FRONTENDS (gaveurs + euralis)
            await self._broadcast_to_frontends(gavage_data)

            # 4. SYNCHRONISATION SQAL SI LOT TERMINÉ
            if gavage_data.pret_abattage:
                await self._trigger_sqal_quality_control(gavage_data)

            # 5. ACK AU SIMULATEUR
            await websocket.send_json({
                "type": "ack",
                "code_lot": gavage_data.code_lot,
                "jour": gavage_data.jour,
                "moment": gavage_data.moment,
                "timestamp": datetime.utcnow().isoformat(),
                "status": "saved",
                "poids_moyen": gavage_data.poids_moyen,
                "taux_mortalite": gavage_data.taux_mortalite
            })

            logger.info(
                f"✅ Gavage traité: {gavage_data.code_lot} | "
                f"J{gavage_data.jour} {gavage_data.moment} | "
                f"Gaveur: {gavage_data.gaveur_nom} | "
                f"Dose: {gavage_data.dose_reelle}g | "
                f"Poids moyen: {gavage_data.poids_moyen}g | "
                f"Vivants: {gavage_data.nb_canards_vivants} | "
                f"Mortalité: {gavage_data.taux_mortalite}%"
            )

        except Exception as e:
            logger.error(f"Erreur traitement message gavage: {e}", exc_info=True)

            # NACK au simulateur
            await websocket.send_json({
                "type": "error",
                "timestamp": datetime.utcnow().isoformat(),
                "error": str(e),
                "data": data
            })

    async def _save_to_database(self, gavage_data: GavageRealtimeMessage) -> bool:
        """
        Sauvegarde les données dans TimescaleDB

        Tables mises à jour:
        1. lots_gavage - Informations du lot
        2. gavage_data - Données de gavage (hypertable)
        3. doses_journalieres - Doses par jour (hypertable Euralis)

        Args:
            gavage_data: Données validées

        Returns:
            True si succès, False sinon
        """
        if not self.db_pool:
            logger.error("Pool de connexion DB non initialisé")
            return False

        try:
            async with self.db_pool.acquire() as conn:
                # 1. UPSERT LOT (créer ou mettre à jour)
                await conn.execute("""
                    INSERT INTO lots_gavage (
                        code_lot, gaveur_id, site_code, genetique, debut_lot,
                        nb_canards_initial, poids_moyen_actuel, taux_mortalite,
                        jour_actuel, pret_abattage, updated_at
                    ) VALUES ($1, $2, $3, $4, CURRENT_DATE, $5, $6, $7, $8, $9, NOW())
                    ON CONFLICT (code_lot) DO UPDATE SET
                        poids_moyen_actuel = EXCLUDED.poids_moyen_actuel,
                        taux_mortalite = EXCLUDED.taux_mortalite,
                        jour_actuel = EXCLUDED.jour_actuel,
                        pret_abattage = EXCLUDED.pret_abattage,
                        updated_at = NOW()
                """,
                    gavage_data.code_lot,
                    gavage_data.gaveur_id,
                    gavage_data.site,
                    gavage_data.genetique,
                    gavage_data.nb_canards_vivants,  # Approximation
                    gavage_data.poids_moyen,
                    gavage_data.taux_mortalite,
                    gavage_data.jour,
                    gavage_data.pret_abattage or False
                )

                # 2. INSERT GAVAGE_DATA_LOTS (hypertable time-series au niveau LOT)
                # Insertion directe dans gavage_data_lots car on travaille au niveau LOT, pas canards individuels
                await conn.execute("""
                    INSERT INTO gavage_data_lots (
                        time, lot_gavage_id, jour_gavage, repas,
                        dose_moyenne, dose_theorique, poids_moyen_lot,
                        nb_canards_vivants, nb_canards_morts, taux_mortalite,
                        temperature_stabule, humidite_stabule
                    ) VALUES (
                        $1,
                        (SELECT id FROM lots_gavage WHERE code_lot = $2),
                        $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
                    )
                    ON CONFLICT (time, lot_gavage_id, repas) DO UPDATE SET
                        dose_moyenne = EXCLUDED.dose_moyenne,
                        dose_theorique = EXCLUDED.dose_theorique,
                        poids_moyen_lot = EXCLUDED.poids_moyen_lot,
                        nb_canards_vivants = EXCLUDED.nb_canards_vivants,
                        nb_canards_morts = EXCLUDED.nb_canards_morts,
                        taux_mortalite = EXCLUDED.taux_mortalite
                """,
                    datetime.fromisoformat(gavage_data.timestamp),
                    gavage_data.code_lot,
                    gavage_data.jour,
                    gavage_data.moment,  # 'matin' ou 'soir'
                    gavage_data.dose_reelle,
                    gavage_data.dose_theorique,
                    gavage_data.poids_moyen,
                    gavage_data.nb_canards_vivants,  # FIX: Utiliser le bon nom de champ
                    0,  # nb_morts: Calculé via taux_mortalite * nb_total
                    gavage_data.taux_mortalite,
                    gavage_data.temperature_stabule,
                    gavage_data.humidite_stabule
                )

                # 3. INSERT DOSES_JOURNALIERES (pour Euralis dashboard)
                if gavage_data.jour >= 0:  # Ne pas enregistrer J-1
                    await conn.execute("""
                        INSERT INTO doses_journalieres (
                            time, code_lot, jour, moment,
                            dose_theorique, dose_reelle,
                            poids_moyen, nb_vivants, taux_mortalite,
                            temperature, humidite
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                        ON CONFLICT (time, code_lot, jour, moment) DO UPDATE SET
                            dose_reelle = EXCLUDED.dose_reelle,
                            poids_moyen = EXCLUDED.poids_moyen,
                            nb_vivants = EXCLUDED.nb_vivants,
                            taux_mortalite = EXCLUDED.taux_mortalite,
                            temperature = EXCLUDED.temperature,
                            humidite = EXCLUDED.humidite
                    """,
                        datetime.fromisoformat(gavage_data.timestamp),
                        gavage_data.code_lot,
                        gavage_data.jour,
                        gavage_data.moment,
                        gavage_data.dose_theorique,
                        gavage_data.dose_reelle,
                        gavage_data.poids_moyen,
                        gavage_data.nb_canards_vivants,
                        gavage_data.taux_mortalite,
                        gavage_data.temperature_stabule,
                        gavage_data.humidite_stabule
                    )

            return True

        except Exception as e:
            logger.error(f"Erreur sauvegarde DB gavage: {e}", exc_info=True)
            return False

    async def _broadcast_to_frontends(self, gavage_data: GavageRealtimeMessage):
        """
        Broadcast les données aux frontends connectés (gaveurs + euralis)

        Args:
            gavage_data: Données validées
        """
        try:
            # Import ici pour éviter circular import
            from app.websocket.realtime_broadcaster import realtime_broadcaster

            # Prépare message pour broadcast
            broadcast_message = {
                "type": "gavage_realtime",
                "data": gavage_data.model_dump(),
                "timestamp": datetime.utcnow().isoformat()
            }

            # Broadcast via le broadcaster global
            await realtime_broadcaster.broadcast_gavage_data(broadcast_message)

            logger.debug(f"Broadcast gavage: {gavage_data.code_lot} J{gavage_data.jour}")

        except Exception as e:
            logger.error(f"Erreur broadcast gavage: {e}", exc_info=True)

    async def _trigger_sqal_quality_control(self, gavage_data: GavageRealtimeMessage):
        """
        Déclenche le contrôle qualité SQAL lorsque le lot est terminé

        Enregistre le lot dans une file d'attente pour inspection SQAL.
        Le simulateur SQAL pourra récupérer les lots en attente.

        Args:
            gavage_data: Données du lot terminé
        """
        try:
            if not self.db_pool:
                return

            async with self.db_pool.acquire() as conn:
                # Enregistre dans table sqal_pending_lots (à créer)
                await conn.execute("""
                    INSERT INTO sqal_pending_lots (
                        code_lot, gaveur_id, gaveur_nom, site, genetique,
                        poids_moyen_final, nb_canards_final, taux_mortalite,
                        date_abattage, status
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), 'pending')
                    ON CONFLICT (code_lot) DO UPDATE SET
                        status = 'pending',
                        date_abattage = NOW()
                """,
                    gavage_data.code_lot,
                    gavage_data.gaveur_id,
                    gavage_data.gaveur_nom,
                    gavage_data.site,
                    gavage_data.genetique,
                    gavage_data.poids_moyen,
                    gavage_data.nb_canards_vivants,
                    gavage_data.taux_mortalite
                )

            logger.info(
                f"🎯 Lot {gavage_data.code_lot} prêt pour contrôle SQAL | "
                f"Poids final: {gavage_data.poids_moyen}g | "
                f"Vivants: {gavage_data.nb_canards_vivants}"
            )

        except Exception as e:
            logger.error(f"Erreur trigger SQAL: {e}", exc_info=True)


# Instance globale (singleton)
gavage_consumer = GavageConsumer()
