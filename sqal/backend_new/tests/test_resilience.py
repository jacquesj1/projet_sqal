#!/usr/bin/env python3
"""
SQAL Resilience Test Suite
Phase 5 - Priority 2: Testing Resilience Patterns

Tests:
1. Circuit Breaker functionality
2. Health checks (live, ready, startup)
3. Graceful shutdown simulation
4. Error handling and recovery

Run with: python test_resilience.py
"""

import asyncio
import sys
import time
from typing import Tuple

# Add backend to path
sys.path.insert(0, '/home/user/SQAL_TOF_AS7341/backend_new')

from app.core.circuit_breaker import CircuitBreaker, CircuitBreakerOpenError
from app.core.health import HealthCheckManager


class TestResults:
    """Track test results"""
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.tests = []

    def record(self, name: str, passed: bool, message: str = ""):
        self.tests.append({
            "name": name,
            "passed": passed,
            "message": message
        })
        if passed:
            self.passed += 1
            print(f"✅ PASS: {name}")
        else:
            self.failed += 1
            print(f"❌ FAIL: {name}")
        if message:
            print(f"   → {message}")

    def summary(self):
        total = self.passed + self.failed
        print("\n" + "=" * 80)
        print(f"TEST SUMMARY")
        print("=" * 80)
        print(f"Total Tests: {total}")
        print(f"✅ Passed: {self.passed}")
        print(f"❌ Failed: {self.failed}")
        print(f"Success Rate: {(self.passed/total*100):.1f}%")
        print("=" * 80)
        return self.failed == 0


results = TestResults()


# ============================================================================
# Circuit Breaker Tests
# ============================================================================

async def test_circuit_breaker_closed():
    """Test circuit breaker in CLOSED state (normal operation)"""
    print("\n📋 Test: Circuit Breaker - CLOSED State")

    breaker = CircuitBreaker(
        failure_threshold=3,
        success_threshold=2,
        timeout=1.0,
        name="test_closed"
    )

    @breaker
    async def successful_operation():
        return "success"

    try:
        result = await successful_operation()
        state = breaker.get_state()

        passed = (
            result == "success" and
            state["state"] == "closed" and
            state["failure_count"] == 0
        )

        results.record(
            "Circuit Breaker CLOSED state",
            passed,
            f"State: {state['state']}, Failures: {state['failure_count']}"
        )
    except Exception as e:
        results.record("Circuit Breaker CLOSED state", False, str(e))


async def test_circuit_breaker_opens():
    """Test circuit breaker opens after threshold failures"""
    print("\n📋 Test: Circuit Breaker - OPEN State")

    breaker = CircuitBreaker(
        failure_threshold=3,
        success_threshold=2,
        timeout=1.0,
        name="test_open"
    )

    call_count = 0

    @breaker
    async def failing_operation():
        nonlocal call_count
        call_count += 1
        raise Exception("Simulated failure")

    # Trigger failures to open circuit
    for i in range(3):
        try:
            await failing_operation()
        except Exception:
            pass

    state = breaker.get_state()

    # Try one more call - should fail fast
    try:
        await failing_operation()
        results.record(
            "Circuit Breaker OPEN state",
            False,
            "Expected CircuitBreakerOpenError but got success"
        )
    except CircuitBreakerOpenError:
        passed = (
            state["state"] == "open" and
            state["failure_count"] == 3 and
            call_count == 3  # Should not have called function again
        )
        results.record(
            "Circuit Breaker OPEN state",
            passed,
            f"State: {state['state']}, Failures: {state['failure_count']}, Calls: {call_count}"
        )
    except Exception as e:
        results.record("Circuit Breaker OPEN state", False, str(e))


