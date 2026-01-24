"""
Endpoint Métriques et Monitoring
Sprint 6B - Optimisations Backend

Expose métriques de performance:
- Cache stats
- API response times
- Error rates

Auteur: Claude Sonnet 4.5
Date: 11 Janvier 2026
"""

from fastapi import APIRouter, Depends
from typing import Dict
import time
import psutil
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/metrics", tags=["Metrics"])


# Métriques en mémoire
_metrics = {
    'requests_total': 0,
    'requests_by_endpoint': {},
    'errors_total': 0,
    'start_time': time.time()
}


def increment_request(endpoint: str):
    """Incrémente compteur de requêtes"""
    _metrics['requests_total'] += 1
    if endpoint not in _metrics['requests_by_endpoint']:
        _metrics['requests_by_endpoint'][endpoint] = 0
    _metrics['requests_by_endpoint'][endpoint] += 1


def increment_error():
    """Incrémente compteur d'erreurs"""
    _metrics['errors_total'] += 1


@router.get("/")
async def get_metrics() -> Dict:
    """
    Retourne métriques globales du système

    Returns:
        - Cache stats (hits, misses, hit rate)
        - Request metrics (total, by endpoint)
        - System metrics (CPU, RAM, uptime)
    """
    from app.cache.simple_cache import get_cache

    cache = get_cache()
    cache_stats = cache.get_stats()

    # System metrics
    uptime_seconds = time.time() - _metrics['start_time']
    cpu_percent = psutil.cpu_percent(interval=0.1)
    memory = psutil.virtual_memory()

    return {
        'cache': cache_stats,
        'requests': {
            'total': _metrics['requests_total'],
            'errors': _metrics['errors_total'],
            'error_rate_pct': (
                _metrics['errors_total'] / _metrics['requests_total'] * 100
                if _metrics['requests_total'] > 0 else 0
            ),
            'by_endpoint': _metrics['requests_by_endpoint']
        },
        'system': {
            'uptime_seconds': round(uptime_seconds, 2),
            'uptime_formatted': format_uptime(uptime_seconds),
            'cpu_percent': cpu_percent,
            'memory_percent': memory.percent,
            'memory_available_mb': round(memory.available / 1024 / 1024, 2)
        }
    }


@router.get("/cache")
async def get_cache_stats() -> Dict:
    """Retourne stats détaillées du cache"""
    from app.cache.simple_cache import get_cache

    cache = get_cache()
    stats = cache.get_stats()

    return {
        **stats,
        'efficiency': 'high' if stats['hit_rate_pct'] > 70 else 'medium' if stats['hit_rate_pct'] > 40 else 'low',
        'fill_rate_pct': round(stats['size'] / stats['max_size'] * 100, 2)
    }


@router.delete("/cache")
async def clear_cache() -> Dict:
    """Vide le cache (admin only)"""
    from app.cache.simple_cache import get_cache

    cache = get_cache()
    old_stats = cache.get_stats()
    cache.clear()

    logger.info(f"Cache cleared by admin (was {old_stats['size']} entries)")

    return {
        'success': True,
        'message': f"Cache cleared ({old_stats['size']} entries removed)",
        'old_stats': old_stats
    }


def format_uptime(seconds: float) -> str:
    """Formate uptime en format lisible"""
    days = int(seconds // 86400)
    hours = int((seconds % 86400) // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)

    if days > 0:
        return f"{days}d {hours}h {minutes}m"
    elif hours > 0:
        return f"{hours}h {minutes}m {secs}s"
    elif minutes > 0:
        return f"{minutes}m {secs}s"
    else:
        return f"{secs}s"
