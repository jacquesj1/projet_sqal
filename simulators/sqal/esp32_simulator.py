#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Simulateur ESP32 Complet
Émule un ESP32 avec capteurs I2C (VL53L8CH + AS7341), WiFi, buffer local, reconnexion auto
"""
import asyncio
import websockets
import json
import logging
import time
import random
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional
from collections import deque
from enum import Enum
import numpy as np
# Import simulateur I2C
from i2c_sensors_simulator import I2C_Bus_Simulator, I2C_Address

# Import analyseurs de données de base
from vl53l8ch_data_analyzer import VL53L8CH_DataAnalyzer
from as7341_data_analyzer import AS7341_DataAnalyzer

# Import FoieGrasFusionSimulator pour métriques métier foie gras (corrigé)
from foiegras_fusion_simulator import FoieGrasFusionSimulator

# Import ConfigLoader pour charger config_foiegras.yaml
from config_loader import ConfigLoader

logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class NumpyEncoder(json.JSONEncoder):
    """Encodeur JSON personnalisé pour gérer les types NumPy"""
    def default(self, obj):
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.floating):
            return float(obj)
        if isinstance(obj, np.bool_):
            return bool(obj)
        return super(NumpyEncoder, self).default(obj)


class ESP32_Status(Enum):
    """États possibles de l'ESP32"""
    BOOTING = "booting"
    WIFI_CONNECTING = "wifi_connecting"
    WIFI_CONNECTED = "wifi_connected"
    BACKEND_CONNECTING = "backend_connecting"
    ONLINE = "online"
    OFFLINE = "offline"
    ERROR = "error"


