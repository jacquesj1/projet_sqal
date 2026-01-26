#!/usr/bin/env python3
"""
Génération données SQAL - Version pour Docker
Génère des données SQAL pour les lots CSV importés (LL*, LS*)
"""

import asyncio
import asyncpg
import random
import sys
from datetime import datetime, timedelta
from decimal import Decimal
import uuid
import json

# Configuration Docker
DATABASE_URL = "postgresql://gaveurs_admin:gaveurs_secure_2024@gaveurs_timescaledb:5432/gaveurs_db"

# Paramètres
NB_LOTS = 75
SAMPLES_PER_LOT = 30
FILTER_CSV = True  # Uniquement les lots LL* et LS*

print("=" * 80)
print("GÉNÉRATION DONNÉES SQAL - LOTS CSV")
print("=" * 80)
print()


def generate_tof_matrix():
    """Génère une matrice ToF 8x8 réaliste"""
    matrix = []
    base_distance = random.uniform(40, 80)  # Distance de base en mm

    for i in range(8):
        row = []
        for j in range(8):
            noise = random.uniform(-5, 5)
            distance = max(0, base_distance + noise)
            row.append(round(distance, 2))
        matrix.append(row)

    return matrix


def generate_spectral_data():
    """Génère données spectrales AS7341 (10 canaux)"""
    return {
        'ch_415nm': random.randint(5000, 15000),
        'ch_445nm': random.randint(6000, 16000),
        'ch_480nm': random.randint(7000, 17000),
        'ch_515nm': random.randint(8000, 18000),
        'ch_555nm': random.randint(9000, 19000),
        'ch_590nm': random.randint(8000, 18000),
        'ch_630nm': random.randint(7000, 17000),
        'ch_680nm': random.randint(6000, 16000),
        'clear': random.randint(20000, 50000),
        'nir': random.randint(10000, 30000)
    }


def calculate_grade(itm, sigma):
    """Calcule un grade basé sur ITM et sigma"""
    if itm is None:
        return 'B'

    itm_val = float(itm)
    sigma_val = float(sigma) if sigma else 0.15

    if itm_val < 15 and sigma_val < 0.15:
        return 'A+'
    elif itm_val < 17 and sigma_val < 0.18:
        return 'A'
    elif itm_val < 20 and sigma_val < 0.25:
        return 'B'
    elif itm_val < 25:
        return 'C'
    else:
        return 'REJECT'


