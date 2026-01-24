#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
FOIE GRAS FUSION SIMULATOR
Combine les données VL53L8CH (ToF) et AS7341 (Spectral) pour une inspection complète
"""

import logging
from typing import Dict, Any, Optional
from vl53l8ch_raw_simulator import VL53L8CH_RawSimulator
from vl53l8ch_data_analyzer import VL53L8CH_DataAnalyzer
from as7341_raw_simulator import AS7341_RawSimulator
from as7341_data_analyzer import AS7341_DataAnalyzer

# Analyseurs métier foie gras (optionnels, non utilisés dans la fusion basique)
from sensors.foie_gras_analyzers import (
    ToFDimensionalAnalyzer,
    SpectralColorAnalyzer,
    DefectDetector
)

# Configure logger
logger = logging.getLogger(__name__)


class FoieGrasFusionSimulator:
    """
    Simulateur de fusion multi-capteurs pour l'inspection de foie gras
    Combine ToF (structure 3D) et spectral (couleur/qualité)
    """

    def __init__(self,
                 vl53l8ch_params: Dict[str, Any],
                 as7341_params: Optional[Dict[str, Any]] = None):
        """
        Initialise le simulateur de fusion

        Args:
            vl53l8ch_params: Paramètres pour VL53L8CH_RawSimulator
            as7341_params: Paramètres pour AS7341_RawSimulator (optionnel)
        """
        # Créer le simulateur VL53L8CH (ToF - toujours actif)
        self.vl53l8ch_sim = VL53L8CH_RawSimulator(**vl53l8ch_params)
        self.vl53l8ch_analyzer = VL53L8CH_DataAnalyzer()

        # Créer le simulateur AS7341 (Spectral - optionnel)
        self.as7341_enabled = False
        if as7341_params and as7341_params.get('enabled', False):
            # Extraire seulement les paramètres nécessaires (sans 'enabled')
            sim_params = {k: v for k, v in as7341_params.items() if k != 'enabled'}
            self.as7341_sim = AS7341_RawSimulator(**sim_params)
            self.as7341_analyzer = AS7341_DataAnalyzer()
            self.as7341_enabled = True
        
        # Analyseurs métier foie gras (enrichissement)
        self.tof_dimensional_analyzer = ToFDimensionalAnalyzer()
        self.spectral_color_analyzer = SpectralColorAnalyzer()
        self.defect_detector = DefectDetector()
        
        # Historique pour calcul Cp/Cpk (max 100 échantillons)
        self.thickness_history = []
        self.max_history_size = 100

    def simulate_complete_inspection(self,
                                    product_type: str = "normal",
                                    defects: Optional[Dict] = None,
                                    include_bins: bool = True,
                                    # Paramètres AS7341 spécifiques
                                    freshness: float = 0.95,
                                    fat_quality: float = 0.9,
                                    oxidation_level: float = 0.05,
                                    ambient_light: float = 100.0,
                                    temperature: float = 20.0,
                                    quality_profile: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Effectue une inspection complète avec fusion des données

        Args:
            product_type: Type de produit ("normal", "irregular", "defective")
            defects: Défauts spécifiques à simuler
            include_bins: Inclure les histogrammes ToF
            freshness: Fraîcheur du produit (0.0-1.0, pour AS7341)
            fat_quality: Qualité du gras (0.0-1.0, pour AS7341)
            oxidation_level: Niveau d'oxydation (0.0-1.0, pour AS7341)
            ambient_light: Lumière ambiante (pour AS7341)
            temperature: Température du produit (pour AS7341)
            quality_profile: Profil de qualité sélectionné (premium/good/acceptable/low/defective)

        Returns:
            Dictionnaire contenant:
                - vl53l8ch_raw: Données brutes ToF
                - vl53l8ch_analysis: Analyse 3D
                - as7341_raw: Données brutes spectrales (si activé)
                - as7341_analysis: Analyse spectrale (si activé)
                - fusion_result: Résultat de fusion
        """
        # 1. Simuler et analyser VL53L8CH (ToF)
        vl53l8ch_raw = self.vl53l8ch_sim.simulate_measurement(
            product_type=product_type,
            defects=defects,
            include_bins=include_bins
        )

        vl53l8ch_analysis = self.vl53l8ch_analyzer.process(vl53l8ch_raw)

        result = {
            "vl53l8ch_raw": vl53l8ch_raw,
            "vl53l8ch_analysis": vl53l8ch_analysis,
        }

        # 2. Simuler et analyser AS7341 (Spectral) si activé
        if self.as7341_enabled:
            as7341_raw = self.as7341_sim.simulate_measurement(
                product_type=product_type,
                freshness=freshness,
                fat_quality=fat_quality,
                oxidation_level=oxidation_level,
                ambient_light=ambient_light,
                temperature=temperature
            )

            as7341_analysis = self.as7341_analyzer.process(as7341_raw)

            result["as7341_raw"] = as7341_raw
            result["as7341_analysis"] = as7341_analysis
        else:
            result["as7341_raw"] = None
            result["as7341_analysis"] = None

        # 3. Fusionner les résultats
        result["fusion_result"] = self._fuse_results(
            vl53l8ch_analysis,
            result.get("as7341_analysis"),
            vl53l8ch_raw,  # Passer les données brutes pour analyse métier
            result.get("as7341_raw"),
            quality_profile
        )

        return result

    def _fuse_results(self,
                     tof_analysis: Dict[str, Any],
                     spectral_analysis: Optional[Dict[str, Any]],
                     tof_raw: Optional[Dict[str, Any]] = None,
                     spectral_raw: Optional[Dict[str, Any]] = None,
                     quality_profile: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Fusionne les analyses ToF et spectrale + enrichissement métier foie gras

        Args:
            tof_analysis: Résultat d'analyse VL53L8CH
            spectral_analysis: Résultat d'analyse AS7341 (peut être None)
            tof_raw: Données brutes ToF (pour analyse métier)
            spectral_raw: Données brutes spectrales (pour analyse métier)
            quality_profile: Profil de qualité sélectionné (premium/good/acceptable/low/defective)

        Returns:
            Dictionnaire avec grade, score fusionnés et métriques métier foie gras
        """
        # Score de base provenant du ToF
        tof_score = tof_analysis['quality_score']
        
        # Ajuster le score ToF en fonction du profil de qualité (si fourni)
        if quality_profile and 'data' in quality_profile:
            profile_data = quality_profile['data']
            if 'surface_uniformity' in profile_data:
                # Générer une valeur aléatoire dans la plage du profil
                import random
                uniformity_params = profile_data['surface_uniformity']
                target_uniformity = random.gauss(
                    uniformity_params['mean'],
                    (uniformity_params['max'] - uniformity_params['min']) / 6  # ~99.7% dans la plage
                )
                # Clamp dans la plage min-max
                target_uniformity = max(uniformity_params['min'], 
                                       min(uniformity_params['max'], target_uniformity))
                
                # Ajuster le score ToF pour correspondre au profil
                # Mélange 70% profil + 30% score original pour garder un peu de variabilité
                tof_score = 0.7 * target_uniformity + 0.3 * tof_score
                
                logger.debug(f"Adjusted ToF score using quality profile '{quality_profile['name']}': "
                           f"original={tof_analysis['quality_score']:.3f}, adjusted={tof_score:.3f}, "
                           f"target_uniformity={target_uniformity:.3f}")
        
        tof_grade = tof_analysis['grade']
        tof_defects = tof_analysis['defects']
        logger.debug(f"!!!fuse_results: tof_score={tof_score}, tof_grade={tof_grade}, tof_defects={tof_defects}")
        # Si pas de spectral, retourner seulement ToF
        if not spectral_analysis:
            return {
                "final_grade": tof_grade,
                "final_score": tof_score,
                "tof_contribution": 1.0,
                "spectral_contribution": 0.0,
                "combined_defects": tof_defects,
                "fusion_mode": "ToF only"
            }

        # Fusionner avec les données spectrales
        spectral_score = spectral_analysis['quality_score']
        spectral_grade = spectral_analysis['grade']
        spectral_defects = spectral_analysis['defects']

        # Pondération : ToF 60%, Spectral 40%
        # (ToF est plus critique pour structure/volume)
        tof_weight = 0.60
        spectral_weight = 0.40

        final_score = (tof_score * tof_weight +
                      spectral_score * spectral_weight)

        # Déterminer le grade final
        final_grade = self._assign_fused_grade(
            final_score,
            tof_grade,
            spectral_grade,
            tof_defects,
            spectral_defects
        )

        # Combiner les défauts
        combined_defects = tof_defects.copy()
        for defect in spectral_defects:
            combined_defects.append({
                "type": f"Spectral: {defect}",
                "source": "AS7341",
                "severity": 0.5  # Pénalité moyenne pour défauts spectraux
            })

        # ===================================================================
        # ENRICHISSEMENT MÉTIER FOIE GRAS
        # ===================================================================
        foie_gras_metrics = {}
        
        # 1. Analyse dimensionnelle (ToF) si données brutes disponibles
        if tof_raw and 'distance_matrix' in tof_raw:
            distances = tof_raw['distance_matrix']
            
            # Épaisseur et classification
            thickness_analysis = self.tof_dimensional_analyzer.analyze_lobe_thickness(distances)
            foie_gras_metrics['lobe_thickness_mm'] = thickness_analysis['thickness_mm']
            foie_gras_metrics['thickness_std_mm'] = thickness_analysis['thickness_std']
            foie_gras_metrics['thickness_category'] = thickness_analysis['category']
            foie_gras_metrics['is_irregular_lobe'] = thickness_analysis['is_irregular']
            
            # Volume estimé
            foie_gras_metrics['estimated_volume_cm3'] = self.tof_dimensional_analyzer.estimate_volume(distances)
            
            # Niveau de remplissage (si produit fini)
            fill_analysis = self.tof_dimensional_analyzer.analyze_fill_level(distances)
            foie_gras_metrics['fill_level_mm'] = fill_analysis['fill_level_mm']
            foie_gras_metrics['fill_level_percent'] = fill_analysis['fill_level_percent']
            foie_gras_metrics['fill_conformity'] = fill_analysis['fill_conformity']
            foie_gras_metrics['fill_deviation_mm'] = fill_analysis['fill_deviation_mm']
            
            # Score conformité dimensionnelle
            foie_gras_metrics['dimensional_conformity_score'] = \
                self.tof_dimensional_analyzer.calculate_dimensional_conformity_score(
                    thickness_analysis['category'],
                    thickness_analysis['is_irregular'],
                    fill_analysis['fill_conformity']
                )
            
            # Ajouter l'épaisseur à l'historique pour calcul Cp/Cpk
            current_thickness = thickness_analysis['thickness_mm']
            self.thickness_history.append(current_thickness)
            if len(self.thickness_history) > self.max_history_size:
                self.thickness_history.pop(0)  # Retirer le plus ancien
            
            # Calculer Cp/Cpk si assez de données (min 10 échantillons)
            if len(self.thickness_history) >= 10:
                capability = self.tof_dimensional_analyzer.calculate_process_capability(
                    self.thickness_history,
                    lsl=45.0,  # Lower Spec Limit pour foie gras
                    usl=55.0   # Upper Spec Limit pour foie gras
                )
                foie_gras_metrics['process_cp'] = capability['cp']
                foie_gras_metrics['process_cpk'] = capability['cpk']
                foie_gras_metrics['process_capability'] = capability['process_capability']
                foie_gras_metrics['process_mean'] = capability['mean']
                foie_gras_metrics['process_std'] = capability['std']
                foie_gras_metrics['is_centered'] = capability['is_centered']
            else:
                # Pas assez de données pour Cp/Cpk
                foie_gras_metrics['process_cp'] = None
                foie_gras_metrics['process_cpk'] = None
                foie_gras_metrics['process_capability'] = 'insufficient_data'
                foie_gras_metrics['process_mean'] = current_thickness
                foie_gras_metrics['process_std'] = 0.0
                foie_gras_metrics['is_centered'] = None
        
        # 2. Analyse couleur (AS7341) si données brutes disponibles
        # Support both 'raw_counts' and 'channels' formats
        logger.debug(f"Spectral raw keys: {spectral_raw.keys() if spectral_raw else 'None'}")
        logger.debug(f"Spectral raw type: {type(spectral_raw)}")
        if spectral_raw and ('raw_counts' in spectral_raw or 'channels' in spectral_raw):
            # Try 'channels' first (backend format), fallback to 'raw_counts'
            logger.debug(f"Found spectral data, checking format...")
            if 'channels' in spectral_raw:
                logger.debug(f"Using 'channels' format")
                channels = spectral_raw['channels']
                spectral_channels = {
                    '415nm': channels.get('F1_415nm', 0),
                    '445nm': channels.get('F2_445nm', 0),
                    '480nm': channels.get('F3_480nm', 0),
                    '515nm': channels.get('F4_515nm', 0),
                    '555nm': channels.get('F5_555nm', 0),
                    '590nm': channels.get('F6_590nm', 0),
                    '630nm': channels.get('F7_630nm', 0),
                    '680nm': channels.get('F8_680nm', 0),
                    'clear': channels.get('Clear', 0),
                    'nir': channels.get('NIR', 0),
                }
            else:
                # Fallback to raw_counts format
                # Support both numeric keys (415nm) and descriptive keys (F1_violet)
                raw_counts = spectral_raw['raw_counts']
                logger.debug(f"Using 'raw_counts' format with keys: {list(raw_counts.keys())}")
                spectral_channels = {
                    '415nm': raw_counts.get('415nm', raw_counts.get('F1_violet', 0)),
                    '445nm': raw_counts.get('445nm', raw_counts.get('F2_indigo', 0)),
                    '480nm': raw_counts.get('480nm', raw_counts.get('F3_blue', 0)),
                    '515nm': raw_counts.get('515nm', raw_counts.get('F4_cyan', 0)),
                    '555nm': raw_counts.get('555nm', raw_counts.get('F5_green', 0)),
                    '590nm': raw_counts.get('590nm', raw_counts.get('F6_yellow', 0)),
                    '630nm': raw_counts.get('630nm', raw_counts.get('F7_orange', 0)),
                    '680nm': raw_counts.get('680nm', raw_counts.get('F8_red', 0)),
                    'clear': raw_counts.get('clear', raw_counts.get('Clear', 0)),
                    'nir': raw_counts.get('nir', raw_counts.get('NIR', 0)),
                }
            logger.debug(f"Spectral channels: {spectral_channels}")
            # Calcul L*a*b*
            lab = self.spectral_color_analyzer.calculate_lab_from_spectral(spectral_channels)
            foie_gras_metrics['l_star'] = lab['L']
            foie_gras_metrics['a_star'] = lab['a']
            foie_gras_metrics['b_star'] = lab['b']
            
            # Delta E vs référence (cru_extra par défaut)
            lab_ref = self.spectral_color_analyzer.REFERENCE_LAB['cru_extra']
            delta_e = self.spectral_color_analyzer.calculate_delta_e(lab, lab_ref)
            foie_gras_metrics['delta_e'] = delta_e
            foie_gras_metrics['reference_id'] = 'cru_extra'
            
            # Score couleur premium
            foie_gras_metrics['color_score_premium'] = \
                self.spectral_color_analyzer.calculate_color_score_premium(lab, delta_e)
            
            # Détection défauts
            has_hematoma, hematoma_severity = self.defect_detector.detect_hematoma(spectral_channels)
            has_bile, bile_severity = self.defect_detector.detect_bile_traces(spectral_channels)
            has_oxidation, oxidation_severity = self.defect_detector.detect_oxidation(
                lab['b'], 
                lab_ref['b']
            )
            
            foie_gras_metrics['has_hematoma'] = has_hematoma
            foie_gras_metrics['hematoma_severity'] = hematoma_severity
            foie_gras_metrics['has_bile_traces'] = has_bile
            foie_gras_metrics['bile_severity'] = bile_severity
            foie_gras_metrics['has_oxidation'] = has_oxidation
            foie_gras_metrics['oxidation_severity'] = oxidation_severity
            
            # Taux de défauts
            defects_dict = {
                'hematoma': has_hematoma,
                'bile': has_bile,
                'oxidation': has_oxidation,
            }
            foie_gras_metrics['defect_rate_percent'] = \
                self.defect_detector.calculate_defect_rate(defects_dict)
        
        # 3. KPIs globaux
        foie_gras_metrics['dimensional_conformity_percent'] = \
            foie_gras_metrics.get('dimensional_conformity_score', 0)
        foie_gras_metrics['color_conformity_percent'] = \
            foie_gras_metrics.get('color_score_premium', 0)
        foie_gras_metrics['global_quality_score_100'] = final_score * 100
        
        # 4. Alertes
        foie_gras_metrics['has_critical_color_deviation'] = \
            foie_gras_metrics.get('delta_e', 0) > 8.0
        foie_gras_metrics['has_underfill'] = \
            abs(foie_gras_metrics.get('fill_deviation_mm', 0)) > 5.0
        foie_gras_metrics['has_oxidation_trend'] = \
            foie_gras_metrics.get('oxidation_severity', 0) > 0.4
        
        # 5. Décision finale
        foie_gras_metrics['is_compliant'] = final_grade not in ['REJECT', 'Grade C - Qualité acceptable']
        foie_gras_metrics['is_downgraded'] = 'B' in final_grade or 'C' in final_grade
        foie_gras_metrics['is_rejected'] = 'REJECT' in final_grade

        # Extraire le sample_id depuis les métadonnées AS7341 (si disponible)
        sample_id = None
        if spectral_raw and isinstance(spectral_raw, dict):
            metadata = spectral_raw.get('metadata', {})
            sample_id = metadata.get('sampleName') or metadata.get('id_abattage')
        
        # Fallback : générer un ID unique si pas de métadonnées
        if not sample_id:
            import uuid
            sample_id = f"FG-{uuid.uuid4().hex[:8].upper()}"
        
        # Compter les défauts
        num_defects = len(combined_defects)
        
        return {
            "sample_id": sample_id,
            "final_grade": final_grade,
            "final_score": final_score,
            "tof_score": tof_score,
            "spectral_score": spectral_score,
            "tof_contribution": tof_weight,
            "spectral_contribution": spectral_weight,
            "combined_defects": combined_defects,
            "num_defects": num_defects,
            "defects": combined_defects,
            "fusion_mode": "ToF + Spectral",
            # Scores et grades par capteur (pour compatibilité Dashboard)
            "vl53l8ch_grade": tof_grade,
            "vl53l8ch_score": tof_score,
            "as7341_grade": spectral_grade,
            "as7341_score": spectral_score,
            "metrics": {
                "tof_grade": tof_grade,
                "spectral_grade": spectral_grade,
                "freshness_index": spectral_analysis['quality_metrics'].get('freshness_index', 0.0),
                "fat_quality_index": spectral_analysis['quality_metrics'].get('fat_quality_index', 0.0),
                "volume_mm3": tof_analysis['stats']['volume_trapezoidal_mm3'],
            },
            # Métriques métier foie gras enrichies
            "foie_gras_metrics": foie_gras_metrics,
        }

    def _assign_fused_grade(self,
                           final_score: float,
                           tof_grade: str,
                           spectral_grade: str,
                           tof_defects: list,
                           spectral_defects: list) -> str:
        """
        Assigne un grade final en tenant compte de tous les critères

        Args:
            final_score: Score fusionné
            tof_grade: Grade ToF
            spectral_grade: Grade spectral
            tof_defects: Défauts ToF
            spectral_defects: Défauts spectraux

        Returns:
            Grade final (A+, A, B, C, REJECT)
        """
        # Rejet automatique si l'un des capteurs détecte REJECT
        if tof_grade == "REJECT" or spectral_grade == "REJECT":
            return "REJECT"

        # Rejet si défauts critiques combinés
        total_defects = len(tof_defects) + len(spectral_defects)
        if total_defects >= 5:  # Trop de défauts
            return "REJECT"

        # Attribution standard par score
        if final_score >= 0.85:
            return "A+"
        elif final_score >= 0.75:
            return "A"
        elif final_score >= 0.60:
            return "B"
        elif final_score >= 0.45:
            return "C"
        else:
            return "REJECT"


# ============================================================================
# DEMO / TEST
# ============================================================================

if __name__ == "__main__":
    print("=" * 70)
    print("FOIE GRAS FUSION SIMULATOR - Demo")
    print("=" * 70)

    # Configuration VL53L8CH
    vl53l8ch_params = {
        'resolution': 8,
        'height_sensor_mm': 100,
        'product_length_mm': 200,
        'product_width_mm': 100,
        'product_margin_percent': 15.0,
        'container_mode': True,
        'container_length_mm': 300,
        'container_width_mm': 180,
        'container_height_mm': 5.0,
        'random_seed': 42
    }

    # Configuration AS7341
    as7341_params = {
        'enabled': True,
        'integration_time_ms': 100,
        'gain': 4,
        'noise_std': 5.0,
        'random_seed': 42
    }

    # Créer le simulateur de fusion
    fusion_sim = FoieGrasFusionSimulator(vl53l8ch_params, as7341_params)

    # Test 1: Produit frais de qualité
    print("\n1. Foie gras frais de qualité")
    print("-" * 70)
    result = fusion_sim.simulate_complete_inspection(
        product_type="normal",
        freshness=0.95,
        fat_quality=0.9,
        oxidation_level=0.05
    )

    fusion = result['fusion_result']
    print(f"Grade final: {fusion['final_grade']}")
    print(f"Score final: {fusion['final_score']:.3f}")
    print(f"  - ToF score: {fusion['tof_score']:.3f} ({fusion['tof_contribution']*100:.0f}%)")
    print(f"  - Spectral score: {fusion['spectral_score']:.3f} ({fusion['spectral_contribution']*100:.0f}%)")
    print(f"Défauts combinés: {len(fusion['combined_defects'])}")
    print(f"Volume: {fusion['metrics']['volume_mm3']:.0f} mm³")
    print(f"Freshness: {fusion['metrics']['freshness_index']:.2f}")
    print(f"Fat quality: {fusion['metrics']['fat_quality_index']:.2f}")

    # Test 2: Produit défectueux
    print("\n2. Foie gras défectueux (oxydé)")
    print("-" * 70)
    result2 = fusion_sim.simulate_complete_inspection(
        product_type="defective",
        freshness=0.5,
        fat_quality=0.4,
        oxidation_level=0.8
    )

    fusion2 = result2['fusion_result']
    print(f"Grade final: {fusion2['final_grade']}")
    print(f"Score final: {fusion2['final_score']:.3f}")
    print(f"  - ToF score: {fusion2['tof_score']:.3f}")
    print(f"  - Spectral score: {fusion2['spectral_score']:.3f}")
    print(f"Défauts combinés: {len(fusion2['combined_defects'])}")
    if fusion2['combined_defects']:
        print("\nDétail des défauts:")
        for i, defect in enumerate(fusion2['combined_defects'][:5], 1):  # Limiter à 5
            defect_type = defect.get('type', 'unknown')
            print(f"  {i}. {defect_type}")

    # Test 3: Sans capteur spectral
    print("\n3. Mode ToF uniquement (sans AS7341)")
    print("-" * 70)
    fusion_sim_tof_only = FoieGrasFusionSimulator(
        vl53l8ch_params,
        {'enabled': False}
    )

    result3 = fusion_sim_tof_only.simulate_complete_inspection(
        product_type="normal"
    )

    fusion3 = result3['fusion_result']
    print(f"Grade final: {fusion3['final_grade']}")
    print(f"Score final: {fusion3['final_score']:.3f}")
    print(f"Mode fusion: {fusion3['fusion_mode']}")

    print("\n" + "=" * 70)
    print("Demo terminée!")
    print("=" * 70)
