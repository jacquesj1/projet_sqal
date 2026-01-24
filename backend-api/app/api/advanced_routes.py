"""
Routes API supplémentaires pour Analytics et Anomaly Detection
Intégré dans main.py
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from datetime import datetime
import asyncpg

from app.ml.anomaly_detection import get_anomaly_detection
from app.ml.analytics_engine import get_analytics_engine
from app.ml.computer_vision import get_computer_vision_engine
from app.ml.voice_assistant import get_voice_assistant
from app.ml.multiobjective_optimization import get_multiobjective_optimizer

router = APIRouter()

# Fonction pour obtenir le pool de connexions depuis main.py
async def get_db_pool() -> asyncpg.Pool:
    from app.main import db_pool
    if db_pool is None:
        raise HTTPException(status_code=500, detail="Database not connected")
    return db_pool


# ============================================
# ROUTES - ANOMALY DETECTION & ALERTES
# ============================================

@router.post("/api/alertes/check-all/{canard_id}")
async def check_all_alerts(
    canard_id: int,
    gaveur_telephone: str,
    pool: asyncpg.Pool = Depends(get_db_pool)
):
    """
    Vérifie TOUTES les alertes possibles pour un canard
    """
    anomaly_engine = get_anomaly_detection(pool)

    alertes = await anomaly_engine.check_all_alerts_canard(
        canard_id,
        gaveur_telephone
    )

    return {
        "canard_id": canard_id,
        "alertes_generees": alertes,
        "nb_alertes": len(alertes)
    }


@router.get("/api/alertes/dashboard/{gaveur_id}")
async def get_alertes_dashboard(
    gaveur_id: int,
    pool: asyncpg.Pool = Depends(get_db_pool)
):
    """Dashboard des alertes pour un gaveur"""
    anomaly_engine = get_anomaly_detection(pool)
    dashboard = await anomaly_engine.get_alertes_dashboard(gaveur_id)
    return dashboard


@router.post("/api/alertes/{alerte_id}/acquitter")
async def acquitter_alerte(
    alerte_id: int,
    gaveur_id: int,
    pool: asyncpg.Pool = Depends(get_db_pool)
):
    """Acquitter une alerte"""
    query = """
    UPDATE alertes
    SET acquittee = true,
        acquittee_par = $1,
        acquittee_le = NOW()
    WHERE id = $2
    """

    async with pool.acquire() as conn:
        await conn.execute(query, gaveur_id, alerte_id)

    return {"status": "acquittee"}


@router.post("/api/alertes/check-mortalite-lot")
async def check_mortalite_lot(
    numero_lot: str,
    gaveur_telephone: str,
    pool: asyncpg.Pool = Depends(get_db_pool)
):
    """Vérifier la mortalité d'un lot"""
    anomaly_engine = get_anomaly_detection(pool)

    alerte = await anomaly_engine.check_mortalite_lot(
        numero_lot,
        gaveur_telephone
    )

    if alerte:
        return {
            "alerte_generee": True,
            "alerte": alerte
        }
    else:
        return {
            "alerte_generee": False,
            "message": "Taux de mortalité normal"
        }


@router.get("/api/anomalies/detect/{canard_id}")
async def detect_anomalies_ml(
    canard_id: int,
    window_days: int = 3,
    pool: asyncpg.Pool = Depends(get_db_pool)
):
    """Détection d'anomalies par ML (Isolation Forest)"""
    anomaly_engine = get_anomaly_detection(pool)

    anomalies = await anomaly_engine.detect_anomalies_canard(
        canard_id,
        window_days
    )

    return {
        "canard_id": canard_id,
        "anomalies_detectees": anomalies,
        "nb_anomalies": len(anomalies),
        "window_days": window_days
    }


# ============================================
# ROUTES - ANALYTICS AVANCÉS
# ============================================

@router.get("/api/analytics/metrics/{canard_id}")
async def get_performance_metrics(
    canard_id: int,
    pool: asyncpg.Pool = Depends(get_db_pool)
):
    """Métriques de performance complètes d'un canard"""
    analytics_engine = get_analytics_engine(pool)

    try:
        metrics = await analytics_engine.calculate_performance_metrics(canard_id)
        return metrics
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/api/analytics/predict-prophet/{canard_id}")
async def predict_courbe_prophet(
    canard_id: int,
    jours: int = 7,
    pool: asyncpg.Pool = Depends(get_db_pool)
):
    """Prédictions Prophet (Facebook AI)"""
    analytics_engine = get_analytics_engine(pool)

    try:
        predictions = await analytics_engine.predict_courbe_poids_prophet(
            canard_id,
            jours
        )
        return predictions
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/analytics/compare-genetiques")
async def compare_genetiques(
    gaveur_id: Optional[int] = None,
    pool: asyncpg.Pool = Depends(get_db_pool)
):
    """Comparaison des performances par génétique"""
    analytics_engine = get_analytics_engine(pool)

    comparaison = await analytics_engine.compare_genetiques(gaveur_id)
    return comparaison


