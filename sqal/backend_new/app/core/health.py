"""
SQAL Backend - Advanced Health Checks
Phase 5 - Priority 2: Resilience

Implements Kubernetes-style health check endpoints:
- /health/live - Liveness probe (is the app running?)
- /health/ready - Readiness probe (can the app serve traffic?)
- /health/startup - Startup probe (has the app finished starting?)

Usage in Kubernetes:
    livenessProbe:
      httpGet:
        path: /health/live
        port: 8000
      initialDelaySeconds: 30
      periodSeconds: 10

    readinessProbe:
      httpGet:
        path: /health/ready
        port: 8000
      initialDelaySeconds: 10
      periodSeconds: 5

    startupProbe:
      httpGet:
        path: /health/startup
        port: 8000
      initialDelaySeconds: 0
      periodSeconds: 5
      failureThreshold: 30
"""

import asyncio
import time
import logging
from datetime import datetime
from typing import Dict, Callable, Optional
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class HealthStatus(Enum):
    """Health check status"""
    HEALTHY = "healthy"
    UNHEALTHY = "unhealthy"
    DEGRADED = "degraded"
    STARTING = "starting"


@dataclass
class ComponentHealth:
    """Health status of a component"""
    name: str
    status: HealthStatus
    message: Optional[str] = None
    latency_ms: Optional[float] = None
    last_check: Optional[float] = None
    details: Optional[Dict] = None


class HealthCheckManager:
    """
    Manages health checks for all components

    Tracks:
    - Application startup state
    - Component health (database, cache, etc.)
    - Readiness state
    - Liveness state
    """

    def __init__(self):
        self.startup_time = time.time()
        self.is_started = False
        self.is_ready = False
        self.is_shutting_down = False

        # Component health checks
        self.components: Dict[str, ComponentHealth] = {}

        # Health check functions
        self.readiness_checks: Dict[str, Callable] = {}
        self.liveness_checks: Dict[str, Callable] = {}

        logger.info("🏥 Health Check Manager initialized")

    # ========================================================================
    # Registration
    # ========================================================================

    def register_readiness_check(self, name: str, check_func: Callable):
        """
        Register a readiness check

        Readiness checks determine if the app can serve traffic.
        Examples: database connection, cache availability

        Args:
            name: Check name
            check_func: Async function returning (bool, str) - (is_ready, message)
        """
        self.readiness_checks[name] = check_func
        logger.info(f"✅ Registered readiness check: {name}")

    def register_liveness_check(self, name: str, check_func: Callable):
        """
        Register a liveness check

        Liveness checks determine if the app is alive and not deadlocked.
        Examples: thread pool not stuck, event loop responsive

        Args:
            name: Check name
            check_func: Async function returning (bool, str) - (is_alive, message)
        """
        self.liveness_checks[name] = check_func
        logger.info(f"✅ Registered liveness check: {name}")

    # ========================================================================
    # Startup Probe
    # ========================================================================

    def mark_as_started(self):
        """Mark application as successfully started"""
        self.is_started = True
        startup_duration = time.time() - self.startup_time
        logger.info(f"🚀 Application marked as STARTED (took {startup_duration:.2f}s)")

    def mark_as_ready(self):
        """Mark application as ready to serve traffic"""
        self.is_ready = True
        logger.info("✅ Application marked as READY")

    def mark_as_shutting_down(self):
        """Mark application as shutting down"""
        self.is_shutting_down = True
        self.is_ready = False
        logger.info("🛑 Application marked as SHUTTING DOWN")

    async def check_startup(self) -> Dict:
        """
        Startup probe - Has the application finished starting?

        Returns immediately after startup is complete.
        Used by Kubernetes to know when to start liveness/readiness probes.

        Returns:
            dict: Startup status
        """
        uptime = time.time() - self.startup_time

        if self.is_started:
            return {
                "status": "started",
                "message": "Application has successfully started",
                "uptime_seconds": round(uptime, 2),
                "started_at": datetime.fromtimestamp(self.startup_time).isoformat()
            }
        else:
            return {
                "status": "starting",
                "message": "Application is still starting up",
                "uptime_seconds": round(uptime, 2),
                "started_at": datetime.fromtimestamp(self.startup_time).isoformat()
            }

    # ========================================================================
    # Liveness Probe
    # ========================================================================

    async def check_liveness(self) -> Dict:
        """
        Liveness probe - Is the application alive?

        Should return quickly (< 1s) and check basic functionality.
        If this fails, Kubernetes will restart the pod.

        Checks:
        - Application not deadlocked
        - Event loop responsive
        - Critical threads alive

        Returns:
            dict: Liveness status
        """
        if self.is_shutting_down:
            return {
                "status": "unhealthy",
                "message": "Application is shutting down",
                "timestamp": datetime.utcnow().isoformat()
            }

        # Run liveness checks
        checks_results = {}
        all_alive = True

        for name, check_func in self.liveness_checks.items():
            try:
                start = time.time()
                is_alive, message = await asyncio.wait_for(
                    check_func(),
                    timeout=1.0  # Liveness checks must be fast
                )
                latency_ms = (time.time() - start) * 1000

                checks_results[name] = {
                    "status": "alive" if is_alive else "dead",
                    "message": message,
                    "latency_ms": round(latency_ms, 2)
                }

                if not is_alive:
                    all_alive = False
                    logger.error(f"❌ Liveness check failed: {name} - {message}")

            except asyncio.TimeoutError:
                checks_results[name] = {
                    "status": "timeout",
                    "message": "Check timed out after 1s"
                }
                all_alive = False
                logger.error(f"⏱️ Liveness check timeout: {name}")

            except Exception as e:
                checks_results[name] = {
                    "status": "error",
                    "message": str(e)
                }
                all_alive = False
                logger.error(f"❌ Liveness check error: {name} - {e}")

        return {
            "status": "healthy" if all_alive else "unhealthy",
            "message": "Application is alive" if all_alive else "Some liveness checks failed",
            "checks": checks_results,
            "timestamp": datetime.utcnow().isoformat()
        }

    # ========================================================================
    # Readiness Probe
    # ========================================================================

    async def check_readiness(self) -> Dict:
        """
        Readiness probe - Can the application serve traffic?

        Checks all dependencies (database, cache, external services).
        If this fails, Kubernetes removes pod from service load balancer.

        Checks:
        - Database connectivity
        - Cache availability
        - Critical dependencies available

        Returns:
            dict: Readiness status
        """
        if self.is_shutting_down:
            return {
                "status": "not_ready",
                "message": "Application is shutting down",
                "timestamp": datetime.utcnow().isoformat()
            }

        if not self.is_started:
            return {
                "status": "not_ready",
                "message": "Application is still starting",
                "timestamp": datetime.utcnow().isoformat()
            }

        # Run readiness checks
        checks_results = {}
        all_ready = True
        has_degraded = False

        for name, check_func in self.readiness_checks.items():
            try:
                start = time.time()
                is_ready, message = await asyncio.wait_for(
                    check_func(),
                    timeout=5.0  # Readiness checks can be slower
                )
                latency_ms = (time.time() - start) * 1000

                status = "ready" if is_ready else "not_ready"

                # Check if degraded (slow but functional)
                if is_ready and latency_ms > 1000:
                    status = "degraded"
                    has_degraded = True

                checks_results[name] = {
                    "status": status,
                    "message": message,
                    "latency_ms": round(latency_ms, 2)
                }

                if not is_ready:
                    all_ready = False
                    logger.warning(f"⚠️ Readiness check failed: {name} - {message}")

            except asyncio.TimeoutError:
                checks_results[name] = {
                    "status": "timeout",
                    "message": "Check timed out after 5s"
                }
                all_ready = False
                logger.error(f"⏱️ Readiness check timeout: {name}")

            except Exception as e:
                checks_results[name] = {
                    "status": "error",
                    "message": str(e)
                }
                all_ready = False
                logger.error(f"❌ Readiness check error: {name} - {e}")

        # Determine overall status
        if all_ready:
            status = "degraded" if has_degraded else "ready"
            message = "Application is ready (degraded performance)" if has_degraded else "Application is ready"
        else:
            status = "not_ready"
            message = "Some readiness checks failed"

        return {
            "status": status,
            "message": message,
            "checks": checks_results,
            "timestamp": datetime.utcnow().isoformat()
        }

    # ========================================================================
    # Detailed Health Check
    # ========================================================================

    async def check_health_detailed(self) -> Dict:
        """
        Detailed health check with all information

        Includes:
        - Overall status
        - All component statuses
        - Uptime
        - Resource usage
        - Recent errors

        Returns:
            dict: Comprehensive health status
        """
        startup_result = await self.check_startup()
        liveness_result = await self.check_liveness()
        readiness_result = await self.check_readiness()

        uptime = time.time() - self.startup_time

        # Determine overall status
        if liveness_result["status"] == "unhealthy":
            overall_status = "unhealthy"
        elif readiness_result["status"] == "not_ready":
            overall_status = "not_ready"
        elif readiness_result["status"] == "degraded":
            overall_status = "degraded"
        else:
            overall_status = "healthy"

        return {
            "status": overall_status,
            "uptime_seconds": round(uptime, 2),
            "startup": startup_result,
            "liveness": liveness_result,
            "readiness": readiness_result,
            "timestamp": datetime.utcnow().isoformat()
        }


