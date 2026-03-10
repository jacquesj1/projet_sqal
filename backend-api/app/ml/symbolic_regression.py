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
import os
import asyncio
import re

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


def _estimate_equation_complexity(equation: str) -> int:
    if not equation:
        return 0
    # Heuristique simple: compter opérateurs +, -, *, /, ^
    return len(re.findall(r"[\+\-\*/\^]", equation))


def train_pysr_model(
    *,
    lot_id: int | None = None,
    genetique: str | None = None,
    include_sqal_features: bool = False,
    premium_grades: list[str] | None = None,
    require_sqal_premium: bool = True,
    site_codes: list[str] | None = None,
    min_duree_gavage: int | None = None,
    max_duree_gavage: int | None = None,
    seasons: list[str] | None = None,
    cluster_ids: list[int] | None = None,
    foie_min_g: float | None = None,
    foie_max_g: float | None = None,
    foie_target_g: float | None = None,
    foie_weight_range: float | None = None,
    foie_weight_target: float | None = None,
) -> Dict:
    """Entraîne un modèle PySR et renvoie un résumé.

    Cette fonction est appelée par les tâches Celery (`ml_tasks.py`) et sert de
    wrapper synchrone autour du moteur `SymbolicRegressionEngine`.

    Note: pour le moment, seul `genetique` est utilisé pour filtrer le dataset
    du module (tables gavage_data/canards). Les autres paramètres sont conservés
    pour compatibilité API et pourront être utilisés dans une implémentation
    Euralis dédiée.
    """

    if not genetique:
        raise ValueError("genetique is required for PySR training")

    async def _run() -> Dict:
        db_url = os.getenv(
            "DATABASE_URL",
            "postgresql://gaveurs_admin:gaveurs_secure_2024@timescaledb:5432/gaveurs_db",
        )

        pool = await asyncpg.create_pool(db_url)
        try:
            async with pool.acquire() as conn:
                # Dataset Euralis robuste: reconstruire les features depuis gavage_data_lots.
                # Cela évite de dépendre de colonnes NULL/non alimentées dans lots_gavage (ex: total_corn_real_g).

                # Introspection schéma: certaines instances n'ont pas exactement les mêmes colonnes dans lots_gavage.
                # On construit donc les expressions SQL uniquement à partir des colonnes présentes.
                lot_cols_rows = await conn.fetch(
                    """
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'lots_gavage'
                    """
                )
                lot_cols = {str(r["column_name"]) for r in lot_cols_rows}

                nb_candidates = [
                    "nb_canards_meg",
                    "nb_canards_initial",
                    "nb_canards_accroches",
                    "nb_accroches",
                    "nb_meg",
                ]
                nb_existing = [c for c in nb_candidates if c in lot_cols]
                if nb_existing:
                    nb_expr = "COALESCE(" + ", ".join([f"lg.{c}" for c in nb_existing] + ["800"]) + ")::int"
                else:
                    nb_expr = "800::int"

                pct_candidates = [
                    "pctg_perte_gavage",
                    "taux_mortalite",
                ]
                pct_existing = [c for c in pct_candidates if c in lot_cols]
                if pct_existing:
                    pct_expr = (
                        "COALESCE(" + ", ".join([f"lg.{c}" for c in pct_existing] + ["0.0"]) + ")::float"
                    )
                else:
                    pct_expr = "0.0::float"

                acc_candidates = [
                    "nb_canards_accroches",
                    "nb_accroches",
                ]
                acc_existing = [c for c in acc_candidates if c in lot_cols]
                if acc_existing:
                    acc_expr = "COALESCE(" + ", ".join([f"lg.{c}" for c in acc_existing] + ["NULL"]) + ")::int"
                else:
                    acc_expr = "NULL::int"

                denom_expr = f"COALESCE(NULLIF({acc_expr}, 0), NULLIF({nb_expr}, 0))"

                foie_candidates = [
                    "poids_foie_moyen_g",
                ]
                foie_existing = [c for c in foie_candidates if c in lot_cols]
                if foie_existing:
                    foie_expr = f"lg.{foie_existing[0]}::float"
                else:
                    foie_expr = "NULL::float"

                # Source des doses: certaines bases n'ont pas (encore) de données dans gavage_data_lots.
                # Si la table est absente ou vide, on fallback sur les colonnes de lots_gavage.
                gdl_exists = await conn.fetchval(
                    """
                    SELECT EXISTS(
                        SELECT 1
                        FROM information_schema.tables
                        WHERE table_schema = 'public'
                          AND table_name = 'gavage_data_lots'
                    )
                    """
                )
                gdl_has_rows = False
                if gdl_exists:
                    gdl_has_rows = bool(
                        await conn.fetchval("SELECT EXISTS (SELECT 1 FROM gavage_data_lots LIMIT 1)")
                    )

                # Fallback possible si gavage_data_lots est vide: doses_journalieres (hypertable)
                doses_exists = await conn.fetchval(
                    """
                    SELECT EXISTS(
                        SELECT 1
                        FROM information_schema.tables
                        WHERE table_schema = 'public'
                          AND table_name = 'doses_journalieres'
                    )
                    """
                )
                doses_has_rows = False
                if doses_exists:
                    doses_has_rows = bool(
                        await conn.fetchval("SELECT EXISTS (SELECT 1 FROM doses_journalieres LIMIT 1)")
                    )

                sensor_exists = await conn.fetchval(
                    """
                    SELECT EXISTS(
                        SELECT 1
                        FROM information_schema.tables
                        WHERE table_schema = 'public'
                          AND table_name = 'sensor_samples'
                    )
                    """
                )
                sensor_has_rows = False
                if sensor_exists:
                    sensor_has_rows = bool(
                        await conn.fetchval("SELECT EXISTS (SELECT 1 FROM sensor_samples LIMIT 1)")
                    )

                duree_candidates = ["duree_gavage_reelle", "duree_gavage_prevue"]
                duree_existing = [c for c in duree_candidates if c in lot_cols]
                if duree_existing:
                    duree_expr = "COALESCE(" + ", ".join([f"lg.{c}" for c in duree_existing] + ["NULL"]) + ")"
                else:
                    duree_expr = "NULL"

                total_candidates = ["total_corn_real", "total_corn_real_g"]
                total_existing = [c for c in total_candidates if c in lot_cols]
                if "total_corn_real" in total_existing and "total_corn_real_g" in total_existing:
                    total_expr = "COALESCE(lg.total_corn_real, (lg.total_corn_real_g / 1000.0))"
                elif "total_corn_real" in total_existing:
                    total_expr = "lg.total_corn_real"
                elif "total_corn_real_g" in total_existing:
                    total_expr = "(lg.total_corn_real_g / 1000.0)"
                else:
                    total_expr = "NULL"

                age_candidates = ["age_animaux"]
                age_existing = [c for c in age_candidates if c in lot_cols]
                if age_existing:
                    age_expr = "lg.age_animaux::int"
                else:
                    # Fallback grossier: si pas d'âge, réutiliser la durée de gavage.
                    age_expr = f"COALESCE({duree_expr}, 14)::int"

                genetique_value = str(genetique).strip().lower()
                params: list[object] = [genetique_value]
                where: list[str] = [
                    "TRIM(LOWER(COALESCE(lg.genetique, lg.souche))) = $1",
                ]

                if site_codes:
                    params.append([str(x).strip().upper() for x in site_codes if str(x).strip()])
                    where.append(f"lg.site_code = ANY(${len(params)}::varchar[])")

                duree_filter_expr = (
                    "COALESCE(lg.duree_gavage_reelle, d.duree_gavage_calc)"
                    if gdl_has_rows
                    else "COALESCE(lg.duree_gavage_reelle, dj.duree_gavage_calc)"
                    if doses_has_rows
                    else f"COALESCE({duree_expr}, 0)"
                )
                if min_duree_gavage is not None:
                    params.append(int(min_duree_gavage))
                    where.append(f"{duree_filter_expr} >= ${len(params)}")

                if max_duree_gavage is not None:
                    params.append(int(max_duree_gavage))
                    where.append(f"{duree_filter_expr} <= ${len(params)}")

                if gdl_has_rows:
                    foie_expr_final = (
                        f"COALESCE({foie_expr}, fs.foie_moyen_g)" if sensor_has_rows else foie_expr
                    )
                    total_corn_expr = f"COALESCE(gt.total_corn_real, {total_expr})"
                    itm_expr = f"({foie_expr_final} / NULLIF({total_corn_expr}, 0))"

                    sqal_join = ""
                    sqal_select = ""
                    if include_sqal_features and sensor_has_rows:
                        sqal_join = "LEFT JOIN sqal_agg sa ON sa.lot_id = lg.id"
                        sqal_select = (
                            ",\n"
                            "                        COALESCE(sa.poids_foie_moyen_g, 0.0) AS sqal_poids_foie_moyen_g,\n"
                            "                        COALESCE(sa.fusion_final_score_avg, 0.0) AS sqal_fusion_score_avg,\n"
                            "                        COALESCE(sa.reject_rate, 0.0) AS sqal_reject_rate,\n"
                            "                        COALESCE(sa.vl_quality_score_avg, 0.0) AS sqal_vl_quality_score_avg,\n"
                            "                        COALESCE(sa.as_quality_score_avg, 0.0) AS sqal_as_quality_score_avg,\n"
                            "                        COALESCE(sa.vl_surface_uniformity_avg, 0.0) AS sqal_vl_surface_uniformity_avg,\n"
                            "                        COALESCE(sa.vl_defect_count_avg, 0.0) AS sqal_vl_defect_count_avg,\n"
                            "                        COALESCE(sa.grade_last_score, 0) AS sqal_grade_last_score\n"
                        )
                    query = f"""
                    WITH lot_duree AS (
                        SELECT lot_gavage_id, MAX(jour_gavage) AS duree_gavage_calc
                        FROM gavage_data_lots
                        GROUP BY lot_gavage_id
                    ),
                    gdl_last AS (
                        SELECT DISTINCT ON (gdl.lot_gavage_id, gdl.jour_gavage, LOWER(gdl.repas))
                            gdl.lot_gavage_id,
                            gdl.jour_gavage,
                            LOWER(gdl.repas) AS repas,
                            gdl.dose_moyenne,
                            gdl.time
                        FROM gavage_data_lots gdl
                        WHERE gdl.dose_moyenne IS NOT NULL
                        ORDER BY gdl.lot_gavage_id, gdl.jour_gavage, LOWER(gdl.repas), gdl.time DESC
                    ),
                    gdl_pivot AS (
                        SELECT
                            lot_gavage_id,
                            jour_gavage,
                            MAX(dose_moyenne) FILTER (WHERE repas = 'matin') AS dose_matin,
                            MAX(dose_moyenne) FILTER (WHERE repas = 'soir') AS dose_soir
                        FROM gdl_last
                        GROUP BY lot_gavage_id, jour_gavage
                    ),
                    gdl_total AS (
                        SELECT
                            lot_gavage_id,
                            SUM(COALESCE(dose_matin, 0) + COALESCE(dose_soir, 0)) AS total_corn_real
                        FROM gdl_pivot
                        GROUP BY lot_gavage_id
                    ),
                    foie_sqal AS (
                        SELECT
                            ss.lot_id,
                            AVG(ss.poids_foie_estime_g)::float AS foie_moyen_g
                        FROM sensor_samples ss
                        WHERE {"TRUE" if sensor_has_rows else "FALSE"}
                          AND ss.lot_id IS NOT NULL
                          AND ss.poids_foie_estime_g IS NOT NULL
                        GROUP BY ss.lot_id
                    ),
                    sqal_agg AS (
                        SELECT
                            ss.lot_id,
                            AVG(ss.poids_foie_estime_g)::float AS poids_foie_moyen_g,
                            AVG(ss.fusion_final_score)::float AS fusion_final_score_avg,
                            AVG(CASE WHEN ss.fusion_final_grade = 'REJECT' THEN 1.0 ELSE 0.0 END)::float AS reject_rate,
                            AVG(ss.vl53l8ch_quality_score)::float AS vl_quality_score_avg,
                            AVG(ss.as7341_quality_score)::float AS as_quality_score_avg,
                            AVG(ss.vl53l8ch_surface_uniformity)::float AS vl_surface_uniformity_avg,
                            AVG(ss.vl53l8ch_defect_count)::float AS vl_defect_count_avg,
                            (
                                SELECT
                                    CASE
                                        WHEN s2.fusion_final_grade IN ('A+', 'A') THEN 3
                                        WHEN s2.fusion_final_grade = 'B' THEN 2
                                        WHEN s2.fusion_final_grade IN ('C', 'REJECT') THEN 1
                                        ELSE 0
                                    END
                                FROM sensor_samples s2
                                WHERE s2.lot_id = ss.lot_id
                                ORDER BY s2.timestamp DESC
                                LIMIT 1
                            )::int AS grade_last_score
                        FROM sensor_samples ss
                        WHERE {"TRUE" if (include_sqal_features and sensor_has_rows) else "FALSE"}
                          AND ss.lot_id IS NOT NULL
                        GROUP BY ss.lot_id
                    ),
                    lots_ctx AS (
                        SELECT
                            lg.id AS lot_id,
                            COALESCE(
                                pa.date_abattage_reelle,
                                pa.date_abattage_prevue,
                                (lg.debut_lot + COALESCE(lg.duree_gavage_reelle, d.duree_gavage_calc))
                            ) AS date_abattage
                        FROM lots_gavage lg
                        LEFT JOIN lot_duree d ON d.lot_gavage_id = lg.id
                        LEFT JOIN planning_abattages pa ON pa.lot_id = lg.id
                    )
                    SELECT
                        {itm_expr} AS itm,
                        COALESCE(lg.duree_gavage_reelle, d.duree_gavage_calc, {duree_expr}) AS duree_gavage,
                        {total_corn_expr} AS total_corn_real,
                        COALESCE(
                            lg.age_animaux::int,
                            (lc.date_abattage::date - lg.debut_lot::date)::int,
                            COALESCE(lg.duree_gavage_reelle, d.duree_gavage_calc, {duree_expr})::int
                        ) AS age_animaux,
                        {nb_expr} AS nb_canards_meg,
                        {pct_expr} AS pctg_perte_gavage
                        {sqal_select}
                    FROM lots_gavage lg
                    LEFT JOIN lot_duree d ON d.lot_gavage_id = lg.id
                    LEFT JOIN gdl_total gt ON gt.lot_gavage_id = lg.id
                    LEFT JOIN foie_sqal fs ON fs.lot_id = lg.id
                    {sqal_join}
                    LEFT JOIN lots_ctx lc ON lc.lot_id = lg.id
                    WHERE {' AND '.join(where)}
                    ORDER BY lg.debut_lot DESC
                    LIMIT 10000
                    """
                elif doses_has_rows:
                    foie_expr_final = (
                        f"COALESCE({foie_expr}, fs.foie_moyen_g)" if sensor_has_rows else foie_expr
                    )
                    total_corn_expr = "dj.total_corn_real_g"
                    itm_expr = f"({foie_expr_final} / NULLIF({total_corn_expr}, 0))"
                    sqal_join = ""
                    sqal_select = ""
                    if include_sqal_features and sensor_has_rows:
                        sqal_join = "LEFT JOIN sqal_agg sa ON sa.lot_id = lg.id"
                        sqal_select = (
                            ",\n"
                            "                        COALESCE(sa.poids_foie_moyen_g, 0.0) AS sqal_poids_foie_moyen_g,\n"
                            "                        COALESCE(sa.fusion_final_score_avg, 0.0) AS sqal_fusion_score_avg,\n"
                            "                        COALESCE(sa.reject_rate, 0.0) AS sqal_reject_rate,\n"
                            "                        COALESCE(sa.vl_quality_score_avg, 0.0) AS sqal_vl_quality_score_avg,\n"
                            "                        COALESCE(sa.as_quality_score_avg, 0.0) AS sqal_as_quality_score_avg,\n"
                            "                        COALESCE(sa.vl_surface_uniformity_avg, 0.0) AS sqal_vl_surface_uniformity_avg,\n"
                            "                        COALESCE(sa.vl_defect_count_avg, 0.0) AS sqal_vl_defect_count_avg,\n"
                            "                        COALESCE(sa.grade_last_score, 0) AS sqal_grade_last_score\n"
                        )
                    query = f"""
                    WITH lot_doses AS (
                        SELECT
                            lot_id,
                            MAX(jour_gavage) AS duree_gavage_calc,
                            SUM(COALESCE(feed_real, dose_reelle, 0)) AS total_corn_real_g
                        FROM doses_journalieres
                        GROUP BY lot_id
                    ),
                    foie_sqal AS (
                        SELECT
                            ss.lot_id,
                            AVG(ss.poids_foie_estime_g)::float AS foie_moyen_g
                        FROM sensor_samples ss
                        WHERE {"TRUE" if sensor_has_rows else "FALSE"}
                          AND ss.lot_id IS NOT NULL
                          AND ss.poids_foie_estime_g IS NOT NULL
                        GROUP BY ss.lot_id
                    ),
                    sqal_agg AS (
                        SELECT
                            ss.lot_id,
                            AVG(ss.poids_foie_estime_g)::float AS poids_foie_moyen_g,
                            AVG(ss.fusion_final_score)::float AS fusion_final_score_avg,
                            AVG(CASE WHEN ss.fusion_final_grade = 'REJECT' THEN 1.0 ELSE 0.0 END)::float AS reject_rate,
                            AVG(ss.vl53l8ch_quality_score)::float AS vl_quality_score_avg,
                            AVG(ss.as7341_quality_score)::float AS as_quality_score_avg,
                            AVG(ss.vl53l8ch_surface_uniformity)::float AS vl_surface_uniformity_avg,
                            AVG(ss.vl53l8ch_defect_count)::float AS vl_defect_count_avg,
                            (
                                SELECT
                                    CASE
                                        WHEN s2.fusion_final_grade IN ('A+', 'A') THEN 3
                                        WHEN s2.fusion_final_grade = 'B' THEN 2
                                        WHEN s2.fusion_final_grade IN ('C', 'REJECT') THEN 1
                                        ELSE 0
                                    END
                                FROM sensor_samples s2
                                WHERE s2.lot_id = ss.lot_id
                                ORDER BY s2.timestamp DESC
                                LIMIT 1
                            )::int AS grade_last_score
                        FROM sensor_samples ss
                        WHERE {"TRUE" if (include_sqal_features and sensor_has_rows) else "FALSE"}
                          AND ss.lot_id IS NOT NULL
                        GROUP BY ss.lot_id
                    )
                    SELECT
                        {itm_expr} AS itm,
                        COALESCE(lg.duree_gavage_reelle, dj.duree_gavage_calc) AS duree_gavage,
                        {total_corn_expr} AS total_corn_real,
                        {age_expr} AS age_animaux,
                        {nb_expr} AS nb_canards_meg,
                        {pct_expr} AS pctg_perte_gavage
                        {sqal_select}
                    FROM lots_gavage lg
                    JOIN lot_doses dj ON dj.lot_id = lg.id
                    LEFT JOIN foie_sqal fs ON fs.lot_id = lg.id
                    {sqal_join}
                    WHERE {' AND '.join(where)}
                    ORDER BY lg.debut_lot DESC
                    LIMIT 10000
                    """
                else:
                    total_corn_expr = f"({total_expr} / NULLIF({denom_expr}, 0))"
                    itm_expr = f"({foie_expr} / NULLIF({total_corn_expr}, 0))"

                    sqal_join = ""
                    sqal_select = ""
                    if include_sqal_features and sensor_has_rows:
                        sqal_join = "LEFT JOIN sqal_agg sa ON sa.lot_id = lg.id"
                        sqal_select = (
                            ",\n"
                            "                        COALESCE(sa.poids_foie_moyen_g, 0.0) AS sqal_poids_foie_moyen_g,\n"
                            "                        COALESCE(sa.fusion_final_score_avg, 0.0) AS sqal_fusion_score_avg,\n"
                            "                        COALESCE(sa.reject_rate, 0.0) AS sqal_reject_rate,\n"
                            "                        COALESCE(sa.vl_quality_score_avg, 0.0) AS sqal_vl_quality_score_avg,\n"
                            "                        COALESCE(sa.as_quality_score_avg, 0.0) AS sqal_as_quality_score_avg,\n"
                            "                        COALESCE(sa.vl_surface_uniformity_avg, 0.0) AS sqal_vl_surface_uniformity_avg,\n"
                            "                        COALESCE(sa.vl_defect_count_avg, 0.0) AS sqal_vl_defect_count_avg,\n"
                            "                        COALESCE(sa.grade_last_score, 0) AS sqal_grade_last_score\n"
                        )
                    query = f"""
                    WITH sqal_agg AS (
                        SELECT
                            ss.lot_id,
                            AVG(ss.poids_foie_estime_g)::float AS poids_foie_moyen_g,
                            AVG(ss.fusion_final_score)::float AS fusion_final_score_avg,
                            AVG(CASE WHEN ss.fusion_final_grade = 'REJECT' THEN 1.0 ELSE 0.0 END)::float AS reject_rate,
                            AVG(ss.vl53l8ch_quality_score)::float AS vl_quality_score_avg,
                            AVG(ss.as7341_quality_score)::float AS as_quality_score_avg,
                            AVG(ss.vl53l8ch_surface_uniformity)::float AS vl_surface_uniformity_avg,
                            AVG(ss.vl53l8ch_defect_count)::float AS vl_defect_count_avg,
                            (
                                SELECT
                                    CASE
                                        WHEN s2.fusion_final_grade IN ('A+', 'A') THEN 3
                                        WHEN s2.fusion_final_grade = 'B' THEN 2
                                        WHEN s2.fusion_final_grade IN ('C', 'REJECT') THEN 1
                                        ELSE 0
                                    END
                                FROM sensor_samples s2
                                WHERE s2.lot_id = ss.lot_id
                                ORDER BY s2.timestamp DESC
                                LIMIT 1
                            )::int AS grade_last_score
                        FROM sensor_samples ss
                        WHERE {"TRUE" if (include_sqal_features and sensor_has_rows) else "FALSE"}
                          AND ss.lot_id IS NOT NULL
                        GROUP BY ss.lot_id
                    )
                    SELECT
                        {itm_expr} AS itm,
                        {duree_expr} AS duree_gavage,
                        {total_corn_expr} AS total_corn_real,
                        {age_expr} AS age_animaux,
                        {nb_expr} AS nb_canards_meg,
                        {pct_expr} AS pctg_perte_gavage
                        {sqal_select}
                    FROM lots_gavage lg
                    {sqal_join}
                    WHERE {' AND '.join(where)}
                    ORDER BY lg.debut_lot DESC
                    LIMIT 10000
                    """

                rows = await conn.fetch(query, *params)

                if not rows:
                    # Diagnostic: lister les génétiques disponibles avec les mêmes filtres (hors filtre genetique)
                    diag_where: list[str] = [
                    ]

                    diag_params: list[object] = []

                    if site_codes:
                        diag_params.append([str(x).strip().upper() for x in site_codes if str(x).strip()])
                        diag_where.append(f"lg.site_code = ANY(${len(diag_params)}::varchar[])")

                    diag_duree_filter_expr = (
                        "COALESCE(lg.duree_gavage_reelle, d.duree_gavage_calc)"
                        if gdl_has_rows
                        else "COALESCE(lg.duree_gavage_reelle, dj.duree_gavage_calc)"
                        if doses_has_rows
                        else f"COALESCE({duree_expr}, 0)"
                    )

                    if min_duree_gavage is not None:
                        diag_params.append(int(min_duree_gavage))
                        diag_where.append(
                            f"{diag_duree_filter_expr} >= ${len(diag_params)}"
                        )

                    if max_duree_gavage is not None:
                        diag_params.append(int(max_duree_gavage))
                        diag_where.append(
                            f"{diag_duree_filter_expr} <= ${len(diag_params)}"
                        )

                    diag_where_sql = " AND ".join(diag_where) if diag_where else "TRUE"

                    if gdl_has_rows:
                        diag_query = f"""
                        WITH lot_duree AS (
                            SELECT lot_gavage_id, MAX(jour_gavage) AS duree_gavage_calc
                            FROM gavage_data_lots
                            GROUP BY lot_gavage_id
                        )
                        SELECT
                            TRIM(LOWER(COALESCE(lg.genetique, lg.souche))) AS genetique,
                            COUNT(*)::int AS n_lots
                        FROM lots_gavage lg
                        JOIN lot_duree d ON d.lot_gavage_id = lg.id
                        WHERE {diag_where_sql}
                          AND TRIM(COALESCE(lg.genetique, lg.souche)) <> ''
                        GROUP BY TRIM(LOWER(COALESCE(lg.genetique, lg.souche)))
                        ORDER BY n_lots DESC
                        LIMIT 20
                        """
                    elif doses_has_rows:
                        diag_query = f"""
                        WITH lot_doses AS (
                            SELECT
                                lot_id,
                                MAX(jour_gavage) AS duree_gavage_calc
                            FROM doses_journalieres
                            GROUP BY lot_id
                        )
                        SELECT
                            TRIM(LOWER(COALESCE(lg.genetique, lg.souche))) AS genetique,
                            COUNT(*)::int AS n_lots
                        FROM lots_gavage lg
                        JOIN lot_doses dj ON dj.lot_id = lg.id
                        WHERE {diag_where_sql}
                          AND TRIM(COALESCE(lg.genetique, lg.souche)) <> ''
                        GROUP BY TRIM(LOWER(COALESCE(lg.genetique, lg.souche)))
                        ORDER BY n_lots DESC
                        LIMIT 20
                        """
                    else:
                        diag_query = f"""
                        SELECT
                            TRIM(LOWER(COALESCE(lg.genetique, lg.souche))) AS genetique,
                            COUNT(*)::int AS n_lots
                        FROM lots_gavage lg
                        WHERE {diag_where_sql}
                          AND TRIM(COALESCE(lg.genetique, lg.souche)) <> ''
                        GROUP BY TRIM(LOWER(COALESCE(lg.genetique, lg.souche)))
                        ORDER BY n_lots DESC
                        LIMIT 20
                        """
                    diag_rows = await conn.fetch(diag_query, *diag_params)
                    diag_list = [f"{r['genetique']}({r['n_lots']})" for r in diag_rows]
                    raise ValueError(
                        "Pas assez de données (0 ligne) pour entraîner PySR. "
                        f"genetique={genetique_value}. "
                        f"genetiques_disponibles(top20)={', '.join(diag_list) if diag_list else '—'}"
                    )

        finally:
            await pool.close()

        if not rows:
            raise ValueError("Pas assez de données (0 ligne) pour entraîner PySR")

        df = pd.DataFrame([dict(r) for r in rows])

        # Colonnes attendues dans le SELECT ci-dessus.
        feature_cols = [
            "duree_gavage",
            "total_corn_real",
            "age_animaux",
            "nb_canards_meg",
            "pctg_perte_gavage",
        ]

        if include_sqal_features:
            feature_cols.extend(
                [
                    "sqal_poids_foie_moyen_g",
                    "sqal_fusion_score_avg",
                    "sqal_reject_rate",
                    "sqal_vl_quality_score_avg",
                    "sqal_as_quality_score_avg",
                    "sqal_vl_surface_uniformity_avg",
                    "sqal_vl_defect_count_avg",
                    "sqal_grade_last_score",
                ]
            )

        df = df.dropna(subset=["itm"]).copy()
        for c in feature_cols:
            df[c] = pd.to_numeric(df[c], errors="coerce")
        target_rows_required = 50
        try:
            absolute_min_rows_required = int(os.getenv("PYSR_ABSOLUTE_MIN_ROWS", "10"))
        except Exception:
            absolute_min_rows_required = 10
        if absolute_min_rows_required < 2:
            absolute_min_rows_required = 2

        feature_non_null_counts = {c: int(df[c].notna().sum()) for c in feature_cols}

        # Sélection robuste: on retire itérativement les features les plus manquantes
        # pour maximiser le nombre de lignes complètes.
        selected_feature_cols = list(feature_cols)
        dropped_features: list[str] = []
        df_complete = df.dropna(subset=selected_feature_cols) if selected_feature_cols else df

        prev_len_complete = len(df_complete)
        while len(selected_feature_cols) > 2 and len(df_complete) < target_rows_required:
            # On drop la feature avec le plus petit nombre de valeurs non-nulles
            counts = {c: int(df[c].notna().sum()) for c in selected_feature_cols}
            worst_feature = min(counts, key=counts.get)
            selected_feature_cols.remove(worst_feature)
            dropped_features.append(worst_feature)
            df_complete = df.dropna(subset=selected_feature_cols)

            # Si supprimer une feature n'augmente pas le nombre de lignes complètes,
            # ça ne sert à rien de continuer (on finirait par tout dropper jusqu'à 2 features).
            if len(df_complete) <= prev_len_complete:
                break
            prev_len_complete = len(df_complete)

        if dropped_features:
            logger.warning(
                "Features supprimées (trop de valeurs manquantes) pour PySR: %s (non-null counts=%s)",
                dropped_features,
                feature_non_null_counts,
            )

        feature_cols = selected_feature_cols
        df = df_complete

        logger.info(
            "PySR dataset selection: n_rows=%s, features=%s, non_null_counts=%s",
            len(df),
            feature_cols,
            feature_non_null_counts,
        )

        if len(feature_cols) < 2:
            raise ValueError(
                "Pas assez de features disponibles dans lots_gavage après filtrage des valeurs manquantes. "
                f"features={feature_cols}, non_null_counts={feature_non_null_counts}"
            )

        if len(df) < absolute_min_rows_required:
            raise ValueError(
                "Pas assez de données après nettoyage pour entraîner PySR "
                f"(n={len(df)} < {absolute_min_rows_required}). "
                f"features={feature_cols}, non_null_counts={feature_non_null_counts}"
            )

        if len(df) < target_rows_required:
            logger.warning(
                "Dataset limité pour PySR (n=%s < %s). Entraînement quand même avec features=%s",
                len(df),
                target_rows_required,
                feature_cols,
            )

        # Option C: winsorisation (p5–p95) sur la cible itm pour robustesse aux outliers.
        # On le fait après sélection/cleaning pour capper sur la distribution réellement utilisée.
        winsorization = {
            "enabled": True,
            "p_low": 0.05,
            "p_high": 0.95,
            "lower": None,
            "upper": None,
            "n_clipped_low": 0,
            "n_clipped_high": 0,
        }
        try:
            itm_series = pd.to_numeric(df["itm"], errors="coerce")
            itm_series = itm_series.replace([np.inf, -np.inf], np.nan).dropna()

            # Besoin d'un minimum de points pour des quantiles stables.
            if len(itm_series) >= 20:
                lower = float(itm_series.quantile(winsorization["p_low"]))
                upper = float(itm_series.quantile(winsorization["p_high"]))

                if np.isfinite(lower) and np.isfinite(upper) and upper > lower:
                    winsorization["lower"] = lower
                    winsorization["upper"] = upper

                    n_low = int((df["itm"] < lower).sum())
                    n_high = int((df["itm"] > upper).sum())
                    winsorization["n_clipped_low"] = n_low
                    winsorization["n_clipped_high"] = n_high

                    if n_low or n_high:
                        logger.warning(
                            "Winsorisation itm (p5-p95): lower=%s upper=%s clipped_low=%s clipped_high=%s",
                            lower,
                            upper,
                            n_low,
                            n_high,
                        )
                    df["itm"] = df["itm"].clip(lower=lower, upper=upper)
        except Exception:
            # On ne bloque jamais l'entraînement sur cette étape.
            winsorization["enabled"] = False

        X = df[feature_cols].values
        y = df["itm"].astype(float).values

        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        X_train, X_test, y_train, y_test = train_test_split(
            X_scaled, y, test_size=0.2, random_state=42
        )

        model = PySRRegressor(
            niterations=50,
            binary_operators=["+", "-", "*", "/"],
            unary_operators=["square", "cube"],
            model_selection="best",
            maxsize=20,
            parsimony=0.01,
            random_state=42,
        )

        logger.info("Démarrage PySR (ITM) ...")
        model.fit(X_train, y_train)

        r2_test = float(model.score(X_test, y_test))
        formula = str(model.sympy())
        complexity = _estimate_equation_complexity(formula)

        return {
            "status": "success",
            "lot_id": lot_id,
            "genetique": str(genetique).strip().lower(),
            "formula": formula,
            "r2_score": r2_test,
            "variables": feature_cols,
            "complexity": int(complexity),
            "include_sqal_features": include_sqal_features,
            "winsorization": winsorization,
            "premium_grades": premium_grades,
            "require_sqal_premium": require_sqal_premium,
            "site_codes": site_codes,
            "min_duree_gavage": min_duree_gavage,
            "max_duree_gavage": max_duree_gavage,
            "seasons": seasons,
            "cluster_ids": cluster_ids,
            "foie_objective": {
                "foie_min_g": foie_min_g,
                "foie_max_g": foie_max_g,
                "foie_target_g": foie_target_g,
                "foie_weight_range": foie_weight_range,
                "foie_weight_target": foie_weight_target,
            },
        }

    return asyncio.run(_run())
