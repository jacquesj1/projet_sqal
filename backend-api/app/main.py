from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from typing import List, Optional
import asyncpg
import os
from datetime import datetime, time
import asyncio

from app.models.schemas import (
    GaveurCreate, Gaveur, CanardCreate, Canard,
    GavageDataCreate, GavageData, AlerteCreate, Alerte,
    PredictionCourbe, BlockchainInit, BlockchainRecord,
    StatistiquesGaveur, CorrectionDose
)
from app.services.sms_service import sms_service
from app.services.dose_correction_service import get_dose_correction_service
# TEMPORAIRE: PySR désactivé pour démarrage rapide (Julia installation longue)
# TEMPORAIRE: PySR désactivé pour démarrage rapide (Julia installation longue)
# from app.ml.symbolic_regression import get_symbolic_engine
from app.blockchain.blockchain_service import get_blockchain
from prometheus_client import Counter, Histogram, generate_latest
from fastapi import Response

# Import des routers Euralis (supervision multi-sites), SQAL (contrôle qualité) et Consumer Feedback
from app.routers import euralis, sqal, consumer_feedback, simulator_control, bug_tracking, lots, ml, auth as gaveur_auth, notifications, control_panel, tasks, courbes, voice, ocr
# Import router Advanced Routes (Analytics + Alertes IA)
from app.api import advanced_routes
# Import router Auth (Keycloak authentication)
from app.api import auth_routes

# Import Production-ready Core Modules (Phase 2)
try:
    from app.core.cache import CacheManager
    from app.core.health import health_manager, initialize_health_checks
    from app.core.graceful_shutdown import shutdown_handler, initialize_graceful_shutdown, GracefulShutdownMiddleware
    from app.core.metrics import initialize_metrics, prometheus_middleware
    from app.core.circuit_breaker import db_circuit_breaker, cache_circuit_breaker
    from app.core.rate_limiter import RateLimiter
    CORE_MODULES_AVAILABLE = True
except ImportError as e:
    CORE_MODULES_AVAILABLE = False

# ============================================
# LOGGING CONFIGURATION (Daily Rotation by Module)
# ============================================
from app.core.logging_config import (
    setup_application_loggers,
    get_logger,
    main_logger,
    auth_logger,
    api_logger,
    websocket_logger,
    database_logger,
    error_logger
)

# Setup all application loggers with daily rotation
APPLICATION_LOGGERS = setup_application_loggers()

# Use main logger for this module
logger = main_logger

if CORE_MODULES_AVAILABLE:
    logger.info("✅ Production core modules imported successfully")
else:
    logger.warning(f"⚠️  Core modules not available: {e}")

# Métriques Prometheus
REQUEST_COUNT = Counter('gaveurs_requests_total', 'Total requests', ['method', 'endpoint'])
REQUEST_DURATION = Histogram('gaveurs_request_duration_seconds', 'Request duration')
GAVAGE_COUNT = Counter('gavages_total', 'Total gavages enregistrés')
ALERTES_COUNT = Counter('alertes_total', 'Total alertes générées', ['niveau'])
SMS_COUNT = Counter('sms_total', 'Total SMS envoyés', ['type'])

# Pool de connexion PostgreSQL/TimescaleDB
db_pool: Optional[asyncpg.Pool] = None

# Production Infrastructure (Phase 2)
cache_manager: Optional['CacheManager'] = None
rate_limiter: Optional['RateLimiter'] = None


