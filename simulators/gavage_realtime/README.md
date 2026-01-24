# Simulateur Gavage Temps Réel

## Description

Simulateur de gavage de canards en temps réel qui reproduit fidèlement le processus de gavage industriel sur 11-14 jours avec 2 repas par jour (matin et soir).

## Fonctionnalités

- **Simulation zootechnique réaliste**:
  - 2 gavages par jour (08h00 matin, 18h00 soir)
  - Durée de gavage: 11-14 jours (configurable par lot)
  - 3 génétiques supportées: Mulard, Barbarie, Pékin
  - 45-55 canards par lot

- **Progression naturelle**:
  - Poids initial selon génétique (3800-4600g)
  - Gain de poids non-linéaire (plus important en début)
  - Doses progressives: 200g → 490g
  - Mortalité réaliste (0.05% + progression)

- **Communication temps réel**:
  - Envoi via WebSocket au backend
  - Données stockées dans TimescaleDB
  - Broadcast vers frontends (gaveurs + euralis)

- **Modes d'accélération**:
  - Mode réel: 1x (1 jour = 24h)
  - Mode test rapide: 1440x (1 jour = 60s)
  - Mode test ultra-rapide: 86400x (1 jour = 1s)

## Installation

```bash
cd simulators/gavage_realtime
pip install -r requirements.txt
```

## Utilisation

### Démarrage basique (3 lots, mode test 1 jour = 60s)

```bash
python main.py
```

### Configuration avancée

```bash
python main.py \
  --backend-url ws://localhost:8000/ws/gavage \
  --nb-lots 5 \
  --acceleration 1440
```

### Paramètres

- `--backend-url`: URL WebSocket du backend (défaut: `ws://localhost:8000/ws/gavage`)
- `--nb-lots`: Nombre de lots à simuler (défaut: `3`)
- `--acceleration`: Facteur d'accélération temps (défaut: `1440` = 1 jour réel en 60s)

### Exemples d'accélération

```bash
# Mode temps réel (1 jour = 24h) - PRODUCTION
python main.py --acceleration 1

# Mode test modéré (1 jour = 10 minutes)
python main.py --acceleration 144

# Mode test rapide (1 jour = 60 secondes) - DÉFAUT
python main.py --acceleration 1440

# Mode test ultra-rapide (1 jour = 1 seconde)
python main.py --acceleration 86400
```

## Architecture

### Classes principales

#### `Canard`
Représente un canard individuel avec:
- Poids évolutif
- État vivant/mort
- Calcul de gain de poids
- Simulation de mortalité

#### `Lot`
Représente un lot de canards avec:
- Code lot unique (ex: `LL2512001`)
- Lien avec gaveur (ID + nom)
- Gestion de 45-55 canards
- Calcul de doses théoriques/réelles
- Tracking mortalité et poids moyen

#### `GavageSimulator`
Simulateur principal:
- Gestion multi-lots
- Cycle quotidien 2x/jour
- Envoi WebSocket
- Logs détaillés

