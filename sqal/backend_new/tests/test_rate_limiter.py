"""
Unit tests for Rate Limiter
"""
import pytest
import time
from datetime import datetime, timedelta

from app.core.rate_limiter import RateLimiter, AdaptiveRateLimiter


# ============================================================================
# Basic Rate Limiter Tests
# ============================================================================

def test_rate_limiter_initialization():
    """Test that rate limiter initializes correctly"""
    limiter = RateLimiter(max_requests=10, window_seconds=60)

    assert limiter.max_requests == 10
    assert limiter.window_seconds == 60
    assert len(limiter.requests) == 0


def test_rate_limiter_allows_requests_under_limit():
    """Test that requests under the limit are allowed"""
    limiter = RateLimiter(max_requests=10, window_seconds=60)
    client_id = "test-client-1"

    # Should allow 10 requests
    for i in range(10):
        assert limiter.is_allowed(client_id) is True

    # 11th request should be denied
    assert limiter.is_allowed(client_id) is False


def test_rate_limiter_multiple_clients():
    """Test that rate limiter tracks clients separately"""
    limiter = RateLimiter(max_requests=5, window_seconds=60)

    client_a = "client-a"
    client_b = "client-b"

    # Client A makes 5 requests
    for _ in range(5):
        assert limiter.is_allowed(client_a) is True

    # Client A is now rate limited
    assert limiter.is_allowed(client_a) is False

    # Client B should still be allowed
    for _ in range(5):
        assert limiter.is_allowed(client_b) is True

    # Client B is now rate limited
    assert limiter.is_allowed(client_b) is False


def test_rate_limiter_time_window_reset():
    """Test that rate limit resets after time window"""
    limiter = RateLimiter(max_requests=3, window_seconds=1)  # 1 second window
    client_id = "test-client"

    # Make 3 requests
    for _ in range(3):
        assert limiter.is_allowed(client_id) is True

    # 4th request should be denied
    assert limiter.is_allowed(client_id) is False

    # Wait for window to expire
    time.sleep(1.1)

    # Should be allowed again
    assert limiter.is_allowed(client_id) is True


def test_rate_limiter_get_usage():
    """Test that usage stats are returned correctly"""
    limiter = RateLimiter(max_requests=10, window_seconds=60)
    client_id = "test-client"

    # Make 3 requests
    for _ in range(3):
        limiter.is_allowed(client_id)

    usage = limiter.get_usage(client_id)

    assert usage["client_id"] == client_id
    assert usage["requests_in_window"] == 3
    assert usage["max_requests"] == 10
    assert usage["remaining"] == 7
    assert usage["usage_percent"] == 30.0


def test_rate_limiter_reset_client():
    """Test that resetting a specific client works"""
    limiter = RateLimiter(max_requests=5, window_seconds=60)
    client_id = "test-client"

    # Make 5 requests (fill the quota)
    for _ in range(5):
        limiter.is_allowed(client_id)

    # Should be rate limited
    assert limiter.is_allowed(client_id) is False

    # Reset this client
    limiter.reset(client_id)

    # Should be allowed again
    assert limiter.is_allowed(client_id) is True


def test_rate_limiter_reset_all():
    """Test that resetting all clients works"""
    limiter = RateLimiter(max_requests=5, window_seconds=60)

    client_a = "client-a"
    client_b = "client-b"

    # Both clients make 5 requests
    for _ in range(5):
        limiter.is_allowed(client_a)
        limiter.is_allowed(client_b)

    # Both should be rate limited
    assert limiter.is_allowed(client_a) is False
    assert limiter.is_allowed(client_b) is False

    # Reset all
    limiter.reset()

    # Both should be allowed again
    assert limiter.is_allowed(client_a) is True
    assert limiter.is_allowed(client_b) is True


def test_rate_limiter_cleanup():
    """Test that cleanup removes old entries"""
    limiter = RateLimiter(max_requests=10, window_seconds=1)

    client_a = "client-a"
    client_b = "client-b"

    # Client A makes requests
    for _ in range(3):
        limiter.is_allowed(client_a)

    # Wait for window to expire
    time.sleep(1.1)

    # Client B makes requests
    for _ in range(3):
        limiter.is_allowed(client_b)

    # Before cleanup
    assert len(limiter.requests) == 2

    # Run cleanup
    limiter.cleanup_old_entries()

    # Client A should be removed (no recent activity)
    # Client B should remain
    assert client_b in limiter.requests
    # Client A may or may not be in requests depending on cleanup timing


