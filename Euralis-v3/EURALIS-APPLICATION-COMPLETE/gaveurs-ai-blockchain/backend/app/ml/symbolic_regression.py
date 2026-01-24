import numpy as np
import pandas as pd
from pysr import PySRRegressor
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from typing import Dict, List, Tuple, Optional
import logging
import json
from datetime import datetime
import asyncpg

logger = logging.getLogger(__name__)


class SymbolicRegressionEngine:
    """
    Moteur de régression symbolique pour découvrir les formules optimales de gavage
    Utilise PySR pour trouver des équations interprétables
    """
    
    def __init__(self, db_pool: asyncpg.Pool):
        self.db_pool = db_pool
        self.scaler = StandardScaler()
        self.models = {}
        
    async def load_training_data(
        self,
        genetique: Optional[str] = None,
        limit: int = 10000
    ) -> pd.DataFrame:
        """
        Charge les données d'entraînement depuis TimescaleDB
        
        Args:
            genetique: Filtrer par génétique spécifique
            limit: Nombre maximum d'enregistrements
            
        Returns:
            DataFrame avec toutes les features
        """
        query = """
        SELECT 
            gd.time,
            c.genetique,
            gd.dose_matin,
            gd.dose_soir,
            gd.poids_matin,
            gd.poids_soir,
            gd.temperature_stabule,
            gd.humidite_stabule,
            c.poids_initial,
            EXTRACT(EPOCH FROM (gd.time - c.created_at))/86400 as jours_gavage,
            lm.taux_humidite as humidite_mais,
            gd.canard_id
        FROM gavage_data gd
        JOIN canards c ON gd.canard_id = c.id
        JOIN lot_mais lm ON gd.lot_mais_id = lm.id
        WHERE gd.poids_matin IS NOT NULL 
          AND gd.poids_soir IS NOT NULL
        """
        
        if genetique:
            query += f" AND c.genetique = '{genetique}'"
        
        query += f" ORDER BY gd.time DESC LIMIT {limit}"
        
        async with self.db_pool.acquire() as conn:
            records = await conn.fetch(query)
            
        df = pd.DataFrame(records, columns=[
            'time', 'genetique', 'dose_matin', 'dose_soir', 
            'poids_matin', 'poids_soir', 'temperature_stabule',
            'humidite_stabule', 'poids_initial', 'jours_gavage',
            'humidite_mais', 'canard_id'
        ])
        
        logger.info(f"Données chargées: {len(df)} enregistrements")
        return df
    
    def prepare_features(self, df: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray]:
        """
        Prépare les features pour la régression symbolique
        
        Returns:
            X: Features (dose_matin, dose_soir, température, etc.)
            y: Target (poids_soir - poids_matin = gain de poids)
        """
        # Features
        X = df[[
            'dose_matin',
            'dose_soir',
            'temperature_stabule',
            'humidite_stabule',
            'jours_gavage',
            'poids_initial',
            'humidite_mais'
        ]].values
        
        # Target: Gain de poids journalier
        y = (df['poids_soir'] - df['poids_matin']).values
        
        return X, y
    
    async def discover_formula_poids(
        self,
        genetique: str,
        max_iterations: int = 50
    ) -> Dict:
        """
        Découvre la formule symbolique pour prédire le gain de poids
        
        Args:
            genetique: Type génétique (mulard, barbarie, etc.)
            max_iterations: Nombre d'itérations PySR
            
        Returns:
            Dict avec formule, score et métadonnées
        """
        logger.info(f"Découverte de formule pour génétique: {genetique}")
        
        # Charger les données
        df = await self.load_training_data(genetique=genetique)
        
        if len(df) < 100:
            raise ValueError(f"Pas assez de données pour {genetique}: {len(df)} < 100")
        
        X, y = self.prepare_features(df)
        
        # Split train/test
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )
        
        # Normalisation
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        # Configuration PySR
        model = PySRRegressor(
            niterations=max_iterations,
            binary_operators=["+", "-", "*", "/", "^"],
            unary_operators=["exp", "log", "sqrt", "abs"],
            populations=30,
            population_size=50,
            model_selection="best",
            loss="L2DistLoss()",
            maxsize=20,
            parsimony=0.01,
            feature_names=[
                "dose_matin",
                "dose_soir", 
                "temperature",
                "humidite",
                "jours_gavage",
                "poids_initial",
                "humidite_mais"
            ],
            random_state=42
        )
        
        # Entraînement
        logger.info("Démarrage PySR...")
        model.fit(X_train_scaled, y_train)
        
        # Évaluation
        score_train = model.score(X_train_scaled, y_train)
        score_test = model.score(X_test_scaled, y_test)
        
        # Meilleure équation
        best_equation = str(model.sympy())
        
        logger.info(f"Formule découverte: {best_equation}")
        logger.info(f"Score train: {score_train:.4f}, test: {score_test:.4f}")
        
        # Sauvegarder le modèle
        self.models[genetique] = {
            "model": model,
            "scaler": self.scaler,
            "equation": best_equation,
            "score_train": score_train,
            "score_test": score_test,
            "date_creation": datetime.utcnow(),
            "n_samples": len(df)
        }
        
        return {
            "genetique": genetique,
            "formule_symbolique": best_equation,
            "score_r2_train": float(score_train),
            "score_r2_test": float(score_test),
            "nombre_echantillons": len(df),
            "date_creation": datetime.utcnow().isoformat()
        }
    
    def predict_gain_poids(
        self,
        genetique: str,
        dose_matin: float,
        dose_soir: float,
        temperature: float,
        humidite: float,
        jours_gavage: int,
        poids_initial: float,
        humidite_mais: float
    ) -> float:
        """
        Prédit le gain de poids avec la formule symbolique découverte
        
        Returns:
            Gain de poids prédit (grammes)
        """
        if genetique not in self.models:
            raise ValueError(f"Modèle non entraîné pour {genetique}")
        
        model_data = self.models[genetique]
        model = model_data["model"]
        scaler = model_data["scaler"]
        
        # Préparer les features
        X = np.array([[
            dose_matin,
            dose_soir,
            temperature,
            humidite,
            jours_gavage,
            poids_initial,
            humidite_mais
        ]])
        
        X_scaled = scaler.transform(X)
        
        # Prédiction
        gain_predit = model.predict(X_scaled)[0]
        
        return float(gain_predit)
    
    async def calculate_optimal_doses(
        self,
        canard_id: int,
        genetique: str,
        poids_actuel: float,
        poids_cible: float,
        jours_restants: int,
        temperature: float,
        humidite: float,
        humidite_mais: float
    ) -> Dict:
        """
        Calcule les doses optimales pour atteindre le poids cible
        
        Returns:
            Dict avec doses recommandées et prévisions
        """
        if genetique not in self.models:
            await self.discover_formula_poids(genetique)
        
        gain_necessaire = poids_cible - poids_actuel
        gain_journalier_requis = gain_necessaire / jours_restants
        
        # Optimisation par recherche de grille simple
        best_doses = None
        best_diff = float('inf')
        
        for dose_matin in range(200, 600, 20):  # De 200g à 600g par pas de 20g
            for dose_soir in range(200, 600, 20):
                gain_predit = self.predict_gain_poids(
                    genetique=genetique,
                    dose_matin=dose_matin,
                    dose_soir=dose_soir,
                    temperature=temperature,
                    humidite=humidite,
                    jours_gavage=jours_restants,
                    poids_initial=poids_actuel,
                    humidite_mais=humidite_mais
                )
                
                diff = abs(gain_predit - gain_journalier_requis)
                
                if diff < best_diff:
                    best_diff = diff
                    best_doses = {
                        "dose_matin": dose_matin,
                        "dose_soir": dose_soir,
                        "gain_predit": gain_predit
                    }
        
        return {
            "canard_id": canard_id,
            "poids_actuel": poids_actuel,
            "poids_cible": poids_cible,
            "jours_restants": jours_restants,
            "gain_necessaire": gain_necessaire,
            "gain_journalier_requis": gain_journalier_requis,
            "dose_matin_optimale": best_doses["dose_matin"],
            "dose_soir_optimale": best_doses["dose_soir"],
            "gain_predit": best_doses["gain_predit"],
            "ecart_prediction": best_diff,
            "formule_utilisee": self.models[genetique]["equation"]
        }
    
    async def save_model_to_db(self, genetique: str):
        """Sauvegarde le modèle dans la base de données"""
        if genetique not in self.models:
            raise ValueError(f"Modèle {genetique} non trouvé")
        
        model_data = self.models[genetique]
        
        query = """
        INSERT INTO ml_models (
            genetique,
            formule_symbolique,
            score_r2,
            metadata,
            created_at
        ) VALUES ($1, $2, $3, $4, $5)
        """
        
        async with self.db_pool.acquire() as conn:
            await conn.execute(
                query,
                genetique,
                model_data["equation"],
                model_data["score_test"],
                json.dumps({
                    "n_samples": model_data["n_samples"],
                    "score_train": model_data["score_train"]
                }),
                datetime.utcnow()
            )
        
        logger.info(f"Modèle {genetique} sauvegardé dans DB")


# Instance globale
symbolic_engine: Optional[SymbolicRegressionEngine] = None


def get_symbolic_engine(db_pool: asyncpg.Pool) -> SymbolicRegressionEngine:
    """Obtenir l'instance du moteur de régression symbolique"""
    global symbolic_engine
    if symbolic_engine is None:
        symbolic_engine = SymbolicRegressionEngine(db_pool)
    return symbolic_engine
