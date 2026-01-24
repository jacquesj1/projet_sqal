#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Simulateur de capteurs I2C (VL53L8CH + AS7341)
Émule les registres I2C et timings réalistes des capteurs hardware
Utilise config_foiegras.yaml pour générer des données réalistes
"""
import time
import random
import logging
from typing import Dict, Any, Optional
from enum import IntEnum
from pathlib import Path

# Import simulateurs existants
from vl53l8ch_raw_simulator import VL53L8CH_RawSimulator
from as7341_raw_simulator import AS7341_RawSimulator
from config_loader import ConfigLoader

logger = logging.getLogger(__name__)


class I2C_Address(IntEnum):
    """Adresses I2C standards des capteurs"""
    VL53L8CH = 0x29
    AS7341 = 0x39


class VL53L8CH_I2C_Simulator:
    """
    Simulateur I2C pour capteur VL53L8CH ToF
    Émule registres, status, timing d'acquisition réaliste
    """

    # Registres I2C (extrait datasheet VL53L8CH)
    REG_DEVICE_ID = 0x00
    REG_STATUS = 0x01
    REG_RANGE_CONFIG = 0x02
    REG_START_MEASUREMENT = 0x03
    REG_DATA_READY = 0x04
    REG_DISTANCE_DATA = 0x10  # Base address pour données distance

    def __init__(self, i2c_address=I2C_Address.VL53L8CH, config_profile: str = "foiegras_standard_barquette"):
        """
        Args:
            i2c_address: Adresse I2C (default 0x29)
            config_profile: Profil YAML à utiliser (default: foiegras_standard_barquette)
        """
        self.i2c_address = i2c_address
        self.registers = {}

        # Charger configuration YAML
        config_path = Path(__file__).parent / "config_foiegras.yaml"
        self.config_loader = ConfigLoader(str(config_path))
        self.config_loader.load(config_profile)
        vl_params = self.config_loader.get_vl53l8ch_params()
        self.measurement_params = self.config_loader.get_measurement_params()

        # Simulateur backend avec config YAML
        self.simulator = VL53L8CH_RawSimulator(**vl_params)

        # État capteur
        self.is_measuring = False
        self.measurement_start_time = None
        self.last_measurement = None
        self.device_id = 0xF0  # VL53L8CH device ID

        # Timing réaliste (ms)
        self.acquisition_time_ms = 50  # Temps acquisition réel

        # Initialiser registres
        self._init_registers()

        logger.debug(f"VL53L8CH I2C initialized at address 0x{i2c_address:02X} with profile '{config_profile}'")

    def _init_registers(self):
        """Initialise registres par défaut"""
        self.registers[self.REG_DEVICE_ID] = self.device_id
        self.registers[self.REG_STATUS] = 0x00  # Idle
        self.registers[self.REG_DATA_READY] = 0x00  # No data

    def write_register(self, reg_addr: int, value: int):
        """Écrit dans un registre (commande ESP32 → capteur)"""
        self.registers[reg_addr] = value

        # Commande START_MEASUREMENT
        if reg_addr == self.REG_START_MEASUREMENT and value == 0x01:
            self._start_measurement()

        logger.debug(f"VL53L8CH write: reg=0x{reg_addr:02X}, value=0x{value:02X}")

    def read_register(self, reg_addr: int) -> int:
        """Lit un registre (ESP32 → lecture capteur)"""
        # Mise à jour état data_ready
        if reg_addr == self.REG_DATA_READY:
            return self._check_data_ready()

        return self.registers.get(reg_addr, 0x00)

    def _start_measurement(self):
        """Démarre acquisition (timing réaliste)"""
        self.is_measuring = True
        self.measurement_start_time = time.time()
        self.registers[self.REG_STATUS] = 0x01  # Measuring
        logger.debug("VL53L8CH measurement started")

    def _check_data_ready(self) -> int:
        """Vérifie si données prêtes (timing réaliste)"""
        if not self.is_measuring:
            return 0x00

        elapsed_ms = (time.time() - self.measurement_start_time) * 1000

        # Données prêtes après acquisition_time_ms
        if elapsed_ms >= self.acquisition_time_ms:
            # Générer mesure avec paramètres YAML
            if self.last_measurement is None:
                # Forcer include_bins=False pour éviter incompatibilité CNH format avec analyzer
                params = self.measurement_params.copy()
                params['include_bins'] = True ###JJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJ
                self.last_measurement = self.simulator.simulate_measurement(**params)

            self.is_measuring = False
            self.registers[self.REG_STATUS] = 0x00  # Idle
            return 0x01  # Data ready

        return 0x00  # Still measuring

    def read_measurement_data(self) -> Optional[Dict[str, Any]]:
        """
        Lit données de mesure complètes
        (ESP32 lit registres distance séquentiellement)
        """
        if self.last_measurement is None:
            return None

        data = self.last_measurement
        self.last_measurement = None  # Clear après lecture
        self.registers[self.REG_DATA_READY] = 0x00

        return data

    def simulate_i2c_error(self, error_rate=0.01):
        """Simule erreurs I2C (NACK, timeout)"""
        if random.random() < error_rate:
            raise IOError("I2C communication error (simulated)")


class AS7341_I2C_Simulator:
    """
    Simulateur I2C pour capteur AS7341 Spectral
    Émule registres, intégration, gain
    """

    # Registres I2C (extrait datasheet AS7341)
    REG_DEVICE_ID = 0x92
    REG_ENABLE = 0x80
    REG_ATIME = 0x81  # Integration time
    REG_GAIN = 0xAA
    REG_STATUS = 0x93
    REG_CH0_DATA_L = 0x95  # Base pour données canaux

    def __init__(self, i2c_address=I2C_Address.AS7341, config_profile: str = "foiegras_standard_barquette"):
        """
        Args:
            i2c_address: Adresse I2C (default 0x39)
            config_profile: Profil YAML à utiliser (default: foiegras_standard_barquette)
        """
        self.i2c_address = i2c_address
        self.registers = {}

        # Charger configuration YAML
        config_path = Path(__file__).parent / "config_foiegras.yaml"
        self.config_loader = ConfigLoader(str(config_path))
        self.config_loader.load(config_profile)
        as_params = self.config_loader.get_as7341_params()

        # Récupérer paramètres de qualité (variabilité)
        config_data = self.config_loader.config['profiles'][config_profile]
        self.quality_params = config_data.get('quality', {})
        self.product_type = config_data.get('product', {}).get('type', 'normal')

        # Simulateur backend avec config YAML
        self.simulator = AS7341_RawSimulator(
            integration_time_ms=as_params.get('integration_time_ms', 100),
            gain=as_params.get('gain', 4)
        )

        # État capteur
        self.is_measuring = False
        self.measurement_start_time = None
        self.last_measurement = None
        self.device_id = 0x09  # AS7341 Part ID

        # Config
        self.integration_time_ms = as_params.get('integration_time_ms', 100)
        self.gain = as_params.get('gain', 4)

        # Initialiser registres
        self._init_registers()

        logger.debug(f"AS7341 I2C initialized at address 0x{i2c_address:02X} with profile '{config_profile}'")

    def _init_registers(self):
        """Initialise registres par défaut"""
        self.registers[self.REG_DEVICE_ID] = self.device_id
        self.registers[self.REG_ENABLE] = 0x00  # Disabled
        self.registers[self.REG_ATIME] = 0x64  # Default integration
        self.registers[self.REG_GAIN] = 0x02   # Gain 4x
        self.registers[self.REG_STATUS] = 0x00

    def write_register(self, reg_addr: int, value: int):
        """Écrit dans un registre"""
        self.registers[reg_addr] = value

        # Config ATIME (integration time)
        if reg_addr == self.REG_ATIME:
            # ATIME = (256 - value) × 2.78ms
            self.integration_time_ms = (256 - value) * 2.78
            self.simulator.integration_time = self.integration_time_ms

        # Config GAIN
        elif reg_addr == self.REG_GAIN:
            gain_map = {0: 0.5, 1: 1, 2: 4, 3: 16, 4: 64, 5: 128, 6: 256, 7: 512}
            self.gain = gain_map.get(value, 4)
            self.simulator.gain = self.gain

        # ENABLE measurement (PON=1 ou SP_EN=1)
        elif reg_addr == self.REG_ENABLE and (value & 0x01):
            self._start_measurement()

        logger.debug(f"AS7341 write: reg=0x{reg_addr:02X}, value=0x{value:02X}")

    def read_register(self, reg_addr: int) -> int:
        """Lit un registre"""
        # Status register (data ready)
        if reg_addr == self.REG_STATUS:
            return self._check_data_ready()

        return self.registers.get(reg_addr, 0x00)

    def _start_measurement(self):
        """Démarre acquisition spectrale"""
        self.is_measuring = True
        self.measurement_start_time = time.time()
        self.registers[self.REG_STATUS] = 0x00  # Measuring
        logger.debug(f"AS7341 measurement started (integration={self.integration_time_ms}ms)")

    def _check_data_ready(self) -> int:
        """Vérifie si données spectrales prêtes"""
        if not self.is_measuring:
            return 0x00

        elapsed_ms = (time.time() - self.measurement_start_time) * 1000

        # Données prêtes après integration_time_ms
        if elapsed_ms >= self.integration_time_ms:
            # Générer mesure avec paramètres de qualité aléatoires
            if self.last_measurement is None:
                import random
                import numpy as np

                # Sélectionner un profil de qualité selon les poids (weights)
                profiles = []
                weights = []
                for profile_name, profile_data in self.quality_params.items():
                    if isinstance(profile_data, dict) and 'weight' in profile_data:
                        profiles.append(profile_name)
                        weights.append(profile_data['weight'])

                # Choisir profil selon probabilités
                if profiles:
                    selected_profile = random.choices(profiles, weights=weights, k=1)[0]
                    quality_profile = self.quality_params[selected_profile]

                    # Générer paramètres de qualité selon le profil sélectionné
                    params = {}

                    if 'freshness' in quality_profile:
                        qp = quality_profile['freshness']
                        params['freshness'] = np.clip(random.gauss(qp.get('mean', 0.85), 0.08), qp['min'], qp['max'])

                    if 'fat_quality' in quality_profile:
                        qp = quality_profile['fat_quality']
                        params['fat_quality'] = np.clip(random.gauss(qp.get('mean', 0.85), 0.08), qp['min'], qp['max'])

                    if 'oxidation_level' in quality_profile:
                        qp = quality_profile['oxidation_level']
                        params['oxidation_level'] = np.clip(random.gauss(qp.get('mean', 0.1), 0.08), qp['min'], qp['max'])

                    if 'temperature' in quality_profile:
                        qp = quality_profile['temperature']
                        params['temperature'] = np.clip(random.gauss(qp.get('mean', 20.0), 1.5), qp['min'], qp['max'])

                    if 'ambient_light' in quality_profile:
                        qp = quality_profile['ambient_light']
                        params['ambient_light'] = np.clip(random.gauss(qp.get('mean', 100.0), 15.0), qp['min'], qp['max'])

                    # Adapter product_type selon le profil
                    if selected_profile == 'defective':
                        params['product_type'] = 'defective'
                    elif selected_profile == 'low':
                        params['product_type'] = random.choice(['irregular', 'defective'])
                    else:
                        params['product_type'] = self.product_type
                else:
                    # Fallback si pas de profils configurés
                    params = {'product_type': self.product_type}

                self.last_measurement = self.simulator.simulate_measurement(**params)

            self.is_measuring = False
            return 0x01  # AVALID bit (data valid)

        return 0x00

    def read_measurement_data(self) -> Optional[Dict[str, Any]]:
        """Lit données spectrales complètes"""
        if self.last_measurement is None:
            return None

        data = self.last_measurement
        self.last_measurement = None
        self.registers[self.REG_STATUS] = 0x00

        return data

    def simulate_i2c_error(self, error_rate=0.01):
        """Simule erreurs I2C"""
        if random.random() < error_rate:
            raise IOError("I2C communication error (simulated)")


class I2C_Bus_Simulator:
    """
    Simulateur de bus I2C complet
    Gère plusieurs capteurs sur même bus
    """

    def __init__(self, config_profile: str = "foiegras_standard_barquette"):
        """Initialise bus I2C avec capteurs

        Args:
            config_profile: Profil YAML à utiliser pour les capteurs
        """
        self.devices = {}
        self.config_profile = config_profile

        # Ajouter capteurs par défaut avec configuration
        self.add_device(VL53L8CH_I2C_Simulator(config_profile=config_profile))
        self.add_device(AS7341_I2C_Simulator(config_profile=config_profile))

        logger.info(f"I2C bus initialized with {len(self.devices)} devices using profile '{config_profile}'")

    def add_device(self, device):
        """Ajoute un device au bus I2C"""
        self.devices[device.i2c_address] = device
        logger.debug(f"Device added at 0x{device.i2c_address:02X}")

    def write_byte(self, address: int, reg: int, value: int):
        """Écrit byte sur bus I2C"""
        if address not in self.devices:
            raise IOError(f"No device at address 0x{address:02X}")

        self.devices[address].write_register(reg, value)

    def read_byte(self, address: int, reg: int) -> int:
        """Lit byte depuis bus I2C"""
        if address not in self.devices:
            raise IOError(f"No device at address 0x{address:02X}")

        return self.devices[address].read_register(reg)

    def scan(self) -> list:
        """Scan bus I2C (retourne adresses devices détectés)"""
        return list(self.devices.keys())

    def get_device(self, address: int):
        """Récupère device par adresse"""
        return self.devices.get(address)


if __name__ == '__main__':
    # Test simulateur I2C
    logging.basicConfig(level=logging.DEBUG)

    print("=" * 70)
    print("TEST SIMULATEUR I2C - VL53L8CH + AS7341")
    print("=" * 70)

    # Créer bus I2C
    i2c_bus = I2C_Bus_Simulator()

    print(f"\n1. Scan bus I2C")
    devices = i2c_bus.scan()
    print(f"   Devices trouvés: {[f'0x{addr:02X}' for addr in devices]}")

    # Test VL53L8CH
    print(f"\n2. Test VL53L8CH (0x{I2C_Address.VL53L8CH:02X})")
    vl_device = i2c_bus.get_device(I2C_Address.VL53L8CH)

    # Lire device ID
    device_id = i2c_bus.read_byte(I2C_Address.VL53L8CH, VL53L8CH_I2C_Simulator.REG_DEVICE_ID)
    print(f"   Device ID: 0x{device_id:02X}")

    # Démarrer mesure
    i2c_bus.write_byte(I2C_Address.VL53L8CH, VL53L8CH_I2C_Simulator.REG_START_MEASUREMENT, 0x01)
    print(f"   Mesure démarrée...")

    # Attendre data ready
    while True:
        data_ready = i2c_bus.read_byte(I2C_Address.VL53L8CH, VL53L8CH_I2C_Simulator.REG_DATA_READY)
        if data_ready == 0x01:
            break
        time.sleep(0.01)

    # Lire données
    vl_data = vl_device.read_measurement_data()
    print(f"   ✓ Données VL53L8CH reçues:")
    print(f"     - Distance moyenne: {vl_data['distance_matrix'].mean():.1f} mm")
    print(f"     - Résolution: {vl_data['meta']['resolution_x']}x{vl_data['meta']['resolution_y']}")

    # Test AS7341
    print(f"\n3. Test AS7341 (0x{I2C_Address.AS7341:02X})")
    as_device = i2c_bus.get_device(I2C_Address.AS7341)

    # Lire device ID
    device_id = i2c_bus.read_byte(I2C_Address.AS7341, AS7341_I2C_Simulator.REG_DEVICE_ID)
    print(f"   Device ID: 0x{device_id:02X}")

    # Configurer gain
    i2c_bus.write_byte(I2C_Address.AS7341, AS7341_I2C_Simulator.REG_GAIN, 0x03)  # Gain 16x

    # Démarrer mesure
    i2c_bus.write_byte(I2C_Address.AS7341, AS7341_I2C_Simulator.REG_ENABLE, 0x03)
    print(f"   Mesure spectrale démarrée...")

    # Attendre data ready
    while True:
        status = i2c_bus.read_byte(I2C_Address.AS7341, AS7341_I2C_Simulator.REG_STATUS)
        if status & 0x01:
            break
        time.sleep(0.01)

    # Lire données
    as_data = as_device.read_measurement_data()
    print(f"   ✓ Données AS7341 reçues:")
    print(f"     - Wavelengths: {as_data['wavelengths']}")
    print(f"     - Intensities: {[f'{i:.2f}' for i in as_data['intensities'][:3]]}... (9 canaux)")
    print(f"     - Éleveur: {as_data['metadata']['eleveur']}")

    print("\n" + "=" * 70)
    print("TEST I2C TERMINÉ")
    print("=" * 70)
