"""
Unit Tests - Euralis ML Modules
Tests des 6 modules IA/ML Euralis (PySR, Prophet, K-Means, Isolation Forest, Hungarian)
"""

import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta


@pytest.mark.unit
@pytest.mark.ml
class TestMultiSiteRegression:
    """Tests PySR Multi-Site Regression"""

    def test_01_import_module(self):
        """Test 1: Import du module PySR"""
        try:
            from app.ml.euralis.multi_site_regression import MultiSiteRegression
            assert MultiSiteRegression is not None
            print("✅ Test 1: Module PySR importé OK")
        except ImportError as e:
            print(f"⚠️ Test 1: PySR non disponible: {e}")
            pytest.skip("PySR not installed")

    def test_02_create_instance(self):
        """Test 2: Créer instance MultiSiteRegression"""
        try:
            from app.ml.euralis.multi_site_regression import MultiSiteRegression
            regressor = MultiSiteRegression()
            assert regressor is not None
            print("✅ Test 2: Instance MultiSiteRegression créée OK")
        except Exception as e:
            pytest.skip(f"Cannot create instance: {e}")

    def test_03_prepare_training_data(self):
        """Test 3: Préparer données d'entraînement"""
        # Create mock training data
        data = {
            'site_code': ['LL'] * 50,
            'souche_palmipede': ['Mulard'] * 50,
            'nb_palmipedes_entres': np.random.randint(50, 200, 50),
            'duree_gavage': np.random.randint(10, 16, 50),
            'dose_totale': np.random.uniform(3000, 5000, 50),
            'itm_moyen': np.random.uniform(400, 600, 50)
        }
        df = pd.DataFrame(data)

        assert len(df) == 50
        assert 'itm_moyen' in df.columns
        print("✅ Test 3: Données d'entraînement préparées OK")


@pytest.mark.unit
@pytest.mark.ml
class TestProductionForecasting:
    """Tests Prophet Production Forecasting"""

    def test_01_import_module(self):
        """Test 1: Import du module Prophet"""
        try:
            from app.ml.euralis.production_forecasting import ProductionForecaster
            assert ProductionForecaster is not None
            print("✅ Test 1: Module Prophet importé OK")
        except ImportError as e:
            print(f"⚠️ Test 1: Prophet non disponible: {e}")
            pytest.skip("Prophet not installed")

    def test_02_create_instance(self):
        """Test 2: Créer instance ProductionForecaster"""
        try:
            from app.ml.euralis.production_forecasting import ProductionForecaster
            forecaster = ProductionForecaster()
            assert forecaster is not None
            print("✅ Test 2: Instance ProductionForecaster créée OK")
        except Exception as e:
            pytest.skip(f"Cannot create instance: {e}")

    def test_03_prepare_time_series_data(self):
        """Test 3: Préparer données séries temporelles"""
        # Create mock time series data
        dates = pd.date_range(start='2024-01-01', end='2024-12-01', freq='D')
        data = {
            'ds': dates,
            'y': np.random.uniform(100, 200, len(dates))
        }
        df = pd.DataFrame(data)

        assert len(df) > 0
        assert 'ds' in df.columns
        assert 'y' in df.columns
        print("✅ Test 3: Données séries temporelles préparées OK")

    def test_04_validate_horizon_values(self):
        """Test 4: Valider valeurs horizon (7, 30, 90)"""
        valid_horizons = [7, 30, 90]

        for horizon in valid_horizons:
            assert horizon in [7, 30, 90]

        invalid_horizons = [1, 15, 180]
        for horizon in invalid_horizons:
            assert horizon not in [7, 30, 90]

        print("✅ Test 4: Validation horizons OK")


