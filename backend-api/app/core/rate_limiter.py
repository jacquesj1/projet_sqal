"""
Rate Limiting for WebSocket Connections
Prevents DDoS and abusive clients
"""
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, List
import logging

logger = logging.getLogger(__name__)


class RateLimiter:
    """
    Token bucket rate limiter for WebSocket connections

    Allows burst traffic but enforces average rate limit over a time window.
    """

    def __init__(self, max_requests: int = 100, window_seconds: int = 60):
        """
        Initialize rate limiter

        Args:
            max_requests: Maximum number of requests allowed in the time window
            window_seconds: Time window in seconds
        """
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests: Dict[str, List[datetime]] = defaultdict(list)

        logger.info(f"🛡️ Rate limiter initialized: {max_requests} requests per {window_seconds}s")

    def is_allowed(self, client_id: str) -> bool:
        """
        Check if a request from this client is allowed

        Args:
            client_id: Unique identifier for the client

        Returns:
            True if request is allowed, False if rate limit exceeded
        """
        now = datetime.now()
        window_start = now - timedelta(seconds=self.window_seconds)

        # Clean old requests outside the time window
        self.requests[client_id] = [
            req_time for req_time in self.requests[client_id]
            if req_time > window_start
        ]

        # Check if limit is exceeded
        current_count = len(self.requests[client_id])

        if current_count >= self.max_requests:
            logger.warning(
                f"⚠️ Rate limit exceeded for {client_id}: "
                f"{current_count} requests in last {self.window_seconds}s"
            )
            return False

        # Record this request
        self.requests[client_id].append(now)
        return True

    def get_usage(self, client_id: str) -> Dict[str, any]:
        """
        Get current usage stats for a client

        Args:
            client_id: Unique identifier for the client

        Returns:
            Dictionary with usage statistics
        """
        now = datetime.now()
        window_start = now - timedelta(seconds=self.window_seconds)

        # Clean old requests
        self.requests[client_id] = [
            req_time for req_time in self.requests[client_id]
            if req_time > window_start
        ]

        current_count = len(self.requests[client_id])

        return {
            "client_id": client_id,
            "requests_in_window": current_count,
            "max_requests": self.max_requests,
            "window_seconds": self.window_seconds,
            "remaining": max(0, self.max_requests - current_count),
            "usage_percent": (current_count / self.max_requests * 100) if self.max_requests > 0 else 0
        }

    def reset(self, client_id: str = None):
        """
        Reset rate limit for a specific client or all clients

        Args:
            client_id: Client to reset, or None to reset all
        """
        if client_id:
            if client_id in self.requests:
                del self.requests[client_id]
                logger.info(f"🔄 Rate limit reset for {client_id}")
        else:
            self.requests.clear()
            logger.info("🔄 Rate limit reset for all clients")

    def cleanup_old_entries(self):
        """
        Clean up old entries from memory (call periodically)
        """
        now = datetime.now()
        window_start = now - timedelta(seconds=self.window_seconds * 2)  # Keep 2x window for safety

        clients_to_remove = []

        for client_id, timestamps in self.requests.items():
            # Remove old timestamps
            recent_timestamps = [ts for ts in timestamps if ts > window_start]

            if not recent_timestamps:
                clients_to_remove.append(client_id)
            else:
                self.requests[client_id] = recent_timestamps

        # Remove clients with no recent activity
        for client_id in clients_to_remove:
            del self.requests[client_id]

        if clients_to_remove:
            logger.debug(f"🧹 Cleaned up {len(clients_to_remove)} inactive clients from rate limiter")


class AdaptiveRateLimiter(RateLimiter):
    """
    Adaptive rate limiter that adjusts limits based on system load

    Can be used for more sophisticated rate limiting in production.
    """

    def __init__(self,
                 base_max_requests: int = 100,
                 window_seconds: int = 60,
                 high_load_threshold: float = 0.8):
        """
        Initialize adaptive rate limiter

        Args:
            base_max_requests: Base maximum requests (will be adjusted)
            window_seconds: Time window in seconds
            high_load_threshold: System load threshold to trigger rate reduction (0.0-1.0)
        """
        super().__init__(base_max_requests, window_seconds)
        self.base_max_requests = base_max_requests
        self.high_load_threshold = high_load_threshold
        self.current_load = 0.0

    def update_system_load(self, load: float):
        """
        Update current system load

        Args:
            load: Current system load (0.0-1.0, where 1.0 is maximum)
        """
        self.current_load = max(0.0, min(1.0, load))

        # Adjust max_requests based on load
        if self.current_load >= self.high_load_threshold:
            # Reduce rate limit under high load
            reduction_factor = 1.0 - ((self.current_load - self.high_load_threshold) / (1.0 - self.high_load_threshold))
            self.max_requests = int(self.base_max_requests * max(0.5, reduction_factor))
            logger.info(f"⚡ Adaptive rate limit adjusted to {self.max_requests} (load: {self.current_load:.1%})")
        else:
            # Restore normal limit
            self.max_requests = self.base_max_requests
