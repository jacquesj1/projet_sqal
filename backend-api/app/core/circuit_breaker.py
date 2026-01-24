"""
SQAL Backend - Circuit Breaker Pattern
Phase 5 - Priority 2: Resilience

Implements Circuit Breaker pattern to prevent cascading failures:
- CLOSED: Normal operation, requests pass through
- OPEN: Too many failures, requests fail fast
- HALF_OPEN: Testing if service recovered

Usage:
    breaker = CircuitBreaker(
        failure_threshold=5,
        timeout=60,
        expected_exception=Exception
    )

    @breaker
    async def call_external_service():
        # Your code here
        pass
"""

import asyncio
import time
import logging
from enum import Enum
from typing import Callable, Optional, Type
from functools import wraps
from dataclasses import dataclass
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class CircuitState(Enum):
    """Circuit Breaker states"""
    CLOSED = "closed"      # Normal operation
    OPEN = "open"          # Failing, reject requests
    HALF_OPEN = "half_open"  # Testing recovery


@dataclass
class CircuitBreakerConfig:
    """Configuration for Circuit Breaker"""
    failure_threshold: int = 5  # Number of failures before opening
    success_threshold: int = 2  # Successes needed to close from half-open
    timeout: float = 60.0  # Seconds before trying again (open -> half-open)
    expected_exception: Type[Exception] = Exception  # Exception type to catch
    name: str = "circuit_breaker"


class CircuitBreakerOpenError(Exception):
    """Raised when circuit breaker is open"""
    pass


class CircuitBreaker:
    """
    Circuit Breaker implementation for resilience

    Protects against cascading failures by:
    1. Counting failures
    2. Opening circuit after threshold
    3. Testing recovery after timeout
    4. Closing circuit after successful tests

    Example:
        breaker = CircuitBreaker(failure_threshold=3, timeout=30)

        @breaker
        async def risky_operation():
            # Call external service
            response = await external_api_call()
            return response
    """

    def __init__(
        self,
        failure_threshold: int = 5,
        success_threshold: int = 2,
        timeout: float = 60.0,
        expected_exception: Type[Exception] = Exception,
        name: str = "circuit_breaker"
    ):
        self.config = CircuitBreakerConfig(
            failure_threshold=failure_threshold,
            success_threshold=success_threshold,
            timeout=timeout,
            expected_exception=expected_exception,
            name=name
        )

        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time: Optional[float] = None
        self.opened_at: Optional[float] = None

        logger.info(f"🔌 Circuit Breaker '{name}' initialized: "
                   f"threshold={failure_threshold}, timeout={timeout}s")

    def __call__(self, func: Callable) -> Callable:
        """Decorator to wrap functions with circuit breaker"""

        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            return await self._call_async(func, *args, **kwargs)

        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            return self._call_sync(func, *args, **kwargs)

        # Return appropriate wrapper based on function type
        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper

    async def _call_async(self, func: Callable, *args, **kwargs):
        """Execute async function with circuit breaker protection"""

        # Check circuit state
        if self.state == CircuitState.OPEN:
            # Check if timeout expired
            if self._should_attempt_reset():
                logger.info(f"🔌 Circuit '{self.config.name}' entering HALF_OPEN state")
                self.state = CircuitState.HALF_OPEN
            else:
                # Circuit still open, fail fast
                logger.warning(f"⚡ Circuit '{self.config.name}' is OPEN - failing fast")
                raise CircuitBreakerOpenError(
                    f"Circuit breaker '{self.config.name}' is open. "
                    f"Opened at {datetime.fromtimestamp(self.opened_at).isoformat()}. "
                    f"Retry after {self.config.timeout}s."
                )

        try:
            # Execute function
            result = await func(*args, **kwargs)

            # Success - handle state transitions
            self._on_success()

            return result

        except self.config.expected_exception as e:
            # Failure - handle state transitions
            self._on_failure()
            raise

    def _call_sync(self, func: Callable, *args, **kwargs):
        """Execute sync function with circuit breaker protection"""

        # Check circuit state
        if self.state == CircuitState.OPEN:
            if self._should_attempt_reset():
                logger.info(f"🔌 Circuit '{self.config.name}' entering HALF_OPEN state")
                self.state = CircuitState.HALF_OPEN
            else:
                logger.warning(f"⚡ Circuit '{self.config.name}' is OPEN - failing fast")
                raise CircuitBreakerOpenError(
                    f"Circuit breaker '{self.config.name}' is open. "
                    f"Opened at {datetime.fromtimestamp(self.opened_at).isoformat()}. "
                    f"Retry after {self.config.timeout}s."
                )

        try:
            result = func(*args, **kwargs)
            self._on_success()
            return result

        except self.config.expected_exception as e:
            self._on_failure()
            raise

    def _should_attempt_reset(self) -> bool:
        """Check if enough time passed to attempt reset"""
        if self.opened_at is None:
            return False

        elapsed = time.time() - self.opened_at
        return elapsed >= self.config.timeout

    def _on_success(self):
        """Handle successful call"""

        if self.state == CircuitState.HALF_OPEN:
            self.success_count += 1
            logger.info(f"✅ Circuit '{self.config.name}' success in HALF_OPEN "
                       f"({self.success_count}/{self.config.success_threshold})")

            if self.success_count >= self.config.success_threshold:
                # Close circuit - service recovered
                self._close_circuit()

        elif self.state == CircuitState.CLOSED:
            # Reset failure count on success
            if self.failure_count > 0:
                logger.debug(f"✅ Circuit '{self.config.name}' success - resetting failure count")
                self.failure_count = 0

    def _on_failure(self):
        """Handle failed call"""

        self.failure_count += 1
        self.last_failure_time = time.time()

        logger.warning(f"❌ Circuit '{self.config.name}' failure "
                      f"({self.failure_count}/{self.config.failure_threshold}) "
                      f"in state {self.state.value}")

        if self.state == CircuitState.HALF_OPEN:
            # Failed during test - reopen circuit
            logger.error(f"⚡ Circuit '{self.config.name}' failed in HALF_OPEN - reopening")
            self._open_circuit()

        elif self.state == CircuitState.CLOSED:
            # Check if threshold reached
            if self.failure_count >= self.config.failure_threshold:
                self._open_circuit()

    def _open_circuit(self):
        """Open circuit - stop sending requests"""
        self.state = CircuitState.OPEN
        self.opened_at = time.time()
        self.success_count = 0

        logger.error(f"🚨 Circuit '{self.config.name}' OPENED after "
                    f"{self.failure_count} failures. "
                    f"Will retry in {self.config.timeout}s")

    def _close_circuit(self):
        """Close circuit - service recovered"""
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.success_count = 0
        self.opened_at = None

        logger.info(f"✅ Circuit '{self.config.name}' CLOSED - service recovered")

    def reset(self):
        """Manually reset circuit breaker"""
        logger.info(f"🔄 Circuit '{self.config.name}' manually reset")
        self._close_circuit()

    def get_state(self) -> dict:
        """Get current circuit breaker state"""
        return {
            "name": self.config.name,
            "state": self.state.value,
            "failure_count": self.failure_count,
            "success_count": self.success_count,
            "failure_threshold": self.config.failure_threshold,
            "success_threshold": self.config.success_threshold,
            "timeout": self.config.timeout,
            "opened_at": datetime.fromtimestamp(self.opened_at).isoformat() if self.opened_at else None,
            "last_failure": datetime.fromtimestamp(self.last_failure_time).isoformat() if self.last_failure_time else None
        }


