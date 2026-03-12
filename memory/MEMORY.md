# Projet : Système Gaveurs V3.0 — Euralis

## Localisation
- **Code** : `D:\GavAI\projet-euralis-gaveurs\`
- **NAS** : `ssh admin_jj@192.168.1.103` (ou DEEP_NAS si hosts file configuré)
  - Projet NAS : `/volume1/DevProject/euralis/projet-euralis-gaveurs/`
  - Docker binary : `/usr/local/bin/docker`

## Architecture
- **Backend** : FastAPI + Julia/PySR → `backend-api/` (Dockerfile.prod multi-stage)
- **Frontends** :
  - `gaveurs-frontend/` : Next.js 14, port interne 3000
  - `euralis-frontend/` : Next.js 14, port interne 3001
  - `frontend-traceability/` : Next.js 15, port interne **3003** (pas 3000 !)
  - `sqal/FrontEnd/` : Vite + React, port interne 80
  - `control-panel-frontend/` : Vite + React, port interne 80
- **Celery** : Worker + Beat + Flower → même image que backend (Dockerfile.prod)
- **DB** : TimescaleDB (port 5436 sur NAS, 5432 interne Docker)
- **Broker** : Redis (port 6380 sur NAS, 6379 interne Docker)

## Ports NAS (192.168.1.103)
| App | Port hôte | Note |
|-----|-----------|------|
| Gaveurs | **8088** | 8081 occupé par Squid/ProxyServer DSM |
| Euralis | 8082 | |
| Traçabilité | 8083 | |
| SQAL | 8084 | |
| Control Panel | 8085 | |
| Flower | 5556 | → port interne 5555 |
| TimescaleDB | 5436 | → port interne 5432 |
| Redis | 6380 | → port interne 6379 |

## ⚠️ Problèmes NAS résolus (Mars 2026)

### 1. SIGILL sur Celeron J4025 (pas d'AVX)
**Cause** : TensorFlow 2.18 + PyTorch 2.5 compilés avec AVX → crash immédiat des workers gunicorn.
**Fix** :
- `PYSR_USE_NUMPY: "true"` sur backend, celery-worker, celery-beat (évite Julia)
- `OPENBLAS_CORETYPE: "CORE2"` (force SSE2, pas AVX pour BLAS)
- `JULIA_CPU_TARGET: "generic"` (sécurité supplémentaire)
- `backend-api/gunicorn.nas.conf.py` : stub modules qui neutralisent TF/PyTorch dans `sys.modules` avant import. Monté en volume `:ro` dans le container backend.

### 2. Gunicorn `--keepalive` vs `--keep-alive`
**Fix** : `backend-api/Dockerfile.prod` et `docker-compose.euralis.nas.yml` → `--keep-alive`

### 3. Healthchecks cassés
- **Backend** : `pgrep` absent → `curl -sf http://127.0.0.1:8000/health`
- **Frontends Next.js** (node:18-alpine) : `curl` absent → `wget -qO /dev/null http://127.0.0.1:PORT`
- **frontend-traceability** : port 3000 → **3003** (Dockerfile expose 3003)
- **celery-worker/beat** : `healthcheck: disable: true` (pas de HTTP server sur port 8000)
- **flower** : `curl http://127.0.0.1:5555/healthcheck`

### 4. Port 8081 = Squid (Synology ProxyServer)
**Fix** : Gaveurs basculé sur 8088. Rebuild `frontend-gaveurs` avec `NEXT_PUBLIC_API_URL=http://DEEP_NAS:8088`.

### 5. public/ directories manquants
`gaveurs-frontend/public/.gitkeep` et `frontend-traceability/public/.gitkeep` créés.

### 6. nginx upstream traceability
`nginx.nas.conf` : `server frontend-traceability:3000` → `server frontend-traceability:3003`

