"""
Pytest Configuration & Fixtures
Shared fixtures for all tests
"""

import pytest
import asyncio
import asyncpg
from typing import AsyncGenerator, Generator
from httpx import AsyncClient
import os

import sys
from pathlib import Path

_BACKEND_API_DIR = Path(__file__).resolve().parents[1]
if str(_BACKEND_API_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_API_DIR))

from app.main import app


# ============================================================================
# Database Fixtures
# ============================================================================

@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """Create event loop for async tests"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def db_pool() -> AsyncGenerator[asyncpg.Pool, None]:
    """Create database connection pool for tests"""
    database_url = os.getenv("TEST_DATABASE_URL")
    if not database_url:
        pytest.skip("TEST_DATABASE_URL not set; skipping DB-dependent tests")

    try:
        pool = await asyncpg.create_pool(database_url, min_size=2, max_size=10)
    except Exception as exc:
        pytest.skip(f"Could not connect to TEST_DATABASE_URL; skipping DB-dependent tests: {exc}")

    # Setup: Create test tables if needed
    async with pool.acquire() as conn:
        # Verify connection
        await conn.fetchval("SELECT 1")

    yield pool

    # Teardown: Close pool
    await pool.close()


@pytest.fixture
async def db_conn(db_pool: asyncpg.Pool) -> AsyncGenerator[asyncpg.Connection, None]:
    """Get single database connection for a test"""
    async with db_pool.acquire() as conn:
        # Start transaction
        transaction = conn.transaction()
        await transaction.start()

        yield conn

        # Rollback transaction (keeps tests isolated)
        await transaction.rollback()


# ============================================================================
# HTTP Client Fixtures
# ============================================================================

@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    """Create HTTP client for testing API endpoints"""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def auth_client() -> AsyncGenerator[AsyncClient, None]:
    """Create authenticated HTTP client (for future Keycloak tests)"""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        # TODO: Add authentication headers when Keycloak is integrated
        # ac.headers.update({"Authorization": "Bearer <token>"})
        yield ac


# ============================================================================
# Mock Data Fixtures
# ============================================================================

@pytest.fixture
def mock_gaveur_data() -> dict:
    """Mock gaveur data for testing"""
    return {
        "nom": "Dupont",
        "prenom": "Jean",
        "code_postal": "40000",
        "ville": "Mont-de-Marsan",
        "telephone": "0558123456",
        "email": "jean.dupont@example.com",
        "site_code": "LL"
    }


@pytest.fixture
def mock_canard_data() -> dict:
    """Mock canard data for testing"""
    return {
        "numero_identification": "FR40001234",
        "genetique": "Mulard",
        "sexe": "M",
        "date_naissance": "2024-11-01",
        "poids_initial": 4500,
        "origine_elevage": "Elevage du Sud"
    }


@pytest.fixture
def mock_gavage_data() -> dict:
    """Mock gavage data for testing"""
    return {
        "date": "2024-12-01",
        "jour_gavage": 1,
        "dose_matin": 250,
        "dose_soir": 250,
        "poids_canard": 4600,
        "etat_sante": "Bon",
        "observations": "RAS"
    }


@pytest.fixture
def mock_lot_gavage_data() -> dict:
    """Mock lot gavage data for Euralis"""
    return {
        "numero_lot": "LL2024001",
        "site_code": "LL",
        "souche_palmipede": "Mulard",
        "nb_palmipedes_entres": 100,
        "date_debut_gavage": "2024-12-01",
        "date_fin_gavage": "2024-12-14"
    }


@pytest.fixture
def mock_sqal_sample_data() -> dict:
    """Mock SQAL sensor sample data"""
    return {
        "device_id": "ESP32_LL_01",
        "sample_number": 1,
        "vl53l8ch_matrix": [[100] * 8 for _ in range(8)],
        "as7341_channels": {
            "415nm": 1000,
            "445nm": 1100,
            "480nm": 1200,
            "515nm": 1300,
            "555nm": 1400,
            "590nm": 1500,
            "630nm": 1600,
            "680nm": 1700,
            "clear": 12000,
            "nir": 800
        },
        "sqal_score": 95.5,
        "sqal_grade": "A+"
    }


@pytest.fixture
def mock_consumer_feedback_data() -> dict:
    """Mock consumer feedback data"""
    return {
        "product_id": "PROD_LL_001",
        "rating": 5,
        "texture_rating": 5,
        "taste_rating": 5,
        "presentation_rating": 4,
        "price_satisfaction": 4,
        "would_recommend": True,
        "comments": "Excellent produit, très satisfait !"
    }


# ============================================================================
# Cleanup Fixtures
# ============================================================================

@pytest.fixture(autouse=True)
async def cleanup_test_data(db_conn: asyncpg.Connection):
    """Cleanup test data after each test (if needed)"""
    yield
    # Rollback is handled by db_conn fixture
    # Additional cleanup can be added here if needed


# ============================================================================
# Environment Fixtures
# ============================================================================

@pytest.fixture(scope="session")
def test_settings():
    """Test environment settings"""
    return {
        "database_url": os.getenv(
            "TEST_DATABASE_URL",
            "postgresql://gaveurs_admin:gaveurs_secure_2024@localhost:5432/gaveurs_db_test"
        ),
        "testing": True,
        "debug": False,
        "log_level": "INFO"
    }
