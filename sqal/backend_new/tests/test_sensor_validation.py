"""
Unit tests for sensor data validation with Pydantic schemas
"""
import pytest
from pydantic import ValidationError
from datetime import datetime

from app.schemas.sensor_data import (
    VL53L8CHRawData,
    VL53L8CHAnalysis,
    AS7341Channels,
    AS7341Analysis,
    FusionResult,
    SensorMetadata,
    SensorDataMessage,
)


# ============================================================================
# VL53L8CH Validation Tests
# ============================================================================

def test_vl53l8ch_valid_8x8_matrix():
    """Test that valid 8x8 matrices are accepted"""
    data = {
        "distance_matrix": [[10.0] * 8 for _ in range(8)],
        "reflectance_matrix": [[150.0] * 8 for _ in range(8)],
        "amplitude_matrix": [[50.0] * 8 for _ in range(8)],
    }

    vl53l8ch = VL53L8CHRawData(**data)
    assert len(vl53l8ch.distance_matrix) == 8
    assert len(vl53l8ch.distance_matrix[0]) == 8


def test_vl53l8ch_invalid_matrix_dimensions():
    """Test that invalid matrix dimensions are rejected"""
    # 7x8 instead of 8x8
    data = {
        "distance_matrix": [[10.0] * 8 for _ in range(7)],
        "reflectance_matrix": [[150.0] * 8 for _ in range(8)],
        "amplitude_matrix": [[50.0] * 8 for _ in range(8)],
    }

    with pytest.raises(ValidationError) as exc_info:
        VL53L8CHRawData(**data)

    errors = exc_info.value.errors()
    assert any('must have exactly 8 rows' in str(error['msg']) for error in errors)


def test_vl53l8ch_reflectance_range_validation():
    """Test that reflectance values must be 0-255"""
    data = {
        "distance_matrix": [[10.0] * 8 for _ in range(8)],
        "reflectance_matrix": [[300.0] * 8 for _ in range(8)],  # Invalid: > 255
        "amplitude_matrix": [[50.0] * 8 for _ in range(8)],
    }

    with pytest.raises(ValidationError) as exc_info:
        VL53L8CHRawData(**data)

    errors = exc_info.value.errors()
    assert any('0-255' in str(error['msg']) for error in errors)


def test_vl53l8ch_quality_score_range():
    """Test that quality_score must be 0.0-1.0"""
    data = {
        "distance_matrix": [[10.0] * 8 for _ in range(8)],
        "reflectance_matrix": [[150.0] * 8 for _ in range(8)],
        "amplitude_matrix": [[50.0] * 8 for _ in range(8)],
        "volume_mm3": 100.0,
        "base_area_mm2": 50.0,
        "average_height_mm": 10.0,
        "max_height_mm": 12.0,
        "min_height_mm": 8.0,
        "height_range_mm": 4.0,
        "surface_uniformity": 0.85,
        "defects": [],
        "quality_score": 1.5,  # Invalid: > 1.0
        "grade": "A"
    }

    with pytest.raises(ValidationError) as exc_info:
        VL53L8CHAnalysis(**data)

    errors = exc_info.value.errors()
    assert any('quality_score' in str(error['loc']) for error in errors)


def test_vl53l8ch_grade_pattern_validation():
    """Test that grade must match valid pattern"""
    data = {
        "distance_matrix": [[10.0] * 8 for _ in range(8)],
        "reflectance_matrix": [[150.0] * 8 for _ in range(8)],
        "amplitude_matrix": [[50.0] * 8 for _ in range(8)],
        "volume_mm3": 100.0,
        "base_area_mm2": 50.0,
        "average_height_mm": 10.0,
        "max_height_mm": 12.0,
        "min_height_mm": 8.0,
        "height_range_mm": 4.0,
        "surface_uniformity": 0.85,
        "defects": [],
        "quality_score": 0.85,
        "grade": "INVALID_GRADE"  # Invalid grade
    }

    with pytest.raises(ValidationError) as exc_info:
        VL53L8CHAnalysis(**data)

    errors = exc_info.value.errors()
    assert any('grade' in str(error['loc']) for error in errors)


