"""
Routes API supplémentaires pour Analytics et Anomaly Detection
À ajouter à main.py ou à importer dans main.py
"""

from fastapi import APIRouter, HTTPException
from typing import Optional
from app.ml.anomaly_detection import get_anomaly_detection
from app.ml.analytics_engine import get_analytics_engine

router = APIRouter()

# ============================================
# ROUTES - ANOMALY DETECTION & ALERTES
# ============================================

@router.post("/api/alertes/check-all/{canard_id}")
async def check_all_alerts(canard_id: int, gaveur_telephone: str):
    """
    Vérifie TOUTES les alertes possibles pour un canard
    """
    anomaly_engine = get_anomaly_detection(db_pool)
    
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
async def get_alertes_dashboard(gaveur_id: int):
    """Dashboard des alertes pour un gaveur"""
    anomaly_engine = get_anomaly_detection(db_pool)
    dashboard = await anomaly_engine.get_alertes_dashboard(gaveur_id)
    return dashboard


@router.post("/api/alertes/{alerte_id}/acquitter")
async def acquitter_alerte(alerte_id: int, gaveur_id: int):
    """Acquitter une alerte"""
    query = """
    UPDATE alertes
    SET acquittee = true,
        acquittee_par = $1,
        acquittee_le = NOW()
    WHERE id = $2
    """
    
    async with db_pool.acquire() as conn:
        await conn.execute(query, gaveur_id, alerte_id)
    
    return {"status": "acquittee"}


@router.post("/api/alertes/check-mortalite-lot")
async def check_mortalite_lot(numero_lot: str, gaveur_telephone: str):
    """Vérifier la mortalité d'un lot"""
    anomaly_engine = get_anomaly_detection(db_pool)
    
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
async def detect_anomalies_ml(canard_id: int, window_days: int = 3):
    """Détection d'anomalies par ML (Isolation Forest)"""
    anomaly_engine = get_anomaly_detection(db_pool)
    
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
async def get_performance_metrics(canard_id: int):
    """Métriques de performance complètes d'un canard"""
    analytics_engine = get_analytics_engine(db_pool)
    
    try:
        metrics = await analytics_engine.calculate_performance_metrics(canard_id)
        return metrics
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/api/analytics/predict-prophet/{canard_id}")
async def predict_courbe_prophet(canard_id: int, jours: int = 7):
    """Prédictions Prophet (Facebook AI)"""
    analytics_engine = get_analytics_engine(db_pool)
    
    try:
        predictions = await analytics_engine.predict_courbe_poids_prophet(
            canard_id,
            jours
        )
        return predictions
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/analytics/compare-genetiques")
async def compare_genetiques(gaveur_id: Optional[int] = None):
    """Comparaison des performances par génétique"""
    analytics_engine = get_analytics_engine(db_pool)
    
    comparaison = await analytics_engine.compare_genetiques(gaveur_id)
    return comparaison


@router.get("/api/analytics/correlation-temperature/{canard_id}")
async def analyze_correlation_temperature(canard_id: int):
    """Analyse corrélation température <-> gain de poids"""
    analytics_engine = get_analytics_engine(db_pool)
    
    correlation = await analytics_engine.analyze_correlation_temperature_poids(canard_id)
    return correlation


@router.get("/api/analytics/patterns/{gaveur_id}")
async def detect_patterns_gavage(gaveur_id: int):
    """Détecte les patterns de gavage (best practices)"""
    analytics_engine = get_analytics_engine(db_pool)
    
    patterns = await analytics_engine.detect_patterns_gavage(gaveur_id)
    return patterns


@router.get("/api/analytics/weekly-report/{gaveur_id}")
async def get_weekly_report(gaveur_id: int):
    """Rapport hebdomadaire complet"""
    analytics_engine = get_analytics_engine(db_pool)
    
    rapport = await analytics_engine.generate_weekly_report(gaveur_id)
    return rapport


# ============================================
# ROUTES - FONCTIONNALITÉS INNOVANTES
# ============================================

@router.post("/api/vision/detect-poids")
async def detect_poids_vision(image_base64: str):
    """
    Détection automatique du poids par vision par ordinateur
    (À implémenter avec modèle TensorFlow/PyTorch)
    """
    # TODO: Implémenter avec un modèle de vision entraîné
    
    return {
        "poids_detecte": 3250.5,
        "confiance": 0.92,
        "methode": "Vision par ordinateur",
        "status": "demo"
    }


@router.post("/api/voice/parse-command")
async def parse_voice_command(audio_base64: str):
    """
    Parse une commande vocale pour saisie automatique
    (À implémenter avec Google Speech-to-Text ou Whisper)
    """
    # TODO: Implémenter avec API de transcription
    
    return {
        "transcription": "dose matin 450 grammes",
        "parsed_data": {
            "dose_matin": 450
        },
        "confiance": 0.95
    }


@router.post("/api/optimize/multi-objective")
async def optimize_multi_objective(
    canard_id: int,
    objectifs: dict
):
    """
    Optimisation multi-objectifs
    - Maximiser poids foie
    - Minimiser mortalité
    - Optimiser coûts
    """
    # TODO: Implémenter avec algorithme génétique ou NSGA-II
    
    return {
        "canard_id": canard_id,
        "solution_optimale": {
            "dose_matin": 460,
            "dose_soir": 485,
            "temperature_optimale": 21.5,
            "duree_gavage": 13
        },
        "scores": {
            "poids_foie": 0.92,
            "risque_mortalite": 0.05,
            "cout": 0.85
        }
    }


@router.get("/api/insights/ai-suggestions/{gaveur_id}")
async def get_ai_suggestions(gaveur_id: int):
    """
    Suggestions intelligentes de l'IA basées sur les données
    """
    analytics_engine = get_analytics_engine(db_pool)
    
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


# Note: Ajouter ces routes à main.py avec:
# from app.api.advanced_routes import router as advanced_router
# app.include_router(advanced_router)
