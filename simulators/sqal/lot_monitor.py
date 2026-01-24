"""
Lot Monitor - Synchronisation SQAL avec lots de gavage terminés
Surveille sqal_pending_lots et lance automatiquement les mesures qualité
"""

import asyncio
import asyncpg
import logging
import os
from datetime import datetime
from typing import List, Dict, Optional

logger = logging.getLogger(__name__)


class LotMonitor:
    """
    Surveille les lots terminés et déclenche automatiquement le contrôle qualité SQAL

    Workflow:
    1. Polling de sqal_pending_lots (status='pending')
    2. Pour chaque lot détecté:
       - Lance série de mesures SQAL (n échantillons par lot)
       - Met à jour status → 'inspected'
    3. Retour au polling
    """

    def __init__(self,
                 db_url: str,
                 device_id: str = "ESP32_SQAL_AUTO",
                 backend_url: str = "ws://localhost:8000/ws/sensors/",
                 samples_per_lot: int = 5,
                 polling_interval: int = 60):
        """
        Args:
            db_url: URL PostgreSQL
            device_id: ID du device SQAL auto
            backend_url: URL WebSocket backend
            samples_per_lot: Nombre d'échantillons par lot
            polling_interval: Intervalle de polling (secondes)
        """
        self.db_url = db_url
        self.device_id = device_id
        self.backend_url = backend_url
        self.samples_per_lot = samples_per_lot
        self.polling_interval = polling_interval

        self.db_pool: Optional[asyncpg.Pool] = None
        self.running = False

    async def start(self):
        """Démarre le monitoring"""
        # Connexion DB
        self.db_pool = await asyncpg.create_pool(self.db_url, min_size=2, max_size=5)
        logger.info("✅ Connexion DB établie pour LotMonitor")

        self.running = True
        logger.info(f"🔍 Démarrage monitoring lots (polling: {self.polling_interval}s)")

        # Boucle de polling
        while self.running:
            try:
                await self._check_pending_lots()
                await asyncio.sleep(self.polling_interval)
            except Exception as e:
                logger.error(f"❌ Erreur dans boucle monitoring: {e}", exc_info=True)
                await asyncio.sleep(self.polling_interval)

    async def stop(self):
        """Arrête le monitoring"""
        self.running = False
        if self.db_pool:
            await self.db_pool.close()
        logger.info("⏹️  Monitoring arrêté")

    async def _check_pending_lots(self):
        """Vérifie les lots en attente et lance inspections"""
        if not self.db_pool:
            return

        async with self.db_pool.acquire() as conn:
            # Récupère lots en attente
            lots = await conn.fetch("""
                SELECT
                    id, code_lot, gaveur_id, gaveur_nom, site, genetique,
                    poids_moyen_final, nb_canards_final, taux_mortalite,
                    date_abattage
                FROM sqal_pending_lots
                WHERE status = 'pending'
                ORDER BY date_abattage ASC
                LIMIT 10
            """)

            if not lots:
                logger.debug("Aucun lot en attente")
                return

            logger.info(f"📦 {len(lots)} lot(s) en attente d'inspection SQAL")

            for lot_record in lots:
                await self._inspect_lot(lot_record)

    async def _inspect_lot(self, lot_record):
        """
        Lance l'inspection SQAL d'un lot terminé

        Args:
            lot_record: Record asyncpg du lot
        """
        code_lot = lot_record['code_lot']
        nb_canards = lot_record['nb_canards_final']

        logger.info(f"🔬 Début inspection SQAL: {code_lot} ({nb_canards} canards)")

        # Met à jour status → inspecting
        if self.db_pool:
            async with self.db_pool.acquire() as conn:
                await conn.execute("""
                    UPDATE sqal_pending_lots
                    SET status = 'inspecting', updated_at = NOW()
                    WHERE code_lot = $1
                """, code_lot)

        try:
            # Lance ESP32 simulator pour ce lot
            await self._run_esp32_for_lot(lot_record)

            # Met à jour status → inspected
            if self.db_pool:
                async with self.db_pool.acquire() as conn:
                    await conn.execute("""
                        UPDATE sqal_pending_lots
                        SET status = 'inspected',
                            date_inspection_sqal = NOW(),
                            updated_at = NOW()
                        WHERE code_lot = $1
                    """, code_lot)

            logger.info(f"✅ Inspection terminée: {code_lot}")

        except Exception as e:
            logger.error(f"❌ Erreur inspection {code_lot}: {e}", exc_info=True)

            # Met à jour status → error
            if self.db_pool:
                async with self.db_pool.acquire() as conn:
                    await conn.execute("""
                        UPDATE sqal_pending_lots
                        SET status = 'error', updated_at = NOW()
                        WHERE code_lot = $1
                    """, code_lot)

    async def _run_esp32_for_lot(self, lot_record):
        """
        Simule mesures ESP32 pour un lot

        Génère N échantillons avec qualité basée sur:
        - Poids moyen final
        - Taux de mortalité
        - Génétique

        Args:
            lot_record: Record du lot
        """
        code_lot = lot_record['code_lot']
        genetique = lot_record['genetique']
        poids_moyen = float(lot_record['poids_moyen_final'])
        taux_mortalite = float(lot_record['taux_mortalite'])

        # Import du simulateur ESP32
        import sys
        import os
        ORIGINAL_SIMULATOR_PATH = os.path.join(
            os.path.dirname(__file__), '..', '..', 'simulator-sqal'
        )
        sys.path.insert(0, ORIGINAL_SIMULATOR_PATH)
        from esp32_simulator import ESP32_Simulator

        # Détermine profil de qualité selon résultats gavage
        quality_profile = self._determine_quality_profile(
            poids_moyen, taux_mortalite, genetique
        )

        logger.info(
            f"  📊 Profil qualité: {quality_profile} | "
            f"Poids: {poids_moyen}g | Mortalité: {taux_mortalite}%"
        )

        # Créer simulateur ESP32
        simulator = ESP32_Simulator(
            device_id=f"{self.device_id}_{code_lot}",
            location=f"Contrôle lot {code_lot}",
            backend_url=self.backend_url,
            sampling_rate_hz=1.0,  # 1 sample/s
            config_profile=quality_profile,
            lot_id=code_lot  # Lien avec le lot
        )

        # Lancer N échantillons
        logger.info(f"  🔄 Lancement {self.samples_per_lot} mesures...")

        try:
            # Boucle d'échantillonnage
            for i in range(self.samples_per_lot):
                await simulator.send_sample()
                logger.info(f"  ✓ Échantillon {i+1}/{self.samples_per_lot} envoyé")
                await asyncio.sleep(1)  # 1s entre échantillons

        finally:
            await simulator.stop()

    def _determine_quality_profile(
        self,
        poids_moyen: float,
        taux_mortalite: float,
        genetique: str
    ) -> str:
        """
        Détermine le profil de qualité selon résultats gavage

        Logique:
        - Poids élevé + mortalité faible → Premium
        - Poids moyen + mortalité faible → Standard
        - Poids faible ou mortalité élevée → Low Quality

        Args:
            poids_moyen: Poids moyen final (grammes)
            taux_mortalite: Taux de mortalité (%)
            genetique: Type de canard

        Returns:
            Nom du profil de config
        """
        # Seuils selon génétique
        if genetique == "Mulard":
            poids_optimal = 6500  # Mulard produit foie plus gros
            poids_minimal = 5800
        elif genetique == "Barbarie":
            poids_optimal = 6000
            poids_minimal = 5500
        else:  # Pékin
            poids_optimal = 6200
            poids_minimal = 5600

        # Décision qualité
        if poids_moyen >= poids_optimal and taux_mortalite <= 3.0:
            return "foiegras_premium"
        elif poids_moyen >= poids_minimal and taux_mortalite <= 5.0:
            return "foiegras_standard_barquette"
        else:
            return "foiegras_low_quality"


