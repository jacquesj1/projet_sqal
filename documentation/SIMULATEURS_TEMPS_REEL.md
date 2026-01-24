# Simulateurs Temps Réel - Architecture Complète

**Date**: 23 Décembre 2025
**Version**: 1.0

---

## Vue d'ensemble

Le système utilise **2 simulateurs temps réel** qui communiquent via WebSocket avec le backend pour reproduire fidèlement le processus industriel de production de foie gras, du gavage au contrôle qualité.

### Flux complet

```
┌─────────────────────────────────────────────────────────────────┐
│                     PROCESSUS INDUSTRIEL RÉEL                     │
└─────────────────────────────────────────────────────────────────┘

J-1            J0 ────────────────── J11-14         J13        J14+
│              │        GAVAGE         │            │          │
Préparation    2 repas/jour           Abattage     SQAL       Distribution
                                       │
                                       v
                          ┌───────────────────────┐
                          │  sqal_pending_lots    │
                          │   status='pending'    │
                          └───────────────────────┘
                                       │
                                       v
                          ┌───────────────────────┐
                          │   Lot Monitor SQAL    │
                          │  (polling 60s)        │
                          └───────────────────────┘
                                       │
                                       v
                          ┌───────────────────────┐
                          │   ESP32 Simulator     │
                          │  5 échantillons/lot   │
                          └───────────────────────┘
```

### Communication

```
┌──────────────────┐         WebSocket          ┌──────────────┐
│ Gavage Simulator │ ──────────────────────────> │   Backend    │
│  (simulators/)   │  /ws/gavage                 │ (backend-api)│
└──────────────────┘  JSON messages              └──────────────┘
                                                         │
                                                         │ Broadcast
                                                         v
                                         ┌───────────────────────────┐
                                         │  Frontends                │
                                         │  - gaveurs (port 3001)    │
                                         │  - euralis (port 3000)    │
                                         └───────────────────────────┘


┌──────────────────┐         WebSocket          ┌──────────────┐
│ SQAL Simulator   │ ──────────────────────────> │   Backend    │
│  (simulators/)   │  /ws/sensors/               │ (backend-api)│
└──────────────────┘  Sensor data (ToF+Spectral) └──────────────┘
                                                         │
                                                         │ Broadcast
                                                         v
                                         ┌───────────────────────────┐
                                         │  Frontend SQAL            │
                                         │  (port 5173)              │
                                         └───────────────────────────┘
```

---

## 1. Simulateur Gavage Temps Réel

### Localisation

```
simulators/gavage_realtime/
├── main.py                    # Simulateur principal
├── requirements.txt           # Dépendances (websockets)
└── README.md                  # Documentation
```

### Fonctionnalités

#### Simulation zootechnique

- **Cycle**: 2 gavages/jour (08h00 matin, 18h00 soir)
- **Durée**: 11-14 jours selon le lot
- **Génétiques**: Mulard, Barbarie, Pékin
- **Canards/lot**: 45-55 canards

#### Progression réaliste

| Paramètre | Début (J0) | Fin (J12) | Formule |
|-----------|------------|-----------|---------|
| Poids Mulard | 4400-4600g | 6500-6800g | Gain non-linéaire |
| Dose matin | 200g | 460g | Progression linéaire |
| Dose soir | 210g | 490g | Progression linéaire |
| Mortalité | 0.05% | ~3-5% | 0.05% + 0.01% × jour |

#### Classes Python

```python
class Canard:
    """Canard individuel"""
    - poids_actuel: float
    - vivant: bool
    - gagner_poids(jour, duree_totale)
    - calculer_mortalite(jour) -> bool

class Lot:
    """Lot de 45-55 canards"""
    - code_lot: str  # LL2512001
    - gaveur_id: int
    - gaveur_nom: str
    - canards: List[Canard]
    - effectuer_gavage(moment) -> Dict

class GavageSimulator:
    """Simulateur principal"""
    - lots_actifs: List[Lot]
    - cycle_gavage_quotidien()  # Boucle 2x/jour
    - send_to_backend(data)     # WebSocket
```

### Utilisation

#### Démarrage rapide (mode test)

```bash
cd simulators/gavage_realtime
python main.py
```

