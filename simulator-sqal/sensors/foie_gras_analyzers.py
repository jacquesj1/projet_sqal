#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
FOIE GRAS ANALYZERS
Analyseurs spécialisés pour le contrôle qualité du foie gras
Utilise les références métier de config_foiegras.yaml
"""

import numpy as np
import yaml
import os
from typing import Dict, List, Tuple, Any

# Charger la configuration métier
CONFIG_PATH = os.path.join(os.path.dirname(__file__), '..', 'config_foiegras.yaml')
with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
    CONFIG = yaml.safe_load(f)

# Références qualité (source de vérité)
QUALITY_REFS = CONFIG['quality_references']


class ToFDimensionalAnalyzer:
    """Analyseur dimensionnel ToF pour foie gras"""
    
    def __init__(self):
        """Initialiser avec les références de config_foiegras.yaml"""
        dim_refs = QUALITY_REFS['dimensional']
        
        # Seuils de classification par épaisseur (mm) - depuis config
        thickness_cats = dim_refs['thickness_categories']
        self.THICKNESS_THRESHOLDS = {
            'extra': (thickness_cats['extra']['min_mm'], thickness_cats['extra']['max_mm']),
            'premier_choix': (thickness_cats['premier_choix']['min_mm'], thickness_cats['premier_choix']['max_mm']),
            'deuxieme_choix': (thickness_cats['deuxieme_choix']['min_mm'], thickness_cats['deuxieme_choix']['max_mm']),
        }
        
        # Seuils d'irrégularité - depuis config
        self.IRREGULARITY_THRESHOLD_MM = dim_refs['thickness_homogeneity']['irregular_std_mm']
        
        # Références remplissage
        self.fill_refs = dim_refs['fill_level']
        
        # Scores conformité
        self.conformity_scores = dim_refs['conformity_scoring']
    
    def analyze_lobe_thickness(self, distance_matrix: np.ndarray) -> Dict[str, Any]:
        """
        Analyser l'épaisseur du lobe de foie gras
        
        Args:
            distance_matrix: Matrice 8x8 de distances (mm)
            
        Returns:
            Dict avec thickness_mm, thickness_std, category, is_irregular
        """
        # Aplatir la matrice 8x8 en array NumPy
        distances_flat = distance_matrix.flatten()
        
        # Filtrer les valeurs valides (entre 30mm et 4000mm) - utiliser NumPy
        valid_mask = (distances_flat > 30) & (distances_flat < 4000)
        valid_distances = distances_flat[valid_mask]
        
        if len(valid_distances) == 0:
            return {
                'thickness_mm': 0.0,
                'thickness_std': 0.0,
                'category': 'hors_norme',
                'is_irregular': True,
                'confidence': 0.0
            }
        
        # Épaisseur moyenne
        thickness_mm = np.mean(valid_distances)
        
        # Homogénéité (écart-type)
        thickness_std = np.std(valid_distances)
        
        # Classification
        category = self._classify_thickness(thickness_mm)
        
        # Détection irrégularité
        is_irregular = thickness_std > self.IRREGULARITY_THRESHOLD_MM
        
        return {
            'thickness_mm': float(thickness_mm),
            'thickness_std': float(thickness_std),
            'category': category,
            'is_irregular': bool(is_irregular),
        }
    
    def _classify_thickness(self, thickness: float) -> str:
        """Classifier selon l'épaisseur"""
        for category, (min_t, max_t) in self.THICKNESS_THRESHOLDS.items():
            if min_t <= thickness < max_t:
                return category
        return 'hors_norme'
    
    def estimate_volume(self, distance_matrix: np.ndarray) -> float:
        """
        Estimer le volume du lobe à partir des distances ToF
        
        Args:
            distance_matrix: Matrice 8x8 de distances (mm)
            
        Returns:
            Volume estimé en cm³
        """
        # Approximation : somme des hauteurs * surface unitaire
        # Chaque zone = 0.5cm x 0.5cm = 0.25 cm²
        zone_area_cm2 = 0.25
        
        # Aplatir et filtrer
        distances_flat = distance_matrix.flatten()
        valid_mask = (distances_flat > 30) & (distances_flat < 4000)
        valid_distances = distances_flat[valid_mask]
        
        # Convertir mm en cm et calculer volume
        total_volume_cm3 = np.sum(valid_distances * zone_area_cm2 / 10)
        
        return float(total_volume_cm3)
    
    def analyze_fill_level(self, distance_matrix: np.ndarray, 
                          standard_fill_mm: float = 50.0,
                          tolerance_mm: float = 3.0) -> Dict[str, Any]:
        """
        Analyser le niveau de remplissage d'une terrine/bocal
        
        Args:
            distance_matrix: Matrice 8x8 de distances (mm)
            standard_fill_mm: Niveau de remplissage standard
            tolerance_mm: Tolérance acceptable (±X mm)
            
        Returns:
            Dict avec fill_level_mm, fill_conformity, fill_deviation_mm
        """
        # Aplatir et filtrer
        distances_flat = distance_matrix.flatten()
        valid_mask = (distances_flat > 30) & (distances_flat < 4000)
        valid_distances = distances_flat[valid_mask]
        
        if len(valid_distances) == 0:
            return {
                'fill_level_mm': 0.0,
                'fill_level_percent': 0.0,
                'fill_conformity': False,
                'fill_deviation_mm': 0.0,
            }
        
        # Niveau moyen
        fill_level_mm = np.mean(valid_distances)
        
        # Pourcentage par rapport au standard
        fill_level_percent = (fill_level_mm / standard_fill_mm) * 100
        
        # Écart vs standard
        fill_deviation_mm = fill_level_mm - standard_fill_mm
        
        # Conformité
        fill_conformity = abs(fill_deviation_mm) <= tolerance_mm
        
        return {
            'fill_level_mm': float(fill_level_mm),
            'fill_level_percent': float(fill_level_percent),
            'fill_conformity': bool(fill_conformity),
            'fill_deviation_mm': float(fill_deviation_mm),
        }
    
    def calculate_dimensional_conformity_score(self, 
                                              thickness_category: str,
                                              is_irregular: bool,
                                              fill_conformity: bool = True) -> float:
        """
        Calculer le score de conformité dimensionnelle (0-100)
        
        Args:
            thickness_category: Catégorie d'épaisseur
            is_irregular: Lobe irrégulier
            fill_conformity: Conformité remplissage
            
        Returns:
            Score 0-100
        """
        score = 100.0
        
        # Pénalité selon catégorie
        if thickness_category == 'extra':
            score = 100
        elif thickness_category == 'premier_choix':
            score = 90
        elif thickness_category == 'deuxieme_choix':
            score = 75
        else:  # hors_norme
            score = 50
        
        # Pénalité irrégularité
        if is_irregular:
            score -= 15
        
        # Pénalité non-conformité remplissage
        if not fill_conformity:
            score -= 20
        
        return max(0, min(100, score))
    
    def calculate_process_capability(self, thickness_history: List[float], 
                                     lsl: float = None, usl: float = None) -> Dict[str, Any]:
        """
        Calculer Cp/Cpk pour capabilité process
        
        Args:
            thickness_history: Historique des épaisseurs (mm)
            lsl: Lower Specification Limit (défaut: depuis config)
            usl: Upper Specification Limit (défaut: depuis config)
            
        Returns:
            Dict avec cp, cpk, process_capability, mean, std
        """
        if len(thickness_history) < 10:
            return {
                'cp': None,
                'cpk': None,
                'process_capability': 'insufficient_data',
                'mean': None,
                'std': None,
                'is_centered': None
            }
        
        # Utiliser les limites de la catégorie 'extra' par défaut
        if lsl is None:
            lsl = self.THICKNESS_THRESHOLDS['extra'][0]
        if usl is None:
            usl = self.THICKNESS_THRESHOLDS['extra'][1]
        
        mean = np.mean(thickness_history)
        std = np.std(thickness_history, ddof=1)  # Sample std
        
        if std == 0:
            return {
                'cp': None,
                'cpk': None,
                'process_capability': 'no_variation',
                'mean': float(mean),
                'std': 0.0,
                'is_centered': True
            }
        
        # Cp : Capabilité potentielle
        cp = (usl - lsl) / (6 * std)
        
        # Cpk : Capabilité réelle
        cpu = (usl - mean) / (3 * std)
        cpl = (mean - lsl) / (3 * std)
        cpk = min(cpu, cpl)
        
        # Classification
        if cpk >= 1.33:
            capability = "capable"
        elif cpk >= 1.0:
            capability = "acceptable"
        else:
            capability = "incapable"
        
        # Vérifier centrage
        target = (usl + lsl) / 2
        is_centered = abs(mean - target) < (usl - lsl) * 0.05  # 5% de la plage
        
        return {
            'cp': float(cp),
            'cpk': float(cpk),
            'process_capability': capability,
            'mean': float(mean),
            'std': float(std),
            'is_centered': bool(is_centered),
            'cpu': float(cpu),
            'cpl': float(cpl)
        }
    
    def calculate_moving_average(self, thickness_history: List[float], 
                                 window: int = 10) -> Dict[str, Any]:
        """
        Calculer moyenne mobile et détection de tendance
        
        Args:
            thickness_history: Historique des épaisseurs (mm)
            window: Taille de la fenêtre (défaut: 10)
            
        Returns:
            Dict avec moving_avg, trend, slope
        """
        if len(thickness_history) < window:
            return {
                'moving_avg': None,
                'moving_avg_10': None,
                'moving_avg_50': None,
                'trend': 'insufficient_data',
                'slope': None
            }
        
        # Moyenne mobile sur fenêtre demandée
        moving_avg = np.convolve(thickness_history, 
                                 np.ones(window)/window, 
                                 mode='valid')[-1]
        
        # Moyennes mobiles multiples
        ma_10 = None
        ma_50 = None
        
        if len(thickness_history) >= 10:
            ma_10 = np.convolve(thickness_history, 
                               np.ones(10)/10, 
                               mode='valid')[-1]
        
        if len(thickness_history) >= 50:
            ma_50 = np.convolve(thickness_history, 
                               np.ones(50)/50, 
                               mode='valid')[-1]
        
        # Détection tendance (régression linéaire sur 20 derniers points)
        slope = None
        trend = "insufficient_data"
        
        if len(thickness_history) >= 20:
            x = np.arange(20)
            y = thickness_history[-20:]
            slope = np.polyfit(x, y, 1)[0]
            
            # Classification tendance
            if slope > 0.1:
                trend = "increasing"
            elif slope < -0.1:
                trend = "decreasing"
            else:
                trend = "stable"
        
        return {
            'moving_avg': float(moving_avg),
            'moving_avg_10': float(ma_10) if ma_10 is not None else None,
            'moving_avg_50': float(ma_50) if ma_50 is not None else None,
            'trend': trend,
            'slope': float(slope) if slope is not None else None
        }
    
    def calculate_dimensional_deviation(self, thickness_mm: float, 
                                       target_mm: float = 50.0) -> Dict[str, Any]:
        """
        Calculer l'écart dimensionnel par rapport au standard
        
        Args:
            thickness_mm: Épaisseur mesurée (mm)
            target_mm: Épaisseur cible (défaut: 50mm)
            
        Returns:
            Dict avec deviation_mm, deviation_percent, is_within_tolerance
        """
        deviation_mm = thickness_mm - target_mm
        deviation_percent = (deviation_mm / target_mm) * 100
        
        # Tolérance : ±10% (5mm pour 50mm)
        tolerance_mm = target_mm * 0.10
        is_within_tolerance = abs(deviation_mm) <= tolerance_mm
        
        return {
            'deviation_mm': float(deviation_mm),
            'deviation_percent': float(deviation_percent),
            'target_mm': float(target_mm),
            'tolerance_mm': float(tolerance_mm),
            'is_within_tolerance': bool(is_within_tolerance)
        }