async def generate_sqal_for_lot(conn, lot_id, code_lot, itm, sigma, nb_samples):
    """Génère des échantillons SQAL pour un lot"""

    grade = calculate_grade(itm, sigma)

    # Créer l'entrée dans sqal_sample_lots
    await conn.execute("""
        INSERT INTO sqal_sample_lots (lot_id, device_id, sampling_date, total_samples, grades_distribution)
        VALUES ($1, 1, NOW(), $2, $3)
        ON CONFLICT (lot_id) DO NOTHING
    """, lot_id, nb_samples, f'{{"A+": 0, "A": 0, "B": {nb_samples}, "C": 0, "REJECT": 0}}')

    # Générer les échantillons
    base_date = datetime.now() - timedelta(days=random.randint(1, 30))

    for i in range(nb_samples):
        sample_date = base_date + timedelta(minutes=i * 2)

        tof_matrix = generate_tof_matrix()
        spectral = generate_spectral_data()

        # Calculer indices
        freshness = random.uniform(0.75, 0.95)
        oxidation = random.uniform(0.05, 0.20)

        sample_id = f"SQAL_{code_lot}_{i:03d}_{uuid.uuid4().hex[:8]}"
        fat_quality = random.uniform(0.70, 0.90)
        fusion_score = random.uniform(0.75, 0.95)

        as7341_channels = {
            'F1_415nm': spectral['ch_415nm'],
            'F2_445nm': spectral['ch_445nm'],
            'F3_480nm': spectral['ch_480nm'],
            'F4_515nm': spectral['ch_515nm'],
            'F5_555nm': spectral['ch_555nm'],
            'F6_590nm': spectral['ch_590nm'],
            'F7_630nm': spectral['ch_630nm'],
            'F8_680nm': spectral['ch_680nm'],
            'Clear': spectral['clear'],
            'NIR': spectral['nir'],
        }

        await conn.execute(
            """
            INSERT INTO sensor_samples (
                timestamp,
                sample_id,
                device_id,
                lot_id,
                vl53l8ch_distance_matrix,
                vl53l8ch_reflectance_matrix,
                vl53l8ch_amplitude_matrix,
                as7341_channels,
                as7341_freshness_index,
                as7341_fat_quality_index,
                as7341_oxidation_index,
                fusion_final_score,
                fusion_final_grade,
                fusion_vl53l8ch_score,
                fusion_as7341_score
            ) VALUES (
                $1, $2, $3, $4,
                $5::jsonb, $6::jsonb, $7::jsonb,
                $8::jsonb,
                $9, $10, $11,
                $12, $13, $14, $15
            )
            ON CONFLICT (sample_id) DO NOTHING
            """,
            sample_date,
            sample_id,
            'ESP32_LL_01',
            lot_id,
            json.dumps(tof_matrix),
            json.dumps(tof_matrix),
            json.dumps(tof_matrix),
            json.dumps(as7341_channels),
            freshness,
            fat_quality,
            oxidation,
            fusion_score,
            grade,
            fusion_score,
            fusion_score,
        )

    print(f"✅ Lot {code_lot} (ID: {lot_id}): {nb_samples} échantillons SQAL générés (Grade: {grade})")


async def main():
    """Point d'entrée"""

    print(f"🔌 Connexion à la base de données...")
    conn = await asyncpg.connect(DATABASE_URL)
    print(f"✅ Connecté\n")

    try:
        # Récupérer les lots CSV
        query = """
            SELECT id, code_lot, itm, sigma
            FROM lots_gavage
            WHERE (code_lot LIKE 'LL%' OR code_lot LIKE 'LS%')
              AND statut = 'termine'
            ORDER BY debut_lot DESC
            LIMIT $1
        """

        print(f"📋 Récupération des lots CSV...")
        lots = await conn.fetch(query, NB_LOTS)
        print(f"   {len(lots)} lots trouvés\n")

        if len(lots) == 0:
            print("⚠️  Aucun lot CSV trouvé (code_lot LIKE 'LL%' OR 'LS%')")
            return

        print(f"🔬 Génération de {SAMPLES_PER_LOT} échantillons SQAL par lot...\n")

        for idx, lot in enumerate(lots, 1):
            print(f"[{idx}/{len(lots)}] ", end="")
            await generate_sqal_for_lot(
                conn,
                lot['id'],
                lot['code_lot'],
                lot['itm'],
                lot['sigma'],
                SAMPLES_PER_LOT
            )

        print()
        print("=" * 80)
        print("RÉSUMÉ")
        print("=" * 80)

        # Compter les échantillons générés
        total_samples = await conn.fetchval("""
            SELECT COUNT(*) FROM sensor_samples
            WHERE lot_id IN (
                SELECT id FROM lots_gavage WHERE code_lot LIKE 'LL%' OR code_lot LIKE 'LS%'
            )
        """)

        total_lots = await conn.fetchval("""
            SELECT COUNT(*) FROM sqal_sample_lots
            WHERE lot_id IN (
                SELECT id FROM lots_gavage WHERE code_lot LIKE 'LL%' OR code_lot LIKE 'LS%'
            )
        """)

        print(f"✅ Lots avec SQAL: {total_lots}")
        print(f"✅ Échantillons SQAL: {total_samples}")
        print()
        print("🎉 Génération SQAL terminée!")
        print()
        print("Prochaine étape:")
        print("  → Ouvrir http://localhost:3000/analytics/qualite")
        print("  → Vérifier le Network Graph avec 20 variables")

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