async def main():
    """Point d'entrée monitoring"""
    import argparse

    parser = argparse.ArgumentParser(
        description="Lot Monitor - Surveillance lots gavage pour SQAL"
    )
    parser.add_argument(
        "--db-url",
        default=os.getenv("DATABASE_URL", "postgresql://gaveurs_admin:gaveurs_secure_2024@localhost:5432/gaveurs_db"),
        help="URL PostgreSQL"
    )
    parser.add_argument(
        "--backend-url",
        default="ws://localhost:8000/ws/sensors/",
        help="URL WebSocket backend SQAL"
    )
    parser.add_argument(
        "--device-id",
        default="ESP32_SQAL_AUTO",
        help="ID du device SQAL auto"
    )
    parser.add_argument(
        "--samples-per-lot",
        type=int,
        default=5,
        help="Nombre d'échantillons par lot (défaut: 5)"
    )
    parser.add_argument(
        "--polling-interval",
        type=int,
        default=60,
        help="Intervalle de polling en secondes (défaut: 60)"
    )

    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )

    print("="*70)
    print("🔍 Lot Monitor SQAL - Surveillance Automatique")
    print("="*70)
    print(f"DB: {args.db_url}")
    print(f"Backend: {args.backend_url}")
    print(f"Device: {args.device_id}")
    print(f"Échantillons/lot: {args.samples_per_lot}")
    print(f"Polling: {args.polling_interval}s")
    print("="*70)

    monitor = LotMonitor(
        db_url=args.db_url,
        device_id=args.device_id,
        backend_url=args.backend_url,
        samples_per_lot=args.samples_per_lot,
        polling_interval=args.polling_interval
    )

    try:
        await monitor.start()
    except KeyboardInterrupt:
        print("\n\n⏹️  Arrêt du monitoring...")
        await monitor.stop()


if __name__ == "__main__":
    asyncio.run(main())