## Commandes NAS utiles
```bash
# Status
ssh admin_jj@192.168.1.103 "/usr/local/bin/docker ps --format 'table {{.Names}}\t{{.Status}}' | grep euralis"

# Logs backend
ssh admin_jj@192.168.1.103 "/usr/local/bin/docker logs euralis_backend --tail 30"

# Up/Down stack complète
COMPOSE="ssh admin_jj@192.168.1.103 /usr/local/bin/docker compose -f /volume1/DevProject/euralis/projet-euralis-gaveurs/docker-compose.euralis.nas.yml --env-file /volume1/DevProject/euralis/projet-euralis-gaveurs/.env.euralis.nas"
$COMPOSE up --no-build -d
$COMPOSE down

# Transférer un fichier vers NAS
cat fichier_local | ssh admin_jj@192.168.1.103 "cat > /volume1/DevProject/euralis/projet-euralis-gaveurs/chemin/fichier"

# Rebuild un frontend sur NAS (ex: après changement de port)
ssh admin_jj@192.168.1.103 "/usr/local/bin/docker compose -f /volume1/DevProject/euralis/... build frontend-gaveurs"
```

## Déploiement NAS — workflow
1. Modifier les fichiers localement
2. `git add ... && git commit`
3. Transférer les fichiers modifiés via SSH cat (plus rapide que git push/pull pour fichiers de config)
4. Sur NAS : `docker compose up --no-build -d [service]` pour recreate sans rebuild
5. Si rebuild nécessaire (changement code/ARG) : `docker compose build [service]` sur NAS

## TypeScript — Erreurs corrigées (Mars 2026)

### euralis-frontend
- `sites/[code]/page.tsx` : optional chaining `stats.itm_moyen?.toFixed(2) ?? 'N/A'` etc.
- `filters.ts:91` : `(aVal as unknown) instanceof Date`
- `RealtimeSitesMonitor.tsx` : type explicit `Map<string, SiteStats>`
- `RealtimeSitesMonitor.test.tsx` : non-null assertion `mockWsInstance!`
- `tests/e2e/helpers/auth.ts` : `maxAge` → `expires: Math.floor(Date.now()/1000) + 3600`

### gaveurs-frontend
- `gavage/page.tsx` : `lot.date_debut_gavage ?? ''`
- `stats/page.tsx` : `lot.souche` → `lot.genetique`, `lot.site_id` → `lot.site_code`, etc.
- `NetworkGraphCorrelations.tsx` : `function dragstarted(this: Element, event: any)`
- `TreemapRepartition.tsx` : `HierarchyNode` → `HierarchyRectangularNode` via `treemapLayout(root)`
- `ViolinPlotDistributions.tsx` : `.datum(density as unknown as [number, number][])`
- `LotSelector.tsx` : `planifie` ajouté aux Records label/color + cast `as StatutLot`
- `AuthContext.tsx` : `(data as any).user_info?.gaveur_id`

## Branches git
- **dev** : branche de travail NAS (tous les fixes ci-dessus)
- **main** : branche principale

## Fichiers clés NAS-spécifiques
- `docker-compose.euralis.nas.yml` : stack complète NAS
- `docker/nginx/nginx.nas.conf` : reverse proxy multi-ports
- `backend-api/gunicorn.nas.conf.py` : stub TF/PyTorch pour J4025 (no AVX)
- `.env.euralis.nas` : variables d'env NAS (non commité, sur NAS uniquement)
  - `NAS_IP=DEEP_NAS` (ou 192.168.1.103)

## Auth
- `DISABLE_AUTH: "true"` en démo NAS → pas besoin de Keycloak
- Keycloak disponible via `--profile auth` si besoin (port 8090)

## État final stack NAS (Mars 2026)
Tous les containers **healthy** :
- euralis_nginx, euralis_backend, euralis_timescaledb, euralis_redis ✅
- euralis_frontend_gaveurs/euralis/traceability/sqal, euralis_control_panel ✅
- euralis_flower ✅
- euralis_celery_worker/beat : Up (healthcheck disabled intentionnellement) ✅
- euralis_simulator_consumer/sqal/gavage_realtime : Up ✅