class ESP32_Simulator:
    """
    Simulateur complet d'ESP32 avec capteurs I2C

    Émule:
    - Boot sequence
    - Connexion WiFi
    - Bus I2C + capteurs
    - Buffer local (si offline)
    - Reconnexion auto
    - Heartbeat
    - LEDs status (virtuelles)
    """

    def __init__(
        self,
        device_id: Optional[str] = None,
        mac_address: Optional[str] = None,
        location: str = "Ligne A",
        wifi_ssid: str = "FoieGras-Production",
        backend_url: str = "ws://localhost:8000/ws/sensors/",
        buffer_size: int = 100,
        sampling_rate_hz: float = 1.0,
        config_profile: str = "foiegras_standard_barquette"
    ):
        """
        Args:
            device_id: ID unique ESP32 (généré si None)
            mac_address: MAC address (généré si None)
            location: Position physique (Ligne A/B/C)
            wifi_ssid: SSID WiFi
            backend_url: URL WebSocket backend Django
            buffer_size: Taille buffer local (mesures)
            sampling_rate_hz: Fréquence échantillonnage (Hz)
            config_profile: Profil YAML pour les capteurs I2C
        """
        # Identité
        self.device_id = device_id or f"ESP32-{uuid.uuid4().hex[:8].upper()}"
        self.mac_address = mac_address or self._generate_mac()
        self.location = location
        self.config_profile = config_profile

        # Network
        self.wifi_ssid = wifi_ssid
        self.wifi_ip = None
        self.backend_url = backend_url
        self.websocket = None

        # Reconnexion backend (éviter boucle trop agressive)
        self._last_reconnect_attempt_ts = 0.0
        self._reconnect_min_interval_s = 5.0

        # État
        self.status = ESP32_Status.BOOTING
        self.boot_time = time.time()
        self.last_heartbeat = None
        self.consecutive_errors = 0

        # I2C Bus + capteurs avec configuration YAML
        self.i2c_bus = I2C_Bus_Simulator(config_profile=config_profile)
        logger.info(f"I2C devices: {[f'0x{addr:02X}' for addr in self.i2c_bus.scan()]}")

        # Charger configuration YAML UNE SEULE FOIS
        config_path = Path(__file__).parent / "config_foiegras.yaml"
        self.config_loader = ConfigLoader(str(config_path))
        self.config_loader.load(config_profile)
        self.config = self.config_loader.config
        logger.info(f"Configuration loaded from {config_path}")

        # Analyseurs de données pour produire quality_score, grade, etc.
        profile_config = self.config['profiles'][self.config_loader.current_profile]
        vl53_cfg = profile_config.get('vl53l8ch_analyzer', {})
        self.vl53l8ch_analyzer = VL53L8CH_DataAnalyzer(
            bin_size_mm=profile_config.get('sensor_vl53l8ch', {}).get('bin_size_mm', 37.5),
            texture_threshold=vl53_cfg.get('texture_threshold', 0.30),
            density_threshold=vl53_cfg.get('density_threshold', 3000.0),
            consistency_threshold=vl53_cfg.get('consistency_threshold', 0.6),
            distance_defect_threshold_mm=vl53_cfg.get('distance_defect_threshold_mm', 10.0),
            critical_foreign_body_severity_threshold=vl53_cfg.get('critical_foreign_body_severity_threshold', 0.7),
            defect_penalty_weight=vl53_cfg.get('defect_penalty_weight', 1.0),
        )
        self.as7341_analyzer = AS7341_DataAnalyzer()
        logger.info(f"Data analyzers initialized for {self.device_id}")
        
        # FoieGrasFusionSimulator pour métriques métier foie gras complètes
        # Paramètres par défaut (les analyseurs métier ne dépendent pas des paramètres exacts)
        vl_params = {'resolution': 8, 'zone_size_mm': 37.5, 'height_sensor_mm': 100.0, 'n_bins': 128, 'bin_size_mm': 37.5}
        as_params = {'enabled': True, 'integration_time_ms': 100, 'gain': 8}
        self.fusion_simulator = FoieGrasFusionSimulator(vl53l8ch_params=vl_params, as7341_params=as_params)
        logger.info(f"FoieGrasFusionSimulator initialized with business metrics for {self.device_id}")
        
        # Buffer local (si offline)
        self.buffer = deque(maxlen=buffer_size)
        self.buffer_size = buffer_size

        # Config
        self.sampling_rate_hz = sampling_rate_hz
        self.sampling_interval = 1.0 / sampling_rate_hz

        # Statistiques
        self.stats = {
            'measurements_sent': 0,
            'measurements_buffered': 0,
            'reconnections': 0,
            'i2c_errors': 0,
            'uptime_seconds': 0
        }

        # LEDs virtuelles
        self.leds = {
            'power': True,      # Toujours ON
            'wifi': False,      # ON si WiFi connecté
            'backend': False,   # ON si backend connecté
            'status': 'off'     # off/green/orange/red
        }

        logger.info(f"ESP32 initialized: {self.device_id} @ {self.location}")

    def _generate_mac(self):
        """Génère MAC address Espressif (OUI: 24:0A:C4)"""
        return f"24:0A:C4:{random.randint(0,255):02X}:{random.randint(0,255):02X}:{random.randint(0,255):02X}"

    def _select_quality_profile(self):
        """
        Sélectionne un profil de qualité aléatoire selon les poids définis dans config_foiegras.yaml
        
        Returns:
            dict: Profil sélectionné avec 'name' et 'data'
        """
        try:
            quality_config = self.config['simulation']['quality']
            profiles = list(quality_config.keys())
            weights = [quality_config[p]['weight'] for p in profiles]
            
            # Sélection aléatoire pondérée
            selected = random.choices(profiles, weights=weights, k=1)[0]
            profile_data = quality_config[selected]
            
            logger.debug(f"Selected quality profile: {selected} (weight: {profile_data['weight']})")
            
            return {
                'name': selected,
                'data': profile_data
            }
        except Exception as e:
            logger.warning(f"Failed to select quality profile: {e}, using default 'good'")
            return {
                'name': 'good',
                'data': {
                    'weight': 1.0,
                    'freshness': {'min': 0.75, 'max': 0.95, 'mean': 0.85},
                    'fat_quality': {'min': 0.75, 'max': 0.95, 'mean': 0.85},
                    'oxidation_level': {'min': 0.05, 'max': 0.25, 'mean': 0.15},
                    'surface_uniformity': {'min': 0.75, 'max': 0.90, 'mean': 0.82},
                    'thickness_variation': {'min': 1.5, 'max': 3.5, 'mean': 2.5},
                }
            }

    async def boot_sequence(self):
        """Séquence de boot réaliste"""
        logger.info(f"[{self.device_id}] 🔌 Booting ESP32...")
        self.status = ESP32_Status.BOOTING

        # Simule boot (1-2s)
        await asyncio.sleep(random.uniform(1.0, 2.0))

        # Test I2C devices
        logger.info(f"[{self.device_id}] 🔍 Scanning I2C bus...")
        devices = self.i2c_bus.scan()
        logger.info(f"[{self.device_id}] ✓ Found I2C devices: {[f'0x{d:02X}' for d in devices]}")

        if I2C_Address.VL53L8CH not in devices:
            logger.error(f"[{self.device_id}] ❌ VL53L8CH not found!")
            self.status = ESP32_Status.ERROR
            return False

        if I2C_Address.AS7341 not in devices:
            logger.error(f"[{self.device_id}] ❌ AS7341 not found!")
            self.status = ESP32_Status.ERROR
            return False

        logger.info(f"[{self.device_id}] ✓ All sensors detected")
        return True

    async def connect_wifi(self):
        """Connexion WiFi (simulé)"""
        logger.info(f"[{self.device_id}] 📡 Connecting to WiFi '{self.wifi_ssid}'...")
        self.status = ESP32_Status.WIFI_CONNECTING
        self.leds['wifi'] = False

        # Simule connexion WiFi (2-5s)
        await asyncio.sleep(random.uniform(2.0, 5.0))

        # Générer IP locale
        self.wifi_ip = f"192.168.1.{random.randint(100, 250)}"

        self.status = ESP32_Status.WIFI_CONNECTED
        self.leds['wifi'] = True
        self.leds['status'] = 'green'

        logger.info(f"[{self.device_id}] ✓ WiFi connected | IP: {self.wifi_ip}")
        return True

    async def connect_backend(self):
        """Connexion WebSocket au backend Django"""
        logger.info(f"[{self.device_id}] 🔗 Connecting to backend: {self.backend_url}")
        self.status = ESP32_Status.BACKEND_CONNECTING

        try:
            self.websocket = await asyncio.wait_for(
                websockets.connect(self.backend_url),
                timeout=10.0
            )

            # Attendre confirmation backend
            response = await asyncio.wait_for(
                self.websocket.recv(),
                timeout=5.0
            )
            msg = json.loads(response)
            logger.info(f"[{self.device_id}] ✓ Backend says: {msg.get('message')}")

            # Envoyer hello message
            await self.send_hello()

            self.status = ESP32_Status.ONLINE
            self.leds['backend'] = True
            self.leds['status'] = 'green'

            logger.info(f"[{self.device_id}] ✅ ONLINE - Ready to send data")
            return True

        except asyncio.TimeoutError:
            logger.error(f"[{self.device_id}] ❌ Backend connection timeout")
            self.status = ESP32_Status.OFFLINE
            self.leds['backend'] = False
            self.leds['status'] = 'orange'
            return False

        except Exception as e:
            logger.error(f"[{self.device_id}] ❌ Backend connection failed: {e}")
            self.status = ESP32_Status.OFFLINE
            self.leds['backend'] = False
            self.leds['status'] = 'red'
            return False

    async def send_hello(self):
        """Envoie message HELLO au backend (identification ESP32)"""
        hello_msg = {
            'type': 'esp32_hello',
            'device_id': self.device_id,
            'mac_address': self.mac_address,
            'location': self.location,
            'ip_address': self.wifi_ip,
            'firmware_version': '1.0.0',
            'sensors': {
                'vl53l8ch': '0x29',
                'as7341': '0x39'
            },
            'timestamp': datetime.utcnow().isoformat() + 'Z'
        }
        await self.websocket.send(json.dumps(hello_msg, cls=NumpyEncoder))
        logger.debug(f"[{self.device_id}] → HELLO sent")

    async def read_sensors(self) -> Optional[Dict[str, Any]]:
        """
        Lit capteurs I2C (séquence réaliste)
        Returns:
            dict avec données VL53L8CH + AS7341
        """
        try:
            # 1. Lire VL53L8CH (ToF)
            vl_device = self.i2c_bus.get_device(I2C_Address.VL53L8CH)

            # Start measurement
            self.i2c_bus.write_byte(
                I2C_Address.VL53L8CH,
                vl_device.REG_START_MEASUREMENT,
                0x01
            )

            # Wait data ready (polling)
            timeout = 0.2  # 200ms max
            start = time.time()
            while time.time() - start < timeout:
                data_ready = self.i2c_bus.read_byte(
                    I2C_Address.VL53L8CH,
                    vl_device.REG_DATA_READY
                )
                if data_ready == 0x01:
                    break
                await asyncio.sleep(0.005)  # 5ms

            vl_data = vl_device.read_measurement_data()

            # 2. Lire AS7341 (Spectral)
            as_device = self.i2c_bus.get_device(I2C_Address.AS7341)

            # Start measurement
            self.i2c_bus.write_byte(
                I2C_Address.AS7341,
                as_device.REG_ENABLE,
                0x03
            )

            # Wait data ready
            timeout = 0.15  # 150ms max
            start = time.time()
            while time.time() - start < timeout:
                status = self.i2c_bus.read_byte(
                    I2C_Address.AS7341,
                    as_device.REG_STATUS
                )
                if status & 0x01:
                    break
                await asyncio.sleep(0.005)

            as_data = as_device.read_measurement_data()

            # 3. Ajouter métadonnées ESP32
            if vl_data and as_data:
                vl_data['meta']['device_id'] = self.device_id
                vl_data['meta']['mac_address'] = self.mac_address
                vl_data['meta']['location'] = self.location

                as_data['meta']['device_id'] = self.device_id
                as_data['meta']['mac_address'] = self.mac_address
                as_data['meta']['location'] = self.location

                # 4. Analyser les données brutes pour produire quality_score, grade, etc.
                logger.debug(f"[{self.device_id}] Analyzing raw sensor data...")
                
                # Analyser VL53L8CH (ToF)
                vl_analysis = self.vl53l8ch_analyzer.process(vl_data)
                
                # Analyser AS7341 (Spectral)
                as_analysis = self.as7341_analyzer.process(as_data)
                
                # ✅ Vérifier que les analyses ne sont pas None
                if vl_analysis is None or as_analysis is None:
                    logger.error(f"❌ Analyse échouée: vl_analysis={vl_analysis}, as_analysis={as_analysis}")
                    return None
                #else:
                    #logger.debug(f"✅ Analyse réussie: vl_analysis={vl_analysis}, as_analysis={as_analysis}")
                # Sélectionner un profil de qualité aléatoire
                quality_profile = self._select_quality_profile()
                
                # Créer fusion avec métriques métier foie gras via FoieGrasFusionSimulator (corrigé)
                fusion_result = self.fusion_simulator._fuse_results(
                    tof_analysis=vl_analysis,
                    spectral_analysis=as_analysis,
                    tof_raw=vl_data,
                    spectral_raw=as_data,
                    quality_profile=quality_profile
                )
                
                logger.info(f"[{self.device_id}] Analysis complete: VL Grade={vl_analysis.get('grade')}, AS Grade={as_analysis.get('grade')}, Fusion Grade={fusion_result.get('final_grade')}")

            # Retourner données brutes ET analysées pour le backend

            return {
                'vl53l8ch_raw': vl_data,  # Données brutes VL53L8CH (matrices)
                'vl53l8ch': vl_analysis if vl_data else vl_data,  # Analyse VL53L8CH
                'as7341_raw': as_data,  # Données brutes AS7341 (intensités spectrales)
                'as7341': as_analysis if as_data else as_data,  # Analyse AS7341
                'fusion': fusion_result if vl_data and as_data else {}  # Fusion avec métriques métier
            }

        except IOError as e:
            logger.error(f"[{self.device_id}] I2C error: {e}")
            self.stats['i2c_errors'] += 1
            self.consecutive_errors += 1
            return None

        except Exception as e:
            logger.error(f"[{self.device_id}] Sensor read error: {e}")
            return None

    def _normalize_grade(self, score: float) -> str:
        """
        Normalise le grade en fonction du score selon les règles du backend
        A+     : score >= 0.85
        A      : score 0.75-0.85
        B      : score 0.60-0.75
        C      : score 0.45-0.60
        REJECT : score < 0.45
        """
        if score >= 0.85:
            return "A+"
        elif score >= 0.75:
            return "A"
        elif score >= 0.60:
            return "B"
        elif score >= 0.45:
            return "C"
        else:
            return "REJECT"

    def adapt_for_backend(self, sensor_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Adapte les données du simulateur au format attendu par le backend (schéma Pydantic strict)
        Enrichit les données analysées avec tous les champs manquants requis
        """
        vl_analysis = sensor_data.get('vl53l8ch', {})
        as_analysis = sensor_data.get('as7341', {})
        fusion = sensor_data.get('fusion', {})
        vl_raw = sensor_data.get('vl53l8ch_raw', {})
        as_raw = sensor_data.get('as7341_raw', {})
        
        # 1. Enrichir VL53L8CH Analysis avec champs manquants
        if vl_analysis:
            stats = vl_analysis.get('stats', {})
            
            # Ajouter champs de base depuis stats
            vl_analysis['volume_mm3'] = stats.get('volume_trapezoidal_mm3', stats.get('volume_mm3', 0))
            vl_analysis['base_area_mm2'] = stats.get('base_area_mm2', 0)
            vl_analysis['average_height_mm'] = stats.get('average_height_mm', 0)
            vl_analysis['max_height_mm'] = stats.get('max_height_mm', 0)
            vl_analysis['min_height_mm'] = stats.get('min_height_mm', 0)
            vl_analysis['height_range_mm'] = stats.get('height_range_mm', 0)
            vl_analysis['surface_uniformity'] = stats.get('uniformity', 0.85)
            
            # Ajouter reflectance_analysis
            vl_analysis['reflectance_analysis'] = {
                'avg_reflectance': 150.0,
                'reflectance_uniformity': 0.88,
                'optical_anomalies': []
            }
            
            # Ajouter amplitude_consistency
            vl_analysis['amplitude_consistency'] = {
                'avg_amplitude': 100.0,
                'amplitude_std': 10.0,
                'amplitude_variance': 100.0,
                'signal_stability': 0.92
            }
            
            # Garder les défauts structurés (avec pos/severity) pour la visualisation 3D
            # Si besoin de types uniquement, ils peuvent être dérivés côté frontend.
            
            # Normaliser le grade en fonction du quality_score (cohérence stricte)
            quality_score = vl_analysis.get('quality_score', 0.0)
            vl_analysis['grade'] = self._normalize_grade(quality_score)
            
            # Ajouter score_breakdown
            vl_analysis['score_breakdown'] = {
                'volume_score': vl_analysis.get('quality_score', 0.8),
                'uniformity_score': stats.get('uniformity', 0.85),
                'reflectance_score': 0.9,
                'amplitude_score': 0.88,
                'defect_penalty': 0.0 if not vl_analysis.get('defects') else 0.1
            }
            
            # Ajouter matrices brutes (VL53L8CHAnalysis hérite de VL53L8CHRawData)
            if vl_raw:
                vl_analysis['distance_matrix'] = vl_raw.get('distance_matrix', [[0]*8 for _ in range(8)])
                vl_analysis['reflectance_matrix'] = vl_raw.get('reflectance_matrix', [[128]*8 for _ in range(8)])
                vl_analysis['amplitude_matrix'] = vl_raw.get('amplitude_matrix', [[100]*8 for _ in range(8)])
                vl_analysis['ambient_matrix'] = vl_raw.get('ambient_matrix', [[0]*8 for _ in range(8)])
                # status_matrix is not always simulated; provide a default valid matrix (0=OK)
                vl_analysis['status_matrix'] = vl_raw.get('status_matrix', [[0]*8 for _ in range(8)])
        
        # 2. Enrichir AS7341 Analysis avec champs manquants
        if as_analysis:
            # Ajouter channels depuis raw_counts
            if 'channels' not in as_analysis and as_raw:
                raw_counts = as_raw.get('raw_counts', {})
                as_analysis['channels'] = {
                    'F1_415nm': raw_counts.get('F1_violet', raw_counts.get('415nm', 1000)),
                    'F2_445nm': raw_counts.get('F2_indigo', raw_counts.get('445nm', 1200)),
                    'F3_480nm': raw_counts.get('F3_blue', raw_counts.get('480nm', 1500)),
                    'F4_515nm': raw_counts.get('F4_cyan', raw_counts.get('515nm', 1800)),
                    'F5_555nm': raw_counts.get('F5_green', raw_counts.get('555nm', 2000)),
                    'F6_590nm': raw_counts.get('F6_yellow', raw_counts.get('590nm', 1700)),
                    'F7_630nm': raw_counts.get('F7_orange', raw_counts.get('630nm', 1400)),
                    'F8_680nm': raw_counts.get('F8_red', raw_counts.get('680nm', 1100)),
                    'Clear': raw_counts.get('clear', 5000),
                    'NIR': raw_counts.get('nir', 800)
                }
            
            # Ajouter integration_time et gain
            if 'integration_time' not in as_analysis:
                as_analysis['integration_time'] = as_raw.get('integration_time_ms', 100)
            if 'gain' not in as_analysis:
                as_analysis['gain'] = as_raw.get('gain', 8)
            
            # Ajouter indices de qualité manquants
            if 'freshness_index' not in as_analysis:
                as_analysis['freshness_index'] = as_analysis.get('quality_metrics', {}).get('freshness_index', 0.9)
            if 'fat_quality_index' not in as_analysis:
                as_analysis['fat_quality_index'] = as_analysis.get('quality_metrics', {}).get('fat_quality_index', 0.85)
            if 'oxidation_index' not in as_analysis:
                as_analysis['oxidation_index'] = as_analysis.get('quality_metrics', {}).get('oxidation_index', 0.05)
            if 'color_uniformity' not in as_analysis:
                as_analysis['color_uniformity'] = 0.88  # Valeur par défaut

            # Garantir un objet quality_metrics (utilisé par le frontend)
            if 'quality_metrics' not in as_analysis or not isinstance(as_analysis.get('quality_metrics'), dict):
                as_analysis['quality_metrics'] = {}
            as_analysis['quality_metrics'] = {
                **as_analysis.get('quality_metrics', {}),
                'freshness_index': as_analysis.get('freshness_index', 0.0),
                'fat_quality_index': as_analysis.get('fat_quality_index', 0.0),
                'oxidation_index': as_analysis.get('oxidation_index', 0.0),
                'color_uniformity': as_analysis.get('color_uniformity', 0.0),
                'overall_grade': as_analysis.get('grade', as_analysis.get('quality_metrics', {}).get('overall_grade', 'UNKNOWN')),
                'quality_score': as_analysis.get('quality_score', as_analysis.get('quality_metrics', {}).get('quality_score', 0.0)),
            }
            
            # Garder les défauts structurés (si présents)
            
            # Normaliser le grade en fonction du quality_score (cohérence stricte)
            quality_score = as_analysis.get('quality_score', 0.0)
            as_analysis['grade'] = self._normalize_grade(quality_score)
        
        # 3. Enrichir Fusion Result avec champs manquants
        if fusion:
            if 'vl53l8ch_score' not in fusion:
                fusion['vl53l8ch_score'] = vl_analysis.get('quality_score', 0.8)
            if 'as7341_score' not in fusion:
                fusion['as7341_score'] = as_analysis.get('quality_score', 0.85)
            
            # Garder les défauts fusion structurés (si présents)
            
            # Normaliser le grade final en fonction du final_score (cohérence stricte)
            final_score = fusion.get('final_score', 0.0)
            fusion['final_grade'] = self._normalize_grade(final_score)
        
        # 4. Créer SensorMetadata complet
        metadata = {
            'device_id': self.device_id,
            'firmware_version': '1.0.0',  # Version du simulateur
            'temperature_c': as_raw.get('temperature', 20.0),
            'humidity_percent': 45.0,  # Valeur par défaut
            'config_profile': 'foiegras_standard_barquette'
        }
        
        return {
            'vl53l8ch': vl_analysis,
            'as7341': as_analysis,
            'fusion': fusion,
            'meta': metadata
        }

    async def send_measurement(self, sensor_data: Dict[str, Any]):
        """Envoie mesure au backend (ou buffer si offline)"""
        # Adapter les données au format attendu par le backend (schéma Pydantic strict)
        adapted_data = self.adapt_for_backend(sensor_data)
        
        # Extraire métadonnées
        sample_id = sensor_data.get('as7341_raw', {}).get('metadata', {}).get('sampleName', 'unknown')

        # Extraire données de traçabilité blockchain depuis AS7341
        lot_data = sensor_data.get('as7341_raw', {}).get('lot_abattage', {})
        lot_abattage = lot_data.get('numero_lot', f"LOT-{datetime.utcnow().strftime('%Y%m%d')}-{sample_id[-4:]}")
        eleveur = lot_data.get('eleveur', 'Ferme Martin')
        provenance = lot_data.get('provenance', 'Périgord, France')

        # Payload - Données enrichies et validées pour le backend
        payload = {
            'type': 'sensor_data',
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'sample_id': sample_id,
            'device_id': self.device_id,
            'location': self.location,
            # Données analysées enrichies (tous les champs requis par le schéma Pydantic)
            'vl53l8ch': adapted_data['vl53l8ch'],
            'as7341': adapted_data['as7341'],
            'fusion': adapted_data['fusion'],
            'meta': adapted_data['meta'],
            # Blockchain traceability data for certification
            'lot_abattage': lot_abattage,
            'eleveur': eleveur,
            'provenance': provenance
        }

        # Si ONLINE → envoyer
        if self.status == ESP32_Status.ONLINE and self.websocket:
            try:
                payload_json = json.dumps(payload, cls=NumpyEncoder)
                
                # Log détaillé de la structure du payload pour debug
                logger.info(f"[{self.device_id}] 📤 Sending sample {sample_id} (mode: {payload.get('mode', 'unknown')}, size: {len(payload_json)} bytes)")
                logger.info(f"[{self.device_id}] 📋 Payload structure:")
                logger.info(f"  - type: {payload.get('type')}")
                logger.info(f"  - mode: {payload.get('mode')}")
                logger.info(f"  - sample_id: {payload.get('sample_id')}")
                logger.info(f"  - device_id: {payload.get('device_id')}")
                logger.info(f"  - vl53l8ch keys: {list(payload.get('vl53l8ch', {}).keys())}")
                logger.info(f"  - as7341 keys: {list(payload.get('as7341', {}).keys())}")
                logger.info(f"  - fusion keys: {list(payload.get('fusion', {}).keys())}")
                logger.info(f"  - vl53l8ch_raw keys: {list(payload.get('vl53l8ch_raw', {}).keys())}")
                logger.info(f"  - as7341_raw keys: {list(payload.get('as7341_raw', {}).keys())}")
                logger.info(f"  - meta keys: {list(payload.get('meta', {}).keys())}")
                
                # Log complet du payload (peut être volumineux)
                #logger.debug(f"[{self.device_id}] 📦 Full payload: {json.dumps(payload, cls=NumpyEncoder, indent=2)}")
                
                await self.websocket.send(payload_json)
                self.stats['measurements_sent'] += 1
                logger.debug(f"[{self.device_id}] → Sent {sample_id}")

                # Reset erreurs consécutives
                self.consecutive_errors = 0

                # Si buffer non vide → flush
                if len(self.buffer) > 0:
                    await self.flush_buffer()

            except websockets.exceptions.ConnectionClosed:
                logger.warning(f"[{self.device_id}] ⚠ Connection closed - buffering")
                self.status = ESP32_Status.OFFLINE
                self.leds['backend'] = False
                self.buffer.append(payload)
                self.stats['measurements_buffered'] += 1
                self.consecutive_errors += 1

        # Si OFFLINE → buffer local
        else:
            self.buffer.append(payload)
            self.stats['measurements_buffered'] += 1
            logger.debug(f"[{self.device_id}] 💾 Buffered {sample_id} ({len(self.buffer)}/{self.buffer_size})")
            self.consecutive_errors += 1

    def _prepare_vl_data(self, vl_raw):
        """Prépare données VL53L8CH"""
        
        distance_matrix = vl_raw['distance_matrix']
        if isinstance(distance_matrix, np.ndarray):
            distance_matrix = distance_matrix.tolist()

        reflectance_matrix = vl_raw.get('reflectance_matrix', [])
        if isinstance(reflectance_matrix, np.ndarray):
            reflectance_matrix = reflectance_matrix.tolist()

        amplitude_matrix = vl_raw.get('amplitude_matrix', [])
        if isinstance(amplitude_matrix, np.ndarray):
            amplitude_matrix = amplitude_matrix.tolist()

        ambient_matrix = vl_raw.get('ambient_matrix', [])
        if isinstance(ambient_matrix, np.ndarray):
            ambient_matrix = ambient_matrix.tolist()

        return {
            'distance_matrix': distance_matrix,
            'reflectance_matrix': reflectance_matrix,
            'amplitude_matrix': amplitude_matrix,
            'ambient_matrix': ambient_matrix,
            'meta': vl_raw['meta']
        }

    def _prepare_as_data(self, as_raw):
        """Prépare données AS7341"""
        import numpy as np
        
        # Convertir les wavelengths si c'est un ndarray
        wavelengths = as_raw.get('wavelengths', [])
        if isinstance(wavelengths, np.ndarray):
            wavelengths = wavelengths.tolist()
        
        # Convertir les intensities si c'est un ndarray
        intensities = as_raw.get('intensities', [])
        if isinstance(intensities, np.ndarray):
            intensities = intensities.tolist()
        
        # Convertir raw_counts (peut contenir des ndarrays)
        raw_counts = as_raw.get('raw_counts', {})
        if isinstance(raw_counts, dict):
            raw_counts = {k: v.tolist() if isinstance(v, np.ndarray) else v 
                         for k, v in raw_counts.items()}
        
        return {
            'wavelengths': wavelengths,
            'intensities': intensities,
            'raw_counts': raw_counts,
            'temperature': as_raw.get('temperature'),
            'metadata': as_raw.get('metadata', {}),
            'meta': as_raw.get('meta', {})
        }

    def _create_fusion_result(self, vl_analysis: dict, as_analysis: dict) -> dict:
        """
        Crée le résultat de fusion en combinant les analyses VL53L8CH et AS7341
        
        Args:
            vl_analysis: Résultats d'analyse VL53L8CH (avec quality_score, grade, etc.)
            as_analysis: Résultats d'analyse AS7341 (avec quality_score, grade, etc.)
            
        Returns:
            dict: Résultat de fusion avec final_score, final_grade, etc.
        """
        # Extraire les scores de qualité
        vl_score = vl_analysis.get('quality_score', 0.0)
        as_score = as_analysis.get('quality_score', 0.0)
        
        # Calculer le score final (moyenne pondérée : 60% ToF, 40% Spectral)
        final_score = (vl_score * 0.6) + (as_score * 0.4)
        
        # Déterminer le grade final basé sur le score
        if final_score >= 0.9:
            final_grade = "A+"
        elif final_score >= 0.8:
            final_grade = "A"
        elif final_score >= 0.7:
            final_grade = "B"
        elif final_score >= 0.6:
            final_grade = "C"
        else:
            final_grade = "REJECT"
        
        # Combiner les défauts des deux capteurs
        vl_defects = vl_analysis.get('defects', [])
        as_defects = as_analysis.get('defects', [])
        # Concaténer simplement (les défauts sont des dicts, pas hashable pour set())
        combined_defects = vl_defects + as_defects
        
        return {
            'final_score': final_score,
            'final_grade': final_grade,
            'vl53l8ch_score': vl_score,
            'as7341_score': as_score,
            'defects': combined_defects
        }

    async def flush_buffer(self):
        """Vide buffer local (envoie mesures stockées)"""
        if not self.buffer:
            return

        logger.info(f"[{self.device_id}] 📤 Flushing buffer ({len(self.buffer)} measurements)")

        while self.buffer and self.status == ESP32_Status.ONLINE:
            payload = self.buffer.popleft()
            try:
                await self.websocket.send(json.dumps(payload, cls=NumpyEncoder))
                self.stats['measurements_sent'] += 1
                await asyncio.sleep(0.1)  # Rate limit
            except:
                # Remettre dans buffer
                self.buffer.appendleft(payload)
                break

        logger.info(f"[{self.device_id}] ✓ Buffer flushed ({len(self.buffer)} remaining)")

    async def send_heartbeat(self):
        """Envoie heartbeat au backend"""
        if self.status != ESP32_Status.ONLINE or not self.websocket:
            return

        heartbeat = {
            'type': 'heartbeat',
            'device_id': self.device_id,
            'status': self.status.value,
            'uptime': int(time.time() - self.boot_time),
            'stats': self.stats,
            'buffer_size': len(self.buffer),
            'timestamp': datetime.utcnow().isoformat() + 'Z'
        }

        try:
            await self.websocket.send(json.dumps(heartbeat, cls=NumpyEncoder))
            self.last_heartbeat = time.time()
            logger.debug(f"[{self.device_id}] ❤️ Heartbeat")
        except:
            pass

    async def reconnect(self):
        """Tentative reconnexion backend"""
        logger.info(f"[{self.device_id}] 🔄 Attempting reconnection...")
        self.stats['reconnections'] += 1

        if await self.connect_backend():
            logger.info(f"[{self.device_id}] ✅ Reconnected successfully")
            return True
        else:
            logger.warning(f"[{self.device_id}] ❌ Reconnection failed")
            return False

    async def run(self, duration_seconds: Optional[int] = None):
        """
        Boucle principale ESP32
        Args:
            duration_seconds: Durée exécution (None = infini)
        """
        # Boot sequence
        if not await self.boot_sequence():
            logger.error(f"[{self.device_id}] Boot failed!")
            return

        # WiFi
        if not await self.connect_wifi():
            logger.error(f"[{self.device_id}] WiFi connection failed!")
            return

        # Backend
        await self.connect_backend()

        # Boucle principale
        start_time = time.time()
        last_heartbeat = time.time()
        heartbeat_interval = 30.0  # 30s

        logger.info(f"[{self.device_id}] 🚀 Starting main loop @ {self.sampling_rate_hz} Hz")

        try:
            while True:
                loop_start = time.time()

                # Vérifier durée
                if duration_seconds and (time.time() - start_time) >= duration_seconds:
                    logger.info(f"[{self.device_id}] ✓ Duration reached")
                    break

                # Heartbeat
                if time.time() - last_heartbeat >= heartbeat_interval:
                    await self.send_heartbeat()
                    last_heartbeat = time.time()

                # Lire capteurs
                sensor_data = await self.read_sensors()

                if sensor_data:
                    # Envoyer mesure
                    await self.send_measurement(sensor_data)

                    # Log toutes les 10 mesures
                    if (self.stats['measurements_sent'] + self.stats['measurements_buffered']) % 10 == 0:
                        logger.info(
                            f"[{self.device_id}] 📊 Sent: {self.stats['measurements_sent']} | "
                            f"Buffered: {len(self.buffer)} | "
                            f"Errors: {self.stats['i2c_errors']}"
                        )

                # Tentative reconnexion si offline (même si read_sensors() continue à produire)
                if self.status == ESP32_Status.OFFLINE:
                    now = time.time()
                    if (now - self._last_reconnect_attempt_ts) >= self._reconnect_min_interval_s:
                        self._last_reconnect_attempt_ts = now
                        await self.reconnect()
                        self.consecutive_errors = 0

                # MAJ stats
                self.stats['uptime_seconds'] = int(time.time() - self.boot_time)

                # Attendre prochain intervalle
                elapsed = time.time() - loop_start
                sleep_time = max(0, self.sampling_interval - elapsed)
                await asyncio.sleep(sleep_time)

        except KeyboardInterrupt:
            logger.info(f"[{self.device_id}] ⚠ Stopped by user")
        finally:
            if self.websocket:
                await self.websocket.close()

            logger.info(f"[{self.device_id}] 📊 Final stats:")
            logger.info(f"  - Sent: {self.stats['measurements_sent']}")
            logger.info(f"  - Buffered: {len(self.buffer)}")
            logger.info(f"  - I2C errors: {self.stats['i2c_errors']}")
            logger.info(f"  - Uptime: {self.stats['uptime_seconds']}s")


async def main():
    """Test ESP32 simulator"""
    import argparse
    import os

    parser = argparse.ArgumentParser(description='ESP32 Simulator')
    parser.add_argument('--device-id', help='Device ID')
    parser.add_argument('--location', default='Ligne A', help='Location')
    parser.add_argument('--url', default=os.getenv('BACKEND_WS_URL', 'ws://localhost:8000/ws/sensors/'), help='Backend URL')
    parser.add_argument('--rate', type=float, default=1.0, help='Sampling rate (Hz)')
    parser.add_argument('--duration', type=int, help='Duration (seconds)')

    args = parser.parse_args()

    esp32 = ESP32_Simulator(
        device_id=args.device_id or os.getenv('DEVICE_ID'),
        location=args.location,
        backend_url=args.url,
        sampling_rate_hz=args.rate
    )

    await esp32.run(duration_seconds=args.duration)


if __name__ == '__main__':
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )
    asyncio.run(main())