# ============================================================================
# AS7341 Validation Tests
# ============================================================================

def test_as7341_channels_range_validation():
    """Test that channel values must be 0-65535"""
    data = {
        "F1_415nm": 70000,  # Invalid: > 65535
        "F2_445nm": 1200,
        "F3_480nm": 1500,
        "F4_515nm": 2000,
        "F5_555nm": 2500,
        "F6_590nm": 2200,
        "F7_630nm": 1800,
        "F8_680nm": 1600,
        "Clear": 10000,
        "NIR": 3000
    }

    with pytest.raises(ValidationError) as exc_info:
        AS7341Channels(**data)

    errors = exc_info.value.errors()
    assert any('F1_415nm' in str(error['loc']) for error in errors)


def test_as7341_valid_channels():
    """Test that valid channel data is accepted"""
    data = {
        "F1_415nm": 1000,
        "F2_445nm": 1200,
        "F3_480nm": 1500,
        "F4_515nm": 2000,
        "F5_555nm": 2500,
        "F6_590nm": 2200,
        "F7_630nm": 1800,
        "F8_680nm": 1600,
        "Clear": 10000,
        "NIR": 3000
    }

    channels = AS7341Channels(**data)
    assert channels.F1_415nm == 1000
    assert channels.Clear == 10000


def test_as7341_indices_range():
    """Test that quality indices must be 0.0-1.0"""
    data = {
        "channels": {
            "F1_415nm": 1000,
            "F2_445nm": 1200,
            "F3_480nm": 1500,
            "F4_515nm": 2000,
            "F5_555nm": 2500,
            "F6_590nm": 2200,
            "F7_630nm": 1800,
            "F8_680nm": 1600,
            "Clear": 10000,
            "NIR": 3000
        },
        "integration_time": 100,
        "gain": 16,
        "freshness_index": 1.5,  # Invalid: > 1.0
        "fat_quality_index": 0.85,
        "oxidation_index": 0.15,
        "color_uniformity": 0.88,
        "defects": [],
        "quality_score": 0.83,
        "grade": "A"
    }

    with pytest.raises(ValidationError) as exc_info:
        AS7341Analysis(**data)

    errors = exc_info.value.errors()
    assert any('freshness_index' in str(error['loc']) for error in errors)


# ============================================================================
# Fusion Validation Tests
# ============================================================================

def test_fusion_score_consistency():
    """Test that fusion scores are in valid range"""
    data = {
        "final_score": 0.85,
        "final_grade": "A+",
        "vl53l8ch_score": 0.87,
        "as7341_score": 0.83,
        "defects": []
    }

    fusion = FusionResult(**data)
    assert fusion.final_score == 0.85
    assert fusion.final_grade == "A+"


def test_fusion_defects_uniqueness():
    """Test that duplicate defects are removed"""
    data = {
        "final_score": 0.60,
        "final_grade": "B",
        "vl53l8ch_score": 0.65,
        "as7341_score": 0.55,
        "defects": ["oxidation_detected", "surface_irregularity", "oxidation_detected"]  # Duplicate
    }

    fusion = FusionResult(**data)
    # Should have unique defects
    assert len(fusion.defects) == 2
    assert "oxidation_detected" in fusion.defects
    assert "surface_irregularity" in fusion.defects


# ============================================================================
# Complete Message Validation Tests
# ============================================================================

