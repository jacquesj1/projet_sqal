"""
Service de génération de courbe prédictive v2 - Algorithme Hybride

Améliore la v1 (interpolation linéaire) avec:
1. Spline cubique pour courbe lisse
2. Contraintes physiologiques vétérinaires
3. Lissage adaptatif avec courbe théorique
4. Ajustement final pour atteindre objectif précis

Contraintes métier Euralis:
- Dose max absolue: 800g
- Dose min absolue: 200g (raisonnable)
- Incrément max inter-dose: 50g/jour
- Variation max: 15% par jour (règle vétérinaire)

Auteur: Claude Sonnet 4.5
Date: 10 Janvier 2026
Sprint: 5 (amélioration Sprint 4)
"""

import numpy as np
from typing import List, Dict, Optional
from scipy.interpolate import CubicSpline
import logging

logger = logging.getLogger(__name__)


class ContraintesVeterinaires:
    """Contraintes physiologiques pour sécurité animale"""

    # Contraintes absolues
    DOSE_MIN_ABSOLUE = 200.0  # g
    DOSE_MAX_ABSOLUE = 800.0  # g

    # Contraintes dynamiques
    INCREMENT_MAX_PAR_JOUR = 50.0  # g
    VARIATION_MAX_PERCENT = 0.15  # 15%

    # Contraintes par race (optionnel)
    CONTRAINTES_PAR_RACE = {
        "Mulard": {
            "dose_max": 750.0,
            "increment_max": 45.0,
        },
        "Barbarie": {
            "dose_max": 800.0,
            "increment_max": 50.0,
        },
        "Mixte": {
            "dose_max": 800.0,
            "increment_max": 50.0,
        }
    }

    @classmethod
    def valider_dose(
        cls,
        dose: float,
        dose_precedente: Optional[float] = None,
        race: Optional[str] = None
    ) -> float:
        """
        Valide et ajuste une dose selon contraintes vétérinaires

        Args:
            dose: Dose proposée (g)
            dose_precedente: Dose du jour précédent (g)
            race: Race du canard (optionnel)

        Returns:
            Dose ajustée respectant toutes les contraintes
        """
        # Contrainte absolue min/max
        dose_max = cls.DOSE_MAX_ABSOLUE
        increment_max = cls.INCREMENT_MAX_PAR_JOUR

        # Ajuster selon race si fournie
        if race and race in cls.CONTRAINTES_PAR_RACE:
            contraintes_race = cls.CONTRAINTES_PAR_RACE[race]
            dose_max = contraintes_race["dose_max"]
            increment_max = contraintes_race["increment_max"]

        # Appliquer min/max absolu
        dose = np.clip(dose, cls.DOSE_MIN_ABSOLUE, dose_max)

        # Si dose précédente fournie, appliquer contraintes dynamiques
        if dose_precedente is not None:
            # Contrainte variation max (15%)
            max_dose_variation = dose_precedente * (1 + cls.VARIATION_MAX_PERCENT)
            min_dose_variation = dose_precedente * (1 - cls.VARIATION_MAX_PERCENT)

            dose = np.clip(dose, min_dose_variation, max_dose_variation)

            # Contrainte incrément absolu
            increment = dose - dose_precedente
            if abs(increment) > increment_max:
                increment = np.sign(increment) * increment_max
                dose = dose_precedente + increment

        return round(dose, 1)


