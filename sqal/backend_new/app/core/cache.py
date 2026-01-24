"""
Redis Cache Manager for SQAL Backend
Provides caching layer to reduce database load and improve response times
"""
import json
import logging
from typing import Optional, Any, List, Dict
from datetime import datetime, timedelta
import redis.asyncio as redis

logger = logging.getLogger(__name__)


class CacheManager:
    """
    Redis-based cache manager with automatic TTL and invalidation

    Features:
    - Latest sample caching (10s TTL)
    - Dashboard metrics caching (5min TTL)
    - Historical stats caching (15min TTL)
    - Automatic serialization/deserialization
    - Connection pooling
    """

    def __init__(self, redis_url: str = "redis://localhost:6379"):
        """
        Initialize cache manager

        Args:
            redis_url: Redis connection URL
        """
        self.redis_url = redis_url
        self.redis: Optional[redis.Redis] = None
        self._connected = False

    async def connect(self):
        """Establish Redis connection"""
        try:
            self.redis = await redis.from_url(
                self.redis_url,
                encoding="utf-8",
                decode_responses=True,
                max_connections=20
            )

            # Test connection
            await self.redis.ping()
            self._connected = True
            logger.info(f"✅ Redis connected: {self.redis_url}")

        except Exception as e:
            logger.error(f"❌ Redis connection failed: {e}")
            logger.warning("⚠️ Running without cache - will use database directly")
            self._connected = False

    async def disconnect(self):
        """Close Redis connection"""
        if self.redis:
            await self.redis.close()
            self._connected = False
            logger.info("🔌 Redis disconnected")

    def _is_available(self) -> bool:
        """Check if Redis is available"""
        return self._connected and self.redis is not None

    # ========================================================================
    # LATEST SAMPLE CACHE (TTL: 10 seconds)
    # ========================================================================

    async def get_latest_sample(self) -> Optional[Dict[str, Any]]:
        """
        Get latest sensor sample from cache

        Returns:
            Latest sample dict or None if not cached
        """
        if not self._is_available():
            return None

        try:
            data = await self.redis.get("latest_sample")
            if data:
                logger.debug("✅ Cache HIT: latest_sample")
                return json.loads(data)
            else:
                logger.debug("❌ Cache MISS: latest_sample")
                return None
        except Exception as e:
            logger.error(f"Redis get error: {e}")
            return None

    async def set_latest_sample(self, sample: Dict[str, Any], ttl: int = 10):
        """
        Cache latest sensor sample

        Args:
            sample: Sample dictionary
            ttl: Time to live in seconds (default: 10s)
        """
        if not self._is_available():
            return

        try:
            await self.redis.setex(
                "latest_sample",
                ttl,
                json.dumps(sample, default=str)  # default=str for datetime
            )
            logger.debug(f"✅ Cache SET: latest_sample (TTL={ttl}s)")
        except Exception as e:
            logger.error(f"Redis set error: {e}")

    # ========================================================================
    # DASHBOARD METRICS CACHE (TTL: 5 minutes)
    # ========================================================================

    async def get_dashboard_metrics(self) -> Optional[Dict[str, Any]]:
        """
        Get dashboard metrics from cache

        Returns:
            Metrics dict or None if not cached
        """
        if not self._is_available():
            return None

        try:
            data = await self.redis.get("dashboard:metrics")
            if data:
                logger.debug("✅ Cache HIT: dashboard:metrics")
                return json.loads(data)
            else:
                logger.debug("❌ Cache MISS: dashboard:metrics")
                return None
        except Exception as e:
            logger.error(f"Redis get error: {e}")
            return None

    async def set_dashboard_metrics(self, metrics: Dict[str, Any], ttl: int = 300):
        """
        Cache dashboard metrics

        Args:
            metrics: Metrics dictionary
            ttl: Time to live in seconds (default: 5min)
        """
        if not self._is_available():
            return

        try:
            await self.redis.setex(
                "dashboard:metrics",
                ttl,
                json.dumps(metrics, default=str)
            )
            logger.debug(f"✅ Cache SET: dashboard:metrics (TTL={ttl}s)")
        except Exception as e:
            logger.error(f"Redis set error: {e}")

    # ========================================================================
    # FOIE GRAS METRICS CACHE (TTL: 5 minutes)
    # ========================================================================

    async def get_foie_gras_metrics(self) -> Optional[Dict[str, Any]]:
        """Get foie gras specific metrics from cache"""
        if not self._is_available():
            return None

        try:
            data = await self.redis.get("dashboard:foie_gras_metrics")
            if data:
                logger.debug("✅ Cache HIT: foie_gras_metrics")
                return json.loads(data)
            return None
        except Exception as e:
            logger.error(f"Redis get error: {e}")
            return None

    async def set_foie_gras_metrics(self, metrics: Dict[str, Any], ttl: int = 300):
        """Cache foie gras metrics"""
        if not self._is_available():
            return

        try:
            await self.redis.setex(
                "dashboard:foie_gras_metrics",
                ttl,
                json.dumps(metrics, default=str)
            )
            logger.debug(f"✅ Cache SET: foie_gras_metrics (TTL={ttl}s)")
        except Exception as e:
            logger.error(f"Redis set error: {e}")

    # ========================================================================
    # DEVICE STATS CACHE (TTL: 15 minutes)
    # ========================================================================

    async def get_device_stats(self, device_id: str) -> Optional[Dict[str, Any]]:
        """
        Get device statistics from cache

        Args:
            device_id: Device identifier

        Returns:
            Stats dict or None if not cached
        """
        if not self._is_available():
            return None

        try:
            key = f"device:{device_id}:stats"
            data = await self.redis.get(key)
            if data:
                logger.debug(f"✅ Cache HIT: {key}")
                return json.loads(data)
            else:
                logger.debug(f"❌ Cache MISS: {key}")
                return None
        except Exception as e:
            logger.error(f"Redis get error: {e}")
            return None

    async def set_device_stats(
        self,
        device_id: str,
        stats: Dict[str, Any],
        ttl: int = 900
    ):
        """
        Cache device statistics

        Args:
            device_id: Device identifier
            stats: Statistics dictionary
            ttl: Time to live in seconds (default: 15min)
        """
        if not self._is_available():
            return

        try:
            key = f"device:{device_id}:stats"
            await self.redis.setex(
                key,
                ttl,
                json.dumps(stats, default=str)
            )
            logger.debug(f"✅ Cache SET: {key} (TTL={ttl}s)")
        except Exception as e:
            logger.error(f"Redis set error: {e}")

    # ========================================================================
    # AGGREGATED DATA CACHE (TTL: 10 minutes)
    # ========================================================================

    async def get_hourly_aggregates(self, device_id: str) -> Optional[List[Dict]]:
        """Get hourly aggregates from cache"""
        if not self._is_available():
            return None

        try:
            key = f"aggregates:hourly:{device_id}"
            data = await self.redis.get(key)
            if data:
                logger.debug(f"✅ Cache HIT: {key}")
                return json.loads(data)
            return None
        except Exception as e:
            logger.error(f"Redis get error: {e}")
            return None

    async def set_hourly_aggregates(
        self,
        device_id: str,
        aggregates: List[Dict],
        ttl: int = 600
    ):
        """Cache hourly aggregates"""
        if not self._is_available():
            return

        try:
            key = f"aggregates:hourly:{device_id}"
            await self.redis.setex(
                key,
                ttl,
                json.dumps(aggregates, default=str)
            )
            logger.debug(f"✅ Cache SET: {key} (TTL={ttl}s)")
        except Exception as e:
            logger.error(f"Redis set error: {e}")

    # ========================================================================
    # CACHE INVALIDATION
    # ========================================================================

    async def invalidate_all(self):
        """Invalidate all cache entries"""
        if not self._is_available():
            return

        try:
            await self.redis.flushdb()
            logger.info("🗑️ Cache cleared: all entries")
        except Exception as e:
            logger.error(f"Redis flush error: {e}")

    async def invalidate_device(self, device_id: str):
        """
        Invalidate all cache entries for a specific device

        Args:
            device_id: Device identifier
        """
        if not self._is_available():
            return

        try:
            # Find all keys for this device
            pattern = f"device:{device_id}:*"
            keys = []
            async for key in self.redis.scan_iter(match=pattern):
                keys.append(key)

            if keys:
                await self.redis.delete(*keys)
                logger.info(f"🗑️ Cache cleared: {len(keys)} entries for device {device_id}")
        except Exception as e:
            logger.error(f"Redis invalidation error: {e}")

    async def invalidate_pattern(self, pattern: str):
        """
        Invalidate cache entries matching a pattern

        Args:
            pattern: Redis key pattern (e.g., "dashboard:*")
        """
        if not self._is_available():
            return

        try:
            keys = []
            async for key in self.redis.scan_iter(match=pattern):
                keys.append(key)

            if keys:
                await self.redis.delete(*keys)
                logger.info(f"🗑️ Cache cleared: {len(keys)} entries matching {pattern}")
        except Exception as e:
            logger.error(f"Redis invalidation error: {e}")

    # ========================================================================
    # CACHE STATISTICS
    # ========================================================================

    async def get_cache_stats(self) -> Dict[str, Any]:
        """
        Get cache statistics

        Returns:
            Dictionary with cache stats (keys count, memory usage, etc.)
        """
        if not self._is_available():
            return {
                "available": False,
                "error": "Redis not connected"
            }

        try:
            info = await self.redis.info("stats")
            memory_info = await self.redis.info("memory")
            dbsize = await self.redis.dbsize()

            return {
                "available": True,
                "total_keys": dbsize,
                "memory_used_mb": round(memory_info['used_memory'] / 1024 / 1024, 2),
                "memory_peak_mb": round(memory_info['used_memory_peak'] / 1024 / 1024, 2),
                "total_commands": info['total_commands_processed'],
                "hit_rate": self._calculate_hit_rate(info),
                "evicted_keys": info.get('evicted_keys', 0),
                "expired_keys": info.get('expired_keys', 0),
            }
        except Exception as e:
            logger.error(f"Redis stats error: {e}")
            return {
                "available": True,
                "error": str(e)
            }

    def _calculate_hit_rate(self, info: Dict) -> float:
        """Calculate cache hit rate percentage"""
        hits = info.get('keyspace_hits', 0)
        misses = info.get('keyspace_misses', 0)
        total = hits + misses

        if total == 0:
            return 0.0

        return round((hits / total) * 100, 2)

    # ========================================================================
    # UTILITY METHODS
    # ========================================================================

    async def exists(self, key: str) -> bool:
        """Check if a key exists in cache"""
        if not self._is_available():
            return False

        try:
            return bool(await self.redis.exists(key))
        except Exception as e:
            logger.error(f"Redis exists error: {e}")
            return False

    async def get_ttl(self, key: str) -> int:
        """
        Get remaining TTL for a key

        Returns:
            Remaining seconds or -1 if key doesn't exist
        """
        if not self._is_available():
            return -1

        try:
            return await self.redis.ttl(key)
        except Exception as e:
            logger.error(f"Redis TTL error: {e}")
            return -1


# ============================================================================
# GLOBAL CACHE INSTANCE
# ============================================================================

# Will be initialized in main.py lifespan
cache: Optional[CacheManager] = None


def get_cache() -> Optional[CacheManager]:
    """Get global cache instance"""
    return cache