# ============================================
# LIFECYCLE MANAGER (Modern FastAPI Pattern)
# ============================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Modern FastAPI lifespan manager
    Replaces deprecated @app.on_event("startup") and @app.on_event("shutdown")
    """
    global db_pool, cache_manager, rate_limiter

    logger.info("=" * 80)
    logger.info("🚀 GAVEURS BACKEND STARTING (v3.0 - Production Ready)")
    logger.info("=" * 80)

    # ========================================================================
    # STARTUP PHASE
    # ========================================================================

    # Step 1: Initialize core infrastructure modules (if available)
    if CORE_MODULES_AVAILABLE:
        logger.info("📦 Initializing production core modules...")

        # Initialize Prometheus metrics
        initialize_metrics()
        logger.info("  ✅ Prometheus metrics initialized")

        # Initialize health checks
        initialize_health_checks()
        logger.info("  ✅ Health checks initialized (K8s ready)")

        # Initialize graceful shutdown
        initialize_graceful_shutdown()
        logger.info("  ✅ Graceful shutdown handler initialized")

    # Step 2: Database connection
    database_url = os.getenv(
        "DATABASE_URL",
        "postgresql://gaveurs_admin:gaveurs_secure_2024@timescaledb:5432/gaveurs_db"
    )

    try:
        logger.info("⏳ Connecting to TimescaleDB...")
        # Disable SSL for local development (Windows host -> Docker container)
        import ssl
        db_pool = await asyncpg.create_pool(
            database_url,
            min_size=5,
            max_size=20,
            ssl=False  # Disable SSL for localhost connections
        )
        app.state.db_pool = db_pool  # Make pool available for routers
        logger.info("  ✅ TimescaleDB connection established")

        if CORE_MODULES_AVAILABLE:
            try:
                health_manager.mark_component_healthy("database")
            except AttributeError:
                pass  # Method may not exist
    except Exception as e:
        logger.error(f"  ❌ Database connection failed: {e}")
        # if CORE_MODULES_AVAILABLE:
        #     health_manager.mark_component_unhealthy("database", str(e))
        raise

    # Step 3: Initialize Redis cache (if available)
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    if CORE_MODULES_AVAILABLE:
        try:
            logger.info(f"⏳ Connecting to Redis: {redis_url}")
            cache_manager = CacheManager(redis_url)
            await cache_manager.connect()
            app.state.cache = cache_manager
            logger.info("  ✅ Redis cache connected")
            try:
                health_manager.mark_component_healthy("cache")
            except AttributeError:
                pass
        except Exception as e:
            logger.warning(f"  ⚠️  Redis connection failed: {e}")
            logger.warning("  ⚠️  Running without cache (will impact performance)")
            # health_manager.mark_component_unhealthy("cache", str(e))
            cache_manager = None

    # Step 4: Initialize rate limiter
    if CORE_MODULES_AVAILABLE and cache_manager:
        try:
            rate_limiter = RateLimiter(
                redis_client=cache_manager.redis,
                max_requests=100,
                window_seconds=60
            )
            app.state.rate_limiter = rate_limiter
            logger.info("  ✅ Rate limiter initialized (100 req/60s)")
        except Exception as e:
            logger.warning(f"  ⚠️  Rate limiter initialization failed: {e}")
            rate_limiter = None

    # Step 5: Initialize application services
    logger.info("⏳ Initializing application services...")

    # SQAL service
    try:
        from app.services.sqal_service import sqal_service
        await sqal_service.init_pool(database_url)
        logger.info("  ✅ SQAL service initialized")
    except Exception as e:
        logger.error(f"  ❌ SQAL service initialization failed: {e}")

    # Consumer Feedback service (using shared db_pool)
    try:
        from app.services.consumer_feedback_service import consumer_feedback_service
        await consumer_feedback_service.init_pool(database_url, shared_pool=db_pool)
        logger.info("  ✅ Consumer Feedback service initialized")
    except Exception as e:
        logger.error(f"  ❌ Consumer Feedback service initialization failed: {e}")

    # Lot Registry service (V2 - Traçabilité complète)
    try:
        from app.services.lot_registry import lot_registry
        await lot_registry.init_pool(database_url)
        logger.info("  ✅ Lot Registry service initialized")
    except Exception as e:
        logger.error(f"  ❌ Lot Registry service initialization failed: {e}")

    # Step 6: Mark as ready
    if CORE_MODULES_AVAILABLE:
        health_manager.mark_as_started()
        health_manager.mark_as_ready()

    logger.info("=" * 80)
    logger.info("✅ GAVEURS BACKEND FULLY STARTED AND READY!")
    logger.info("=" * 80)
    logger.info("")
    logger.info("📊 Endpoints available:")
    logger.info("  - API Docs:        http://localhost:8000/docs")
    logger.info("  - Health Check:    http://localhost:8000/health")
    if CORE_MODULES_AVAILABLE:
        logger.info("  - Health (K8s):    http://localhost:8000/health/startup")
        logger.info("                     http://localhost:8000/health/live")
        logger.info("                     http://localhost:8000/health/ready")
        logger.info("  - Prometheus:      http://localhost:8000/metrics")
    logger.info("")

    # ========================================================================
    # APPLICATION RUNNING
    # ========================================================================

    yield

    # ========================================================================
    # SHUTDOWN PHASE
    # ========================================================================

    logger.info("=" * 80)
    logger.info("🛑 GAVEURS BACKEND SHUTTING DOWN...")
    logger.info("=" * 80)

    # Mark as shutting down
    if CORE_MODULES_AVAILABLE:
        health_manager.mark_as_shutting_down()

    # Execute graceful shutdown (if available)
    if CORE_MODULES_AVAILABLE:
        try:
            await shutdown_handler.shutdown()
        except Exception as e:
            logger.error(f"Graceful shutdown error: {e}")

    # Close application services
    try:
        from app.services.sqal_service import sqal_service
        await sqal_service.close_pool()
        logger.info("  🔴 SQAL service closed")
    except Exception as e:
        logger.error(f"Error closing SQAL service: {e}")

    try:
        from app.services.consumer_feedback_service import consumer_feedback_service
        await consumer_feedback_service.close_pool()
        logger.info("  🔴 Consumer Feedback service closed")
    except Exception as e:
        logger.error(f"Error closing Consumer Feedback service: {e}")

    try:
        from app.services.lot_registry import lot_registry
        await lot_registry.close_pool()
        logger.info("  🔴 Lot Registry service closed")
    except Exception as e:
        logger.error(f"Error closing Lot Registry service: {e}")

    # Close Redis cache
    if cache_manager:
        try:
            await cache_manager.disconnect()
            logger.info("  🔴 Redis cache disconnected")
        except Exception as e:
            logger.error(f"Error closing cache: {e}")

    # Close database connection
    if db_pool:
        try:
            await db_pool.close()
            logger.info("  🔴 TimescaleDB connection closed")
        except Exception as e:
            logger.error(f"Error closing database: {e}")

    logger.info("=" * 80)
    logger.info("✅ GAVEURS BACKEND SHUTDOWN COMPLETE")
    logger.info("=" * 80)


# ============================================
# DÉPENDANCES
# ============================================

async def get_db():
    """Dépendance pour obtenir la connexion DB"""
    return db_pool


# ============================================
# FASTAPI APPLICATION INSTANCE
# ============================================

# Application FastAPI (with lifespan for modern startup/shutdown)
app = FastAPI(
    title="Système Gaveurs V3.0 - Production Ready avec Infrastructure Complète",
    description="API complète pour gavage intelligent avec régression symbolique, traçabilité blockchain, supervision multi-sites Euralis, contrôle qualité SQAL (VL53L8CH + AS7341), cache Redis, health checks K8s, métriques Prometheus, circuit breakers et bug tracking",
    version="3.0.0",
    lifespan=lifespan  # Modern pattern (replaces @app.on_event)
)

# ============================================
# MIDDLEWARES
# ============================================

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Production middlewares (Phase 2)
if CORE_MODULES_AVAILABLE:
    try:
        # Graceful shutdown middleware
        app.add_middleware(GracefulShutdownMiddleware)
        logger.info("✅ Graceful shutdown middleware added")
    except Exception as e:
        logger.warning(f"⚠️  Could not add graceful shutdown middleware: {e}")

    try:
        # Prometheus metrics middleware
        app.middleware("http")(prometheus_middleware)
        logger.info("✅ Prometheus metrics middleware added")
    except Exception as e:
        logger.warning(f"⚠️  Could not add Prometheus middleware: {e}")

# ============================================
# ROUTERS
# ============================================

# Inclusion des routers
# app.include_router(gaveur_auth.router)      # DÉSACTIVÉ - Utiliser auth_routes.router avec Keycloak
app.include_router(lots.router)               # Gestion LOTS (modèle LOT-centric) - NOUVEAU
app.include_router(ml.router)                 # ML/IA Suggestions et Recommandations - NOUVEAU
app.include_router(notifications.router)      # Notifications (Email, SMS, Web Push) - NOUVEAU
app.include_router(courbes.router)            # PySR 3-Courbes Workflow (Théorique/Réelle/Correction) - SPRINT 3
app.include_router(voice.router)              # Reconnaissance vocale et parsing commandes - SAISIE RAPIDE
app.include_router(ocr.router)                # OCR extraction texte documents (bons livraison, fiches) - SAISIE RAPIDE
app.include_router(euralis.router)            # Supervision multi-sites
app.include_router(sqal.router)               # Contrôle qualité SQAL
app.include_router(consumer_feedback.router)  # Feedback consommateur + QR Code
app.include_router(consumer_feedback.public_router)  # Public traceability endpoints (frontend-traceability)
app.include_router(bug_tracking.router)       # Bug tracking production (NOUVEAU)
app.include_router(advanced_routes.router)    # Analytics + Alertes IA
app.include_router(auth_routes.router)        # Authentication Keycloak (PRODUCTION)
app.include_router(simulator_control.router)  # Contrôle simulateurs pour démos
app.include_router(control_panel.router)      # Control Panel Web - Pilotage simulateurs SQAL
app.include_router(tasks.router)              # Gestion tâches Celery asynchrones - NOUVEAU

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
    """Basic health check (legacy - kept for compatibility)"""
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


# ============================================
# KUBERNETES HEALTH CHECKS (Phase 2)
# ============================================

if CORE_MODULES_AVAILABLE:
    @app.get("/health/startup")
    async def health_startup():
        """
        Kubernetes Startup Probe
        Indicates if application has started (one-time check)
        """
        return health_manager.check_startup()

    @app.get("/health/live")
    async def health_liveness():
        """
        Kubernetes Liveness Probe
        Indicates if application is responsive (should restart if fails)
        """
        return health_manager.check_liveness()

    @app.get("/health/ready")
    async def health_readiness():
        """
        Kubernetes Readiness Probe
        Indicates if application can serve traffic (remove from LB if fails)
        """
        return health_manager.check_readiness()


@app.get("/metrics")
async def metrics():
    """
    Métriques Prometheus
    Includes production metrics from Phase 2 if available
    """
    if CORE_MODULES_AVAILABLE:
        try:
            from app.core.metrics import get_metrics
            return Response(content=get_metrics(), media_type="text/plain")
        except Exception as e:
            logger.warning(f"Error getting production metrics: {e}")

    # Fallback to basic metrics
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
# ROUTES - RÉGRESSION SYMBOLIQUE (TEMPORAIREMENT DÉSACTIVÉES - PySR)
# ============================================

# TEMPORAIRE: Routes PySR désactivées (Julia installation longue au démarrage)
# Décommenter après installation de Julia avec: juliaup install 1.10.0

# @app.post("/api/ml/discover-formula/{genetique}")
# async def discover_formula(genetique: str, max_iterations: int = 50):
#     """
#     Lance la découverte de formule symbolique pour une génétique
#     """
#     engine = get_symbolic_engine(db_pool)
#
#     try:
#         result = await engine.discover_formula_poids(genetique, max_iterations)
#         return result
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))


