#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AS7341 DATA ANALYZER
Analyse les données spectrales brutes du capteur AS7341
Calcule ratios, indices qualité, et grade final
"""

from dataclasses import dataclass, asdict
from typing import Dict, List, Any
import numpy as np


# ============================================================================
# DATA STRUCTURES
# ============================================================================

@dataclass
class SpectralQualityMetrics:
    """Métriques de qualité basées sur l'analyse spectrale"""
    freshness_index: float          # 0.0-1.0 (1.0 = très frais)
    fat_quality_index: float         # 0.0-1.0 (1.0 = excellent gras)
    color_uniformity: float          # 0.0-1.0 (1.0 = uniforme)
    oxidation_index: float           # 0.0-1.0 (0.0 = pas d'oxydation)
    overall_grade: str               # A+, A, B, C, REJECT
    quality_score: float             # 0.0-1.0 score global
    defects_detected: List[str]      # Liste des anomalies spectrales


# ============================================================================
# AS7341 DATA ANALYZER CLASS
# ============================================================================

class AS7341_DataAnalyzer:
    """
    Analyseur de données spectrales AS7341
    Transforme raw_counts en métriques qualité
    """

    def __init__(self):
        """Initialise l'analyseur avec les seuils de qualité basés sur ratios.md et JS"""

        # Seuils pour les ratios spectraux (basés sur ratios.md)
        self.thresholds = {
            # Ratio Violet/Orange (415nm/630nm) - Oxydation lipides
            # Plage optimale: 0.25 à 0.45
            "violet_orange_optimal_min": 0.25,   # Minimum optimal
            "violet_orange_optimal_max": 0.45,   # Maximum optimal
            "violet_orange_acceptable_min": 0.20, # Limite basse acceptable
            "violet_orange_acceptable_max": 0.55, # Limite haute acceptable

            # Ratio NIR/Violet (910nm/415nm) - Structure et homogénéité
            # Plage optimale: 1.2 à 1.8
            "nir_violet_optimal_min": 1.2,       # Minimum optimal
            "nir_violet_optimal_max": 1.8,       # Maximum optimal
            "nir_violet_acceptable_min": 1.0,    # Limite basse acceptable
            "nir_violet_acceptable_max": 2.0,    # Limite haute acceptable

            # Indice de décoloration [(555nm+590nm)/(415nm+445nm)] - Jaunissement
            # Plage optimale: 1.3 à 1.7
            "discoloration_optimal_min": 1.3,    # Minimum optimal
            "discoloration_optimal_max": 1.7,    # Maximum optimal
            "discoloration_acceptable_min": 1.1, # Limite basse acceptable
            "discoloration_acceptable_max": 2.0, # Limite haute acceptable

            # Indice d'oxydation lipidique [(630nm+680nm)/515nm] - Oxydation acides gras
            # Plage optimale: 0.8 à 1.2
            "lipid_oxidation_optimal_min": 0.8,  # Minimum optimal
            "lipid_oxidation_optimal_max": 1.2,  # Maximum optimal
            "lipid_oxidation_acceptable_min": 0.7, # Limite basse acceptable
            "lipid_oxidation_acceptable_max": 1.4, # Limite haute acceptable

            # Indice de fraîcheur viandes/poissons [(415nm+445nm)/(630nm+680nm)]
            # Plage optimale: 0.35 à 0.65
            "freshness_meat_optimal_min": 0.35,  # Minimum optimal
            "freshness_meat_optimal_max": 0.65,  # Maximum optimal
            "freshness_meat_acceptable_min": 0.25, # Limite basse acceptable
            "freshness_meat_acceptable_max": 0.75, # Limite haute acceptable

            # Indice d'oxydation huiles/graisses [(415nm+480nm)/(555nm+590nm)]
            # Plage optimale: 0.5 à 0.8
            "oil_oxidation_optimal_min": 0.5,    # Minimum optimal
            "oil_oxidation_optimal_max": 0.8,    # Maximum optimal
            "oil_oxidation_acceptable_min": 0.4, # Limite basse acceptable
            "oil_oxidation_acceptable_max": 0.9, # Limite haute acceptable
        }

        # Ratios idéaux JS (basés sur production-simulator-timescaledb.js lignes 168-171)
        self.js_ideal_ratios = {
            "red_green": 1.5,      # 630/555 - Maturité (idéal 1.2-1.8)
            "red_blue": 1.6,       # 630/445 - Graisse (idéal 1.3-1.8)
            "yellow_blue": 1.3,    # 590/445 - Coloration (idéal 1.1-1.5)
            "ir_red": 0.5          # 910/630 - Eau (idéal 0.4-0.6)
        }

    def _calculate_js_quality_score(self, counts: Dict[str, int]) -> Dict[str, Any]:
        """
        Calcule le score de qualité selon la méthode JS
        (basé sur production-simulator-timescaledb.js lignes 138-203)

        Args:
            counts: Raw counts AS7341

        Returns:
            Dict avec score (60-100), classification, ratios JS
        """
        # Extraire valeurs (avec fallback pour éviter division par zéro)
        F2 = max(counts.get("F2_indigo", 500), 1)
        F5 = max(counts.get("F5_green", 500), 1)
        F6 = max(counts.get("F6_yellow", 500), 1)
        F7 = max(counts.get("F7_orange", 500), 1)
        NIR = max(counts.get("NIR", 300), 1)

        # Calculer ratios JS
        ratio_red_green = F7 / F5
        ratio_red_blue = F7 / F2
        ratio_yellow_blue = F6 / F2
        ratio_ir_red = NIR / F7

        # Calculer écarts aux valeurs idéales (JS ligne 174-177)
        dev_red_green = abs((ratio_red_green - self.js_ideal_ratios["red_green"]) /
                           self.js_ideal_ratios["red_green"])
        dev_red_blue = abs((ratio_red_blue - self.js_ideal_ratios["red_blue"]) /
                          self.js_ideal_ratios["red_blue"])
        dev_yellow_blue = abs((ratio_yellow_blue - self.js_ideal_ratios["yellow_blue"]) /
                             self.js_ideal_ratios["yellow_blue"])
        dev_ir_red = abs((ratio_ir_red - self.js_ideal_ratios["ir_red"]) /
                        self.js_ideal_ratios["ir_red"])

        # Score global (JS ligne 181-185)
        avg_deviation = (dev_red_green + dev_red_blue + dev_yellow_blue + dev_ir_red) / 4
        score = round(100 - (avg_deviation * 100))
        score = max(60, min(100, score))  # Limiter 60-100

        # Classification (JS ligne 187-197)
        if score >= 90:
            classification = "Excellent"
        elif score >= 80:
            classification = "Très bon"
        elif score >= 70:
            classification = "Bon"
        else:
            classification = "Acceptable"

        return {
            "score": score,
            "classification": classification,
            "ratios": {
                "red_green": round(ratio_red_green, 2),
                "red_blue": round(ratio_red_blue, 2),
                "yellow_blue": round(ratio_yellow_blue, 2),
                "ir_red": round(ratio_ir_red, 2)
            },
            "deviations": {
                "red_green": round(dev_red_green, 2),
                "red_blue": round(dev_red_blue, 2),
                "yellow_blue": round(dev_yellow_blue, 2),
                "ir_red": round(dev_ir_red, 2),
                "average": round(avg_deviation, 2)
            }
        }

    def process(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyse les données brutes AS7341

        Args:
            raw_data: Dict contenant 'raw_counts' et 'meta' (output de AS7341_RawSimulator)

        Returns:
            Dictionnaire contenant:
                - spectral_ratios: Ratios calculés
                - quality_metrics: Métriques de qualité
                - grade: Grade final
                - quality_score: Score 0-1
                - defects: Liste anomalies
        """
        raw_counts = raw_data["raw_counts"]
        meta = raw_data.get("meta", {})

        # 1. Calculer les ratios spectraux
        ratios = self._calculate_spectral_ratios(raw_counts)

        # 2. Calculer les indices de qualité
        quality_metrics = self._calculate_quality_metrics(raw_counts, ratios)

        # 3. Détecter les anomalies spectrales
        defects = self._detect_spectral_anomalies(raw_counts, ratios)

        # 4. Calculer le score global et le grade
        quality_score = self._calculate_quality_score(quality_metrics, defects)
        grade = self._assign_grade(quality_score, defects)

        # 5. Calculer le score JS (méthode production-simulator-timescaledb.js)
        js_quality = self._calculate_js_quality_score(raw_counts)

        return {
            "spectral_ratios": ratios,
            "quality_metrics": asdict(quality_metrics),  # ✅ Convertir dataclass en dict
            "grade": grade,
            "quality_score": quality_score,
            "defects": defects,
            "meta": meta,
            # Ajout méthode JS
            "quality_js": js_quality
        }

    def _calculate_spectral_ratios(self, counts: Dict[str, int]) -> Dict[str, float]:
        """
        Calcule les ratios spectraux indicateurs de qualité (basés sur ratios.md)

        Returns:
            Dict avec les ratios clés
        """
        # Extraire les canaux (avec protection division par zéro)
        F1_violet = max(counts.get("F1_violet", 1), 1)    # 415nm
        F2_indigo = max(counts.get("F2_indigo", 1), 1)    # 445nm
        F3_blue = max(counts.get("F3_blue", 1), 1)        # 480nm
        F4_cyan = max(counts.get("F4_cyan", 1), 1)        # 515nm
        F5_green = max(counts.get("F5_green", 1), 1)      # 555nm
        F6_yellow = max(counts.get("F6_yellow", 1), 1)    # 590nm
        F7_orange = max(counts.get("F7_orange", 1), 1)    # 630nm
        F8_red = max(counts.get("F8_red", 1), 1)          # 680nm
        NIR = max(counts.get("NIR", 1), 1)                # 910nm
        Clear = max(counts.get("Clear", 1), 1)

        return {
            # ============ RATIOS PRINCIPAUX (ratios.md) ============

            # 1. Ratio Violet/Orange (415nm/630nm) - Oxydation lipides
            # Plage optimale: 0.25 à 0.45
            "violet_orange_ratio": F1_violet / F7_orange,

            # 2. Ratio NIR/Violet (910nm/415nm) - Structure et homogénéité
            # Plage optimale: 1.2 à 1.8
            "nir_violet_ratio": NIR / F1_violet,

            # 3. Indice de décoloration [(555nm+590nm)/(415nm+445nm)] - Jaunissement
            # Plage optimale: 1.3 à 1.7
            "discoloration_index": (F5_green + F6_yellow) / (F1_violet + F2_indigo),

            # 4. Indice d'oxydation lipidique [(630nm+680nm)/515nm] - TBARS
            # Plage optimale: 0.8 à 1.2
            "lipid_oxidation_index": (F7_orange + F8_red) / F4_cyan,

            # 5. Indice de fraîcheur viandes/poissons [(415nm+445nm)/(630nm+680nm)]
            # Plage optimale: 0.35 à 0.65
            "freshness_meat_index": (F1_violet + F2_indigo) / (F7_orange + F8_red),

            # 6. Indice d'oxydation huiles/graisses [(415nm+480nm)/(555nm+590nm)]
            # Plage optimale: 0.5 à 0.8
            "oil_oxidation_index": (F1_violet + F3_blue) / (F5_green + F6_yellow),

            # ============ RATIOS COMPLÉMENTAIRES ============

            # Ratio rouge/violet (oxydation hémoglobine)
            "red_violet_ratio": F8_red / F1_violet,

            # Ratio vert/rouge (couleur)
            "green_red_ratio": F5_green / F8_red,

            # Ratio jaune/bleu (jaunissement simple)
            "yellow_blue_ratio": F6_yellow / F3_blue,

            # Intensité globale normalisée
            "normalized_clear": Clear / 65535.0
        }

    def _calculate_quality_metrics(self,
                                   counts: Dict[str, int],
                                   ratios: Dict[str, float]) -> SpectralQualityMetrics:
        """
        Calcule les métriques de qualité à partir des ratios (basé sur ratios.md)

        Returns:
            SpectralQualityMetrics dataclass
        """
        # 1. Freshness index (basé sur violet/orange et freshness_meat_index)
        vor = ratios["violet_orange_ratio"]
        fmi = ratios["freshness_meat_index"]

        # Freshness basé sur violet/orange (0.25-0.45 optimal)
        if self.thresholds["violet_orange_optimal_min"] <= vor <= self.thresholds["violet_orange_optimal_max"]:
            freshness_vo = 1.0
        elif self.thresholds["violet_orange_acceptable_min"] <= vor <= self.thresholds["violet_orange_acceptable_max"]:
            # Distance à la plage optimale
            if vor < self.thresholds["violet_orange_optimal_min"]:
                dist = self.thresholds["violet_orange_optimal_min"] - vor
                max_dist = self.thresholds["violet_orange_optimal_min"] - self.thresholds["violet_orange_acceptable_min"]
            else:
                dist = vor - self.thresholds["violet_orange_optimal_max"]
                max_dist = self.thresholds["violet_orange_acceptable_max"] - self.thresholds["violet_orange_optimal_max"]
            freshness_vo = 0.7 + 0.3 * (1 - dist / max_dist)
        else:
            freshness_vo = 0.3

        # Freshness basé sur meat index (0.35-0.65 optimal)
        if self.thresholds["freshness_meat_optimal_min"] <= fmi <= self.thresholds["freshness_meat_optimal_max"]:
            freshness_meat = 1.0
        elif self.thresholds["freshness_meat_acceptable_min"] <= fmi <= self.thresholds["freshness_meat_acceptable_max"]:
            if fmi < self.thresholds["freshness_meat_optimal_min"]:
                dist = self.thresholds["freshness_meat_optimal_min"] - fmi
                max_dist = self.thresholds["freshness_meat_optimal_min"] - self.thresholds["freshness_meat_acceptable_min"]
            else:
                dist = fmi - self.thresholds["freshness_meat_optimal_max"]
                max_dist = self.thresholds["freshness_meat_acceptable_max"] - self.thresholds["freshness_meat_optimal_max"]
            freshness_meat = 0.7 + 0.3 * (1 - dist / max_dist)
        else:
            freshness_meat = 0.3

        # Moyenne pondérée
        freshness = 0.6 * freshness_vo + 0.4 * freshness_meat

        # 2. Fat quality index (basé sur lipid_oxidation_index et oil_oxidation_index)
        loi = ratios["lipid_oxidation_index"]
        ooi = ratios["oil_oxidation_index"]

        # Lipid oxidation (0.8-1.2 optimal)
        if self.thresholds["lipid_oxidation_optimal_min"] <= loi <= self.thresholds["lipid_oxidation_optimal_max"]:
            fat_lipid = 1.0
        elif self.thresholds["lipid_oxidation_acceptable_min"] <= loi <= self.thresholds["lipid_oxidation_acceptable_max"]:
            if loi < self.thresholds["lipid_oxidation_optimal_min"]:
                dist = self.thresholds["lipid_oxidation_optimal_min"] - loi
                max_dist = self.thresholds["lipid_oxidation_optimal_min"] - self.thresholds["lipid_oxidation_acceptable_min"]
            else:
                dist = loi - self.thresholds["lipid_oxidation_optimal_max"]
                max_dist = self.thresholds["lipid_oxidation_acceptable_max"] - self.thresholds["lipid_oxidation_optimal_max"]
            fat_lipid = 0.7 + 0.3 * (1 - dist / max_dist)
        else:
            fat_lipid = 0.3

        # Oil oxidation (0.5-0.8 optimal)
        if self.thresholds["oil_oxidation_optimal_min"] <= ooi <= self.thresholds["oil_oxidation_optimal_max"]:
            fat_oil = 1.0
        elif self.thresholds["oil_oxidation_acceptable_min"] <= ooi <= self.thresholds["oil_oxidation_acceptable_max"]:
            if ooi < self.thresholds["oil_oxidation_optimal_min"]:
                dist = self.thresholds["oil_oxidation_optimal_min"] - ooi
                max_dist = self.thresholds["oil_oxidation_optimal_min"] - self.thresholds["oil_oxidation_acceptable_min"]
            else:
                dist = ooi - self.thresholds["oil_oxidation_optimal_max"]
                max_dist = self.thresholds["oil_oxidation_acceptable_max"] - self.thresholds["oil_oxidation_optimal_max"]
            fat_oil = 0.7 + 0.3 * (1 - dist / max_dist)
        else:
            fat_oil = 0.3

        # Moyenne pondérée
        fat_quality = 0.6 * fat_lipid + 0.4 * fat_oil

        # 3. Color uniformity (basé sur discoloration_index)
        discol = ratios["discoloration_index"]

        # Discoloration (1.3-1.7 optimal)
        if self.thresholds["discoloration_optimal_min"] <= discol <= self.thresholds["discoloration_optimal_max"]:
            color_uniformity = 1.0
        elif self.thresholds["discoloration_acceptable_min"] <= discol <= self.thresholds["discoloration_acceptable_max"]:
            if discol < self.thresholds["discoloration_optimal_min"]:
                dist = self.thresholds["discoloration_optimal_min"] - discol
                max_dist = self.thresholds["discoloration_optimal_min"] - self.thresholds["discoloration_acceptable_min"]
            else:
                dist = discol - self.thresholds["discoloration_optimal_max"]
                max_dist = self.thresholds["discoloration_acceptable_max"] - self.thresholds["discoloration_optimal_max"]
            color_uniformity = 0.7 + 0.3 * (1 - dist / max_dist)
        else:
            color_uniformity = 0.3

        # 4. Oxidation index (combinaison des indices d'oxydation)
        # Inversé par rapport à fat_quality (plus d'oxydation = index plus élevé)
        oxidation = 1.0 - fat_quality

        # Score global (moyenne pondérée)
        quality_score = (
            freshness * 0.35 +
            fat_quality * 0.30 +
            color_uniformity * 0.20 +
            (1.0 - oxidation) * 0.15
        )

        # Grade préliminaire
        if quality_score >= 0.85:
            grade = "A+"
        elif quality_score >= 0.75:
            grade = "A"
        elif quality_score >= 0.65:
            grade = "B"
        elif quality_score >= 0.50:
            grade = "C"
        else:
            grade = "REJECT"

        return SpectralQualityMetrics(
            freshness_index=freshness,
            fat_quality_index=fat_quality,
            color_uniformity=color_uniformity,
            oxidation_index=oxidation,
            overall_grade=grade,
            quality_score=quality_score,
            defects_detected=[]  # Rempli par _detect_spectral_anomalies
        )

    def _detect_spectral_anomalies(self,
                                   counts: Dict[str, int],
                                   ratios: Dict[str, float]) -> List[str]:
        """
        Détecte les anomalies spectrales (basé sur ratios.md)

        Returns:
            Liste des défauts détectés
        """
        defects = []

        # 1. Oxydation lipides (ratio violet/orange hors plage 0.20-0.55)
        vor = ratios["violet_orange_ratio"]
        if vor < self.thresholds["violet_orange_acceptable_min"]:
            defects.append("Ratio Violet/Orange anormalement bas (< 0.20)")
        elif vor > self.thresholds["violet_orange_acceptable_max"]:
            defects.append("Oxydation lipidique excessive (Violet/Orange > 0.55)")

        # 2. Structure et homogénéité (NIR/Violet hors plage 1.0-2.0)
        nvr = ratios["nir_violet_ratio"]
        if nvr < self.thresholds["nir_violet_acceptable_min"]:
            defects.append("Structure inhomogène (NIR/Violet < 1.0)")
        elif nvr > self.thresholds["nir_violet_acceptable_max"]:
            defects.append("Anomalie structurelle (NIR/Violet > 2.0)")

        # 3. Jaunissement excessif (discoloration hors plage 1.1-2.0)
        discol = ratios["discoloration_index"]
        if discol < self.thresholds["discoloration_acceptable_min"]:
            defects.append("Indice décoloration anormal (< 1.1)")
        elif discol > self.thresholds["discoloration_acceptable_max"]:
            defects.append("Jaunissement excessif (décoloration > 2.0)")

        # 4. Oxydation acides gras (lipid oxidation hors plage 0.7-1.4)
        loi = ratios["lipid_oxidation_index"]
        if loi < self.thresholds["lipid_oxidation_acceptable_min"]:
            defects.append("Indice oxydation lipidique bas (< 0.7)")
        elif loi > self.thresholds["lipid_oxidation_acceptable_max"]:
            defects.append("Oxydation acides gras élevée (TBARS > 1.4)")

        # 5. Fraîcheur viande (freshness meat hors plage 0.25-0.75)
        fmi = ratios["freshness_meat_index"]
        if fmi < self.thresholds["freshness_meat_acceptable_min"]:
            defects.append("Dégradation pigments hémiques (freshness < 0.25)")
        elif fmi > self.thresholds["freshness_meat_acceptable_max"]:
            defects.append("Indice fraîcheur anormal (> 0.75)")

        # 6. Oxydation huiles/graisses (oil oxidation hors plage 0.4-0.9)
        ooi = ratios["oil_oxidation_index"]
        if ooi < self.thresholds["oil_oxidation_acceptable_min"]:
            defects.append("Indice oxydation huile bas (< 0.4)")
        elif ooi > self.thresholds["oil_oxidation_acceptable_max"]:
            defects.append("Oxydation graisses excessive (> 0.9)")

        # 7. Saturation d'un canal (mesure non fiable)
        for channel, value in counts.items():
            if channel != "Flicker" and value >= 65500:
                defects.append(f"Saturation canal {channel}")

        # 8. Signal trop faible (unreliable measurement)
        for channel, value in counts.items():
            if channel != "Flicker" and value < 10:
                defects.append(f"Signal trop faible {channel}")

        return defects

    def _calculate_quality_score(self,
                                 metrics: SpectralQualityMetrics,
                                 defects: List[str]) -> float:
        """
        Calcule le score global en tenant compte des défauts

        Returns:
            Score 0.0-1.0
        """
        base_score = metrics.quality_score

        # Pénalité pour chaque défaut
        penalty_per_defect = 0.10
        total_penalty = min(len(defects) * penalty_per_defect, 0.5)  # Max 50% pénalité

        final_score = max(0.0, base_score - total_penalty)
        return final_score

    def _assign_grade(self, quality_score: float, defects: List[str]) -> str:
        """
        Assigne un grade final basé sur le score et les défauts

        Returns:
            Grade string
        """
        # Rejet automatique si défauts critiques
        critical_defects = [
            "Oxidation excessive",
            "Saturation",
            "Décoloration sévère"
        ]

        has_critical = any(cd in " ".join(defects) for cd in critical_defects)

        if has_critical and quality_score < 0.60:
            return "REJECT"

        # Attribution standard par score
        if quality_score >= 0.85:
            return "A+"
        elif quality_score >= 0.75:
            return "A"
        elif quality_score >= 0.60:
            return "B"
        elif quality_score >= 0.45:
            return "C"
        else:
            return "REJECT"


# ============================================================================
# DEMO / TEST
# ============================================================================

if __name__ == "__main__":
    # Import du simulateur pour le test
    from as7341_raw_simulator import AS7341_RawSimulator

    print("=" * 70)
    print("AS7341 DATA ANALYZER - Demo")
    print("=" * 70)

    sim = AS7341_RawSimulator(random_seed=42)
    analyzer = AS7341_DataAnalyzer()

    # Test 1: Produit frais
    print("\n1. Foie gras frais de qualité")
    print("-" * 70)
    raw_data = sim.simulate_measurement(
        product_type="normal",
        freshness=0.95,
        fat_quality=0.9,
        oxidation_level=0.05
    )
    analysis = analyzer.process(raw_data)

    print(f"Grade: {analysis['grade']}")
    print(f"Score qualité: {analysis['quality_score']:.3f}")
    print(f"Freshness index: {analysis['quality_metrics'].freshness_index:.2f}")
    print(f"Fat quality index: {analysis['quality_metrics'].fat_quality_index:.2f}")
    print(f"Oxidation index: {analysis['quality_metrics'].oxidation_index:.2f}")
    print(f"Défauts: {len(analysis['defects'])}")

    # Test 2: Produit oxydé
    print("\n2. Foie gras oxydé")
    print("-" * 70)
    raw_data2 = sim.simulate_measurement(
        product_type="defective",
        freshness=0.5,
        fat_quality=0.4,
        oxidation_level=0.8
    )
    analysis2 = analyzer.process(raw_data2)

    print(f"Grade: {analysis2['grade']}")
    print(f"Score qualité: {analysis2['quality_score']:.3f}")
    print(f"Freshness index: {analysis2['quality_metrics'].freshness_index:.2f}")
    print(f"Fat quality index: {analysis2['quality_metrics'].fat_quality_index:.2f}")
    print(f"Oxidation index: {analysis2['quality_metrics'].oxidation_index:.2f}")
    print(f"Défauts détectés ({len(analysis2['defects'])}):")
    for defect in analysis2['defects']:
        print(f"  - {defect}")

    print("\n" + "=" * 70)
