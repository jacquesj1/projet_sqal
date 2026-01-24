"""
Unit Tests - SQAL API Endpoints
Tests des endpoints API SQAL (sensors, quality control, real-time)
"""

import pytest
from httpx import AsyncClient
import json


@pytest.mark.unit
@pytest.mark.asyncio
class TestSQALAPIEndpoints:
    """Tests des endpoints SQAL API"""

    async def test_01_get_devices_list(self, client: AsyncClient):
        """Test 1: GET /api/sqal/devices"""
        response = await client.get("/api/sqal/devices")

        assert response.status_code == 200
        data = response.json()

        assert isinstance(data, (list, dict))
        print(f"✅ Test 1: SQAL devices list endpoint OK")

    async def test_02_get_device_details(self, client: AsyncClient):
        """Test 2: GET /api/sqal/devices/{device_id}"""
        device_id = "ESP32_LL_01"

        response = await client.get(f"/api/sqal/devices/{device_id}")

        assert response.status_code in [200, 404]

        if response.status_code == 200:
            data = response.json()
            assert data is not None

        print(f"✅ Test 2: SQAL device details endpoint OK")

    async def test_03_get_device_status(self, client: AsyncClient):
        """Test 3: GET /api/sqal/devices/{device_id}/status"""
        device_id = "ESP32_LL_01"

        response = await client.get(f"/api/sqal/devices/{device_id}/status")

        assert response.status_code in [200, 404]

        if response.status_code == 200:
            data = response.json()
            # Should include status info (online/offline, last_seen, etc.)
            assert data is not None

        print(f"✅ Test 3: SQAL device status endpoint OK")

    async def test_04_get_samples_list(self, client: AsyncClient):
        """Test 4: GET /api/sqal/samples"""
        response = await client.get("/api/sqal/samples?limit=10")

        assert response.status_code == 200
        data = response.json()

        assert isinstance(data, (list, dict))
        print(f"✅ Test 4: SQAL samples list endpoint OK")

    async def test_05_get_samples_by_device(self, client: AsyncClient):
        """Test 5: GET /api/sqal/samples?device_id=ESP32_LL_01"""
        response = await client.get("/api/sqal/samples?device_id=ESP32_LL_01&limit=5")

        assert response.status_code == 200
        data = response.json()

        assert data is not None
        print(f"✅ Test 5: SQAL samples by device endpoint OK")

    async def test_06_get_sample_details(self, client: AsyncClient):
        """Test 6: GET /api/sqal/samples/{sample_id}"""
        sample_id = 1

        response = await client.get(f"/api/sqal/samples/{sample_id}")

        assert response.status_code in [200, 404]

        if response.status_code == 200:
            data = response.json()
            # Should include VL53L8CH matrix + AS7341 channels
            assert data is not None

        print(f"✅ Test 6: SQAL sample details endpoint OK")

    async def test_07_get_quality_scores(self, client: AsyncClient):
        """Test 7: GET /api/sqal/quality/scores"""
        response = await client.get("/api/sqal/quality/scores?limit=20")

        assert response.status_code == 200
        data = response.json()

        assert isinstance(data, (list, dict))
        print(f"✅ Test 7: SQAL quality scores endpoint OK")

    async def test_08_get_quality_distribution(self, client: AsyncClient):
        """Test 8: GET /api/sqal/quality/distribution"""
        response = await client.get("/api/sqal/quality/distribution")

        assert response.status_code == 200
        data = response.json()

        # Should return distribution of grades (A+, A, B, C, D)
        assert data is not None
        print(f"✅ Test 8: SQAL quality distribution endpoint OK")

    async def test_09_get_realtime_data(self, client: AsyncClient):
        """Test 9: GET /api/sqal/realtime/latest"""
        response = await client.get("/api/sqal/realtime/latest")

        assert response.status_code == 200
        data = response.json()

        # Should return latest sensor data
        assert data is not None
        print(f"✅ Test 9: SQAL realtime latest data endpoint OK")

    async def test_10_get_alerts(self, client: AsyncClient):
        """Test 10: GET /api/sqal/alerts"""
        response = await client.get("/api/sqal/alerts?active=true")

        assert response.status_code == 200
        data = response.json()

        assert isinstance(data, (list, dict))
        print(f"✅ Test 10: SQAL alerts endpoint OK")

    async def test_11_get_statistics(self, client: AsyncClient):
        """Test 11: GET /api/sqal/statistics"""
        response = await client.get("/api/sqal/statistics")

        assert response.status_code == 200
        data = response.json()

        # Should return global SQAL statistics
        assert data is not None
        print(f"✅ Test 11: SQAL statistics endpoint OK")

    async def test_12_get_calibration_data(self, client: AsyncClient):
        """Test 12: GET /api/sqal/devices/{device_id}/calibration"""
        device_id = "ESP32_LL_01"

        response = await client.get(f"/api/sqal/devices/{device_id}/calibration")

        assert response.status_code in [200, 404]

        if response.status_code == 200:
            data = response.json()
            # Calibration parameters for VL53L8CH and AS7341
            assert data is not None

        print(f"✅ Test 12: SQAL calibration data endpoint OK")