# @app.get("/api/ml/predict-doses/{canard_id}")
# async def predict_optimal_doses(canard_id: int):
#     """
#     Calcule les doses optimales pour un canard
#     """
#     engine = get_symbolic_engine(db_pool)
#
#     # Récupérer infos canard
#     query = """
#     SELECT
#         c.genetique,
#         COALESCE((SELECT poids_soir FROM gavage_data WHERE canard_id = c.id ORDER BY time DESC LIMIT 1), c.poids_initial) as poids_actuel,
#         c.poids_initial + 800 as poids_cible,
#         14 - EXTRACT(EPOCH FROM (NOW() - c.created_at))/86400 as jours_restants
#     FROM canards c
#     WHERE c.id = $1
#     """
#
#     async with db_pool.acquire() as conn:
#         canard_info = await conn.fetchrow(query, canard_id)
#
#     if not canard_info:
#         raise HTTPException(status_code=404, detail="Canard non trouvé")
#
#     try:
#         result = await engine.calculate_optimal_doses(
#             canard_id=canard_id,
#             genetique=canard_info["genetique"],
#             poids_actuel=canard_info["poids_actuel"],
#             poids_cible=canard_info["poids_cible"],
#             jours_restants=int(canard_info["jours_restants"]),
#             temperature=20.0,
#             humidite=60.0,
#             humidite_mais=14.0
#         )
#         return result
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))


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


