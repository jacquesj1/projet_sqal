#!/usr/bin/env python3
"""
Génération données SQAL SIMPLIFIÉ - Version Docker
Insère directement dans sensor_samples
"""

import asyncio
import asyncpg
import random
from datetime import datetime, timedelta
import json
import uuid

DATABASE_URL = "postgresql://gaveurs_admin:gaveurs_secure_2024@gaveurs_timescaledb:5432/gaveurs_db"
SAMPLES_PER_LOT = 30

print("=" * 80)
print("GÉNÉRATION SQAL - LOTS CSV")
print("=" * 80)
print()


def generate_tof_matrix():
    """Génère matrice ToF 8x8"""
    base = random.uniform(40, 80)
    matrix = []
    for i in range(8):
        row = [round(base + random.uniform(-5, 5), 2) for j in range(8)]
        matrix.append(row)
    return matrix


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
            print("⚠️  Aucun device SQAL trouvé, création...")
            device_id = 'ESP32_LL_01'
            await conn.execute("""
                INSERT INTO sqal_devices (device_id, device_name, device_type, status)
                VALUES ($1, 'Device Ligne A', 'ESP32', 'active')
            """, device_id)
            print(f"✅ Device créé (ID: {device_id})\n")

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

            # Vérifier si déjà des échantillons
            existing = await conn.fetchval(
                "SELECT COUNT(*) FROM sensor_samples WHERE lot_id = $1", lot_id
            )

            if existing >= SAMPLES_PER_LOT:
                print(f"[{idx}/{len(lots)}] Lot {code_lot}: déjà {existing} échantillons, skip")
                continue

            # Générer échantillons
            base_date = datetime.now() - timedelta(days=random.randint(1, 30))

            for i in range(SAMPLES_PER_LOT):
                sample_date = base_date + timedelta(minutes=i * 2)
                tof_matrix = generate_tof_matrix()

                sample_id = f"SQAL_{code_lot}_{i:03d}_{uuid.uuid4().hex[:8]}"

                as7341_channels = {
                    'F1_415nm': random.randint(5000, 15000),
                    'F2_445nm': random.randint(6000, 16000),
                    'F3_480nm': random.randint(7000, 17000),
                    'F4_515nm': random.randint(8000, 18000),
                    'F5_555nm': random.randint(9000, 19000),
                    'F6_590nm': random.randint(8000, 18000),
                    'F7_630nm': random.randint(7000, 17000),
                    'F8_680nm': random.randint(6000, 16000),
                    'Clear': random.randint(20000, 50000),
                    'NIR': random.randint(10000, 30000),
                }

                freshness_index = random.uniform(0.75, 0.95)
                oxidation_index = random.uniform(0.05, 0.20)
                fat_quality_index = random.uniform(0.70, 0.90)

                fusion_score = random.uniform(0.75, 0.95)

                await conn.execute("""
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
                    device_id,
                    lot_id,
                    json.dumps(tof_matrix),
                    json.dumps(tof_matrix),
                    json.dumps(tof_matrix),
                    json.dumps(as7341_channels),
                    freshness_index,
                    fat_quality_index,
                    oxidation_index,
                    fusion_score,
                    grade,
                    fusion_score,
                    fusion_score
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
        print(f"✅ Nouveaux échantillons insérés: {total_inserted}")
        print()
        print("🎉 Génération terminée!")
        print()
        print("→ Testez: http://localhost:3000/analytics/qualite")

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
