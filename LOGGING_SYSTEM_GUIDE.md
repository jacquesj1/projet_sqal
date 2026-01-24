# Guide du Système de Logging - Gaveurs V3.0

## 📋 Vue d'ensemble

Le backend Gaveurs V3.0 dispose d'un **système de logging professionnel** avec :
- ✅ **Rotation quotidienne** automatique des logs (un fichier par jour)
- ✅ **Séparation par module** (auth, api, websocket, database, etc.)
- ✅ **Archivage automatique** (30 jours par défaut, 90 jours pour les erreurs)
- ✅ **Format structuré** avec timestamp, niveau, module et message
- ✅ **Support request_id** pour le tracing des requêtes
- ✅ **Logs console + fichier** configurables par module

---

## 📁 Structure des fichiers de logs

Tous les logs sont dans le répertoire `logs/` :

```
logs/
├── main.log              # Application principale (uvicorn, startup/shutdown)
├── auth.log              # Authentication/authorization (JWT, Keycloak, RBAC)
├── api.log               # Requêtes API (euralis, sqal, consumer_feedback)
├── websocket.log         # Connexions WebSocket (gaveur, sensors, realtime)
├── database.log          # Queries et connexions DB (asyncpg, TimescaleDB)
├── cache.log             # Opérations Redis cache
├── ml.log                # Machine Learning (PySR, TensorFlow, PyTorch, Prophet)
├── blockchain.log        # Transactions blockchain (Hyperledger Fabric)
├── audit.log             # Audit de sécurité (événements d'auth, mutations)
├── errors.log            # Erreurs uniquement (WARNING et au-dessus)
│
├── main.log.2024-12-24   # Archive du jour précédent
├── main.log.2024-12-23   # Archive il y a 2 jours
└── ...                   # Archives jusqu'à 30 jours
```

---

## 🎯 Format des logs

### Format standard

```
TIMESTAMP | LEVEL    | MODULE                         | MESSAGE
2024-12-24 14:30:15 | INFO     | auth                           | User logged in successfully | request_id=abc123 | user=jean.martin@gaveur.fr
```

**Champs** :
- **TIMESTAMP** : Format `YYYY-MM-DD HH:MM:SS`
- **LEVEL** : DEBUG, INFO, WARNING, ERROR, CRITICAL
- **MODULE** : Nom du logger (auth, api, websocket, etc.)
- **MESSAGE** : Message de log
- **Context** : Données additionnelles (request_id, user, ip, etc.)

### Exemples de logs

**Authentication** (auth.log) :
```
2024-12-24 14:30:15 | INFO     | auth                           | AUTH_EVENT | type=TOKEN_VALIDATION | user=jean.martin@gaveur.fr | success=True | timestamp=2024-12-24T14:30:15+00:00 | details=Roles: ['gaveur']
```

**API Request** (api.log) :
```
2024-12-24 14:30:20 | INFO     | app.routers.euralis            | GET /api/euralis/sites | status=200 | duration=0.045s | request_id=xyz789
```

**WebSocket** (websocket.log) :
```
2024-12-24 14:30:25 | INFO     | websocket                      | ✅ WebSocket connection established for gaveur 1 | ip=192.168.1.100 | request_id=def456
```

**Database** (database.log) :
```
2024-12-24 14:30:30 | INFO     | database                       | Query executed | table=gavage_data | rows=150 | duration=0.023s
```

**Error** (errors.log) :
```
2024-12-24 14:30:35 | ERROR    | app.routers.sqal               | Database connection failed | error=Connection timeout | retries=3
```

---

## 🔧 Configuration

### Variables d'environnement

```bash
# Niveau de log global (DEBUG, INFO, WARNING, ERROR, CRITICAL)
LOG_LEVEL=INFO

# Niveau de log pour l'application (override LOG_LEVEL)
APP_LOG_LEVEL=DEBUG
```

### Niveaux de log par défaut

