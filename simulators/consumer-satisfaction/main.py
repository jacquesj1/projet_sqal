#!/usr/bin/env python3
"""
Simulateur de Satisfaction Clients
Génère des feedbacks consommateurs réalistes pour boucler la boucle de feedback.

Ce simulateur :
1. Récupère les produits avec QR codes depuis l'API
2. Simule des scans de QR codes par des consommateurs
3. Génère des notes de satisfaction corrélées avec la qualité SQAL
4. Envoie les feedbacks à l'API backend
5. Permet de fermer la boucle : Gavage → SQAL → QR → Consommateur → Feedback → IA → Optimisation
"""

import asyncio
import argparse
import logging
import random
import sys
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import aiohttp
import json

# Configuration
DEFAULT_API_URL = "http://localhost:8000"
DEFAULT_INTERVAL = 10  # secondes entre chaque feedback
DEFAULT_NUM_FEEDBACKS = 5  # nombre de feedbacks à générer

# Profils de consommateurs (distribution réaliste)
CONSUMER_PROFILES = [
    {"name": "Enthousiaste", "weight": 0.15, "rating_range": (4, 5), "comment_style": "very_positive"},
    {"name": "Satisfait", "weight": 0.45, "rating_range": (3, 4), "comment_style": "positive"},
    {"name": "Neutre", "weight": 0.25, "rating_range": (3, 3), "comment_style": "neutral"},
    {"name": "Déçu", "weight": 0.10, "rating_range": (2, 3), "comment_style": "negative"},
    {"name": "Mécontent", "weight": 0.05, "rating_range": (1, 2), "comment_style": "very_negative"},
]

# Contextes de consommation (doit correspondre à l'enum ConsumptionContext de l'API)
CONSUMPTION_CONTEXTS = ["home", "restaurant", "special_event", "gift"]

# Modèles de commentaires par style
COMMENT_TEMPLATES = {
    "very_positive": [
        "Exceptionnel ! Texture fondante, goût sublime.",
        "Le meilleur foie gras que j'ai jamais goûté. Qualité remarquable.",
        "Produit d'excellence. La traçabilité est un vrai plus.",
        "Absolument parfait pour les fêtes. Invités ravis !",
        "Qualité artisanale exceptionnelle. Je recommande vivement.",
    ],
    "positive": [
        "Très bon produit, conforme aux attentes.",
        "Bonne qualité, texture agréable.",
        "Satisfait de mon achat. Bon rapport qualité/prix.",
        "Produit correct, goût authentique.",
        "Bon foie gras, texture homogène.",
    ],
    "neutral": [
        "Produit correct sans plus.",
        "Conforme à la description.",
        "RAS, produit standard.",
        "Acceptable pour le prix.",
        "Pas de mauvaise surprise.",
    ],
    "negative": [
        "Texture un peu granuleuse.",
        "Goût correct mais manque de finesse.",
        "Déçu par la texture, pas assez fondant.",
        "Attendais mieux pour ce prix.",
        "Qualité moyenne.",
    ],
    "very_negative": [
        "Très déçu, texture désagréable.",
        "Produit de qualité médiocre.",
        "Ne correspond pas à mes attentes.",
        "Goût bizarre, texture grasse.",
        "Rapport qualité/prix mauvais.",
    ],
}

# Logger
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)


