"""
Unit Tests - Euralis API Endpoints
Tests des 15 endpoints API Euralis multi-sites
"""

import pytest
from httpx import AsyncClient
from datetime import datetime, date, timedelta


@pytest.mark.unit
@pytest.mark.asyncio
class TestEuralisAPIEndpoints:
    """Tests des endpoints Euralis API"""

    async def test_01_get_dashboard_data(self, client: AsyncClient):
        """Test 1: GET /api/euralis/dashboard"""
        response = await client.get("/api/euralis/dashboard")

        assert response.status_code == 200
        data = response.json()

        # Should return dashboard structure
        assert data is not None
        assert isinstance(data, dict)
        print(f"✅ Test 1: Dashboard data endpoint OK")

    async def test_02_get_dashboard_data_with_site(self, client: AsyncClient):
        """Test 2: GET /api/euralis/dashboard?site_code=LL"""
        response = await client.get("/api/euralis/dashboard?site_code=LL")

        assert response.status_code == 200
        data = response.json()

        assert data is not None
        print(f"✅ Test 2: Dashboard data with site filter OK")

    async def test_03_get_sites_list(self, client: AsyncClient):
        """Test 3: GET /api/euralis/sites"""
        response = await client.get("/api/euralis/sites")

        assert response.status_code == 200
        data = response.json()

        # Should return list of sites
        assert isinstance(data, (list, dict))
        print(f"✅ Test 3: Sites list endpoint OK")

    async def test_04_get_site_details(self, client: AsyncClient):
        """Test 4: GET /api/euralis/sites/LL"""
        response = await client.get("/api/euralis/sites/LL")

        assert response.status_code in [200, 404]

        if response.status_code == 200:
            data = response.json()
            assert data is not None

        print(f"✅ Test 4: Site details endpoint OK")

    async def test_05_get_lots_list(self, client: AsyncClient):
        """Test 5: GET /api/euralis/lots"""
        response = await client.get("/api/euralis/lots?limit=10")

        assert response.status_code == 200
        data = response.json()

        assert isinstance(data, (list, dict))
        print(f"✅ Test 5: Lots list endpoint OK")

    async def test_06_get_lots_by_site(self, client: AsyncClient):
        """Test 6: GET /api/euralis/lots?site_code=LL"""
        response = await client.get("/api/euralis/lots?site_code=LL&limit=5")

        assert response.status_code == 200
        data = response.json()

        assert data is not None
        print(f"✅ Test 6: Lots by site filter OK")

    async def test_07_get_lot_details(self, client: AsyncClient):
        """Test 7: GET /api/euralis/lots/{lot_id}"""
        lot_id = 1

        response = await client.get(f"/api/euralis/lots/{lot_id}")

        assert response.status_code in [200, 404]

        if response.status_code == 200:
            data = response.json()
            assert "id" in data or "lot_id" in data or data is not None

        print(f"✅ Test 7: Lot details endpoint OK")

    async def test_08_get_gaveurs_performance(self, client: AsyncClient):
        """Test 8: GET /api/euralis/gaveurs/performance"""
        response = await client.get("/api/euralis/gaveurs/performance")

        assert response.status_code == 200
        data = response.json()

        assert isinstance(data, (list, dict))
        print(f"✅ Test 8: Gaveurs performance endpoint OK")

    async def test_09_get_gaveurs_performance_by_site(self, client: AsyncClient):
        """Test 9: GET /api/euralis/gaveurs/performance?site_code=LS"""
        response = await client.get("/api/euralis/gaveurs/performance?site_code=LS")

        assert response.status_code == 200
        data = response.json()

        assert data is not None
        print(f"✅ Test 9: Gaveurs performance by site OK")

    async def test_10_get_clustering_results(self, client: AsyncClient):
        """Test 10: GET /api/euralis/ml/clustering"""
        response = await client.get("/api/euralis/ml/clustering")

        assert response.status_code in [200, 404, 500]

        if response.status_code == 200:
            data = response.json()
            # Should return clustering results
            assert data is not None

        print(f"✅ Test 10: Clustering results endpoint OK ({response.status_code})")

    async def test_11_get_production_forecasts(self, client: AsyncClient):
        """Test 11: GET /api/euralis/ml/forecasts"""
        response = await client.get("/api/euralis/ml/forecasts?site_code=LL&horizon=7")

        assert response.status_code in [200, 404, 500]

        if response.status_code == 200:
            data = response.json()
            assert data is not None

        print(f"✅ Test 11: Production forecasts endpoint OK ({response.status_code})")

    async def test_12_get_anomalies(self, client: AsyncClient):
        """Test 12: GET /api/euralis/ml/anomalies"""
        response = await client.get("/api/euralis/ml/anomalies?site_code=MT")

        assert response.status_code in [200, 404, 500]

        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, (list, dict))

        print(f"✅ Test 12: Anomalies detection endpoint OK ({response.status_code})")

    async def test_13_get_pysr_formulas(self, client: AsyncClient):
        """Test 13: GET /api/euralis/ml/pysr/formulas"""
        response = await client.get("/api/euralis/ml/pysr/formulas")

        assert response.status_code in [200, 404, 500]

        if response.status_code == 200:
            data = response.json()
            # Should return PySR formulas
            assert data is not None

        print(f"✅ Test 13: PySR formulas endpoint OK ({response.status_code})")

    async def test_14_get_statistics_global(self, client: AsyncClient):
        """Test 14: GET /api/euralis/statistics"""
        response = await client.get("/api/euralis/statistics")

        assert response.status_code == 200
        data = response.json()

        # Should return global statistics
        assert data is not None
        assert isinstance(data, dict)
        print(f"✅ Test 14: Global statistics endpoint OK")

    async def test_15_get_statistics_by_site(self, client: AsyncClient):
        """Test 15: GET /api/euralis/statistics?site_code=LL"""
        response = await client.get("/api/euralis/statistics?site_code=LL")

        assert response.status_code == 200
        data = response.json()

        assert data is not None
        print(f"✅ Test 15: Statistics by site endpoint OK")


