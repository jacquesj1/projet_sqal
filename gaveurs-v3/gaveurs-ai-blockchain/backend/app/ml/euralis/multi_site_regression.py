"""
================================================================================
Module: Régression Symbolique Multi-Sites
================================================================================
Description : Découverte de formules optimales par site et par souche
Technologie : PySR (régression symbolique)
Usage       : Prédire ITM en fonction des paramètres de gavage
================================================================================
"""

from pysr import PySRRegressor
import pandas as pd
import numpy as np
from typing import Dict, Tuple, List
import pickle
import os


class MultiSiteSymbolicRegression:
    """
    Régression symbolique pour chaque combinaison site × souche
    """

    def __init__(self):
        self.models = {}  # {(site, souche): model}
        self.results = {}  # Résultats des entraînements

    def train_by_site_and_souche(self, df: pd.DataFrame) -> Dict:
        """
        Entraîner un modèle par combinaison site-souche

        Args:
            df: DataFrame avec colonnes:
                - site_code: Code du site (LL, LS, MT)
                - Souche: Type de souche
                - duree_gavage: Durée en jours
                - total_corn_real: Maïs consommé (kg)
                - age_animaux: Âge à l'abattage
                - nb_canards_meg: Nombre de canards
                - pctg_perte_gavage: % mortalité
                - itm: Indice Technique Moyen (target)

        Returns:
            Dict des résultats par combinaison site-souche
        """
        results = {}

        for site in ['LL', 'LS', 'MT']:
            for souche in df['Souche'].unique():
                # Filtrer données
                data = df[(df['site_code'] == site) & (df['Souche'] == souche)].copy()

                if len(data) < 20:  # Minimum de données
                    print(f"⚠️  Site {site} x Souche {souche}: Pas assez de données ({len(data)})")
                    continue

                # Features
                X = data[[
                    'duree_gavage', 'total_corn_real', 'age_animaux',
                    'nb_canards_meg', 'pctg_perte_gavage'
                ]].fillna(0).values

                # Target
                y = data['itm'].fillna(0).values

                # Vérifier qu'il y a de la variance
                if y.std() < 0.1:
                    print(f"⚠️  Site {site} x Souche {souche}: Pas de variance dans ITM")
                    continue

                print(f"\n🔬 Entraînement Site {site} x Souche {souche[:20]}...")
                print(f"   Données: {len(data)} lots")
                print(f"   ITM moyen: {y.mean():.2f} ± {y.std():.2f} kg")

                # PySR
                model = PySRRegressor(
                    niterations=100,
                    binary_operators=["+", "*", "/", "-"],
                    unary_operators=["exp", "log", "sqrt"],
                    populations=20,
                    population_size=50,
                    maxsize=20,
                    model_selection="best",
                    verbosity=0,
                    random_state=42
                )

                try:
                    model.fit(X, y)

                    # Stocker
                    key = (site, souche)
                    self.models[key] = model

                    # Calculer score
                    r2 = model.score(X, y)

                    results[key] = {
                        'formule': str(model.sympy()),
                        'r2_score': r2,
                        'nb_samples': len(data),
                        'itm_moyen': float(y.mean()),
                        'itm_std': float(y.std())
                    }

                    print(f"   ✅ R² = {r2:.3f}")
                    print(f"   📐 Formule: {str(model.sympy())[:100]}...")

                except Exception as e:
                    print(f"   ❌ Erreur: {e}")
                    continue

        self.results = results
        return results

    def predict_itm(self, site: str, souche: str, features: Dict) -> float:
        """
        Prédire ITM pour une combinaison site-souche

        Args:
            site: Code site (LL, LS, MT)
            souche: Type de souche
            features: Dict avec clés:
                - duree_gavage
                - total_corn_real
                - age_animaux
                - nb_canards_meg
                - pctg_perte_gavage

        Returns:
            ITM prédit
        """
        key = (site, souche)

        if key in self.models:
            X = np.array([[
                features['duree_gavage'],
                features['total_corn_real'],
                features['age_animaux'],
                features['nb_canards_meg'],
                features['pctg_perte_gavage']
            ]])

            return float(self.models[key].predict(X)[0])
        else:
            # Fallback sur modèle général
            return self._predict_fallback(features)

    def _predict_fallback(self, features: Dict) -> float:
        """
        Prédiction de secours si pas de modèle spécifique

        Formule empirique simple basée sur les données globales
        """
        # ITM moyen historique ~15kg
        base_itm = 15.0

        # Ajustements
        duree_bonus = (features['duree_gavage'] - 10) * 0.3
        mais_bonus = (features['total_corn_real'] - 700) * 0.005
        mortalite_malus = features['pctg_perte_gavage'] * 0.5

        itm = base_itm + duree_bonus + mais_bonus - mortalite_malus

        return max(10.0, min(20.0, itm))  # Borner entre 10 et 20 kg

    def save_models(self, path: str):
        """
        Sauvegarder les modèles

        Args:
            path: Chemin du répertoire de sauvegarde
        """
        os.makedirs(path, exist_ok=True)

        for key, model in self.models.items():
            site, souche = key
            filename = f"{path}/model_{site}_{souche.replace('/', '_')}.pkl"

            with open(filename, 'wb') as f:
                pickle.dump(model, f)

            print(f"💾 Modèle sauvegardé: {filename}")

    def load_models(self, path: str):
        """
        Charger les modèles sauvegardés

        Args:
            path: Chemin du répertoire de chargement
        """
        for filename in os.listdir(path):
            if filename.endswith('.pkl'):
                filepath = os.path.join(path, filename)

                with open(filepath, 'rb') as f:
                    model = pickle.load(f)

                # Extraire site et souche du nom de fichier
                parts = filename.replace('.pkl', '').split('_')
                site = parts[1]
                souche = '_'.join(parts[2:])

                self.models[(site, souche)] = model

                print(f"📂 Modèle chargé: {site} x {souche}")

    def get_best_models(self, top_n: int = 5) -> List[Tuple]:
        """
        Obtenir les meilleurs modèles par R²

        Args:
            top_n: Nombre de modèles à retourner

        Returns:
            Liste des meilleurs modèles avec leurs scores
        """
        sorted_results = sorted(
            self.results.items(),
            key=lambda x: x[1]['r2_score'],
            reverse=True
        )

        return sorted_results[:top_n]

    def compare_sites(self) -> pd.DataFrame:
        """
        Comparer les performances des modèles par site

        Returns:
            DataFrame avec comparaison par site
        """
        site_stats = {}

        for (site, souche), result in self.results.items():
            if site not in site_stats:
                site_stats[site] = {
                    'nb_modeles': 0,
                    'r2_moyen': [],
                    'itm_moyen': []
                }

            site_stats[site]['nb_modeles'] += 1
            site_stats[site]['r2_moyen'].append(result['r2_score'])
            site_stats[site]['itm_moyen'].append(result['itm_moyen'])

        # Créer DataFrame
        comparison = []
        for site, stats in site_stats.items():
            comparison.append({
                'site': site,
                'nb_modeles': stats['nb_modeles'],
                'r2_moyen': np.mean(stats['r2_moyen']),
                'itm_moyen': np.mean(stats['itm_moyen'])
            })

        return pd.DataFrame(comparison)


# ============================================================================
# EXEMPLE D'UTILISATION
# ============================================================================

if __name__ == "__main__":
    # Créer instance
    regressor = MultiSiteSymbolicRegression()

    # Exemple de données
    data = pd.DataFrame({
        'site_code': ['LL'] * 30 + ['LS'] * 30 + ['MT'] * 30,
        'Souche': ['CF80*'] * 45 + ['MMG AS'] * 45,
        'duree_gavage': np.random.randint(8, 14, 90),
        'total_corn_real': np.random.uniform(600, 800, 90),
        'age_animaux': np.random.randint(90, 110, 90),
        'nb_canards_meg': np.random.randint(400, 600, 90),
        'pctg_perte_gavage': np.random.uniform(1, 5, 90),
        'itm': np.random.uniform(13, 17, 90)
    })

    # Entraîner
    results = regressor.train_by_site_and_souche(data)

    # Prédire
    itm_pred = regressor.predict_itm('LL', 'CF80*', {
        'duree_gavage': 10,
        'total_corn_real': 700,
        'age_animaux': 100,
        'nb_canards_meg': 500,
        'pctg_perte_gavage': 3.0
    })

    print(f"\n🎯 ITM prédit: {itm_pred:.2f} kg")
