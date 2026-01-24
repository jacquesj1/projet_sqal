# vl53l8ch_raw_simulator.py
"""
VL53L8CH RAW SIMULATOR
- Génère données brutes cohérentes:
  distance_matrix (res x res) [mm],
  reflectance_matrix (%) [0..100],
  amplitude_matrix (u.a.),
  ambient_matrix (u.a.),
  bins_matrix (res x res x n_bins).
- Simule un demi-ellipsoïde (foie gras) avec dimensions réalistes,
  défauts (foreign body, deformation, edge damage), et bruit sensoriel.
- Fournit un USER_GUIDE expliquant les échelles.
"""

from typing import Dict, Optional, Tuple, Any, List
import numpy as np
import random
import os
import time
import math
import json

from scipy import signal, stats, interpolate, integrate

# Optional imports (scipy: gaussian filter & signal)
try:
    from scipy.ndimage import gaussian_filter
except Exception:
    gaussian_filter = None

try:
    from scipy import signal as scipy_signal
    find_peaks = scipy_signal.find_peaks
except Exception:
    scipy_signal = None
    def find_peaks(arr, height=None):
        # fallback naive peaks: local maxima comparing neighbors
        peaks = []
        for i in range(1, len(arr)-1):
            if arr[i] > arr[i-1] and arr[i] > arr[i+1]:
                if height is None or arr[i] >= height:
                    peaks.append(i)
        return np.array(peaks), {}

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D  # noqa: F401

# -----------------------
# DATA STRUCTURES
# -----------------------
# Classes ToFStatistics et BinsAnalysis sont définies dans vl53l8ch_data_analyzer.py

# ------------------ USER GUIDE ------------------
USER_GUIDE = {
    "Distance_matrix (mm)": (
        "Profondeur mesurée en millimètres.\n"
        "  - Plus la valeur est basse → produit épais ou proche du capteur.\n"
        "  - Plus la valeur est haute → produit fin ou éloigné."
    ),
    "Reflectance (%)": (
        "Proportion de lumière renvoyée par la surface.\n"
        "  - Faible → surface absorbante (mauvaise texture, brûlure, sang séché).\n"
        "  - Élevée → surface brillante (gras, zones humides)."
    ),
    "Amplitude (u.a.)": (
        "Intensité brute du signal ToF (unités arbitraires).\n"
        "  - Corrélée à la consistance et à la réflectance.\n"
        "  - Trop faible → perte de fiabilité.\n"
        "  - Trop forte → saturation possible."
    ),
    "CNH bins (0–35)": (
        "Histogramme de temps de vol (36 bins).\n"
        "Chaque bin correspond à ~37.5 mm (selon datasheet ST).\n"
        "  - Pic étroit → surface homogène.\n"
        "  - Pic large → rugosité ou diffusion.\n"
        "  - Multi-pics → couches multiples, défauts internes ou objets parasites."
    ),
    "Texture_score": (
        "Entropie normalisée du signal.\n"
        "  - Mesure l’hétérogénéité locale.\n"
        "  - Plus la valeur est haute → texture irrégulière."
    ),
    "Density_score": (
        "Aire sous l’histogramme CNH.\n"
        "  - Corrélé à la densité matière ou à la compacité.\n"
        "  - Faible → vide, zone molle ou défaut de structure.\n"
        "  - Élevée → matière dense, bien formée."
    )
}

def _maybe_gaussian_filter(arr, sigma):
    if gaussian_filter is not None:
        return gaussian_filter(arr, sigma=sigma)
    # fallback simple smoothing (convolution)
    if False:
        from scipy import signal as _sig
    # simple local mean as fallback:
    kernel = np.ones((3,3)) / 9.0
    try:
        from scipy.signal import convolve2d
        return convolve2d(arr, kernel, mode='same', boundary='symm')
    except Exception:
        # naive fallback: return arr (no smoothing)
        return arr

