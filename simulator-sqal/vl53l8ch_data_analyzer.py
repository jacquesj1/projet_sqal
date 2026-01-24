# vl53l8ch_data_analyzer.py
"""
VL53L8CH DATA ANALYZER
- Prend en entrée les données brutes du simulateur (ou du capteur réel)
- Calcule statistiques (volume, moyenne, max/min), surface occupée, uniformité
- Analyse bins pour multi-peak, roughness, signal_quality, texture_score, density_score
- Analyse reflectance & amplitude pour anomalies optiques
- Analyse consistance du signal (z-score etc.)
- Calcule score global et determine grade: A/B/C/REJET
- Fournit fonctions de visualisation (heatmaps, histograms, 3D surface)
"""

from typing import Dict, Any, Tuple, List, Optional
import numpy as np
import math
import json
import time

from dataclasses import dataclass

# ---------------- Volume calculations ----------------
from scipy import interpolate, integrate
# optionally use scipy for peak finding
try:
    from scipy import signal as scisig
    SCIPY_AVAILABLE = True
except Exception:
    scisig = None
    SCIPY_AVAILABLE = False

try:
    from matplotlib import pyplot as plt
    MATPLOTLIB_AVAILABLE = True
except Exception:
    MATPLOTLIB_AVAILABLE = False

# ------------------ Grades enum (simple) ------------------
class Grade:
    GRADE_A = "Grade A - Excellente qualité"
    GRADE_B = "Grade B - Bonne qualité" 
    GRADE_C = "Grade C - Qualité acceptable"
    REJECT = "REJET - Qualité insuffisante"

@dataclass
class ToFStatistics:
    """Statistiques de surface obtenues à partir de la matrice ToF"""
    volume_mm3: float
    base_area_mm2: float
    average_height_mm: float
    max_height_mm: float
    min_height_mm: float
    surface_uniformity: float  # Nouvel indicateur
    height_variation: float


@dataclass
class BinsAnalysis:
    """Analyse des bins histogrammes ToF"""
    multi_peak_count: np.ndarray
    surface_roughness: np.ndarray
    signal_quality: np.ndarray
    texture_score: np.ndarray      # Nouveau
    density_score: np.ndarray      # Nouveau

@dataclass
class DefectDetection:
    """Résultats de détection de défauts"""
    defect_positions: List[Tuple[int, int]]
    defect_types: List[str]
    defect_severities: List[float]
    overall_quality_score: float
    grade: Grade