async def test_circuit_breaker_half_open():
    """Test circuit breaker transitions to HALF_OPEN and recovers"""
    print("\n📋 Test: Circuit Breaker - HALF_OPEN and Recovery")

    breaker = CircuitBreaker(
        failure_threshold=2,
        success_threshold=2,
        timeout=0.5,  # Short timeout for testing
        name="test_half_open"
    )

    failure_count = 0

    @breaker
    async def operation():
        nonlocal failure_count
        if failure_count < 2:
            failure_count += 1
            raise Exception("Simulated failure")
        return "success"

    # Open the circuit
    for _ in range(2):
        try:
            await operation()
        except Exception:
            pass

    state1 = breaker.get_state()

    # Wait for timeout
    await asyncio.sleep(0.6)

    # Should transition to HALF_OPEN and then CLOSED
    result1 = await operation()  # First success
    result2 = await operation()  # Second success - should close circuit

    state2 = breaker.get_state()

    passed = (
        state1["state"] == "open" and
        state2["state"] == "closed" and
        result1 == "success" and
        result2 == "success"
    )

    results.record(
        "Circuit Breaker HALF_OPEN recovery",
        passed,
        f"Initial: {state1['state']} → Final: {state2['state']}"
    )


async def test_circuit_breaker_decorator():
    """Test circuit breaker works as decorator with sync and async functions"""
    print("\n📋 Test: Circuit Breaker - Decorator Pattern")

    breaker = CircuitBreaker(failure_threshold=3, name="test_decorator")

    @breaker
    async def async_func():
        return "async_result"

    @breaker
    def sync_func():
        return "sync_result"

    try:
        result1 = await async_func()
        result2 = sync_func()

        passed = result1 == "async_result" and result2 == "sync_result"
        results.record(
            "Circuit Breaker decorator pattern",
            passed,
            f"Async: {result1}, Sync: {result2}"
        )
    except Exception as e:
        results.record("Circuit Breaker decorator pattern", False, str(e))


# ============================================================================
# Health Check Tests
# ============================================================================

async def test_health_manager_startup():
    """Test health manager startup tracking"""
    print("\n📋 Test: Health Manager - Startup")

    manager = HealthCheckManager()

    # Initial state - not started
    startup1 = await manager.check_startup()

    # Mark as started
    manager.mark_as_started()
    startup2 = await manager.check_startup()

    passed = (
        startup1["status"] == "starting" and
        startup2["status"] == "started"
    )

    results.record(
        "Health Manager startup tracking",
        passed,
        f"Before: {startup1['status']} → After: {startup2['status']}"
    )


async def test_health_manager_readiness():
    """Test health manager readiness checks"""
    print("\n📋 Test: Health Manager - Readiness")

    manager = HealthCheckManager()
    manager.mark_as_started()

    # Register a passing check
    async def check_pass():
        return True, "Service is ready"

    # Register a failing check
    async def check_fail():
        return False, "Service is not ready"

    manager.register_readiness_check("pass_check", check_pass)
    manager.register_readiness_check("fail_check", check_fail)

    result = await manager.check_readiness()

    passed = (
        result["status"] == "not_ready" and
        "pass_check" in result["checks"] and
        "fail_check" in result["checks"] and
        result["checks"]["pass_check"]["status"] == "ready" and
        result["checks"]["fail_check"]["status"] == "not_ready"
    )

    results.record(
        "Health Manager readiness checks",
        passed,
        f"Status: {result['status']}, Checks: {len(result['checks'])}"
    )


async def test_health_manager_liveness():
    """Test health manager liveness checks"""
    print("\n📋 Test: Health Manager - Liveness")

    manager = HealthCheckManager()

    # Register a liveness check
    async def check_alive():
        return True, "Application is alive"

    manager.register_liveness_check("alive_check", check_alive)

    result = await manager.check_liveness()

    passed = (
        result["status"] == "healthy" and
        "alive_check" in result["checks"] and
        result["checks"]["alive_check"]["status"] == "alive"
    )

    results.record(
        "Health Manager liveness checks",
        passed,
        f"Status: {result['status']}"
    )


