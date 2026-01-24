"""
PySR Predictor v2 - Pure NumPy Implementation
Sans dépendance Julia - Équation extraite du modèle PySR v2

Équation découverte par PySR:
    dose = x2 + 64.66*x4 + 304.54
    où x2 = food_intake normalisé, x4 = day normalisé

Auteur: Claude Sonnet 4.5
Date: 11 Janvier 2026
"""

import pickle
import numpy as np
from pathlib import Path
from typing import List, Dict, Optional
import logging

logger = logging.getLogger(__name__)


class PySRPredictorNumPy:
    """
    Prédicteur PySR v2 utilisant équation NumPy pure

    AVANTAGES:
    - Pas besoin de Julia
    - Compatible Windows/Linux (pas de pickle WindowsPath)
    - Ultra-rapide (pas d'overhead PySR)
    - Image Docker légère

    ÉQUATION: dose = x2 + 64.66*x4 + 304.54
    """

    # Facteur de conversion moyen (g aliment / g foie)
    DEFAULT_CONVERSION_FACTOR = 19.0

    CONVERSION_FACTORS_BY_RACE = {
        "Mulard": 18.5,
        "Barbarie": 20.0,
        "Mixte": 19.0,
    }

    # Coefficients de l'équation PySR découverte
    EQUATION_COEF_X2 = 1.0       # food_intake normalisé
    EQUATION_COEF_X4 = 64.66     # day normalisé
    EQUATION_INTERCEPT = 304.54

    def __init__(self, scaler_path: Optional[str] = None):
        """
        Initialise le prédicteur NumPy

        Args:
            scaler_path: Chemin vers scaler (si None, utilise défaut)
        """
        base_dir = Path(__file__).parent.parent.parent

        if scaler_path is None:
            scaler_path = base_dir / "models" / "scaler_pysr_v2.pkl"

        self.scaler_path = Path(scaler_path)
        self.scaler = None
        self.model_version = "v2.0-numpy"
        self.load_scaler()

    def load_scaler(self):
        """Charge le scaler StandardScaler"""
        try:
            logger.info(f"Chargement scaler depuis {self.scaler_path}")

            if not self.scaler_path.exists():
                raise FileNotFoundError(
                    f"Scaler non trouvé: {self.scaler_path}\n"
                    f"Assurez-vous que scaler_pysr_v2.pkl existe"
                )

            with open(self.scaler_path, 'rb') as f:
                self.scaler = pickle.load(f)

            logger.info(f"OK - Scaler charge (version {self.model_version})")

        except Exception as e:
            logger.error(f"Erreur chargement scaler: {e}")
            raise Exception(f"Impossible de charger le scaler: {e}")

    def predict_dose_for_day(
        self,
        age: int,
        weight_goal: float,
        food_intake_goal: float,
        diet_duration: int,
        day: int
    ) -> float:
        """
        Prédit dose pour un jour spécifique

        Équation: dose = x2 + 64.66*x4 + 304.54
        """
        # Créer input
        X = np.array([[age, weight_goal, food_intake_goal, diet_duration, day]])

        # Normaliser
        X_scaled = self.scaler.transform(X)

        # Appliquer équation PySR
        # Indices: 0=age, 1=weight_goal, 2=food_intake, 3=duration, 4=day
        x2 = X_scaled[0][2]  # food_intake normalisé
        x4 = X_scaled[0][4]  # day normalisé

        dose = (self.EQUATION_COEF_X2 * x2) + \
               (self.EQUATION_COEF_X4 * x4) + \
               self.EQUATION_INTERCEPT

        return dose

    def calculate_food_intake_goal(
        self,
        weight_goal: float,
        race: Optional[str] = None
    ) -> float:
        """Calcule total aliment nécessaire"""
        if race and race in self.CONVERSION_FACTORS_BY_RACE:
            factor = self.CONVERSION_FACTORS_BY_RACE[race]
        else:
            factor = self.DEFAULT_CONVERSION_FACTOR

        return weight_goal * factor

    def predict_nutrition_curve(
        self,
        age: int,
        weight_goal: float,
        food_intake_goal: float,
        diet_duration: int
    ) -> List[float]:
        """
        Prédit courbe de nutrition complète

        Args:
            age: Âge canard (jours)
            weight_goal: Poids foie cible (g)
            food_intake_goal: Total aliment (g)
            diet_duration: Durée gavage (jours)

        Returns:
            Liste doses quotidiennes
        """
        # Validation
        if age < 50 or age > 120:
            logger.warning(f"Age inhabituel: {age}j")

        if weight_goal < 250 or weight_goal > 700:
            logger.warning(f"Poids inhabituel: {weight_goal}g")

        if diet_duration < 8 or diet_duration > 20:
            raise ValueError(f"Duree invalide: {diet_duration}j")

        if self.scaler is None:
            raise Exception("Scaler non charge")

        logger.info(
            f"Prediction NumPy v2: age={age}, weight={weight_goal}g, "
            f"food={food_intake_goal}g, duration={diet_duration}j"
        )

        # Prédire jour par jour
        doses = []
        for day in range(1, diet_duration + 1):
            dose = self.predict_dose_for_day(
                age, weight_goal, food_intake_goal, diet_duration, day
            )
            doses.append(round(dose, 1))

        logger.info(
            f"OK - Courbe generee: {len(doses)} doses, "
            f"total={sum(doses):.1f}g, moyenne={np.mean(doses):.1f}g/j"
        )

        return doses

    def generate_courbe_theorique(
        self,
        lot_id: int,
        age_moyen: int = 90,
        poids_foie_cible: float = 400.0,
        duree_gavage: int = 14,
        race: Optional[str] = None,
        food_intake_goal: Optional[float] = None
    ) -> Dict:
        """Génère courbe théorique complète pour un lot"""

        # Calculer food_intake si non fourni
        if food_intake_goal is None:
            food_intake_goal = self.calculate_food_intake_goal(
                weight_goal=poids_foie_cible,
                race=race
            )

        # Prédire courbe
        doses = self.predict_nutrition_curve(
            age=age_moyen,
            weight_goal=poids_foie_cible,
            food_intake_goal=food_intake_goal,
            diet_duration=duree_gavage
        )

        # Formatter résultat
        courbe_theorique = [
            {"jour": i + 1, "dose_g": dose}
            for i, dose in enumerate(doses)
        ]

        total_aliment = sum(d['dose_g'] for d in courbe_theorique)
        dose_moyenne = total_aliment / len(courbe_theorique)

        return {
            'lot_id': lot_id,
            'courbe_theorique': courbe_theorique,
            'total_aliment_g': round(total_aliment, 1),
            'dose_moyenne_g': round(dose_moyenne, 1),
            'parametres': {
                'age_moyen': age_moyen,
                'poids_foie_cible': poids_foie_cible,
                'duree_gavage': duree_gavage,
                'race': race,
                'food_intake_goal': round(food_intake_goal, 1),
                'facteur_conversion': (
                    self.CONVERSION_FACTORS_BY_RACE.get(race, self.DEFAULT_CONVERSION_FACTOR)
                    if race else self.DEFAULT_CONVERSION_FACTOR
                )
            },
            'metadata': {
                'modele_version': self.model_version,
                'algorithme': 'PySR v2 - Pure NumPy (sans Julia)',
                'equation': 'dose = x2 + 64.66*x4 + 304.54'
            }
        }


# Instance singleton
_numpy_instance = None


def get_pysr_predictor_numpy() -> PySRPredictorNumPy:
    """Retourne instance singleton"""
    global _numpy_instance

    if _numpy_instance is None:
        logger.info("Initialisation PySRPredictorNumPy")
        _numpy_instance = PySRPredictorNumPy()

    return _numpy_instance
