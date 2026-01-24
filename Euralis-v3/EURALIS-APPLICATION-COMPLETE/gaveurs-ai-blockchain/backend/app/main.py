from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
import asyncpg
import os
from datetime import datetime, time
import logging

from app.models.schemas import (
    GaveurCreate, Gaveur, CanardCreate, Canard,
    GavageDataCreate, GavageData, AlerteCreate, Alerte,
    PredictionCourbe, BlockchainInit, BlockchainRecord,
    StatistiquesGaveur, CorrectionDose
)
from app.services.sms_service import sms_service
from app.services.dose_correction_service import get_dose_correction_service
from app.ml.symbolic_regression import get_symbolic_engine
from app.blockchain.blockchain_service import get_blockchain
from prometheus_client import Counter, Histogram, generate_latest
from fastapi import Response

# Import du router Euralis
from app.routers import euralis

# Configuration logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Métriques Prometheus
REQUEST_COUNT = Counter('gaveurs_requests_total', 'Total requests', ['method', 'endpoint'])
REQUEST_DURATION = Histogram('gaveurs_request_duration_seconds', 'Request duration')
GAVAGE_COUNT = Counter('gavages_total', 'Total gavages enregistrés')
ALERTES_COUNT = Counter('alertes_total', 'Total alertes générées', ['niveau'])
SMS_COUNT = Counter('sms_total', 'Total SMS envoyés', ['type'])