Simule 3 lots avec accélération ×1440 (1 jour = 60 secondes).

#### Configuration avancée

```bash
python main.py \
  --backend-url ws://localhost:8000/ws/gavage \
  --nb-lots 10 \
  --acceleration 1440
```

#### Modes d'accélération

| Mode | Acceleration | 1 jour réel = | Usage |
|------|--------------|---------------|-------|
| Production | 1 | 24h | Prod réelle |
| Test modéré | 144 | 10 min | Tests longs |
| **Test rapide** | **1440** | **60s** | **Défaut** |
| Test ultra | 86400 | 1s | Démo rapide |

### Format des données WebSocket

```json
{
  "code_lot": "LL2512001",
  "gaveur_id": 1,
  "gaveur_nom": "Jean Martin",
  "site": "LL",
  "genetique": "Mulard",
  "jour": 5,
  "moment": "matin",
  "dose_theorique": 320.5,
  "dose_reelle": 315.8,
  "poids_moyen": 5450.2,
  "nb_canards_vivants": 48,
  "taux_mortalite": 4.0,
  "temperature_stabule": 21.3,
  "humidite_stabule": 68.5,
  "timestamp": "2025-12-23T08:00:00.123Z",
  "pret_abattage": false
}
```

### Gaveurs simulés

| ID | Nom | Site | Génétique préférée |
|----|-----|------|--------------------|
| 1 | Jean Martin | LL | Mulard |
| 2 | Sophie Dubois | LS | Mulard |
| 3 | Pierre Leroy | MT | Barbarie |
| 4 | Marie Petit | LL | Pékin |
| 5 | Luc Blanc | LS | Mulard |

---

## 2. Simulateur SQAL (Contrôle Qualité)

### Localisation

```
simulators/sqal/
├── main.py                    # Point d'entrée
├── lot_monitor.py             # Surveillance lots terminés (NOUVEAU)
├── esp32_simulator.py         # Simulateur ESP32
├── vl53l8ch_raw_simulator.py  # Capteur ToF
├── as7341_raw_simulator.py    # Capteur spectral
├── foiegras_fusion_simulator.py
└── requirements.txt
```

### Fonctionnalités

#### Capteurs simulés

1. **VL53L8CH Time-of-Flight**:
   - Matrice 8×8 de distances (mm)
   - Mesure volume et uniformité surface
   - Détecte défauts physiques

2. **AS7341 Spectral**:
   - 10 canaux spectraux (415nm → NIR)
   - Mesure fraîcheur, oxydation, qualité graisse
   - Détection biochimique

3. **Fusion**:
   - Combine ToF + Spectral
   - Score qualité final (0.0 → 1.0)
   - Grade: A+, A, B, C, REJECT

#### Lot Monitor (Synchronisation)

Le **Lot Monitor** surveille automatiquement les lots de gavage terminés:

```python
class LotMonitor:
    """Surveillance automatique sqal_pending_lots"""

    async def start(self):
        while self.running:
            # 1. Polling DB (60s par défaut)
            lots = await self._check_pending_lots()

            # 2. Pour chaque lot détecté
            for lot in lots:
                # 3. Lance ESP32 simulator
                await self._inspect_lot(lot)

                # 4. Génère N échantillons (défaut: 5)
                # 5. Met à jour status → 'inspected'

            await asyncio.sleep(60)
```

#### Profils de qualité

Déterminés automatiquement selon résultats gavage:

| Profil | Poids moyen | Mortalité | Grade attendu |
|--------|-------------|-----------|---------------|
| `foiegras_premium` | >6500g (Mulard) | <3% | A+, A |
| `foiegras_standard_barquette` | >5800g | <5% | A, B |
| `foiegras_low_quality` | <5800g | >5% | C, REJECT |

### Utilisation

#### Mode manuel (sans monitoring)

```bash
cd simulators/sqal
python main.py --device ESP32_LL_01 --interval 30
```

#### Mode automatique (avec monitoring lots)

```bash
cd simulators/sqal
python lot_monitor.py \
  --db-url postgresql://gaveurs_admin:gaveurs_secure_2024@localhost:5432/gaveurs_db \
  --backend-url ws://localhost:8000/ws/sensors/ \
  --samples-per-lot 5 \
  --polling-interval 60
```

