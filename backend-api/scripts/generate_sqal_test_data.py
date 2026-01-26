#!/usr/bin/env python3
"""
================================================================================
SCRIPT: Génération de Données Test SQAL
================================================================================
Description : Génère des mesures SQAL réalistes pour les lots existants
Date        : 12 Janvier 2026
Usage       : python scripts/generate_sqal_test_data.py [--nb-lots N] [--samples-per-lot M]
================================================================================

Génère des mesures de capteurs ToF (VL53L8CH) et Spectral (AS7341) pour:
- Poids de foie calculé depuis volume 3D
- Grades qualité (A+, A, B, C, REJECT)
- Indices spectraux (fraîcheur, oxydation, qualité gras)
- Scores fusion (60% VL53L8CH + 40% AS7341)

Les données générées sont cohérentes avec:
- ITM du lot (meilleur ITM → meilleur grade)
- Volume foie (450-600 mm³ × 1000 = poids 450-600g)
- Distribution réaliste de grades (70% A/A+, 20% B, 10% C/REJECT)
"""

import asyncio
import asyncpg
import os
import random
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any
import argparse

# Configuration database
DATABASE_URL = os.getenv(
    'DATABASE_URL',
    'postgresql://gaveurs_admin:gaveurs_secure_2024@localhost:5432/gaveurs_db'
)

# ============================================================================
# PARAMÈTRES DE GÉNÉRATION
# ============================================================================

# Distribution des grades (réaliste pour production de qualité)
GRADE_DISTRIBUTION = {
    'A+': 0.30,  # 30% grade A+
    'A': 0.40,   # 40% grade A
    'B': 0.20,   # 20% grade B
    'C': 0.08,   # 8% grade C
    'REJECT': 0.02  # 2% rejet
}

# Paramètres par grade
GRADE_PARAMS = {
    'A+': {
        'volume_mm3': (520000, 580000),  # Volume élevé
        'uniformity': (0.90, 0.98),
        'freshness': (0.92, 0.99),
        'fat_quality': (0.90, 0.98),
        'oxidation': (0.00, 0.05),
        'score': (0.92, 0.99)
    },
    'A': {
        'volume_mm3': (480000, 540000),
        'uniformity': (0.82, 0.92),
        'freshness': (0.85, 0.94),
        'fat_quality': (0.83, 0.92),
        'oxidation': (0.03, 0.08),
        'score': (0.82, 0.92)
    },
    'B': {
        'volume_mm3': (420000, 490000),
        'uniformity': (0.70, 0.85),
        'freshness': (0.75, 0.87),
        'fat_quality': (0.72, 0.85),
        'oxidation': (0.06, 0.12),
        'score': (0.70, 0.82)
    },
    'C': {
        'volume_mm3': (360000, 430000),
        'uniformity': (0.58, 0.75),
        'freshness': (0.65, 0.78),
        'fat_quality': (0.60, 0.75),
        'oxidation': (0.10, 0.18),
        'score': (0.58, 0.70)
    },
    'REJECT': {
        'volume_mm3': (280000, 380000),
        'uniformity': (0.30, 0.60),
        'freshness': (0.40, 0.68),
        'fat_quality': (0.35, 0.62),
        'oxidation': (0.15, 0.35),
        'score': (0.30, 0.58)
    }
}

# Densité foie gras (source: Int. J. Food Properties 2016)
FOIE_DENSITY_G_CM3 = 0.947  # g/cm³


# ============================================================================
# FONCTIONS DE GÉNÉRATION
# ============================================================================

def select_grade_weighted() -> str:
    """Sélectionne un grade selon la distribution pondérée"""
    rand = random.random()
    cumulative = 0.0
    for grade, prob in GRADE_DISTRIBUTION.items():
        cumulative += prob
        if rand <= cumulative:
            return grade
    return 'A'  # Fallback


def generate_vl53l8ch_matrix(avg_distance_mm: float, uniformity: float) -> Dict[str, Any]:
    """
    Génère une matrice 8×8 ToF réaliste

    Args:
        avg_distance_mm: Distance moyenne (hauteur foie)
        uniformity: Uniformité surface (0.0-1.0)

    Returns:
        Matrices distance, reflectance, amplitude
    """
    std_dev = avg_distance_mm * (1 - uniformity) * 0.5

    distance_matrix = []
    reflectance_matrix = []
    amplitude_matrix = []

    for row in range(8):
        dist_row = []
        refl_row = []
        ampl_row = []

        for col in range(8):
            # Distance avec variation basée sur uniformité
            dist = max(5, random.gauss(avg_distance_mm, std_dev))
            dist_row.append(round(dist, 2))

            # Reflectance (corrélé à distance)
            refl = random.uniform(120, 200) * (1 + (dist - avg_distance_mm) / avg_distance_mm * 0.2)
            refl_row.append(round(refl, 1))

            # Amplitude (signal strength)
            ampl = random.uniform(800, 1500)
            ampl_row.append(round(ampl, 0))

        distance_matrix.append(dist_row)
        reflectance_matrix.append(refl_row)
        amplitude_matrix.append(ampl_row)

    return {
        'distance': distance_matrix,
        'reflectance': reflectance_matrix,
        'amplitude': amplitude_matrix
    }


