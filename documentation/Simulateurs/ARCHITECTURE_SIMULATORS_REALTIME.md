# Architecture Simulateurs Temps Réel - Système Gaveurs V3.0

**Date**: 23 Décembre 2025

---

## 🎯 Objectifs

### Problèmes Actuels
- ❌ Simulateurs génèrent CSV statiques
- ❌ Pas de cohérence entre simulateur gavage et SQAL
- ❌ Pas de lien CodeLot ↔ Gaveur ↔ Canards
- ❌ Pas de simulation temps réel (2 gavages/jour)

### Nouveaux Objectifs
- ✅ **Simulation temps réel** - Données envoyées via WebSocket 2x/jour
- ✅ **Cohérence totale** - CodeLot, Gaveur, Canards synchronisés
- ✅ **Cycle de vie complet** - 11-14 jours de gavage → abattage
- ✅ **Broadcast multi-frontend** - Gaveur + Euralis + TimescaleDB
- ✅ **Synchronisation SQAL** - Capteurs qualité liés aux lots

---

## 📊 Cycle de Vie Réel d'un Lot

### Phase 1: Préparation Lot (J-1)
```
┌─────────────────────────────────────────┐
│ Création Lot                            │
│ - CodeLot: LL4801001                   │
│ - Gaveur: Jean Martin                  │
│ - Site: LL (Landes Lesgor)            │
│ - Nb canards: 50                       │
│ - Génétique: Mulard                    │
│ - Date début gavage: J0                │
│ - Durée prévue: 12 jours               │
└─────────────────────────────────────────┘
```

### Phase 2: Gavage (J0 → J12)
```
Jour 0 (08h00):  Gavage matin #1  → dose_matin=200g
Jour 0 (18h00):  Gavage soir #1   → dose_soir=210g

Jour 1 (08h00):  Gavage matin #2  → dose_matin=220g
Jour 1 (18h00):  Gavage soir #2   → dose_soir=230g

...

Jour 11 (08h00): Gavage matin #23 → dose_matin=450g
Jour 11 (18h00): Gavage soir #23  → dose_soir=480g

Jour 12 (08h00): Gavage matin #24 → dose_matin=460g
Jour 12 (18h00): Gavage soir #24  → dose_soir=490g
```

**Progression doses**:
- Début (J0): 200-210g
- Milieu (J6): 350-380g
- Fin (J12): 450-490g

**Évolution poids canards**:
- Début (J0): 4500g
- Milieu (J6): 5200g
- Fin (J12): 6800g

### Phase 3: Contrôle Qualité SQAL (J12+1)
```
┌─────────────────────────────────────────┐
│ Abattage Lot LL4801001                 │
│ - Date: J13 (lendemain dernier gavage) │
│ - Transport → Abattoir                 │
│ - SQAL: Mesures qualité                │
│   • VL53L8CH ToF: Dimensions foies    │
│   • AS7341: Spectral couleur          │
│   • Grade: A+ / A / B / C / D          │
└─────────────────────────────────────────┘
```

### Phase 4: Distribution & Feedback (J14+)
```
┌─────────────────────────────────────────┐
│ Produit Fini                            │
│ - QR Code généré (blockchain)         │
│ - Distribution consommateurs           │
│ - Feedback satisfaction (1-5★)         │
│ - Boucle fermée → Optimisation IA      │
└─────────────────────────────────────────┘
```

---

## 🏗️ Nouvelle Architecture Simulateurs

### Vision Globale

