"""
Simple in-memory cache for API responses
Sprint 6B - Optimisations Backend

Cache LRU (Least Recently Used) avec TTL (Time To Live)

Auteur: Claude Sonnet 4.5
Date: 11 Janvier 2026
"""

import time
from typing import Any, Optional, Dict, Tuple
from functools import wraps
import hashlib
import json
import logging

logger = logging.getLogger(__name__)


class SimpleCache:
    """
    Cache LRU simple en mémoire avec TTL

    Features:
    - TTL configurable par clé
    - Max size pour éviter memory leak
    - Métriques (hits/misses)
    """

    def __init__(self, max_size: int = 1000, default_ttl: int = 3600):
        """
        Args:
            max_size: Nombre maximum d'entrées (défaut: 1000)
            default_ttl: TTL par défaut en secondes (défaut: 1h)
        """
        self.max_size = max_size
        self.default_ttl = default_ttl
        self.cache: Dict[str, Tuple[Any, float]] = {}
        self.hits = 0
        self.misses = 0

    def _make_key(self, *args, **kwargs) -> str:
        """Génère une clé de cache depuis les arguments"""
        key_data = {
            'args': args,
            'kwargs': kwargs
        }
        key_str = json.dumps(key_data, sort_keys=True)
        return hashlib.md5(key_str.encode()).hexdigest()

    def get(self, key: str) -> Optional[Any]:
        """Récupère une valeur du cache"""
        if key not in self.cache:
            self.misses += 1
            return None

        value, expiry = self.cache[key]

        # Vérifier expiration
        if time.time() > expiry:
            del self.cache[key]
            self.misses += 1
            return None

        self.hits += 1
        return value

    def set(self, key: str, value: Any, ttl: Optional[int] = None):
        """Ajoute une valeur au cache"""
        # Appliquer TTL
        ttl = ttl if ttl is not None else self.default_ttl
        expiry = time.time() + ttl

        # Si cache plein, supprimer entrée la plus ancienne (LRU)
        if len(self.cache) >= self.max_size:
            oldest_key = min(self.cache.keys(), key=lambda k: self.cache[k][1])
            del self.cache[oldest_key]
            logger.warning(f"Cache full, evicted key: {oldest_key}")

        self.cache[key] = (value, expiry)

    def delete(self, key: str):
        """Supprime une clé du cache"""
        if key in self.cache:
            del self.cache[key]

    def clear(self):
        """Vide le cache"""
        self.cache.clear()
        self.hits = 0
        self.misses = 0
        logger.info("Cache cleared")

    def get_stats(self) -> Dict:
        """Retourne statistiques du cache"""
        total = self.hits + self.misses
        hit_rate = (self.hits / total * 100) if total > 0 else 0

        return {
            'size': len(self.cache),
            'max_size': self.max_size,
            'hits': self.hits,
            'misses': self.misses,
            'hit_rate_pct': round(hit_rate, 2),
            'total_requests': total
        }


# Instance globale du cache
_cache_instance = SimpleCache(
    max_size=500,      # 500 courbes en cache max
    default_ttl=1800   # 30 minutes par défaut
)


def get_cache() -> SimpleCache:
    """Retourne instance singleton du cache"""
    return _cache_instance


def cache_response(ttl: Optional[int] = None, key_prefix: str = ""):
    """
    Décorateur pour cacher les réponses API

    Args:
        ttl: Durée de vie en secondes (None = défaut du cache)
        key_prefix: Préfixe pour la clé de cache

    Example:
        @cache_response(ttl=600, key_prefix="courbe_theo")
        async def get_courbe_theorique(lot_id: int):
            ...
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            cache = get_cache()

            # Générer clé de cache
            cache_key = f"{key_prefix}:{cache._make_key(*args, **kwargs)}"

            # Vérifier cache
            cached_value = cache.get(cache_key)
            if cached_value is not None:
                logger.debug(f"Cache HIT: {key_prefix}")
                return cached_value

            # Cache miss - appeler fonction
            logger.debug(f"Cache MISS: {key_prefix}")
            result = await func(*args, **kwargs)

            # Mettre en cache
            cache.set(cache_key, result, ttl=ttl)

            return result

        return wrapper
    return decorator