# ============================================================================
# Pre-configured Circuit Breakers for SQAL
# ============================================================================

# Database circuit breaker
db_circuit_breaker = CircuitBreaker(
    failure_threshold=5,
    success_threshold=2,
    timeout=30.0,
    name="database"
)

# Redis cache circuit breaker
cache_circuit_breaker = CircuitBreaker(
    failure_threshold=3,
    success_threshold=2,
    timeout=20.0,
    name="redis_cache"
)

# External API circuit breaker (for future use)
api_circuit_breaker = CircuitBreaker(
    failure_threshold=5,
    success_threshold=3,
    timeout=60.0,
    name="external_api"
)


# ============================================================================
# Helper: Retry with Exponential Backoff
# ============================================================================

async def retry_with_backoff(
    func: Callable,
    max_retries: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 60.0,
    exponential_base: float = 2.0,
    jitter: bool = True
):
    """
    Retry function with exponential backoff

    Args:
        func: Async function to retry
        max_retries: Maximum number of retry attempts
        base_delay: Initial delay in seconds
        max_delay: Maximum delay in seconds
        exponential_base: Base for exponential calculation
        jitter: Add random jitter to prevent thundering herd

    Example:
        result = await retry_with_backoff(
            lambda: risky_operation(),
            max_retries=3,
            base_delay=1.0
        )
    """
    import random

    last_exception = None

    for attempt in range(max_retries + 1):
        try:
            return await func()

        except Exception as e:
            last_exception = e

            if attempt >= max_retries:
                logger.error(f"❌ Max retries ({max_retries}) exceeded: {e}")
                raise

            # Calculate delay with exponential backoff
            delay = min(base_delay * (exponential_base ** attempt), max_delay)

            # Add jitter (±25%)
            if jitter:
                jitter_range = delay * 0.25
                delay += random.uniform(-jitter_range, jitter_range)

            logger.warning(f"⚠️ Retry attempt {attempt + 1}/{max_retries} "
                          f"after {delay:.2f}s: {e}")

            await asyncio.sleep(delay)

    raise last_exception


# ============================================================================
# Helper: Timeout Wrapper
# ============================================================================

async def with_timeout(coro, timeout: float, timeout_message: str = "Operation timed out"):
    """
    Wrap coroutine with timeout

    Args:
        coro: Coroutine to execute
        timeout: Timeout in seconds
        timeout_message: Custom timeout error message

    Example:
        result = await with_timeout(
            slow_operation(),
            timeout=5.0,
            timeout_message="Slow operation timed out"
        )
    """
    try:
        return await asyncio.wait_for(coro, timeout=timeout)
    except asyncio.TimeoutError:
        logger.error(f"⏱️ {timeout_message} after {timeout}s")
        raise asyncio.TimeoutError(timeout_message)
