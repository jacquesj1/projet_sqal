# 🧪 Guide des Tests - Backend API

## Vue d'ensemble

Ce guide décrit la stratégie de tests pour le backend API du système Gaveurs V3.0.

**Objectif**: Atteindre **>80% de couverture de code** avec des tests fiables et maintenables.

---

## 📁 Structure des Tests

```
backend-api/
├── tests/
│   ├── conftest.py                    # Fixtures partagées
│   ├── unit/                          # Tests unitaires (fast, isolated)
│   │   ├── test_blockchain_consumer_feedback.py    # 10 tests blockchain
│   │   ├── test_consumer_feedback_service.py       # 15 tests service
│   │   ├── test_api_consumer_feedback.py           # 23 tests API
│   │   ├── test_euralis_service.py                 # À créer
│   │   ├── test_sqal_service.py                    # À créer
│   │   └── test_ml_modules.py                      # À créer
│   ├── integration/                   # Tests d'intégration (DB, external services)
│   │   ├── test_db_operations.py                   # À créer
│   │   ├── test_websocket_flow.py                  # À créer
│   │   └── test_blockchain_integrity.py            # À créer
│   └── e2e/                           # Tests end-to-end (full stack)
│       ├── test_complete_flow.py                   # Existant
│       ├── test_consumer_journey.py                # À créer
│       └── test_euralis_workflow.py                # À créer
├── pytest.ini                         # Configuration pytest
├── run_tests.sh                       # Script Linux/Mac
└── run_tests.bat                      # Script Windows
```

---

## 🎯 Tests Créés (Phase 3 - Partie 1)

### 1. Configuration Pytest ([pytest.ini](../backend-api/pytest.ini))

**Markers définis**:
- `unit`: Tests unitaires rapides
- `integration`: Tests nécessitant DB
- `e2e`: Tests end-to-end complets
- `blockchain`: Tests blockchain
- `websocket`: Tests WebSocket
- `ml`: Tests machine learning
- `slow`: Tests > 1s

**Coverage cible**: 80%

**Options**:
- Async support (asyncio_mode = auto)
- HTML + XML coverage reports
- Verbose output
- Stop on first failure (--maxfail=1)

### 2. Fixtures Partagées ([tests/conftest.py](../backend-api/tests/conftest.py))

**Database Fixtures**:
- `db_pool`: Pool de connexions PostgreSQL pour session
- `db_conn`: Connexion unique avec transaction rollback

**HTTP Client Fixtures**:
- `client`: HTTP client pour tests API
- `auth_client`: HTTP client authentifié (futur Keycloak)

**Mock Data Fixtures**:
- `mock_gaveur_data`: Données gaveur de test
- `mock_canard_data`: Données canard de test
- `mock_gavage_data`: Données gavage de test
- `mock_lot_gavage_data`: Données lot Euralis de test
- `mock_sqal_sample_data`: Données capteurs SQAL de test
- `mock_consumer_feedback_data`: Données feedback consommateur de test

### 3. Tests Blockchain Consumer Feedback (10 tests)

**Fichier**: [tests/unit/test_blockchain_consumer_feedback.py](../backend-api/tests/unit/test_blockchain_consumer_feedback.py)

| # | Test | Description |
|---|------|-------------|
| 01 | `test_01_blockchain_initialization` | Initialisation blockchain |
| 02 | `test_02_add_sqal_quality_event` | Événement SQAL quality control |
| 03 | `test_03_add_consumer_product_event` | Événement consumer product registration |
| 04 | `test_04_verify_valid_blockchain_hash` | Vérification hash valide |
| 05 | `test_05_verify_invalid_blockchain_hash` | Rejet hash invalide |
| 06 | `test_06_blockchain_integrity` | Intégrité chaîne complète |
| 07 | `test_07_blockchain_chaining` | Chaînage correct des blocs |
| 08 | `test_08_sqal_event_data_integrity` | Intégrité données SQAL |
| 09 | `test_09_product_certifications_storage` | Stockage certifications |
| 10 | `test_10_multiple_sites_blockchain` | Support multi-sites (LL/LS/MT) |