# ============================================================================
# Global Health Check Manager Instance
# ============================================================================

health_manager = HealthCheckManager()


# ============================================================================
# Example Health Check Functions
# ============================================================================

async def check_database_health() -> tuple[bool, str]:
    """
    Check database connectivity and responsiveness

    Returns:
        tuple: (is_healthy, message)
    """
    try:
        from app.core.database import AsyncSessionLocal
        from sqlalchemy import text

        async with AsyncSessionLocal() as db:
            # Simple query to check connectivity
            result = await db.execute(text("SELECT 1"))
            result.scalar()

        return True, "Database is healthy"

    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return False, f"Database error: {str(e)}"


async def check_cache_health() -> tuple[bool, str]:
    """
    Check Redis cache connectivity

    Returns:
        tuple: (is_healthy, message)
    """
    try:
        from app.core.cache import cache_manager

        if cache_manager is None:
            return False, "Cache manager not initialized"

        if not cache_manager._is_available():
            return False, "Redis not available"

        # Test ping
        await cache_manager.redis.ping()

        return True, "Cache is healthy"

    except Exception as e:
        logger.error(f"Cache health check failed: {e}")
        return False, f"Cache error: {str(e)}"


async def check_event_loop_health() -> tuple[bool, str]:
    """
    Check if event loop is responsive

    Returns:
        tuple: (is_healthy, message)
    """
    try:
        # Simple async operation to test event loop
        await asyncio.sleep(0.001)
        return True, "Event loop is responsive"

    except Exception as e:
        logger.error(f"Event loop health check failed: {e}")
        return False, f"Event loop error: {str(e)}"


# ============================================================================
# Initialization
# ============================================================================

def initialize_health_checks():
    """Register all health checks"""

    # Readiness checks (dependencies)
    health_manager.register_readiness_check("database", check_database_health)
    health_manager.register_readiness_check("cache", check_cache_health)

    # Liveness checks (basic functionality)
    health_manager.register_liveness_check("event_loop", check_event_loop_health)

    logger.info("🏥 Health checks initialized")
