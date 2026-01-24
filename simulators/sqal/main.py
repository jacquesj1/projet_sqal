#!/usr/bin/env python3
"""
================================================================================
Simulateur SQAL - Point d'entrée unifié
================================================================================
Description : Simule capteurs ESP32 avec VL53L8CH ToF + AS7341 Spectral
Usage       : python main.py --device ESP32_LL_01 --interval 30
================================================================================
"""

import sys
import os
import argparse
import asyncio

# Ajouter le chemin du simulateur original
ORIGINAL_SIMULATOR_PATH = os.getenv(
    "ORIGINAL_SIMULATOR_PATH",
    "/app/simulator_original"
)

# Fallback dev (workspace) si le chemin Docker n'existe pas
if not os.path.exists(ORIGINAL_SIMULATOR_PATH):
    ORIGINAL_SIMULATOR_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'simulator-sqal')

sys.path.insert(0, ORIGINAL_SIMULATOR_PATH)

# Importer le simulateur ESP32
from esp32_simulator import ESP32_Simulator

async def main():
    parser = argparse.ArgumentParser(
        description='Simulateur SQAL - Capteurs IoT ESP32'
    )
    parser.add_argument(
        '--device',
        type=str,
        default='ESP32_LL_01',
        help='ID du device ESP32 (défaut: ESP32_LL_01)'
    )
    parser.add_argument(
        '--location',
        type=str,
        default='Ligne A',
        help='Localisation du capteur (défaut: Ligne A)'
    )
    parser.add_argument(
        '--backend-url',
        type=str,
        default='ws://backend:8000/ws/sensors/',
        help='URL WebSocket backend (défaut: ws://backend:8000/ws/sensors/)'
    )
    parser.add_argument(
        '--interval',
        type=float,
        default=30.0,
        help='Intervalle entre mesures en secondes (défaut: 30)'
    )
    parser.add_argument(
        '--config-profile',
        type=str,
        default='foiegras_standard_barquette',
        help='Profil de configuration (défaut: foiegras_standard_barquette)'
    )

    args = parser.parse_args()

    print("🔬 Simulateur SQAL - Capteurs IoT - Version Dockerisée")
    print("="*70)
    print(f"Device: {args.device}")
    print(f"Location: {args.location}")
    print(f"Backend: {args.backend_url}")
    print(f"Interval: {args.interval}s")
    print(f"Config: {args.config_profile}")
    print("="*70)

    # Créer et démarrer le simulateur
    simulator = ESP32_Simulator(
        device_id=args.device,
        location=args.location,
        backend_url=args.backend_url,
        sampling_rate_hz=1.0 / args.interval,
        config_profile=args.config_profile
    )

    try:
        await simulator.run()
    except KeyboardInterrupt:
        print("\n\n⚠️  Arrêt du simulateur...")
        await simulator.stop()

if __name__ == '__main__':
    asyncio.run(main())