```
┌──────────────────────────────────────────────────────────────────┐
│                    SIMULATEUR UNIFIÉ                             │
│                                                                  │
│  ┌────────────────────┐         ┌────────────────────┐         │
│  │ Simulateur Gavage  │────────→│ Simulateur SQAL    │         │
│  │ (Temps Réel)       │  Lots  │ (Qualité Post-     │         │
│  │                    │         │  Abattage)         │         │
│  │ • 2 gavages/jour   │         │ • VL53L8CH ToF     │         │
│  │ • 11-14 jours      │         │ • AS7341 Spectral  │         │
│  │ • Progression dose │         │ • Grade qualité    │         │
│  └────────────────────┘         └────────────────────┘         │
│           │                              │                      │
│           │   WebSocket /ws/gavage       │   WebSocket         │
│           └──────────────┬───────────────┘   /ws/sensors       │
│                          │                                      │
└──────────────────────────┼──────────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  BACKEND FASTAPI       │
              │  • Reçoit WS gavage    │
              │  • Reçoit WS SQAL      │
              │  • Stocke TimescaleDB  │
              │  • Broadcast frontends │
              └────────────────────────┘
                           │
            ┌──────────────┼──────────────┐
            │              │              │
            ▼              ▼              ▼
    ┌──────────┐  ┌──────────────┐  ┌──────────┐
    │ Frontend │  │   Frontend   │  │Timescale │
    │ Gaveur   │  │   Euralis    │  │    DB    │
    │          │  │ (Superviseur)│  │          │
    └──────────┘  └──────────────┘  └──────────┘
```

### Flux de Données

```
1. CRÉATION LOT (J-1)
   Simulateur → /api/lots/create
   ├─ CodeLot: LL4801001
   ├─ Gaveur: Jean Martin (ID=1)
   ├─ Site: LL
   ├─ Nb canards: 50
   └─ Génétique: Mulard

2. GAVAGE TEMPS RÉEL (J0-J12)
   Chaque jour à 08h00 et 18h00:
   Simulateur → WebSocket /ws/gavage
   ├─ CodeLot: LL4801001
   ├─ Jour: 0-12
   ├─ Repas: matin/soir
   ├─ Dose réelle: 200-490g
   ├─ Poids canards: 4500-6800g
   └─ Température/Humidité

3. BROADCAST BACKEND
   Backend → WS /ws/realtime/gavage
   ├─ Frontend Gaveur (mise à jour temps réel)
   ├─ Frontend Euralis (dashboard sites)
   └─ TimescaleDB (hypertable gavage_data)

4. ABATTAGE + QUALITÉ (J13)
   Simulateur SQAL → WebSocket /ws/sensors
   ├─ CodeLot: LL4801001
   ├─ VL53L8CH: Dimensions foies (8x8 matrice)
   ├─ AS7341: Spectral couleur (10 canaux)
   └─ Grade: A+ (ITM=16.8kg)

5. FEEDBACK CONSOMMATEUR (J14+)
   Consommateur → POST /api/consumer/feedback
   ├─ QR Code scanné
   ├─ Note satisfaction: 4.5/5
   └─ IA → Optimise prochains lots
```

---

## 🔧 Implémentation Technique

### 1. Simulateur Gavage Temps Réel

**Fichier**: `simulators/gavage_realtime/main.py`

