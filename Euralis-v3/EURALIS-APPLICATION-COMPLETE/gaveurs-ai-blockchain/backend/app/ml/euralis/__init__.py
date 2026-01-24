"""
Modules IA/ML pour Euralis Multi-Sites
"""

from .multi_site_regression import MultiSiteSymbolicRegression
from .production_forecasting import ProductionForecaster
from .gaveur_clustering import GaveurSegmentation
from .anomaly_detection import MultiLevelAnomalyDetector
from .abattage_optimization import AbattageOptimizer

__all__ = [
    'MultiSiteSymbolicRegression',
    'ProductionForecaster',
    'GaveurSegmentation',
    'MultiLevelAnomalyDetector',
    'AbattageOptimizer'
]