---

## 3. Backend WebSocket Handlers

### Localisation

```
backend-api/app/websocket/
├── gavage_consumer.py         # Reçoit données gavage (NOUVEAU)
├── sensors_consumer.py        # Reçoit données SQAL
└── realtime_broadcaster.py    # Broadcast vers frontends
```

### Endpoints

| Endpoint | Direction | Usage |
|----------|-----------|-------|
| `/ws/gavage` | Simulateur → Backend | Données gavage temps réel |
| `/ws/sensors/` | Simulateur SQAL → Backend | Données capteurs IoT |
| `/ws/realtime/` | Backend → Frontends | Broadcast temps réel |

### Flux gavage_consumer.py

```python
class GavageConsumer:
    async def _process_gavage_message(self, data, websocket):
        # 1. VALIDATION PYDANTIC
        gavage_data = GavageRealtimeMessage(**data)

        # 2. SAUVEGARDE TIMESCALEDB
        # - lots_gavage (upsert)
        # - gavage_data (hypertable)
        # - doses_journalieres (hypertable)

        # 3. BROADCAST FRONTENDS
        await realtime_broadcaster.broadcast_gavage_data(gavage_data)

        # 4. SI TERMINÉ → SQAL
        if gavage_data.pret_abattage:
            await self._trigger_sqal_quality_control(gavage_data)
            # Insère dans sqal_pending_lots (status='pending')

        # 5. ACK SIMULATEUR
        await websocket.send_json({"type": "ack", ...})
```

---

## 4. Base de Données TimescaleDB

### Tables modifiées/créées

#### lots_gavage (table existante + colonnes)

```sql
ALTER TABLE lots_gavage ADD COLUMN
    genetique VARCHAR(50),
    nb_canards_initial INTEGER,
    poids_moyen_actuel DECIMAL(8,2),
    taux_mortalite DECIMAL(5,2),
    jour_actuel INTEGER DEFAULT -1,
    pret_abattage BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW();
```

#### doses_journalieres (hypertable + colonnes)

```sql
ALTER TABLE doses_journalieres ADD COLUMN
    code_lot VARCHAR(20),
    jour INTEGER,
    moment VARCHAR(10),  -- 'matin' ou 'soir'
    dose_theorique DECIMAL(6,2),
    dose_reelle DECIMAL(6,2),
    poids_moyen DECIMAL(8,2),
    nb_vivants INTEGER,
    taux_mortalite DECIMAL(5,2),
    temperature DECIMAL(5,2),
    humidite DECIMAL(5,2);

CREATE UNIQUE INDEX idx_doses_unique_realtime
ON doses_journalieres(code_lot, jour, moment);
```

#### sqal_pending_lots (nouvelle table)

```sql
CREATE TABLE sqal_pending_lots (
    id SERIAL PRIMARY KEY,
    code_lot VARCHAR(20) UNIQUE NOT NULL,
    gaveur_id INTEGER,
    gaveur_nom VARCHAR(100),
    site VARCHAR(2),
    genetique VARCHAR(50),
    poids_moyen_final DECIMAL(8,2),
    nb_canards_final INTEGER,
    taux_mortalite DECIMAL(5,2),
    date_abattage TIMESTAMPTZ NOT NULL,
    date_inspection_sqal TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'pending',
    -- pending | inspecting | inspected | approved | rejected | error
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Vues temps réel

#### v_lots_actifs_realtime

```sql
CREATE VIEW v_lots_actifs_realtime AS
SELECT
    l.code_lot,
    l.site_code,
    g.nom AS gaveur_nom,
    l.genetique,
    l.poids_moyen_actuel,
    l.taux_mortalite,
    l.jour_actuel,
    l.updated_at,
    (SELECT COUNT(*) FROM doses_journalieres WHERE code_lot = l.code_lot) AS nb_gavages
