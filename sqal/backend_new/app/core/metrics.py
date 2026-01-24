"""
SQAL Backend - Prometheus Metrics Module
Phase 5 - Priority 1: Monitoring & Metrics

Exports production-ready metrics for Prometheus scraping:
- HTTP request metrics (count, duration, status codes)
- Cache performance (hits, misses, latency)
- Sensor data processing (samples analyzed, defects detected)
- Database connections
- WebSocket connections
- Business metrics (quality scores, grade distribution)
"""

from prometheus_client import Counter, Histogram, Gauge, Info, CollectorRegistry, generate_latest, CONTENT_TYPE_LATEST
from functools import wraps
import time
import logging
from typing import Callable
from fastapi import Request, Response

logger = logging.getLogger(__name__)

# ============================================================================
# Prometheus Registry
# ============================================================================

# Create custom registry for better control
metrics_registry = CollectorRegistry()

# ============================================================================
# Application Info
# ============================================================================

app_info = Info(
    'sqal_application',
    'SQAL Backend Application Information',
    registry=metrics_registry
)

app_info.info({
    'version': '2.5.0',
    'phase': 'Phase 5 - Monitoring & Production',
    'environment': 'production'
})

# ============================================================================
# HTTP Metrics
# ============================================================================

http_requests_total = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status_code'],
    registry=metrics_registry
)

http_request_duration_seconds = Histogram(
    'http_request_duration_seconds',
    'HTTP request latency in seconds',
    ['method', 'endpoint'],
    buckets=[0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
    registry=metrics_registry
)

http_request_size_bytes = Histogram(
    'http_request_size_bytes',
    'HTTP request size in bytes',
    ['method', 'endpoint'],
    buckets=[100, 1000, 10000, 100000, 1000000],
    registry=metrics_registry
)

http_response_size_bytes = Histogram(
    'http_response_size_bytes',
    'HTTP response size in bytes',
    ['method', 'endpoint'],
    buckets=[100, 1000, 10000, 100000, 1000000],
    registry=metrics_registry
)

# ============================================================================
# Cache Metrics
# ============================================================================

cache_hits_total = Counter(
    'cache_hits_total',
    'Total cache hits',
    ['cache_key'],
    registry=metrics_registry
)

cache_misses_total = Counter(
    'cache_misses_total',
    'Total cache misses',
    ['cache_key'],
    registry=metrics_registry
)

cache_operation_duration_seconds = Histogram(
    'cache_operation_duration_seconds',
    'Cache operation latency in seconds',
    ['operation', 'cache_key'],
    buckets=[0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5],
    registry=metrics_registry
)

cache_size_bytes = Gauge(
    'cache_size_bytes',
    'Current cache size in bytes',
    registry=metrics_registry
)

cache_keys_total = Gauge(
    'cache_keys_total',
    'Total number of keys in cache',
    registry=metrics_registry
)

# ============================================================================
# Sensor & Sample Metrics
# ============================================================================

samples_analyzed_total = Counter(
    'samples_analyzed_total',
    'Total samples analyzed',
    ['device_id', 'grade'],
    registry=metrics_registry
)

sample_processing_duration_seconds = Histogram(
    'sample_processing_duration_seconds',
    'Sample processing latency in seconds',
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0],
    registry=metrics_registry
)

sample_quality_score = Histogram(
    'sample_quality_score',
    'Sample quality score distribution',
    ['device_id'],
    buckets=[0.0, 0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95, 1.0],
    registry=metrics_registry
)

defects_detected_total = Counter(
    'defects_detected_total',
    'Total defects detected',
    ['device_id', 'defect_type'],
    registry=metrics_registry
)

# Grade distribution gauges (for dashboards)
grade_a_plus_total = Gauge(
    'grade_a_plus_total',
    'Total A+ grade samples',
    ['device_id'],
    registry=metrics_registry
)

grade_a_total = Gauge(
    'grade_a_total',
    'Total A grade samples',
    ['device_id'],
    registry=metrics_registry
)

grade_b_total = Gauge(
    'grade_b_total',
    'Total B grade samples',
    ['device_id'],
    registry=metrics_registry
)

grade_c_total = Gauge(
    'grade_c_total',
    'Total C grade samples',
    ['device_id'],
    registry=metrics_registry
)

grade_reject_total = Gauge(
    'grade_reject_total',
    'Total REJECT grade samples',
    ['device_id'],
    registry=metrics_registry
)

# ============================================================================
# Database Metrics
# ============================================================================

