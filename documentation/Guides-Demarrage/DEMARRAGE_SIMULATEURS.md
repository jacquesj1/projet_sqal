# Guide de Démarrage - Simulateurs Temps Réel

Guide rapide pour démarrer les simulateurs gavage et SQAL.

---

## Prérequis

- TimescaleDB démarré
- Backend API configuré
- Migrations appliquées

---

## Étape 1: Appliquer les migrations

```bash
cd backend-api
psql -U gaveurs_admin -d gaveurs_db -f scripts/migration_realtime_simulator.sql
```

**Vérification**:
```bash
psql -U gaveurs_admin -d gaveurs_db -c "\d sqal_pending_lots"
```

---

## Étape 2: Démarrer le Backend

```bash
cd backend-api
source venv/bin/activate  # Windows: venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```

**Vérification**:
```bash
curl http://localhost:8000/health
```

---

## Étape 3: Démarrer le Simulateur Gavage

### Terminal dédié

```bash
cd simulators/gavage_realtime
pip install -r requirements.txt
python main.py --nb-lots 3 --acceleration 1440
```

### Options

```bash
# Mode temps réel (production)
python main.py --acceleration 1 --nb-lots 10

# Mode test rapide (1 jour = 60s) - DÉFAUT
python main.py --acceleration 1440 --nb-lots 3

# Mode test ultra-rapide (1 jour = 1s)
python main.py --acceleration 86400 --nb-lots 1

# URL backend personnalisée
python main.py --backend-url ws://192.168.1.100:8000/ws/gavage
```

### Logs attendus

```
✅ Lot créé: LL2512001 - Jean Martin - 50 canards Mulard
☀️  MATIN - Jour 1
📊 LL2512001 (J1/12) - Jean Martin - Dose: 215.3g - Poids moyen: 4680.5g - Vivants: 50/50 - Mortalité: 0.0%
```

---

## Étape 4: Démarrer le Lot Monitor SQAL

### Terminal dédié

```bash
cd simulators/sqal
python lot_monitor.py
```

### Options

```bash
# Polling rapide (10s au lieu de 60s)
python lot_monitor.py --polling-interval 10

# Plus d'échantillons par lot
python lot_monitor.py --samples-per-lot 10

# URL backend personnalisée
python lot_monitor.py \
  --backend-url ws://192.168.1.100:8000/ws/sensors/ \
  --db-url postgresql://user:pass@192.168.1.100:5432/gaveurs_db
```

### Logs attendus

```
📦 1 lot(s) en attente d'inspection SQAL
🔬 Début inspection SQAL: LL2512001 (48 canards)
  📊 Profil qualité: foiegras_premium | Poids: 6520.3g | Mortalité: 4.0%
  🔄 Lancement 5 mesures...
  ✓ Échantillon 1/5 envoyé
  ✓ Échantillon 5/5 envoyé
✅ Inspection terminée: LL2512001
```

---

## Étape 5: Vérifier les données

### Lots actifs

```bash
psql -U gaveurs_admin -d gaveurs_db -c "
SELECT code_lot, gaveur_id, jour_actuel, poids_moyen_actuel, pret_abattage
FROM lots_gavage
ORDER BY updated_at DESC LIMIT 5;
"
```

### Doses journalières

```bash
psql -U gaveurs_admin -d gaveurs_db -c "
SELECT code_lot, jour, moment, dose_reelle, poids_moyen, nb_vivants
FROM doses_journalieres
ORDER BY time DESC LIMIT 10;
"
```

### Lots en attente SQAL

```bash
psql -U gaveurs_admin -d gaveurs_db -c "
SELECT code_lot, status, poids_moyen_final, taux_mortalite
FROM sqal_pending_lots
ORDER BY date_abattage DESC;
"
```

### Résultats qualité SQAL

```bash
psql -U gaveurs_admin -d gaveurs_db -c "
SELECT lot_id, sample_id, final_grade, final_score
FROM sqal_sensor_samples
ORDER BY timestamp DESC LIMIT 10;
"
```

---

## Étape 6 (Optionnel): Démarrer les Frontends

### Frontend Gaveurs

```bash
cd gaveurs-frontend
npm run dev
# Ouvrir: http://localhost:3001
```

### Frontend Euralis

```bash
cd euralis-frontend
npm run dev
# Ouvrir: http://localhost:3000/euralis/dashboard
```