FROM lots_gavage l
LEFT JOIN gaveurs_euralis g ON l.gaveur_id = g.id
WHERE l.pret_abattage = FALSE AND l.jour_actuel >= -1
ORDER BY l.updated_at DESC;
```

#### v_stats_realtime_sites

```sql
CREATE VIEW v_stats_realtime_sites AS
SELECT
    site_code,
    COUNT(*) AS nb_lots_actifs,
    SUM(nb_canards_initial) AS total_canards_initial,
    AVG(poids_moyen_actuel) AS poids_moyen_global,
    AVG(taux_mortalite) AS taux_mortalite_moyen
FROM lots_gavage
WHERE pret_abattage = FALSE AND jour_actuel >= 0
GROUP BY site_code;
```

### Migration

```bash
cd backend-api
psql -U gaveurs_admin -d gaveurs_db -f scripts/migration_realtime_simulator.sql
```

---

## 5. Frontends Temps Réel

### Frontend Gaveurs (port 3001)

**Connexion WebSocket**: `/ws/realtime/`

**Données reçues**:
```typescript
interface GavageRealtimeUpdate {
  type: 'gavage_realtime';
  data: {
    code_lot: string;
    gaveur_nom: string;
    jour: number;
    moment: 'matin' | 'soir';
    dose_reelle: number;
    poids_moyen: number;
    nb_canards_vivants: number;
    taux_mortalite: number;
    timestamp: string;
  };
}
```

**Affichage**:
- Dashboard temps réel avec derniers gavages
- Graphique poids moyen (progression)
- Alertes mortalité (si >5%)

### Frontend Euralis (port 3000)

**Connexion WebSocket**: `/ws/realtime/`

**Données reçues**: Mêmes que gaveurs + agrégation multi-sites

**Affichage**:
- Vue d'ensemble 3 sites (LL, LS, MT)
- Nombre de lots actifs par site
- Poids moyen global
- Taux de mortalité moyen

### Frontend SQAL (port 5173)

**Connexion WebSocket**: `/ws/realtime/`

**Données reçues**:
```typescript
interface SensorDataUpdate {
  type: 'sensor_data';
  sensor: 'VL53L8CH' | 'AS7341';
  sample_id: string;
  device_id: string;
  data: {
    raw: {...},
    analysis: {...}
  };
}

interface AnalysisResult {
  type: 'analysis_result';
  sample_id: string;
  lot_id: string;  // code_lot
  data: {
    final_score: number;
    final_grade: 'A+' | 'A' | 'B' | 'C' | 'REJECT';
    is_compliant: boolean;
  };
}
```

**Affichage**:
- Matrices ToF 8×8 en temps réel
- Spectres 10 canaux AS7341
- Score qualité fusion
- Lien avec code_lot

---

## 6. Démarrage Complet du Système

### Étape 1: Migrations DB

```bash
cd backend-api
psql -U gaveurs_admin -d gaveurs_db -f scripts/migration_realtime_simulator.sql
```

### Étape 2: Backend

```bash
cd backend-api
source venv/bin/activate  # Windows: venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```

### Étape 3: Simulateur Gavage

```bash
cd simulators/gavage_realtime
pip install -r requirements.txt
python main.py --nb-lots 5 --acceleration 1440
```

### Étape 4: Lot Monitor SQAL

```bash
cd simulators/sqal
python lot_monitor.py \
  --samples-per-lot 5 \
  --polling-interval 60
```

### Étape 5: Frontends

```bash
# Terminal 1: Gaveurs
cd gaveurs-frontend
npm run dev

# Terminal 2: Euralis
cd euralis-frontend
npm run dev

# Terminal 3: SQAL
cd sqal
npm run dev
```

### Vérification

1. **Backend**: http://localhost:8000/health
2. **Gaveurs**: http://localhost:3001
3. **Euralis**: http://localhost:3000/euralis/dashboard
4. **SQAL**: http://localhost:5173

---

## 7. Scénario Complet

### Timeline (accélération ×1440)

| Temps réel | Temps simulé | Événement |
|------------|--------------|-----------|
| T+0s | J-1 | Création de 5 lots |
| T+30s | J0 Matin | Premiers gavages (dose ~200g) |
| T+60s | J1 Matin | Dose ~220g, poids ~4700g |
| T+600s | J10 Matin | Dose ~420g, poids ~6200g |
| T+720s | J12 Soir | Dernier gavage, `pret_abattage=true` |
| T+780s | - | Lot Monitor détecte lot terminé |
| T+785s | - | SQAL ESP32 lance 5 mesures |
| T+790s | - | Inspection terminée, grade A+ |