db_connections_active = Gauge(
    'db_connections_active',
    'Number of active database connections',
    registry=metrics_registry
)

db_query_duration_seconds = Histogram(
    'db_query_duration_seconds',
    'Database query latency in seconds',
    ['query_type'],
    buckets=[0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0],
    registry=metrics_registry
)

db_operations_total = Counter(
    'db_operations_total',
    'Total database operations',
    ['operation', 'status'],
    registry=metrics_registry
)

db_pool_size = Gauge(
    'db_pool_size',
    'Database connection pool size',
    registry=metrics_registry
)

db_pool_available = Gauge(
    'db_pool_available',
    'Available database connections in pool',
    registry=metrics_registry
)

# ============================================================================
# WebSocket Metrics
# ============================================================================

websocket_connections_active = Gauge(
    'websocket_connections_active',
    'Number of active WebSocket connections',
    ['endpoint'],
    registry=metrics_registry
)

websocket_messages_total = Counter(
    'websocket_messages_total',
    'Total WebSocket messages',
    ['endpoint', 'direction'],  # direction: inbound/outbound
    registry=metrics_registry
)

websocket_errors_total = Counter(
    'websocket_errors_total',
    'Total WebSocket errors',
    ['endpoint', 'error_type'],
    registry=metrics_registry
)

# ============================================================================
# Business Metrics
# ============================================================================

production_throughput = Gauge(
    'production_throughput_samples_per_hour',
    'Production throughput in samples per hour',
    ['device_id'],
    registry=metrics_registry
)

conformity_rate = Gauge(
    'conformity_rate_percent',
    'Conformity rate percentage (non-REJECT)',
    ['device_id'],
    registry=metrics_registry
)

reject_rate = Gauge(
    'reject_rate_percent',
    'Reject rate percentage',
    ['device_id'],
    registry=metrics_registry
)

average_quality_score = Gauge(
    'average_quality_score',
    'Average quality score',
    ['device_id'],
    registry=metrics_registry
)

# ============================================================================
# System Metrics
# ============================================================================

system_uptime_seconds = Gauge(
    'system_uptime_seconds',
    'System uptime in seconds',
    registry=metrics_registry
)

# ============================================================================
# Middleware & Decorators
# ============================================================================

async def prometheus_middleware(request: Request, call_next: Callable) -> Response:
    """
    FastAPI middleware to track HTTP metrics automatically

    Tracks:
    - Request count by method, endpoint, status code
    - Request duration
    - Request/response size
    """
    # Skip metrics endpoint itself to avoid recursion
    if request.url.path == "/metrics":
        return await call_next(request)

    # Extract endpoint path (remove query params)
    endpoint = request.url.path
    method = request.method

    # Track request size
    request_size = int(request.headers.get('content-length', 0))
    if request_size > 0:
        http_request_size_bytes.labels(method=method, endpoint=endpoint).observe(request_size)

    # Start timer
    start_time = time.time()

    # Process request
    response = await call_next(request)

    # Calculate duration
    duration = time.time() - start_time

    # Track metrics
    status_code = response.status_code
    http_requests_total.labels(method=method, endpoint=endpoint, status_code=status_code).inc()
    http_request_duration_seconds.labels(method=method, endpoint=endpoint).observe(duration)

    # Track response size if available
    if hasattr(response, 'body'):
        response_size = len(response.body)
        http_response_size_bytes.labels(method=method, endpoint=endpoint).observe(response_size)

    return response


