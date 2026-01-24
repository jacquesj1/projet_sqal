"""
Clustering ML des Gaveurs - K-Means Multi-critères
Remplace les seuils ITM fixes par un vrai clustering machine learning

Author: Claude Code
Date: 2026-01-15
Version: 1.0
"""

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import silhouette_score
from typing import Dict, List, Tuple, Optional
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class GaveurClusteringML:
    """
    Clustering K-Means des gaveurs basé sur 5 critères de performance

    Critères utilisés:
    1. ITM moyen - Efficacité alimentaire (plus bas = mieux)
    2. Mortalité - Pertes moyennes (plus bas = mieux)
    3. Régularité - Écart-type ITM (plus bas = mieux)
    4. Sigma moyen - Homogénéité lots (plus bas = mieux)
    5. Production totale - Volume (plus haut = mieux)
    """

    def __init__(self, n_clusters: int = 5):
        """
        Args:
            n_clusters: Nombre de clusters (défaut: 5)
        """
        self.n_clusters = n_clusters
        self.scaler = StandardScaler()
        self.kmeans = None
        self.feature_names = [
            'itm_moyen',
            'mortalite',
            'regularite',
            'sigma_moyen',
            'production_totale_kg'
        ]
        self.cluster_labels = None
        self.silhouette = None

    def prepare_features(self, gaveurs_data: List[Dict]) -> Tuple[pd.DataFrame, np.ndarray]:
        """
        Prépare les features pour le clustering

        Args:
            gaveurs_data: Liste de dicts avec données gaveurs

        Returns:
            (DataFrame features, array gaveur_ids)
        """
        # Convertir en DataFrame
        df = pd.DataFrame(gaveurs_data)

        # Filtrer gaveurs avec données complètes
        df_clean = df.dropna(subset=self.feature_names)

        if len(df_clean) < self.n_clusters:
            raise ValueError(
                f"Pas assez de données: {len(df_clean)} gaveurs, "
                f"minimum {self.n_clusters} requis pour {self.n_clusters} clusters"
            )

        # Extraire features
        X = df_clean[self.feature_names].values
        gaveur_ids = df_clean['gaveur_id'].values

        logger.info(f"Features préparées: {len(df_clean)} gaveurs, {X.shape[1]} critères")

        return df_clean, X, gaveur_ids

    def find_optimal_clusters(
        self,
        X: np.ndarray,
        min_clusters: int = 3,
        max_clusters: int = 7
    ) -> int:
        """
        Trouve le nombre optimal de clusters via méthode du coude + silhouette

        Args:
            X: Features normalisées
            min_clusters: Nombre minimum de clusters à tester
            max_clusters: Nombre maximum de clusters à tester

        Returns:
            Nombre optimal de clusters
        """
        inertias = []
        silhouettes = []
        K_range = range(min_clusters, max_clusters + 1)

        for k in K_range:
            kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
            kmeans.fit(X)
            inertias.append(kmeans.inertia_)
            silhouettes.append(silhouette_score(X, kmeans.labels_))

        # Trouver k avec meilleur silhouette
        best_idx = np.argmax(silhouettes)
        optimal_k = K_range[best_idx]

        logger.info(f"Nombre optimal de clusters: {optimal_k} (silhouette: {silhouettes[best_idx]:.3f})")

        return optimal_k

    def fit(self, gaveurs_data: List[Dict], auto_k: bool = False) -> Dict:
        """
        Entraîne le modèle K-Means

        Args:
            gaveurs_data: Liste de dicts avec données gaveurs
            auto_k: Si True, trouve automatiquement le nombre optimal de clusters

        Returns:
            Résultats du clustering
        """
        # Préparer features
        df_clean, X, gaveur_ids = self.prepare_features(gaveurs_data)

        # Normaliser features (important pour K-Means!)
        X_scaled = self.scaler.fit_transform(X)

        # Trouver nombre optimal de clusters si demandé
        if auto_k:
            self.n_clusters = self.find_optimal_clusters(X_scaled)

        # Entraîner K-Means
        self.kmeans = KMeans(
            n_clusters=self.n_clusters,
            random_state=42,
            n_init=20,
            max_iter=300
        )

        cluster_labels = self.kmeans.fit_predict(X_scaled)

        # Calculer silhouette score (qualité clustering)
        self.silhouette = silhouette_score(X_scaled, cluster_labels)

        # Assigner labels aux gaveurs
        df_clean['cluster_ml'] = cluster_labels

        # Calculer statistiques par cluster
        cluster_stats = self._compute_cluster_stats(df_clean)

        # Ordonner clusters par performance (0 = meilleur)
        cluster_mapping = self._rank_clusters(cluster_stats)
        df_clean['cluster_ranked'] = df_clean['cluster_ml'].map(cluster_mapping)

        logger.info(
            f"Clustering terminé: {self.n_clusters} clusters, "
            f"silhouette={self.silhouette:.3f}"
        )

        return {
            'n_clusters': self.n_clusters,
            'silhouette_score': self.silhouette,
            'cluster_stats': cluster_stats,
            'cluster_mapping': cluster_mapping,
            'gaveurs': df_clean[['gaveur_id', 'cluster_ml', 'cluster_ranked']].to_dict('records')
        }

    def _compute_cluster_stats(self, df: pd.DataFrame) -> Dict:
        """
        Calcule statistiques par cluster

        Args:
            df: DataFrame avec colonnes features + cluster_ml

        Returns:
            Dict avec stats par cluster
        """
        stats = {}

        for cluster_id in range(self.n_clusters):
            cluster_data = df[df['cluster_ml'] == cluster_id]

            if len(cluster_data) == 0:
                continue

            stats[cluster_id] = {
                'size': len(cluster_data),
                'itm_moyen': float(cluster_data['itm_moyen'].mean()),
                'mortalite_moyenne': float(cluster_data['mortalite'].mean()),
                'regularite_moyenne': float(cluster_data['regularite'].mean()),
                'sigma_moyen': float(cluster_data['sigma_moyen'].mean()),
                'production_totale': float(cluster_data['production_totale_kg'].sum()),
                # Score composite pour ranking
                'performance_score': float(
                    (20.0 / cluster_data['itm_moyen'].mean()) *
                    (1.0 - cluster_data['mortalite'].mean() / 100.0)
                )
            }

        return stats

    def _rank_clusters(self, cluster_stats: Dict) -> Dict[int, int]:
        """
        Ordonne clusters par performance (0 = meilleur)

        Args:
            cluster_stats: Stats par cluster

        Returns:
            Mapping cluster_ml -> cluster_ranked
        """
        # Trier par performance_score décroissant
        sorted_clusters = sorted(
            cluster_stats.items(),
            key=lambda x: x[1]['performance_score'],
            reverse=True
        )

        # Créer mapping: cluster_ml -> rank (0 = meilleur)
        mapping = {
            cluster_id: rank
            for rank, (cluster_id, _) in enumerate(sorted_clusters)
        }

        return mapping

    def predict(self, gaveur_features: Dict) -> int:
        """
        Prédit le cluster pour un nouveau gaveur

        Args:
            gaveur_features: Dict avec features du gaveur

        Returns:
            Cluster prédit (ranked, 0 = meilleur)
        """
        if self.kmeans is None:
            raise ValueError("Modèle non entraîné. Appelez fit() d'abord.")

        # Extraire features dans le bon ordre
        X = np.array([[
            gaveur_features[fname]
            for fname in self.feature_names
        ]])

        # Normaliser
        X_scaled = self.scaler.transform(X)

        # Prédire
        cluster_ml = self.kmeans.predict(X_scaled)[0]

        # Convertir en ranked cluster
        # TODO: stocker le mapping lors du fit

        return int(cluster_ml)

    def get_cluster_label(self, cluster_ranked: int) -> str:
        """
        Retourne le label textuel d'un cluster

        Args:
            cluster_ranked: Cluster (0 = meilleur)

        Returns:
            Label textuel
        """
        if self.n_clusters == 5:
            labels = {
                0: "Excellent",
                1: "Très bon",
                2: "Bon",
                3: "À améliorer",
                4: "Critique"
            }
            return labels.get(cluster_ranked, f"Cluster {cluster_ranked}")
        else:
            # Générique pour autre nombre de clusters
            if cluster_ranked == 0:
                return "Top Performers"
            elif cluster_ranked == self.n_clusters - 1:
                return "À Former"
            else:
                return f"Niveau {cluster_ranked + 1}/{self.n_clusters}"

    def save_model(self, filepath: str):
        """
        Sauvegarde le modèle entraîné

        Args:
            filepath: Chemin fichier pickle
        """
        import pickle

        model_data = {
            'kmeans': self.kmeans,
            'scaler': self.scaler,
            'n_clusters': self.n_clusters,
            'feature_names': self.feature_names,
            'silhouette': self.silhouette,
            'trained_at': datetime.utcnow().isoformat()
        }

        with open(filepath, 'wb') as f:
            pickle.dump(model_data, f)

        logger.info(f"Modèle sauvegardé: {filepath}")

    @classmethod
    def load_model(cls, filepath: str) -> 'GaveurClusteringML':
        """
        Charge un modèle entraîné

        Args:
            filepath: Chemin fichier pickle

        Returns:
            Instance GaveurClusteringML
        """
        import pickle

        with open(filepath, 'rb') as f:
            model_data = pickle.load(f)

        instance = cls(n_clusters=model_data['n_clusters'])
        instance.kmeans = model_data['kmeans']
        instance.scaler = model_data['scaler']
        instance.feature_names = model_data['feature_names']
        instance.silhouette = model_data['silhouette']

        logger.info(
            f"Modèle chargé: {filepath}, "
            f"entraîné le {model_data['trained_at']}"
        )

        return instance


# Fonction utilitaire pour intégration rapide
def cluster_gaveurs_ml(gaveurs_data: List[Dict], n_clusters: int = 5) -> Dict:
    """
    Clustering rapide des gaveurs (wrapper)

    Args:
        gaveurs_data: Liste de dicts avec données gaveurs
        n_clusters: Nombre de clusters

    Returns:
        Résultats clustering
    """
    clusterer = GaveurClusteringML(n_clusters=n_clusters)
    return clusterer.fit(gaveurs_data)
