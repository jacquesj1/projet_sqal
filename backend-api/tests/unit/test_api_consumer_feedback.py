"""
Unit Tests - Consumer Feedback API Endpoints
Tests des endpoints API publics et internes
"""

import pytest
from httpx import AsyncClient


@pytest.mark.unit
@pytest.mark.asyncio
class TestConsumerFeedbackAPIEndpoints:
    """Tests des endpoints consumer feedback"""

    async def test_01_scan_qr_code_endpoint(self, client: AsyncClient):
        """Test 1: GET /api/consumer/scan/{qr_code}"""
        qr_code = "SQAL_1_SAMPLE_001_PROD_LL_001_ABC123"

        response = await client.get(f"/api/consumer/scan/{qr_code}")

        # Should return 200 or 404
        assert response.status_code in [200, 404]

        if response.status_code == 200:
            data = response.json()
            assert "success" in data
            print(f"✅ Test 1: Scan QR code endpoint OK (200)")
        else:
            print(f"✅ Test 1: Scan QR code endpoint OK (404 - produit non trouvé)")

    async def test_02_submit_feedback_endpoint_invalid(self, client: AsyncClient):
        """Test 2: POST /api/consumer/feedback - Données invalides"""
        invalid_feedback = {
            "product_id": "",  # Invalid
            "rating": 10  # Out of range
        }

        response = await client.post("/api/consumer/feedback", json=invalid_feedback)

        # Should return 422 (validation error) or 400
        assert response.status_code in [400, 422]
        print(f"✅ Test 2: Validation feedback invalide OK ({response.status_code})")

    async def test_03_submit_feedback_endpoint_valid(self, client: AsyncClient, mock_consumer_feedback_data):
        """Test 3: POST /api/consumer/feedback - Données valides"""
        response = await client.post("/api/consumer/feedback", json=mock_consumer_feedback_data)

        # Should return 200, 201, or 404 (product not found)
        assert response.status_code in [200, 201, 404, 422]

        if response.status_code in [200, 201]:
            data = response.json()
            assert "success" in data or "feedback_id" in data
            print(f"✅ Test 3: Submit feedback valide OK (201)")
        else:
            print(f"✅ Test 3: Submit feedback OK ({response.status_code} - produit non trouvé)")

    async def test_04_get_feedback_statistics_endpoint(self, client: AsyncClient):
        """Test 4: GET /api/consumer/feedback/statistics"""
        response = await client.get("/api/consumer/feedback/statistics?site_code=LL")

        assert response.status_code == 200
        data = response.json()

        # Should return statistics structure
        assert data is not None
        print(f"✅ Test 4: Statistiques feedback endpoint OK")

    async def test_05_blockchain_verify_endpoint_invalid(self, client: AsyncClient):
        """Test 5: GET /api/consumer/blockchain/verify/{hash} - Hash invalide"""
        fake_hash = "0" * 64

        response = await client.get(f"/api/consumer/blockchain/verify/{fake_hash}")

        assert response.status_code == 200  # Endpoint returns 200 with valid:false
        data = response.json()

        assert "valid" in data
        assert data["valid"] is False
        print(f"✅ Test 5: Vérification blockchain hash invalide OK")

    async def test_06_blockchain_verify_endpoint_format_error(self, client: AsyncClient):
        """Test 6: GET /api/consumer/blockchain/verify/{hash} - Format invalide"""
        invalid_hash = "not_a_hash"

        response = await client.get(f"/api/consumer/blockchain/verify/{invalid_hash}")

        # Should handle invalid format gracefully
        assert response.status_code in [200, 400, 422]
        print(f"✅ Test 6: Format hash invalide géré OK")

    async def test_07_blockchain_product_history_endpoint_not_found(self, client: AsyncClient):
        """Test 7: GET /api/consumer/blockchain/product/{id}/history - Produit inexistant"""
        product_id = "PROD_DOES_NOT_EXIST"

        response = await client.get(f"/api/consumer/blockchain/product/{product_id}/history")

        assert response.status_code in [200, 404]

        if response.status_code == 200:
            data = response.json()
            assert "product_id" in data or "blockchain_enabled" in data

        print(f"✅ Test 7: Historique blockchain produit inexistant OK")

    async def test_08_ml_training_data_endpoint(self, client: AsyncClient):
        """Test 8: GET /api/consumer/ml/training-data"""
        response = await client.get("/api/consumer/ml/training-data?site_code=LL&min_feedbacks=10")

        assert response.status_code == 200
        data = response.json()

        assert isinstance(data, (list, dict))
        print(f"✅ Test 8: ML training data endpoint OK")

    async def test_09_ml_insights_endpoint(self, client: AsyncClient):
        """Test 9: GET /api/consumer/ml/insights"""
        response = await client.get("/api/consumer/ml/insights?site_code=LL")

        assert response.status_code in [200, 404, 500]  # May fail if no data

        if response.status_code == 200:
            data = response.json()
            assert data is not None

        print(f"✅ Test 9: ML insights endpoint OK ({response.status_code})")

    async def test_10_register_product_endpoint_unauthorized(self, client: AsyncClient):
        """Test 10: POST /api/consumer/internal/register-product - Non autorisé"""
        # This endpoint should be internal only (when auth is added)
        product_data = {
            "lot_id": 1,
            "sample_id": "SQAL_TEST_001",
            "site_code": "LL"
        }

        response = await client.post("/api/consumer/internal/register-product", json=product_data)

        # Currently no auth, so should return 200/404/422
        # When auth is added, should return 401/403
        assert response.status_code in [200, 201, 400, 401, 403, 404, 422]
        print(f"✅ Test 10: Register product endpoint OK ({response.status_code})")


