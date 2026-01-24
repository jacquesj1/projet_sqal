"""
================================================================================
Module: Clustering Gaveurs (Segmentation)
================================================================================
Description : Segmentation des gaveurs en groupes homogènes
Technologie : K-Means (Scikit-learn)
Usage       : Identifier profils de gaveurs pour pilotage ciblé
================================================================================
"""

from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
import pandas as pd
import numpy as np
from typing import Dict, List


class GaveurSegmentation:
    """
    Clustering gaveurs selon performances
    """

    def __init__(self, n_clusters: int = 5):
        self.n_clusters = n_clusters
        self.scaler = StandardScaler()
        self.kmeans = None
        self.cluster_labels = [
            'Excellent',
            'Très bon',
            'Bon',
            'À améliorer',
            'Critique'
        ]
        self.feature_names = []

    def segment_gaveurs(self, gaveurs_df: pd.DataFrame) -> pd.DataFrame:
        """
        Segmenter gaveurs en clusters

        Args:
            gaveurs_df: DataFrame avec métriques par gaveur:
                - gaveur_id: ID du gaveur
                - nom: Nom du gaveur
                - itm_moyen: ITM moyen
                - sigma_moyen: Sigma moyen
                - mortalite_moyenne: Mortalité moyenne (%)
                - nb_lots: Nombre de lots réalisés
                - regularite: Variance ITM (écart type)

        Returns:
            DataFrame avec colonne 'cluster' ajoutée
        """

        print(f"\n👥 Segmentation de {len(gaveurs_df)} gaveurs en {self.n_clusters} clusters")

        # Features pour clustering
        features = [
            'itm_moyen',
            'sigma_moyen',
            'mortalite_moyenne',
            'nb_lots',
            'regularite'
        ]

        self.feature_names = features

        # Vérifier colonnes
        missing = [f for f in features if f not in gaveurs_df.columns]
        if missing:
            raise ValueError(f"Colonnes manquantes: {missing}")

        X = gaveurs_df[features].fillna(0)

        # Normaliser
        X_scaled = self.scaler.fit_transform(X)

        # K-Means
        self.kmeans = KMeans(
            n_clusters=self.n_clusters,
            random_state=42,
            n_init=10
        )

        clusters = self.kmeans.fit_predict(X_scaled)

        # Ordonner clusters par performance (ITM moyen décroissant)
        cluster_itm = gaveurs_df.groupby(clusters)['itm_moyen'].mean()
        cluster_order = cluster_itm.sort_values(ascending=False).index

        # Mapper vers labels descriptifs
        cluster_mapping = {
            old_id: self.cluster_labels[new_id]
            for new_id, old_id in enumerate(cluster_order)
        }

        gaveurs_df['cluster'] = pd.Series(clusters).map(cluster_mapping).values
        gaveurs_df['cluster_id'] = clusters

        print(f"   ✅ Segmentation terminée")

        # Afficher distribution
        print(f"\n📊 Distribution des clusters:")
        for label in self.cluster_labels:
            count = (gaveurs_df['cluster'] == label).sum()
            if count > 0:
                print(f"   {label}: {count} gaveurs ({count/len(gaveurs_df)*100:.1f}%)")

        return gaveurs_df

    def get_cluster_profiles(self, gaveurs_df: pd.DataFrame) -> pd.DataFrame:
        """
        Profils des clusters

        Args:
            gaveurs_df: DataFrame avec colonne 'cluster'

        Returns:
            DataFrame avec profil moyen de chaque cluster
        """

        if 'cluster' not in gaveurs_df.columns:
            raise ValueError("Données non segmentées. Appelez d'abord segment_gaveurs()")

        profiles = gaveurs_df.groupby('cluster').agg({
            'itm_moyen': 'mean',
            'sigma_moyen': 'mean',
            'mortalite_moyenne': 'mean',
            'nb_lots': 'sum',
            'gaveur_id': 'count'
        }).round(2)

        profiles.columns = ['ITM', 'Sigma', 'Mortalité%', 'Total Lots', 'Nb Gaveurs']

        # Trier par ordre des labels
        profiles = profiles.reindex(self.cluster_labels, fill_value=0)

        return profiles

    def get_recommendations(self, cluster: str) -> Dict[str, List[str]]:
        """
        Obtenir recommandations par cluster

        Args:
            cluster: Nom du cluster

        Returns:
            Dict avec actions recommandées
        """

        recommendations = {
            'Excellent': {
                'actions': [
                    "Identifier et documenter les best practices",
                    "Partager expertise avec autres gaveurs",
                    "Tester nouvelles souches ou techniques",
                    "Mentorat des gaveurs à améliorer"
                ],
                'priorite': 'Maintien excellence',
                'frequence_suivi': 'Trimestriel'
            },

            'Très bon': {
                'actions': [
                    "Formation avancée pour passer à Excellent",
                    "Optimisation doses pour réduire sigma",
                    "Partage d'expérience avec pairs",
                    "Audit annuel qualité"
                ],
                'priorite': 'Progression continue',
                'frequence_suivi': 'Mensuel'
            },

            'Bon': {
                'actions': [
                    "Suivi standard des lots",
                    "Formation continue sur nouveautés",
                    "Vérification conformité plans alimentation",
                    "Support technique si besoin"
                ],
                'priorite': 'Maintien performance',
                'frequence_suivi': 'Trimestriel'
            },

            'À améliorer': {
                'actions': [
                    "Accompagnement renforcé par technicien",
                    "Formation pratique sur doses optimales",
                    "Audit détaillé des pratiques",
                    "Plan d'action personnalisé",
                    "Suivi hebdomadaire des KPIs"
                ],
                'priorite': 'Amélioration rapide',
                'frequence_suivi': 'Hebdomadaire'
            },

            'Critique': {
                'actions': [
                    "Audit URGENT des conditions de gavage",
                    "Formation intensive immédiate",
                    "Supervision quotidienne",
                    "Vérification sanitaire bâtiments",
                    "Plan d'action correctif sous 7 jours",
                    "Réduction temporaire du nombre de canards"
                ],
                'priorite': 'INTERVENTION URGENTE',
                'frequence_suivi': 'Quotidien'
            }
        }

        return recommendations.get(cluster, {})

    def predict_cluster(self, gaveur_metrics: Dict) -> str:
        """
        Prédire le cluster d'un nouveau gaveur

        Args:
            gaveur_metrics: Dict avec métriques du gaveur

        Returns:
            Nom du cluster prédit
        """

        if self.kmeans is None:
            raise ValueError("Modèle non entraîné")

        # Créer vecteur de features
        X = np.array([[
            gaveur_metrics.get('itm_moyen', 0),
            gaveur_metrics.get('sigma_moyen', 0),
            gaveur_metrics.get('mortalite_moyenne', 0),
            gaveur_metrics.get('nb_lots', 0),
            gaveur_metrics.get('regularite', 0)
        ]])

        # Normaliser
        X_scaled = self.scaler.transform(X)

        # Prédire
        cluster_id = self.kmeans.predict(X_scaled)[0]

        return self.cluster_labels[cluster_id]

    def get_cluster_centers(self) -> pd.DataFrame:
        """
        Obtenir les centres des clusters

        Returns:
            DataFrame avec coordonnées des centres
        """

        if self.kmeans is None:
            raise ValueError("Modèle non entraîné")

        centers = self.scaler.inverse_transform(self.kmeans.cluster_centers_)

        df = pd.DataFrame(centers, columns=self.feature_names)
        df['cluster'] = self.cluster_labels[:len(centers)]

        return df

    def analyze_cluster_separation(self) -> Dict:
        """
        Analyser la qualité de la séparation des clusters

        Returns:
            Métriques de qualité du clustering
        """

        if self.kmeans is None:
            raise ValueError("Modèle non entraîné")

        return {
            'inertia': self.kmeans.inertia_,
            'n_iterations': self.kmeans.n_iter_,
            'silhouette_score': 'TODO: Calculer avec données'
        }


# ============================================================================
# EXEMPLE D'UTILISATION
# ============================================================================

if __name__ == "__main__":
    # Créer instance
    segmentation = GaveurSegmentation(n_clusters=5)

    # Données de test
    gaveurs = pd.DataFrame({
        'gaveur_id': range(1, 66),
        'nom': [f'Gaveur_{i}' for i in range(1, 66)],
        'itm_moyen': np.random.uniform(12, 18, 65),
        'sigma_moyen': np.random.uniform(1.5, 3.5, 65),
        'mortalite_moyenne': np.random.uniform(1, 7, 65),
        'nb_lots': np.random.randint(3, 20, 65),
        'regularite': np.random.uniform(0.5, 2.5, 65)
    })

    # Segmenter
    gaveurs_segmented = segmentation.segment_gaveurs(gaveurs)

    # Profils
    profiles = segmentation.get_cluster_profiles(gaveurs_segmented)

    print("\n📊 Profils des clusters:")
    print(profiles)

    # Recommandations
    print("\n💡 Recommandations pour cluster 'À améliorer':")
    reco = segmentation.get_recommendations('À améliorer')
    for action in reco['actions']:
        print(f"   - {action}")
