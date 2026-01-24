"""
Configuration ML et Cache Analytics Euralis

Gère la stratégie de calcul des analytics ML:
- Temps réel: Calcul à la demande
- Batch: Pré-calculé la nuit (par défaut)
- Cache: Durée de vie configurable
"""

import os
from datetime import timedelta

class MLConfig:
    """Configuration globale ML"""

    # Mode de calcul ML
    # "realtime" = Calcul à chaque requête
    # "batch" = Utilise cache pré-calculé (refresh nuit)
    ML_MODE = os.getenv('ML_MODE', 'batch')

    # Durée de vie du cache (en secondes)
    CACHE_TTL_FORECASTS = int(os.getenv('CACHE_TTL_FORECASTS', 3600 * 6))  # 6h par défaut
    CACHE_TTL_CLUSTERS = int(os.getenv('CACHE_TTL_CLUSTERS', 3600 * 12))   # 12h par défaut
    CACHE_TTL_ANOMALIES = int(os.getenv('CACHE_TTL_ANOMALIES', 3600 * 1))  # 1h par défaut
    CACHE_TTL_OPTIMIZATION = int(os.getenv('CACHE_TTL_OPTIMIZATION', 3600 * 24))  # 24h par défaut

    # Heure de refresh batch (format 24h)
    BATCH_REFRESH_HOUR = int(os.getenv('BATCH_REFRESH_HOUR', 2))  # 2h du matin par défaut

    # Activer force refresh via query param ?force_refresh=true
    ALLOW_FORCE_REFRESH = os.getenv('ALLOW_FORCE_REFRESH', 'true').lower() == 'true'

    @classmethod
    def is_realtime_mode(cls) -> bool:
        """Vérifie si on est en mode temps réel"""
        return cls.ML_MODE == 'realtime'

    @classmethod
    def get_cache_ttl(cls, analytics_type: str) -> int:
        """Retourne la TTL du cache pour un type d'analytics"""
        cache_ttls = {
            'forecasts': cls.CACHE_TTL_FORECASTS,
            'clusters': cls.CACHE_TTL_CLUSTERS,
            'anomalies': cls.CACHE_TTL_ANOMALIES,
            'optimization': cls.CACHE_TTL_OPTIMIZATION
        }
        return cache_ttls.get(analytics_type, 3600)  # 1h par défaut


# Export instance
ml_config = MLConfig()
