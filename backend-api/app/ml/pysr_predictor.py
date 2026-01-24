"""
PySR Predictor - Génération de courbes de gavage optimales

Utilise le modèle PySR v2 pré-entraîné pour prédire des courbes
de nutrition optimales basées sur les caractéristiques du lot.

Version 2.0 improvements:
- Normalisation StandardScaler (prévient overflow)
- Prédiction jour-par-jour (5 features au lieu de 4)
- Opérateurs contraints (pas exp/log)
- Équation stable: x2 + 64.66*x4 + 304.54

Auteur: Claude Sonnet 4.5
Date: 11 Janvier 2026
Sprint: 5 - PySR v2
"""

import pickle
import numpy as np
from pathlib import Path
from typing import List, Dict, Optional
import logging

logger = logging.getLogger(__name__)


class PySRPredictor:
    """
    Prédicteur utilisant le modèle PySR v2 pré-entraîné pour générer
    des courbes de gavage optimales.

    Features requises (v2.0):
        - age: Âge du canard en jours
        - weight_goal: Poids de foie cible en grammes
        - food_intake_goal: Total aliment sur période en grammes
        - diet_duration: Durée du gavage en jours
        - day: Jour de gavage (1 à diet_duration) - NOUVEAU v2
    """

    # Facteur de conversion moyen (g aliment / g foie)
    # Valeur par défaut basée sur analyse données historiques
    DEFAULT_CONVERSION_FACTOR = 19.0

    # Facteurs ajustés par race (Phase 2 - futures données)
    CONVERSION_FACTORS_BY_RACE = {
        "Mulard": 18.5,
        "Barbarie": 20.0,
        "Mixte": 19.0,
    }

    def __init__(self, model_path: Optional[str] = None, scaler_path: Optional[str] = None):
        """
        Initialise le prédicteur PySR v2

        Args:
            model_path: Chemin vers le fichier .pkl du modèle
                       Si None, utilise le chemin v2 par défaut
            scaler_path: Chemin vers le fichier .pkl du scaler
                        Si None, utilise le chemin v2 par défaut
        """
        base_dir = Path(__file__).parent.parent.parent

        if model_path is None:
            # Utiliser modèle v2 par défaut
            model_path = base_dir / "models" / "model_pysr_GavIA_v2.pkl"

        if scaler_path is None:
            # Utiliser scaler v2 par défaut
            scaler_path = base_dir / "models" / "scaler_pysr_v2.pkl"

        self.model_path = Path(model_path)
        self.scaler_path = Path(scaler_path)
        self.model = None
        self.scaler = None
        self.model_version = "v2.0"
        self.load_model()

    def load_model(self):
        """
        Charge le modèle PySR v2 et le scaler depuis les fichiers pickle

        Raises:
            FileNotFoundError: Si fichier modèle ou scaler n'existe pas
            Exception: Si erreur lors du chargement
        """
        try:
            logger.info(f"Chargement modèle PySR v2 depuis {self.model_path}")

            if not self.model_path.exists():
                raise FileNotFoundError(
                    f"Modèle PySR v2 non trouvé: {self.model_path}\n"
                    f"Assurez-vous que le fichier model_pysr_GavIA_v2.pkl "
                    f"est présent dans backend-api/models/"
                )

            if not self.scaler_path.exists():
                raise FileNotFoundError(
                    f"Scaler PySR v2 non trouvé: {self.scaler_path}\n"
                    f"Assurez-vous que le fichier scaler_pysr_v2.pkl "
                    f"est présent dans backend-api/models/"
                )

            # Charger modèle
            with open(self.model_path, 'rb') as f:
                self.model = pickle.load(f)

            # Charger scaler
            with open(self.scaler_path, 'rb') as f:
                self.scaler = pickle.load(f)

            logger.info(f"OK - Modele PySR {self.model_version} charge avec succes")
            logger.info(f"   Taille modele: {self.model_path.stat().st_size / 1024:.1f} KB")
            logger.info(f"   Taille scaler: {self.scaler_path.stat().st_size / 1024:.1f} KB")

        except FileNotFoundError:
            raise
        except Exception as e:
            logger.error(f"Erreur chargement modèle PySR v2: {type(e).__name__}: {e}")
            raise Exception(f"Impossible de charger le modèle PySR v2: {e}")

    def calculate_food_intake_goal(
        self,
        weight_goal: float,
        race: Optional[str] = None
    ) -> float:
        """
        Calcule le total d'aliment nécessaire pour atteindre l'objectif

        Args:
            weight_goal: Poids de foie cible (g)
            race: Race du canard (optionnel, pour ajustement futur)

        Returns:
            Total aliment estimé (g)
        """
        # Sélectionner facteur de conversion
        if race and race in self.CONVERSION_FACTORS_BY_RACE:
            factor = self.CONVERSION_FACTORS_BY_RACE[race]
            logger.debug(f"Facteur conversion pour {race}: {factor}")
        else:
            factor = self.DEFAULT_CONVERSION_FACTOR
            logger.debug(f"Facteur conversion par défaut: {factor}")

        food_intake = weight_goal * factor

        logger.info(
            f"Calcul food_intake_goal: {weight_goal}g × {factor} = {food_intake}g"
        )

        return food_intake

    def predict_nutrition_curve(
        self,
        age: int,
        weight_goal: float,
        food_intake_goal: float,
        diet_duration: int
    ) -> List[float]:
        """
        Prédit la courbe de nutrition optimale (v2 - jour par jour)

        Args:
            age: Âge du canard (jours), typiquement 80-95
            weight_goal: Poids foie cible (g), typiquement 350-550
            food_intake_goal: Total aliment (g), calculé ou fourni
            diet_duration: Durée gavage (jours), typiquement 11-14

        Returns:
            Liste des doses quotidiennes (g)

        Raises:
            ValueError: Si paramètres invalides
            Exception: Si modèle non chargé ou erreur prédiction
        """
        # Validation paramètres
        if age < 50 or age > 120:
            logger.warning(f"Age inhabituel: {age} jours (normal: 80-95)")

        if weight_goal < 250 or weight_goal > 700:
            logger.warning(f"Poids foie inhabituel: {weight_goal}g (normal: 350-550)")

        if diet_duration < 8 or diet_duration > 20:
            raise ValueError(
                f"Duree gavage invalide: {diet_duration} jours (autorise: 8-20)"
            )

        if self.model is None or self.scaler is None:
            raise Exception("Modele PySR v2 non charge. Appelez load_model() d'abord.")

        logger.info(
            f"Prediction courbe v2: age={age}, weight_goal={weight_goal}g, "
            f"food_intake={food_intake_goal}g, duration={diet_duration}j"
        )

        try:
            # Prédiction jour par jour (nouveau format v2)
            doses = []

            for day in range(1, diet_duration + 1):
                # Créer input avec 5 features (age, weight_goal, food_intake, duration, day)
                X = np.array([[age, weight_goal, food_intake_goal, diet_duration, day]])

                # CRITICAL: Normaliser avec scaler avant prédiction
                X_scaled = self.scaler.transform(X)

                # Prédire dose du jour
                dose = self.model.predict(X_scaled)[0]
                doses.append(round(dose, 1))

            logger.info(
                f"OK - Courbe generee: {len(doses)} doses, "
                f"total={sum(doses):.1f}g, "
                f"moyenne={np.mean(doses):.1f}g/jour"
            )

            return doses

        except Exception as e:
            logger.error(f"Erreur prediction PySR v2: {type(e).__name__}: {e}")
            raise

    def generate_courbe_theorique(
        self,
        lot_id: int,
        age_moyen: int = 90,
        poids_foie_cible: float = 400.0,
        duree_gavage: int = 14,
        race: Optional[str] = None,
        food_intake_goal: Optional[float] = None
    ) -> Dict:
        """
        Génère une courbe théorique complète pour un lot

        Args:
            lot_id: Identifiant du lot
            age_moyen: Âge moyen des canards (jours)
            poids_foie_cible: Objectif poids foie (g)
            duree_gavage: Durée du gavage (jours)
            race: Race du canard (optionnel)
            food_intake_goal: Total aliment (si None, calculé automatiquement)

        Returns:
            Dict avec:
                - courbe_theorique: List[Dict] avec jour et dose_g
                - total_aliment_g: Somme des doses
                - dose_moyenne_g: Dose quotidienne moyenne
                - parametres: Paramètres utilisés
                - metadata: Infos modèle
        """
        # Calculer food_intake_goal si non fourni
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

        # Formatter pour backend
        courbe_theorique = [
            {"jour": i + 1, "dose_g": round(dose, 1)}
            for i, dose in enumerate(doses)
        ]

        total_aliment = sum(d['dose_g'] for d in courbe_theorique)
        dose_moyenne = total_aliment / len(courbe_theorique)

        result = {
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
                'modele_path': str(self.model_path),
                'algorithme': 'PySR - Symbolic Regression'
            }
        }

        logger.info(
            f"Courbe générée pour lot {lot_id}: "
            f"{len(courbe_theorique)} jours, "
            f"total {total_aliment}g"
        )

        return result


# Instance globale singleton (chargée une seule fois)
_pysr_instance = None


def get_pysr_predictor() -> PySRPredictor:
    """
    Retourne l'instance singleton du prédicteur PySR

    Permet de réutiliser le modèle chargé sans recharger à chaque appel

    Returns:
        Instance PySRPredictor
    """
    global _pysr_instance

    if _pysr_instance is None:
        logger.info("Initialisation singleton PySRPredictor")
        _pysr_instance = PySRPredictor()

    return _pysr_instance
