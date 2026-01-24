"""Test direct d'insertion dans sqal_sensor_samples"""
import asyncio
import asyncpg
import json
from datetime import datetime

async def test_insert():
    # Connect to database
    conn = await asyncpg.connect(
        host="localhost",
        port=5432,
        user="gaveurs_admin",
        password="gaveurs_secure_2024",
        database="gaveurs_db"
    )

    try:
        # Prepare test data
        distance_matrix = [[100]*8 for _ in range(8)]
        reflectance_matrix = [[150]*8 for _ in range(8)]
        amplitude_matrix = [[100]*8 for _ in range(8)]

        channels = {
            "F1_415nm": 1000,
            "F2_445nm": 1200,
            "F3_480nm": 1500,
            "F4_515nm": 1800,
            "F5_555nm": 2000,
            "F6_590nm": 1700,
            "F7_630nm": 1400,
            "F8_680nm": 1100,
            "Clear": 5000,
            "NIR": 800
        }

        # Execute INSERT
        await conn.execute(
            """
            INSERT INTO sqal_sensor_samples (
                time, sample_id, device_id, lot_id,
                vl53l8ch_distance_matrix, vl53l8ch_reflectance_matrix, vl53l8ch_amplitude_matrix,
                vl53l8ch_volume_mm3, vl53l8ch_surface_uniformity, vl53l8ch_quality_score, vl53l8ch_grade,
                as7341_channels, as7341_freshness_index, as7341_fat_quality_index,
                as7341_oxidation_index, as7341_quality_score,
                fusion_final_score, fusion_final_grade, fusion_is_compliant
            )
            VALUES (
                $1, $2, $3, $4,
                $5, $6, $7,
                $8, $9, $10, $11,
                $12, $13, $14, $15, $16,
                $17, $18, $19
            )
            """,
            datetime.utcnow(),
            "TEST-DB-001",
            "TEST",
            None,  # lot_id
            json.dumps(distance_matrix),
            json.dumps(reflectance_matrix),
            json.dumps(amplitude_matrix),
            500000.0,  # volume
            0.9,  # uniformity
            0.85,  # quality_score
            "A+",  # grade
            json.dumps(channels),
            0.9,  # freshness
            0.85,  # fat_quality
            0.05,  # oxidation
            0.88,  # quality_score
            0.86,  # final_score
            "A+",  # final_grade
            True  # is_compliant
        )

        print("✅ INSERT successful!")

        # Verify
        row = await conn.fetchrow(
            "SELECT sample_id, fusion_final_grade FROM sqal_sensor_samples WHERE sample_id = $1",
            "TEST-DB-001"
        )
        print(f"✅ Verified: {row}")

    except Exception as e:
        print(f"❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(test_insert())