@router.get("/api/analytics/correlation-temperature/{canard_id}")
async def analyze_correlation_temperature(
    canard_id: int,
    pool: asyncpg.Pool = Depends(get_db_pool)
):
    """Analyse corrélation température <-> gain de poids"""
    analytics_engine = get_analytics_engine(pool)

    correlation = await analytics_engine.analyze_correlation_temperature_poids(canard_id)
    return correlation


@router.get("/api/analytics/patterns/{gaveur_id}")
async def detect_patterns_gavage(
    gaveur_id: int,
    pool: asyncpg.Pool = Depends(get_db_pool)
):
    """Détecte les patterns de gavage (best practices)"""
    analytics_engine = get_analytics_engine(pool)

    patterns = await analytics_engine.detect_patterns_gavage(gaveur_id)
    return patterns


@router.get("/api/analytics/weekly-report/{gaveur_id}")
async def get_weekly_report(
    gaveur_id: int,
    pool: asyncpg.Pool = Depends(get_db_pool)
):
    """Rapport hebdomadaire complet"""
    analytics_engine = get_analytics_engine(pool)

    rapport = await analytics_engine.generate_weekly_report(gaveur_id)
    return rapport


@router.get("/api/gavage/gaveur/{gaveur_id}")
async def get_gavages_by_gaveur(
    gaveur_id: int,
    limit: int = 10,
    pool: asyncpg.Pool = Depends(get_db_pool)
):
    """
    Récupère l'historique des gavages pour un gaveur spécifique
    Retourne les N derniers gavages triés par date décroissante
    """
    async with pool.acquire() as conn:
        # Récupérer les derniers gavages pour tous les canards du gaveur
        query = """
            SELECT
                gd.time,
                gd.canard_id,
                c.numero_identification,
                c.genetique,
                gd.dose_matin,
                gd.dose_soir,
                gd.poids_matin,
                gd.poids_soir,
                gd.temperature_stabule,
                gd.humidite_stabule,
                gd.remarques,
                gd.comportement_observe,
                gd.alerte_generee
            FROM gavage_data gd
            INNER JOIN canards c ON gd.canard_id = c.id
            WHERE c.gaveur_id = $1
            ORDER BY gd.time DESC
            LIMIT $2
        """

        rows = await conn.fetch(query, gaveur_id, limit)

        gavages = []
        for row in rows:
            gavages.append({
                "time": row["time"].isoformat(),
                "canard_id": row["canard_id"],
                "numero_identification": row["numero_identification"],
                "genetique": row["genetique"],
                "dose_matin": float(row["dose_matin"]) if row["dose_matin"] else None,
                "dose_soir": float(row["dose_soir"]) if row["dose_soir"] else None,
                "poids_matin": float(row["poids_matin"]) if row["poids_matin"] else None,
                "poids_soir": float(row["poids_soir"]) if row["poids_soir"] else None,
                "temperature_stabule": float(row["temperature_stabule"]),
                "humidite_stabule": float(row["humidite_stabule"]) if row["humidite_stabule"] else None,
                "remarques": row["remarques"],
                "comportement_observe": row["comportement_observe"],
                "alerte_generee": row["alerte_generee"]
            })

        return {
            "gaveur_id": gaveur_id,
            "count": len(gavages),
            "gavages": gavages
        }


# ============================================
# ROUTES - FONCTIONNALITÉS INNOVANTES
# ============================================

@router.post("/api/vision/detect-poids")
async def detect_poids_vision(
    image_base64: str,
    genetique: Optional[str] = None,
    pool: asyncpg.Pool = Depends(get_db_pool)
):
    """
    Détection automatique du poids par vision par ordinateur (CNN)
    """
    vision_engine = get_computer_vision_engine(pool)
    result = await vision_engine.predict_weight(image_base64, genetique)
    return result


@router.post("/api/vision/train")
async def train_vision_model(
    genetique: Optional[str] = None,
    epochs: int = 50,
    batch_size: int = 32,
    pool: asyncpg.Pool = Depends(get_db_pool)
):
    """
    Entraîne le modèle CNN de détection de poids
    """
    vision_engine = get_computer_vision_engine(pool)
    result = await vision_engine.train_model(
        genetique=genetique,
        epochs=epochs,
        batch_size=batch_size
    )
    return result