class ConsumerSatisfactionSimulator:
    """Simulateur de satisfaction consommateur"""

    def __init__(self, api_url: str, interval: int = DEFAULT_INTERVAL, code_lot: Optional[str] = None):
        self.api_url = api_url.rstrip('/')
        self.interval = interval
        self.code_lot = code_lot
        self.session: Optional[aiohttp.ClientSession] = None
        self.running = False
        self.stats = {
            "feedbacks_sent": 0,
            "scans_simulated": 0,
            "errors": 0,
            "avg_rating": 0.0,
        }

    async def start(self):
        """Démarre le simulateur"""
        self.running = True
        self.session = aiohttp.ClientSession()
        logger.info(f"🎭 Simulateur de Satisfaction Clients démarré")
        logger.info(f"📡 API: {self.api_url}")
        logger.info(f"⏱️  Intervalle: {self.interval}s")

        try:
            await self.run()
        except KeyboardInterrupt:
            logger.info("⏹️  Arrêt demandé par l'utilisateur")
        except Exception as e:
            logger.error(f"❌ Erreur fatale: {e}", exc_info=True)
        finally:
            await self.stop()

    async def stop(self):
        """Arrête le simulateur"""
        self.running = False
        if self.session:
            await self.session.close()
        logger.info(f"📊 Stats finales: {json.dumps(self.stats, indent=2)}")
        logger.info("👋 Simulateur arrêté")

    async def run(self):
        """Boucle principale"""
        while self.running:
            try:
                # 1. Récupérer les produits disponibles
                products = await self.fetch_available_products()

                if not products:
                    logger.warning("⚠️  Aucun produit disponible pour feedback")
                    await asyncio.sleep(self.interval)
                    continue

                # 2. Sélectionner un produit aléatoire
                product = random.choice(products)
                qr_code = product.get('qr_code')
                product_id = product.get('product_id')

                logger.info(f"🛒 Produit sélectionné: {product_id}")

                # 3. Simuler un scan QR
                await self.simulate_qr_scan(qr_code)

                # 4. Générer et envoyer un feedback
                await self.generate_and_send_feedback(product)

                # 5. Attendre avant le prochain feedback
                await asyncio.sleep(self.interval)

            except Exception as e:
                logger.error(f"❌ Erreur dans la boucle: {e}", exc_info=True)
                self.stats["errors"] += 1
                await asyncio.sleep(self.interval)

    async def fetch_available_products(self) -> List[Dict]:
        """Récupère les produits avec QR codes disponibles"""
        try:
            url = f"{self.api_url}/api/consumer/products"
            params = {}
            if self.code_lot:
                params["code_lot"] = self.code_lot
            async with self.session.get(url, params=params, timeout=10) as response:
                if response.status == 200:
                    data = await response.json()
                    products = data if isinstance(data, list) else []
                    logger.info(f"📦 {len(products)} produits disponibles")
                    return products
                else:
                    logger.error(f"❌ Erreur fetch produits: HTTP {response.status}")
                    return []
        except Exception as e:
            logger.error(f"❌ Erreur fetch produits: {e}")
            return []

    async def simulate_qr_scan(self, qr_code: str):
        """Simule un scan de QR code"""
        try:
            url = f"{self.api_url}/api/consumer/scan/{qr_code}"
            async with self.session.get(url, timeout=10) as response:
                if response.status == 200:
                    data = await response.json()
                    logger.info(f"📱 Scan QR réussi: {qr_code[:20]}...")
                    self.stats["scans_simulated"] += 1
                    return data
                else:
                    logger.warning(f"⚠️  Scan QR échoué: HTTP {response.status}")
                    return None
        except Exception as e:
            logger.error(f"❌ Erreur scan QR: {e}")
            return None

    async def generate_and_send_feedback(self, product: Dict):
        """Génère et envoie un feedback réaliste"""
        try:
            # Sélectionner un profil consommateur (distribution pondérée)
            profile = random.choices(
                CONSUMER_PROFILES,
                weights=[p["weight"] for p in CONSUMER_PROFILES],
                k=1
            )[0]

            # Générer des notes basées sur le profil
            overall_rating = random.randint(*profile["rating_range"])

            # Corrélation qualité SQAL → satisfaction
            sqal_grade = product.get('sqal_grade', 'B')
            if sqal_grade in ['A+', 'A']:
                overall_rating = min(5, overall_rating + 1)  # Boost si excellente qualité
            elif sqal_grade in ['C', 'D']:
                overall_rating = max(1, overall_rating - 1)  # Pénalité si mauvaise qualité

            # Notes détaillées (corrélées avec la note globale)
            texture_rating = max(1, min(5, overall_rating + random.randint(-1, 1)))
            flavor_rating = max(1, min(5, overall_rating + random.randint(-1, 1)))
            freshness_rating = max(1, min(5, overall_rating + random.randint(-1, 1)))

            # Commentaire
            comment = random.choice(COMMENT_TEMPLATES[profile["comment_style"]])

            # Contexte de consommation
            consumption_context = random.choice(CONSUMPTION_CONTEXTS)

            # Construire le payload conforme au schéma Pydantic
            feedback_payload = {
                "product_id": product["product_id"],
                "qr_code": product["qr_code"],
                "overall_rating": overall_rating,
                "detailed_ratings": {
                    "texture": texture_rating,
                    "flavor": flavor_rating,
                    "freshness": freshness_rating,
                },
                "comment": comment,
                "consumption_context": consumption_context,
            }

            # Envoyer le feedback
            url = f"{self.api_url}/api/consumer/feedback"
            async with self.session.post(url, json=feedback_payload, timeout=10) as response:
                if response.status == 200:
                    data = await response.json()
                    logger.info(f"✅ Feedback envoyé: ⭐{overall_rating}/5 ({profile['name']}) - {comment[:50]}...")
                    self.stats["feedbacks_sent"] += 1

                    # Mettre à jour la moyenne
                    total = self.stats["feedbacks_sent"]
                    self.stats["avg_rating"] = (
                        (self.stats["avg_rating"] * (total - 1) + overall_rating) / total
                    )

                    return data
                else:
                    error_text = await response.text()
                    logger.error(f"❌ Erreur envoi feedback: HTTP {response.status} - {error_text}")
                    self.stats["errors"] += 1
                    return None

        except Exception as e:
            logger.error(f"❌ Erreur génération feedback: {e}", exc_info=True)
            self.stats["errors"] += 1
            return None


def main():
    """Point d'entrée principal"""
    parser = argparse.ArgumentParser(description='Simulateur de Satisfaction Clients')
    parser.add_argument('--api-url', default=DEFAULT_API_URL, help='URL de l\'API backend')
    parser.add_argument('--interval', type=int, default=DEFAULT_INTERVAL, help='Intervalle entre feedbacks (secondes)')
    parser.add_argument('--num-feedbacks', type=int, default=DEFAULT_NUM_FEEDBACKS, help='Nombre de feedbacks à générer')
    parser.add_argument('--code-lot', default=None, help='Code lot gavage à cibler (ex: LL2512001)')

    args = parser.parse_args()

    # Créer et démarrer simulateur
    simulator = ConsumerSatisfactionSimulator(args.api_url, args.interval, code_lot=args.code_lot)

    # Lancer simulation
    try:
        asyncio.run(simulator.start())
    except KeyboardInterrupt:
        logger.info("Arrêt demandé")


if __name__ == "__main__":
    main()