| Module | Niveau | Console | Fichier | Rotation |
|--------|--------|---------|---------|----------|
| **main** | INFO | ✅ | main.log | 30 jours |
| **auth** | INFO | ✅ | auth.log | 30 jours |
| **audit** | INFO | ❌ | audit.log | 30 jours |
| **api** | INFO | ❌ | api.log | 30 jours |
| **websocket** | INFO | ✅ | websocket.log | 30 jours |
| **database** | INFO | ❌ | database.log | 30 jours |
| **cache** | INFO | ❌ | cache.log | 30 jours |
| **ml** | INFO | ❌ | ml.log | 30 jours |
| **blockchain** | INFO | ❌ | blockchain.log | 30 jours |
| **errors** | WARNING | ✅ | errors.log | **90 jours** |

### Personnaliser les niveaux

Éditez `backend-api/app/core/logging_config.py` :

```python
# Exemple: Activer DEBUG pour l'auth
"auth": setup_logger("auth", "auth.log", "DEBUG", console=True),

# Exemple: Désactiver console pour WebSocket
"websocket": setup_logger("websocket", "websocket.log", "INFO", console=False),

# Exemple: Garder les logs ml pendant 60 jours
"ml": setup_logger("ml", "ml.log", "INFO", console=False, backup_count=60),
```

---

## 💻 Utilisation dans le code

### Importer un logger

```python
from app.core.logging_config import get_logger

logger = get_logger("auth")  # ou "api", "websocket", "database", etc.
```

### Loggers pré-configurés

```python
from app.core.logging_config import (
    main_logger,
    auth_logger,
    audit_logger,
    api_logger,
    websocket_logger,
    database_logger,
    cache_logger,
    ml_logger,
    blockchain_logger,
    error_logger
)

# Utilisation
auth_logger.info("User logged in")
websocket_logger.debug("Received message from client")
database_logger.warning("Slow query detected")
error_logger.error("Critical failure")
```

### Logging simple

```python
logger.debug("Detailed debug information")
logger.info("Informational message")
logger.warning("Warning message")
logger.error("Error occurred")
logger.critical("Critical failure")
```

### Logging avec contexte

```python
from app.core.logging_config import log_with_context

log_with_context(
    logger, "info", "User authenticated",
    request_id="abc123",
    user_id=42,
    ip="192.168.1.100",
    duration_ms=150
)
```

**Sortie** :
```
2024-12-24 14:30:15 | INFO | auth | User authenticated | request_id=abc123 | user_id=42 | ip=192.168.1.100 | duration_ms=150
```

### Logging dans les routes FastAPI

```python
from app.core.logging_config import api_logger

@router.get("/api/users")
async def get_users(request: Request):
    request_id = request.state.request_id  # Si middleware activé

    api_logger.info(
        f"GET /api/users | request_id={request_id}",
        extra={"request_id": request_id}
    )

    # ... logique métier ...

    api_logger.info(
        f"GET /api/users completed | rows=150 | duration=0.045s",
        extra={"request_id": request_id}
    )
```

### Logging dans les WebSockets

```python
from app.core.logging_config import websocket_logger

@app.websocket("/ws/gaveur/{gaveur_id}")
async def websocket_gaveur(websocket: WebSocket, gaveur_id: int):
    await websocket.accept()

    websocket_logger.info(
        f"✅ WebSocket connection established for gaveur {gaveur_id}",
        extra={"gaveur_id": gaveur_id, "ip": websocket.client.host}
    )

    try:
        # ... logique WebSocket ...
        pass
    except Exception as e:
        websocket_logger.error(
            f"WebSocket error for gaveur {gaveur_id}: {e}",
            extra={"gaveur_id": gaveur_id}
        )
    finally:
        websocket_logger.info(
            f"🔴 WebSocket disconnected for gaveur {gaveur_id}",
            extra={"gaveur_id": gaveur_id}
        )
```

### Logging dans les services

```python
from app.core.logging_config import database_logger

class GavageService:
    async def get_gavage_data(self, gaveur_id: int):
        database_logger.debug(f"Fetching gavage data for gaveur {gaveur_id}")

        try:
            rows = await self.db.fetch("SELECT * FROM gavage_data WHERE gaveur_id = $1", gaveur_id)
            database_logger.info(f"Retrieved {len(rows)} gavage records for gaveur {gaveur_id}")
            return rows
        except Exception as e:
            database_logger.error(f"Database error fetching gavage data: {e}")
            raise
```