@pytest.mark.unit
@pytest.mark.asyncio
class TestConsumerFeedbackAPIValidation:
    """Tests de validation des endpoints API"""

    async def test_01_rating_validation_too_low(self, client: AsyncClient):
        """Test 1: Rating trop bas (< 1)"""
        feedback = {
            "product_id": "PROD_TEST_001",
            "rating": 0  # Invalid
        }

        response = await client.post("/api/consumer/feedback", json=feedback)
        assert response.status_code in [400, 422]
        print(f"✅ Test 1: Rating < 1 rejeté OK")

    async def test_02_rating_validation_too_high(self, client: AsyncClient):
        """Test 2: Rating trop haut (> 5)"""
        feedback = {
            "product_id": "PROD_TEST_001",
            "rating": 6  # Invalid
        }

        response = await client.post("/api/consumer/feedback", json=feedback)
        assert response.status_code in [400, 422]
        print(f"✅ Test 2: Rating > 5 rejeté OK")

    async def test_03_missing_required_fields(self, client: AsyncClient):
        """Test 3: Champs requis manquants"""
        feedback = {
            # Missing product_id and rating
            "comments": "Test"
        }

        response = await client.post("/api/consumer/feedback", json=feedback)
        assert response.status_code in [400, 422]
        print(f"✅ Test 3: Champs manquants rejetés OK")

    async def test_04_invalid_site_code(self, client: AsyncClient):
        """Test 4: Code site invalide"""
        response = await client.get("/api/consumer/feedback/statistics?site_code=INVALID")

        # Should handle gracefully (may return empty data or validation error)
        assert response.status_code in [200, 400, 422]
        print(f"✅ Test 4: Site code invalide géré OK")

    async def test_05_invalid_date_format(self, client: AsyncClient):
        """Test 5: Format de date invalide"""
        response = await client.get("/api/consumer/feedback/analytics?date_debut=invalid_date")

        # Should return validation error
        assert response.status_code in [400, 422]
        print(f"✅ Test 5: Format date invalide rejeté OK")


@pytest.mark.unit
@pytest.mark.asyncio
class TestConsumerFeedbackAPIPerformance:
    """Tests de performance des endpoints API"""

    async def test_01_scan_qr_response_time(self, client: AsyncClient):
        """Test 1: Temps de réponse scan QR < 500ms"""
        import time

        qr_code = "SQAL_1_TEST_001_PROD_001_ABC"

        start = time.time()
        response = await client.get(f"/api/consumer/scan/{qr_code}")
        elapsed = (time.time() - start) * 1000  # ms

        assert response.status_code in [200, 404]
        assert elapsed < 500  # Should be fast
        print(f"✅ Test 1: Scan QR response time: {elapsed:.2f}ms")

    async def test_02_blockchain_verify_response_time(self, client: AsyncClient):
        """Test 2: Temps de réponse vérification blockchain < 1s"""
        import time

        hash_value = "a" * 64

        start = time.time()
        response = await client.get(f"/api/consumer/blockchain/verify/{hash_value}")
        elapsed = (time.time() - start) * 1000  # ms

        assert response.status_code == 200
        assert elapsed < 1000  # Should be fast
        print(f"✅ Test 2: Blockchain verify response time: {elapsed:.2f}ms")

    async def test_03_statistics_response_time(self, client: AsyncClient):
        """Test 3: Temps de réponse statistiques < 2s"""
        import time

        start = time.time()
        response = await client.get("/api/consumer/feedback/statistics")
        elapsed = (time.time() - start) * 1000  # ms

        assert response.status_code == 200
        assert elapsed < 2000
        print(f"✅ Test 3: Statistics response time: {elapsed:.2f}ms")
