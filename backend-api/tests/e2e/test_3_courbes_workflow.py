"""
Test E2E - Workflow Complet 3-Courbes
Sprint 6A - Intégration Courbe Prédictive IA v2

Teste le workflow complet:
1. Génération courbe théorique (PySR v2)
2. Saisie doses réelles par gaveur
3. Détection écarts et génération courbe prédictive (v2 hybride)
4. Dashboard 3-courbes (API)

Auteur: Claude Sonnet 4.5
Date: 11 Janvier 2026
"""

import pytest
import requests
import time
from typing import Dict, List

BASE_URL = "http://localhost:8000"


class Test3CourbesWorkflow:
    """Test workflow complet 3-courbes"""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup avant chaque test"""
        self.lot_id = None
        self.courbe_theorique_id = None
        yield
        # Cleanup après test si nécessaire

    def test_01_health_check(self):
        """Vérifier backend disponible"""
        response = requests.get(f"{BASE_URL}/health")
        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'healthy'
        assert data['database'] == 'connected'
        print("✓ Backend healthy")

    def test_02_generer_courbe_theorique_pysr_v2(self):
        """Étape 1: Générer courbe théorique avec PySR v2"""
        # Créer un lot test
        lot_data = {
            "code_lot": f"TEST3C_{int(time.time())}",
            "site_code": "LL",
            "debut_lot": "2026-01-01",
            "nb_canards_depart": 100,
            "age_moyen_gavage": 90,
            "duree_gavage_prevue": 14,
            "poids_foie_cible": 400.0,
            "race": "Mulard"
        }

        # Créer lot via API Euralis
        response = requests.post(
            f"{BASE_URL}/api/euralis/lots",
            json=lot_data
        )
        assert response.status_code in [200, 201]
        lot = response.json()
        self.lot_id = lot['id']
        print(f"✓ Lot créé: {self.lot_id} ({lot_data['code_lot']})")

        # Générer courbe théorique PySR v2
        response = requests.post(
            f"{BASE_URL}/api/courbes/theorique/generate-pysr",
            params={
                "lot_id": self.lot_id,
                "age_moyen": 90,
                "poids_foie_cible": 400.0,
                "duree_gavage": 14,
                "race": "Mulard",
                "auto_save": "true"
            }
        )
        assert response.status_code == 200
        courbe_data = response.json()

        # Vérifier structure
        assert 'courbe_theorique' in courbe_data
        assert len(courbe_data['courbe_theorique']) == 14
        assert courbe_data['metadata']['modele_version'] == 'v2.0-numpy'
        assert courbe_data['metadata']['algorithme'] == 'PySR v2 - Pure NumPy (sans Julia)'

        # Vérifier doses croissantes
        doses = [d['dose_g'] for d in courbe_data['courbe_theorique']]
        assert doses[0] < doses[-1]  # Croissance
        assert 180 < doses[0] < 250  # Première dose raisonnable
        assert 400 < doses[-1] < 550  # Dernière dose raisonnable

        print(f"✓ Courbe théorique PySR v2 générée: {len(doses)} jours")
        print(f"  Doses: {doses[0]:.1f}g → {doses[-1]:.1f}g (total: {sum(doses):.1f}g)")

        # Récupérer courbe sauvegardée
        response = requests.get(f"{BASE_URL}/api/courbes/theorique/lot/{self.lot_id}")
        assert response.status_code == 200
        saved_courbe = response.json()
        self.courbe_theorique_id = saved_courbe['id']
        print(f"✓ Courbe sauvegardée en DB (id: {self.courbe_theorique_id})")

    def test_03_saisir_doses_reelles_avec_ecarts(self):
        """Étape 2: Saisir doses réelles avec écarts significatifs"""
        assert self.lot_id is not None, "Lot non créé"

        # Récupérer courbe théorique
        response = requests.get(f"{BASE_URL}/api/courbes/theorique/lot/{self.lot_id}")
        assert response.status_code == 200
        courbe_theo = response.json()

        # Extraire doses théoriques
        doses_theo = courbe_theo['courbe_theorique']
        if isinstance(doses_theo, str):
            import json
            doses_theo = json.loads(doses_theo)

        # Saisir 7 doses réelles avec écarts volontaires
        # Jours 1-4: conforme
        # Jours 5-7: écarts significatifs (-15%, -20%, -10%)
        doses_reelles = []
        for jour in range(1, 8):
            dose_theo = doses_theo[jour - 1]['dose_g']

            if jour <= 4:
                # Conforme (±5%)
                dose_reelle = dose_theo * (1 + (jour % 2) * 0.05 - 0.025)
            else:
                # Écarts significatifs
                ecarts = {5: -0.15, 6: -0.20, 7: -0.10}
                dose_reelle = dose_theo * (1 + ecarts[jour])

            doses_reelles.append({
                "jour_gavage": jour,
                "dose_reelle_g": round(dose_reelle, 1),
                "dose_theorique_g": dose_theo
            })

        # Envoyer doses via API
        for dose_data in doses_reelles:
            response = requests.post(
                f"{BASE_URL}/api/courbes/reelle/lot/{self.lot_id}/jour",
                json={
                    "jour_gavage": dose_data['jour_gavage'],
                    "dose_reelle_g": dose_data['dose_reelle_g'],
                    "notes": f"Test E2E - Jour {dose_data['jour_gavage']}"
                }
            )
            assert response.status_code in [200, 201]

        print(f"✓ {len(doses_reelles)} doses réelles saisies (jours 1-7)")
        print(f"  Jours 1-4: conformes")
        print(f"  Jours 5-7: écarts -15%, -20%, -10%")

        # Vérifier détection écarts
        response = requests.get(f"{BASE_URL}/api/courbes/reelle/lot/{self.lot_id}/avec-alertes")
        assert response.status_code == 200
        courbe_reelle = response.json()

        alertes = [d for d in courbe_reelle if d.get('alerte_ecart', False)]
        assert len(alertes) >= 2, f"Attendu ≥2 alertes, obtenu {len(alertes)}"
        print(f"✓ {len(alertes)} alertes écart détectées")

    def test_04_generer_courbe_predictive_v2(self):
        """Étape 3: Générer courbe prédictive avec algorithme v2"""
        assert self.lot_id is not None, "Lot non créé"

        # Appeler endpoint courbe prédictive
        response = requests.get(f"{BASE_URL}/api/courbes/predictive/lot/{self.lot_id}")
        assert response.status_code == 200
        pred_data = response.json()

        # Vérifier structure
        assert pred_data['lot_id'] == self.lot_id
        assert pred_data['a_des_ecarts'] is True
        assert pred_data['algorithme'] == 'v2_spline_cubique_contraintes'
        assert pred_data['dernier_jour_reel'] == 7

        # Vérifier courbe prédictive
        courbe_pred = pred_data['courbe_predictive']
        assert len(courbe_pred) == 14  # Jours 1-14

        # Jours 1-7 doivent être les doses réelles
        # Jours 8-14 doivent être les prédictions v2
        doses_futures = [d['dose_g'] for d in courbe_pred[7:]]  # Jours 8-14
        assert len(doses_futures) == 7

        # Vérifier contraintes vétérinaires v2
        for i in range(len(doses_futures) - 1):
            increment = doses_futures[i + 1] - doses_futures[i]
            assert -50 <= increment <= 50, f"Incrément hors limites: {increment}g"
            assert 200 <= doses_futures[i] <= 800, f"Dose hors limites: {doses_futures[i]}g"

        # Vérifier progression lisse (spline cubique)
        # La variance des incréments doit être faible pour une courbe lisse
        increments = [doses_futures[i + 1] - doses_futures[i] for i in range(len(doses_futures) - 1)]
        variance = sum((x - sum(increments) / len(increments)) ** 2 for x in increments) / len(increments)
        assert variance < 200, f"Courbe pas assez lisse (variance: {variance})"

        print(f"✓ Courbe prédictive v2 générée")
        print(f"  Algorithme: {pred_data['algorithme']}")
        print(f"  Jours 8-14 (prédictions): {doses_futures[0]:.1f}g → {doses_futures[-1]:.1f}g")
        print(f"  Variance incréments: {variance:.2f} (lisse)")

    def test_05_dashboard_3_courbes(self):
        """Étape 4: Récupérer dashboard 3-courbes complet"""
        assert self.lot_id is not None, "Lot non créé"

        # Récupérer les 3 courbes
        # 1. Courbe théorique
        response = requests.get(f"{BASE_URL}/api/courbes/theorique/lot/{self.lot_id}")
        assert response.status_code == 200
        courbe_theo = response.json()

        # 2. Courbe réelle
        response = requests.get(f"{BASE_URL}/api/courbes/reelle/lot/{self.lot_id}")
        assert response.status_code == 200
        courbe_reelle = response.json()

        # 3. Courbe prédictive
        response = requests.get(f"{BASE_URL}/api/courbes/predictive/lot/{self.lot_id}")
        assert response.status_code == 200
        courbe_pred = response.json()

        # Vérifier cohérence des 3 courbes
        doses_theo = courbe_theo['courbe_theorique']
        if isinstance(doses_theo, str):
            import json
            doses_theo = json.loads(doses_theo)

        assert len(doses_theo) == 14, "Courbe théorique incomplète"
        assert len(courbe_reelle) >= 7, "Courbe réelle insuffisante"
        assert len(courbe_pred['courbe_predictive']) == 14, "Courbe prédictive incomplète"

        # Vérifier que courbe prédictive suit les doses réelles pour jours passés
        for jour in range(1, 8):  # Jours 1-7
            dose_reelle = next(d for d in courbe_reelle if d['jour_gavage'] == jour)
            dose_pred = next(d for d in courbe_pred['courbe_predictive'] if d['jour'] == jour)
            # Doses réelles et prédictives doivent être identiques pour jours passés
            assert abs(dose_pred['dose_g'] - dose_reelle['dose_reelle_g']) < 0.5

        print("✓ Dashboard 3-courbes complet")
        print(f"  1. Courbe Théorique PySR v2: {len(doses_theo)} jours")
        print(f"  2. Courbe Réelle: {len(courbe_reelle)} jours saisis")
        print(f"  3. Courbe Prédictive v2: {courbe_pred['dernier_jour_reel']} réels + {14 - courbe_pred['dernier_jour_reel']} prédits")

    def test_06_comparaison_v1_vs_v2(self):
        """Bonus: Comparer algorithme v1 vs v2 (si données disponibles)"""
        # Ce test vérifie que v2 produit des courbes plus lisses que v1

        # Pour l'instant, on vérifie juste que l'endpoint utilise bien v2
        assert self.lot_id is not None, "Lot non créé"

        response = requests.get(f"{BASE_URL}/api/courbes/predictive/lot/{self.lot_id}")
        assert response.status_code == 200
        pred_data = response.json()

        # Vérifier qu'on utilise bien v2
        assert pred_data['algorithme'] == 'v2_spline_cubique_contraintes'
        assert 'courbe_theorique' not in pred_data['algorithme']  # Pas le mode fallback

        print("✓ Algorithme v2 confirmé (vs v1 interpolation linéaire)")
        print(f"  v1: correction_lineaire_lissee (80/20)")
        print(f"  v2: {pred_data['algorithme']} (spline + contraintes)")


def test_workflow_complet():
    """Test intégration complète 3-courbes"""
    test_suite = Test3CourbesWorkflow()
    test_suite.setup()

    print("\n" + "=" * 70)
    print("TEST E2E - WORKFLOW 3-COURBES COMPLET (Sprint 6A)")
    print("=" * 70 + "\n")

    try:
        test_suite.test_01_health_check()
        test_suite.test_02_generer_courbe_theorique_pysr_v2()
        test_suite.test_03_saisir_doses_reelles_avec_ecarts()
        test_suite.test_04_generer_courbe_predictive_v2()
        test_suite.test_05_dashboard_3_courbes()
        test_suite.test_06_comparaison_v1_vs_v2()

        print("\n" + "=" * 70)
        print("✓ TOUS LES TESTS PASSÉS - WORKFLOW 3-COURBES OPÉRATIONNEL")
        print("=" * 70 + "\n")

    except AssertionError as e:
        print(f"\n✗ TEST ÉCHOUÉ: {e}")
        raise
    except Exception as e:
        print(f"\n✗ ERREUR: {e}")
        raise


if __name__ == "__main__":
    test_workflow_complet()