**Fonctionnement**:
```python
import asyncio
import websockets
import json
from datetime import datetime, timedelta

class GavageSimulator:
    def __init__(self):
        self.lots_actifs = []
        self.backend_ws_url = "ws://localhost:8000/ws/gavage"

    async def create_lot(self):
        """Crée un nouveau lot (J-1)"""
        lot = {
            "code_lot": generate_code_lot(),  # LL4801001
            "gaveur_id": random.choice([1, 2, 3, 4, 5]),
            "gaveur_nom": get_gaveur_nom(gaveur_id),
            "site": "LL",
            "nb_canards": 50,
            "genetique": "Mulard",
            "date_debut": datetime.now() + timedelta(days=1),
            "duree_prevue": random.randint(11, 14),
            "jour_actuel": -1,
            "canards": [
                {
                    "id": i,
                    "poids_initial": random.uniform(4400, 4600),
                    "poids_actuel": random.uniform(4400, 4600)
                }
                for i in range(50)
            ]
        }
        self.lots_actifs.append(lot)
        return lot

    async def gavage_quotidien(self):
        """Simule 2 gavages/jour pour tous les lots actifs"""
        while True:
            now = datetime.now()

            # Gavage matin (08h00)
            if now.hour == 8 and now.minute == 0:
                await self.effectuer_gavages("matin")

            # Gavage soir (18h00)
            if now.hour == 18 and now.minute == 0:
                await self.effectuer_gavages("soir")

            # Check toutes les 60 secondes
            await asyncio.sleep(60)

    async def effectuer_gavages(self, moment: str):
        """Effectue gavage pour tous les lots actifs"""
        for lot in self.lots_actifs:
            if lot["jour_actuel"] < lot["duree_prevue"]:
                # Incrémenter jour au matin
                if moment == "matin":
                    lot["jour_actuel"] += 1

                # Calculer dose progressive
                progression = lot["jour_actuel"] / lot["duree_prevue"]
                dose_base = 200 if moment == "matin" else 210
                dose = dose_base + (progression * 250)  # 200→450g

                # Simuler gavage pour chaque canard
                for canard in lot["canards"]:
                    # Gain de poids
                    gain = random.uniform(50, 80) * progression
                    canard["poids_actuel"] += gain

                # Préparer données gavage
                gavage_data = {
                    "code_lot": lot["code_lot"],
                    "gaveur_id": lot["gaveur_id"],
                    "jour": lot["jour_actuel"],
                    "moment": moment,
                    "dose_theorique": dose,
                    "dose_reelle": dose * random.uniform(0.95, 1.05),
                    "poids_moyen": sum(c["poids_actuel"] for c in lot["canards"]) / len(lot["canards"]),
                    "temperature_stabule": random.uniform(19, 23),
                    "humidite_stabule": random.uniform(55, 75),
                    "timestamp": datetime.now().isoformat()
                }

                # Envoyer via WebSocket
                await self.send_to_backend(gavage_data)

                # Si dernier jour, marquer pour abattage
                if lot["jour_actuel"] >= lot["duree_prevue"] and moment == "soir":
                    lot["pret_abattage"] = True

    async def send_to_backend(self, data):
        """Envoie données via WebSocket au backend"""
        async with websockets.connect(self.backend_ws_url) as ws:
            await ws.send(json.dumps(data))
```

**Lancement**:
```bash
python simulators/gavage_realtime/main.py \
  --mode realtime \
  --nb-lots 5 \
  --accelerated 60  # 1 jour réel = 60 secondes
```

### 2. Synchronisation SQAL

**Fichier**: `simulators/sqal_realtime/main.py`

**Modifications**:
```python
class SQALSimulator:
    async def watch_lots_abattage(self):
        """Surveille lots prêts pour abattage"""
        # Écoute les lots terminés
        async with websockets.connect("ws://localhost:8000/ws/lots/ready") as ws:
            async for message in ws:
                lot = json.loads(message)

                # Attendre 1 jour (abattage J+1)
                await asyncio.sleep(86400 / acceleration)

                # Mesurer qualité
                await self.measure_quality(lot)

    async def measure_quality(self, lot):
        """Mesure qualité post-abattage"""
        # Pour chaque canard du lot
        for canard in lot["canards"]:
            # Générer mesures VL53L8CH (8x8 matrice ToF)
            tof_matrix = generate_tof_matrix(canard["poids_actuel"])

            # Générer mesures AS7341 (10 canaux spectraux)
            spectral = generate_spectral_data(canard["poids_actuel"])

            # Calculer ITM (poids foie)
            itm = calculate_itm(canard["poids_actuel"], lot["genetique"])

            # Calculer grade qualité
            grade = calculate_grade(itm, tof_matrix, spectral)

            # Envoyer via WebSocket SQAL
            sensor_data = {
                "device_id": "ESP32_LL_01",
                "code_lot": lot["code_lot"],
                "canard_id": canard["id"],
                "tof_matrix": tof_matrix,
                "spectral_data": spectral,
                "itm": itm,
                "grade": grade,
                "timestamp": datetime.now().isoformat()
            }

            await self.send_to_sqal_ws(sensor_data)
```

