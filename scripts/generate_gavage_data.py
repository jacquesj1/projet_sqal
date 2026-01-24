#!/usr/bin/env python3
"""
Script pour générer des données de gavage cohérentes pour tests

Usage:
    python scripts/generate_gavage_data.py --lot-id 1 --jours 14 --poids-initial 4500
"""

import requests
import argparse
from datetime import datetime, timedelta
from typing import List
import random

API_URL = "http://localhost:8000"


def generer_poids_echantillon(poids_moyen: float, nb_canards: int = 10) -> List[float]:
    """Génère des poids individuels avec variation de ±3% autour de la moyenne"""
    variation = poids_moyen * 0.03
    poids = []
    for _ in range(nb_canards):
        offset = (random.random() - 0.5) * 2 * variation
        poids.append(round(poids_moyen + offset, 1))
    return poids


def generer_gavages_coherents(
    lot_id: int,
    jours: int,
    poids_initial: float,
    date_debut: str = None,
    tag_simulateur: bool = True
):
    """
    Génère des données de gavage cohérentes avec progression réaliste

    Args:
        lot_id: ID du lot
        jours: Nombre de jours de gavage à générer
        poids_initial: Poids initial des canards
        date_debut: Date de début (format YYYY-MM-DD), par défaut aujourd'hui - jours
        tag_simulateur: Ajouter "[SIMULATEUR]" dans les remarques
    """

    # Calculer la date de début
    if date_debut:
        date_actuelle = datetime.strptime(date_debut, "%Y-%m-%d")
    else:
        # Par défaut, commencer il y a N jours pour arriver à aujourd'hui
        date_actuelle = datetime.now() - timedelta(days=jours - 1)

    poids_actuel = poids_initial

    print(f"\n🚀 Génération de {jours} jours de gavage pour lot {lot_id}")
    print(f"   Poids initial: {poids_initial}g")
    print(f"   Date début: {date_actuelle.strftime('%Y-%m-%d')}")
    print(f"   Tag simulateur: {tag_simulateur}\n")

    for jour in range(1, jours + 1):
        # Progression réaliste du gavage
        # Jours 1-3: 60-80g/jour
        # Jours 4-10: 80-100g/jour (phase de croissance)
        # Jours 11-14: 40-60g/jour (ralentissement)

        if jour <= 3:
            gain_jour = random.uniform(60, 80)
            dose_matin = random.uniform(120, 150)
            dose_soir = random.uniform(120, 150)
        elif jour <= 10:
            gain_jour = random.uniform(80, 100)
            dose_matin = random.uniform(150, 180)
            dose_soir = random.uniform(150, 180)
        else:
            gain_jour = random.uniform(40, 60)
            dose_matin = random.uniform(160, 200)
            dose_soir = random.uniform(160, 200)

        poids_actuel += gain_jour

        # Générer poids échantillon
        poids_echantillon = generer_poids_echantillon(poids_actuel, 10)
        poids_moyen_reel = sum(poids_echantillon) / len(poids_echantillon)

        # Préparer remarques
        remarques = ""
        if tag_simulateur:
            remarques = f"[SIMULATEUR] Jour {jour}/14 - Gain: +{gain_jour:.1f}g"

        # Créer payload
        payload = {
            "lot_id": lot_id,
            "date_gavage": date_actuelle.strftime("%Y-%m-%d"),
            "jour_gavage": jour,
            "dose_matin": round(dose_matin, 1),
            "dose_soir": round(dose_soir, 1),
            "dose_totale_jour": round(dose_matin + dose_soir, 1),
            "heure_gavage_matin": "08:30",
            "heure_gavage_soir": "18:30",
            "nb_canards_peses": 10,
            "poids_echantillon": poids_echantillon,
            "poids_moyen_mesure": round(poids_moyen_reel, 1),
            "temperature_stabule": round(random.uniform(20, 24), 1),
            "humidite_stabule": round(random.uniform(60, 70), 1),
            "suit_courbe_theorique": True,
            "remarques": remarques,
            "mortalite_jour": 0,
            "alerte_generee": False,
            "prediction_activee": False,
        }

        # Envoyer à l'API
        try:
            response = requests.post(f"{API_URL}/api/lots/gavage", json=payload)
            if response.status_code == 200:
                print(f"✅ J{jour:2d} ({date_actuelle.strftime('%Y-%m-%d')}): "
                      f"{poids_moyen_reel:6.1f}g (+{gain_jour:4.1f}g) - "
                      f"Doses: {dose_matin:.0f}g + {dose_soir:.0f}g")
            else:
                print(f"❌ J{jour:2d}: Erreur {response.status_code}")
                print(f"   {response.text}")
        except Exception as e:
            print(f"❌ J{jour:2d}: Exception - {e}")

        # Passer au jour suivant
        date_actuelle += timedelta(days=1)
        poids_actuel = poids_moyen_reel  # Utiliser le poids réel calculé

    print(f"\n✅ Génération terminée")
    print(f"   Poids final: {poids_actuel:.1f}g")
    print(f"   Gain total: +{poids_actuel - poids_initial:.1f}g")
    print(f"   Gain moyen/jour: +{(poids_actuel - poids_initial) / jours:.1f}g")


def main():
    parser = argparse.ArgumentParser(
        description="Génère des données de gavage cohérentes pour tests"
    )
    parser.add_argument(
        "--lot-id",
        type=int,
        default=1,
        help="ID du lot (défaut: 1)"
    )
    parser.add_argument(
        "--jours",
        type=int,
        default=14,
        help="Nombre de jours de gavage (défaut: 14)"
    )
    parser.add_argument(
        "--poids-initial",
        type=float,
        default=4500,
        help="Poids initial en grammes (défaut: 4500)"
    )
    parser.add_argument(
        "--date-debut",
        type=str,
        default=None,
        help="Date de début YYYY-MM-DD (défaut: aujourd'hui - jours)"
    )
    parser.add_argument(
        "--no-tag",
        action="store_true",
        help="Ne pas ajouter [SIMULATEUR] dans les remarques"
    )

    args = parser.parse_args()

    generer_gavages_coherents(
        lot_id=args.lot_id,
        jours=args.jours,
        poids_initial=args.poids_initial,
        date_debut=args.date_debut,
        tag_simulateur=not args.no_tag
    )


if __name__ == "__main__":
    main()