---

## 📊 Analyse des logs

### Afficher les logs en temps réel

```bash
# Tous les logs
tail -f logs/main.log

# Auth uniquement
tail -f logs/auth.log

# Errors uniquement
tail -f logs/errors.log

# WebSocket uniquement
tail -f logs/websocket.log
```

### Rechercher dans les logs

```bash
# Chercher un utilisateur spécifique
grep "jean.martin@gaveur.fr" logs/auth.log

# Chercher les erreurs
grep "ERROR" logs/*.log

# Chercher par request_id
grep "request_id=abc123" logs/*.log

# Chercher les échecs d'authentification
grep "success=False" logs/audit.log

# Chercher les requêtes lentes (> 1 seconde)
grep "duration=[1-9]\." logs/api.log
```

### Compter les événements

```bash
# Nombre total de requêtes API aujourd'hui
grep "$(date +%Y-%m-%d)" logs/api.log | wc -l

# Nombre d'authentifications réussies
grep "AUTH_EVENT.*success=True" logs/audit.log | wc -l

# Nombre d'erreurs
grep "ERROR" logs/errors.log | wc -l

# Nombre de connexions WebSocket
grep "WebSocket connection established" logs/websocket.log | wc -l
```

### Analyser les performances

```bash
# Top 10 des requêtes les plus lentes
grep "duration=" logs/api.log | sort -t= -k2 -rn | head -10

# Requêtes par heure
grep "$(date +%Y-%m-%d)" logs/api.log | cut -d' ' -f2 | cut -d: -f1 | sort | uniq -c

# Erreurs par module
grep "ERROR" logs/*.log | cut -d: -f1 | sort | uniq -c
```

---

## 🔍 Debugging

### Activer DEBUG pour un module

```python
from app.core.logging_config import get_logger

logger = get_logger("auth")
logger.setLevel("DEBUG")
```

Ou via variable d'environnement :

```bash
# backend-api/.env
LOG_LEVEL=DEBUG
```

### Tracer une requête spécifique

Si le middleware SecurityMiddleware est activé, chaque requête reçoit un `request_id` unique :

```bash
# Trouver tous les logs pour une requête
grep "request_id=abc123" logs/*.log

# Sortie exemple:
# logs/api.log:2024-12-24 14:30:15 | INFO | api | GET /api/users | request_id=abc123
# logs/database.log:2024-12-24 14:30:16 | INFO | database | Query executed | request_id=abc123
# logs/api.log:2024-12-24 14:30:17 | INFO | api | Response sent | status=200 | request_id=abc123
```

### Logs de démarrage

Vérifier que tous les modules sont bien initialisés :

```bash
grep "✅" logs/main.log | tail -20
```

Exemple de sortie :
```
2024-12-24 14:00:00 | INFO | main | ✅ Production core modules imported successfully
2024-12-24 14:00:01 | INFO | main | ✅ Prometheus metrics initialized
2024-12-24 14:00:02 | INFO | main | ✅ Health checks initialized (K8s ready)
2024-12-24 14:00:03 | INFO | main | ✅ Graceful shutdown handler initialized
2024-12-24 14:00:04 | INFO | main | ✅ TimescaleDB connection established
2024-12-24 14:00:05 | INFO | main | ✅ Redis cache connected
2024-12-24 14:00:06 | INFO | main | ✅ Rate limiter initialized (100 req/60s)
2024-12-24 14:00:07 | INFO | main | ✅ SQAL service initialized
2024-12-24 14:00:08 | INFO | main | ✅ Consumer Feedback service initialized
2024-12-24 14:00:09 | INFO | main | ✅ GAVEURS BACKEND FULLY STARTED AND READY!
```

---

## 🗂️ Gestion des archives

### Rotation automatique

Les logs sont automatiquement archivés à **minuit chaque jour** :

```
main.log           → Logs du jour actuel
main.log.2024-12-24 → Logs d'hier
main.log.2024-12-23 → Logs d'avant-hier
...
main.log.2024-11-25 → Logs il y a 30 jours (sera supprimé demain)
```

### Modifier la durée de conservation

Dans `backend-api/app/core/logging_config.py` :