### Logs

**Simulateur Gavage**:
```
✅ Lot créé: LL2512001 - Jean Martin - 50 canards Mulard
☀️  MATIN - Jour 1
📊 LL2512001 (J1/12) - Jean Martin - Dose: 215.3g - Poids moyen: 4680.5g - Vivants: 50/50
✅ Lot LL2512001 terminé ! Prêt pour abattage.
```

**Backend gavage_consumer**:
```
✅ Gavage traité: LL2512001 | J1 matin | Gaveur: Jean Martin | Dose: 215.3g
🎯 Lot LL2512001 prêt pour contrôle SQAL | Poids final: 6520.3g | Vivants: 48
```

**Lot Monitor**:
```
📦 1 lot(s) en attente d'inspection SQAL
🔬 Début inspection SQAL: LL2512001 (48 canards)
  📊 Profil qualité: foiegras_premium | Poids: 6520.3g | Mortalité: 4.0%
  🔄 Lancement 5 mesures...
  ✓ Échantillon 1/5 envoyé
  ✓ Échantillon 5/5 envoyé
✅ Inspection terminée: LL2512001
```

**Backend sensors_consumer**:
```
✅ Échantillon traité: ESP32_SQAL_AUTO_LL2512001_001 | Score: 0.892 | Grade: A+
```

---

## 8. Requêtes SQL Utiles

### Lots actifs

```sql
SELECT * FROM v_lots_actifs_realtime;
```

### Statistiques par site

```sql
SELECT * FROM v_stats_realtime_sites;
```

### Historique doses d'un lot

```sql
SELECT jour, moment, dose_reelle, poids_moyen, nb_vivants, taux_mortalite
FROM doses_journalieres
WHERE code_lot = 'LL2512001'
ORDER BY time;
```

### Lots en attente SQAL

```sql
SELECT code_lot, gaveur_nom, poids_moyen_final, taux_mortalite, status
FROM sqal_pending_lots
WHERE status = 'pending'
ORDER BY date_abattage DESC;
```

### Résultats qualité SQAL d'un lot

```sql
SELECT
    sample_id,
    final_score,
    final_grade,
    is_compliant,
    timestamp
FROM sqal_sensor_samples
WHERE lot_id = 'LL2512001'
ORDER BY timestamp;
```

---

## 9. Tests et Validation

### Test 1: Gavage seul (sans SQAL)

```bash
# Backend
uvicorn app.main:app --reload

# Simulateur
cd simulators/gavage_realtime
python main.py --nb-lots 1 --acceleration 86400  # Ultra rapide

# Vérification DB (après 15s)
psql -U gaveurs_admin -d gaveurs_db -c \
  "SELECT code_lot, jour_actuel, poids_moyen_actuel, pret_abattage FROM lots_gavage ORDER BY updated_at DESC LIMIT 5;"
```

Résultat attendu: 1 lot avec `pret_abattage=TRUE` et `jour_actuel=12`.

### Test 2: Synchronisation SQAL

```bash
# Backend
uvicorn app.main:app --reload

# Lot Monitor (polling rapide)
cd simulators/sqal
python lot_monitor.py --polling-interval 10 --samples-per-lot 3

# Simulateur Gavage
cd simulators/gavage_realtime
python main.py --nb-lots 1 --acceleration 86400

# Attendre 20-30s
# Vérification
psql -U gaveurs_admin -d gaveurs_db -c \
  "SELECT code_lot, status, date_inspection_sqal FROM sqal_pending_lots;"
```

Résultat attendu: `status='inspected'` avec `date_inspection_sqal` rempli.

### Test 3: Frontend temps réel

```bash
# Backend + Simulateurs (comme Test 2)

# Frontend Gaveurs
cd gaveurs-frontend
npm run dev

# Ouvrir http://localhost:3001
# Vérifier console navigateur (F12):
# - Messages WebSocket reçus
# - Affichage temps réel mis à jour
```

---

## 10. Architecture de Déploiement

### Docker Compose (Production)