# Application FastAPI
app = FastAPI(
    title="Système Gaveurs V2.1 - API IA & Blockchain",
    description="API complète pour gavage intelligent avec régression symbolique et traçabilité blockchain",
    version="2.1.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inclusion du router Euralis
app.include_router(euralis.router)

# Pool de connexion PostgreSQL/TimescaleDB
db_pool: Optional[asyncpg.Pool] = None


# ============================================
# ÉVÉNEMENTS DE DÉMARRAGE/ARRÊT
# ============================================

@app.on_event("startup")
async def startup():
    """Initialisation au démarrage"""
    global db_pool
    
    # Connexion à TimescaleDB
    database_url = os.getenv(
        "DATABASE_URL",
        "postgresql://gaveurs_user:gaveurs_pass@timescaledb:5432/gaveurs_db"
    )
    
    db_pool = await asyncpg.create_pool(database_url, min_size=5, max_size=20)
    logger.info("✅ Connexion TimescaleDB établie")
    
    # Initialiser les services
    logger.info("✅ Services initialisés")


@app.on_event("shutdown")
async def shutdown():
    """Nettoyage à l'arrêt"""
    global db_pool
    if db_pool:
        await db_pool.close()
        logger.info("🔴 Connexion TimescaleDB fermée")


# ============================================
# DÉPENDANCES
# ============================================

async def get_db():
    """Dépendance pour obtenir la connexion DB"""
    return db_pool


# ============================================
# ROUTES - HEALTH & METRICS
# ============================================

@app.get("/")
async def root():
    """Route racine"""
    return {
        "application": "Système Gaveurs V2.1",
        "version": "2.1.0",
        "description": "API IA & Blockchain pour gavage intelligent",
        "status": "operational"
    }


@app.get("/health")
async def health_check():
    """Health check"""
    try:
        async with db_pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        
        return {
            "status": "healthy",
            "database": "connected",
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database error: {str(e)}")


@app.get("/metrics")
async def metrics():
    """Métriques Prometheus"""
    return Response(content=generate_latest(), media_type="text/plain")


# ============================================
# ROUTES - GAVEURS
# ============================================

@app.post("/api/gaveurs/", response_model=Gaveur)
async def create_gaveur(gaveur: GaveurCreate):
    """Créer un nouveau gaveur"""
    # TODO: Hasher le mot de passe
    query = """
    INSERT INTO gaveurs (nom, prenom, email, telephone, password_hash, adresse, certifications)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, nom, prenom, email, telephone, adresse, certifications, created_at, actif
    """
    
    async with db_pool.acquire() as conn:
        record = await conn.fetchrow(
            query,
            gaveur.nom,
            gaveur.prenom,
            gaveur.email,
            gaveur.telephone,
            "hashed_" + gaveur.password,  # TODO: Utiliser bcrypt
            gaveur.adresse,
            gaveur.certifications
        )
    
    return Gaveur(**dict(record))


@app.get("/api/gaveurs/{gaveur_id}", response_model=Gaveur)
async def get_gaveur(gaveur_id: int):
    """Récupérer un gaveur par ID"""
    query = "SELECT * FROM gaveurs WHERE id = $1"
    
    async with db_pool.acquire() as conn:
        record = await conn.fetchrow(query, gaveur_id)
    
    if not record:
        raise HTTPException(status_code=404, detail="Gaveur non trouvé")
    
    return Gaveur(**dict(record))


# ============================================
# ROUTES - CANARDS
# ============================================

@app.post("/api/canards/", response_model=Canard)
async def create_canard(canard: CanardCreate):
    """Créer un nouveau canard"""
    query = """
    INSERT INTO canards (
        numero_identification, gaveur_id, genetique, date_naissance,
        origine_elevage, numero_lot_canard, poids_initial
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
    """
    
    async with db_pool.acquire() as conn:
        record = await conn.fetchrow(
            query,
            canard.numero_identification,
            canard.gaveur_id,
            canard.genetique,
            canard.date_naissance,
            canard.origine_elevage,
            canard.numero_lot_canard,
            canard.poids_initial
        )
    
    return Canard(**dict(record))


@app.get("/api/canards/gaveur/{gaveur_id}", response_model=List[Canard])
async def get_canards_by_gaveur(gaveur_id: int):
    """Liste des canards d'un gaveur"""
    query = "SELECT * FROM canards WHERE gaveur_id = $1 ORDER BY created_at DESC"
    
    async with db_pool.acquire() as conn:
        records = await conn.fetch(query, gaveur_id)
    
    return [Canard(**dict(r)) for r in records]


# ============================================
# ROUTES - GAVAGE & IA
# ============================================

@app.post("/api/gavage/", response_model=GavageData)
async def create_gavage_data(data: GavageDataCreate):
    """
    Enregistrer une donnée de gavage avec calcul automatique de dose théorique
    et génération de correction si écart
    """
    # Obtenir le service de correction
    correction_service = get_dose_correction_service(db_pool)
    
    # Calculer les doses théoriques
    try:
        dose_theo_matin = await correction_service.calculate_theoretical_dose(
            data.canard_id,
            "matin"
        )
        dose_theo_soir = await correction_service.calculate_theoretical_dose(
            data.canard_id,
            "soir"
        )
    except Exception as e:
        logger.warning(f"Calcul dose théorique échoué: {e}")
        dose_theo_matin = None
        dose_theo_soir = None
    
    # Calculer les écarts
    ecart_matin = abs(data.dose_matin - dose_theo_matin) if dose_theo_matin else None
    ecart_soir = abs(data.dose_soir - dose_theo_soir) if dose_theo_soir else None
    
    # Insérer dans la DB
    query = """
    INSERT INTO gavage_data (
        time, canard_id, dose_matin, dose_soir, dose_theorique_matin, dose_theorique_soir,
        heure_gavage_matin, heure_gavage_soir, poids_matin, poids_soir,
        temperature_stabule, humidite_stabule, qualite_air_co2,
        lot_mais_id, remarques, comportement_observe, etat_sanitaire,
        ecart_dose_matin, ecart_dose_soir
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
    RETURNING *
    """
    
    async with db_pool.acquire() as conn:
        record = await conn.fetchrow(
            query,
            datetime.utcnow(),
            data.canard_id,
            data.dose_matin,
            data.dose_soir,
            dose_theo_matin,
            dose_theo_soir,
            data.heure_gavage_matin,
            data.heure_gavage_soir,
            data.poids_matin,
            data.poids_soir,
            data.temperature_stabule,
            data.humidite_stabule,
            data.qualite_air_co2,
            data.lot_mais_id,
            data.remarques,
            data.comportement_observe,
            data.etat_sanitaire,
            ecart_matin,
            ecart_soir
        )
    
    GAVAGE_COUNT.inc()
    
    # Vérifier et générer correction si nécessaire
    gaveur_query = "SELECT telephone FROM gaveurs g JOIN canards c ON g.id = c.gaveur_id WHERE c.id = $1"
    async with db_pool.acquire() as conn:
        gaveur_tel = await conn.fetchval(gaveur_query, data.canard_id)
    
    if dose_theo_matin and gaveur_tel:
        await correction_service.check_and_correct(
            data.canard_id,
            data.dose_matin,
            dose_theo_matin,
            "matin",
            gaveur_tel
        )
    
    if dose_theo_soir and gaveur_tel:
        await correction_service.check_and_correct(
            data.canard_id,
            data.dose_soir,
            dose_theo_soir,
            "soir",
            gaveur_tel
        )
    
    # Ajouter à la blockchain
    blockchain = get_blockchain(db_pool)
    if blockchain.initialise:
        await blockchain.ajouter_evenement_gavage(
            canard_id=data.canard_id,
            gaveur_id=record["canard_id"],  # TODO: récupérer le vrai gaveur_id
            donnees_gavage={
                "dose_matin": float(data.dose_matin),
                "dose_soir": float(data.dose_soir),
                "poids_matin": float(data.poids_matin) if data.poids_matin else None,
                "poids_soir": float(data.poids_soir) if data.poids_soir else None,
                "temperature": float(data.temperature_stabule)
            }
        )
    
    return GavageData(**dict(record))


@app.get("/api/gavage/canard/{canard_id}", response_model=List[GavageData])
async def get_gavage_history(canard_id: int, limit: int = 50):
    """Historique de gavage d'un canard"""
    query = """
    SELECT * FROM gavage_data 
    WHERE canard_id = $1 
    ORDER BY time DESC 
    LIMIT $2
    """
    
    async with db_pool.acquire() as conn:
        records = await conn.fetch(query, canard_id, limit)
    
    return [GavageData(**dict(r)) for r in records]


# ============================================
# ROUTES - RÉGRESSION SYMBOLIQUE
# ============================================

@app.post("/api/ml/discover-formula/{genetique}")
async def discover_formula(genetique: str, max_iterations: int = 50):
    """
    Lance la découverte de formule symbolique pour une génétique
    """
    engine = get_symbolic_engine(db_pool)
    
    try:
        result = await engine.discover_formula_poids(genetique, max_iterations)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/ml/predict-doses/{canard_id}")
async def predict_optimal_doses(canard_id: int):
    """
    Calcule les doses optimales pour un canard
    """
    engine = get_symbolic_engine(db_pool)
    
    # Récupérer infos canard
    query = """
    SELECT 
        c.genetique,
        COALESCE((SELECT poids_soir FROM gavage_data WHERE canard_id = c.id ORDER BY time DESC LIMIT 1), c.poids_initial) as poids_actuel,
        c.poids_initial + 800 as poids_cible,
        14 - EXTRACT(EPOCH FROM (NOW() - c.created_at))/86400 as jours_restants
    FROM canards c
    WHERE c.id = $1
    """
    
    async with db_pool.acquire() as conn:
        canard_info = await conn.fetchrow(query, canard_id)
    
    if not canard_info:
        raise HTTPException(status_code=404, detail="Canard non trouvé")
    
    try:
        result = await engine.calculate_optimal_doses(
            canard_id=canard_id,
            genetique=canard_info["genetique"],
            poids_actuel=canard_info["poids_actuel"],
            poids_cible=canard_info["poids_cible"],
            jours_restants=int(canard_info["jours_restants"]),
            temperature=20.0,
            humidite=60.0,
            humidite_mais=14.0
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# ROUTES - CORRECTIONS
# ============================================

@app.get("/api/corrections/canard/{canard_id}", response_model=List[CorrectionDose])
async def get_corrections_canard(canard_id: int):
    """Historique des corrections pour un canard"""
    correction_service = get_dose_correction_service(db_pool)
    corrections = await correction_service.get_corrections_history(canard_id=canard_id)
    return corrections


@app.get("/api/corrections/gaveur/{gaveur_id}/stats")
async def get_corrections_stats(gaveur_id: int):
    """Statistiques de corrections pour un gaveur"""
    correction_service = get_dose_correction_service(db_pool)
    stats = await correction_service.get_correction_stats(gaveur_id)
    return stats


# ============================================
# ROUTES - BLOCKCHAIN
# ============================================

@app.post("/api/blockchain/init")
async def init_blockchain(init_data: BlockchainInit):
    """Initialiser la blockchain"""
    blockchain = get_blockchain(db_pool)
    
    await blockchain.initialiser_blockchain(
        gaveur_id=init_data.gaveur_id,
        canard_ids=init_data.canard_ids
    )
    
    return {
        "status": "initialized",
        "gaveur_id": init_data.gaveur_id,
        "nb_canards": len(init_data.canard_ids),
        "description": init_data.description
    }


@app.get("/api/blockchain/canard/{canard_id}/history")
async def get_blockchain_history(canard_id: int):
    """Historique blockchain complet d'un canard"""
    blockchain = get_blockchain(db_pool)
    historique = await blockchain.get_historique_canard(canard_id)
    return historique


@app.get("/api/blockchain/canard/{canard_id}/certificat")
async def get_certificat_tracabilite(canard_id: int):
    """Certificat de traçabilité pour le consommateur"""
    blockchain = get_blockchain(db_pool)
    
    try:
        certificat = await blockchain.generer_certificat_tracabilite(canard_id)
        return certificat
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/blockchain/verify")
async def verify_blockchain():
    """Vérifier l'intégrité de la blockchain"""
    blockchain = get_blockchain(db_pool)
    result = await blockchain.verifier_integrite_chaine()
    return result


# ============================================
# ROUTES - ALERTES & SMS
# ============================================

@app.post("/api/alertes/", response_model=Alerte)
async def create_alerte(alerte: AlerteCreate):
    """Créer une alerte"""
    query = """
    INSERT INTO alertes (
        time, canard_id, niveau, type_alerte, message,
        valeur_mesuree, valeur_seuil, sms_envoye
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
    """
    
    async with db_pool.acquire() as conn:
        record = await conn.fetchrow(
            query,
            datetime.utcnow(),
            alerte.canard_id,
            alerte.niveau,
            alerte.type_alerte,
            alerte.message,
            alerte.valeur_mesuree,
            alerte.valeur_seuil,
            False
        )
    
    ALERTES_COUNT.labels(niveau=alerte.niveau).inc()
    
    # Envoyer SMS si demandé
    if alerte.envoyer_sms:
        gaveur_query = """
        SELECT g.telephone 
        FROM gaveurs g 
        JOIN canards c ON g.id = c.gaveur_id 
        WHERE c.id = $1
        """
        async with db_pool.acquire() as conn:
            telephone = await conn.fetchval(gaveur_query, alerte.canard_id)
        
        if telephone and alerte.niveau == "critique":
            await sms_service.send_alerte_critique(
                telephone,
                alerte.canard_id,
                alerte.message
            )
            SMS_COUNT.labels(type="alerte").inc()
    
    return Alerte(**dict(record))


@app.get("/api/alertes/gaveur/{gaveur_id}")
async def get_alertes_gaveur(gaveur_id: int, acquittee: Optional[bool] = None):
    """Alertes d'un gaveur"""
    query = """
    SELECT a.* FROM alertes a
    JOIN canards c ON a.canard_id = c.id
    WHERE c.gaveur_id = $1
    """
    params = [gaveur_id]
    
    if acquittee is not None:
        query += " AND a.acquittee = $2"
        params.append(acquittee)
    
    query += " ORDER BY a.time DESC LIMIT 100"
    
    async with db_pool.acquire() as conn:
        records = await conn.fetch(query, *params)
    
    return [Alerte(**dict(r)) for r in records]


# ============================================
# ROUTES - STATISTIQUES
# ============================================

@app.get("/api/stats/gaveur/{gaveur_id}", response_model=StatistiquesGaveur)
async def get_stats_gaveur(gaveur_id: int):
    """Statistiques complètes d'un gaveur"""
    query = """
    SELECT * FROM performance_gaveurs WHERE id = $1
    """
    
    async with db_pool.acquire() as conn:
        record = await conn.fetchrow(query, gaveur_id)
    
    if not record:
        raise HTTPException(status_code=404, detail="Gaveur non trouvé")
    
    return {
        "gaveur_id": gaveur_id,
        "periode_debut": datetime.utcnow() - datetime.timedelta(days=30),
        "periode_fin": datetime.utcnow(),
        "nombre_canards_total": record["nombre_canards_total"],
        "nombre_canards_termines": record["canards_termines"],
        "poids_moyen_final": float(record["poids_moyen_final"]),
        "taux_mortalite": float(record["taux_mortalite_pct"]),
        "indice_consommation": 3.2,  # TODO: calculer
        "performance_score": 85.0  # TODO: calculer
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
