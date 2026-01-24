"""
SQAL Backend - Graceful Shutdown Handler
Phase 5 - Priority 2: Resilience

Handles graceful shutdown of the application:
1. Stop accepting new requests
2. Wait for in-flight requests to complete
3. Close database connections
4. Close WebSocket connections
5. Flush metrics and logs
6. Exit cleanly

Usage:
    shutdown_handler = GracefulShutdownHandler()

    # Register cleanup tasks
    shutdown_handler.register_cleanup("database", close_db_connections)
    shutdown_handler.register_cleanup("cache", close_cache_connections)

    # In signal handler
    await shutdown_handler.shutdown()
"""

import asyncio
import signal
import logging
from typing import Callable, Dict, List
from datetime import datetime
import time

logger = logging.getLogger(__name__)


class GracefulShutdownHandler:
    """
    Manages graceful shutdown of the application

    Ensures:
    - In-flight requests complete
    - Resources are cleaned up
    - Connections are closed properly
    - Data is persisted
    """

    def __init__(self, shutdown_timeout: float = 30.0):
        """
        Initialize shutdown handler

        Args:
            shutdown_timeout: Maximum seconds to wait for graceful shutdown
        """
        self.shutdown_timeout = shutdown_timeout
        self.is_shutting_down = False
        self.shutdown_started_at: float = None

        # Cleanup tasks (name -> async function)
        self.cleanup_tasks: Dict[str, Callable] = {}

        # Shutdown hooks (executed in order)
        self.shutdown_hooks: List[Callable] = []

        # Active connections/requests counter
        self.active_requests = 0
        self.active_websockets = 0

        logger.info(f"🛑 Graceful Shutdown Handler initialized (timeout: {shutdown_timeout}s)")

    # ========================================================================
    # Registration
    # ========================================================================

    def register_cleanup(self, name: str, cleanup_func: Callable):
        """
        Register a cleanup task

        Args:
            name: Task name for logging
            cleanup_func: Async function to execute during shutdown
        """
        self.cleanup_tasks[name] = cleanup_func
        logger.info(f"✅ Registered cleanup task: {name}")

    def register_hook(self, hook_func: Callable):
        """
        Register a shutdown hook (executed in order)

        Args:
            hook_func: Async function to execute during shutdown
        """
        self.shutdown_hooks.append(hook_func)
        logger.info(f"✅ Registered shutdown hook: {hook_func.__name__}")

    # ========================================================================
    # Request/Connection Tracking
    # ========================================================================

    def request_started(self):
        """Track start of HTTP request"""
        self.active_requests += 1

    def request_finished(self):
        """Track completion of HTTP request"""
        self.active_requests = max(0, self.active_requests - 1)

    def websocket_connected(self):
        """Track WebSocket connection"""
        self.active_websockets += 1

    def websocket_disconnected(self):
        """Track WebSocket disconnection"""
        self.active_websockets = max(0, self.active_websockets - 1)

    def get_active_connections(self) -> Dict:
        """Get count of active connections"""
        return {
            "http_requests": self.active_requests,
            "websocket_connections": self.active_websockets,
            "total": self.active_requests + self.active_websockets
        }

    # ========================================================================
    # Shutdown Process
    # ========================================================================

    async def shutdown(self):
        """
        Execute graceful shutdown

        Process:
        1. Mark as shutting down (stop accepting new requests)
        2. Execute shutdown hooks
        3. Wait for in-flight requests to complete
        4. Execute cleanup tasks
        5. Exit
        """
        if self.is_shutting_down:
            logger.warning("⚠️ Shutdown already in progress")
            return

        self.is_shutting_down = True
        self.shutdown_started_at = time.time()

        logger.info("=" * 80)
        logger.info("🛑 GRACEFUL SHUTDOWN INITIATED")
        logger.info("=" * 80)

        # Step 1: Execute shutdown hooks
        logger.info("📋 Executing shutdown hooks...")
        await self._execute_shutdown_hooks()

        # Step 2: Wait for active connections to finish
        logger.info("⏳ Waiting for active connections to finish...")
        await self._wait_for_connections()

        # Step 3: Execute cleanup tasks
        logger.info("🧹 Executing cleanup tasks...")
        await self._execute_cleanup_tasks()

        # Step 4: Final logging
        shutdown_duration = time.time() - self.shutdown_started_at
        logger.info("=" * 80)
        logger.info(f"✅ GRACEFUL SHUTDOWN COMPLETE (took {shutdown_duration:.2f}s)")
        logger.info("=" * 80)

    async def _execute_shutdown_hooks(self):
        """Execute all registered shutdown hooks in order"""
        for hook in self.shutdown_hooks:
            try:
                logger.info(f"🔄 Executing hook: {hook.__name__}")
                if asyncio.iscoroutinefunction(hook):
                    await hook()
                else:
                    hook()
                logger.info(f"✅ Hook completed: {hook.__name__}")

            except Exception as e:
                logger.error(f"❌ Hook failed: {hook.__name__} - {e}", exc_info=True)

    async def _wait_for_connections(self):
        """Wait for active connections to complete"""
        start_time = time.time()
        timeout = self.shutdown_timeout

        while True:
            connections = self.get_active_connections()
            total = connections["total"]

            if total == 0:
                logger.info("✅ All connections closed")
                break

            elapsed = time.time() - start_time
            if elapsed >= timeout:
                logger.warning(f"⚠️ Timeout reached with {total} active connections:")
                logger.warning(f"   - HTTP requests: {connections['http_requests']}")
                logger.warning(f"   - WebSocket connections: {connections['websocket_connections']}")
                logger.warning("   Forcing shutdown...")
                break

            remaining = timeout - elapsed
            logger.info(f"⏳ Waiting for {total} connections (timeout in {remaining:.1f}s)...")
            await asyncio.sleep(1)

    async def _execute_cleanup_tasks(self):
        """Execute all cleanup tasks"""
        for name, cleanup_func in self.cleanup_tasks.items():
            try:
                logger.info(f"🧹 Cleaning up: {name}")
                start = time.time()

                if asyncio.iscoroutinefunction(cleanup_func):
                    await asyncio.wait_for(
                        cleanup_func(),
                        timeout=10.0  # Individual cleanup timeout
                    )
                else:
                    cleanup_func()

                duration = time.time() - start
                logger.info(f"✅ Cleanup completed: {name} (took {duration:.2f}s)")

            except asyncio.TimeoutError:
                logger.error(f"⏱️ Cleanup timeout: {name}")

            except Exception as e:
                logger.error(f"❌ Cleanup failed: {name} - {e}", exc_info=True)

    # ========================================================================
    # Signal Handler Setup
    # ========================================================================

    def setup_signal_handlers(self, loop: asyncio.AbstractEventLoop):
        """
        Setup signal handlers for graceful shutdown

        Handles: SIGTERM, SIGINT (Ctrl+C)

        Args:
            loop: Event loop to use for shutdown
        """
        def handle_signal(sig):
            logger.info(f"📡 Received signal: {sig}")

            # Schedule shutdown on event loop
            if not self.is_shutting_down:
                asyncio.create_task(self.shutdown())

        # Register signal handlers
        for sig in (signal.SIGTERM, signal.SIGINT):
            loop.add_signal_handler(sig, lambda s=sig: handle_signal(s))

        logger.info("📡 Signal handlers registered (SIGTERM, SIGINT)")


