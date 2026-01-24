# Corrections WebSocket - Synthèse Complète

**Date**: 27 décembre 2025
**Système**: Gaveurs V3.0 - Boucle fermée avec feedback consommateurs

---

## ✅ Problèmes Résolus

### 1. WebSocket 1006 - Frontend Gaveur (RÉSOLU)

**Symptôme**:
```
❌ Erreur WebSocket: Event {type: 'error'...}
🔌 WebSocket fermé: 1006
🔄 Reconnexion dans 5000ms
```

**Cause Racine**:
Le React Strict Mode en développement (Next.js) montait/démontait le composant `WebSocketProvider`, déclenchant le cleanup du `useEffect` qui fermait la connexion WebSocket toutes les 5 secondes.

**Fichier**: [gaveurs-v3/gaveurs-ai-blockchain/frontend/context/WebSocketContext.tsx:101](../gaveurs-v3/gaveurs-ai-blockchain/frontend/context/WebSocketContext.tsx#L101)

**Correction**:
```diff
  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
-  }, [connect]);
+    // eslint-disable-next-line react-hooks/exhaustive-deps
+  }, []);
```

**Impact**:
- ✅ WebSocket reste connecté en permanence
- ✅ Pas de reconnexion intempestive
- ✅ Messages ping/pong toutes les 30s maintiennent la connexion

**Vérification**:
```bash
# Surveiller les logs backend
docker-compose logs -f backend | grep "gaveur 1"

# Devrait voir:
# ✅ WebSocket connection established for gaveur 1
# (Et PAS de message de déconnexion après)
```

---

### 2. Double Accept WebSocket (RÉSOLU)

**Symptôme**: Erreur `RuntimeError: websocket.accept() already called`

**Cause**: Le endpoint `/ws/gaveur/{gaveur_id}` appelait `websocket.accept()` (ligne 948) puis `gavage_consumer.connect(websocket)` qui appelait également `accept()`.

**Fichier**: [backend-api/app/main.py:950](../backend-api/app/main.py#L950)

**Correction**:
```diff
  await websocket.accept()
  logger.info(f"✅ WebSocket connection established for gaveur {gaveur_id}")

  try:
-     gavage_consumer.connect(websocket)
+     gavage_consumer.active_connections.add(websocket)
```

---

### 3. WebSocket Timeout - Broadcast Realtime (RÉSOLU)

**Symptôme**: Connexion `/ws/realtime/` se fermait après inactivité

**Cause**: Méthode `listen()` attendait indéfiniment sans timeout, causant fermeture par proxy/navigateur

**Fichier**: [backend-api/app/websocket/realtime_broadcaster.py:70-107](../backend-api/app/websocket/realtime_broadcaster.py#L70-L107)

**Correction**: Ajout timeout 30s + ping messages
```python
async def listen(self, websocket: WebSocket):
    try:
        while True:
            try:
                data = await asyncio.wait_for(
                    websocket.receive_json(),
                    timeout=30.0
                )
                await self._handle_dashboard_message(websocket, data)
            except asyncio.TimeoutError:
                try:
                    await websocket.send_json({
                        "type": "ping",
                        "timestamp": datetime.utcnow().isoformat()
                    })
                except Exception:
                    break
    except WebSocketDisconnect:
        self.disconnect(websocket)
```

---

### 4. Erreurs Base de Données - Simulateur Gavage (RÉSOLU)

#### 4.1 Colonne 'site' inexistante
**Erreur**: `column "site" of relation "lots_gavage" does not exist`

**Correction**: [gavage_consumer.py:203](../backend-api/app/websocket/gavage_consumer.py#L203)
```python
# Utiliser site_code au lieu de site
site_code,  # Colonne correcte
```

#### 4.2 Contrainte debut_lot
**Erreur**: `Column debut_lot is NOT NULL but has no value`

**Correction**: Ajout de `CURRENT_DATE` dans l'INSERT
```sql
debut_lot,  -- Ajouté
...
CURRENT_DATE,  -- Valeur pour debut_lot
```

#### 4.3 Foreign Key gaveur_id
**Erreur**: `Key (gaveur_id)=(1) is not present in table "gaveurs_euralis"`

**Correction**: Création de 5 gaveurs de test
```sql
INSERT INTO gaveurs_euralis (id, nom, site_code, email) VALUES
(1, 'Jean Martin', 'LL', 'jean.martin@gaveur.fr'),
(2, 'Sophie Dubois', 'LS', 'sophie.dubois@gaveur.fr'),
(3, 'Pierre Leroy', 'MT', 'pierre.leroy@gaveur.fr'),
(4, 'Marie Petit', 'LL', 'marie.petit@gaveur.fr'),
(5, 'Luc Blanc', 'LS', 'luc.blanc@gaveur.fr');
```

---

## 🔄 Flux WebSocket Fonctionnels

### Architecture WebSocket Complète

```
┌─────────────────────────────────────────────────────────────┐
│                   FLUX DONNÉES TEMPS RÉEL                   │
└─────────────────────────────────────────────────────────────┘

1. SIMULATEUR → BACKEND (Gavage Data)
   ws://backend:8000/ws/gavage
   ├─ Simulateur gavage_realtime (×1440 accélération)
   ├─ Envoie données gavage toutes les 30s (1 jour = 60s)
   └─ 3 lots actifs: MT2512001, MT2512002, LS2512003

2. BACKEND → TIMESCALEDB
   ├─ Insertion dans lots_gavage (hypertable)
   ├─ UPSERT sur code_lot
   └─ Données persistées avec timestamps

3. BACKEND → FRONTENDS (Broadcast)

   A. Frontend Gaveur (port 3000)
      ws://backend:8000/ws/gaveur/1
      ├─ Données filtrées pour gaveur_id=1
      ├─ Ping toutes les 30s
      └─ Reconnexion automatique (backoff exponentiel)

   B. Frontend Euralis (port 3001)
      ws://backend:8000/ws/realtime/
      ├─ Broadcast multi-sites
      ├─ Ping toutes les 30s
      └─ Agrégation temps réel

   C. Frontend SQAL (port 5173)
      ws://backend:8000/ws/realtime/
      └─ Données qualité en temps réel
```

---

## 📊 État Actuel du Système

### Lots Actifs (Vérification)

```bash
docker exec gaveurs_timescaledb psql -U gaveurs_admin -d gaveurs_db -c \
  "SELECT code_lot, gaveur_id, jour_actuel, poids_moyen_actuel, taux_mortalite, pret_abattage
   FROM lots_gavage
   WHERE code_lot LIKE 'MT%' OR code_lot LIKE 'LS%2512003'
   ORDER BY updated_at DESC LIMIT 5;"
```

**Résultats Attendus**:
```
 code_lot  | gaveur_id | jour_actuel | poids_moyen_actuel | taux_mortalite | pret_abattage
-----------+-----------+-------------+--------------------+----------------+---------------
 MT2512001 |         3 |          5+ |           4900-6000|          2-5%  | f
 MT2512002 |         3 |          5+ |           5600-6200|          0-2%  | f
 LS2512003 |         2 |          5+ |           5100-5800|          1-3%  | f
```

### Connexions WebSocket Actives

```bash
# Surveiller les connexions
docker-compose logs -f backend | grep -E "WebSocket|gaveur|Simulateur"
```

**Logs Attendus**:
```
✅ Simulateur gavage WebSocket connected successfully  (×3 toutes les 30s)
✅ WebSocket connection established for gaveur 1
📤 Envoyé: Lot MT2512001 J5 matin
```

---

## ⚠️ Problèmes Restants

### 1. Endpoint Manquant - GET /api/gavage/gaveur/{gaveur_id}

**Erreur**: `404 Not Found`

**URL**: `http://localhost:8000/api/gavage/gaveur/1?limit=10`

**Impact**: Frontend gaveur ne peut pas récupérer l'historique des gavages

**Action Requise**: Créer l'endpoint dans `backend-api/app/routers/`

```python
@router.get("/gavage/gaveur/{gaveur_id}")
async def get_gavages_by_gaveur(
    gaveur_id: int,
    limit: int = 10
):
    # Requête SQL pour récupérer les derniers gavages
    # depuis gavage_data hypertable
```

---

### 2. Erreur SQL - GET /api/analytics/weekly-report/{gaveur_id}

**Erreur**: `500 Internal Server Error`

```
asyncpg.exceptions._base.InterfaceError:
the server expects 1 argument for this query, 0 were passed
HINT: Check the query against the passed list of arguments.
```

**Fichier**: [backend-api/app/ml/analytics_engine.py:429](../backend-api/app/ml/analytics_engine.py#L429)

**Ligne**: `stats = await conn.fetchrow(query_stats)`

**Cause**: Requête SQL avec placeholder `$1` mais aucun argument passé

**Action Requise**: Vérifier et corriger la requête SQL dans `analytics_engine.py`

```python
# AVANT (probablement):
stats = await conn.fetchrow(query_stats)

# APRÈS:
stats = await conn.fetchrow(query_stats, gaveur_id)
```

---

## 📋 Configuration Ports

**IMPORTANT**: Les ports Docker sont inversés par rapport à la documentation originale

| Service | Port | URL | Rôle |
|---------|------|-----|------|
| **Frontend Gaveurs** | **3000** | http://localhost:3000 | Interface gaveur individuel |
| **Frontend Euralis** | **3001** | http://localhost:3001 | Dashboard supervision multi-sites |
| **Frontend SQAL** | **5173** | http://localhost:5173 | Contrôle qualité IoT |
| **Backend API** | **8000** | http://localhost:8000 | API FastAPI + WebSockets |
| **TimescaleDB** | **5432** | localhost:5432 | Base de données time-series |
| **Control Panel** | **8889** | http://localhost:8889 | Contrôle Docker simulateurs |

---

## 🧪 Tests de Validation

### Test 1: Stabilité WebSocket Frontend Gaveur

1. Ouvrir http://localhost:3000
2. Ouvrir Console (F12)
3. Vérifier logs:
   ```
   ✅ WebSocket connecté
   ```
4. Attendre 2-3 minutes
5. Vérifier: PAS de messages de reconnexion
6. Vérifier: Messages ping toutes les 30s

**Résultat Attendu**: Connexion stable sans erreur 1006

---

### Test 2: Réception Données Temps Réel

1. Surveiller backend:
   ```bash
   docker-compose logs -f backend | grep "📤 Envoyé"
   ```

2. Observer simulateur:
   ```bash
   docker-compose logs -f simulator-gavage-realtime | grep "📊"
   ```

3. Vérifier base de données:
   ```bash
   watch -n 5 'docker exec gaveurs_timescaledb psql -U gaveurs_admin -d gaveurs_db -c "SELECT code_lot, jour_actuel, poids_moyen_actuel FROM lots_gavage WHERE code_lot LIKE '\''MT%'\'' ORDER BY updated_at DESC LIMIT 3;"'
   ```

**Résultat Attendu**:
- Données mises à jour toutes les 30s
- Poids augmente progressivement
- Jour avance (1 jour toutes les 60s)

---

### Test 3: Broadcast Multi-Frontend

1. Ouvrir simultanément:
   - Frontend Gaveur: http://localhost:3000
   - Frontend Euralis: http://localhost:3001

2. Vérifier backend logs:
   ```bash
   docker-compose logs backend | grep -E "WebSocket connection established"
   ```

3. Vérifier que les deux reçoivent des données

**Résultat Attendu**: 2 connexions actives sans interférence

---

## 🔧 Dépannage

### WebSocket se déconnecte encore

**Vérifier**:
1. Fichier `WebSocketContext.tsx` modifié avec `}, []);`
2. Frontend rechargé (Ctrl+F5 hard refresh)
3. Pas de proxy/antivirus bloquant WebSocket
4. Backend logs montrent connexion établie

**Commandes Debug**:
```bash
# Vérifier connexions WebSocket
docker-compose logs backend | grep "WebSocket"

# Tester endpoint WebSocket manuellement
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  http://localhost:8000/ws/gaveur/1
# Devrait retourner: 101 Switching Protocols
```

---

### Simulateur ne se connecte pas

**Vérifier**:
```bash
# Logs simulateur
docker-compose logs simulator-gavage-realtime --tail=50

# Status container
docker-compose ps simulator-gavage-realtime

# Vérifier variable d'environnement
docker exec gaveurs_simulator_gavage_realtime env | grep BACKEND
```

---

### Données ne s'affichent pas dans frontend

**Causes possibles**:
1. ✅ WebSocket connecté mais pas de broadcast
2. ✅ Endpoint `/api/gavage/gaveur/{id}` retourne 404
3. ✅ Erreur 500 sur `/api/analytics/weekly-report`

**Actions**:
- Corriger endpoint manquant (voir section "Problèmes Restants #1")
- Corriger erreur SQL (voir section "Problèmes Restants #2")

---

## 📚 Références

- [ARCHITECTURE_UNIFIEE.md](./ARCHITECTURE_UNIFIEE.md) - Architecture globale
- [INTEGRATION_SQAL_COMPLETE.md](./INTEGRATION_SQAL_COMPLETE.md) - Intégration SQAL
- [SQAL_WEBSOCKET_DATA_FLOW.md](./SQAL_WEBSOCKET_DATA_FLOW.md) - Flux WebSocket détaillé
- [SYSTEME_COMPLET_BOUCLE_FERMEE.md](./SYSTEME_COMPLET_BOUCLE_FERMEE.md) - Boucle feedback complète

---

## ✅ Checklist de Validation Complète

- [x] WebSocket frontend gaveur stable (pas de 1006)
- [x] Simulateur gavage_realtime connecté et envoie données
- [x] Données persistées dans TimescaleDB
- [x] Backend logs montrent connexions actives
- [x] Ping/pong messages toutes les 30s
- [ ] Endpoint `/api/gavage/gaveur/{id}` créé
- [ ] Erreur SQL `weekly-report` corrigée
- [ ] Frontend affiche données temps réel
- [ ] Test stabilité 24h

---

**Dernière mise à jour**: 27 décembre 2025, 08:00 UTC
**Statut Global**: ✅ WebSocket Stable | ⚠️ 2 endpoints à corriger
