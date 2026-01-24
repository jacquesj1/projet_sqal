#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Configuration Loader pour le système d'inspection foie gras
Charge et valide les fichiers YAML de configuration
"""

import yaml
from pathlib import Path
from typing import Dict, Any, Optional
import sys

class ConfigLoader:
    """Gestionnaire de configuration YAML pour l'inspection foie gras"""

    def __init__(self, config_file: str = "config_foiegras.yaml"):
        """
        Initialise le loader de configuration

        Args:
            config_file: Chemin vers le fichier YAML de configuration
        """
        self.config_file = Path(config_file)
        self.config = None
        self.current_profile = None

    def load(self, profile_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Charge la configuration depuis le fichier YAML

        Args:
            profile_name: Nom du profil à charger (None = profil par défaut)

        Returns:
            Dictionnaire de configuration validé

        Raises:
            FileNotFoundError: Si le fichier n'existe pas
            ValueError: Si la configuration est invalide
        """
        if not self.config_file.exists():
            raise FileNotFoundError(
                f"Fichier de configuration introuvable: {self.config_file}\n"
                f"Veuillez créer le fichier config_foiegras.yaml"
            )

        # Charger le YAML
        with open(self.config_file, 'r', encoding='utf-8') as f:
            self.config = yaml.safe_load(f)

        # Déterminer le profil à utiliser
        if profile_name is None:
            profile_name = self.config.get('default_profile', 'foiegras_standard_barquette')

        # Vérifier que le profil existe
        if 'profiles' not in self.config:
            raise ValueError("Le fichier de configuration ne contient pas de section 'profiles'")

        if profile_name not in self.config['profiles']:
            available = ', '.join(self.config['profiles'].keys())
            raise ValueError(
                f"Profil '{profile_name}' introuvable.\n"
                f"Profils disponibles: {available}"
            )

        self.current_profile = profile_name
        profile_config = self.config['profiles'][profile_name]

        # Valider la configuration
        self._validate_config(profile_config)

        return profile_config

    def _validate_config(self, config: Dict[str, Any]):
        """Valide la structure et les valeurs de la configuration"""

        # Vérifier les sections obligatoires
        required_sections = ['product', 'sensor_vl53l8ch']
        for section in required_sections:
            if section not in config:
                raise ValueError(f"Section obligatoire manquante: '{section}'")

        # Valider la section produit
        product = config['product']
        if 'length_mm' not in product or 'width_mm' not in product:
            raise ValueError("Les dimensions du produit (length_mm, width_mm) sont obligatoires")

        if product['length_mm'] <= 0 or product['width_mm'] <= 0:
            raise ValueError("Les dimensions du produit doivent être positives")

        # Valider la section capteur VL53L8CH
        sensor_vl53l8ch = config['sensor_vl53l8ch']
        if 'resolution' not in sensor_vl53l8ch:
            raise ValueError("La résolution du capteur VL53L8CH est obligatoire")

        if sensor_vl53l8ch['resolution'] not in [8, 16, 32]:
            print(f"[ATTENTION] Résolution {sensor_vl53l8ch['resolution']} non standard (8, 16, 32)")

        # Valider la section capteur AS7341 si présente
        if 'sensor_as7341' in config:
            sensor_as7341 = config['sensor_as7341']
            if sensor_as7341.get('enabled', False):
                if 'integration_time_ms' in sensor_as7341:
                    if not (50 <= sensor_as7341['integration_time_ms'] <= 500):
                        print(f"[ATTENTION] Temps d'intégration AS7341 recommandé: 50-500ms")
                if 'gain' in sensor_as7341:
                    if sensor_as7341['gain'] not in [1, 4, 16, 64]:
                        print(f"[ATTENTION] Gain AS7341 valide: 1, 4, 16, ou 64")

        # Valider le container si activé
        if config.get('container', {}).get('enabled', False):
            container = config['container']
            if 'length_mm' not in container or 'width_mm' not in container:
                raise ValueError("Les dimensions du container sont obligatoires si enabled=true")

            # Vérifier que le produit rentre dans le container
            if container['length_mm'] < product['length_mm']:
                raise ValueError(
                    f"Le container ({container['length_mm']}mm) est plus petit que "
                    f"le produit ({product['length_mm']}mm) en longueur"
                )
            if container['width_mm'] < product['width_mm']:
                raise ValueError(
                    f"Le container ({container['width_mm']}mm) est plus petit que "
                    f"le produit ({product['width_mm']}mm) en largeur"
                )

    def get_vl53l8ch_params(self) -> Dict[str, Any]:
        """
        Extrait les paramètres pour VL53L8CH_RawSimulator

        Returns:
            Dictionnaire de paramètres prêts à être passés au simulateur
        """
        if self.config is None:
            raise RuntimeError("Configuration non chargée. Appelez load() d'abord.")

        profile = self.config['profiles'][self.current_profile]
        product = profile['product']
        sensor = profile['sensor_vl53l8ch']
        container = profile.get('container', {})
        global_defaults = self.config.get('global_defaults', {})

        params = {
            # Résolution et hauteur capteur
            'resolution': sensor['resolution'],
            'height_sensor_mm': sensor['height_mm'],
            'n_bins': sensor.get('n_bins', 128),
            'bin_size_mm': sensor.get('bin_size_mm', 37.5),

            # Dimensions produit
            'product_length_mm': product['length_mm'],
            'product_width_mm': product['width_mm'],
            'product_margin_percent': product.get('margin_percent', 15.0),

            # Container (barquette)
            'container_mode': container.get('enabled', False),
        }

        if container.get('enabled', False):
            params['container_length_mm'] = container['length_mm']
            params['container_width_mm'] = container['width_mm']
            params['container_height_mm'] = container.get('height_mm', 5.0)

        # Paramètres globaux
        if 'random_seed' in global_defaults and global_defaults['random_seed'] is not None:
            params['random_seed'] = global_defaults['random_seed']

        # Paramètres de bruit
        params['multi_echo_prob'] = global_defaults.get('multi_echo_prob', 0.18)
        params['reflectance_threshold'] = global_defaults.get('reflectance_threshold', 30)
        params['noise_factor_low_reflect'] = global_defaults.get('noise_factor_low_reflect', 0.06)
        params['noise_factor_high_reflect'] = global_defaults.get('noise_factor_high_reflect', 0.03)

        return params

    def get_as7341_params(self) -> Dict[str, Any]:
        """
        Extrait les paramètres pour AS7341_RawSimulator

        Returns:
            Dictionnaire de paramètres prêts à être passés au simulateur AS7341
        """
        if self.config is None:
            raise RuntimeError("Configuration non chargée. Appelez load() d'abord.")

        profile = self.config['profiles'][self.current_profile]
        sensor_as7341 = profile.get('sensor_as7341', {})
        global_defaults = self.config.get('global_defaults', {})

        if not sensor_as7341.get('enabled', False):
            return {'enabled': False}

        params = {
            'enabled': True,
            'integration_time_ms': sensor_as7341.get('integration_time_ms', 100),
            'gain': sensor_as7341.get('gain', 4),
            'noise_std': sensor_as7341.get('noise_std', 5.0),
        }

        # Random seed si spécifié
        if 'random_seed' in global_defaults and global_defaults['random_seed'] is not None:
            params['random_seed'] = global_defaults['random_seed']

        return params

    def get_simulator_params(self) -> Dict[str, Any]:
        """
        Alias pour compatibilité - utilise get_vl53l8ch_params()
        """
        return self.get_vl53l8ch_params()

    def get_measurement_params(self) -> Dict[str, Any]:
        """
        Extrait les paramètres pour simulate_measurement()

        Returns:
            Dictionnaire de paramètres pour la mesure
        """
        if self.config is None:
            raise RuntimeError("Configuration non chargée. Appelez load() d'abord.")

        profile = self.config['profiles'][self.current_profile]
        global_defaults = self.config.get('global_defaults', {})

        params = {
            'product_type': profile['product'].get('type', 'normal'),
            'defects': profile.get('defects'),
            'include_bins': global_defaults.get('include_bins', True),
        }

        return params

    def get_visualization_params(self) -> Dict[str, Any]:
        """
        Extrait les paramètres de visualisation

        Returns:
            Dictionnaire de paramètres de visualisation
        """
        if self.config is None:
            raise RuntimeError("Configuration non chargée. Appelez load() d'abord.")

        viz = self.config.get('visualization', {})

        return {
            'display_modes': viz.get('display_modes', ['defects']),
            'style': viz.get('style', 'surface'),
            'show_defects': viz.get('show_defects', True),
            'interpolate_surface': viz.get('interpolate_surface', True),
            'colormaps': viz.get('colormaps', {}),
        }

    def list_profiles(self) -> Dict[str, str]:
        """
        Liste tous les profils disponibles avec leur description

        Returns:
            Dictionnaire {nom_profil: description}
        """
        if self.config is None:
            self.load()

        profiles = {}
        for name, profile in self.config['profiles'].items():
            description = profile.get('description', 'Aucune description')
            profiles[name] = description

        return profiles

    def print_profile_info(self, profile_name: Optional[str] = None):
        """Affiche les informations sur un profil"""
        if profile_name is None:
            profile_name = self.current_profile

        if self.config is None:
            self.load(profile_name)

        profile = self.config['profiles'][profile_name]

        print("=" * 70)
        print(f"PROFIL: {profile_name}")
        print("=" * 70)
        print(f"Description: {profile.get('description', 'N/A')}")
        print()

        print("PRODUIT:")
        product = profile['product']
        print(f"  Dimensions: {product['length_mm']}x{product['width_mm']}mm")
        print(f"  Marge: {product.get('margin_percent', 15)}%")
        print(f"  Type: {product.get('type', 'normal')}")
        print()

        if profile.get('container', {}).get('enabled', False):
            container = profile['container']
            print("CONTAINER (BARQUETTE):")
            print(f"  Dimensions: {container['length_mm']}x{container['width_mm']}mm")
            print(f"  Hauteur: {container.get('height_mm', 5)}mm")
            print()

        sensor_vl53l8ch = profile['sensor_vl53l8ch']
        print("CAPTEUR VL53L8CH (ToF):")
        print(f"  Resolution: {sensor_vl53l8ch['resolution']}x{sensor_vl53l8ch['resolution']}")
        print(f"  Hauteur: {sensor_vl53l8ch['height_mm']}mm")
        print(f"  Bins: {sensor_vl53l8ch.get('n_bins', 128)}")
        print()

        if 'sensor_as7341' in profile:
            sensor_as7341 = profile['sensor_as7341']
            if sensor_as7341.get('enabled', False):
                print("CAPTEUR AS7341 (Spectral):")
                print(f"  Activé: Oui")
                print(f"  Temps d'intégration: {sensor_as7341.get('integration_time_ms', 100)}ms")
                print(f"  Gain: {sensor_as7341.get('gain', 4)}x")
                print(f"  Bruit std: {sensor_as7341.get('noise_std', 5.0)}")
                print()
            else:
                print("CAPTEUR AS7341: Désactivé")
                print()

        if profile.get('defects'):
            print("DÉFAUTS SPÉCIFIÉS:")
            for defect_type, params in profile['defects'].items():
                print(f"  - {defect_type}: {params}")
        else:
            print("DÉFAUTS: Aléatoires")

        print("=" * 70)


def main():
    """Test du loader de configuration"""
    import argparse

    parser = argparse.ArgumentParser(description='Gestionnaire de configuration foie gras')
    parser.add_argument('--list', action='store_true', help='Lister tous les profils')
    parser.add_argument('--profile', type=str, help='Afficher les infos d\'un profil')
    parser.add_argument('--config', type=str, default='config_foiegras.yaml',
                       help='Chemin du fichier de configuration')

    args = parser.parse_args()

    loader = ConfigLoader(args.config)

    try:
        if args.list:
            print("\n" + "=" * 70)
            print("PROFILS DISPONIBLES")
            print("=" * 70)
            profiles = loader.list_profiles()
            for name, description in profiles.items():
                print(f"\n{name}:")
                print(f"  {description}")
            print("\n" + "=" * 70)

        elif args.profile:
            loader.load(args.profile)
            loader.print_profile_info()

        else:
            # Charger le profil par défaut
            loader.load()
            print(f"\n[OK] Configuration chargée: profil '{loader.current_profile}'")
            loader.print_profile_info()

    except Exception as e:
        print(f"\n[ERREUR] {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