### Frontend SQAL

```bash
cd sqal
npm run dev
# Ouvrir: http://localhost:5173
```

---

## Timeline attendue (mode accélération ×1440)

| Temps réel | Temps simulé | Événement |
|------------|--------------|-----------|
| T+0s | J-1 | Création des lots |
| T+30s | J0 Matin | Premiers gavages |
| T+60s | J1 Matin | Gavages J1 |
| T+720s | J12 Soir | Lots terminés (`pret_abattage=TRUE`) |
| T+780s | - | Lot Monitor détecte les lots |
| T+790s | - | Inspections SQAL terminées |

**Durée totale**: ~13 minutes pour un cycle complet (J-1 à inspection SQAL)

---

## Arrêter proprement

### Ctrl+C dans chaque terminal

1. Simulateur Gavage: `Ctrl+C`
2. Lot Monitor: `Ctrl+C`
3. Backend: `Ctrl+C`

### Nettoyer les données de test (optionnel)

```bash
psql -U gaveurs_admin -d gaveurs_db -c "
DELETE FROM sqal_pending_lots WHERE code_lot LIKE '%2512%';
DELETE FROM doses_journalieres WHERE code_lot LIKE '%2512%';
DELETE FROM lots_gavage WHERE code_lot LIKE '%2512%';
"
```

---

## Troubleshooting rapide

### Erreur "Connection refused"

```bash
# Vérifier backend tourne
curl http://localhost:8000/health
```

### Erreur "Table does not exist"

```bash
# Appliquer migration
psql -U gaveurs_admin -d gaveurs_db -f backend-api/scripts/migration_realtime_simulator.sql
```

### Pas de lots détectés par Lot Monitor

```bash
# Vérifier lots terminés existent
psql -U gaveurs_admin -d gaveurs_db -c "SELECT * FROM sqal_pending_lots;"

# Insérer lot test manuellement
psql -U gaveurs_admin -d gaveurs_db -c "
INSERT INTO sqal_pending_lots (code_lot, site, genetique, poids_moyen_final, nb_canards_final, taux_mortalite, date_abattage, status)
VALUES ('TEST001', 'LL', 'Mulard', 6500, 50, 2.0, NOW(), 'pending');
"
```

### Logs backend ne montrent pas gavages

```bash
# Vérifier endpoint WebSocket enregistré
curl http://localhost:8000/docs
# Chercher: POST /ws/gavage
```

---

## Scripts de démarrage rapide

### Windows (PowerShell)

Créer `start_simulators.ps1`:
```powershell
# Démarrer backend
Start-Process powershell -ArgumentList "cd backend-api; uvicorn app.main:app --reload"

# Attendre 5s
Start-Sleep -Seconds 5

# Démarrer simulateur gavage
Start-Process powershell -ArgumentList "cd simulators\gavage_realtime; python main.py"

# Démarrer lot monitor
Start-Process powershell -ArgumentList "cd simulators\sqal; python lot_monitor.py"
```

### Linux/Mac (Bash)

Créer `start_simulators.sh`:
```bash
#!/bin/bash

# Démarrer backend
cd backend-api
uvicorn app.main:app --reload &
BACKEND_PID=$!

# Attendre 5s
sleep 5

# Démarrer simulateur gavage
cd ../simulators/gavage_realtime
python main.py &
GAVAGE_PID=$!

# Démarrer lot monitor
cd ../sqal
python lot_monitor.py &
MONITOR_PID=$!

# Afficher PIDs
echo "Backend PID: $BACKEND_PID"
echo "Gavage PID: $GAVAGE_PID"
echo "Monitor PID: $MONITOR_PID"

# Attendre Ctrl+C
trap "kill $BACKEND_PID $GAVAGE_PID $MONITOR_PID" EXIT
wait
```

Utilisation:
```bash
chmod +x start_simulators.sh
./start_simulators.sh
```

---

## Ressources

- [Documentation complète](documentation/SIMULATEURS_TEMPS_REEL.md)
- [README Gavage](simulators/gavage_realtime/README.md)
- [Architecture](ARCHITECTURE_SIMULATORS_REALTIME.md)
- [Résumé complet](SIMULATEURS_REALTIME_COMPLETE.md)

---

**Bon démarrage !** 🚀