def generate_as7341_channels(freshness: float, fat_quality: float, oxidation: float) -> Dict[str, int]:
    """
    Génère 10 canaux spectraux AS7341 réalistes

    Args:
        freshness: Indice fraîcheur (0.0-1.0)
        fat_quality: Indice qualité gras (0.0-1.0)
        oxidation: Indice oxydation (0.0-1.0, 0=aucune)

    Returns:
        Dict avec 10 canaux spectraux
    """
    # Canaux de base (valeurs typiques foie gras)
    base_channels = {
        'F1_415nm': 1200,  # Violet
        'F2_445nm': 1800,  # Bleu
        'F3_480nm': 2400,  # Cyan
        'F4_515nm': 3200,  # Vert
        'F5_555nm': 4500,  # Jaune-vert
        'F6_590nm': 5200,  # Jaune
        'F7_630nm': 4800,  # Orange
        'F8_680nm': 3600,  # Rouge
        'Clear': 28000,    # Total
        'NIR': 12000       # Near-infrared
    }

    # Modifications basées sur qualité
    for key in base_channels:
        # Fraîcheur affecte surtout bleu/vert (courtes longueurs d'onde)
        if key in ['F1_415nm', 'F2_445nm', 'F3_480nm']:
            base_channels[key] = int(base_channels[key] * (0.8 + freshness * 0.4))

        # Oxydation augmente rouge/NIR
        if key in ['F7_630nm', 'F8_680nm', 'NIR']:
            base_channels[key] = int(base_channels[key] * (1.0 + oxidation * 0.3))

        # Qualité gras affecte jaune/orange
        if key in ['F5_555nm', 'F6_590nm']:
            base_channels[key] = int(base_channels[key] * (0.85 + fat_quality * 0.3))

        # Ajouter bruit réaliste
        noise = random.uniform(0.95, 1.05)
        base_channels[key] = int(base_channels[key] * noise)

    return base_channels


def generate_sqal_sample(
    lot_id: int,
    device_id: str,
    timestamp: datetime,
    grade: str
) -> Dict[str, Any]:
    """
    Génère un échantillon SQAL complet pour un grade donné

    Args:
        lot_id: ID du lot
        device_id: ID du device ESP32
        timestamp: Timestamp de la mesure
        grade: Grade cible (A+, A, B, C, REJECT)

    Returns:
        Dict avec toutes les données SQAL
    """
    params = GRADE_PARAMS[grade]

    # Volume et dimensions
    volume_mm3 = random.uniform(*params['volume_mm3'])
    # Volume = surface × hauteur (approx cube de ~80mm de côté)
    avg_height_mm = (volume_mm3 / (80 * 80)) ** (1/3) * 80
    max_height_mm = avg_height_mm * random.uniform(1.05, 1.15)
    min_height_mm = avg_height_mm * random.uniform(0.85, 0.95)
    uniformity = random.uniform(*params['uniformity'])

    # Poids foie calculé depuis volume
    poids_foie_g = (volume_mm3 / 1000.0) * FOIE_DENSITY_G_CM3

    # Indices qualité
    freshness = random.uniform(*params['freshness'])
    fat_quality = random.uniform(*params['fat_quality'])
    oxidation = random.uniform(*params['oxidation'])

    # Scores
    vl53l8ch_score = random.uniform(*params['score'])
    as7341_score = random.uniform(params['score'][0] * 0.95, params['score'][1] * 1.02)
    fusion_score = vl53l8ch_score * 0.6 + as7341_score * 0.4

    # Matrices ToF
    matrices = generate_vl53l8ch_matrix(avg_height_mm, uniformity)

    # Canaux spectraux
    channels = generate_as7341_channels(freshness, fat_quality, oxidation)

    # Sample ID unique
    sample_id = f"SAMPLE-{timestamp.strftime('%Y%m%d-%H%M%S')}-{random.randint(100,999)}"

    return {
        'timestamp': timestamp,
        'sample_id': sample_id,
        'device_id': device_id,
        'lot_id': lot_id,

        # VL53L8CH matrices (JSONB)
        'vl53l8ch_distance_matrix': json.dumps(matrices['distance']),
        'vl53l8ch_reflectance_matrix': json.dumps(matrices['reflectance']),
        'vl53l8ch_amplitude_matrix': json.dumps(matrices['amplitude']),

        # VL53L8CH analyses
        'vl53l8ch_volume_mm3': round(volume_mm3, 2),
        'vl53l8ch_avg_height_mm': round(avg_height_mm, 2),
        'vl53l8ch_max_height_mm': round(max_height_mm, 2),
        'vl53l8ch_min_height_mm': round(min_height_mm, 2),
        'vl53l8ch_surface_uniformity': round(uniformity, 4),
        'vl53l8ch_quality_score': round(vl53l8ch_score, 4),
        'vl53l8ch_grade': grade,

        # AS7341 données
        'as7341_channels': json.dumps(channels),
        'as7341_integration_time': random.randint(100, 300),
        'as7341_gain': random.choice([1, 2, 4, 8, 16]),

        # AS7341 indices
        'as7341_freshness_index': round(freshness, 4),
        'as7341_fat_quality_index': round(fat_quality, 4),
        'as7341_oxidation_index': round(oxidation, 4),
        'as7341_quality_score': round(as7341_score, 4),
        'as7341_grade': grade,

        # Fusion
        'fusion_final_score': round(fusion_score, 4),
        'fusion_final_grade': grade,
        'fusion_vl53l8ch_score': round(vl53l8ch_score, 4),
        'fusion_as7341_score': round(as7341_score, 4),
        # Poids foie calculé
        'poids_foie_estime_g': round(poids_foie_g, 1),

        # Métadonnées
        'meta_firmware_version': 'v3.2.1',
        'meta_temperature_c': round(random.uniform(18.0, 23.0), 1),
        'meta_humidity_percent': round(random.uniform(55.0, 75.0), 1),
        'meta_config_profile': 'foiegras_premium'
    }