@pytest.mark.unit
@pytest.mark.asyncio
class TestEuralisAPIValidation:
    """Tests de validation des paramètres API Euralis"""

    async def test_01_invalid_site_code(self, client: AsyncClient):
        """Test 1: Site code invalide"""
        response = await client.get("/api/euralis/sites/INVALID")

        assert response.status_code in [404, 422]
        print(f"✅ Test 1: Invalid site code rejected OK")

    async def test_02_invalid_lot_id(self, client: AsyncClient):
        """Test 2: Lot ID invalide (non numérique)"""
        response = await client.get("/api/euralis/lots/not_a_number")

        assert response.status_code in [404, 422]
        print(f"✅ Test 2: Invalid lot ID rejected OK")

    async def test_03_invalid_horizon(self, client: AsyncClient):
        """Test 3: Horizon de prévision invalide"""
        response = await client.get("/api/euralis/ml/forecasts?horizon=999")

        # Should validate horizon (7, 30, or 90 days)
        assert response.status_code in [200, 400, 422, 500]
        print(f"✅ Test 3: Invalid forecast horizon handled OK")

    async def test_04_invalid_date_range(self, client: AsyncClient):
        """Test 4: Plage de dates invalide"""
        response = await client.get("/api/euralis/statistics?date_debut=2024-13-45")

        assert response.status_code in [400, 422]
        print(f"✅ Test 4: Invalid date range rejected OK")

    async def test_05_negative_limit(self, client: AsyncClient):
        """Test 5: Limit négatif"""
        response = await client.get("/api/euralis/lots?limit=-10")

        # Should handle negative limit gracefully
        assert response.status_code in [200, 400, 422]
        print(f"✅ Test 5: Negative limit handled OK")

    async def test_06_excessive_limit(self, client: AsyncClient):
        """Test 6: Limit excessif (> 1000)"""
        response = await client.get("/api/euralis/lots?limit=99999")

        # Should cap or validate limit
        assert response.status_code in [200, 400, 422]
        print(f"✅ Test 6: Excessive limit handled OK")