### 3. Backend WebSocket Handler

**Fichier**: `backend-api/app/websocket/gavage_ws.py` (NOUVEAU)

```python
from fastapi import WebSocket, WebSocketDisconnect
from typing import List
import json

# Connexions actives
active_connections: List[WebSocket] = []

@app.websocket("/ws/gavage")
async def websocket_gavage(websocket: WebSocket):
    """
    WebSocket pour recevoir données gavage temps réel
    """
    await websocket.accept()

    try:
        while True:
            # Recevoir données du simulateur
            data = await websocket.receive_text()
            gavage_data = json.loads(data)

            # Stocker dans TimescaleDB
            await store_gavage_data(gavage_data)

            # Broadcast vers tous les frontends connectés
            await broadcast_to_frontends(gavage_data, "gavage")

    except WebSocketDisconnect:
        pass


async def store_gavage_data(gavage_data: dict):
    """Stocke données gavage dans TimescaleDB"""
    query = """
    INSERT INTO gavage_data (
        code_lot, gaveur_id, jour_gavage, moment,
        dose_theorique, dose_reelle, poids_moyen,
        temperature_stabule, humidite_stabule, timestamp
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    """

    async with db_pool.acquire() as conn:
        await conn.execute(
            query,
            gavage_data["code_lot"],
            gavage_data["gaveur_id"],
            gavage_data["jour"],
            gavage_data["moment"],
            gavage_data["dose_theorique"],
            gavage_data["dose_reelle"],
            gavage_data["poids_moyen"],
            gavage_data["temperature_stabule"],
            gavage_data["humidite_stabule"],
            gavage_data["timestamp"]
        )


async def broadcast_to_frontends(data: dict, data_type: str):
    """Broadcast vers frontends connectés"""
    message = json.dumps({
        "type": data_type,
        "data": data
    })

    # Frontend Gaveur
    for connection in gaveur_frontend_connections:
        await connection.send_text(message)

    # Frontend Euralis
    for connection in euralis_frontend_connections:
        await connection.send_text(message)
```

---

## ⏱️ Mode Accéléré pour Tests

### Problème
- Vraie simulation: 12 jours × 2 gavages/jour = **12 jours réels**
- Trop long pour tests/démo

### Solution: Mode Accéléré

**Option 1: Facteur Temps**
```bash
# 1 jour réel = 60 secondes (accélération ×1440)
python main.py --accelerated 1440

# 1 jour réel = 10 minutes (accélération ×144)
python main.py --accelerated 144

# 1 jour réel = 1 heure (accélération ×24)
python main.py --accelerated 24
```

**Option 2: Mode Replay**
```bash
# Rejoue données historiques en boucle
python main.py --mode replay --speed 100x
```

**Option 3: Mode CSV (ancien, optionnel)**
```bash
# Génère CSV complet instantanément
python main.py --mode csv --output data/lots.csv
```

---

## 📊 Cohérence Données

### Table `lots_gavage`

```sql
CREATE TABLE lots_gavage (
    id SERIAL PRIMARY KEY,
    code_lot VARCHAR(20) UNIQUE NOT NULL,  -- LL4801001
    gaveur_id INT REFERENCES gaveurs(id),
    gaveur_nom VARCHAR(100),
    site VARCHAR(10),
    nb_canards INT,
    genetique VARCHAR(50),
    date_debut TIMESTAMP,
    date_fin TIMESTAMP,
    duree_reelle INT,  -- jours
    statut VARCHAR(20),  -- en_cours, termine, abattu
    itm_moyen FLOAT,  -- Calculé post-abattage
    sigma FLOAT,  -- Écart-type poids foies
    mortalite_pct FLOAT
);
```