class CourbePredictiveV2:
    """
    Générateur de courbe prédictive améliorée

    Algorithme hybride combinant:
    - Spline cubique (progression naturelle)
    - Contraintes vétérinaires (sécurité)
    - Lissage adaptatif (convergence vers théorique)
    - Ajustement final (précision objectif)
    """

    def __init__(self, race: Optional[str] = None):
        """
        Args:
            race: Race du canard pour contraintes spécifiques
        """
        self.race = race
        self.contraintes = ContraintesVeterinaires()

    def generer_courbe_predictive(
        self,
        doses_reelles: List[Dict],
        doses_theoriques: List[Dict],
        dernier_jour_reel: int,
        duree_totale: int
    ) -> List[Dict]:
        """
        Génère courbe prédictive complète avec algorithme hybride

        Args:
            doses_reelles: Doses saisies par gaveur [{jour, dose_reelle_g}, ...]
            doses_theoriques: Doses théoriques PySR [{jour, dose_theorique_g}, ...]
            dernier_jour_reel: Dernier jour avec saisie réelle
            duree_totale: Durée totale gavage (jours)

        Returns:
            Courbe prédictive [{jour, dose_g}, ...]
        """
        jours_restants = duree_totale - dernier_jour_reel

        if jours_restants <= 0:
            logger.warning("Aucun jour restant pour prédiction")
            return []

        # Récupérer dernière dose réelle et objectif final
        derniere_dose_reelle = float(doses_reelles[-1]['dose_reelle_g'])
        dose_finale_theo = float(doses_theoriques[-1]['dose_theorique_g'])

        logger.info(
            f"Génération courbe prédictive v2: "
            f"jour {dernier_jour_reel} -> {duree_totale}, "
            f"dose {derniere_dose_reelle}g -> {dose_finale_theo}g"
        )

        # Étape 1: Générer trajectoire de base (spline cubique)
        courbe_base = self._generer_spline_cubique(
            dernier_jour_reel,
            derniere_dose_reelle,
            duree_totale,
            dose_finale_theo,
            jours_restants
        )

        # Étape 2: Appliquer contraintes vétérinaires
        courbe_contrainte = self._appliquer_contraintes(
            courbe_base,
            derniere_dose_reelle
        )

        # Étape 3: Lissage adaptatif avec théorique
        courbe_lissee = self._lissage_adaptatif(
            courbe_contrainte,
            doses_theoriques,
            dernier_jour_reel
        )

        # Étape 4: Ajustement final pour atteindre exactement objectif
        courbe_finale = self._ajuster_vers_objectif(
            courbe_lissee,
            dose_finale_theo
        )

        # Formater résultat
        courbe_predictive = []
        for i, dose in enumerate(courbe_finale):
            jour = dernier_jour_reel + i + 1
            courbe_predictive.append({
                "jour": jour,
                "dose_g": round(dose, 1)
            })

        logger.info(
            f"Courbe prédictive v2 générée: {len(courbe_predictive)} jours, "
            f"moyenne {np.mean(courbe_finale):.1f}g/jour"
        )

        return courbe_predictive

    def _generer_spline_cubique(
        self,
        jour_depart: int,
        dose_depart: float,
        jour_final: int,
        dose_finale: float,
        jours_restants: int
    ) -> np.ndarray:
        """
        Génère courbe lisse avec spline cubique

        Utilise 3 points clés pour interpolation naturelle:
        - Point départ (jour actuel, dose actuelle)
        - Point intermédiaire (milieu, dose interpolée)
        - Point final (dernier jour, dose théorique finale)
        """
        # Définir points clés pour spline
        jour_milieu = jour_depart + jours_restants // 2
        dose_milieu = (dose_depart + dose_finale) / 2

        # Points de contrôle
        jours_cles = np.array([jour_depart, jour_milieu, jour_final])
        doses_cles = np.array([dose_depart, dose_milieu, dose_finale])

        # Créer spline cubique
        cs = CubicSpline(jours_cles, doses_cles)

        # Générer doses pour tous les jours restants
        jours_pred = np.arange(jour_depart + 1, jour_final + 1)
        doses_pred = cs(jours_pred)

        return doses_pred

    def _appliquer_contraintes(
        self,
        doses: np.ndarray,
        derniere_dose_reelle: float
    ) -> np.ndarray:
        """
        Applique contraintes vétérinaires jour par jour

        Garantit que chaque dose respecte:
        - Min/max absolu
        - Variation max 15%
        - Incrément max 50g
        """
        doses_contraintes = []
        dose_precedente = derniere_dose_reelle

        for dose in doses:
            dose_validee = self.contraintes.valider_dose(
                dose=dose,
                dose_precedente=dose_precedente,
                race=self.race
            )
            doses_contraintes.append(dose_validee)
            dose_precedente = dose_validee

        return np.array(doses_contraintes)

    def _lissage_adaptatif(
        self,
        doses_pred: np.ndarray,
        doses_theoriques: List[Dict],
        dernier_jour_reel: int
    ) -> np.ndarray:
        """
        Lisse courbe prédictive avec théorique

        Ratio de lissage adaptatif:
        - Écart important (>20g) : 80% prédiction / 20% théorique
        - Écart moyen (10-20g)   : 65% prédiction / 35% théorique
        - Écart faible (<10g)    : 50% prédiction / 50% théorique
        """
        doses_lissees = []

        for i, dose_pred in enumerate(doses_pred):
            jour_actuel = dernier_jour_reel + i + 1

            # Trouver dose théorique correspondante
            dose_theo = next(
                (d['dose_theorique_g'] for d in doses_theoriques if d['jour'] == jour_actuel),
                dose_pred
            )
            dose_theo = float(dose_theo)

            # Calculer écart
            ecart = abs(dose_pred - dose_theo)

            # Ratio de lissage adaptatif
            if ecart > 20:
                poids_pred = 0.80  # 80/20
            elif ecart > 10:
                poids_pred = 0.65  # 65/35
            else:
                poids_pred = 0.50  # 50/50

            dose_lissee = dose_pred * poids_pred + dose_theo * (1 - poids_pred)
            doses_lissees.append(dose_lissee)

        return np.array(doses_lissees)

    def _ajuster_vers_objectif(
        self,
        doses: np.ndarray,
        dose_finale_cible: float
    ) -> np.ndarray:
        """
        Ajuste dernière dose pour atteindre exactement objectif final

        Redistribue l'écart proportionnellement sur tous les jours
        pour éviter saut brutal final
        """
        dose_finale_actuelle = doses[-1]
        ecart_final = dose_finale_cible - dose_finale_actuelle

        # Si écart < 5g, ne rien faire
        if abs(ecart_final) < 5:
            return doses

        # Redistribuer écart proportionnellement
        nb_jours = len(doses)
        ajustements = np.linspace(0, ecart_final, nb_jours)

        doses_ajustees = doses + ajustements

        # Valider chaque dose après ajustement
        doses_finales = []
        dose_precedente = None
        for dose in doses_ajustees:
            dose_validee = self.contraintes.valider_dose(
                dose=dose,
                dose_precedente=dose_precedente,
                race=self.race
            )
            doses_finales.append(dose_validee)
            dose_precedente = dose_validee

        return np.array(doses_finales)