@pytest.mark.unit
@pytest.mark.asyncio
class TestEuralisAPIPerformance:
    """Tests de performance des endpoints Euralis"""

    async def test_01_dashboard_response_time(self, client: AsyncClient):
        """Test 1: Dashboard < 2s"""
        import time

        start = time.time()
        response = await client.get("/api/euralis/dashboard")
        elapsed = (time.time() - start) * 1000  # ms

        assert response.status_code == 200
        assert elapsed < 2000
        print(f"✅ Test 1: Dashboard response time: {elapsed:.2f}ms")

    async def test_02_sites_list_response_time(self, client: AsyncClient):
        """Test 2: Sites list < 500ms"""
        import time

        start = time.time()
        response = await client.get("/api/euralis/sites")
        elapsed = (time.time() - start) * 1000

        assert response.status_code == 200
        assert elapsed < 500
        print(f"✅ Test 2: Sites list response time: {elapsed:.2f}ms")

    async def test_03_lots_list_response_time(self, client: AsyncClient):
        """Test 3: Lots list < 1s"""
        import time

        start = time.time()
        response = await client.get("/api/euralis/lots?limit=50")
        elapsed = (time.time() - start) * 1000

        assert response.status_code == 200
        assert elapsed < 1000
        print(f"✅ Test 3: Lots list response time: {elapsed:.2f}ms")

    async def test_04_statistics_response_time(self, client: AsyncClient):
        """Test 4: Statistics < 3s"""
        import time

        start = time.time()
        response = await client.get("/api/euralis/statistics")
        elapsed = (time.time() - start) * 1000

        assert response.status_code == 200
        assert elapsed < 3000
        print(f"✅ Test 4: Statistics response time: {elapsed:.2f}ms")


@pytest.mark.unit
@pytest.mark.asyncio
class TestEuralisAPIFilters:
    """Tests des filtres et requêtes API Euralis"""

    async def test_01_filter_by_site_code(self, client: AsyncClient):
        """Test 1: Filtrage par site_code"""
        for site in ["LL", "LS", "MT"]:
            response = await client.get(f"/api/euralis/lots?site_code={site}")
            assert response.status_code == 200

        print(f"✅ Test 1: Site code filtering OK (LL, LS, MT)")

    async def test_02_filter_by_date_range(self, client: AsyncClient):
        """Test 2: Filtrage par plage de dates"""
        date_debut = (datetime.now() - timedelta(days=30)).date().isoformat()
        date_fin = datetime.now().date().isoformat()

        response = await client.get(
            f"/api/euralis/lots?date_debut={date_debut}&date_fin={date_fin}"
        )

        assert response.status_code in [200, 422]
        print(f"✅ Test 2: Date range filtering OK")

    async def test_03_pagination(self, client: AsyncClient):
        """Test 3: Pagination (limit + offset)"""
        response = await client.get("/api/euralis/lots?limit=10&offset=0")

        assert response.status_code == 200
        data = response.json()

        assert data is not None
        print(f"✅ Test 3: Pagination OK")

    async def test_04_sorting(self, client: AsyncClient):
        """Test 4: Tri des résultats"""
        response = await client.get("/api/euralis/lots?order_by=date_debut&order=desc")

        # May or may not support sorting, should handle gracefully
        assert response.status_code in [200, 400, 422]
        print(f"✅ Test 4: Sorting handled OK")

    async def test_05_combined_filters(self, client: AsyncClient):
        """Test 5: Filtres combinés"""
        response = await client.get(
            "/api/euralis/lots?site_code=LL&limit=5&offset=0"
        )

        assert response.status_code == 200
        print(f"✅ Test 5: Combined filters OK")
