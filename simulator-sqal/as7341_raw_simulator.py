#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AS7341 RAW SIMULATOR
Génère des données brutes spectrales du capteur AS7341 pour l'inspection foie gras
Sépare la génération de données de l'analyse (architecture similaire à VL53L8CH)
"""

import numpy as np
import random
import time
from datetime import datetime, date
from typing import Dict, Optional, Any, List

# ============================================================================
# CONSTANTES - Basées sur production-simulator-timescaledb.js
# ============================================================================

# Longueurs d'onde AS7341 (ordre standard)
WAVELENGTHS = [415, 445, 480, 515, 555, 590, 630, 680, 910]

# Éleveurs de foie gras (basé sur JS)
ELEVEURS = [
    "Ferme Dubois", "Domaine Lafitte", "Maison Pérès", "Ferme Duplantier",
    "Domaine Saint-Martin", "Ferme du Périgord", "Maison Rougie",
    "Domaine de Castelnau", "Ferme Labeyrie", "Domaine Montfort"
]

# Provenances (régions)
PROVENANCES = [
    "Landes", "Gers", "Périgord", "Vendée", "Lot", "Dordogne",
    "Alsace", "Aquitaine", "Midi-Pyrénées", "Pays de la Loire"
]

# Textures possibles
TEXTURES = ["Fondante", "Ferme", "Souple", "Granuleuse", "Onctueuse"]

# Couleurs possibles
COLORS = ["Beige rosé", "Beige clair", "Beige foncé", "Rosé", "Ivoire"]

# Lignes de production
PRODUCTION_LINES = ["Ligne A", "Ligne B", "Ligne C"]

# Préfixes de lot
LOT_PREFIXES = ["MG", "LL"]

# ============================================================================
# USER GUIDE - Explication des canaux spectraux
# ============================================================================

USER_GUIDE = {
    "Spectral_channels": (
        "Canaux spectraux AS7341 (photodiodes avec filtres):\n"
        "  F1 (violet)  : ~415nm - Détecte oxydation précoce\n"
        "  F2 (indigo)  : ~445nm - Pigments, fraîcheur\n"
        "  F3 (bleu)    : ~480nm - Composés azotés\n"
        "  F4 (cyan)    : ~515nm - Transition bleu-vert\n"
        "  F5 (vert)    : ~555nm - Chlorophylle, bile\n"
        "  F6 (jaune)   : ~590nm - Caroténoïdes, gras\n"
        "  F7 (orange)  : ~630nm - Hémoglobine, myoglobine\n"
        "  F8 (rouge)   : ~680nm - Oxydation lipidique\n"
        "  NIR          : ~910nm - Eau, structure protéique\n"
        "  Clear        : Broadband - Intensité totale\n"
        "  Flicker      : Détection scintillement (50/60Hz)"
    ),
    "Integration_time": (
        "Temps d'intégration (ms):\n"
        "  - Court (50-100ms)  : Rapide, faible sensibilité\n"
        "  - Moyen (100-200ms) : Équilibré (recommandé)\n"
        "  - Long (200-500ms)  : Haute sensibilité, risque saturation"
    ),
    "Gain": (
        "Amplification du signal:\n"
        "  - Gain 1x  : Forte luminosité\n"
        "  - Gain 4x  : Standard (recommandé)\n"
        "  - Gain 16x : Faible luminosité\n"
        "  - Gain 64x : Très faible luminosité (bruit élevé)"
    ),
    "Raw_counts": (
        "Valeurs brutes (0-65535):\n"
        "  - Reflètent l'intensité lumineuse par canal\n"
        "  - Dépendent de l'éclairage, produit, gain, integration_time\n"
        "  - Saturation à 65535 (éviter)"
    )
}


# ============================================================================
# AS7341 RAW SIMULATOR CLASS
# ============================================================================

class AS7341_RawSimulator:
    """
    Simulateur de données brutes du capteur spectral AS7341
    Génère uniquement les raw counts - pas d'analyse
    """

    def __init__(self,
                 integration_time_ms: int = 100,
                 gain: int = 4,
                 noise_std: float = 5.0,
                 random_seed: Optional[int] = None):
        """
        Initialise le simulateur AS7341

        Args:
            integration_time_ms: Temps d'intégration en ms (50-500)
            gain: Gain du capteur (1, 4, 16, 64)
            noise_std: Écart-type du bruit gaussien
            random_seed: Graine aléatoire pour reproductibilité
        """
        self.integration_time = int(integration_time_ms)
        self.gain = int(gain)
        self.noise_std = float(noise_std)

        if random_seed is not None:
            random.seed(random_seed)
            np.random.seed(random_seed)

        # Canaux spectraux du AS7341 (longueurs d'onde en nm)
        self.channels = {
            "F1_violet": 415,
            "F2_indigo": 445,
            "F3_blue": 480,
            "F4_cyan": 515,
            "F5_green": 555,
            "F6_yellow": 590,
            "F7_orange": 630,
            "F8_red": 680,
            "NIR": 910,
            "Clear": None,      # Broadband
            "Flicker": None     # Temporal
        }

        # Spectre de référence pour foie gras frais de qualité
        # Valeurs ajustées pour respecter les ratios optimaux (ratios.md)
        # Gain=4, integration=100ms
        #
        # Ratios cibles:
        # - Violet/Orange (F1/F7): 0.35 (plage 0.25-0.45)
        # - NIR/Violet (NIR/F1): 1.5 (plage 1.2-1.8)
        # - Décoloration (F5+F6)/(F1+F2): 1.5 (plage 1.3-1.7)
        # - Oxydation lipidique (F7+F8)/F4: 1.0 (plage 0.8-1.2)
        # - Freshness meat (F1+F2)/(F7+F8): 0.50 (plage 0.35-0.65)
        # - Oil oxidation (F1+F3)/(F5+F6): 0.65 (plage 0.5-0.8)
        self.reference_spectrum = {
            "F1_violet": 400,   # Base de référence
            "F2_indigo": 600,   # F1+F2 = 1000 pour calculs
            "F3_blue": 500,
            "F4_cyan": 1900,    # Pour lipid_oxid = (F7+F8)/F4 = 1.0
            "F5_green": 900,    # F5+F6 = 1500
            "F6_yellow": 600,
            "F7_orange": 1150,  # V/O = 400/1150 = 0.35, F7+F8 = 1900
            "F8_red": 750,
            "NIR": 600,         # NIR/V = 600/400 = 1.5
            "Clear": 6500,
            "Flicker": 0
        }

        # Facteurs d'oxydation (impact sur chaque canal)
        self.oxidation_factors = {
            "F1_violet": -0.3,  # Violet diminue avec oxydation
            "F2_indigo": -0.2,
            "F3_blue": 0.1,
            "F4_cyan": 0.2,
            "F5_green": -0.1,
            "F6_yellow": 0.4,   # Jaune augmente (rancissement)
            "F7_orange": -0.2,
            "F8_red": -0.4,     # Rouge diminue
            "NIR": 0.1,
            "Clear": -0.15
        }

        # Facteurs de vieillissement
        self.aging_factors = {
            "F1_violet": -0.4,
            "F2_indigo": -0.3,
            "F3_blue": -0.2,
            "F4_cyan": 0.1,
            "F5_green": 0.2,
            "F6_yellow": -0.1,
            "F7_orange": -0.3,
            "F8_red": -0.5,
            "NIR": 0.15,
            "Clear": -0.25
        }

        self.user_guide = USER_GUIDE

    def _generate_lot_abattage(self) -> Dict[str, Any]:
        """
        Génère un lot d'abattage (basé sur production-simulator-timescaledb.js)

        Returns:
            Dict avec date_abattage, eleveur, provenance, nombre_canards, numero_lot
        """
        today = date.today()
        date_abattage = today.isoformat()
        eleveur = random.choice(ELEVEURS)
        provenance = random.choice(PROVENANCES)
        nombre_canards = random.randint(200, 300)
        prefix = random.choice(LOT_PREFIXES)
        numero_lot_suffix = random.randint(1000, 9999)
        date_str = date_abattage.replace('-', '')[2:]  # Format YYMMDD

        return {
            "date_abattage": date_abattage,
            "eleveur": eleveur,
            "provenance": provenance,
            "nombre_canards": nombre_canards,
            "numero_lot": f"{prefix}-{date_str}-{numero_lot_suffix}"
        }

    def _generate_id_abattage(self, lot_info: Dict[str, Any]) -> str:
        """
        Génère un ID d'abattage pour un canard du lot

        Args:
            lot_info: Informations du lot

        Returns:
            ID format: "MG-251007-7224-025"
        """
        id_canard = random.randint(1, lot_info["nombre_canards"])
        return f"{lot_info['numero_lot']}-{str(id_canard).zfill(3)}"

    def _raw_counts_to_intensities(self, raw_counts: Dict[str, int]) -> List[float]:
        """
        Convertit raw counts en intensités normalisées (basé sur JS)

        Args:
            raw_counts: Dict {channel: count}

        Returns:
            Liste intensités 0-1 pour WAVELENGTHS
        """
        scale_factor = self.gain * (self.integration_time / 100.0) * 10000

        channel_order = ["F1_violet", "F2_indigo", "F3_blue", "F4_cyan",
                        "F5_green", "F6_yellow", "F7_orange", "F8_red", "NIR"]

        intensities = []
        for channel in channel_order:
            if channel in raw_counts:
                intensity = raw_counts[channel] / scale_factor
                intensity = max(0.1, min(1.0, round(intensity, 2)))
                intensities.append(intensity)
            else:
                intensities.append(0.5)

        return intensities

    def simulate_measurement(self,
                           product_type: str = "normal",
                           freshness: float = 1.0,
                           fat_quality: float = 1.0,
                           oxidation_level: float = 0.0,
                           ambient_light: float = 100.0,
                           temperature: float = 20.0) -> Dict[str, Any]:
        """
        Génère une mesure spectrale brute

        Args:
            product_type: Type de produit ("normal", "irregular", "defective")
            freshness: Fraîcheur (0.0-1.0, 1.0 = très frais)
            fat_quality: Qualité du gras (0.0-1.0, 1.0 = excellent)
            oxidation_level: Niveau d'oxydation (0.0-1.0, 0.0 = pas d'oxydation)
            ambient_light: Lumière ambiante (counts additionnels sur Clear)
            temperature: Température du produit (°C)

        Returns:
            Dictionnaire contenant raw_counts et metadata
        """
        t0 = time.time()

        # Ajuster les paramètres selon le type de produit
        if product_type == "irregular":
            freshness *= random.uniform(0.8, 1.0)
            fat_quality *= random.uniform(0.7, 0.9)
            oxidation_level += random.uniform(0.0, 0.2)
        elif product_type == "defective":
            freshness *= random.uniform(0.4, 0.7)
            fat_quality *= random.uniform(0.3, 0.6)
            oxidation_level += random.uniform(0.3, 0.6)

        # Générer le spectre brut
        raw_counts = self._generate_spectrum(
            freshness, fat_quality, oxidation_level,
            ambient_light, temperature
        )

        # Générer métadonnées enrichies (basées sur JS)
        lot_abattage = self._generate_lot_abattage()
        id_abattage = self._generate_id_abattage(lot_abattage)
        temps_depuis_abattage = random.randint(10, 120)  # minutes

        # Convertir raw_counts en intensités normalisées
        intensities = self._raw_counts_to_intensities(raw_counts)

        # Timestamp ISO8601
        timestamp_iso = datetime.utcnow().isoformat() + 'Z'

        # Métadonnées basiques (compatibilité existante)
        meta = {
            "timestamp": t0,
            "integration_time_ms": self.integration_time,
            "gain": self.gain,
            "temperature_c": temperature,
            "ambient_light": ambient_light,
            "product_type": product_type,
            "input_params": {
                "freshness": freshness,
                "fat_quality": fat_quality,
                "oxidation_level": oxidation_level
            },
            "user_guide": self.user_guide
        }

        # Métadonnées enrichies (format JS/TimescaleDB)
        metadata_enriched = {
            "sampleName": id_abattage,
            "origin": lot_abattage["provenance"],
            "eleveur": lot_abattage["eleveur"],
            "provenance": lot_abattage["provenance"],
            "date_abattage": lot_abattage["date_abattage"],
            "temps_depuis_abattage": temps_depuis_abattage,
            "lot_abattage": lot_abattage["numero_lot"],
            "nombre_canards_lot": lot_abattage["nombre_canards"],
            "id_abattage": id_abattage,
            "texture": random.choice(TEXTURES),
            "couleur": random.choice(COLORS),
            "ligne_production": random.choice(PRODUCTION_LINES),
            "etat": "Nature (frais)",
            "product_type": product_type
        }

        return {
            # Format Python existant (compatibilité)
            "raw_counts": raw_counts,
            "meta": meta,

            # Format JS/TimescaleDB (enrichi)
            "wavelengths": WAVELENGTHS.copy(),
            "intensities": intensities,
            "timestamp": timestamp_iso,
            "temperature": temperature,
            "sample_type": "foie_gras",
            "metadata": metadata_enriched
        }

    def _generate_spectrum(self,
                          freshness: float,
                          fat_quality: float,
                          oxidation_level: float,
                          ambient_light: float,
                          temperature: float) -> Dict[str, int]:
        """
        Génère le spectre brut en tenant compte des facteurs qualité

        Returns:
            Dictionnaire {canal: count_value}
        """
        raw_counts = {}

        for channel, base_value in self.reference_spectrum.items():
            if channel == "Flicker":
                # Scintillement aléatoire (0-2 Hz typiquement)
                raw_counts[channel] = random.randint(0, 2)
                continue

            # Partir de la valeur de référence
            value = float(base_value)

            # Appliquer les effets de vieillissement (freshness)
            aging_factor = self.aging_factors.get(channel, 0.0)
            value *= (1.0 + (1.0 - freshness) * aging_factor)

            # Appliquer les effets d'oxydation
            oxid_factor = self.oxidation_factors.get(channel, 0.0)
            value *= (1.0 + oxidation_level * oxid_factor)

            # Appliquer la qualité du gras (impact sur jaune/orange)
            if channel in ["F6_yellow", "F7_orange"]:
                value *= (0.7 + 0.3 * fat_quality)

            # Effet de température (légère variation)
            value *= (1.0 + (temperature - 25.0) * 0.001)

            # Lumière ambiante (ajout sur Clear)
            if channel == "Clear":
                value += ambient_light

            # Appliquer gain et temps d'intégration
            value *= self.gain * (self.integration_time / 100.0)

            # Ajouter du bruit gaussien
            value += random.gauss(0, self.noise_std)

            # Saturation à 16 bits (0-65535)
            raw_counts[channel] = int(np.clip(value, 0, 65535))

        return raw_counts


# ============================================================================
# DEMO / TEST
# ============================================================================

if __name__ == "__main__":
    print("=" * 70)
    print("AS7341 RAW SIMULATOR - Demo")
    print("=" * 70)

    # Créer le simulateur
    sim = AS7341_RawSimulator(
        integration_time_ms=100,
        gain=4,
        random_seed=42
    )

    # Test 1: Produit normal frais
    print("\n1. Foie gras normal frais")
    print("-" * 70)
    data = sim.simulate_measurement(
        product_type="normal",
        freshness=0.95,
        fat_quality=0.9,
        oxidation_level=0.05
    )

    print("Raw counts:")
    for channel, value in data["raw_counts"].items():
        wavelength = sim.channels[channel]
        if wavelength:
            print(f"  {channel:12s} ({wavelength}nm): {value:5d}")
        else:
            print(f"  {channel:12s}: {value:5d}")

    # Test 2: Produit oxydé
    print("\n2. Foie gras oxydé")
    print("-" * 70)
    data2 = sim.simulate_measurement(
        product_type="defective",
        freshness=0.6,
        fat_quality=0.5,
        oxidation_level=0.7
    )

    print("Raw counts:")
    for channel, value in data2["raw_counts"].items():
        wavelength = sim.channels[channel]
        delta = value - data["raw_counts"][channel]
        delta_str = f"({delta:+5d})" if channel != "Flicker" else ""
        if wavelength:
            print(f"  {channel:12s} ({wavelength}nm): {value:5d} {delta_str}")
        else:
            print(f"  {channel:12s}: {value:5d} {delta_str}")

    print("\n" + "=" * 70)
    print("Les données brutes sont prêtes pour l'analyse (as7341_data_analyzer)")
    print("=" * 70)