@app.get("/api/blockchain/lot/{lot_id}/history")
async def get_lot_blockchain_history(lot_id: int):
    """
    Historique blockchain complet d'un lot de gavage

    Retourne tous les événements blockchain liés à ce lot via consumer_products
    """
    try:
        async with db_pool.acquire() as conn:
            # Récupérer tous les produits liés à ce lot
            products = await conn.fetch(
                """
                SELECT
                    product_id,
                    qr_code,
                    production_date,
                    sqal_grade,
                    blockchain_hash,
                    blockchain_verified
                FROM consumer_products
                WHERE lot_id = $1
                ORDER BY created_at DESC
                """,
                lot_id
            )

            if not products:
                return {
                    "lot_id": lot_id,
                    "blockchain_enabled": False,
                    "message": "Aucun produit blockchain trouvé pour ce lot"
                }

            # Récupérer les événements blockchain pour tous les produits de ce lot
            all_events = []
            for product in products:
                if product["blockchain_hash"]:
                    events = await conn.fetch(
                        """
                        SELECT
                            index,
                            timestamp,
                            type_evenement,
                            donnees,
                            hash_actuel
                        FROM blockchain
                        WHERE donnees::jsonb @> $1::jsonb
                        ORDER BY index ASC
                        """,
                        f'{{"product_id": "{product["product_id"]}"}}'
                    )

                    for event in events:
                        all_events.append({
                            "index": event["index"],
                            "timestamp": event["timestamp"].isoformat(),
                            "type": event["type_evenement"],
                            "data": event["donnees"],
                            "hash": event["hash_actuel"],
                            "product_id": product["product_id"],
                            "qr_code": product["qr_code"]
                        })

            return {
                "lot_id": lot_id,
                "blockchain_enabled": True,
                "total_products": len(products),
                "total_events": len(all_events),
                "products": [
                    {
                        "product_id": p["product_id"],
                        "qr_code": p["qr_code"],
                        "production_date": p["production_date"].isoformat() if p["production_date"] else None,
                        "sqal_grade": p["sqal_grade"],
                        "blockchain_verified": p["blockchain_verified"]
                    }
                    for p in products
                ],
                "events": sorted(all_events, key=lambda x: x["timestamp"], reverse=True)
            }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/blockchain/lot/{lot_id}/certificat")