```python
# Par défaut: 30 jours
"auth": setup_logger("auth", "auth.log", "INFO", backup_count=30),

# Garder 90 jours
"auth": setup_logger("auth", "auth.log", "INFO", backup_count=90),

# Garder 7 jours seulement
"auth": setup_logger("auth", "auth.log", "INFO", backup_count=7),
```

### Archiver manuellement

```bash
# Créer une archive tar.gz des logs du mois
cd logs/
tar -czf logs-2024-12.tar.gz *.log.2024-12-*

# Supprimer les logs archivés
rm *.log.2024-12-*
```

### Sauvegarde automatique (production)

**Cron job exemple** (chaque dimanche à 2h du matin) :

```bash
0 2 * * 0 tar -czf /backup/logs-$(date +\%Y-\%m-\%d).tar.gz /app/logs/*.log.* && find /app/logs -name "*.log.*" -mtime +7 -delete
```

---

## 📈 Monitoring avec les logs

### Dashboard Grafana

Utilisez Grafana Loki pour collecter et visualiser les logs :

```yaml
# docker-compose.yml
loki:
  image: grafana/loki:latest
  ports:
    - "3100:3100"
  volumes:
    - ./loki-config.yaml:/etc/loki/local-config.yaml

promtail:
  image: grafana/promtail:latest
  volumes:
    - ./logs:/var/log/gaveurs
    - ./promtail-config.yaml:/etc/promtail/config.yaml
```

### Alertes

Configurez des alertes sur les erreurs critiques :

```bash
# Exemple: Envoyer une alerte si plus de 10 erreurs en 5 minutes
*/5 * * * * [ $(grep -c "ERROR" /app/logs/errors.log) -gt 10 ] && echo "Alert: High error rate" | mail -s "Gaveurs Alert" admin@euralis.fr
```

---

## ✅ Best Practices

### 1. Utiliser le bon niveau de log

- **DEBUG** : Informations de debug très détaillées (désactivé en production)
- **INFO** : Événements normaux (connexions, requêtes, opérations réussies)
- **WARNING** : Situations anormales mais gérées (retry, fallback, deprecated)
- **ERROR** : Erreurs qui empêchent une opération (mais l'app continue)
- **CRITICAL** : Erreurs critiques (l'app doit s'arrêter)

### 2. Inclure du contexte

❌ **Mauvais** :
```python
logger.info("User logged in")
```

✅ **Bon** :
```python
logger.info(f"User logged in | user={username} | ip={ip} | request_id={request_id}")
```

### 3. Protéger les données sensibles

❌ **Jamais logger les passwords, tokens, secrets** :
```python
logger.info(f"Login attempt | password={password}")  # ❌ DANGEREUX
```

✅ **Bon** :
```python
logger.info(f"Login attempt | username={username} | success={success}")  # ✅ OK
```

### 4. Logger les exceptions avec traceback

```python
try:
    # ... code ...
except Exception as e:
    logger.error(f"Operation failed: {e}", exc_info=True)  # ✅ Inclut le traceback
```

### 5. Utiliser des messages clairs

❌ **Mauvais** :
```python
logger.error("Error")  # ❌ Pas assez d'info
```

✅ **Bon** :
```python
logger.error(f"Database connection failed | host={db_host} | port={db_port} | error={str(e)}")  # ✅ Clair
```

---

## 🎯 Checklist de vérification

- [ ] Les logs sont créés dans `logs/`
- [ ] La rotation quotidienne fonctionne
- [ ] Les archives sont créées avec le bon format (`YYYY-MM-DD`)
- [ ] Les logs obsolètes sont supprimés après 30 jours
- [ ] Chaque module a son propre fichier de log
- [ ] Les erreurs sont loggées dans `errors.log`
- [ ] L'audit de sécurité est dans `audit.log`
- [ ] Les logs incluent timestamp, niveau et module
- [ ] Les logs sensibles ne contiennent pas de passwords/tokens
- [ ] Les logs de production sont sauvegardés

---

**✅ Système de logging configuré et opérationnel !**

Tous les logs sont maintenant centralisés dans `logs/` avec rotation quotidienne et séparation par module.