async def test_health_manager_shutdown():
    """Test health manager during shutdown"""
    print("\n📋 Test: Health Manager - Shutdown State")

    manager = HealthCheckManager()
    manager.mark_as_started()
    manager.mark_as_ready()

    # Mark as shutting down
    manager.mark_as_shutting_down()

    liveness = await manager.check_liveness()
    readiness = await manager.check_readiness()

    passed = (
        liveness["status"] == "unhealthy" and
        readiness["status"] == "not_ready" and
        manager.is_shutting_down == True
    )

    results.record(
        "Health Manager shutdown state",
        passed,
        f"Liveness: {liveness['status']}, Readiness: {readiness['status']}"
    )


async def test_health_manager_check_timeout():
    """Test health check with timeout"""
    print("\n📋 Test: Health Manager - Check Timeout")

    manager = HealthCheckManager()
    manager.mark_as_started()

    # Register a slow check that will timeout
    async def slow_check():
        await asyncio.sleep(10)  # Longer than timeout
        return True, "Completed"

    manager.register_readiness_check("slow_check", slow_check)

    start = time.time()
    result = await manager.check_readiness()
    duration = time.time() - start

    passed = (
        result["status"] == "not_ready" and
        "slow_check" in result["checks"] and
        result["checks"]["slow_check"]["status"] == "timeout" and
        duration < 10  # Should timeout before 10s
    )

    results.record(
        "Health Manager check timeout",
        passed,
        f"Duration: {duration:.2f}s, Status: {result['checks']['slow_check']['status']}"
    )


# ============================================================================
# Integration Tests
# ============================================================================

async def test_circuit_breaker_with_retry():
    """Test circuit breaker with retry logic"""
    print("\n📋 Test: Circuit Breaker - Integration with Retry")

    from app.core.circuit_breaker import retry_with_backoff

    call_count = 0

    async def flaky_operation():
        nonlocal call_count
        call_count += 1
        if call_count < 3:
            raise Exception("Transient failure")
        return "success"

    try:
        result = await retry_with_backoff(
            flaky_operation,
            max_retries=3,
            base_delay=0.1
        )

        passed = result == "success" and call_count == 3
        results.record(
            "Circuit Breaker with retry",
            passed,
            f"Result: {result}, Calls: {call_count}"
        )
    except Exception as e:
        results.record("Circuit Breaker with retry", False, str(e))


async def test_circuit_breaker_with_timeout():
    """Test circuit breaker with timeout"""
    print("\n📋 Test: Circuit Breaker - Integration with Timeout")

    from app.core.circuit_breaker import with_timeout

    async def slow_operation():
        await asyncio.sleep(5)
        return "completed"

    try:
        result = await with_timeout(
            slow_operation(),
            timeout=0.5,
            timeout_message="Operation too slow"
        )
        results.record("Circuit Breaker with timeout", False, "Should have timed out")
    except asyncio.TimeoutError:
        results.record("Circuit Breaker with timeout", True, "Correctly timed out")
    except Exception as e:
        results.record("Circuit Breaker with timeout", False, str(e))


# ============================================================================
# Main Test Runner
# ============================================================================

async def run_all_tests():
    """Run all resilience tests"""
    print("=" * 80)
    print("SQAL RESILIENCE TEST SUITE")
    print("Phase 5 - Priority 2: Testing Resilience Patterns")
    print("=" * 80)

    print("\n🔌 CIRCUIT BREAKER TESTS")
    print("-" * 80)
    await test_circuit_breaker_closed()
    await test_circuit_breaker_opens()
    await test_circuit_breaker_half_open()
    await test_circuit_breaker_decorator()

    print("\n🏥 HEALTH CHECK TESTS")
    print("-" * 80)
    await test_health_manager_startup()
    await test_health_manager_readiness()
    await test_health_manager_liveness()
    await test_health_manager_shutdown()
    await test_health_manager_check_timeout()

    print("\n🔗 INTEGRATION TESTS")
    print("-" * 80)
    await test_circuit_breaker_with_retry()
    await test_circuit_breaker_with_timeout()

    # Print summary
    success = results.summary()

    return 0 if success else 1


if __name__ == "__main__":
    exit_code = asyncio.run(run_all_tests())
    sys.exit(exit_code)
