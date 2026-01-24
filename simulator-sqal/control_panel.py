"""
SQAL Simulator Control Panel
Permet de lancer et gérer plusieurs simulateurs ESP32 simultanément
"""
import subprocess
import time
import sys
import argparse
from typing import List, Dict

class SimulatorControlPanel:
    """Gestionnaire de simulateurs SQAL"""

    def __init__(self):
        self.processes: Dict[str, subprocess.Popen] = {}
        self.backend_url = "ws://localhost:8000/ws/sensors/"

    def start_simulator(self, device_id: str, rate: float = 0.5, duration: int = 300):
        """
        Lance un simulateur ESP32

        Args:
            device_id: Identifiant du device (ex: ESP32_LL_01)
            rate: Fréquence d'envoi en Hz (ex: 0.5 = 1 sample toutes les 2s)
            duration: Durée en secondes (0 = infini)
        """
        if device_id in self.processes:
            print(f"❌ Simulateur {device_id} déjà en cours d'exécution")
            return False

        cmd = [
            sys.executable,
            "esp32_simulator.py",
            "--device-id", device_id,
            "--url", self.backend_url,
            "--rate", str(rate)
        ]

        if duration > 0:
            cmd.extend(["--duration", str(duration)])

        try:
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1
            )
            self.processes[device_id] = process
            print(f"✅ Simulateur {device_id} démarré (PID: {process.pid})")
            print(f"   Rate: {rate} Hz | Duration: {duration}s {'(infini)' if duration == 0 else ''}")
            return True
        except Exception as e:
            print(f"❌ Erreur démarrage simulateur {device_id}: {e}")
            return False

    def stop_simulator(self, device_id: str):
        """Arrête un simulateur spécifique"""
        if device_id not in self.processes:
            print(f"❌ Simulateur {device_id} non trouvé")
            return False

        process = self.processes[device_id]
        try:
            process.terminate()
            process.wait(timeout=5)
            del self.processes[device_id]
            print(f"✅ Simulateur {device_id} arrêté")
            return True
        except subprocess.TimeoutExpired:
            process.kill()
            del self.processes[device_id]
            print(f"⚠️  Simulateur {device_id} forcé à s'arrêter")
            return True
        except Exception as e:
            print(f"❌ Erreur arrêt simulateur {device_id}: {e}")
            return False

    def stop_all(self):
        """Arrête tous les simulateurs"""
        device_ids = list(self.processes.keys())
        for device_id in device_ids:
            self.stop_simulator(device_id)

    def status(self):
        """Affiche le statut de tous les simulateurs"""
        if not self.processes:
            print("📊 Aucun simulateur en cours")
            return

        print(f"\n📊 Statut des simulateurs ({len(self.processes)} actifs)")
        print("=" * 80)
        for device_id, process in self.processes.items():
            status = "🟢 Running" if process.poll() is None else "🔴 Stopped"
            print(f"{status} | {device_id:20s} | PID: {process.pid}")
        print("=" * 80)

    def start_multi_site_scenario(self):
        """
        Démarre un scénario multi-sites avec 3 lignes de production
        Simule les 3 sites Euralis: Landes (LL), Landes Sud (LS), Mont-de-Marsan (MT)
        """
        print("\n🚀 Démarrage du scénario multi-sites EURALIS")
        print("=" * 80)

        scenarios = [
            # Site Landes (LL) - 2 lignes
            {"device_id": "ESP32_LL_01", "rate": 0.5, "duration": 0},  # Ligne A
            {"device_id": "ESP32_LL_02", "rate": 0.4, "duration": 0},  # Ligne B

            # Site Landes Sud (LS) - 1 ligne
            {"device_id": "ESP32_LS_01", "rate": 0.6, "duration": 0},

            # Site Mont-de-Marsan (MT) - 1 ligne
            {"device_id": "ESP32_MT_01", "rate": 0.5, "duration": 0},
        ]

        for scenario in scenarios:
            self.start_simulator(**scenario)
            time.sleep(2)  # Délai entre chaque démarrage

        print("\n✅ Scénario multi-sites démarré!")
        print("   - 4 simulateurs actifs")
        print("   - Durée: infinie (Ctrl+C pour arrêter)")
        self.status()

    def start_stress_test(self, num_devices: int = 5, rate: float = 1.0, duration: int = 60):
        """
        Lance un test de charge avec plusieurs devices

        Args:
            num_devices: Nombre de simulateurs à lancer
            rate: Fréquence d'envoi en Hz
            duration: Durée du test en secondes
        """
        print(f"\n🔥 Démarrage test de charge")
        print(f"   Devices: {num_devices} | Rate: {rate} Hz | Duration: {duration}s")
        print("=" * 80)

        for i in range(num_devices):
            device_id = f"STRESS_TEST_{i+1:02d}"
            self.start_simulator(device_id, rate, duration)
            time.sleep(0.5)

        print(f"\n✅ Test de charge démarré avec {num_devices} simulateurs")
        self.status()