async def get_lot_certificat_tracabilite(lot_id: int):
    """
    Certificat de traçabilité pour un lot complet

    Génère un certificat agrégé pour tous les produits d'un lot
    """
    try:
        async with db_pool.acquire() as conn:
            # Récupérer infos du lot
            lot = await conn.fetchrow(
                """
                SELECT
                    id,
                    code_lot,
                    site_code,
                    race,
                    nombre_canards,
                    date_debut_gavage,
                    date_fin_gavage,
                    statut
                FROM lots_gavage
                WHERE id = $1
                """,
                lot_id
            )

            if not lot:
                raise HTTPException(status_code=404, detail="Lot non trouvé")

            # Récupérer produits blockchain du lot
            products = await conn.fetch(
                """
                SELECT
                    product_id,
                    qr_code,
                    production_date,
                    sqal_quality_score,
                    sqal_grade,
                    lot_itm,
                    lot_avg_weight,
                    gavage_duration_days,
                    certifications,
                    blockchain_hash,
                    blockchain_verified
                FROM consumer_products
                WHERE lot_id = $1 AND blockchain_verified = TRUE
                ORDER BY created_at DESC
                """,
                lot_id
            )

            # Calculer statistiques qualité
            total_products = len(products)
            avg_quality_score = sum(p["sqal_quality_score"] or 0 for p in products) / max(total_products, 1)
            grade_distribution = {}
            for p in products:
                grade = p["sqal_grade"] or "UNKNOWN"
                grade_distribution[grade] = grade_distribution.get(grade, 0) + 1

            return {
                "lot_id": lot_id,
                "code_lot": lot["code_lot"],
                "site_code": lot["site_code"],
                "race": lot["race"],
                "nombre_canards": lot["nombre_canards"],
                "periode_gavage": {
                    "debut": lot["date_debut_gavage"].isoformat() if lot["date_debut_gavage"] else None,
                    "fin": lot["date_fin_gavage"].isoformat() if lot["date_fin_gavage"] else None,
                    "duree_jours": lot["gavage_duration_days"] if "gavage_duration_days" in lot else None
                },
                "statut": lot["statut"],
                "blockchain": {
                    "total_products_verified": total_products,
                    "avg_quality_score": round(avg_quality_score, 4),
                    "grade_distribution": grade_distribution,
                    "products": [
                        {
                            "product_id": p["product_id"],
                            "qr_code": p["qr_code"],
                            "grade": p["sqal_grade"],
                            "quality_score": float(p["sqal_quality_score"]) if p["sqal_quality_score"] else 0,
                            "blockchain_hash": p["blockchain_hash"]
                        }
                        for p in products[:10]  # Limit to first 10
                    ]
                },
                "message": f"Certificat blockchain pour {total_products} produits du lot {lot['code_lot']}"
            }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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

    # Return raw data as dicts (alertes table has no 'id' column, composite PK time+canard_id)
    return [dict(r) for r in records]


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