# ------------------ Analyzer class ------------------
class VL53L8CH_DataAnalyzer:
    def __init__(self,
                 bin_size_mm: float = 37.5,
                 texture_threshold: float = 0.30,
                 density_threshold: float = 3000.0,
                 consistency_threshold: float = 0.6):
        """
        texture_threshold: entropie normalisée seuil suspect
        density_threshold: somme d'énergie minimale attendue
        consistency_threshold: zscore-based threshold for amplitude consistency
        """
        self.bin_size_mm = float(bin_size_mm)
        self.texture_threshold = float(texture_threshold)
        self.density_threshold = float(density_threshold)
        self.consistency_threshold = float(consistency_threshold)

    # ---------- main processing pipeline ----------
    def process(self, raw: Dict[str, Any]) -> Dict[str, Any]:
        """
        raw is the dict returned by VL53L8CH_RawSimulator.simulate_measurement()
        Returns a report dict (JSON-friendly) with metrics, analyses and grade.
        """
        t0 = time.time()
        distances = np.array(raw["distance_matrix"], dtype=float)
        reflectance = np.array(raw["reflectance_matrix"], dtype=float)
        amplitude = np.array(raw["amplitude_matrix"], dtype=float)
        ambient = np.array(raw["ambient_matrix"], dtype=float)
        bins = raw.get("bins_matrix", None)
        bins_arr = np.array(bins) if bins is not None else None

        res = distances.shape[0]
        zone_area_mm2 = (raw["meta"]["zone_size_mm"] ** 2)

        # Basic stats
        heights = raw["meta"]["height_sensor_mm"] - distances
        heights = np.clip(heights, 0.0, None)
        total_volume_mm3 = float(np.sum(heights) * zone_area_mm2)
        avg_height = float(np.mean(heights))
        max_height = float(np.max(heights))
        min_height = float(np.min(heights))
        occupied_pixels = int(np.sum(heights > (0.05 * np.max(heights))))  # >5% of max -> occupied

        stats = {
            "volume_mm3": total_volume_mm3,
            "average_height_mm": avg_height,  # Changed from avg_height_mm to match backend schema
            "max_height_mm": max_height,
            "min_height_mm": min_height,
            "height_range_mm": max_height - min_height,  # Added field required by backend
            "occupied_pixels": occupied_pixels,
            "base_area_mm2": float(zone_area_mm2 * distances.size),
            "volume_trapezoidal_mm3": self._calculate_volume_trapezoidal(heights, raw["meta"]["zone_size_mm"]),
            "volume_simpson_mm3": self._calculate_volume_simpson(heights, raw["meta"]["zone_size_mm"]),
            "volume_spline_mm3": self._calculate_volume_spline(heights, raw["meta"]["zone_size_mm"]),
        }

        # Surface uniformity via gradients
        gx, gy = np.gradient(distances)
        grad_mag = np.sqrt(gx**2 + gy**2)
        surface_uniformity = float(1.0 / (1.0 + np.mean(np.abs(grad_mag))))
        stats["surface_uniformity"] = surface_uniformity
        stats["height_variation_mm"] = float(np.std(heights))




        # Analyze bins if provided
        bins_analysis = None
        if bins_arr is not None:
            # ensure shape (res,res,n_bins)
            if bins_arr.ndim != 3:
                # attempt to reshape if flattened
                expected = (res, res, raw["meta"]["n_bins"])
                try:
                    bins_arr = bins_arr.reshape(expected)
                except Exception:
                    raise ValueError("bins_matrix format unexpected; expected 3D array shape (res,res,n_bins)")
            bins_analysis = self._analyze_bins_cube(bins_arr)

        # Reflectance analysis
        refl_analysis = self._analyze_reflectance(reflectance)

        # Amplitude / signal consistency
        consistency = self._analyze_signal_consistency(amplitude)

        # Defect detection (distance-based)
        defects = self._detect_surface_defects(distances, heights)

        # Aggregate metrics into a quality score (heuristic)
        quality_score, score_breakdown = self._compute_quality_score(
            stats, bins_analysis, refl_analysis, consistency, defects
        )

        grade = self._determine_grade(quality_score, defects)

        report = {
            "timestamp": time.time(),
            "stats": stats,
            "bins_analysis": bins_analysis,
            "reflectance_analysis": refl_analysis,
            "amplitude_consistency": consistency,
            "defects": defects,
            "quality_score": quality_score,
            "score_breakdown": score_breakdown,
            "grade": grade,
            "processing_time_s": time.time() - t0
        }
        return report

    # ---------- bins cube analysis ----------
    def _analyze_bins_cube(self, cube: np.ndarray) -> Dict[str, Any]:
        res, _, n_bins = cube.shape
        multi_peak = np.zeros((res, res), dtype=int)
        roughness = np.zeros((res, res), dtype=float)
        signal_quality = np.zeros((res, res), dtype=float)
        texture = np.zeros((res, res), dtype=float)
        density = np.zeros((res, res), dtype=float)
        peak_bin_map = np.zeros((res, res), dtype=int)

        for i in range(res):
            for j in range(res):
                hist = cube[i,j,:].astype(float)
                # baseline removal (median of first 5 bins)
                baseline = np.median(hist[:max(1, n_bins//16)])
                histp = np.clip(hist - baseline, 0.0, None)
                total = float(np.sum(histp)) + 1e-12
                # smoothing small
                if SCIPY_AVAILABLE:
                    hists = scisig.convolve(histp, scisig.windows.gaussian(min(41, n_bins), std=3)/np.sum(scisig.windows.gaussian(min(41,n_bins),std=3)), mode='same')
                else:
                    hists = histp
                # find peaks
                if SCIPY_AVAILABLE:
                    peaks, props = scisig.find_peaks(hists, height=np.max(hists)*0.18, prominence=np.max(hists)*0.05)
                else:
                    # naive threshold
                    peaks = np.where(hists > np.max(hists)*0.18)[0]
                    peaks = peaks if peaks.ndim>0 else np.array([])
                    props = {}
                multi_peak[i,j] = int(len(peaks)) if hasattr(peaks, '__len__') else 0
                peak_idx = int(np.argmax(hists)) if hists.size>0 else 0
                peak_bin_map[i,j] = peak_idx
                roughness[i,j] = float(np.std(hists) / (np.max(hists) + 1e-9))
                signal_quality[i,j] = float((np.max(hists) / (total + 1e-9)) if total>0 else 0.0)
                # entropy texture
                nh = histp / (total + 1e-12)
                nh = np.clip(nh, 1e-12, None)
                entropy = -float(np.sum(nh * np.log(nh)))
                texture[i,j] = entropy / (np.log(n_bins) + 1e-9)
                density[i,j] = float(total)

        return {
            "multi_peak_count": multi_peak.tolist(),
            "surface_roughness": roughness.tolist(),
            "signal_quality": signal_quality.tolist(),
            "texture_score": texture.tolist(),
            "density_score": density.tolist(),
            "peak_bin_map": peak_bin_map.tolist()
        }

    # ---------- reflectance analysis ----------
    def _analyze_reflectance(self, refl: np.ndarray) -> Dict[str, Any]:
        res = refl.shape[0]
        mean_refl = float(np.nanmean(refl))
        std_refl = float(np.nanstd(refl))
        low_mask = refl < 30.0
        high_mask = refl > 80.0
        low_pct = float(np.sum(low_mask)) / (res*res)
        high_pct = float(np.sum(high_mask)) / (res*res)
        # local std anomalies
        local_anomalies = []
        for i in range(1, res-1):
            for j in range(1, res-1):
                window = refl[i-1:i+2, j-1:j+2]
                if np.std(window) > 12.0:
                    local_anomalies.append((i,j,float(np.std(window))))
        return {
            "mean_reflectance_pct": mean_refl,
            "std_reflectance_pct": std_refl,
            "low_reflectance_fraction": low_pct,
            "high_reflectance_fraction": high_pct,
            "local_variations": local_anomalies[:50]
        }

    # ---------- amplitude consistency ----------
    def _analyze_signal_consistency(self, amplitude: np.ndarray) -> Dict[str, Any]:
        mean_amp = float(np.mean(amplitude))
        std_amp = float(np.std(amplitude))
        z = np.abs((amplitude - mean_amp) / (std_amp + 1e-9))
        # fraction of highly deviant pixels
        outliers = np.sum(z > 2.5)
        frac_out = float(outliers) / amplitude.size
        return {
            "mean_amplitude": mean_amp,
            "std_amplitude": std_amp,
            "outlier_fraction": frac_out,
            "consistency_ok": frac_out < (1.0 - self.consistency_threshold)
        }

    # ---------- defect detection from distances ----------
    def _detect_surface_defects(self, distances: np.ndarray, heights: np.ndarray) -> List[Dict[str,Any]]:
        res = distances.shape[0]
        defects = []
        median_d = float(np.median(distances))
        for i in range(res):
            for j in range(res):
                d = float(distances[i,j])
                dev = d - median_d
                if abs(dev) > 10.0:  # 10 mm threshold
                    typ = "foreign_body" if dev < 0 else "surface_deformation"
                    severity = min(1.0, abs(dev)/ (0.5*median_d + 1e-9))
                    defects.append({"pos":(i,j), "type":typ, "severity": severity, "deviation_mm": float(dev)})
        return defects

    #Ajout JJ à modifer au niveau cnh_matrix
    def _analyze_cnh_texture_density(self, cnh_matrix: np.ndarray) -> List[Tuple]:
        """1. Analyse texture/densité via histogrammes CNH"""
        defects = []
        
        if cnh_matrix is None:
            return defects
            
        for zone_id in range(min(32, cnh_matrix.shape[0])):
            histogram = cnh_matrix[zone_id]
            
            # Métriques texture
            normalized_hist = histogram / (np.sum(histogram) + 1e-10)
            entropy = -np.sum(normalized_hist * np.log(normalized_hist + 1e-10))
            variance = np.var(histogram)
            texture_score = (entropy / 4 + variance / 1000) / 2
            
            # Métriques densité  
            total_signal = np.sum(histogram)
            density_score = min(total_signal / 1000, 1.0)
            
            # Détection anomalies
            if texture_score > self.texture_threshold:
                zone_coords = self._cnh_to_8x8_coords(zone_id)
                defects.append((zone_coords, "Variation texture", texture_score))
                
            if density_score < 0.5:
                zone_coords = self._cnh_to_8x8_coords(zone_id)
                defects.append((zone_coords, "Variation densité", 1 - density_score))
        
        return defects


    def _analyze_surface_deformations(self, distances: np.ndarray) -> List[Tuple]:
            """3. Analyse déformations/corps étrangers via distances"""
            defects = []
            median_distance = np.median(distances)
            
            for i in range(8):
                for j in range(8):
                    distance = distances[i, j]
                    deviation = abs(distance - median_distance)
                    
                    if deviation > self.distance_tolerance:
                        severity = min(deviation / 10, 1.0)
                        
                        if distance < median_distance:
                            defect_type = "Corps étranger"
                        else:
                            defect_type = "Déformation surface"
                        
                        defects.append(((i, j), defect_type, severity))
            
            return defects

    def _comprehensive_defect_analysis(self, distances: np.ndarray, reflectances: np.ndarray,
                                     amplitudes: np.ndarray, cnh_matrix: np.ndarray) -> DefectDetection:
        """Analyse complète utilisant les 4 méthodes demandées"""
        
        defect_positions = []
        defect_types = []
        defect_severities = []
        
        # 1. Analyse histogrammes CNH - Texture/Densité
        texture_defects = self._analyze_cnh_texture_density(cnh_matrix)
        defect_positions.extend([d[0] for d in texture_defects])
        defect_types.extend([d[1] for d in texture_defects])
        defect_severities.extend([d[2] for d in texture_defects])
        
        # 2. Analyse réflectance - Propriétés optiques
        optical_defects = self._analyze_reflectance_properties(reflectances)
        defect_positions.extend([d[0] for d in optical_defects])
        defect_types.extend([d[1] for d in optical_defects])
        defect_severities.extend([d[2] for d in optical_defects])
        
        # 3. Analyse distance - Déformations/Corps étrangers
        surface_defects = self._analyze_surface_deformations(distances)
        defect_positions.extend([d[0] for d in surface_defects])
        defect_types.extend([d[1] for d in surface_defects])
        defect_severities.extend([d[2] for d in surface_defects])
        
        # 4. Analyse amplitude - Consistance matériau
        consistency_defects = self._analyze_signal_consistency(amplitudes)
        defect_positions.extend([d[0] for d in consistency_defects])
        defect_types.extend([d[1] for d in consistency_defects])
        defect_severities.extend([d[2] for d in consistency_defects])
        
        # Calcul score qualité global
        quality_score = self._calculate_quality_score(defect_severities, defect_types)
        grade = self._determine_grade(quality_score, defect_types)
        
        return DefectDetection(
            defect_positions=defect_positions,
            defect_types=defect_types,
            defect_severities=defect_severities,
            overall_quality_score=quality_score,
            grade=grade
        )

    #Fin ajout

    # -------- quality scoring ----------
    def _compute_quality_score(self, stats: Dict, bins_analysis: Optional[Dict], refl_analysis: Dict, consistency: Dict, defects: List[Dict]) -> Tuple[float, Dict]:
        """
        Heuristic scoring: combine normalized contributions from:
        - volume within expected range
        - texture (from bins)
        - density (bins)
        - reflectance anomalies
        - consistency
        - defects penalty
        """
        # ✅ Volume score avec tolérance réaliste
        # Foie gras standard : 200mm x 100mm x hauteur variable (20-50mm typique)
        # Volume attendu : 200 * 100 * 35mm (moyenne) = 700,000 mm³
        # Tolérance : ±50% (acceptable pour produit naturel avec forte variabilité)
        expected_volume_mm3 = 700_000  # Volume moyen attendu
        vol_min = expected_volume_mm3 * 0.5  # -50%
        vol_max = expected_volume_mm3 * 1.5  # +50%
        
        vol = stats["volume_mm3"]
        
        # Score basé sur la plage acceptable (plus tolérant)
        if vol_min <= vol <= vol_max:
            # Volume dans la plage acceptable : score élevé
            vol_score = 1.0 - (abs(vol - expected_volume_mm3) / (expected_volume_mm3 * 0.5))
            vol_score = max(0.75, min(1.0, vol_score))  # Score minimum 0.75 si dans la plage
        else:
            # Volume hors plage : pénalité progressive mais plus douce
            if vol < vol_min:
                vol_score = max(0.4, vol / vol_min)  # Minimum 0.4 (au lieu de 0.3)
            else:
                vol_score = max(0.4, vol_max / vol)  # Minimum 0.4 (au lieu de 0.3)
        # texture score - average
        if bins_analysis:
            texture_map = np.array(bins_analysis["texture_score"])
            density_map = np.array(bins_analysis["density_score"])
            mean_texture = float(np.nanmean(texture_map))
            mean_density = float(np.nanmean(density_map))
            texture_score = max(0.0, 1.0 - mean_texture)  # lower entropy => better
            density_score = min(1.0, mean_density / (self.density_threshold + 1e-9))
            sigq_map = np.array(bins_analysis["signal_quality"])
            mean_sigq = float(np.nanmean(sigq_map))
        else:
            texture_score = 0.8
            density_score = 0.8
            mean_sigq = 0.8

        # reflectance penalty
        refl_penalty = max(0.0, (refl_analysis["low_reflectance_fraction"] + refl_analysis["high_reflectance_fraction"]))
        # consistency
        consistency_ok = 1.0 if consistency.get("consistency_ok", True) else 0.5

        # defects penalty - version stable
        total_defect_severity = sum(d["severity"] for d in defects) if defects else 0.0
        defect_penalty = min(1.0, total_defect_severity / max(1.0, len(defects))) if defects else 0.0

        # combine - version stable avec pondération originale
        weights = {
            "volume": 0.15,
            "texture": 0.20,
            "density": 0.20,
            "signal_quality": 0.15,
            "reflectance": 0.15,
            "consistency": 0.15
        }
        combined = (
            weights["volume"] * vol_score +
            weights["texture"] * texture_score +
            weights["density"] * density_score +
            weights["signal_quality"] * mean_sigq +
            weights["reflectance"] * (1.0 - refl_penalty) +
            weights["consistency"] * consistency_ok
        )
        # apply defect penalty (multiplicative)
        final_score = combined * (1.0 - defect_penalty)
        final_score = float(np.clip(final_score, 0.0, 1.0))

        breakdown = {
            "vol_score": vol_score,
            "texture_score": texture_score,
            "density_score": density_score,
            "mean_signal_quality": mean_sigq,
            "reflectance_penalty": refl_penalty,
            "consistency_ok": consistency_ok,
            "defect_penalty": defect_penalty
        }
        return final_score, breakdown

    # ---------- determine grade ----------
    def _determine_grade(self, quality_score: float, defects: List[Dict]) -> str:
        """
        Détermine le grade basé sur le quality_score
        Seuils ajustés pour produits naturels (foie gras)
        """
        # critical defect check (foreign_body severe)
        has_critical = any(d["type"] == "foreign_body" and d["severity"] > 0.7 for d in defects)
        if has_critical:
            return Grade.REJECT
        
        # ✅ Seuils ajustés pour produits naturels (variabilité acceptable)
        if quality_score >= 0.80:
            return Grade.GRADE_A  # Excellente qualité
        elif quality_score >= 0.65:
            return Grade.GRADE_B  # Bonne qualité
        elif quality_score >= 0.50:
            return Grade.GRADE_C  # Qualité acceptable
        else:
            return Grade.REJECT   # Qualité insuffisante

    # ---------- Visualization helpers ----------
    def plot_heatmaps(self, raw: Dict[str, Any], out_prefix: str = "viz"):
        if not MATPLOTLIB_AVAILABLE:
            print("matplotlib not available: cannot plot")
            return None
        dist = np.array(raw["distance_matrix"])
        refl = np.array(raw["reflectance_matrix"])
        amp = np.array(raw["amplitude_matrix"])
        bins = raw.get("bins_matrix", None)
        fig, axes = plt.subplots(1,3, figsize=(15,5))
        im0 = axes[0].imshow(raw["meta"]["height_sensor_mm"] - dist, origin='lower')
        axes[0].set_title("Height (mm)")
        fig.colorbar(im0, ax=axes[0])
        im1 = axes[1].imshow(refl, origin='lower')
        axes[1].set_title("Reflectance (%)")
        fig.colorbar(im1, ax=axes[1])
        im2 = axes[2].imshow(amp, origin='lower')
        axes[2].set_title("Amplitude (u.a.)")
        fig.colorbar(im2, ax=axes[2])
        plt.tight_layout()
        fname = f"{out_prefix}_heatmaps.png"
        plt.savefig(fname, dpi=150)
        plt.close(fig)
        return fname

    def plot_pixel_histogram(self, raw: Dict[str, Any], i: int, j: int, out_file: Optional[str] = None):
        if not MATPLOTLIB_AVAILABLE:
            print("matplotlib not available: cannot plot")
            return None
        bins = raw.get("bins_matrix", None)
        if bins is None:
            print("no bins to plot")
            return None
        arr = np.array(bins)
        hist = arr[i,j,:]
        x = np.arange(arr.shape[2]) * raw["meta"]["bin_size_mm"]
        import matplotlib.pyplot as plt
        plt.figure(figsize=(6,3))
        plt.plot(x, hist)
        plt.xlabel("Distance (mm)")
        plt.ylabel("Counts")
        plt.title(f"Pixel histogram ({i},{j})")
        out = out_file or f"pixel_hist_{i}_{j}.png"
        plt.savefig(out, dpi=150)
        plt.close()
        return out

    # ---------------- Volume calculations ----------------

    def _analyze_bins(self, cube: np.ndarray, n_bins: int, resolution: int) -> BinsAnalysis:
        """
        Analyse bins cube - supporte arrays 2D (32, n_bins) et 3D (res, res, n_bins)

        For each pixel compute:
         - multi_peak_count (number of peaks above 30% of max)
         - surface_roughness (std / max)
         - signal_quality (max / sum)
         - texture_score (entropy)
         - density_score (sum/1000)
        """
        try:
            from scipy.signal import find_peaks
        except ImportError:
            find_peaks = None

        # Handle 2D array (32, n_bins) for res=32 case
        if cube.ndim == 2:
            num_zones = cube.shape[0]
            multi_peak = np.zeros(num_zones, dtype=int)
            rough = np.zeros(num_zones, dtype=float)
            qual = np.zeros(num_zones, dtype=float)
            texture = np.zeros(num_zones, dtype=float)
            density = np.zeros(num_zones, dtype=float)

            for zone_id in range(num_zones):
                hist = cube[zone_id, :].astype(float)
                total = np.sum(hist) + 1e-12
                mx = np.max(hist) if total > 0 else 0.0

                # peaks: using scipy if available else fallback
                if find_peaks is not None:
                    peaks, _ = find_peaks(hist, height=mx*0.3)
                else:
                    peaks = np.array([k for k in range(1, n_bins-1)
                                     if hist[k]>hist[k-1] and hist[k]>hist[k+1] and hist[k] >= mx*0.3])

                multi_peak[zone_id] = len(peaks)
                rough[zone_id] = np.std(hist) / (mx + 1e-9)
                qual[zone_id] = mx / total if total>0 else 0.0
                # entropy (texture)
                p = hist / total
                p = np.clip(p, 1e-12, None)
                entropy = -np.sum(p * np.log(p))
                texture[zone_id] = entropy / (np.log(n_bins) + 1e-12)
                density[zone_id] = total / 1000.0

            return BinsAnalysis(multi_peak, rough, qual, texture, density)

        # Handle 3D array (res, res, n_bins) for res=8 case
        multi_peak = np.zeros((resolution, resolution), dtype=int)
        rough = np.zeros((resolution, resolution), dtype=float)
        qual = np.zeros((resolution, resolution), dtype=float)
        texture = np.zeros((resolution, resolution), dtype=float)
        density = np.zeros((resolution, resolution), dtype=float)

        for i in range(resolution):
            for j in range(resolution):
                hist = cube[i,j,:]
                total = np.sum(hist) + 1e-12
                mx = np.max(hist) if total > 0 else 0.0

                # peaks: using scipy if available else fallback
                if find_peaks is not None:
                    peaks, _ = find_peaks(hist, height=mx*0.3)
                else:
                    peaks = np.array([k for k in range(1, n_bins-1)
                                     if hist[k]>hist[k-1] and hist[k]>hist[k+1] and hist[k] >= mx*0.3])

                multi_peak[i,j] = len(peaks)
                rough[i,j] = np.std(hist) / (mx + 1e-9)
                qual[i,j] = mx / total if total>0 else 0.0
                # entropy (texture)
                p = hist / total
                p = np.clip(p, 1e-12, None)
                entropy = -np.sum(p * np.log(p))
                texture[i,j] = entropy / (np.log(n_bins) + 1e-12)
                density[i,j] = total / 1000.0

        return BinsAnalysis(multi_peak, rough, qual, texture, density)

    def _compute_enhanced_statistics(self, distance_matrix: np.ndarray, height_sensor: float, zone_size: float) -> ToFStatistics:
        """Calcule statistiques étendues avec indicateurs qualité"""
        # Stats de base
        base_area_mm2 = (zone_size ** 2) * distance_matrix.size
        heights = height_sensor - distance_matrix

        # Calcul volume par différentes méthodes
        volume_simple = float(np.sum(heights) * (zone_size ** 2))
        volume_trapeze = self._calculate_volume_trapezoidal(heights, zone_size)
        volume_simpson = self._calculate_volume_simpson(heights, zone_size)
        volume_spline = self._calculate_volume_spline(heights, zone_size)

        # Utilisation du volume trapèze comme référence principale
        volume_mm3 = volume_trapeze

        avg_height = float(np.mean(heights))
        max_height = float(np.max(heights))
        min_height = float(np.min(heights))

        # Nouveaux indicateurs
        height_variation = float(np.std(heights))

        # Uniformité de surface (inverse de la variation locale)
        gradient_x = np.gradient(distance_matrix, axis=1)
        gradient_y = np.gradient(distance_matrix, axis=0)
        gradient_magnitude = np.sqrt(gradient_x**2 + gradient_y**2)
        surface_uniformity = 1.0 / (1.0 + np.mean(gradient_magnitude))

        # Création objet ToFStatistics
        stats = ToFStatistics(
            volume_mm3=volume_mm3,
            base_area_mm2=base_area_mm2,
            average_height_mm=avg_height,
            max_height_mm=max_height,
            min_height_mm=min_height,
            surface_uniformity=float(surface_uniformity),
            height_variation=height_variation
        )

        # Ajout attributs pour comparaison méthodes
        stats.volume_simple = volume_simple
        stats.volume_trapeze = volume_trapeze
        stats.volume_simpson = volume_simpson
        stats.volume_spline = volume_spline

        return stats

    def _calculate_volume_trapezoidal(self, heights: np.ndarray, zone_size: float) -> float:
        """Trapèzes 2D : simple approximation du volume"""
        vol = 0.0
        for i in range(heights.shape[0]-1):
            for j in range(heights.shape[1]-1):
                h00 = heights[i,j]; h01 = heights[i,j+1]
                h10 = heights[i+1,j]; h11 = heights[i+1,j+1]
                cell_vol = (h00 + h01 + h10 + h11)/4.0 * (zone_size**2)
                vol += cell_vol
        return float(vol)

    def _calculate_volume_simpson(self, heights: np.ndarray, zone_size: float) -> float:
        """Simpson 2D avec interpolation bicubique"""
        n = heights.shape[0]
        x_old = np.linspace(0, (n-1)*zone_size, n)
        y_old = np.linspace(0, (n-1)*zone_size, n)
        f = interpolate.RectBivariateSpline(x_old, y_old, heights)

        # grille impaire (Simpson)
        x_new = np.linspace(0, (n-1)*zone_size, n+1 if n%2==0 else n)
        y_new = np.linspace(0, (n-1)*zone_size, n+1 if n%2==0 else n)
        H = f(x_new, y_new)

        dx = x_new[1]-x_new[0]; dy = y_new[1]-y_new[0]
        wx = np.array([1,4]+[2,4]*((len(x_new)-3)//2)+[1])
        wy = np.array([1,4]+[2,4]*((len(y_new)-3)//2)+[1])
        W = np.outer(wy, wx)

        vol = np.sum(H*W)*dx*dy/9.0
        return float(vol)

    def _calculate_volume_spline(self, heights: np.ndarray, zone_size: float) -> float:
        """Spline 2D + intégration adaptative"""
        n = heights.shape[0]
        x = np.linspace(0, (n-1)*zone_size, n)
        y = np.linspace(0, (n-1)*zone_size, n)
        f = interpolate.RectBivariateSpline(x, y, heights)

        def integrand(yv, xv):
            return f(xv, yv)[0,0]

        vol, _ = integrate.dblquad(integrand, 0, (n-1)*zone_size, lambda _:0, lambda _: (n-1)*zone_size)
        return float(vol)


# -------------- quick demo usage --------------
if __name__ == "__main__":
    # simple demo that ties simulator + analyzer (if both files in same dir)
    try:
        from vl53l8ch_raw_simulator import VL53L8CH_RawSimulator
    except Exception:
        print("Place vl53l8ch_raw_simulator.py next to analyzer to demo.")
        raise
    sim = VL53L8CH_RawSimulator(resolution=32, zone_size_mm=6.25, n_bins=128)
    raw = sim.simulate_measurement(foie_gras_present=True, product_type="normal", include_bins=True)
    analyzer = VL53L8CH_DataAnalyzer()
    report = analyzer.process(raw)
    print("Quality score:", report["quality_score"], "Grade:", report["grade"])
    if MATPLOTLIB_AVAILABLE:
        analyzer.plot_heatmaps(raw, out_prefix="demo")
        analyzer.plot_pixel_histogram(raw, raw["meta"]["resolution"]//2, raw["meta"]["resolution"]//2)