def main():
    parser = argparse.ArgumentParser(
        description="SQAL Simulator Control Panel",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemples d'utilisation:

  # Lancer le scénario multi-sites (4 devices)
  python control_panel.py --multi-site

  # Lancer un test de charge (10 devices, 2 Hz, 120s)
  python control_panel.py --stress-test --devices 10 --rate 2.0 --duration 120

  # Lancer un device unique
  python control_panel.py --device ESP32_DEMO_01 --rate 0.5 --duration 60

  # Mode interactif
  python control_panel.py --interactive
        """
    )

    parser.add_argument("--device", help="ID du device à lancer")
    parser.add_argument("--rate", type=float, default=0.5, help="Fréquence d'envoi (Hz)")
    parser.add_argument("--duration", type=int, default=300, help="Durée en secondes (0=infini)")
    parser.add_argument("--multi-site", action="store_true", help="Lancer scénario multi-sites")
    parser.add_argument("--stress-test", action="store_true", help="Lancer test de charge")
    parser.add_argument("--devices", type=int, default=5, help="Nombre de devices pour stress test")
    parser.add_argument("--interactive", action="store_true", help="Mode interactif")

    args = parser.parse_args()

    panel = SimulatorControlPanel()

    try:
        if args.interactive:
            interactive_mode(panel)
        elif args.multi_site:
            panel.start_multi_site_scenario()
            print("\n⏳ Simulateurs en cours... Appuyez sur Ctrl+C pour arrêter")
            while True:
                time.sleep(5)
        elif args.stress_test:
            panel.start_stress_test(args.devices, args.rate, args.duration)
            print(f"\n⏳ Test de charge en cours ({args.duration}s)... Appuyez sur Ctrl+C pour arrêter")
            time.sleep(args.duration)
            panel.stop_all()
        elif args.device:
            panel.start_simulator(args.device, args.rate, args.duration)
            print(f"\n⏳ Simulateur en cours... Appuyez sur Ctrl+C pour arrêter")
            while True:
                time.sleep(5)
        else:
            parser.print_help()

    except KeyboardInterrupt:
        print("\n\n🛑 Interruption détectée - Arrêt des simulateurs...")
        panel.stop_all()
        print("✅ Tous les simulateurs arrêtés")

    except Exception as e:
        print(f"\n❌ Erreur: {e}")
        panel.stop_all()


def interactive_mode(panel: SimulatorControlPanel):
    """Mode interactif avec menu"""
    print("\n" + "=" * 80)
    print("🎛️  SQAL SIMULATOR CONTROL PANEL - Mode Interactif")
    print("=" * 80)

    while True:
        print("\n📋 MENU:")
        print("  1. Démarrer un simulateur")
        print("  2. Arrêter un simulateur")
        print("  3. Voir le statut")
        print("  4. Scénario multi-sites (4 devices)")
        print("  5. Test de charge")
        print("  6. Arrêter tous les simulateurs")
        print("  0. Quitter")

        choice = input("\n👉 Votre choix: ").strip()

        if choice == "1":
            device_id = input("  Device ID (ex: ESP32_LL_01): ").strip()
            rate = float(input("  Fréquence Hz (ex: 0.5): ").strip() or "0.5")
            duration = int(input("  Durée secondes (0=infini): ").strip() or "300")
            panel.start_simulator(device_id, rate, duration)

        elif choice == "2":
            device_id = input("  Device ID à arrêter: ").strip()
            panel.stop_simulator(device_id)

        elif choice == "3":
            panel.status()

        elif choice == "4":
            panel.start_multi_site_scenario()

        elif choice == "5":
            num = int(input("  Nombre de devices: ").strip() or "5")
            rate = float(input("  Fréquence Hz: ").strip() or "1.0")
            duration = int(input("  Durée secondes: ").strip() or "60")
            panel.start_stress_test(num, rate, duration)

        elif choice == "6":
            panel.stop_all()

        elif choice == "0":
            print("\n👋 Arrêt du control panel...")
            panel.stop_all()
            break

        else:
            print("❌ Choix invalide")


if __name__ == "__main__":
    main()