# ============================================
# WEBSOCKET ENDPOINTS - SQAL
# ============================================

@app.websocket("/ws/sensors/")
async def websocket_sensors_endpoint(websocket: WebSocket):
    """
    WebSocket pour réception données simulateur SQAL
    Flux: Simulateur → Backend
    """
    from app.websocket.sensors_consumer import sensors_consumer

    await sensors_consumer.connect(websocket)
    try:
        await sensors_consumer.receive_sensor_data(websocket)
    except Exception as e:
        logger.error(f"Erreur WebSocket sensors: {e}")
        sensors_consumer.disconnect(websocket)


@app.websocket("/ws/realtime/")
async def websocket_realtime_endpoint(websocket: WebSocket):
    """
    WebSocket pour broadcast temps réel vers dashboards SQAL
    Flux: Backend → Dashboards
    """
    logger.info("🔌 Tentative de connexion WebSocket /ws/realtime/")
    from app.websocket.realtime_broadcaster import realtime_broadcaster

    # Optionnel: récupérer infos client depuis query params
    client_info = {
        "client_type": "dashboard",
        "timestamp": datetime.utcnow().isoformat()
    }

    await realtime_broadcaster.connect(websocket, client_info)
    logger.info("✅ Dashboard connecté à /ws/realtime/")
    try:
        await realtime_broadcaster.listen(websocket)
    except Exception as e:
        logger.error(f"Erreur WebSocket realtime: {e}")
        realtime_broadcaster.disconnect(websocket)


# ============================================
# WEBSOCKET ENDPOINTS - GAVAGE TEMPS RÉEL
# ============================================