# ============================================================================
# INSERTION BASE DE DONNÉES
# ============================================================================

async def insert_sqal_samples(conn: asyncpg.Connection, samples: List[Dict[str, Any]]) -> int:
    """Insère les échantillons SQAL en base de données"""

    insert_query = """
        INSERT INTO sensor_samples (
            timestamp,
            sample_id,
            device_id,
            lot_id,

            vl53l8ch_distance_matrix,
            vl53l8ch_reflectance_matrix,
            vl53l8ch_amplitude_matrix,
            vl53l8ch_volume_mm3,
            vl53l8ch_avg_height_mm,
            vl53l8ch_max_height_mm,
            vl53l8ch_min_height_mm,
            vl53l8ch_surface_uniformity,
            vl53l8ch_quality_score,
            vl53l8ch_grade,

            as7341_channels,
            as7341_integration_time,
            as7341_gain,
            as7341_freshness_index,
            as7341_fat_quality_index,
            as7341_oxidation_index,
            as7341_quality_score,
            as7341_grade,

            fusion_final_score,
            fusion_final_grade,
            fusion_vl53l8ch_score,
            fusion_as7341_score,

            poids_foie_estime_g,
            meta_firmware_version,
            meta_temperature_c,
            meta_humidity_percent,
            meta_config_profile
        ) VALUES (
            $1, $2, $3, $4,
            $5::jsonb, $6::jsonb, $7::jsonb,
            $8, $9, $10, $11, $12, $13, $14,
            $15::jsonb, $16, $17,
            $18, $19, $20, $21, $22,
            $23, $24, $25, $26,
            $27,
            $28, $29, $30, $31
        )
        ON CONFLICT (sample_id) DO NOTHING
    """

    inserted = 0
    for sample in samples:
        try:
            await conn.execute(
                insert_query,
                sample['timestamp'], sample['sample_id'], sample['device_id'], sample['lot_id'],
                sample['vl53l8ch_distance_matrix'], sample['vl53l8ch_reflectance_matrix'], sample['vl53l8ch_amplitude_matrix'],
                sample['vl53l8ch_volume_mm3'], sample['vl53l8ch_avg_height_mm'], sample['vl53l8ch_max_height_mm'],
                sample['vl53l8ch_min_height_mm'], sample['vl53l8ch_surface_uniformity'],
                sample['vl53l8ch_quality_score'], sample['vl53l8ch_grade'],
                sample['as7341_channels'], sample['as7341_integration_time'], sample['as7341_gain'],
                sample['as7341_freshness_index'], sample['as7341_fat_quality_index'], sample['as7341_oxidation_index'],
                sample['as7341_quality_score'], sample['as7341_grade'],
                sample['fusion_final_score'], sample['fusion_final_grade'],
                sample['fusion_vl53l8ch_score'], sample['fusion_as7341_score'],
                sample['poids_foie_estime_g'],
                sample['meta_firmware_version'], sample['meta_temperature_c'], sample['meta_humidity_percent'], sample['meta_config_profile']
            )
            inserted += 1
        except Exception as e:
            print(f"❌ Erreur insertion sample {sample['sample_id']}: {e}")

    return inserted