### Table `gavage_data` (Hypertable)

```sql
CREATE TABLE gavage_data (
    timestamp TIMESTAMPTZ NOT NULL,
    code_lot VARCHAR(20) REFERENCES lots_gavage(code_lot),
    gaveur_id INT REFERENCES gaveurs(id),
    jour_gavage INT,  -- 0-14
    moment VARCHAR(10),  -- matin/soir
    dose_theorique FLOAT,
    dose_reelle FLOAT,
    poids_moyen FLOAT,
    temperature_stabule FLOAT,
    humidite_stabule FLOAT
);

-- Hypertable TimescaleDB
SELECT create_hypertable('gavage_data', 'timestamp');
```

### Table `sqal_sensor_samples` (Hypertable)

```sql
-- Déjà existe, ajout colonne code_lot
ALTER TABLE sqal_sensor_samples
ADD COLUMN code_lot VARCHAR(20) REFERENCES lots_gavage(code_lot);
```

**Lien**: Lot gavage → SQAL via `code_lot`

---

## 🎯 Scénario Complet

### Jour -1: Initialisation
```
Simulateur: Créer 5 lots
├─ LL4801001 (Gaveur Jean Martin, LL, 50 canards Mulard)
├─ LS4801002 (Gaveur Sophie Dubois, LS, 48 canards Mulard)
├─ MT4801003 (Gaveur Pierre Leroy, MT, 52 canards Barbarie)
├─ LL4801004 (Gaveur Marie Petit, LL, 50 canards Mulard)
└─ LS4801005 (Gaveur Luc Blanc, LS, 49 canards Mulard)
```

### Jours 0-12: Gavage Quotidien
```
08h00: Gavage matin
  ├─ Simulateur → WS /ws/gavage
  ├─ Backend → Store TimescaleDB
  └─ Backend → Broadcast frontends

18h00: Gavage soir
  ├─ Simulateur → WS /ws/gavage
  ├─ Backend → Store TimescaleDB
  └─ Backend → Broadcast frontends
```

### Jour 13: Abattage + SQAL
```
Lot LL4801001 terminé → abattage
  ├─ Transport abattoir
  ├─ Simulateur SQAL activé
  ├─ Mesures qualité (VL53L8CH + AS7341)
  └─ WS /ws/sensors → Backend → Frontends
```

### Jour 14+: Feedback
```
Produits en rayon
  ├─ QR Code scanné
  ├─ Feedback consommateur
  └─ IA optimise prochains lots
```

---

## ✅ Avantages Nouvelle Architecture

1. **Réaliste** ✅
   - Respecte rythme biologique (2 gavages/jour)
   - Progression doses naturelle
   - Durée variable 11-14 jours

2. **Temps Réel** ✅
   - WebSocket streaming
   - Mise à jour live frontends
   - Pas de polling

3. **Cohérent** ✅
   - CodeLot unique
   - Lien Gaveur ↔ Lot ↔ Canards ↔ SQAL
   - Timeline complète

4. **Scalable** ✅
   - Plusieurs lots simultanés
   - Multi-sites (LL, LS, MT)
   - Mode accéléré pour tests

5. **Pédagogique** ✅
   - Suit vraie pratique zootechnique
   - Démo réaliste
   - Compréhensible

---

## 🚀 Migration Plan

1. ✅ **Créer nouveau simulateur gavage temps réel**
2. ✅ **Modifier simulateur SQAL** (écoute lots terminés)
3. ✅ **Ajouter WebSocket `/ws/gavage`** au backend
4. ✅ **Mettre à jour schéma DB** (colonnes code_lot)
5. ✅ **Adapter frontends** (écoute WS temps réel)
6. ✅ **Tester scénario complet** (J-1 → J14)
7. ⚠️ **Conserver mode CSV** (optionnel, batch)

---

**Prochaine étape**: Développer le nouveau simulateur gavage temps réel!

