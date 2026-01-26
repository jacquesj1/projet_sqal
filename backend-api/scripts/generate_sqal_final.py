#!/usr/bin/env python3
"""
Génération SQAL - Structure réelle de sensor_samples
"""

import asyncio
import asyncpg
import random
import uuid
import json
from datetime import datetime, timedelta

DATABASE_URL = "postgresql://gaveurs_admin:gaveurs_secure_2024@gaveurs_timescaledb:5432/gaveurs_db"
SAMPLES_PER_LOT = 30

print("=" * 80)
print("GÉNÉRATION SQAL - LOTS CSV")
print("=" * 80)
print()


def generate_distance_matrix():
    """Génère matrice distance VL53L8CH 8x8"""
    base = random.uniform(40, 80)
    matrix = [[round(base + random.uniform(-5, 5), 2) for _ in range(8)] for _ in range(8)]
    return matrix


def generate_as7341_channels():
    """Génère canaux AS7341"""
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


def calculate_grade(itm):
    """Grade basé sur ITM"""
    if itm is None:
        return 'B'
    itm_val = float(itm)
    if itm_val < 15:
        return 'A+'
    elif itm_val < 17:
        return 'A'
    elif itm_val < 20:
        return 'B'
    elif itm_val < 25:
        return 'C'
    else:
        return 'REJECT'


async def main():
    print("🔌 Connexion DB...")
    conn = await asyncpg.connect(DATABASE_URL)
    print("✅ Connecté\n")

    try:
        # Récupérer device_id
        device_id = await conn.fetchval("SELECT device_id FROM sqal_devices LIMIT 1")
        if not device_id:
            device_id = 'ESP32_LL_01'
            await conn.execute("""
                INSERT INTO sqal_devices (device_id, device_name, device_type, status)
                VALUES ($1, 'Device Ligne A', 'ESP32', 'active')
            """, device_id)
            print(f"✅ Device créé: {device_id}\n")

        # Récupérer lots CSV
        lots = await conn.fetch("""
            SELECT id, code_lot, itm, sigma
            FROM lots_gavage
            WHERE (code_lot LIKE 'LL%' OR code_lot LIKE 'LS%')
              AND statut = 'termine'
            ORDER BY debut_lot DESC
            LIMIT 75
        """)

        print(f"📋 {len(lots)} lots CSV trouvés\n")
        print(f"🔬 Génération {SAMPLES_PER_LOT} échantillons/lot...\n")

        total_inserted = 0

        for idx, lot in enumerate(lots, 1):
            lot_id = lot['id']
            code_lot = lot['code_lot']
            grade = calculate_grade(lot['itm'])

            # Vérifier si échantillons existent
            existing = await conn.fetchval(
                "SELECT COUNT(*) FROM sensor_samples WHERE lot_id = $1", lot_id
            )

            if existing >= SAMPLES_PER_LOT:
                print(f"[{idx}/{len(lots)}] {code_lot}: {existing} échantillons déjà, skip")
                continue

            # Générer échantillons
            base_time = datetime.now() - timedelta(days=random.randint(1, 30))

            for i in range(SAMPLES_PER_LOT):
                sample_time = base_time + timedelta(minutes=i * 2)
                sample_id = f"SQAL_{code_lot}_{i:03d}_{uuid.uuid4().hex[:8]}"

                distance_matrix = generate_distance_matrix()
                reflectance_matrix = generate_distance_matrix()  # Simplifié
                amplitude_matrix = generate_distance_matrix()  # Simplifié
                as7341 = generate_as7341_channels()

                score = random.uniform(0.75, 0.95)

                await conn.execute("""
                    INSERT INTO sensor_samples (
                        timestamp,
                        sample_id,
                        device_id,
                        lot_id,
                        vl53l8ch_distance_matrix,
                        vl53l8ch_reflectance_matrix,
                        vl53l8ch_amplitude_matrix,
                        vl53l8ch_quality_score,
                        vl53l8ch_grade,
                        as7341_channels,
                        as7341_freshness_index,
                        as7341_fat_quality_index,
                        as7341_oxidation_index,
                        as7341_quality_score,
                        as7341_grade,
                        fusion_final_score,
                        fusion_final_grade,
                        fusion_vl53l8ch_score,
                        fusion_as7341_score
                    ) VALUES (
                        $1, $2, $3, $4,
                        $5::jsonb, $6::jsonb, $7::jsonb,
                        $8, $9,
                        $10::jsonb,
                        $11, $12, $13,
                        $14, $15,
                        $16, $17,
                        $18, $19
                    )
                    ON CONFLICT (sample_id) DO NOTHING
                """,
                    sample_time, sample_id, device_id, lot_id,
                    json.dumps(distance_matrix), json.dumps(reflectance_matrix), json.dumps(amplitude_matrix),
                    score, grade,
                    json.dumps(as7341),
                    random.uniform(0.75, 0.95),
                    random.uniform(0.70, 0.90),
                    random.uniform(0.05, 0.20),
                    score, grade,
                    score, grade,
                    score, score
                )

            total_inserted += SAMPLES_PER_LOT
            print(f"[{idx}/{len(lots)}] ✅ {code_lot}: {SAMPLES_PER_LOT} échantillons (Grade: {grade})")

        print()
        print("=" * 80)
        print("RÉSUMÉ")
        print("=" * 80)

        total = await conn.fetchval("""
            SELECT COUNT(*) FROM sensor_samples
            WHERE lot_id IN (
                SELECT id FROM lots_gavage WHERE code_lot LIKE 'LL%' OR code_lot LIKE 'LS%'
            )
        """)

        print(f"✅ Total échantillons SQAL (lots CSV): {total}")
        print(f"✅ Nouveaux insérés: {total_inserted}")
        print()
        print("🎉 Génération terminée!")
        print()
        print("→ Testez: http://localhost:3000/analytics/qualite")

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