# ============================================================================
# MAIN
# ============================================================================

async def main(nb_lots: int = 5, samples_per_lot: int = 30, filter_csv: bool = False):
    """
    Génère des données SQAL pour les lots existants

    Args:
        nb_lots: Nombre de lots à traiter
        samples_per_lot: Nombre d'échantillons par lot
        filter_csv: Si True, ne traiter que les lots importés depuis CSV (code_lot LIKE 'LL%')
    """
    print("=" * 80)
    print("GÉNÉRATION DONNÉES TEST SQAL")
    print("=" * 80)
    print()

    if filter_csv:
        print("🎯 Mode: Lots importés CSV uniquement (code_lot LIKE 'LL%')\n")

    conn = await asyncpg.connect(DATABASE_URL)

    try:
        # Récupérer lots existants
        query = """
            SELECT id, code_lot, statut, date_debut_gavage, date_fin_gavage_reelle
            FROM lots
            WHERE statut IN ('termine', 'abattu')
        """

        if filter_csv:
            query += " AND code_lot LIKE 'LL%'"

        query += " ORDER BY id DESC LIMIT $1"

        lots = await conn.fetch(query, nb_lots)

        if not lots:
            print("❌ Aucun lot trouvé en statut 'termine' ou 'abattu'")
            return

        print(f"📊 {len(lots)} lot(s) trouvé(s):")
        for lot in lots:
            print(f"   - Lot {lot['id']}: {lot['code_lot']} ({lot['statut']})")
        print()

        # Vérifier/créer device SQAL
        device_id = 'ESP32_LL_01'
        device = await conn.fetchrow(
            "SELECT device_id FROM sqal_devices WHERE device_id = $1",
            device_id
        )

        if not device:
            print(f"📱 Création device {device_id}...")
            await conn.execute("""
                INSERT INTO sqal_devices (device_id, device_name, device_type, site_code, status, config_profile)
                VALUES ($1, 'ESP32 Landerneau 01', 'ESP32', 'LL', 'active', 'foiegras_premium')
            """, device_id)
            print(f"   ✅ Device {device_id} créé")

        print()

        # Générer échantillons pour chaque lot
        total_samples = 0

        for lot in lots:
            lot_id = lot['id']
            code_lot = lot['code_lot']

            # Date fin gavage ou aujourd'hui
            end_date = lot['date_fin_gavage_reelle'] or datetime.now()
            if isinstance(end_date, str):
                end_date = datetime.fromisoformat(end_date.replace('Z', '+00:00'))

            print(f"🔬 Génération {samples_per_lot} échantillons pour lot {code_lot}...")

            samples = []
            for i in range(samples_per_lot):
                # Timestamp étalé sur 2 jours avant fin gavage
                hours_offset = random.uniform(0, 48)
                timestamp = end_date - timedelta(hours=hours_offset)

                # Sélectionner grade selon distribution
                grade = select_grade_weighted()

                # Générer échantillon
                sample = generate_sqal_sample(lot_id, device_id, timestamp, grade)
                samples.append(sample)

            # Insérer en base
            inserted = await insert_sqal_samples(conn, samples)
            total_samples += inserted

            print(f"   ✅ {inserted}/{samples_per_lot} échantillons insérés")

            # Statistiques par grade
            grade_counts = {}
            for sample in samples:
                grade = sample['fusion_final_grade']
                grade_counts[grade] = grade_counts.get(grade, 0) + 1

            print(f"   📊 Distribution grades: {dict(sorted(grade_counts.items()))}")

        print()
        print("=" * 80)
        print(f"✅ GÉNÉRATION TERMINÉE")
        print("=" * 80)
        print(f"📊 Total échantillons insérés: {total_samples}")
        print(f"📦 Lots traités: {len(lots)}")
        print(f"📱 Device: {device_id}")
        print()
        print("Test endpoint qualité:")
        for lot in lots:
            print(f"   curl http://localhost:8000/api/lots/{lot['id']}/qualite")
        print()

    finally:
        await conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Génère des données test SQAL")
    parser.add_argument('--nb-lots', type=int, default=5, help="Nombre de lots à traiter (défaut: 5)")
    parser.add_argument('--samples-per-lot', type=int, default=30, help="Échantillons par lot (défaut: 30)")
    parser.add_argument('--filter-csv', action='store_true', help="Filtrer uniquement les lots CSV (code_lot LIKE 'LL%%')")

    args = parser.parse_args()

    asyncio.run(main(args.nb_lots, args.samples_per_lot, args.filter_csv))