def create_valid_sensor_message():
    """Helper to create a valid sensor message"""
    return {
        "type": "sensor_data",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "device_id": "TEST-DEVICE-001",
        "sample_id": "TEST-SAMPLE-001",
        "vl53l8ch": {
            "distance_matrix": [[10.0] * 8 for _ in range(8)],
            "reflectance_matrix": [[150.0] * 8 for _ in range(8)],
            "amplitude_matrix": [[50.0] * 8 for _ in range(8)],
            "volume_mm3": 2500.0,
            "base_area_mm2": 250.0,
            "average_height_mm": 10.0,
            "max_height_mm": 12.0,
            "min_height_mm": 8.0,
            "height_range_mm": 4.0,
            "surface_uniformity": 0.85,
            "defects": [],
            "quality_score": 0.87,
            "grade": "A"
        },
        "as7341": {
            "channels": {
                "F1_415nm": 1000,
                "F2_445nm": 1200,
                "F3_480nm": 1500,
                "F4_515nm": 2000,
                "F5_555nm": 2500,
                "F6_590nm": 2200,
                "F7_630nm": 1800,
                "F8_680nm": 1600,
                "Clear": 10000,
                "NIR": 3000
            },
            "integration_time": 100,
            "gain": 16,
            "freshness_index": 0.82,
            "fat_quality_index": 0.85,
            "oxidation_index": 0.15,
            "color_uniformity": 0.88,
            "defects": [],
            "quality_score": 0.83,
            "grade": "A"
        },
        "fusion": {
            "final_score": 0.85,
            "final_grade": "A+",
            "vl53l8ch_score": 0.87,
            "as7341_score": 0.83,
            "defects": []
        },
        "meta": {
            "device_id": "TEST-DEVICE-001",
            "firmware_version": "1.0.0",
            "temperature_c": 25.5,
            "humidity_percent": 50.0,
            "config_profile": "test_profile"
        }
    }


def test_complete_valid_message():
    """Test that a complete valid message is accepted"""
    data = create_valid_sensor_message()
    message = SensorDataMessage(**data)

    assert message.device_id == "TEST-DEVICE-001"
    assert message.sample_id == "TEST-SAMPLE-001"
    assert message.vl53l8ch.quality_score == 0.87
    assert message.as7341.quality_score == 0.83
    assert message.fusion.final_score == 0.85


def test_device_id_consistency():
    """Test that device_id must match in message and meta"""
    data = create_valid_sensor_message()
    data["meta"]["device_id"] = "DIFFERENT-DEVICE"  # Mismatch

    with pytest.raises(ValidationError) as exc_info:
        SensorDataMessage(**data)

    errors = exc_info.value.errors()
    assert any('device_id mismatch' in str(error['msg']) for error in errors)


def test_grade_score_consistency():
    """Test that grade must match score range"""
    data = create_valid_sensor_message()
    # Grade A+ requires score >= 0.85, but set score to 0.70
    data["fusion"]["final_score"] = 0.70

    with pytest.raises(ValidationError) as exc_info:
        SensorDataMessage(**data)

    errors = exc_info.value.errors()
    assert any('Grade A+ requires score >= 0.85' in str(error['msg']) for error in errors)


def test_timestamp_validation():
    """Test timestamp validation"""
    data = create_valid_sensor_message()
    # Test with valid timestamp
    message = SensorDataMessage(**data)
    assert message.timestamp is not None


def test_firmware_version_format():
    """Test that firmware version must follow semantic versioning"""
    data = create_valid_sensor_message()
    data["meta"]["firmware_version"] = "invalid_version"  # Invalid format

    with pytest.raises(ValidationError) as exc_info:
        SensorDataMessage(**data)

    errors = exc_info.value.errors()
    assert any('firmware_version' in str(error['loc']) for error in errors)


def test_temperature_range():
    """Test that temperature must be in valid range (-40 to 85°C)"""
    data = create_valid_sensor_message()
    data["meta"]["temperature_c"] = 100.0  # Invalid: > 85

    with pytest.raises(ValidationError) as exc_info:
        SensorDataMessage(**data)

    errors = exc_info.value.errors()
    assert any('temperature_c' in str(error['loc']) for error in errors)


def test_humidity_range():
    """Test that humidity must be 0-100%"""
    data = create_valid_sensor_message()
    data["meta"]["humidity_percent"] = 150.0  # Invalid: > 100

    with pytest.raises(ValidationError) as exc_info:
        SensorDataMessage(**data)

    errors = exc_info.value.errors()
    assert any('humidity_percent' in str(error['loc']) for error in errors)