```yaml
version: '3.8'

services:
  # Base de données
  timescaledb:
    image: timescale/timescaledb:latest-pg15
    ports:
      - "5432:5432"

  # Backend API
  backend:
    build: ./backend-api
    ports:
      - "8000:8000"
    depends_on:
      - timescaledb

  # Simulateur Gavage
  simulator-gavage:
    build: ./simulators/gavage_realtime
    environment:
      BACKEND_URL: ws://backend:8000/ws/gavage
      NB_LOTS: 10
      ACCELERATION: 1  # Mode production
    depends_on:
      - backend

  # Lot Monitor SQAL
  lot-monitor:
    build: ./simulators/sqal
    command: python lot_monitor.py
    environment:
      DB_URL: postgresql://gaveurs_admin:gaveurs_secure_2024@timescaledb:5432/gaveurs_db
      BACKEND_URL: ws://backend:8000/ws/sensors/
    depends_on:
      - backend

  # Frontends
  frontend-gaveurs:
    build: ./gaveurs-frontend
    ports:
      - "3001:3000"

  frontend-euralis:
    build: ./euralis-frontend
    ports:
      - "3000:3000"

  frontend-sqal:
    build: ./sqal
    ports:
      - "5173:5173"
```

### Scalabilité

**Mode 100+ lots**:
- Plusieurs instances de `simulator-gavage` (ports WebSocket différents ou load balancer)
- Pool DB augmenté (min_size=20, max_size=50)
- Redis pour cache broadcast (réduire charge DB)

---

## 11. Troubleshooting

### Simulateur ne connecte pas au backend

```bash
# Vérifier backend accessible
curl http://localhost:8000/health

# Tester WebSocket manuellement
wscat -c ws://localhost:8000/ws/gavage
# Attendre: {"type": "connection_established", ...}
```

### Lots ne s'affichent pas en DB

```bash
# Vérifier migration appliquée
psql -U gaveurs_admin -d gaveurs_db -c "\d lots_gavage"
# Chercher colonnes: genetique, poids_moyen_actuel, jour_actuel

# Vérifier logs backend
tail -f backend-api/logs/backend.log | grep "Gavage traité"
```

### Lot Monitor ne détecte pas lots terminés

```bash
# Vérifier table sqal_pending_lots existe
psql -U gaveurs_admin -d gaveurs_db -c "SELECT * FROM sqal_pending_lots;"

# Vérifier trigger backend
# Dans gavage_consumer.py, _trigger_sqal_quality_control() doit être appelé

# Forcer insertion manuelle (test)
psql -U gaveurs_admin -d gaveurs_db -c \
  "INSERT INTO sqal_pending_lots (code_lot, site, genetique, poids_moyen_final, nb_canards_final, taux_mortalite, date_abattage, status) VALUES ('TEST001', 'LL', 'Mulard', 6500, 50, 2.0, NOW(), 'pending');"
```

### Frontend ne reçoit pas mises à jour

```bash
# Console navigateur (F12)
# Vérifier WebSocket connecté:
# ws://localhost:8000/ws/realtime/

# Backend logs
tail -f backend-api/logs/backend.log | grep "broadcast"
```

---

## 12. Métriques et Monitoring

### Prometheus Endpoints

```bash
# Backend metrics
curl http://localhost:8000/metrics

# Métriques utiles:
# - gavages_total: Nombre total de gavages traités
# - sqal_samples_total: Nombre d'échantillons SQAL
# - websocket_connections_active: Connexions WS actives
```

### Dashboard Grafana

Variables à tracker:
- Lots actifs par site
- Poids moyen global (trend)
- Taux de mortalité moyen (alerte si >5%)
- Nombre d'inspections SQAL/jour
- Grades SQAL distribués (A+, A, B, C, REJECT)

---

## Conclusion

L'architecture des simulateurs temps réel permet de:
✅ Reproduire fidèlement le processus industriel
✅ Générer des données cohérentes entre gavage et SQAL
✅ Tester le système complet sans matériel IoT
✅ Valider les frontends en temps réel
✅ Entraîner les algorithmes ML sur données réalistes

**Prochaines étapes**: Intégration Keycloak, optimisation ML basée sur feedback consommateur.
