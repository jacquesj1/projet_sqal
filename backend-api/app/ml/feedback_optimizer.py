"""
Module IA - Feedback Optimizer
Utilise les retours consommateurs pour améliorer les courbes d'alimentation gaveurs

BOUCLE DE FEEDBACK FERMÉE :
Gaveur → Production → SQAL Quality → Consommateur → Feedback → IA → Meilleure courbe → Gaveur
"""

import numpy as np
import pandas as pd
from typing import List, Dict, Any, Tuple, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass
import logging
import asyncpg

# Machine Learning
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score, mean_squared_error
import joblib

logger = logging.getLogger(__name__)


@dataclass
class FeedbackInsight:
    """Insight généré par analyse feedbacks"""
    metric_name: str
    correlation_with_satisfaction: float
    importance: float
    optimal_range: Tuple[float, float]
    current_avg: float
    recommendation: str


@dataclass
class ImprovedCurve:
    """Courbe d'alimentation améliorée basée sur feedbacks"""
    genetique: str
    original_formula: str
    improved_doses: List[float]
    expected_satisfaction_score: float
    confidence_interval: Tuple[float, float]
    key_changes: List[str]


class FeedbackOptimizer:
    """
    Optimiseur courbes d'alimentation basé sur feedback consommateur

    Principes:
    1. Analyse corrélations : Métriques production ↔ Satisfaction consommateur
    2. Identification facteurs clés : ITM, uniformité SQAL, fraîcheur, etc.
    3. Optimisation courbes : Ajuste doses pour maximiser satisfaction prédite
    4. Validation : Teste sur données holdout
    """

    def __init__(self, db_pool: asyncpg.Pool):
        self.db_pool = db_pool
        self.scaler = StandardScaler()
        self.satisfaction_model: Optional[RandomForestRegressor] = None
        self.feature_names: List[str] = []
        self.trained = False

    # ============================================================================
    # DATA LOADING
    # ============================================================================

    async def load_feedback_ml_data(
        self,
        site_code: Optional[str] = None,
        min_samples: int = 100
    ) -> pd.DataFrame:
        """
        Charge données ML depuis consumer_feedback_ml_data

        Args:
            site_code: Filtrer par site (optionnel)
            min_samples: Minimum échantillons requis

        Returns:
            DataFrame avec toutes features (enrichies avec données analyseurs SQAL)
        """
        query = """
            SELECT
                lot_id,
                lot_itm,
                lot_avg_weight,
                lot_mortality_rate,
                lot_feed_conversion,
                sqal_score,
                sqal_grade,
                -- VL53L8CH: Métriques de base
                vl53l8ch_volume_mm3,
                vl53l8ch_surface_uniformity,
                -- VL53L8CH: Métriques avancées (bins analysis)
                COALESCE(vl53l8ch_texture_score, 0.75) as vl53l8ch_texture_score,
                COALESCE(vl53l8ch_density_score, 0.75) as vl53l8ch_density_score,
                COALESCE(vl53l8ch_surface_roughness, 0.15) as vl53l8ch_surface_roughness,
                COALESCE(vl53l8ch_signal_quality, 0.85) as vl53l8ch_signal_quality,
                COALESCE(vl53l8ch_multi_peak_count, 0) as vl53l8ch_multi_peak_count,
                -- VL53L8CH: Analyse réflectance
                COALESCE(vl53l8ch_mean_reflectance_pct, 50.0) as vl53l8ch_mean_reflectance_pct,
                COALESCE(vl53l8ch_low_reflectance_fraction, 0.1) as vl53l8ch_low_reflectance_fraction,
                -- VL53L8CH: Consistance amplitude
                COALESCE(vl53l8ch_amplitude_consistency_ok, true) as vl53l8ch_amplitude_consistency_ok,
                COALESCE(vl53l8ch_defect_count, 0) as vl53l8ch_defect_count,
                -- AS7341: Indices de qualité de base
                as7341_freshness_index,
                as7341_fat_quality_index,
                as7341_oxidation_index,
                COALESCE(as7341_color_uniformity, 0.80) as as7341_color_uniformity,
                -- AS7341: Ratios spectraux avancés
                COALESCE(as7341_violet_orange_ratio, 0.5) as as7341_violet_orange_ratio,
                COALESCE(as7341_nir_violet_ratio, 1.2) as as7341_nir_violet_ratio,
                COALESCE(as7341_discoloration_index, 0.1) as as7341_discoloration_index,
                COALESCE(as7341_lipid_oxidation_index, 0.4) as as7341_lipid_oxidation_index,
                COALESCE(as7341_freshness_meat_index, 0.7) as as7341_freshness_meat_index,
                COALESCE(as7341_fat_marbling_index, 0.6) as as7341_fat_marbling_index,
                COALESCE(as7341_oil_oxidation_index, 0.3) as as7341_oil_oxidation_index,
                -- Consumer ratings
                consumer_overall_rating,
                consumer_texture_rating,
                consumer_flavor_rating,
                consumer_freshness_rating,
                consumer_would_recommend,
                site_code,
                production_date,
                consumption_delay_days
            FROM consumer_feedback_ml_data
            WHERE 1=1
        """

        params = []
        if site_code:
            query += " AND site_code = $1"
            params.append(site_code)

        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(query, *params)

        if len(rows) < min_samples:
            raise ValueError(
                f"Pas assez de données ML : {len(rows)}/{min_samples} échantillons"
            )

        # Convertir en DataFrame
        df = pd.DataFrame([dict(row) for row in rows])

        logger.info(f"✅ Données ML chargées : {len(df)} échantillons | Site: {site_code or 'all'}")
        return df

    # ============================================================================
    # FEATURE ENGINEERING
    # ============================================================================

    def prepare_features(self, df: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray, List[str]]:
        """
        Prépare features pour entraînement (version enrichie avec métriques SQAL avancées)

        Args:
            df: DataFrame avec données ML

        Returns:
            (X, y, feature_names)
            X: Features normalisées
            y: Target (consumer_overall_rating)

        Note:
            Utilise 35+ features issues des analyseurs VL53L8CH et AS7341:
            - VL53L8CH: volume, uniformité, texture, densité, rugosité, signal, réflectance
            - AS7341: freshness, fat_quality, oxidation, ratios spectraux (violet/orange, NIR/violet, etc.)
        """
        # =========================================================================
        # Features de base (production)
        # =========================================================================
        feature_cols = [
            "lot_itm",
            "lot_avg_weight",
            "lot_mortality_rate",
            "lot_feed_conversion",
            "sqal_score",
            "consumption_delay_days"
        ]

        # =========================================================================
        # Features VL53L8CH (ToF - morphologie 3D)
        # =========================================================================
        vl53l8ch_features = [
            "vl53l8ch_volume_mm3",           # Volume 3D reconstruit
            "vl53l8ch_surface_uniformity",    # Uniformité surface (σ/μ)
            "vl53l8ch_texture_score",         # Score texture [0-1]
            "vl53l8ch_density_score",         # Score densité [0-1]
            "vl53l8ch_surface_roughness",     # Rugosité surface
            "vl53l8ch_signal_quality",        # Qualité signal capteur
            "vl53l8ch_multi_peak_count",      # Nb pics multiples (anomalies)
            "vl53l8ch_mean_reflectance_pct",  # Réflectance moyenne %
            "vl53l8ch_low_reflectance_fraction",  # Fraction faible réflectance
            "vl53l8ch_defect_count",          # Nb défauts détectés
        ]
        feature_cols.extend(vl53l8ch_features)

        # =========================================================================
        # Features AS7341 (Spectral - composition)
        # =========================================================================
        as7341_features = [
            # Indices de qualité primaires
            "as7341_freshness_index",         # Indice fraîcheur [0-100]
            "as7341_fat_quality_index",       # Qualité lipidique [0-100]
            "as7341_oxidation_index",         # Niveau oxydation [0-100]
            "as7341_color_uniformity",        # Uniformité couleur [0-100]
            # Ratios spectraux avancés
            "as7341_violet_orange_ratio",     # F1(415nm) / F6(590nm)
            "as7341_nir_violet_ratio",        # F8(680nm) / F1(415nm)
            "as7341_discoloration_index",     # (F4-F2) / (F4+F2)
            "as7341_lipid_oxidation_index",   # F7(630nm) / F5(555nm)
            "as7341_freshness_meat_index",    # F3(480nm) / F6(590nm)
            "as7341_fat_marbling_index",      # NIR / F4(515nm)
            "as7341_oil_oxidation_index",     # Oxydation huile
        ]
        feature_cols.extend(as7341_features)

        # =========================================================================
        # Features engineerées (combinaisons)
        # =========================================================================
        # Production
        df["itm_per_weight"] = df["lot_itm"] / (df["lot_avg_weight"] + 1)

        # Qualité composite multi-dimensions (ToF + Spectral)
        df["quality_composite"] = (
            df["sqal_score"] * 0.3 +
            df["vl53l8ch_surface_uniformity"] * 0.15 +
            df["vl53l8ch_texture_score"] * 0.15 +
            df["as7341_freshness_index"] * 0.2 +
            df["as7341_fat_quality_index"] * 0.2
        )

        # Décroissance fraîcheur avec délai consommation
        df["freshness_decay"] = df["as7341_freshness_index"] * (1 / (df["consumption_delay_days"] + 1))

        # Score morphologique ToF combiné
        df["tof_morpho_score"] = (
            df["vl53l8ch_texture_score"] * 0.35 +
            df["vl53l8ch_density_score"] * 0.35 +
            df["vl53l8ch_surface_uniformity"] * 0.30
        ) * (1 - df["vl53l8ch_defect_count"] * 0.1)  # Pénalité défauts

        # Score spectral combiné
        df["spectral_quality_score"] = (
            df["as7341_freshness_index"] * 0.35 +
            df["as7341_fat_quality_index"] * 0.30 +
            df["as7341_color_uniformity"] * 0.20 +
            (1 - df["as7341_oxidation_index"].clip(0, 1)) * 0.15  # Pénalité oxydation
        )

        # Indicateur de risque oxydation (combine plusieurs signaux)
        df["oxidation_risk_score"] = (
            df["as7341_oxidation_index"] * 0.4 +
            df["as7341_lipid_oxidation_index"] * 0.3 +
            df["as7341_oil_oxidation_index"] * 0.3
        )

        # Ratio qualité globale (ToF / Spectral balance)
        df["tof_spectral_ratio"] = (
            df["tof_morpho_score"] / (df["spectral_quality_score"] + 0.01)
        ).clip(0.5, 2.0)  # Limite les valeurs extrêmes

        # Interaction volume × fraîcheur (gros foies frais = premium)
        df["volume_freshness_interaction"] = (
            (df["vl53l8ch_volume_mm3"] / 60000) *  # Normalisation volume
            df["as7341_freshness_index"]
        )

        engineered_features = [
            "itm_per_weight",
            "quality_composite",
            "freshness_decay",
            "tof_morpho_score",
            "spectral_quality_score",
            "oxidation_risk_score",
            "tof_spectral_ratio",
            "volume_freshness_interaction"
        ]
        feature_cols.extend(engineered_features)

        # =========================================================================
        # Gestion valeurs manquantes + Boolean conversion
        # =========================================================================
        # Convertir booléen en int si présent
        if "vl53l8ch_amplitude_consistency_ok" in df.columns:
            df["vl53l8ch_amplitude_consistency_ok"] = df["vl53l8ch_amplitude_consistency_ok"].astype(int)

        # Remplacer NaN par médiane
        df[feature_cols] = df[feature_cols].fillna(df[feature_cols].median())

        # =========================================================================
        # Extraction X, y
        # =========================================================================
        X = df[feature_cols].values
        y = df["consumer_overall_rating"].values

        logger.info(
            f"Features préparées : {len(feature_cols)} features | {len(X)} échantillons\n"
            f"   - Production: 6 | VL53L8CH: {len(vl53l8ch_features)} | "
            f"AS7341: {len(as7341_features)} | Engineered: {len(engineered_features)}"
        )
        return X, y, feature_cols

    # ============================================================================
    # MODEL TRAINING
    # ============================================================================

    async def train_satisfaction_predictor(
        self,
        site_code: Optional[str] = None,
        test_size: float = 0.2
    ) -> Dict[str, float]:
        """
        Entraîne modèle de prédiction satisfaction consommateur

        Args:
            site_code: Filtrer par site (optionnel)
            test_size: Proportion données test

        Returns:
            Métriques (MAE, RMSE, R²)
        """
        try:
            # Charger données
            df = await self.load_feedback_ml_data(site_code=site_code, min_samples=100)

            # Préparer features
            X, y, feature_names = self.prepare_features(df)
            self.feature_names = feature_names

            # Split train/test
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=test_size, random_state=42
            )

            # Normalisation
            X_train_scaled = self.scaler.fit_transform(X_train)
            X_test_scaled = self.scaler.transform(X_test)

            # Entraînement Random Forest
            self.satisfaction_model = RandomForestRegressor(
                n_estimators=200,
                max_depth=10,
                min_samples_split=5,
                min_samples_leaf=2,
                random_state=42,
                n_jobs=-1
            )

            self.satisfaction_model.fit(X_train_scaled, y_train)

            # Prédictions
            y_pred_train = self.satisfaction_model.predict(X_train_scaled)
            y_pred_test = self.satisfaction_model.predict(X_test_scaled)

            # Métriques
            metrics = {
                "train_mae": mean_absolute_error(y_train, y_pred_train),
                "test_mae": mean_absolute_error(y_test, y_pred_test),
                "train_rmse": np.sqrt(mean_squared_error(y_train, y_pred_train)),
                "test_rmse": np.sqrt(mean_squared_error(y_test, y_pred_test)),
                "train_r2": r2_score(y_train, y_pred_train),
                "test_r2": r2_score(y_test, y_pred_test),
                "samples_total": len(X),
                "samples_train": len(X_train),
                "samples_test": len(X_test)
            }

            self.trained = True

            logger.info(
                f"✅ Modèle entraîné | "
                f"Test MAE: {metrics['test_mae']:.3f} | "
                f"Test R²: {metrics['test_r2']:.3f} | "
                f"Samples: {metrics['samples_total']}"
            )

            return metrics

        except Exception as e:
            logger.error(f"❌ Erreur entraînement modèle: {e}", exc_info=True)
            raise

    # ============================================================================
    # CORRELATION ANALYSIS
    # ============================================================================

    def analyze_correlations(self, df: pd.DataFrame) -> List[FeedbackInsight]:
        """
        Analyse corrélations entre métriques production/SQAL et satisfaction consommateur

        Args:
            df: DataFrame avec données ML (incluant métriques avancées analyseurs)

        Returns:
            Liste de FeedbackInsight triée par importance
        """
        insights = []

        # Métriques à analyser (enrichies avec données analyseurs SQAL)
        metrics = {
            # Production
            "lot_itm": ("ITM moyen", 25.0, 32.0),
            "lot_avg_weight": ("Poids moyen final", 5500.0, 6500.0),
            "lot_feed_conversion": ("Indice consommation", 2.8, 3.5),
            "consumption_delay_days": ("Délai consommation", 3, 10),

            # Score global SQAL
            "sqal_score": ("Score qualité SQAL", 0.85, 0.95),

            # VL53L8CH ToF - Métriques morphologiques
            "vl53l8ch_volume_mm3": ("Volume 3D (mm³)", 45000.0, 65000.0),
            "vl53l8ch_surface_uniformity": ("Uniformité surface ToF", 0.80, 0.95),
            "vl53l8ch_texture_score": ("Score texture ToF", 0.75, 0.95),
            "vl53l8ch_density_score": ("Score densité ToF", 0.75, 0.95),
            "vl53l8ch_surface_roughness": ("Rugosité surface", 0.05, 0.20),
            "vl53l8ch_signal_quality": ("Qualité signal ToF", 0.80, 0.95),
            "vl53l8ch_mean_reflectance_pct": ("Réflectance moyenne %", 40.0, 70.0),
            "vl53l8ch_defect_count": ("Nb défauts détectés", 0, 2),

            # AS7341 Spectral - Indices de qualité
            "as7341_freshness_index": ("Indice fraîcheur spectral", 0.75, 0.95),
            "as7341_fat_quality_index": ("Qualité lipides spectral", 0.75, 0.95),
            "as7341_oxidation_index": ("Indice oxydation", 0.05, 0.25),
            "as7341_color_uniformity": ("Uniformité couleur", 0.75, 0.95),

            # AS7341 Spectral - Ratios avancés
            "as7341_violet_orange_ratio": ("Ratio Violet/Orange", 0.4, 0.7),
            "as7341_nir_violet_ratio": ("Ratio NIR/Violet", 0.8, 1.5),
            "as7341_discoloration_index": ("Indice décoloration", 0.0, 0.2),
            "as7341_lipid_oxidation_index": ("Indice oxydation lipide", 0.3, 0.5),
            "as7341_freshness_meat_index": ("Indice fraîcheur viande", 0.6, 0.9),
            "as7341_fat_marbling_index": ("Indice persillé graisse", 0.5, 0.8),
        }

        target = df["consumer_overall_rating"]

        for metric_col, (name, optimal_min, optimal_max) in metrics.items():
            if metric_col not in df.columns or df[metric_col].isna().all():
                continue

            # Corrélation Pearson
            corr = df[metric_col].corr(target)

            # Feature importance (si modèle entraîné)
            importance = 0.0
            if self.trained and metric_col in self.feature_names:
                idx = self.feature_names.index(metric_col)
                importance = self.satisfaction_model.feature_importances_[idx]

            # Range optimal (basé sur quartiles top satisfaction)
            top_quartile = df[df["consumer_overall_rating"] >= 4]
            if len(top_quartile) > 0:
                optimal_min_data = top_quartile[metric_col].quantile(0.25)
                optimal_max_data = top_quartile[metric_col].quantile(0.75)
            else:
                optimal_min_data = optimal_min
                optimal_max_data = optimal_max

            # Moyenne actuelle
            current_avg = df[metric_col].mean()

            # Recommandation
            if corr > 0.3:  # Corrélation positive forte
                if current_avg < optimal_min_data:
                    recommendation = f"Augmenter {name} de {optimal_min_data - current_avg:.1f} (cible: {optimal_min_data:.1f})"
                elif current_avg > optimal_max_data:
                    recommendation = f"Réduire {name} de {current_avg - optimal_max_data:.1f} (cible: {optimal_max_data:.1f})"
                else:
                    recommendation = f"{name} dans la plage optimale"
            elif corr < -0.3:  # Corrélation négative forte
                if current_avg > optimal_min_data:
                    recommendation = f"Réduire {name} pour améliorer satisfaction"
                else:
                    recommendation = f"{name} déjà optimal"
            else:
                recommendation = f"{name} a peu d'impact sur satisfaction (corr: {corr:.2f})"

            insights.append(FeedbackInsight(
                metric_name=name,
                correlation_with_satisfaction=corr,
                importance=importance,
                optimal_range=(optimal_min_data, optimal_max_data),
                current_avg=current_avg,
                recommendation=recommendation
            ))

        # Trier par importance décroissante
        insights.sort(key=lambda x: abs(x.correlation_with_satisfaction), reverse=True)

        logger.info(f"✅ Analyse corrélations terminée : {len(insights)} insights générés")
        return insights

    # ============================================================================
    # CURVE OPTIMIZATION
    # ============================================================================

    async def optimize_feeding_curve(
        self,
        genetique: str,
        target_satisfaction: float = 4.5,
        current_itm: float = 28.0
    ) -> ImprovedCurve:
        """
        Optimise courbe d'alimentation pour maximiser satisfaction consommateur

        Args:
            genetique: Type génétique canard
            target_satisfaction: Satisfaction cible (1-5)
            current_itm: ITM actuel moyen

        Returns:
            ImprovedCurve avec doses optimisées
        """
        if not self.trained:
            raise ValueError("Modèle non entraîné. Appelez train_satisfaction_predictor() d'abord.")

        try:
            # Charger courbe actuelle (depuis DB symbolic_regression_formulas)
            async with self.db_pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    SELECT formula, avg_score
                    FROM symbolic_regression_formulas
                    WHERE genetique = $1
                    ORDER BY discovered_at DESC
                    LIMIT 1
                    """,
                    genetique
                )

            if not row:
                raise ValueError(f"Aucune formule trouvée pour {genetique}")

            original_formula = row["formula"]

            # Simuler différentes doses pour trouver optimum
            best_doses = None
            best_predicted_satisfaction = 0.0
            best_itm = current_itm

            # Grid search sur ITM (±15% de current_itm)
            itm_range = np.linspace(current_itm * 0.85, current_itm * 1.15, 20)

            for itm in itm_range:
                # Prédire satisfaction avec ce ITM
                # Features alignées avec prepare_features() - 35 features
                features = np.array([[
                    # Production (6)
                    itm,                        # lot_itm
                    5800.0,                     # lot_avg_weight (estimé)
                    2.0,                        # lot_mortality_rate
                    3.2,                        # lot_feed_conversion
                    0.88,                       # sqal_score (estimé)
                    5,                          # consumption_delay_days

                    # VL53L8CH ToF (10)
                    52000.0,                    # vl53l8ch_volume_mm3
                    0.87,                       # vl53l8ch_surface_uniformity
                    0.82,                       # vl53l8ch_texture_score
                    0.80,                       # vl53l8ch_density_score
                    0.12,                       # vl53l8ch_surface_roughness
                    0.88,                       # vl53l8ch_signal_quality
                    1,                          # vl53l8ch_multi_peak_count
                    55.0,                       # vl53l8ch_mean_reflectance_pct
                    0.08,                       # vl53l8ch_low_reflectance_fraction
                    0,                          # vl53l8ch_defect_count

                    # AS7341 Spectral (11)
                    0.85,                       # as7341_freshness_index
                    0.82,                       # as7341_fat_quality_index
                    0.15,                       # as7341_oxidation_index
                    0.80,                       # as7341_color_uniformity
                    0.55,                       # as7341_violet_orange_ratio
                    1.1,                        # as7341_nir_violet_ratio
                    0.08,                       # as7341_discoloration_index
                    0.42,                       # as7341_lipid_oxidation_index
                    0.72,                       # as7341_freshness_meat_index
                    0.65,                       # as7341_fat_marbling_index
                    0.28,                       # as7341_oil_oxidation_index

                    # Engineered features (8)
                    itm / 5800.0,               # itm_per_weight
                    0.85,                       # quality_composite
                    0.85 * (1/6),               # freshness_decay
                    0.78,                       # tof_morpho_score
                    0.82,                       # spectral_quality_score
                    0.25,                       # oxidation_risk_score
                    0.95,                       # tof_spectral_ratio
                    (52000/60000) * 0.85        # volume_freshness_interaction
                ]])

                features_scaled = self.scaler.transform(features)
                predicted_satisfaction = self.satisfaction_model.predict(features_scaled)[0]

                if predicted_satisfaction > best_predicted_satisfaction:
                    best_predicted_satisfaction = predicted_satisfaction
                    best_itm = itm

            # Calculer doses optimisées (simplifié : augmente/diminue proportionnellement)
            itm_ratio = best_itm / current_itm
            # TODO: Appeler symbolic_regression pour recalculer doses exactes
            # Pour l'instant, approximation
            improved_doses = [350 * itm_ratio] * 14  # 14 jours de gavage

            # Intervalle de confiance (basé sur erreur modèle)
            std_error = 0.3  # À calculer depuis métriques test
            confidence_interval = (
                max(1.0, best_predicted_satisfaction - 1.96 * std_error),
                min(5.0, best_predicted_satisfaction + 1.96 * std_error)
            )

            # Changements clés
            key_changes = []
            if abs(itm_ratio - 1.0) > 0.05:
                change_pct = (itm_ratio - 1.0) * 100
                if change_pct > 0:
                    key_changes.append(f"Augmenter ITM de {change_pct:.1f}% (de {current_itm:.1f} à {best_itm:.1f})")
                else:
                    key_changes.append(f"Réduire ITM de {abs(change_pct):.1f}% (de {current_itm:.1f} à {best_itm:.1f})")

            key_changes.append(f"Satisfaction prédite: {best_predicted_satisfaction:.2f}/5 (cible: {target_satisfaction:.2f})")

            result = ImprovedCurve(
                genetique=genetique,
                original_formula=original_formula,
                improved_doses=improved_doses,
                expected_satisfaction_score=best_predicted_satisfaction,
                confidence_interval=confidence_interval,
                key_changes=key_changes
            )

            logger.info(
                f"✅ Courbe optimisée pour {genetique} | "
                f"ITM: {current_itm:.1f} → {best_itm:.1f} | "
                f"Satisfaction prédite: {best_predicted_satisfaction:.2f}/5"
            )

            return result

        except Exception as e:
            logger.error(f"❌ Erreur optimisation courbe: {e}", exc_info=True)
            raise

    # ============================================================================
    # PERSISTENCE
    # ============================================================================

    def save_model(self, filepath: str):
        """Sauvegarde modèle entraîné"""
        if not self.trained:
            raise ValueError("Modèle non entraîné")

        joblib.dump({
            "model": self.satisfaction_model,
            "scaler": self.scaler,
            "feature_names": self.feature_names
        }, filepath)

        logger.info(f"✅ Modèle sauvegardé : {filepath}")

    def load_model(self, filepath: str):
        """Charge modèle pré-entraîné"""
        data = joblib.load(filepath)

        self.satisfaction_model = data["model"]
        self.scaler = data["scaler"]
        self.feature_names = data["feature_names"]
        self.trained = True

        logger.info(f"✅ Modèle chargé : {filepath}")


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

async def get_feedback_optimizer(db_pool: asyncpg.Pool) -> FeedbackOptimizer:
    """Factory function pour obtenir instance FeedbackOptimizer"""
    optimizer = FeedbackOptimizer(db_pool)
    return optimizer