## Format des données envoyées

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
  "timestamp": "2025-12-23T08:00:00",
  "pret_abattage": false
}
```

## Cycle de gavage typique

### J-1 (Préparation)
- Création des lots
- Canards installés dans les stabules
- Jour = -1

### J0 à J11-14 (Gavage actif)
- **08h00 Matin**: Premier gavage (dose 200g → 460g)
- **18h00 Soir**: Deuxième gavage (dose 210g → 490g)
- Gain de poids: ~80g/gavage en début, ~50g/gavage en fin
- Mortalité: augmente légèrement avec le temps

### Dernier jour soir
- `pret_abattage = true`
- Lot marqué pour contrôle SQAL
- Enregistré dans `sqal_pending_lots`

## Gaveurs simulés

Le simulateur utilise 5 gaveurs fictifs cohérents avec la base de données:

| ID | Nom | Site |
|----|-----|------|
| 1 | Jean Martin | LL |
| 2 | Sophie Dubois | LS |
| 3 | Pierre Leroy | MT |
| 4 | Marie Petit | LL |
| 5 | Luc Blanc | LS |

## Sites Euralis

- **LL**: Site Bretagne
- **LS**: Site Pays de Loire
- **MT**: Site Maubourguet

## Génération CodeLot

Format: `{SITE}{YYMM}{NNN}`

Exemples:
- `LL2512001`: Site LL, Décembre 2025, Lot #001
- `MT2512042`: Site MT, Décembre 2025, Lot #042

## Logs

Le simulateur affiche:
- ✅ Création des lots (J-1)
- ☀️ Gavages du matin avec détails (dose, poids, mortalité)
- 🌙 Gavages du soir avec détails
- ✅ Lots terminés prêts pour abattage
- 📊 Résumé final de simulation

Exemple:
```
✅ Lot créé: LL2512001 - Jean Martin - 50 canards Mulard
☀️  MATIN - Jour 1
📊 LL2512001 (J1/12) - Jean Martin - Dose: 215.3g - Poids moyen: 4680.5g - Vivants: 50/50 - Mortalité: 0.0%
🌙 SOIR - Jour 1
📊 LL2512001 (J1/12) - Jean Martin - Dose: 225.8g - Poids moyen: 4755.2g - Vivants: 50/50 - Mortalité: 0.0%
```

## Intégration Backend

Le backend reçoit les données via WebSocket `/ws/gavage` et:
1. Valide avec Pydantic (`GavageRealtimeMessage`)
2. Sauvegarde dans TimescaleDB:
   - `lots_gavage` (upsert état lot)
   - `gavage_data` (hypertable time-series)
   - `doses_journalieres` (hypertable Euralis)
3. Broadcast vers frontends connectés (gaveurs + euralis)
4. Si `pret_abattage=true`, enregistre dans `sqal_pending_lots`

## Synchronisation SQAL

Lorsqu'un lot est terminé (`pret_abattage=true`):
- Le lot est enregistré dans `sqal_pending_lots`
- Le simulateur SQAL peut récupérer les lots en attente
- Lance automatiquement des mesures de qualité (ToF + Spectral)
- Lien via `code_lot`

## Troubleshooting

### Erreur "Connection refused"
- Vérifier que le backend tourne: `http://localhost:8000/health`
- Vérifier l'URL WebSocket: `ws://localhost:8000/ws/gavage`

### Erreur "Échec sauvegarde TimescaleDB"
- Vérifier que les migrations sont appliquées:
  ```bash
  psql -U gaveurs_admin -d gaveurs_db -f backend-api/scripts/migration_realtime_simulator.sql
  ```
- Vérifier tables existent: `lots_gavage`, `doses_journalieres`, `sqal_pending_lots`

### Pas de données dans le frontend
- Vérifier que le frontend est connecté au WebSocket `/ws/realtime/`
- Vérifier les logs backend pour le broadcast
- Vérifier la console navigateur (F12)

## Tests

### Test connexion WebSocket

```bash
# Terminal 1: Backend
cd backend-api
uvicorn app.main:app --reload

# Terminal 2: Simulateur
cd simulators/gavage_realtime
python main.py --nb-lots 1 --acceleration 86400
```

Résultat attendu: 1 lot simulé en ~15 secondes (12 jours accélérés)

### Vérifier données en DB

```bash
psql -U gaveurs_admin -d gaveurs_db

-- Lots actifs
SELECT * FROM v_lots_actifs_realtime;

-- Doses enregistrées
SELECT code_lot, jour, moment, dose_reelle, poids_moyen, nb_vivants
FROM doses_journalieres
ORDER BY time DESC LIMIT 20;

-- Lots prêts pour SQAL
SELECT * FROM sqal_pending_lots WHERE status = 'pending';
```

## Performance

- **CPU**: <5% par lot (Python asyncio)
- **Mémoire**: ~50 canards × 10 lots = ~1 MB
- **Réseau**: ~500 bytes par gavage (JSON compressible)
- **DB**: ~1 row par gavage × 2/jour × 12 jours × lots = faible volume

## Roadmap

- [ ] Support WebSocket reconnexion automatique
- [ ] Configuration via fichier YAML
- [ ] Simulation de pannes/incidents (panne électrique, maladie)
- [ ] Export CSV des résultats de simulation
- [ ] Interface web de monitoring du simulateur
- [ ] Support multi-processus pour >100 lots