class SpectralColorAnalyzer:
    """Analyseur couleur spectral pour foie gras"""
    
    def __init__(self):
        """Initialiser avec les références de config_foiegras.yaml"""
        color_refs = QUALITY_REFS['color']
        
        # Références couleur L*a*b* - depuis config
        lab_refs = color_refs['lab_references']
        self.REFERENCE_LAB = {
            'cru_extra': {
                'L': lab_refs['cru_extra']['L_star'],
                'a': lab_refs['cru_extra']['a_star'],
                'b': lab_refs['cru_extra']['b_star'],
            },
            'cru_standard': {
                'L': lab_refs['cru_standard']['L_star'],
                'a': lab_refs['cru_standard']['a_star'],
                'b': lab_refs['cru_standard']['b_star'],
            },
            'cuit_extra': {
                'L': lab_refs['cuit_extra']['L_star'],
                'a': lab_refs['cuit_extra']['a_star'],
                'b': lab_refs['cuit_extra']['b_star'],
            },
            'cuit_standard': {
                'L': lab_refs['cuit_standard']['L_star'],
                'a': lab_refs['cuit_standard']['a_star'],
                'b': lab_refs['cuit_standard']['b_star'],
            },
        }
        
        # Seuils Delta E - depuis config
        delta_e_thresholds = color_refs['delta_e_thresholds']
        self.DELTA_E_EXCELLENT = delta_e_thresholds['excellent']
        self.DELTA_E_ACCEPTABLE = delta_e_thresholds['acceptable']
        self.DELTA_E_CRITICAL = delta_e_thresholds['critical']
        
        # Scoring couleur
        self.color_scoring = color_refs['color_scoring']
    
    def calculate_lab_from_spectral(self, spectral_channels: Dict[str, float]) -> Dict[str, float]:
        """
        Convertir canaux spectraux en coordonnées L*a*b* (approximation)
        
        Args:
            spectral_channels: Dict avec clés '415nm', '445nm', ..., 'nir'
            
        Returns:
            Dict avec L, a, b
        """
        # Reconstruction RGB approximative depuis les canaux spectraux
        r = spectral_channels.get('630nm', 0) + spectral_channels.get('680nm', 0)
        g = spectral_channels.get('515nm', 0) + spectral_channels.get('555nm', 0)
        b = spectral_channels.get('445nm', 0) + spectral_channels.get('480nm', 0)
        
        # Normalisation (0-65535 → 0-1)
        r_norm = r / 65535.0
        g_norm = g / 65535.0
        b_norm = b / 65535.0
        
        # Conversion RGB → L*a*b* (approximation simplifiée)
        # Note: Pour une conversion précise, utiliser colormath ou colour-science
        L = 50 + (r_norm + g_norm + b_norm) * 25  # Luminosité
        a = (r_norm - g_norm) * 50  # Rouge-Vert
        b_star = (g_norm - b_norm) * 50  # Jaune-Bleu
        
        return {
            'L': float(L),
            'a': float(a),
            'b': float(b_star),
        }
    
    def calculate_delta_e(self, lab1: Dict[str, float], lab2: Dict[str, float]) -> float:
        """
        Calculer Delta E (CIE 1976 simplifié)
        
        Args:
            lab1: Coordonnées L*a*b* échantillon
            lab2: Coordonnées L*a*b* référence
            
        Returns:
            Delta E
        """
        delta_l = lab1['L'] - lab2['L']
        delta_a = lab1['a'] - lab2['a']
        delta_b = lab1['b'] - lab2['b']
        
        delta_e = np.sqrt(delta_l**2 + delta_a**2 + delta_b**2)
        
        return float(delta_e)
    
    def calculate_color_score_premium(self, lab: Dict[str, float], delta_e: float) -> float:
        """
        Calculer le score couleur premium (0-100)
        
        Args:
            lab: Coordonnées L*a*b*
            delta_e: Delta E vs référence
            
        Returns:
            Score 0-100
        """
        # Score de base selon Delta E
        if delta_e < self.DELTA_E_EXCELLENT:
            score = 100.0
        elif delta_e < self.DELTA_E_ACCEPTABLE:
            # Décroissance linéaire entre 2 et 5
            score = 100 - (delta_e - self.DELTA_E_EXCELLENT) * 10
        else:
            # Pénalité forte au-delà de 5
            score = max(0, 70 - (delta_e - self.DELTA_E_ACCEPTABLE) * 5)
        
        # Bonus si L* dans la plage idéale (68-77)
        if 68 <= lab['L'] <= 77:
            score += 5
        
        return float(min(100, max(0, score)))
    
    def calculate_maturity_index(self, spectral_channels: Dict[str, float]) -> Dict[str, Any]:
        """
        Calculer l'indice de maturité (fruits/légumes) basé sur ratio spectral
        
        Args:
            spectral_channels: Dict avec clés '680nm_red', 'nir', etc.
            
        Returns:
            Dict avec maturity_index, maturity_stage, spectral_ratio_red_nir
        """
        red = spectral_channels.get('680nm', spectral_channels.get('red', 0))
        nir = spectral_channels.get('nir', spectral_channels.get('850nm', 0))
        
        if nir == 0:
            return {
                'maturity_index': None,
                'maturity_stage': 'unknown',
                'spectral_ratio_red_nir': None
            }
        
        # Ratio Rouge/NIR (indicateur chlorophylle)
        ratio = red / nir
        
        # Classification maturité
        # Ratio faible (<0.8) = immature (chlorophylle active)
        # Ratio moyen (0.8-1.5) = optimal
        # Ratio élevé (>1.5) = surmaturité (chlorophylle dégradée)
        
        if ratio < 0.8:
            stage = "immature"
            index = ratio / 0.8  # Normaliser 0-1
        elif ratio < 1.5:
            stage = "optimal"
            index = 0.5 + (ratio - 0.8) / 1.4  # 0.5-1.0
        else:
            stage = "overripe"
            index = 1.0
        
        return {
            'maturity_index': float(index),
            'maturity_stage': stage,
            'spectral_ratio_red_nir': float(ratio)
        }
    
    def calculate_freshness_score(self, current_spectrum: Dict[str, float], 
                                  reference_spectrum: Dict[str, float],
                                  time_since_production_hours: float = 0) -> Dict[str, Any]:
        """
        Calculer le score de fraîcheur basé sur évolution spectrale
        
        Args:
            current_spectrum: Spectre actuel
            reference_spectrum: Spectre référence (produit frais)
            time_since_production_hours: Temps depuis production (heures)
            
        Returns:
            Dict avec freshness_score, freshness_trend, estimated_shelf_life_hours
        """
        if not current_spectrum or not reference_spectrum:
            return {
                'freshness_score': None,
                'freshness_trend': 'unknown',
                'estimated_shelf_life_hours': None,
                'spectral_degradation_rate': None
            }
        
        # Calculer dégradation spectrale (distance euclidienne normalisée)
        degradation = 0
        count = 0
        
        for wavelength in current_spectrum:
            if wavelength in reference_spectrum:
                ref = reference_spectrum[wavelength]
                curr = current_spectrum[wavelength]
                if ref > 0:
                    degradation += abs(curr - ref) / ref
                    count += 1
        
        if count == 0:
            return {
                'freshness_score': None,
                'freshness_trend': 'unknown',
                'estimated_shelf_life_hours': None,
                'spectral_degradation_rate': None
            }
        
        degradation /= count
        
        # Score de fraîcheur (100 = frais, 0 = périmé)
        freshness_score = max(0, 100 * (1 - degradation))
        
        # Taux de dégradation (%/heure)
        if time_since_production_hours > 0:
            degradation_rate = (degradation / time_since_production_hours) * 100
        else:
            degradation_rate = 0
        
        # Durée de vie restante (heures)
        if degradation_rate > 0.01:  # Seuil minimal
            shelf_life = (1 - degradation) / (degradation_rate / 100)
        else:
            shelf_life = 999  # Très stable
        
        # Tendance
        if degradation_rate > 0.5:
            trend = "declining"
        else:
            trend = "stable"
        
        return {
            'freshness_score': float(freshness_score),
            'freshness_trend': trend,
            'estimated_shelf_life_hours': float(shelf_life),
            'spectral_degradation_rate': float(degradation_rate)
        }
    
    def calculate_color_homogeneity(self, delta_e_values: List[float]) -> Dict[str, Any]:
        """
        Calculer l'homogénéité couleur (coefficient de variation)
        
        Args:
            delta_e_values: Liste des Delta E sur la surface du produit
            
        Returns:
            Dict avec color_homogeneity_cv, color_uniformity, color_std_delta_e
        """
        if not delta_e_values or len(delta_e_values) < 2:
            return {
                'color_homogeneity_cv': None,
                'color_uniformity': 'unknown',
                'color_std_delta_e': None
            }
        
        mean_delta_e = np.mean(delta_e_values)
        std_delta_e = np.std(delta_e_values)
        
        # Coefficient de variation (%)
        if mean_delta_e > 0:
            cv = (std_delta_e / mean_delta_e) * 100
        else:
            cv = 0
        
        # Classification uniformité
        if cv < 5:
            uniformity = "excellent"
        elif cv < 10:
            uniformity = "good"
        elif cv < 20:
            uniformity = "acceptable"
        else:
            uniformity = "poor"
        
        return {
            'color_homogeneity_cv': float(cv),
            'color_uniformity': uniformity,
            'color_std_delta_e': float(std_delta_e),
            'color_mean_delta_e': float(mean_delta_e)
        }
    
    def get_spectral_bands_detailed(self, spectral_channels: Dict[str, float]) -> Dict[str, Any]:
        """
        Extraire les bandes spectrales détaillées (415nm-NIR)
        
        Args:
            spectral_channels: Dict avec intensités par canal
            
        Returns:
            Dict avec toutes les bandes spectrales et signature
        """
        # Mapping des canaux AS7341
        bands = {
            '415nm_violet': spectral_channels.get('415nm', spectral_channels.get('violet', 0)),
            '445nm_indigo': spectral_channels.get('445nm', spectral_channels.get('indigo', 0)),
            '480nm_blue': spectral_channels.get('480nm', spectral_channels.get('blue', 0)),
            '515nm_cyan': spectral_channels.get('515nm', spectral_channels.get('cyan', 0)),
            '555nm_green': spectral_channels.get('555nm', spectral_channels.get('green', 0)),
            '590nm_yellow': spectral_channels.get('590nm', spectral_channels.get('yellow', 0)),
            '630nm_orange': spectral_channels.get('630nm', spectral_channels.get('orange', 0)),
            '680nm_red': spectral_channels.get('680nm', spectral_channels.get('red', 0)),
            'nir_850nm': spectral_channels.get('nir', spectral_channels.get('850nm', 0))
        }
        
        # Calculer signature spectrale (profil normalisé)
        total_intensity = sum(bands.values())
        if total_intensity > 0:
            signature = {k: v / total_intensity for k, v in bands.items()}
        else:
            signature = bands
        
        # Identifier profil caractéristique
        # Pour foie gras : pic dans rouge/orange, faible dans bleu/violet
        red_orange_ratio = (bands['630nm_orange'] + bands['680nm_red']) / (bands['415nm_violet'] + bands['480nm_blue'] + 1)
        
        if red_orange_ratio > 2.0:
            spectral_profile = "foie_gras_cru_extra"
        elif red_orange_ratio > 1.5:
            spectral_profile = "foie_gras_cru_standard"
        elif red_orange_ratio > 1.0:
            spectral_profile = "foie_gras_cuit"
        else:
            spectral_profile = "atypical"
        
        return {
            'spectral_bands': bands,
            'spectral_signature': signature,
            'spectral_profile': spectral_profile,
            'red_orange_ratio': float(red_orange_ratio),
            'total_intensity': float(total_intensity)
        }