# ============================================================================
# Global Shutdown Handler Instance
# ============================================================================

shutdown_handler = GracefulShutdownHandler(shutdown_timeout=30.0)


# ============================================================================
# Middleware for Request Tracking
# ============================================================================

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class GracefulShutdownMiddleware(BaseHTTPMiddleware):
    """
    Middleware to track active requests and reject during shutdown

    During shutdown:
    - Returns 503 Service Unavailable for new requests
    - Allows in-flight requests to complete
    """

    async def dispatch(self, request: Request, call_next):
        # Check if shutting down
        if shutdown_handler.is_shutting_down:
            logger.warning(f"⚠️ Rejecting request during shutdown: {request.url.path}")
            return Response(
                content="Service is shutting down",
                status_code=503,
                headers={"Retry-After": "30"}
            )

        # Track active request
        shutdown_handler.request_started()

        try:
            response = await call_next(request)
            return response

        finally:
            shutdown_handler.request_finished()


# ============================================================================
# Helper: Cleanup Functions
# ============================================================================

async def cleanup_database():
    """Close database connections"""
    try:
        from app.core.database import close_db
        await close_db()
        logger.info("✅ Database connections closed")
    except Exception as e:
        logger.error(f"❌ Error closing database: {e}")


async def cleanup_cache():
    """Close cache connections"""
    try:
        from app.core.cache import cache_manager
        if cache_manager:
            await cache_manager.disconnect()
        logger.info("✅ Cache connections closed")
    except Exception as e:
        logger.error(f"❌ Error closing cache: {e}")


async def cleanup_websockets(connected_dashboards: dict):
    """Close all WebSocket connections gracefully"""
    try:
        logger.info(f"📡 Closing {len(connected_dashboards)} WebSocket connections...")

        for ws in list(connected_dashboards.keys()):
            try:
                await ws.send_json({
                    "type": "server_shutdown",
                    "message": "Server is shutting down. Please reconnect.",
                    "timestamp": datetime.utcnow().isoformat()
                })
                await ws.close()
            except Exception as e:
                logger.debug(f"Error closing WebSocket: {e}")

        connected_dashboards.clear()
        logger.info("✅ WebSocket connections closed")

    except Exception as e:
        logger.error(f"❌ Error closing WebSockets: {e}")


def initialize_graceful_shutdown():
    """Register all cleanup tasks"""

    # Register cleanup tasks
    shutdown_handler.register_cleanup("database", cleanup_database)
    shutdown_handler.register_cleanup("cache", cleanup_cache)

    logger.info("🛑 Graceful shutdown initialized")
