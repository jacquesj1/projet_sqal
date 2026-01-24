#!/usr/bin/env python3
"""
Génération données quotidiennes réalistes pour lots CSV
Basé sur ITM, sigma, total_corn_real_g, et durée_du_lot
"""

import asyncio
import asyncpg
import random
from datetime import datetime, timedelta
from decimal import Decimal

DATABASE_URL = "postgresql://gaveurs_admin:gaveurs_secure_2024@gaveurs_timescaledb:5432/gaveurs_db"


def generate_courbe_gavage(duree: int, total_corn: float, itm: float) -> list:
    """
    Génère une courbe de gavage réaliste

    Paramètres:
    - duree: nombre de jours (généralement 11-12)
    - total_corn: dose totale de maïs (g)
    - itm: indice technico-musculaire (plus bas = meilleure qualité)
    """
    courbe = []

    # Profil classique de gavage: progression puis plateau
    # Jours 1-3: montée progressive (30-40% du total)
    # Jours 4-8: plateau haut (50% du total)
    # Jours 9-fin: maintien/légère baisse (20-30% du total)

    doses_jour = []

    for jour in range(1, duree + 1):
        if jour <= 3:
            # Phase montée: 80-120g + progression
            dose = 80 + (jour - 1) * 40 + random.uniform(-10, 10)
        elif jour <= 8:
            # Phase plateau: 180-220g
            dose = 200 + random.uniform(-20, 20)
        else:
            # Phase maintien: 150-180g
            dose = 165 + random.uniform(-15, 15)

        # Ajuster selon ITM (ITM bas = doses mieux maîtrisées)
        if itm < 15:
            dose *= random.uniform(0.95, 1.05)  # Bonne maîtrise
        elif itm < 20:
            dose *= random.uniform(0.90, 1.10)  # Maîtrise moyenne
        else:
            dose *= random.uniform(0.85, 1.15)  # Maîtrise faible

        doses_jour.append(max(50, dose))  # Minimum 50g

    # Normaliser pour atteindre le total_corn
    total_genere = sum(doses_jour)
    if total_genere > 0:
        facteur = total_corn / total_genere
        doses_jour = [d * facteur for d in doses_jour]

    return doses_jour


async def main():
    print("=" * 80)
    print("GÉNÉRATION DONNÉES QUOTIDIENNES POUR LOTS CSV")
    print("=" * 80)
    print()

    conn = await asyncpg.connect(DATABASE_URL)

    try:
        # Récupérer lots CSV sans données quotidiennes
        lots = await conn.fetch("""
            SELECT
                l.id, l.code_lot, l.debut_lot, l.duree_du_lot,
                l.itm, l.sigma, l.total_corn_real_g, l.nb_accroches,
                l.poids_foie_moyen_g
            FROM lots_gavage l
            WHERE (l.code_lot LIKE 'LL%' OR l.code_lot LIKE 'LS%')
              AND l.duree_du_lot IS NOT NULL
              AND l.duree_du_lot > 0
              AND l.total_corn_real_g IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1 FROM doses_journalieres d
                  WHERE d.lot_id = l.id
                  LIMIT 5
              )
            ORDER BY l.debut_lot DESC
        """)

        print(f"📋 {len(lots)} lots CSV sans données quotidiennes trouvés\n")

        if len(lots) == 0:
            print("✅ Tous les lots ont déjà des données quotidiennes!")
            return

        total_doses = 0

        for idx, lot in enumerate(lots, 1):
            lot_id = lot['id']
            code_lot = lot['code_lot']
            debut = lot['debut_lot']
            duree = lot['duree_du_lot']
            itm = float(lot['itm']) if lot['itm'] else 17.0
            sigma = float(lot['sigma']) if lot['sigma'] else 0.15
            total_corn = float(lot['total_corn_real_g']) if lot['total_corn_real_g'] else 7000
            nb_canards = lot['nb_accroches'] or 1000

            # Générer courbe de gavage
            doses = generate_courbe_gavage(duree, total_corn, itm)

            # Insérer dans doses_journalieres
            poids_initial = 4500  # Poids initial estimé
            cumul = 0

            for jour in range(1, duree + 1):
                # 2 repas par jour (matin et soir)
                dose_jour = doses[jour - 1]
                dose_matin = dose_jour * 0.45  # 45% matin
                dose_soir = dose_jour * 0.55   # 55% soir

                # Évolution du poids
                poids_moyen = poids_initial + (jour / duree) * 2000

                # Mortalité progressive
                nb_vivants = max(
                    nb_canards - int(nb_canards * 0.02 * (jour / duree)),
                    int(nb_canards * 0.98)
                )
                taux_mort = (nb_canards - nb_vivants) / nb_canards * 100

                # Température et humidité
                temp = 20 + random.uniform(-2, 2)
                humid = 65 + random.uniform(-5, 5)

                # Dose théorique vs réelle (variation selon sigma)
                variation_matin = random.uniform(-sigma * 100, sigma * 100)
                variation_soir = random.uniform(-sigma * 100, sigma * 100)

                # Matin
                time_matin = debut + timedelta(days=jour - 1, hours=8)
                cumul += dose_matin

                await conn.execute("""
                    INSERT INTO doses_journalieres (
                        time, lot_id, jour_gavage, feed_target, feed_real,
                        corn_variation, delta_feed, cumul_corn, code_lot,
                        jour, moment, dose_theorique, dose_reelle,
                        poids_moyen, nb_vivants, taux_mortalite,
                        temperature, humidite
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
                    )
                    ON CONFLICT (time, lot_id, jour_gavage) DO NOTHING
                """,
                    time_matin, lot_id, jour, dose_matin, dose_matin + variation_matin,
                    variation_matin, variation_matin, cumul, code_lot,
                    jour, 'matin', dose_matin, dose_matin + variation_matin,
                    poids_moyen, nb_vivants, taux_mort,
                    temp, humid
                )

                # Soir
                time_soir = debut + timedelta(days=jour - 1, hours=18)
                cumul += dose_soir

                await conn.execute("""
                    INSERT INTO doses_journalieres (
                        time, lot_id, jour_gavage, feed_target, feed_real,
                        corn_variation, delta_feed, cumul_corn, code_lot,
                        jour, moment, dose_theorique, dose_reelle,
                        poids_moyen, nb_vivants, taux_mortalite,
                        temperature, humidite
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
                    )
                    ON CONFLICT (time, lot_id, jour_gavage) DO NOTHING
                """,
                    time_soir, lot_id, jour, dose_soir, dose_soir + variation_soir,
                    variation_soir, variation_soir, cumul, code_lot,
                    jour, 'soir', dose_soir, dose_soir + variation_soir,
                    poids_moyen, nb_vivants, taux_mort,
                    temp, humid
                )

                total_doses += 2

            print(f"[{idx}/{len(lots)}] ✅ {code_lot}: {duree * 2} doses (ITM: {itm:.2f}, Total: {total_corn:.0f}g)")

        print()
        print("=" * 80)
        print("RÉSUMÉ")
        print("=" * 80)
        print(f"✅ Lots traités: {len(lots)}")
        print(f"✅ Doses insérées: {total_doses}")
        print()
        print("🎉 Génération terminée!")
        print()
        print("→ Maintenant les corrélations dans le Network Graph seront visibles")
        print("→ Testez: http://localhost:3000/analytics/qualite")

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
