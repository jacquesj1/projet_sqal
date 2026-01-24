#!/usr/bin/env python3
"""
Test de vérification de l'intégration blockchain complète
Vérifie que les données de traçabilité sont présentes du simulateur jusqu'au frontend
"""

import requests
import time
import json

def test_backend_health():
    """Test 1: Vérifier que le backend est accessible"""
    print("=" * 80)
    print("TEST 1: Backend Health Check")
    print("=" * 80)

    try:
        response = requests.get("http://localhost:8001/health/detailed", timeout=5)
        if response.status_code == 200:
            print("✅ Backend est accessible")
            data = response.json()
            print(f"   - Status: {data.get('status')}")
            print(f"   - Database: {data.get('database', {}).get('status')}")
            print(f"   - Redis: {data.get('redis', {}).get('status')}")
            return True
        else:
            print(f"❌ Backend non accessible: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Erreur connexion backend: {e}")
        return False

def test_blockchain_endpoint():
    """Test 2: Vérifier l'endpoint blockchain"""
    print("\n" + "=" * 80)
    print("TEST 2: Blockchain Endpoint")
    print("=" * 80)

    try:
        # Test avec données simulées
        test_data = {
            "sample_id": "TEST-001",
            "quality_score": 0.85,
            "grade": "A",
            "lot_abattage": "LOT-20251112-1234",
            "eleveur": "Ferme Martin",
            "provenance": "Périgord, France"
        }

        response = requests.post(
            "http://localhost:8001/api/v1/blockchain/certify",
            json=test_data,
            timeout=5
        )

        if response.status_code == 200:
            print("✅ Endpoint blockchain fonctionne")
            data = response.json()
            print(f"   - Blockchain Hash: {data.get('blockchain_hash', '')[:32]}...")
            print(f"   - QR Code généré: {'✅' if data.get('qr_code_base64') else '❌'}")
            print(f"   - Lot d'abattage: {data.get('lot_abattage')}")
            print(f"   - Éleveur: {data.get('eleveur')}")
            print(f"   - Provenance: {data.get('provenance')}")
            return True
        else:
            print(f"❌ Endpoint erreur: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Erreur test blockchain: {e}")
        return False

def test_database_blockchain_fields():
    """Test 3: Vérifier que les champs blockchain sont en base"""
    print("\n" + "=" * 80)
    print("TEST 3: Database Blockchain Fields")
    print("=" * 80)

    try:
        # Récupérer les dernières données via l'API
        response = requests.get("http://localhost:8001/api/v1/sensors/latest", timeout=5)

        if response.status_code == 200:
            data = response.json()
            if data:
                print("✅ Échantillon récent trouvé")
                print(f"   - Sample ID: {data.get('sample_id')}")

                # Vérifier présence des champs blockchain
                has_hash = data.get('blockchain_hash') is not None
                has_lot = data.get('lot_abattage') is not None
                has_eleveur = data.get('eleveur') is not None
                has_provenance = data.get('provenance') is not None

                print(f"   - Blockchain Hash: {'✅' if has_hash else '❌'}")
                print(f"   - Lot d'abattage: {'✅' if has_lot else '❌'} {data.get('lot_abattage', 'N/A')}")
                print(f"   - Éleveur: {'✅' if has_eleveur else '❌'} {data.get('eleveur', 'N/A')}")
                print(f"   - Provenance: {'✅' if has_provenance else '❌'} {data.get('provenance', 'N/A')}")

                return has_hash and has_lot and has_eleveur and has_provenance
            else:
                print("⚠️  Aucun échantillon récent (base vide?)")
                return False
        else:
            print(f"❌ Impossible de récupérer données: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Erreur test database: {e}")
        return False

def test_simulator_payload():
    """Test 4: Vérifier que le simulateur envoie les bons champs"""
    print("\n" + "=" * 80)
    print("TEST 4: Simulator Payload Structure")
    print("=" * 80)

    print("⚠️  Test manuel requis:")
    print("   1. Démarrer le simulateur: cd simulator && python esp32_simulator.py")
    print("   2. Observer les logs du simulateur")
    print("   3. Vérifier la présence de:")
    print("      - 'lot_abattage': 'LOT-...'")
    print("      - 'eleveur': '...'")
    print("      - 'provenance': '...'")
    print("\n   Alternative: Vérifier les logs backend:")
    print("      docker logs sqal_backend | grep -E 'lot_abattage|eleveur|provenance'")

    return None  # Test manuel

def test_frontend_display():
    """Test 5: Vérifier que le frontend affiche le QR code"""
    print("\n" + "=" * 80)
    print("TEST 5: Frontend Display")
    print("=" * 80)

    print("⚠️  Test manuel requis:")
    print("   1. Ouvrir http://localhost:5173")
    print("   2. Aller sur la page 'Foie Gras'")
    print("   3. Scroller vers le bas (onglet 'Vue d'ensemble')")
    print("   4. Vérifier présence de la card 'Traçabilité Blockchain'")
    print("   5. Vérifier affichage:")
    print("      ✅ QR Code (256x256px)")
    print("      ✅ Hash blockchain")
    print("      ✅ Lot d'abattage")
    print("      ✅ Éleveur")
    print("      ✅ Provenance")
    print("      ✅ Grade")
    print("      ✅ Horodatage")

    return None  # Test manuel

def generate_test_report(results):
    """Génère un rapport de test"""
    print("\n" + "=" * 80)
    print("RAPPORT DE TEST - INTÉGRATION BLOCKCHAIN")
    print("=" * 80)

    total = len([r for r in results.values() if r is not None])
    passed = len([r for r in results.values() if r is True])
    failed = len([r for r in results.values() if r is False])
    manual = len([r for r in results.values() if r is None])

    print(f"\nTests automatiques: {total}")
    print(f"  [OK] Reussis: {passed}")
    print(f"  [FAIL] Echoues: {failed}")
    print(f"  [MANUAL] Manuels: {manual}")

    print("\nDétails:")
    for test_name, result in results.items():
        status = "[OK]" if result is True else ("[FAIL]" if result is False else "[MANUAL]")
        print(f"  {status} {test_name}")

    if failed == 0:
        print("\n[OK] Tous les tests automatiques sont passes!")
        print("   Verifiez maintenant les tests manuels (simulateur + frontend)")
    else:
        print("\n[WARN] Certains tests ont echoue. Verifiez la configuration:")
        print("   - Backend running: docker ps | grep sqal_backend")
        print("   - Database accessible: docker logs sqal_timescaledb")
        print("   - Redis accessible: docker exec sqal_redis redis-cli ping")

def main():
    """Exécute tous les tests"""
    print("\nTEST D'INTEGRATION BLOCKCHAIN SQAL")
    print("Date:", time.strftime("%Y-%m-%d %H:%M:%S"))
    print()

    results = {}

    # Tests automatiques
    results["Backend Health"] = test_backend_health()
    time.sleep(1)

    results["Blockchain Endpoint"] = test_blockchain_endpoint()
    time.sleep(1)

    results["Database Fields"] = test_database_blockchain_fields()
    time.sleep(1)

    # Tests manuels
    results["Simulator Payload"] = test_simulator_payload()
    results["Frontend Display"] = test_frontend_display()

    # Rapport final
    generate_test_report(results)

    print("\n" + "=" * 80)
    print("FIN DES TESTS")
    print("=" * 80)

if __name__ == "__main__":
    main()
