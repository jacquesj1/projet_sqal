# Runbook E2E (Gavage → Monitor → SQAL)

## Scope

Lancer une démo end-to-end qui illustre le flux :

1. **Simulateur Gavage realtime** (génère des lots + `code_lot`)
2. **Lot Monitor** (détecte les lots à inspecter)
3. **Simulateur SQAL (ESP32)** (envoie des mesures ToF + AS7341)
4. Le backend enregistre les résultats et peut générer des produits traçables (QR)

Ce guide est orienté **Docker + Control Panel V2**.

---

## Pré-requis

- Docker Desktop en fonctionnement
- Ports disponibles :
  - `8000` (backend)
  - `5432` (DB)
  - `6379` (redis)
  - `3003` (control-panel-v2 en dev local) ou service front si déployé

---

## 1) Démarrer le backend (Docker)

Depuis la racine du repo :

```bash
docker compose up -d --build timescaledb redis backend
```

Vérification :

- `http://localhost:8000/health`

---

## 2) Ouvrir Control Panel V2

### Option A (dev local)

Lancer le front `control-panel-v2` (Next.js) et ouvrir :

- `http://localhost:3003/e2e-demo`

### Option B (si servi autrement)

Ouvrir la page E2E Demo du control panel.

---

## 3) Exécuter le pipeline dans l’ordre (E2E Demo)

Sur `E2E Demo`, section **Orchestration** :

### Option 1 : One-click

- Cliquer **Start pipeline (auto)**
  - Démarre **Gavage**
  - Démarre **Monitor**
  - Démarre **SQAL** (best-effort)
  - Attend qu’un produit/QR soit disponible et auto-remplit

### Option 2 : Manuel (debug)

1. Cliquer **Start Gavage**
2. Cliquer **Start Monitor**
3. Cliquer **Start SQAL**
4. Attendre ~10-60s
5. Cliquer **Charger produits / QR**

---

## 4) Points de contrôle (si ça ne génère pas de QR)

- Si `latest-product` renvoie 404 "Not Found" :
  - le backend n’a pas redémarré avec les dernières routes
  - faire :

```bash
docker compose restart backend
```

- Si le **Monitor** ne déclenche pas SQAL :
  - vérifier que des lots arrivent dans `sqal_pending_lots` (DB)

- Si SQAL ne démarre pas :
  - vérifier que le script `simulator-sqal/esp32_simulator.py` est présent
  - vérifier que le backend peut lancer un process `python` (sur la machine hôte)

---

## 5) Résultat attendu

Dans l’E2E Demo :
- un QR est affiché
- le payload QR est une URL `/trace/<token>` + paramètres (lot, grade, scores)

Optionnel :
- ouvrir `frontend-traceability` et scanner le QR pour afficher la traçabilité.