# ------------------ RAW SIMULATOR CLASS ------------------
class VL53L8CH_RawSimulator:
    def __init__(self,
                 resolution: int = 32,
                 zone_size_mm: float = 25,
                 zone_size_x_mm: Optional[float] = None,
                 zone_size_y_mm: Optional[float] = None,
                 product_length_mm: Optional[float] = None,
                 product_width_mm: Optional[float] = None,
                 product_margin_percent: float = 15.0,
                 container_mode: bool = False,
                 container_length_mm: Optional[float] = None,
                 container_width_mm: Optional[float] = None,
                 container_height_mm: float = 5.0,
                 height_sensor_mm: float = 100.0,
                 n_bins: int = 128,
                 bin_size_mm: float = 37.5,
                 multi_echo_prob=0.18,
                 reflectance_threshold=30,
                 noise_factor_low_reflect=0.06,
                 noise_factor_high_reflect=0.03,
                 random_seed: Optional[int] = None):
        """
        resolution: grid size (resolution x resolution)
        zone_size_mm: physical size of one pixel in mm (used if zone_size_x/y not specified)
        zone_size_x_mm: physical size of one pixel in X direction (overrides zone_size_mm)
        zone_size_y_mm: physical size of one pixel in Y direction (overrides zone_size_mm)
        product_length_mm: product length (X direction) - enables dynamic adaptation
        product_width_mm: product width (Y direction) - enables dynamic adaptation
        product_margin_percent: margin around product in percent (default 15% = 85% fill)
        container_mode: if True, simulate product in a container (barquette)
        container_length_mm: container length (if None, uses grid coverage)
        container_width_mm: container width (if None, uses grid coverage)
        container_height_mm: container height/thickness (default 5mm)
        height_sensor_mm: sensor reference height (mm)
        n_bins: number of TOF temporal bins per pixel
        bin_size_mm: mm represented by one bin (datasheet ~37.5 mm)

        DYNAMIC ADAPTATION:
        If product_length_mm and product_width_mm are provided, zone_size_x_mm and
        zone_size_y_mm are automatically calculated to provide optimal coverage:
          zone_size_x_mm = product_length_mm / resolution
          zone_size_y_mm = product_width_mm / resolution

        PRODUCT MARGIN:
        The product_margin_percent creates safety margins around the ellipsoid:
          - 15% margin = product uses 85% of grid (recommended for rotation)
          - 0% margin = product fills 100% of grid (no rotation tolerance)
          - 25% margin = product uses 75% of grid (very safe, good for alignment issues)

        CONTAINER MODE:
        When container_mode=True, the simulator generates a barquette/container:
          - Container dimensions: container_length_mm x container_width_mm
          - Product is placed in the center of the container
          - Different reflectance for container (plastic) vs product (organic)
          - Example: Foie gras (200x100mm) in barquette (300x180mm)
        """
        self.resolution = int(resolution)
        self.product_margin_percent = float(product_margin_percent)

        # Container mode configuration
        self.container_mode = bool(container_mode)
        self.container_height_mm = float(container_height_mm)

        # Dynamic adaptation: calculate pixel sizes from container or product dimensions
        if container_mode and container_length_mm is not None and container_width_mm is not None:
            # Grid covers the entire container (barquette)
            self.zone_size_x = float(container_length_mm) / self.resolution
            self.zone_size_y = float(container_width_mm) / self.resolution
            self.container_length = float(container_length_mm)
            self.container_width = float(container_width_mm)
            self.target_product_length = float(product_length_mm) if product_length_mm else container_length_mm * 0.67
            self.target_product_width = float(product_width_mm) if product_width_mm else container_width_mm * 0.56
            print(f"[CONTAINER MODE] Barquette {container_length_mm}x{container_width_mm}mm")
            print(f"  -> Product: {self.target_product_length:.0f}x{self.target_product_width:.0f}mm")
            print(f"  -> Pixel size: {self.zone_size_x:.2f}x{self.zone_size_y:.2f}mm")
            print(f"  -> Grid coverage: {self.zone_size_x * self.resolution:.1f}x{self.zone_size_y * self.resolution:.1f}mm")
        elif product_length_mm is not None and product_width_mm is not None:
            # Grid covers just the product
            self.zone_size_x = float(product_length_mm) / self.resolution
            self.zone_size_y = float(product_width_mm) / self.resolution
            self.target_product_length = float(product_length_mm)
            self.target_product_width = float(product_width_mm)
            self.container_length = None
            self.container_width = None
            print(f"[DYNAMIC ADAPTATION] Product {product_length_mm}x{product_width_mm}mm")
            print(f"  -> Pixel size: {self.zone_size_x:.2f}x{self.zone_size_y:.2f}mm")
            print(f"  -> Grid coverage: {self.zone_size_x * self.resolution:.1f}x{self.zone_size_y * self.resolution:.1f}mm")
            print(f"  -> Product margin: {self.product_margin_percent:.0f}% (ellipsoid uses {100-self.product_margin_percent:.0f}% of grid)")
        else:
            # Manual configuration or backward compatibility
            self.zone_size_x = float(zone_size_x_mm) if zone_size_x_mm is not None else float(zone_size_mm)
            self.zone_size_y = float(zone_size_y_mm) if zone_size_y_mm is not None else float(zone_size_mm)
            self.target_product_length = None
            self.target_product_width = None
            self.container_length = None
            self.container_width = None

        self.zone_size = self.zone_size_x  # For backward compatibility

        self.height_sensor = float(height_sensor_mm)
        self.n_bins = int(n_bins)
        self.bin_size_mm = float(bin_size_mm)

         # ⚙️ Paramètres réglables
        self.multi_echo_prob = multi_echo_prob
        self.reflectance_threshold = reflectance_threshold
        self.noise_factor_low_reflect = noise_factor_low_reflect
        self.noise_factor_high_reflect = noise_factor_high_reflect

        if random_seed is not None:
            random.seed(random_seed)
            np.random.seed(random_seed)

        self.user_guide = {
            "distance_matrix(mm)": "Depth measured from sensor plane. lower distance => thicker product (closer).",
            "reflectance(%)": "Proportion of light reflected. low -> dark/absorbing; high -> bright/greasy.",
            "amplitude(u.a.)": "Signal amplitude ~ reflectance × 1/distance^2.",
            "bins(n_bins)": f"Time-of-flight histogram per zone; bin width ~ {self.bin_size_mm} mm converted to time. multi-peak = multi-echos.",
            "texture_score": "Normalized entropy of histogram -> higher = rougher.",
            "density_score": "Area under histogram -> correlates to material density."
        }

    def simulate_measurement(self,
                             foie_gras_present: bool = True,
                             product_type: str = "normal",
                             shape: str = "ellipsoid",
                             include_bins: bool = True,
                             defects: Optional[Dict[str, Dict]] = None,
                             ambient_light_level: Optional[float] = None,
                             seed: Optional[int] = None) -> Dict[str, Any]:
        """
        Retourne un dict avec les matrices brutes et méta.
        defects: mapping of defect_type -> params, e.g.
          {"foreign_body": {"position": (16,16), "radius":2, "height_change": -20}, ...}
        """
        if defects is None:
            defects = self.generate_random_defects(self.resolution)
            print (defects)

        t0 = time.time()

        # 1) distance matrix (mm)
        distance_matrix = self._generate_distance_matrix(
            foie_gras_present=foie_gras_present, 
            defects=defects, 
            product_type=product_type, 
            shape=shape
            )

        # 2) reflectance matrix (%) coherent with foie gras
        reflectance_matrix = self._generate_reflectance_matrix(
            defects=defects,
            product_type=product_type
        )

        # 3) ambient matrix
        ambient_marix = self._generate_ambient_matrix(ambient_light_level)

        # 4) amplitude matrix (function of reflectance and distance)
        amplitude_matrix = self._generate_amplitude_matrix(distance_matrix, reflectance_matrix)

        # 5) bins (histograms) per pixel
        bins_matrix = None
        if include_bins:
            bins_matrix = self._generate_bins_cube(
                distances=distance_matrix,
                reflectance=reflectance_matrix,
                amplitude=amplitude_matrix,
                defects=defects
            )

        meta = {
            "timestamp": t0,
            "height_sensor_mm": self.height_sensor,
            "resolution": self.resolution,
            "zone_size_mm": self.zone_size,
            "zone_size_x_mm": self.zone_size_x,
            "zone_size_y_mm": self.zone_size_y,
            "grid_coverage_x_mm": self.zone_size_x * self.resolution,
            "grid_coverage_y_mm": self.zone_size_y * self.resolution,
            "n_bins": self.n_bins,
            "bin_size_mm": self.bin_size_mm,
            "ellipsoid_dimensions": getattr(self, '_ellipsoid_dims', None),
            "user_guide": USER_GUIDE
        }

        out = {
            "distance_matrix": distance_matrix,
            "reflectance_matrix": reflectance_matrix,
            "amplitude_matrix": amplitude_matrix,
            "ambient_matrix": ambient_marix,
            "bins_matrix": bins_matrix,
            "defects": defects,
            "meta": meta
        }

        return out

    def generate_random_defects(self,res: int) -> Dict[str, Dict]:
        """Génère un dictionnaire de défauts réalistes pour simuler un foie gras."""
        defects = {}

        # Défaut mécanique : corps étranger incrusté
        if random.random() < 0.2:  # 20% de chance
            defects["foreign_body"] = {
                "position": (random.randint(res//4, 3*res//4),
                            random.randint(res//4, 3*res//4)),
                "radius": random.randint(1, 2),
                "height_change": -random.uniform(10, 25)  # creux dû à l’intrus
            }

        # Défaut mécanique : déformation locale
        if random.random() < 0.25:
            defects["deformation"] = {
                "position": (random.randint(2, res-3), random.randint(2, res-3)),
                "radius": random.randint(1, 3),
                "depth": random.uniform(5, 15)
            }

        # Défaut mécanique : bord abîmé
        if random.random() < 0.15:
            defects["edge_damage"] = {
                "severity": random.uniform(0.3, 0.8)
            }

        # Défaut optique : variation de réflectance
        if random.random() < 0.3:
            defects["optical_inconsistency"] = {
                "position": (random.randint(res//4, 3*res//4),
                            random.randint(res//4, 3*res//4)),
                "radius": random.randint(1, 2),
                "change": random.uniform(-30, -15)  # baisse de réflectance
            }

        return defects


    # ---------------- generate distance (ellipsoid) ----------------
    def _generate_distance_matrix(self, foie_gras_present: bool, defects: Optional[Dict], product_type: str, shape: str) -> np.ndarray:
        res = self.resolution
        if not foie_gras_present:
            return np.full((res, res), self.height_sensor, dtype=float)

        # Calculate grid coverage
        grid_length_mm = res * self.zone_size_x
        grid_width_mm = res * self.zone_size_y

        # Apply margin to get actual ellipsoid size
        margin_factor = (100.0 - self.product_margin_percent) / 100.0

        # If dynamic adaptation is used, scale from target product dimensions
        if self.target_product_length is not None and self.target_product_width is not None:
            # Use target dimensions with margin
            base_length = self.target_product_length * margin_factor
            base_width = self.target_product_width * margin_factor
            Rx_mm = base_length / 2.0
            Ry_mm = base_width / 2.0
            Rz_mm = 80.0  # Default height
        else:
            # Legacy: use grid-based sizing with margin
            base_length = grid_length_mm * margin_factor
            base_width = grid_width_mm * margin_factor
            Rx_mm = base_length / 2.0
            Ry_mm = base_width / 2.0
            Rz_mm = 80.0

        # Apply product type variations
        if product_type == "normal":
            var_sigma = 0.8
        elif product_type == "irregular":
            Rx_mm = Rx_mm * random.uniform(0.9, 1.1)
            Ry_mm = Ry_mm * random.uniform(0.9, 1.1)
            Rz_mm = random.uniform(50, 75)
            var_sigma = 1.6
        else:  # defective
            Rx_mm = Rx_mm * random.uniform(0.8, 1.0)
            Ry_mm = Ry_mm * random.uniform(0.8, 1.0)
            Rz_mm = random.uniform(35, 70)
            var_sigma = 2.5

        # Store ellipsoid dimensions for metadata
        self._ellipsoid_dims = {
            "semi_axis_x_mm": Rx_mm,
            "semi_axis_y_mm": Ry_mm,
            "semi_axis_z_mm": Rz_mm,
            "length_mm": 2 * Rx_mm,
            "width_mm": 2 * Ry_mm,
            "height_mm": Rz_mm
        }

        # physical grid coverage in mm (support rectangular pixels)
        half_x = (res * self.zone_size_x) / 2.0
        half_y = (res * self.zone_size_y) / 2.0
        x_phys = np.linspace(-half_x, half_x, res)
        y_phys = np.linspace(-half_y, half_y, res)
        Xphys, Yphys = np.meshgrid(x_phys, y_phys)

        # Ellipsoid coordinates are already in physical mm (no additional scaling needed)
        Xs = Xphys
        Ys = Yphys

        # rotation
        angle = np.pi/4 + random.uniform(-np.pi/8, np.pi/8)
        Xr = Xs * math.cos(angle) - Ys * math.sin(angle)
        Yr = Xs * math.sin(angle) + Ys * math.cos(angle)

        # Generate ellipsoid (product) surface
        dist_norm = (Xr / Rx_mm) ** 2 + (Yr / Ry_mm) ** 2
        heights_mm = np.zeros_like(dist_norm)
        product_mask = dist_norm <= 1.0
        heights_mm[product_mask] = Rz_mm * np.sqrt(np.clip(1.0 - dist_norm[product_mask], 0.0, 1.0))

        # variations / texture on product
        variations = np.random.normal(0.0, var_sigma, size=(res, res))
        if gaussian_filter is not None:
            variations = gaussian_filter(variations, sigma=0.8 * max(1, res/16))
        heights_mm[product_mask] += variations[product_mask]
        heights_mm[product_mask] += (np.sin(Xr / 10.0) * np.cos(Yr / 10.0) * Rz_mm * 0.03)[product_mask]

        # Container mode: add barquette surface around product
        if self.container_mode:
            # Container is flat at container_height_mm above the conveyor
            container_mask = ~product_mask  # Everywhere outside the product
            heights_mm[container_mask] = self.container_height_mm

            # Store mask for reflectance generation
            self._product_mask = product_mask
            self._container_mask = container_mask
        else:
            self._product_mask = product_mask
            self._container_mask = None

        distances = self.height_sensor - heights_mm

        # Apply defects (indices are grid coordinates)
        if defects:
            for defect_type, params in defects.items():
                if defect_type == "foreign_body":
                    pos = params.get("position", (res//2, res//2))
                    radius = params.get("radius", 1)
                    height_change = params.get("height_change", -20)
                    self._add_circular_defect(distances, pos, radius, height_change)
                elif defect_type == "deformation":
                    pos = params.get("position", (res//2-1, res//2+1))
                    radius = params.get("radius", 2)
                    depth = params.get("depth", 8)
                    self._add_circular_defect(distances, pos, radius, depth)
                elif defect_type == "edge_damage":
                    # approximate: reduce heights near mask boundary -> increase distances
                    self._add_edge_damage(distances, product_mask, severity=params.get("severity", 0.6))

        # clamp
        return np.clip(distances, 0.0, self.height_sensor).astype(float)

    def _add_circular_defect(self, arr: np.ndarray, position: Tuple[int,int], radius: float, height_change: float):
        ci, cj = int(position[0]), int(position[1])
        res = self.resolution
        r = float(radius)
        for i in range(max(0, ci-int(r)-1), min(res, ci+int(r)+2)):
            for j in range(max(0, cj-int(r)-1), min(res, cj+int(r)+2)):
                d = math.sqrt((i-ci)**2 + (j-cj)**2)
                if d <= r:
                    fade = 1.0 - (d / (r + 1e-9))
                    arr[i,j] += height_change * fade

    def _add_edge_damage(self, distances: np.ndarray, mask: np.ndarray, severity: float = 0.5):
        # push up distances near edge of mask
        res = self.resolution
        for i in range(res):
            for j in range(res):
                if mask[i,j]:
                    # compute border proximity: if any neighbor is False => close to edge
                    neighbors = [(i-1,j),(i+1,j),(i,j-1),(i,j+1)]
                    close = any(0 <= ni < res and 0 <= nj < res and not mask[ni,nj] for ni,nj in neighbors)
                    if close and random.random() < severity:
                        distances[i,j] += random.uniform(5.0, 20.0)

    # ---------------- reflectance matrix ----------------
    def _generate_reflectance_matrix(self, defects: Optional[Dict], product_type: str) -> np.ndarray:
        res = self.resolution
        mat = np.zeros((res, res), dtype=float)

        # Container mode: different reflectance for product vs container
        if self.container_mode and hasattr(self, '_product_mask') and hasattr(self, '_container_mask'):
            # Product (foie gras): organic, lower reflectance (50-60%)
            if product_type == "normal":
                product_base = random.uniform(50.0, 60.0)
                product_sigma = 4.0
            elif product_type == "irregular":
                product_base = random.uniform(45.0, 60.0)
                product_sigma = 6.0
            else:
                product_base = random.uniform(35.0, 60.0)
                product_sigma = 8.0

            # Container (plastic barquette): more reflective (65-80%)
            container_base = random.uniform(65.0, 80.0)
            container_sigma = 3.0

            # Generate separate reflectance for each zone
            product_reflectance = np.random.normal(loc=product_base, scale=product_sigma, size=(res, res))
            container_reflectance = np.random.normal(loc=container_base, scale=container_sigma, size=(res, res))

            # Combine using masks
            mat[self._product_mask] = product_reflectance[self._product_mask]
            mat[self._container_mask] = container_reflectance[self._container_mask]

        else:
            # Legacy mode: uniform reflectance (foie gras only)
            if product_type == "normal":
                base = random.uniform(50.0, 60.0)
                sigma = 4.0
            elif product_type == "irregular":
                base = random.uniform(45.0, 60.0)
                sigma = 6.0
            else:
                base = random.uniform(35.0, 60.0)
                sigma = 8.0

            mat = np.random.normal(loc=base, scale=sigma, size=(res, res))
            # barquette edges slightly more reflective (legacy)

        # Application défauts optiques
        if defects and "optical_inconsistency" in defects:
            df = defects["optical_inconsistency"]
            pos = df.get("position", (res//2, res//2))
            radius = df.get("radius", 1)
            change = df.get("change", -25)
            self._add_reflectance_defect(mat, pos, radius, change)

        return np.clip(mat, 0.0, 100.0).astype(float)

    def _add_reflectance_defect(self, mat: np.ndarray, pos: Tuple[int,int], radius: float, change: float):
        ci, cj = int(pos[0]), int(pos[1])
        res = self.resolution
        r = float(radius)
        for i in range(max(0, ci-int(r)-1), min(res, ci+int(r)+2)):
            for j in range(max(0, cj-int(r)-1), min(res, cj+int(r)+2)):
                d = math.sqrt((i-ci)**2 + (j-cj)**2)
                if d <= r:
                    fade = 1.0 - (d / (r + 1e-9))
                    mat[i,j] += change * fade

    # ---------------- amplitude matrix ----------------
    def _generate_amplitude_matrix(self, distances: np.ndarray, reflectances: np.ndarray) -> np.ndarray:
        # amplitude ~ reflectance * (1 / distance^2) scaled
        res = self.resolution
        amp = np.zeros((res, res), dtype=float)
        with np.errstate(divide='ignore', invalid='ignore'):
            # Avoid blow-ups when distance is too small while preserving inverse-square relation
            d = np.maximum(distances.astype(float), 50.0)
            amp = (reflectances / 100.0) * (self.height_sensor / (d + 1e-6))**2 * 12.0
        noise = np.random.normal(0.0, 8.0, size=(res, res))
        amp += noise
        amp = np.clip(amp, 0.0, 4095.0)
        return amp

    # ---------------- ambient ----------------
    def _generate_ambient_matrix(self, ambient_light_level: Optional[float]) -> np.ndarray:
        res = self.resolution
        if ambient_light_level is None:
            base = random.uniform(50.0, 200.0)
        else:
            base = float(ambient_light_level)
        mat = np.random.normal(loc=base, scale=10.0, size=(res, res))
        return np.clip(mat, 0.0, None)

    # ---------------- Simulation CNH optimisée ----------------
    def _generate_zone_histogram(self, distance: float, reflectance: float, amplitude: float,
                             defects: Optional[Dict]) -> np.ndarray:
        """
        Génère un histogramme (n_bins) pour UNE zone ToF (pixel ou zone CNH).
        
        Args:
            distance: distance mesurée (mm)
            reflectance: réflectance associée (0-100 %)
            amplitude: amplitude signal brute
            defects: dictionnaire de défauts optionnels
        
        Returns:
            hist: np.ndarray shape (n_bins,)
        """
        n = self.n_bins
        bin_size = self.bin_size_mm
        idx = np.arange(n)

        # ✅ Calcul du bin principal à partir de la distance
        peak_bin = int(np.clip(distance / bin_size, 0, n - 1))

        # Largeur gaussienne (sigma) dépend de la rugosité et de la réflectance
        sigma = max(1.0, 1.0 + (50.0 - min(reflectance, 50.0)) / 25.0 + random.uniform(-0.3, 1.0))

        # Amplitude effective (réduit si faible réflectance)
        amp_eff = max(5.0, amplitude * (0.1 + reflectance / 200.0))

        # ✅ Pic principal (distribution gaussienne centrée sur peak_bin)
        hist = amp_eff * np.exp(-0.5 * ((idx - peak_bin) / sigma) ** 2)

        # ✅ Multi-écho (2ᵉ pic possible)
        if random.random() < self.multi_echo_prob:   # ex: 0.18 par défaut
            sec_bin = int(np.clip(peak_bin + random.randint(1, max(1, int(n * 0.06))), 0, n - 1))
            amp2 = amp_eff * random.uniform(0.1, 0.6)
            sigma2 = sigma * random.uniform(1.0, 2.0)
            hist += amp2 * np.exp(-0.5 * ((idx - sec_bin) / sigma2) ** 2)

        # ✅ Ajustement bruit & réflectance
        if reflectance < self.reflectance_threshold:  # ex: 30 %
            hist *= 0.6
            hist += np.random.normal(0.0, amp_eff * self.noise_factor_low_reflect, size=n)
        else:
            hist += np.random.normal(0.0, amp_eff * self.noise_factor_high_reflect, size=n)

        # ✅ Défauts simulés
        if defects:
            for dt, params in defects.items():
                pos = params.get("position")
                if pos:
                    # Ici, on ne sait pas (i,j), donc appliquer probabilité générique
                    if random.random() < 0.2:
                        if dt == "foreign_body":
                            # pic parasite proche
                            close_bin = max(0, peak_bin - random.randint(2, 6))
                            hist += amp_eff * 0.5 * np.exp(-0.5 * ((idx - close_bin) / max(1, sigma * 0.5)) ** 2)
                        elif dt == "texture_variation":
                            hist = np.convolve(hist, [0.2, 0.6, 0.2], mode='same')

        return np.clip(hist, 0.0, None)

    # ---------------- generate bins cube ----------------
    def _generate_bins_cube(self, distances: np.ndarray, reflectance: np.ndarray, amplitude: np.ndarray, defects: Optional[Dict]) -> np.ndarray:
        """
        Génère un cube (res,res,n_bins) où chaque pixel (i,j) contient un histogramme 1D cohérent :
        - Pic principal corrélé à la distance : peak_bin ≈ distance/bin_size_mm
        - Largeur du pic (sigma) dépend de la réflectance (faible réflectance => pic plus large)
        - Multi-échos simulés (reflets secondaires)
        - Défauts : corps étrangers, texture variable
        - Ajout de bruit réaliste par pixel
        """
        res = self.resolution
        n = self.n_bins
        bin_size = self.bin_size_mm
        cube = np.zeros((res, res, n), dtype=float)

        if res==8:
            for i in range(res):
                for j in range(res):
                    hist = self._generate_zone_histogram(distances[i, j],
                                                            reflectance[i, j],
                                                            amplitude[i, j],
                                                            defects)
                    cube[i, j, :] = hist
            return cube
        elif res ==32:
            cnh_matrix = np.zeros((32, self.n_bins), dtype=float)
            for zone_id in range(32):
                zone_i = zone_id // 4
                zone_j = 2 * (zone_id % 4)
                if zone_i < 8 and zone_j + 1 < 8:
                    d = np.mean([distances[zone_i, zone_j], distances[zone_i, zone_j+1]])
                    r = np.mean([reflectance[zone_i, zone_j], reflectance[zone_i, zone_j+1]])
                    a = np.mean([amplitude[zone_i, zone_j], amplitude[zone_i, zone_j+1]])
                    hist = self._generate_zone_histogram(d, r, a, defects)
                    cnh_matrix[zone_id, :] = hist
            return cnh_matrix
        else:
            raise ValueError(f"Resolution {self.resolution} non supportée")

    # ---------------- utility to jsonify (convert numpy to lists) ----------------
    @staticmethod
    def to_json_compatible(raw: Dict[str, Any]) -> Dict[str, Any]:

        out = {}
        for k,v in raw.items():
            if isinstance(v, np.ndarray):
                out[k] = v.tolist()
            else:
                out[k] = v
        # meta likely contains numpy? keep as-is
        return out

    # -----------------------
    # Visualizations (save to files)
    # -----------------------
    def visualize_all(self, sample: Dict, outdir: str = "./sim_outputs", prefix: str = "sim"):
        """
        Create and save:
         - 3D surface (distances -> height)
         - two cross-section plots (mid X, mid Y)
         - heatmaps for distance, reflectance, amplitude, ambient
         - grid of a few bins (first 16) heatmaps
        """
        os.makedirs(outdir, exist_ok=True)
        timestamp = int(time.time()*1000)
        base = os.path.join(outdir, f"{prefix}_{timestamp}")

        dist = sample["distance_matrix"]
        refl = sample["reflectance_matrix"]
        amp = sample["amplitude_matrix"]
        amb = sample["ambient_matrix"]
        cube = sample.get("bins_matrix", None)

        # 3D surface
        fig = plt.figure(figsize=(10,8))
        ax = fig.add_subplot(111, projection='3d')
        x = np.linspace(0, self.resolution-1, self.resolution) * self.zone_size_x
        y = np.linspace(0, self.resolution-1, self.resolution) * self.zone_size_y
        X, Y = np.meshgrid(x, y)
        Z = self.height_sensor - dist  # height of product
        surf = ax.plot_surface(X, Y, Z, cmap='viridis', edgecolor='k', linewidth=0.3)
        fig.colorbar(surf, ax=ax, label='Height (mm)')
        ax.set_xlabel('X (mm)'); ax.set_ylabel('Y (mm)'); ax.set_zlabel('Height (mm)')
        ax.set_title('3D surface (product height)')
        fn3d = base + "_3d.png"
        plt.tight_layout()
        plt.savefig(fn3d, dpi=150, bbox_inches='tight')
        plt.close(fig)

        # two cross sections (middle row and middle col)
        mid = self.resolution // 2
        fig, ax = plt.subplots(1,2, figsize=(12,4))
        ax[0].plot(x, self.height_sensor - dist[mid,:])
        ax[0].set_title(f'X-slice (row={mid})'); ax[0].set_xlabel('X (mm)'); ax[0].set_ylabel('Height (mm)')
        ax[1].plot(y, self.height_sensor - dist[:,mid])
        ax[1].set_title(f'Y-slice (col={mid})'); ax[1].set_xlabel('Y (mm)'); ax[1].set_ylabel('Height (mm)')
        fn_slice = base + "_slices.png"
        plt.tight_layout(); plt.savefig(fn_slice, dpi=150); plt.close(fig)

        # heatmaps: dist (height), reflectance, amplitude, ambient
        mats = [("height_mm", self.height_sensor - dist), ("reflectance_pct", refl), ("amplitude", amp), ("ambient", amb)]
        fig, axs = plt.subplots(2,2, figsize=(10,8))
        for ax, (title, mat) in zip(axs.flatten(), mats):
            im = ax.imshow(mat, origin='lower', extent=(0, x[-1], 0, y[-1]))
            ax.set_title(title)
            fig.colorbar(im, ax=ax, fraction=0.046, pad=0.02)
        fn_hm = base + "_heatmaps.png"
        plt.tight_layout(); plt.savefig(fn_hm, dpi=150); plt.close(fig)

        # bins grid (first 16 bins averaged into heatmaps)
        if cube is not None:
            # show first 16 bin layers as a grid
            nshow = min(16, self.n_bins)
            rows = int(np.ceil(np.sqrt(nshow)))
            cols = rows
            fig = plt.figure(figsize=(cols*3, rows*3))
            for k in range(nshow):
                ax = fig.add_subplot(rows, cols, k+1)
                im = ax.imshow(cube[:,:,k], origin='lower', extent=(0,x[-1], 0, y[-1]))
                ax.set_title(f'bin {k}')
            fn_bins = base + "_bins_grid.png"
            plt.tight_layout(); plt.savefig(fn_bins, dpi=150); plt.close(fig)

        return {
            "3d": fn3d,
            "slices": fn_slice,
            "heatmaps": fn_hm,
            "bins_grid": (fn_bins if cube is not None else None)
        }

    def visualize_extra(self, sample: Dict, outdir="./sim_outputs", prefix="sim_extra"):
        
        import plotly.graph_objects as go
        import os
        os.makedirs(outdir, exist_ok=True)
        timestamp = int(time.time()*1000)
        base = os.path.join(outdir, f"{prefix}_{timestamp}")

        dist = sample["distance_matrix"]
        refl = sample["reflectance_matrix"]
        cube = sample.get("bins_matrix", None)

        # 1) Wireframe 3D
        from mpl_toolkits.mplot3d import Axes3D
        fig = plt.figure(figsize=(8,6))
        ax = fig.add_subplot(111, projection='3d')
        x = np.linspace(0, self.resolution-1, self.resolution) * self.zone_size_x
        y = np.linspace(0, self.resolution-1, self.resolution) * self.zone_size_y
        X, Y = np.meshgrid(x, y)
        Z = self.height_sensor - dist
        ax.plot_wireframe(X, Y, Z, color="black", linewidth=0.5)
        ax.set_title("Wireframe 3D height")
        fn_wire = base + "_wire3d.png"
        plt.savefig(fn_wire, dpi=150); plt.close(fig)

        # 2) Histogramme global distances
        fig, ax = plt.subplots()
        ax.hist(dist.ravel(), bins=30, color="skyblue")
        ax.set_xlabel("Distance (mm)"); ax.set_ylabel("Count")
        ax.set_title("Distribution of distances")
        fn_hist_d = base + "_hist_dist.png"
        plt.savefig(fn_hist_d, dpi=150); plt.close(fig)

        # 3) Histogramme global reflectance
        fig, ax = plt.subplots()
        ax.hist(refl.ravel(), bins=30, color="orange")
        ax.set_xlabel("Reflectance (%)"); ax.set_ylabel("Count")
        ax.set_title("Distribution of reflectance")
        fn_hist_r = base + "_hist_refl.png"
        plt.savefig(fn_hist_r, dpi=150); plt.close(fig)

        # 4) Courbe de bins pour un pixel central
        if cube is not None:
            i = self.resolution//2
            j = self.resolution//2
            hist = cube[i,j,:]
            fig, ax = plt.subplots()
            ax.plot(hist, color="red")
            ax.set_xlabel("Bin index"); ax.set_ylabel("Intensity")
            ax.set_title(f"ToF histogram pixel ({i},{j})")
            fn_hist_bin = base + "_bin_curve.png"
            plt.savefig(fn_hist_bin, dpi=150); plt.close(fig)
        else:
            fn_hist_bin = None

        return {"wireframe": fn_wire, "hist_dist": fn_hist_d, "hist_refl": fn_hist_r, "bin_curve": fn_hist_bin}

    def visualize_plotly(self, sample: Dict, out_html="./sim_outputs/plotly_surface.html"):
        import plotly.graph_objects as go

        # Ensure output directory exists
        out_dir = os.path.dirname(out_html)
        if out_dir:
            os.makedirs(out_dir, exist_ok=True)

        dist = sample["distance_matrix"]
        refl = sample["reflectance_matrix"]

        x = np.linspace(0, self.resolution-1, self.resolution) * self.zone_size_x
        y = np.linspace(0, self.resolution-1, self.resolution) * self.zone_size_y
        X, Y = np.meshgrid(x, y)
        Z = self.height_sensor - dist

        fig = go.Figure(data=[go.Surface(x=X, y=Y, z=Z, surfacecolor=refl, colorscale="Viridis")])
        fig.update_layout(scene=dict(
            xaxis_title="X (mm)",
            yaxis_title="Y (mm)",
            zaxis_title="Height (mm)"
        ), title="Interactive 3D Surface with Reflectance coloring")
        fig.write_html(out_html)
        return out_html

# ---------------- quick demo when run ----------------
if __name__ == "__main__":
    print("\n=== VL53L8CH RAW SIMULATOR - BASIC DEMO ===\n")
    print("Generating raw sensor data and basic visualizations...")

    sim = VL53L8CH_RawSimulator(resolution=8, zone_size_mm=25.0, height_sensor_mm=100.0, n_bins=128, bin_size_mm=37.5)

    # Generate raw data
    raw_data = sim.simulate_measurement(foie_gras_present=True, product_type="normal", include_bins=True, seed=123)
    print("Defects applied:", raw_data["defects"])

    # Basic visualizations (raw data only)
    imgs = sim.visualize_all(raw_data, outdir="./sim_outputs", prefix="test")
    imgs_ex = sim.visualize_extra(raw_data, outdir="./sim_outputs", prefix="test")
    imgs_plotly = sim.visualize_plotly(raw_data)
    print("Images saved:", imgs)

    print("\n" + "="*60)
    print("For advanced demonstrations with analysis and 3D viz,")
    print("run: python demo_foiegras.py")
    print("="*60)