**Couverture**:
- `blockchain_service.py`: Méthodes consumer feedback

### 4. Tests Consumer Feedback Service (15 tests)

**Fichier**: [tests/unit/test_consumer_feedback_service.py](../backend-api/tests/unit/test_consumer_feedback_service.py)

**Tests fonctionnels**:
- Initialisation service
- Scan QR code (valide/invalide)
- Traçabilité produit
- Insights feedback
- Analytics
- Liaison blockchain
- Données ML

**Tests validation**:
- Plage de notes (1-5)
- Format product_id
- Format QR code
- Codes sites (LL/LS/MT)
- Longueur commentaires

**Couverture**:
- `consumer_feedback_service.py`: Méthodes principales

### 5. Tests API Consumer Feedback (23 tests)

**Fichier**: [tests/unit/test_api_consumer_feedback.py](../backend-api/tests/unit/test_api_consumer_feedback.py)

**Endpoints testés**:
- `GET /api/consumer/scan/{qr_code}`
- `POST /api/consumer/feedback`
- `GET /api/consumer/feedback/statistics`
- `GET /api/consumer/blockchain/verify/{hash}`
- `GET /api/consumer/blockchain/product/{id}/history`
- `GET /api/consumer/ml/training-data`
- `GET /api/consumer/ml/insights`
- `POST /api/consumer/internal/register-product`

**Tests validation API**:
- Ratings hors limites
- Champs requis manquants
- Codes sites invalides
- Formats de dates invalides

**Tests performance**:
- Scan QR < 500ms
- Vérification blockchain < 1s
- Statistiques < 2s

---

## 🚀 Exécution des Tests

### Linux/Mac

```bash
cd backend-api

# Tous les tests
./run_tests.sh all

# Tests unitaires uniquement
./run_tests.sh unit

# Tests blockchain
./run_tests.sh blockchain

# Coverage report
./run_tests.sh coverage
```

### Windows

```cmd
cd backend-api

REM Tous les tests
run_tests.bat all

REM Tests unitaires uniquement
run_tests.bat unit

REM Tests blockchain
run_tests.bat blockchain

REM Coverage report
run_tests.bat coverage
```

### Commandes Pytest Directes

```bash
# Activate venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows

# Run specific test file
pytest tests/unit/test_blockchain_consumer_feedback.py -v

# Run specific test
pytest tests/unit/test_blockchain_consumer_feedback.py::TestBlockchainConsumerFeedback::test_01_blockchain_initialization -v

# Run with markers
pytest -m unit -v
pytest -m blockchain -v

# Coverage report
pytest --cov=app --cov-report=html
# Open htmlcov/index.html
```

---

## 📊 État Actuel des Tests

### ✅ Complété

| Catégorie | Fichiers | Tests | Status |
|-----------|----------|-------|--------|
| **Blockchain Consumer** | 1 | 10 | ✅ |
| **Consumer Feedback Service** | 1 | 15 | ✅ |
| **Consumer Feedback API** | 1 | 23 | ✅ |
| **Configuration** | pytest.ini, conftest.py | - | ✅ |
| **Scripts** | run_tests.sh, .bat | - | ✅ |
| **TOTAL** | **5 fichiers** | **48 tests** | ✅ |

### ⏳ À Créer (Phase 3 - Partie 2)

| Catégorie | Tests estimés | Priorité |
|-----------|---------------|----------|
| **Euralis Service** | ~20 tests | Haute |
| **Euralis API** | ~25 tests | Haute |
| **SQAL Service** | ~15 tests | Haute |
| **SQAL API** | ~20 tests | Haute |
| **ML Modules** | ~30 tests | Moyenne |
| **WebSocket** | ~10 tests | Haute |
| **Integration Tests** | ~15 tests | Moyenne |
| **E2E Tests** | ~10 tests | Moyenne |
| **TOTAL** | **~145 tests** | - |