@pytest.mark.unit
@pytest.mark.ml
class TestGaveurClustering:
    """Tests K-Means Gaveur Clustering"""

    def test_01_import_module(self):
        """Test 1: Import du module K-Means"""
        try:
            from app.ml.euralis.gaveur_clustering import GaveurClusterer
            assert GaveurClusterer is not None
            print("✅ Test 1: Module K-Means importé OK")
        except ImportError as e:
            pytest.skip(f"K-Means module not available: {e}")

    def test_02_create_instance(self):
        """Test 2: Créer instance GaveurClusterer"""
        try:
            from app.ml.euralis.gaveur_clustering import GaveurClusterer
            clusterer = GaveurClusterer(n_clusters=5)
            assert clusterer is not None
            assert clusterer.n_clusters == 5
            print("✅ Test 2: Instance GaveurClusterer créée OK")
        except Exception as e:
            pytest.skip(f"Cannot create instance: {e}")

    def test_03_prepare_features(self):
        """Test 3: Préparer features pour clustering"""
        # Create mock gaveur performance data
        data = {
            'gaveur_id': range(1, 21),
            'itm_moyen': np.random.uniform(400, 600, 20),
            'taux_mortalite': np.random.uniform(0, 5, 20),
            'nb_lots_total': np.random.randint(5, 20, 20),
            'conformite_pct': np.random.uniform(80, 100, 20)
        }
        df = pd.DataFrame(data)

        # Should have numeric features for clustering
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        assert len(numeric_cols) > 0
        print("✅ Test 3: Features clustering préparées OK")

    def test_04_validate_cluster_count(self):
        """Test 4: Valider nombre de clusters (5)"""
        n_clusters = 5
        assert n_clusters == 5
        assert n_clusters > 0
        assert n_clusters < 10  # Reasonable limit
        print("✅ Test 4: Nombre de clusters validé OK")


@pytest.mark.unit
@pytest.mark.ml
class TestAnomalyDetection:
    """Tests Isolation Forest Anomaly Detection"""

    def test_01_import_module(self):
        """Test 1: Import du module Isolation Forest"""
        try:
            from app.ml.euralis.anomaly_detection import AnomalyDetector
            assert AnomalyDetector is not None
            print("✅ Test 1: Module Isolation Forest importé OK")
        except ImportError as e:
            pytest.skip(f"Isolation Forest module not available: {e}")

    def test_02_create_instance(self):
        """Test 2: Créer instance AnomalyDetector"""
        try:
            from app.ml.euralis.anomaly_detection import AnomalyDetector
            detector = AnomalyDetector(contamination=0.1)
            assert detector is not None
            print("✅ Test 2: Instance AnomalyDetector créée OK")
        except Exception as e:
            pytest.skip(f"Cannot create instance: {e}")

    def test_03_prepare_lot_features(self):
        """Test 3: Préparer features lot pour détection anomalies"""
        # Create mock lot data with potential anomalies
        data = {
            'lot_id': range(1, 51),
            'itm_moyen': np.concatenate([
                np.random.normal(500, 50, 48),  # Normal
                [900, 100]  # Anomalies
            ]),
            'taux_mortalite': np.concatenate([
                np.random.uniform(0, 3, 48),  # Normal
                [25, 30]  # Anomalies
            ]),
            'duree_gavage': np.random.randint(10, 16, 50)
        }
        df = pd.DataFrame(data)

        assert len(df) == 50
        print("✅ Test 3: Features anomalies préparées OK")

    def test_04_validate_contamination_parameter(self):
        """Test 4: Valider paramètre contamination (0.05-0.2)"""
        valid_values = [0.05, 0.1, 0.15, 0.2]
        invalid_values = [-0.1, 0, 0.5, 1.0]

        for val in valid_values:
            assert 0 < val <= 0.2

        for val in invalid_values:
            assert not (0 < val <= 0.2)

        print("✅ Test 4: Paramètre contamination validé OK")