# Fonction utilitaire pour faciliter l'utilisation
def generer_courbe_predictive_v2(
    doses_reelles: List[Dict],
    doses_theoriques: List[Dict],
    dernier_jour_reel: int,
    duree_totale: int,
    race: Optional[str] = None
) -> List[Dict]:
    """
    Fonction wrapper pour génération courbe prédictive v2

    Args:
        doses_reelles: Doses saisies par gaveur
        doses_theoriques: Doses théoriques PySR
        dernier_jour_reel: Dernier jour avec saisie
        duree_totale: Durée totale gavage
        race: Race du canard (optionnel)

    Returns:
        Courbe prédictive [{jour, dose_g}, ...]

    Example:
        >>> courbe = generer_courbe_predictive_v2(
        ...     doses_reelles=[
        ...         {"jour": 1, "dose_reelle_g": 220},
        ...         {"jour": 2, "dose_reelle_g": 240},
        ...         {"jour": 3, "dose_reelle_g": 180},  # Écart !
        ...     ],
        ...     doses_theoriques=[...],  # 14 jours
        ...     dernier_jour_reel=3,
        ...     duree_totale=14,
        ...     race="Mulard"
        ... )
        >>> len(courbe)
        11  # Jours 4-14
    """
    generator = CourbePredictiveV2(race=race)
    return generator.generer_courbe_predictive(
        doses_reelles=doses_reelles,
        doses_theoriques=doses_theoriques,
        dernier_jour_reel=dernier_jour_reel,
        duree_totale=duree_totale
    )