def track_time(metric: Histogram, **labels):
    """
    Decorator to track execution time of a function

    Example:
        @track_time(sample_processing_duration_seconds)
        async def process_sample(data):
            ...
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                result = await func(*args, **kwargs)
                return result
            finally:
                duration = time.time() - start_time
                if labels:
                    metric.labels(**labels).observe(duration)
                else:
                    metric.observe(duration)

        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                result = func(*args, **kwargs)
                return result
            finally:
                duration = time.time() - start_time
                if labels:
                    metric.labels(**labels).observe(duration)
                else:
                    metric.observe(duration)

        # Return appropriate wrapper based on function type
        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper

    return decorator


# ============================================================================
# Helper Functions
# ============================================================================

def record_sample_analyzed(device_id: str, grade: str, quality_score: float, processing_time: float):
    """
    Record metrics for an analyzed sample

    Args:
        device_id: Device ID
        grade: Quality grade (A+, A, B, C, REJECT)
        quality_score: Quality score (0.0-1.0)
        processing_time: Processing time in seconds
    """
    # Count sample
    samples_analyzed_total.labels(device_id=device_id, grade=grade).inc()

    # Record quality score
    sample_quality_score.labels(device_id=device_id).observe(quality_score)

    # Record processing time
    sample_processing_duration_seconds.observe(processing_time)

    logger.debug(f"📊 Metrics recorded: device={device_id}, grade={grade}, score={quality_score:.3f}")


def record_cache_operation(operation: str, cache_key: str, hit: bool, duration: float):
    """
    Record cache operation metrics

    Args:
        operation: Operation type (get, set, delete)
        cache_key: Cache key name
        hit: Whether it was a cache hit (for get operations)
        duration: Operation duration in seconds
    """
    # Record hit/miss
    if operation == "get":
        if hit:
            cache_hits_total.labels(cache_key=cache_key).inc()
        else:
            cache_misses_total.labels(cache_key=cache_key).inc()

    # Record duration
    cache_operation_duration_seconds.labels(operation=operation, cache_key=cache_key).observe(duration)


def record_db_operation(operation: str, status: str, duration: float, query_type: str = "unknown"):
    """
    Record database operation metrics

    Args:
        operation: Operation type (select, insert, update, delete)
        status: Operation status (success, error)
        duration: Operation duration in seconds
        query_type: Type of query for better categorization
    """
    db_operations_total.labels(operation=operation, status=status).inc()
    db_query_duration_seconds.labels(query_type=query_type).observe(duration)


def update_websocket_connections(endpoint: str, delta: int):
    """
    Update WebSocket connection count

    Args:
        endpoint: WebSocket endpoint path
        delta: Change in connection count (+1 for connect, -1 for disconnect)
    """
    if delta > 0:
        websocket_connections_active.labels(endpoint=endpoint).inc()
    elif delta < 0:
        websocket_connections_active.labels(endpoint=endpoint).dec()


def record_websocket_message(endpoint: str, direction: str):
    """
    Record WebSocket message

    Args:
        endpoint: WebSocket endpoint path
        direction: Message direction (inbound/outbound)
    """
    websocket_messages_total.labels(endpoint=endpoint, direction=direction).inc()


def update_business_metrics(device_id: str, stats: dict):
    """
    Update business-level metrics

    Args:
        device_id: Device ID
        stats: Dictionary with:
            - conformity_rate: Percentage
            - reject_rate: Percentage
            - avg_quality: Average score
            - throughput: Samples per hour
            - grade_counts: Dict with grade counts
    """
    conformity_rate.labels(device_id=device_id).set(stats.get('conformity_rate', 0))
    reject_rate.labels(device_id=device_id).set(stats.get('reject_rate', 0))
    average_quality_score.labels(device_id=device_id).set(stats.get('avg_quality', 0))
    production_throughput.labels(device_id=device_id).set(stats.get('throughput', 0))

    # Update grade gauges
    grade_counts = stats.get('grade_counts', {})
    grade_a_plus_total.labels(device_id=device_id).set(grade_counts.get('A+', 0))
    grade_a_total.labels(device_id=device_id).set(grade_counts.get('A', 0))
    grade_b_total.labels(device_id=device_id).set(grade_counts.get('B', 0))
    grade_c_total.labels(device_id=device_id).set(grade_counts.get('C', 0))
    grade_reject_total.labels(device_id=device_id).set(grade_counts.get('REJECT', 0))


# ============================================================================
# Metrics Endpoint Handler
# ============================================================================

def get_metrics() -> tuple[bytes, str]:
    """
    Generate Prometheus metrics in text format

    Returns:
        Tuple of (metrics_bytes, content_type)
    """
    metrics = generate_latest(metrics_registry)
    return metrics, CONTENT_TYPE_LATEST


# ============================================================================
# Startup Hook
# ============================================================================

def initialize_metrics():
    """
    Initialize metrics on application startup
    """
    logger.info("📊 Prometheus metrics initialized")
    logger.info("📊 Metrics endpoint: GET /metrics")
    logger.info("📊 Available metrics:")
    logger.info("   - http_requests_total")
    logger.info("   - http_request_duration_seconds")
    logger.info("   - cache_hits_total / cache_misses_total")
    logger.info("   - samples_analyzed_total")
    logger.info("   - sample_quality_score")
    logger.info("   - db_connections_active")
    logger.info("   - websocket_connections_active")
    logger.info("   - conformity_rate_percent")
    logger.info("   - production_throughput_samples_per_hour")