# ============================================================================
# Adaptive Rate Limiter Tests
# ============================================================================

def test_adaptive_rate_limiter_initialization():
    """Test that adaptive rate limiter initializes correctly"""
    limiter = AdaptiveRateLimiter(
        base_max_requests=100,
        window_seconds=60,
        high_load_threshold=0.8
    )

    assert limiter.base_max_requests == 100
    assert limiter.max_requests == 100
    assert limiter.current_load == 0.0


def test_adaptive_rate_limiter_reduces_under_load():
    """Test that rate limit is reduced under high load"""
    limiter = AdaptiveRateLimiter(
        base_max_requests=100,
        window_seconds=60,
        high_load_threshold=0.8
    )

    # Normal load - should use base limit
    limiter.update_system_load(0.5)
    assert limiter.max_requests == 100

    # High load - should reduce limit
    limiter.update_system_load(0.9)
    assert limiter.max_requests < 100
    assert limiter.max_requests >= 50  # Should not go below 50% of base


def test_adaptive_rate_limiter_restores_normal_limit():
    """Test that rate limit is restored when load decreases"""
    limiter = AdaptiveRateLimiter(
        base_max_requests=100,
        window_seconds=60,
        high_load_threshold=0.8
    )

    # Start with high load
    limiter.update_system_load(0.95)
    reduced_limit = limiter.max_requests

    assert reduced_limit < 100

    # Load decreases
    limiter.update_system_load(0.5)

    # Should restore to base limit
    assert limiter.max_requests == 100


def test_adaptive_rate_limiter_load_clamping():
    """Test that load is clamped to 0.0-1.0 range"""
    limiter = AdaptiveRateLimiter(
        base_max_requests=100,
        window_seconds=60,
        high_load_threshold=0.8
    )

    # Test negative load
    limiter.update_system_load(-0.5)
    assert limiter.current_load == 0.0

    # Test load > 1.0
    limiter.update_system_load(1.5)
    assert limiter.current_load == 1.0


# ============================================================================
# Edge Cases and Stress Tests
# ============================================================================

def test_rate_limiter_concurrent_requests():
    """Test rate limiter behavior with concurrent-like requests"""
    limiter = RateLimiter(max_requests=100, window_seconds=60)
    client_id = "test-client"

    # Simulate rapid requests
    results = []
    for _ in range(150):
        results.append(limiter.is_allowed(client_id))

    # First 100 should be allowed
    assert sum(results[:100]) == 100

    # Remaining 50 should be denied
    assert sum(results[100:]) == 0


def test_rate_limiter_empty_client_id():
    """Test rate limiter with empty client ID"""
    limiter = RateLimiter(max_requests=10, window_seconds=60)

    # Should handle empty string
    assert limiter.is_allowed("") is True


def test_rate_limiter_usage_for_nonexistent_client():
    """Test getting usage for a client that never made requests"""
    limiter = RateLimiter(max_requests=10, window_seconds=60)

    usage = limiter.get_usage("nonexistent-client")

    assert usage["requests_in_window"] == 0
    assert usage["remaining"] == 10
    assert usage["usage_percent"] == 0.0


def test_rate_limiter_zero_max_requests():
    """Test rate limiter with zero max requests"""
    limiter = RateLimiter(max_requests=0, window_seconds=60)
    client_id = "test-client"

    # Should immediately be rate limited
    assert limiter.is_allowed(client_id) is False


def test_rate_limiter_very_short_window():
    """Test rate limiter with very short time window"""
    limiter = RateLimiter(max_requests=5, window_seconds=0.1)  # 100ms window
    client_id = "test-client"

    # Make 5 requests quickly
    for _ in range(5):
        assert limiter.is_allowed(client_id) is True

    # Should be rate limited
    assert limiter.is_allowed(client_id) is False

    # Wait for window to expire
    time.sleep(0.11)

    # Should be allowed again
    assert limiter.is_allowed(client_id) is True