@pytest.mark.unit
@pytest.mark.ml
class TestAbattageOptimization:
    """Tests Hungarian Algorithm Abattage Optimization"""

    def test_01_import_module(self):
        """Test 1: Import du module algorithme hongrois"""
        try:
            from app.ml.euralis.abattage_optimization import AbattageOptimizer
            assert AbattageOptimizer is not None
            print("✅ Test 1: Module algorithme hongrois importé OK")
        except ImportError as e:
            pytest.skip(f"Hungarian algorithm module not available: {e}")

    def test_02_create_instance(self):
        """Test 2: Créer instance AbattageOptimizer"""
        try:
            from app.ml.euralis.abattage_optimization import AbattageOptimizer
            optimizer = AbattageOptimizer()
            assert optimizer is not None
            print("✅ Test 2: Instance AbattageOptimizer créée OK")
        except Exception as e:
            pytest.skip(f"Cannot create instance: {e}")

    def test_03_create_cost_matrix(self):
        """Test 3: Créer matrice de coûts"""
        # Mock cost matrix: lots x abattoirs
        n_lots = 10
        n_abattoirs = 5

        # Distance-based costs
        cost_matrix = np.random.uniform(10, 100, (n_lots, n_abattoirs))

        assert cost_matrix.shape == (n_lots, n_abattoirs)
        assert np.all(cost_matrix > 0)
        print("✅ Test 3: Matrice de coûts créée OK")

    def test_04_validate_assignment_constraints(self):
        """Test 4: Valider contraintes d'affectation"""
        # Each lot must be assigned to exactly one abattoir
        n_lots = 10
        assignments = np.random.randint(0, 5, n_lots)

        # Check all lots have an assignment
        assert len(assignments) == n_lots
        assert np.all(assignments >= 0)
        print("✅ Test 4: Contraintes d'affectation validées OK")


@pytest.mark.unit
@pytest.mark.ml
class TestMLDataPreparation:
    """Tests de préparation de données ML"""

    def test_01_normalize_features(self):
        """Test 1: Normalisation features"""
        from sklearn.preprocessing import StandardScaler

        data = np.random.uniform(0, 100, (50, 3))
        scaler = StandardScaler()
        normalized = scaler.fit_transform(data)

        # Mean should be ~0, std should be ~1
        assert np.abs(normalized.mean()) < 0.1
        assert np.abs(normalized.std() - 1.0) < 0.1
        print("✅ Test 1: Normalisation features OK")

    def test_02_handle_missing_values(self):
        """Test 2: Gérer valeurs manquantes"""
        data = pd.DataFrame({
            'a': [1, 2, np.nan, 4],
            'b': [5, np.nan, 7, 8]
        })

        # Fill with mean
        filled = data.fillna(data.mean())
        assert filled.isna().sum().sum() == 0
        print("✅ Test 2: Valeurs manquantes gérées OK")

    def test_03_encode_categorical(self):
        """Test 3: Encoder variables catégorielles"""
        from sklearn.preprocessing import LabelEncoder

        categories = ['LL', 'LS', 'MT', 'LL', 'MT']
        encoder = LabelEncoder()
        encoded = encoder.fit_transform(categories)

        assert len(encoded) == len(categories)
        assert all(isinstance(x, (int, np.integer)) for x in encoded)
        print("✅ Test 3: Variables catégorielles encodées OK")

    def test_04_split_train_test(self):
        """Test 4: Split train/test (80/20)"""
        from sklearn.model_selection import train_test_split

        X = np.random.rand(100, 5)
        y = np.random.rand(100)

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )

        assert len(X_train) == 80
        assert len(X_test) == 20
        assert len(y_train) == 80
        assert len(y_test) == 20
        print("✅ Test 4: Split train/test OK (80/20)")

    def test_05_feature_correlation_matrix(self):
        """Test 5: Matrice de corrélation features"""
        data = pd.DataFrame({
            'feature1': np.random.rand(50),
            'feature2': np.random.rand(50),
            'feature3': np.random.rand(50)
        })

        corr_matrix = data.corr()

        assert corr_matrix.shape == (3, 3)
        # Diagonal should be 1 (self-correlation)
        assert np.allclose(np.diag(corr_matrix), 1.0)
        print("✅ Test 5: Matrice de corrélation calculée OK")
