"""
Simulateur Gavage Temps Réel
Simule le gavage de canards 2x/jour sur 11-14 jours
Envoie données via WebSocket au backend
"""

import asyncio
import websockets
import json
import random
import argparse
from datetime import datetime, timedelta
from typing import List, Dict
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class Canard:
    """Représente un canard individuel"""

    def __init__(self, canard_id: int, genetique: str):
        self.id = canard_id
        self.genetique = genetique

        # Poids initial selon génétique
        if genetique == "Mulard":
            self.poids_initial = random.uniform(4400, 4600)
        elif genetique == "Barbarie":
            self.poids_initial = random.uniform(3800, 4000)
        else:  # Pékin
            self.poids_initial = random.uniform(4000, 4200)

        self.poids_actuel = self.poids_initial
        self.vivant = True

    def gagner_poids(self, jour: int, duree_totale: int):
        """Simule gain de poids après gavage"""
        if not self.vivant:
            return

        # Progression non-linéaire (plus de gain en début)
        progression = jour / duree_totale

        # Gain de base selon génétique
        if self.genetique == "Mulard":
            gain_base = random.uniform(60, 90)
        elif self.genetique == "Barbarie":
            gain_base = random.uniform(50, 70)
        else:  # Pékin
            gain_base = random.uniform(55, 75)

        # Facteur de progression (gain diminue vers la fin)
        facteur = 1.5 - (progression * 0.5)

        # Gain réel
        gain = gain_base * facteur * random.uniform(0.9, 1.1)
        self.poids_actuel += gain

    def calculer_mortalite(self, jour: int) -> bool:
        """Calcule si le canard survit (mortalité aléatoire)"""
        if not self.vivant:
            return False

        # Risque de mortalité augmente avec le temps
        risque_base = 0.0005  # 0.05% par gavage
        risque_progression = jour * 0.0001
        risque_total = risque_base + risque_progression

        if random.random() < risque_total:
            self.vivant = False
            logger.warning(f"Canard {self.id} décédé au jour {jour}")
            return True
        return False


class Lot:
    """Représente un lot de canards en gavage"""

    def __init__(self, code_lot: str, gaveur_id: int, gaveur_nom: str,
                 site: str, nb_canards: int, genetique: str, duree_prevue: int):
        self.code_lot = code_lot
        self.gaveur_id = gaveur_id
        self.gaveur_nom = gaveur_nom
        self.site = site
        self.nb_canards_initial = nb_canards
        self.genetique = genetique
        self.duree_prevue = duree_prevue

        self.date_debut = datetime.now()
        self.jour_actuel = -1  # Commence à -1 (J-1 = préparation)
        self.pret_abattage = False

        # Créer canards
        self.canards: List[Canard] = [
            Canard(i, genetique) for i in range(nb_canards)
        ]

        logger.info(f"✅ Lot créé: {code_lot} - {gaveur_nom} - {nb_canards} canards {genetique}")

    @property
    def canards_vivants(self) -> List[Canard]:
        """Retourne liste des canards vivants"""
        return [c for c in self.canards if c.vivant]

    @property
    def taux_mortalite(self) -> float:
        """Calcule taux de mortalité actuel"""
        nb_morts = len([c for c in self.canards if not c.vivant])
        return (nb_morts / self.nb_canards_initial) * 100

    @property
    def poids_moyen(self) -> float:
        """Calcule poids moyen des canards vivants"""
        vivants = self.canards_vivants
        if not vivants:
            return 0.0
        return sum(c.poids_actuel for c in vivants) / len(vivants)

    def calculer_dose(self, moment: str) -> float:
        """Calcule dose théorique selon progression"""
        # Progression 0.0 → 1.0
        if self.jour_actuel < 0:
            progression = 0.0
        else:
            progression = min(1.0, self.jour_actuel / self.duree_prevue)

        # Doses de base
        if moment == "matin":
            dose_debut = 200
            dose_fin = 460
        else:  # soir
            dose_debut = 210
            dose_fin = 490

        # Interpolation linéaire
        dose = dose_debut + (dose_fin - dose_debut) * progression

        return round(dose, 1)

    def effectuer_gavage(self, moment: str) -> Dict:
        """Effectue un gavage et retourne les données"""
        # Incrémenter jour au matin
        if moment == "matin":
            self.jour_actuel += 1

        # Calculer dose
        dose_theorique = self.calculer_dose(moment)

        # Dose réelle (variation ±5%)
        dose_reelle = dose_theorique * random.uniform(0.95, 1.05)

        # Appliquer gain de poids à chaque canard
        for canard in self.canards_vivants:
            canard.gagner_poids(self.jour_actuel, self.duree_prevue)
            canard.calculer_mortalite(self.jour_actuel)

        # Conditions environnementales
        temperature = random.uniform(19, 23)
        humidite = random.uniform(55, 75)

        # Préparer données
        gavage_data = {
            "code_lot": self.code_lot,
            "gaveur_id": self.gaveur_id,
            "gaveur_nom": self.gaveur_nom,
            "site": self.site,
            "genetique": self.genetique,
            "jour": self.jour_actuel,
            "moment": moment,
            "dose_theorique": dose_theorique,
            "dose_reelle": round(dose_reelle, 1),
            "poids_moyen": round(self.poids_moyen, 1),
            "nb_canards_vivants": len(self.canards_vivants),
            "taux_mortalite": round(self.taux_mortalite, 2),
            "temperature_stabule": round(temperature, 1),
            "humidite_stabule": round(humidite, 1),
            "timestamp": datetime.now().isoformat()
        }

        # Marquer pour abattage si dernier jour
        if self.jour_actuel >= self.duree_prevue and moment == "soir":
            self.pret_abattage = True
            gavage_data["pret_abattage"] = True

        return gavage_data