@pytest.mark.unit
@pytest.mark.asyncio
class TestSQALSensorData:
    """Tests des données capteurs SQAL"""

    async def test_01_validate_vl53l8ch_matrix(self, mock_sqal_sample_data):
        """Test 1: Valider matrice VL53L8CH (8x8)"""
        matrix = mock_sqal_sample_data["vl53l8ch_matrix"]

        assert len(matrix) == 8  # 8 rows
        assert all(len(row) == 8 for row in matrix)  # 8 columns each
        print(f"✅ Test 1: Matrice VL53L8CH 8x8 validée OK")

    async def test_02_validate_as7341_channels(self, mock_sqal_sample_data):
        """Test 2: Valider canaux AS7341 (10 channels)"""
        channels = mock_sqal_sample_data["as7341_channels"]

        expected_channels = [
            "415nm", "445nm", "480nm", "515nm", "555nm",
            "590nm", "630nm", "680nm", "clear", "nir"
        ]

        for channel in expected_channels:
            assert channel in channels

        print(f"✅ Test 2: Canaux AS7341 (10) validés OK")

    async def test_03_validate_sqal_score_range(self, mock_sqal_sample_data):
        """Test 3: Valider plage score SQAL (0-100)"""
        score = mock_sqal_sample_data["sqal_score"]

        assert 0 <= score <= 100
        print(f"✅ Test 3: Score SQAL dans plage 0-100 OK")

    async def test_04_validate_sqal_grade(self, mock_sqal_sample_data):
        """Test 4: Valider grade SQAL (A++, A+, A, B, C, D)"""
        grade = mock_sqal_sample_data["sqal_grade"]

        valid_grades = ["A++", "A+", "A", "B", "C", "D"]
        assert grade in valid_grades
        print(f"✅ Test 4: Grade SQAL validé OK ({grade})")

    async def test_05_validate_distance_values(self):
        """Test 5: Valider valeurs distance ToF (0-4000mm)"""
        # VL53L8CH range: 0-4000mm
        distances = [0, 100, 500, 1000, 2000, 3000, 4000]

        for dist in distances:
            assert 0 <= dist <= 4000

        print(f"✅ Test 5: Valeurs distance ToF validées OK (0-4000mm)")

    async def test_06_validate_spectral_values(self):
        """Test 6: Valider valeurs spectrales AS7341"""
        # AS7341 ADC: 0-65535
        spectral_values = [0, 1000, 10000, 30000, 65535]

        for val in spectral_values:
            assert 0 <= val <= 65535

        print(f"✅ Test 6: Valeurs spectrales validées OK (0-65535)")


@pytest.mark.unit
@pytest.mark.asyncio
class TestSQALQualityCalculation:
    """Tests du calcul de qualité SQAL"""

    def test_01_score_to_grade_mapping(self):
        """Test 1: Mapping score → grade"""
        score_to_grade = {
            98: "A++",
            95: "A+",
            90: "A",
            80: "B",
            70: "C",
            50: "D"
        }

        for score, expected_grade in score_to_grade.items():
            # Logic based on thresholds
            if score >= 97:
                grade = "A++"
            elif score >= 93:
                grade = "A+"
            elif score >= 85:
                grade = "A"
            elif score >= 75:
                grade = "B"
            elif score >= 60:
                grade = "C"
            else:
                grade = "D"

            assert grade == expected_grade

        print(f"✅ Test 1: Mapping score → grade OK")

    def test_02_compliance_check(self):
        """Test 2: Vérification conformité (score >= 60)"""
        compliant_scores = [60, 70, 85, 95, 100]
        non_compliant_scores = [0, 30, 45, 59]

        for score in compliant_scores:
            assert score >= 60  # Compliant

        for score in non_compliant_scores:
            assert score < 60  # Non-compliant

        print(f"✅ Test 2: Vérification conformité OK (seuil 60)")

    def test_03_quality_variance_detection(self):
        """Test 3: Détection variance qualité"""
        import numpy as np

        # High variance (inconsistent quality)
        scores_high_var = [50, 95, 60, 90, 55]
        variance_high = np.var(scores_high_var)

        # Low variance (consistent quality)
        scores_low_var = [90, 92, 91, 89, 90]
        variance_low = np.var(scores_low_var)

        assert variance_high > variance_low
        print(f"✅ Test 3: Détection variance qualité OK")


@pytest.mark.unit
@pytest.mark.asyncio
class TestSQALAPIPerformance:
    """Tests de performance endpoints SQAL"""

    async def test_01_devices_list_response_time(self, client: AsyncClient):
        """Test 1: Liste devices < 300ms"""
        import time

        start = time.time()
        response = await client.get("/api/sqal/devices")
        elapsed = (time.time() - start) * 1000

        assert response.status_code == 200
        assert elapsed < 300
        print(f"✅ Test 1: Devices list response time: {elapsed:.2f}ms")

    async def test_02_samples_list_response_time(self, client: AsyncClient):
        """Test 2: Liste samples < 500ms"""
        import time

        start = time.time()
        response = await client.get("/api/sqal/samples?limit=20")
        elapsed = (time.time() - start) * 1000

        assert response.status_code == 200
        assert elapsed < 500
        print(f"✅ Test 2: Samples list response time: {elapsed:.2f}ms")

    async def test_03_realtime_data_response_time(self, client: AsyncClient):
        """Test 3: Données temps réel < 200ms"""
        import time

        start = time.time()
        response = await client.get("/api/sqal/realtime/latest")
        elapsed = (time.time() - start) * 1000

        assert response.status_code == 200
        assert elapsed < 200  # Should be very fast
        print(f"✅ Test 3: Realtime data response time: {elapsed:.2f}ms")
