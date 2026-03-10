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
import inspect

# Ajouter le chemin du simulateur original
ORIGINAL_SIMULATOR_PATH = os.getenv(
    "ORIGINAL_SIMULATOR_PATH",
    "/app/simulator_original"
)

# Fallback dev (workspace) si le chemin Docker n'existe pas
if not os.path.exists(ORIGINAL_SIMULATOR_PATH):
    ORIGINAL_SIMULATOR_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'simulator-sqal')

# Prefer local simulator implementation (simulators/sqal/*.py).
# Only fall back to simulator-sqal/ (legacy/original) if local import fails.
try:
    from esp32_simulator import ESP32_Simulator
except Exception:
    sys.path.insert(0, ORIGINAL_SIMULATOR_PATH)
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
        '--n-measurements',
        type=int,
        default=0,
        help='Arrêter le simulateur après N mesures (0 = infini)'
    )
    parser.add_argument(
        '--config-profile',
        type=str,
        default='foiegras_standard_barquette',
        help='Profil de configuration (défaut: foiegras_standard_barquette)'
    )

    parser.add_argument(
        '--code-lots',
        type=str,
        default='',
        help='Liste de code_lot séparés par des virgules (round-robin). Ex: LL2512001,LS2512002,MT2512003'
    )

    parser.add_argument(
        '--lot-ids',
        type=str,
        default='',
        help='Liste de lot_id séparés par des virgules (round-robin). Ex: 101,202,303'
    )

    args = parser.parse_args()

    print("🔬 Simulateur SQAL - Capteurs IoT - Version Dockerisée")
    print("="*70)
    print(f"Device: {args.device}")
    print(f"Location: {args.location}")
    print(f"Backend: {args.backend_url}")
    print(f"Interval: {args.interval}s")
    print(f"Config: {args.config_profile}")
    try:
        print(f"Simulator module: {inspect.getfile(ESP32_Simulator)}")
    except Exception:
        pass
    print("="*70)

    code_lots = [c.strip() for c in str(args.code_lots or '').split(',') if c.strip()]
    if code_lots:
        print(f"Code lots (round-robin): {', '.join(code_lots)}")

    lot_ids: list[int] = []
    for raw in [c.strip() for c in str(args.lot_ids or '').split(',') if c.strip()]:
        try:
            lot_ids.append(int(raw))
        except Exception:
            continue
    if lot_ids:
        print(f"Lot ids (round-robin): {', '.join(str(x) for x in lot_ids)}")

    # Créer et démarrer le simulateur
    simulator = ESP32_Simulator(
        device_id=args.device,
        location=args.location,
        backend_url=args.backend_url,
        sampling_rate_hz=1.0 / args.interval,
        config_profile=args.config_profile,
        code_lots=code_lots,
        lot_ids=lot_ids,
    )

    try:
        max_measurements = int(args.n_measurements or 0)
        await simulator.run(max_measurements=max_measurements if max_measurements > 0 else None)
    except KeyboardInterrupt:
        print("\n\n⚠️  Arrêt du simulateur...")
        await simulator.stop()
    except asyncio.CancelledError:
        print("\n\n⚠️  Arrêt du simulateur...")
        await simulator.stop()
        return

if __name__ == '__main__':
    asyncio.run(main())