class DefectDetector:
    """Détecteur de défauts visuels pour foie gras"""
    
    def __init__(self):
        """Initialiser avec les seuils de config_foiegras.yaml"""
        self.defect_refs = QUALITY_REFS['defects']
    
    def detect_hematoma(self, spectral_channels: Dict[str, float]) -> Tuple[bool, float]:
        """
        Détecter hématomes/ecchymoses (zones rouges/violacées)
        
        Returns:
            (has_defect, severity)
        """
        r = spectral_channels.get('630nm', 0) + spectral_channels.get('680nm', 0)
        b = spectral_channels.get('445nm', 0) + spectral_channels.get('480nm', 0)
        
        # Ratio R/B anormal - seuil depuis config
        ratio_rb = r / (b + 1)
        threshold = self.defect_refs['hematoma']['ratio_rb_threshold']
        
        has_defect = ratio_rb > threshold
        severity = min(1.0, max(0.0, (ratio_rb - threshold) / 2.0))
        
        return has_defect, float(severity)
    
    def detect_bile_traces(self, spectral_channels: Dict[str, float]) -> Tuple[bool, float]:
        """
        Détecter traces de fiel (zones verdâtres)
        
        Returns:
            (has_defect, severity)
        """
        g = spectral_channels.get('515nm', 0) + spectral_channels.get('555nm', 0)
        r = spectral_channels.get('630nm', 0)
        
        # Pic dans canal vert - seuil depuis config
        ratio_gr = g / (r + 1)
        threshold = self.defect_refs['bile_traces']['ratio_gr_threshold']
        
        has_defect = ratio_gr > threshold
        severity = min(1.0, max(0.0, (ratio_gr - threshold) / 0.5))
        
        return has_defect, float(severity)
    
    def detect_oxidation(self, b_star: float, b_star_ref: float = 20.0) -> Tuple[bool, float]:
        """
        Détecter oxydation (brunissement excessif)
        
        Returns:
            (has_defect, severity)
        """
        deviation = abs(b_star - b_star_ref)
        threshold = self.defect_refs['oxidation']['b_star_deviation_threshold']
        
        has_defect = deviation > threshold
        severity = min(1.0, max(0.0, (deviation - threshold) / 10.0))
        
        return has_defect, float(severity)
    
    def calculate_defect_rate(self, defects: Dict[str, bool]) -> float:
        """
        Calculer le taux de défauts global (%)
        
        Args:
            defects: Dict {defect_name: has_defect}
            
        Returns:
            Taux de défauts (0-100%)
        """
        if not defects:
            return 0.0
        
        total_defects = sum(1 for has_defect in defects.values() if has_defect)
        defect_rate = (total_defects / len(defects)) * 100
        
        return float(defect_rate)