class GavageSimulator:
    """Simulateur principal de gavage temps réel"""

    def __init__(self, backend_url: str, nb_lots: int, acceleration: int = 1):
        self.backend_url = backend_url
        self.nb_lots_initial = nb_lots
        self.acceleration = acceleration  # Facteur accélération temps

        self.lots_actifs: List[Lot] = []
        self.lots_termines: List[Lot] = []

        # Données gaveurs (cohérent avec base de données)
        self.gaveurs = [
            {"id": 1, "nom": "Jean Martin", "site": "LL"},
            {"id": 2, "nom": "Sophie Dubois", "site": "LS"},
            {"id": 3, "nom": "Pierre Leroy", "site": "MT"},
            {"id": 4, "nom": "Marie Petit", "site": "LL"},
            {"id": 5, "nom": "Luc Blanc", "site": "LS"},
        ]

        self.genetiques = ["Mulard", "Mulard", "Mulard", "Barbarie", "Pékin"]  # 60% Mulard
        self.sites = ["LL", "LS", "MT"]

    def generate_code_lot(self, site: str) -> str:
        """Génère un code lot unique"""
        # Format: LLYYMMIII (LL=site, YY=année, MM=mois, III=numéro)
        now = datetime.now()
        numero = len(self.lots_actifs) + len(self.lots_termines) + 1
        return f"{site}{now.strftime('%y%m')}{numero:03d}"

    def creer_lots_initiaux(self):
        """Crée les lots initiaux (J-1)"""
        logger.info(f"📦 Création de {self.nb_lots_initial} lots initiaux...")

        for i in range(self.nb_lots_initial):
            # Sélectionner gaveur
            gaveur = random.choice(self.gaveurs)

            # Paramètres lot
            genetique = random.choice(self.genetiques)
            nb_canards = random.randint(45, 55)
            duree_prevue = random.randint(11, 14)

            # Générer code lot
            code_lot = self.generate_code_lot(gaveur["site"])

            # Créer lot
            lot = Lot(
                code_lot=code_lot,
                gaveur_id=gaveur["id"],
                gaveur_nom=gaveur["nom"],
                site=gaveur["site"],
                nb_canards=nb_canards,
                genetique=genetique,
                duree_prevue=duree_prevue
            )

            self.lots_actifs.append(lot)

        logger.info(f"✅ {len(self.lots_actifs)} lots créés et prêts pour J0")

    async def send_to_backend(self, data: Dict):
        """Envoie données via WebSocket au backend"""
        try:
            async with websockets.connect(self.backend_url) as ws:
                await ws.send(json.dumps(data))
                logger.info(f"📤 Envoyé: Lot {data['code_lot']} J{data['jour']} {data['moment']}")
        except Exception as e:
            logger.error(f"❌ Erreur envoi WebSocket: {e}")

    async def effectuer_gavages(self, moment: str):
        """Effectue gavage pour tous les lots actifs"""
        logger.info(f"\n{'='*60}")
        logger.info(f"🍽️  GAVAGE {moment.upper()} - {datetime.now().strftime('%d/%m/%Y %H:%M')}")
        logger.info(f"{'='*60}")

        for lot in self.lots_actifs[:]:  # Copie pour modification pendant itération
            if lot.pret_abattage:
                continue

            # Effectuer gavage
            gavage_data = lot.effectuer_gavage(moment)

            # Log
            logger.info(
                f"📊 {lot.code_lot} (J{lot.jour_actuel}/{lot.duree_prevue}) - "
                f"{lot.gaveur_nom} - "
                f"Dose: {gavage_data['dose_reelle']}g - "
                f"Poids moyen: {gavage_data['poids_moyen']}g - "
                f"Vivants: {gavage_data['nb_canards_vivants']}/{lot.nb_canards_initial} - "
                f"Mortalité: {gavage_data['taux_mortalite']}%"
            )

            # Envoyer au backend
            await self.send_to_backend(gavage_data)

            # Si terminé, déplacer vers lots terminés
            if lot.pret_abattage:
                logger.info(f"✅ Lot {lot.code_lot} terminé ! Prêt pour abattage.")
                self.lots_actifs.remove(lot)
                self.lots_termines.append(lot)

    async def cycle_gavage_quotidien(self):
        """Cycle principal: 2 gavages par jour"""
        logger.info("🚀 Démarrage cycle gavage quotidien...")
        logger.info(f"⏱️  Accélération: ×{self.acceleration} (1 jour réel = {86400/self.acceleration:.0f}s)")

        # Durée d'une journée (en secondes)
        duree_jour = 86400 / self.acceleration

        # Délai entre matin et soir (12h)
        delai_matin_soir = duree_jour / 2

        while True:
            # Si plus de lots actifs, arrêter
            if not self.lots_actifs:
                logger.info("📭 Plus de lots actifs. Simulation terminée.")
                break

            # Gavage matin (08h00)
            logger.info(f"\n☀️  MATIN - Jour {self.lots_actifs[0].jour_actuel + 1}")
            await self.effectuer_gavages("matin")

            # Attendre 12h (milieu de journée)
            await asyncio.sleep(delai_matin_soir)

            # Gavage soir (18h00)
            logger.info(f"\n🌙 SOIR - Jour {self.lots_actifs[0].jour_actuel}")
            await self.effectuer_gavages("soir")

            # Attendre 12h (nuit)
            await asyncio.sleep(delai_matin_soir)

    async def run(self):
        """Lance la simulation"""
        logger.info("="*60)
        logger.info("🦆 SIMULATEUR GAVAGE TEMPS RÉEL - Démarrage")
        logger.info("="*60)

        # Créer lots initiaux (J-1)
        self.creer_lots_initiaux()

        # Attendre un peu (simulation J-1 → J0)
        logger.info("\n⏳ Attente début gavage (J0)...")
        await asyncio.sleep(5)

        # Lancer cycle gavage
        await self.cycle_gavage_quotidien()

        # Résumé final
        logger.info("\n" + "="*60)
        logger.info("📊 RÉSUMÉ SIMULATION")
        logger.info("="*60)
        logger.info(f"Lots terminés: {len(self.lots_termines)}")

        for lot in self.lots_termines:
            logger.info(
                f"  • {lot.code_lot}: {lot.gaveur_nom} - "
                f"{len(lot.canards_vivants)}/{lot.nb_canards_initial} vivants - "
                f"Poids moyen final: {lot.poids_moyen:.1f}g - "
                f"Mortalité: {lot.taux_mortalite:.2f}%"
            )


async def main():
    parser = argparse.ArgumentParser(description="Simulateur Gavage Temps Réel")
    parser.add_argument(
        "--backend-url",
        default="ws://localhost:8000/ws/gavage",
        help="URL WebSocket du backend (défaut: ws://localhost:8000/ws/gavage)"
    )
    parser.add_argument(
        "--nb-lots",
        type=int,
        default=3,
        help="Nombre de lots à simuler (défaut: 3)"
    )
    parser.add_argument(
        "--acceleration",
        type=int,
        default=1440,
        help="Facteur d'accélération temps (défaut: 1440 = 1 jour réel = 60 secondes)"
    )

    args = parser.parse_args()

    # Créer et lancer simulateur
    simulator = GavageSimulator(
        backend_url=args.backend_url,
        nb_lots=args.nb_lots,
        acceleration=args.acceleration
    )

    await simulator.run()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("\n\n⏹️  Simulation arrêtée par l'utilisateur")
    except Exception as e:
        logger.error(f"\n\n❌ Erreur fatale: {e}", exc_info=True)