### 🎯 Objectif Final

**193 tests backend** pour >80% coverage

---

## 🔧 Bonnes Pratiques

### 1. Isolation des Tests

```python
@pytest.fixture
async def db_conn(db_pool):
    """Transaction rollback automatique après chaque test"""
    async with db_pool.acquire() as conn:
        transaction = conn.transaction()
        await transaction.start()
        yield conn
        await transaction.rollback()  # ⭐ Pas de pollution
```

### 2. Async Tests

```python
@pytest.mark.asyncio  # ⭐ Requis pour tests async
async def test_my_async_function():
    result = await my_async_func()
    assert result is not None
```

### 3. Markers

```python
@pytest.mark.unit       # Test rapide, isolé
@pytest.mark.blockchain # Test blockchain
@pytest.mark.slow       # Test > 1s
async def test_something():
    pass
```

### 4. Fixtures Paramétrées

```python
@pytest.mark.parametrize("site_code,expected", [
    ("LL", True),
    ("LS", True),
    ("MT", True),
    ("XX", False)
])
def test_site_codes(site_code, expected):
    result = validate_site(site_code)
    assert result == expected
```

### 5. Mock External Services

```python
@pytest.fixture
def mock_blockchain():
    """Mock blockchain service pour tests rapides"""
    blockchain = MagicMock()
    blockchain.initialise = True
    return blockchain
```

---

## 🐛 Debugging Tests

### Verbose Output

```bash
pytest -v -s  # -s shows print statements
```

### Run Single Test

```bash
pytest tests/unit/test_blockchain_consumer_feedback.py::TestBlockchainConsumerFeedback::test_01_blockchain_initialization -v
```

### Show Full Traceback

```bash
pytest --tb=long
```

### Stop on First Failure

```bash
pytest -x
```

### Show Test Duration

```bash
pytest --durations=10  # Show 10 slowest tests
```

---

## 📈 Coverage Report

### Generate HTML Report

```bash
pytest --cov=app --cov-report=html
```

**Output**: `htmlcov/index.html`

### Coverage Thresholds

```ini
# pytest.ini
[pytest]
addopts = --cov-fail-under=80
```

Échouera si coverage < 80%

### Exclude Files from Coverage

```ini
# .coveragerc
[run]
omit =
    */tests/*
    */migrations/*
    */__pycache__/*
```

---

## 🔄 CI/CD Integration (Phase 4)

Les tests seront intégrés dans GitHub Actions:

```yaml
# .github/workflows/tests.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install pytest pytest-asyncio pytest-cov
      - name: Run tests
        run: pytest --cov=app --cov-report=xml
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

---

## 📝 Prochaines Étapes

1. ✅ **Phase 3.1** : Tests Backend Consumer Feedback (FAIT)
2. ⏳ **Phase 3.2** : Tests Backend Euralis (À FAIRE)
3. ⏳ **Phase 3.3** : Tests Backend SQAL (À FAIRE)
4. ⏳ **Phase 3.4** : Tests Backend ML (À FAIRE)
5. ⏳ **Phase 3.5** : Tests WebSocket (À FAIRE)
6. ⏳ **Phase 3.6** : Tests E2E complets (À FAIRE)
7. ⏳ **Phase 3.7** : Coverage > 80% (À VÉRIFIER)

---

## 💡 Tips

- **Utilisez fixtures** pour éviter duplication de code
- **Groupez tests par classe** pour organisation
- **Nommez tests explicitement**: `test_01_description_claire`
- **Testez cas normaux ET cas d'erreur**
- **Mockez services externes** pour tests rapides
- **Vérifiez performance** (temps de réponse API)
- **Documentez tests complexes** avec docstrings

---

**Status**: 48 tests créés ✅ | 145 tests restants ⏳ | Cible: 193 tests 🎯
