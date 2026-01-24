# Configuration Redis pour Gaveurs Backend

## 📋 Vue d'ensemble

Redis a été ajouté au projet comme service de cache pour améliorer les performances du backend. Il est configuré dans `docker-compose.yml` et démarre automatiquement avec les autres services.

## 🚀 Configuration Docker Compose

### Service Redis

```yaml
redis:
  image: redis:7-alpine
  container_name: gaveurs_redis
  restart: unless-stopped
  ports:
    - "6379:6379"
  volumes:
    - redis_data:/data
  networks:
    - gaveurs_network
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 10s
    timeout: 5s
    retries: 5
  command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
```

### Configuration optimisée

- **Image**: `redis:7-alpine` - Version légère de Redis 7
- **Persistance**: AOF (Append Only File) activé pour la durabilité des données
- **Mémoire**: Limite de 256 MB avec politique d'éviction LRU (Least Recently Used)
- **Health check**: Vérification automatique toutes les 10s

## 🔧 Variables d'environnement Backend

Le backend utilise ces variables pour se connecter à Redis:

```bash
REDIS_HOST=redis          # Nom du service Docker
REDIS_PORT=6379           # Port standard Redis
REDIS_URL=redis://redis:6379  # URL complète
```

## 📊 Utilisation dans le Backend

### Modules qui utilisent Redis

1. **Cache Manager** (`backend-api/app/core/cache.py`)
   - Cache des échantillons récents (TTL: 10s)
   - Cache des métriques dashboard (TTL: 5min)
   - Cache des statistiques devices (TTL: 15min)
   - Cache des agrégats horaires (TTL: 10min)

2. **Rate Limiter** (`backend-api/app/core/rate_limiter.py`)
   - Limitation WebSocket: 100 req/60s
   - Token bucket algorithm

### Stratégie de TTL (Time To Live)

| Type de données | TTL | Raison |
|----------------|-----|---------|
| Latest sample | 10s | Données ultra-récentes, mise à jour fréquente |
| Dashboard metrics | 5min | Équilibre fraîcheur/performance |
| Device stats | 15min | Données relativement stables |
| Hourly aggregates | 10min | Agrégats pré-calculés |

## 🧪 Tests

### Test 1: Connexion Redis

```bash
# Linux/Mac
./scripts/test_redis.sh

# Windows
scripts\test_redis.bat

# Manuel avec Docker
docker exec gaveurs_redis redis-cli ping
# Devrait retourner: PONG
```

### Test 2: Vérifier la version

```bash
docker exec gaveurs_redis redis-cli INFO server | grep redis_version
# Devrait afficher: redis_version:7.4.7
```

### Test 3: Tester SET/GET

```bash
docker exec gaveurs_redis redis-cli SET test_key "Hello"
docker exec gaveurs_redis redis-cli GET test_key
# Devrait retourner: "Hello"

docker exec gaveurs_redis redis-cli DEL test_key
```

## 📈 Monitoring Redis

### Métriques disponibles

```bash
# Statistiques générales
docker exec gaveurs_redis redis-cli INFO stats

# Utilisation mémoire
docker exec gaveurs_redis redis-cli INFO memory

# Clients connectés
docker exec gaveurs_redis redis-cli INFO clients

# Keyspace (nombre de clés)
docker exec gaveurs_redis redis-cli INFO keyspace
```

### Commandes utiles

```bash
# Voir toutes les clés
docker exec gaveurs_redis redis-cli KEYS '*'

# Compter les clés
docker exec gaveurs_redis redis-cli DBSIZE

# Vérifier le TTL d'une clé
docker exec gaveurs_redis redis-cli TTL <key_name>

# Vider le cache (ATTENTION: supprime tout)
docker exec gaveurs_redis redis-cli FLUSHDB
```

## 🔒 Sécurité

### Configuration actuelle (Développement)

- **Pas d'authentification** - Redis accessible sans mot de passe
- **Binding**: 0.0.0.0 (toutes les interfaces)
- **Réseau**: Isolé dans `gaveurs_network`

### Recommandations Production

1. **Activer l'authentification**:
   ```yaml
   command: redis-server --requirepass YOUR_STRONG_PASSWORD --appendonly yes
   ```

2. **Variables d'environnement**:
   ```bash
   REDIS_PASSWORD=your_secure_password
   REDIS_URL=redis://:your_secure_password@redis:6379
   ```

3. **Binding restrictif**:
   ```yaml
   command: redis-server --bind 127.0.0.1 --requirepass PASSWORD
   ```

4. **TLS/SSL** (optionnel):
   - Configurer Redis avec support TLS
   - Utiliser `rediss://` dans l'URL

## 🐛 Dépannage

### Problème: Redis ne démarre pas

```bash
# Vérifier les logs
docker-compose logs redis

# Vérifier le statut
docker-compose ps redis

# Redémarrer
docker-compose restart redis
```

### Problème: Backend ne peut pas se connecter

```bash
# Vérifier que Redis est sur le même réseau
docker network inspect gaveurs_network

# Tester la connexion depuis le backend
docker exec gaveurs_backend ping redis

# Vérifier les variables d'environnement
docker exec gaveurs_backend env | grep REDIS
```

### Problème: Mémoire pleine

```bash
# Vérifier l'utilisation mémoire
docker exec gaveurs_redis redis-cli INFO memory | grep used_memory_human

# Augmenter la limite dans docker-compose.yml
command: redis-server --maxmemory 512mb --maxmemory-policy allkeys-lru

# Vider le cache si nécessaire
docker exec gaveurs_redis redis-cli FLUSHDB
```

## 📚 Documentation Redis

- [Redis Documentation](https://redis.io/docs/)
- [Redis Commands](https://redis.io/commands/)
- [Redis Best Practices](https://redis.io/docs/manual/patterns/)
- [redis-py Documentation](https://redis-py.readthedocs.io/)

## ✅ Checklist d'intégration

- [x] Service Redis ajouté à docker-compose.yml
- [x] Volume redis_data créé pour la persistance
- [x] Health check configuré
- [x] Variables d'environnement ajoutées au backend
- [x] Backend dépend de Redis (depends_on)
- [x] Scripts de test créés (test_redis.sh/bat)
- [x] Documentation .env.example mise à jour
- [x] Configuration optimisée (AOF, maxmemory, LRU)

## 🎯 Impact Performance

Avec Redis activé, les améliorations attendues:

| Métrique | Sans cache | Avec Redis | Amélioration |
|----------|-----------|------------|--------------|
| Charge DB | 100% | 30% | **-70%** |
| Latence dashboard | 200ms | 50ms | **-75%** |
| Requêtes/sec | 100 | 500+ | **+400%** |
| Cache hit rate | 0% | 85%+ | **Excellent** |

---

**✅ Redis est maintenant configuré et prêt à l'emploi avec docker-compose!**