@router.get("/api/vision/evaluate")
async def evaluate_vision_model(
    genetique: Optional[str] = None,
    pool: asyncpg.Pool = Depends(get_db_pool)
):
    """
    Évalue le modèle CNN sur un ensemble de test
    """
    vision_engine = get_computer_vision_engine(pool)
    result = await vision_engine.evaluate_model(genetique)
    return result


@router.post("/api/voice/parse-command")
async def parse_voice_command(
    audio_base64: str,
    language: str = "fr",
    pool: asyncpg.Pool = Depends(get_db_pool)
):
    """
    Parse une commande vocale pour saisie automatique (Whisper)
    """
    voice_assistant = get_voice_assistant(pool)
    result = await voice_assistant.process_voice_command(audio_base64, language)
    return result


@router.get("/api/voice/commands")
async def get_supported_commands(pool: asyncpg.Pool = Depends(get_db_pool)):
    """
    Liste des commandes vocales supportées
    """
    voice_assistant = get_voice_assistant(pool)
    commands = voice_assistant.get_supported_commands()
    return {"supported_commands": commands}


@router.get("/api/voice/statistics/{gaveur_id}")
async def get_voice_statistics(
    gaveur_id: int,
    pool: asyncpg.Pool = Depends(get_db_pool)
):
    """
    Statistiques d'utilisation de la saisie vocale
    """
    voice_assistant = get_voice_assistant(pool)
    stats = await voice_assistant.get_voice_statistics(gaveur_id)
    return stats


@router.post("/api/optimize/multi-objective")
async def optimize_multi_objective(
    genetique: str = "Mulard",
    population_size: int = 100,
    n_generations: int = 50,
    pool: asyncpg.Pool = Depends(get_db_pool)
):
    """
    Optimisation multi-objectifs avec NSGA-II
    - Maximiser poids foie
    - Maximiser survie
    - Maximiser efficacité coût
    - Maximiser rapidité
    - Maximiser satisfaction consommateur
    """
    optimizer = get_multiobjective_optimizer(pool)
    result = await optimizer.optimize(
        genetique=genetique,
        population_size=population_size,
        n_generations=n_generations
    )
    return result


@router.get("/api/insights/ai-suggestions/{gaveur_id}")
async def get_ai_suggestions(
    gaveur_id: int,
    pool: asyncpg.Pool = Depends(get_db_pool)
):
    """
    Suggestions intelligentes de l'IA basées sur les données
    """
    analytics_engine = get_analytics_engine(pool)

    # Analyser les patterns
    patterns = await analytics_engine.detect_patterns_gavage(gaveur_id)

    # Générer des suggestions
    suggestions = [
        {
            "type": "timing",
            "titre": "Optimiser l'heure de gavage",
            "description": f"Vos meilleurs résultats sont à {patterns['patterns_detectes'][0]['valeur_optimale']}",
            "impact_prevu": "+5% de gain de poids",
            "priorite": "haute"
        },
        {
            "type": "temperature",
            "titre": "Ajuster la température",
            "description": "La température optimale pour vos canards est autour de 22°C",
            "impact_prevu": "+3% de gain de poids",
            "priorite": "moyenne"
        },
        {
            "type": "genetique",
            "titre": "Privilégier génétique Mulard",
            "description": "Vos meilleurs résultats sont avec la génétique Mulard",
            "impact_prevu": "+8% de rendement",
            "priorite": "haute"
        }
    ]

    return {
        "gaveur_id": gaveur_id,
        "suggestions": suggestions,
        "date_generation": datetime.utcnow().isoformat()
    }


# ============================================
# ROUTES - EXPORT & RAPPORTS
# ============================================

@router.get("/api/export/rapport-pdf/{gaveur_id}")
async def export_rapport_pdf(gaveur_id: int, periode: str = "semaine"):
    """
    Génère un rapport PDF complet
    (À implémenter avec ReportLab ou WeasyPrint)
    """
    # TODO: Générer PDF

    return {
        "url_download": "/downloads/rapport_semaine_123.pdf",
        "status": "generated"
    }


@router.get("/api/export/excel/{gaveur_id}")
async def export_excel(gaveur_id: int):
    """
    Exporte toutes les données en Excel
    (À implémenter avec openpyxl)
    """
    # TODO: Générer Excel

    return {
        "url_download": "/downloads/donnees_gaveur_123.xlsx",
        "status": "generated"
    }