@app.websocket("/ws/gavage")
async def websocket_gavage_endpoint(websocket: WebSocket):
    """
    WebSocket pour réception données simulateur Gavage Temps Réel
    Flux: Simulateur → Backend → Frontends (gaveurs + euralis) + TimescaleDB
    """
    from app.websocket.gavage_consumer import gavage_consumer

    logger.info("🔌 Simulateur gavage attempting to connect...")

    # Initialiser le pool DB si pas encore fait
    if not gavage_consumer.db_pool and db_pool:
        gavage_consumer.set_db_pool(db_pool)

    await gavage_consumer.connect(websocket)
    logger.info("✅ Simulateur gavage WebSocket connected successfully")

    try:
        await gavage_consumer.receive_gavage_data(websocket)
    except Exception as e:
        logger.error(f"Erreur WebSocket gavage: {e}")
        gavage_consumer.disconnect(websocket)


@app.websocket("/ws/notifications/")
async def websocket_notifications_endpoint(websocket: WebSocket):
    """
    WebSocket pour notifications temps réel Euralis Dashboard
    Flux: Backend → Frontend Euralis (superviseurs)

    TEMPORAIRE: Stub retournant des notifications vides
    TODO: Implémenter système de notifications réelles connecté aux alertes
    """
    await websocket.accept()
    logger.info("✅ WebSocket notifications connection established")

    try:
        # Envoyer notification initiale vide
        await websocket.send_json({
            "type": "init",
            "notifications": [],
            "unread_count": 0,
            "timestamp": datetime.now().isoformat()
        })

        # Garder la connexion ouverte et envoyer pings périodiques
        while True:
            try:
                # Attendre message du client avec timeout 30s
                data = await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=30.0
                )
                # Echo pour montrer que la connexion est active
                await websocket.send_json({
                    "type": "pong",
                    "timestamp": datetime.now().isoformat()
                })
            except asyncio.TimeoutError:
                # Envoyer ping si pas de message pendant 30s
                await websocket.send_json({
                    "type": "ping",
                    "timestamp": datetime.now().isoformat()
                })

    except WebSocketDisconnect:
        logger.info("❌ WebSocket notifications connection closed")
    except Exception as e:
        logger.error(f"❌ WebSocket notifications error: {e}")
        try:
            await websocket.close()
        except:
            pass


@app.websocket("/ws/gaveur/{gaveur_id}")
async def websocket_gaveur_endpoint(websocket: WebSocket, gaveur_id: int):
    """
    WebSocket pour un gaveur individuel
    Flux: Backend → Frontend gaveur spécifique
    Envoie les données de gavage en temps réel pour ce gaveur uniquement
    """
    from app.websocket.gavage_consumer import gavage_consumer

    # Initialiser le pool DB si pas encore fait
    if not gavage_consumer.db_pool and db_pool:
        gavage_consumer.set_db_pool(db_pool)

    await websocket.accept()
    logger.info(f"✅ WebSocket connection established for gaveur {gaveur_id}")

    try:
        # Ajouter ce websocket à la liste des clients pour ce gaveur
        # Note: Ne pas appeler connect() car on a déjà fait accept()
        gavage_consumer.active_connections.add(websocket)

        # Garder la connexion ouverte et envoyer des pings périodiques
        while True:
            try:
                # Attendre un message du client avec un timeout de 30 secondes
                data = await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=30.0
                )
                logger.debug(f"Received from gaveur {gaveur_id}: {data}")
            except asyncio.TimeoutError:
                # Envoyer un ping pour maintenir la connexion active
                try:
                    await websocket.send_json({
                        "type": "ping",
                        "timestamp": datetime.utcnow().isoformat()
                    })
                except Exception:
                    # La connexion est fermée
                    break
            except WebSocketDisconnect:
                logger.info(f"WebSocket disconnected normally for gaveur {gaveur_id}")
                break
            except Exception as e:
                logger.info(f"WebSocket closed for gaveur {gaveur_id}: {e}")
                break

    except Exception as e:
        logger.error(f"Erreur WebSocket gaveur {gaveur_id}: {e}")
    finally:
        gavage_consumer.disconnect(websocket)
        logger.info(f"🔴 WebSocket disconnected for gaveur {gaveur_id}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
