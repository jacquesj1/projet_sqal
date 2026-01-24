# Simulateurs Temps Réel

## 📚 Documents disponibles

### [SIMULATEURS_REALTIME.md](../SIMULATEURS_TEMPS_REEL.md)
**Documentation complète des simulateurs temps réel**

- Architecture complète
- Flux de données
- Démarrage et configuration
- Tests et validation
- Troubleshooting

**Pages**: 900+
**Niveau**: Complet

---

### [SIMULATOR_GAVAGE.md](../../simulators/gavage_realtime/README.md)
**Simulateur de gavage 2×/jour sur 11-14 jours**

- Classes Python (Canard, Lot, GavageSimulator)
- Cycle zootechnique réaliste
- Modes d'accélération (×1 à ×86400)
- Format données WebSocket
- Exemples d'utilisation

**Pages**: 400+
**Niveau**: Développeur

---

### [SIMULATOR_SQAL.md](../../simulators/sqal/)
**Simulateur capteurs IoT (VL53L8CH + AS7341)**

- ESP32 Simulator
- Capteurs ToF et Spectral
- Profils qualité
- WebSocket vers backend

**Pages**: 300+
**Niveau**: IoT

---

### [LOT_MONITOR.md](../../simulators/sqal/lot_monitor.py)
**Monitoring automatique sqal_pending_lots**

- Surveillance polling (60s)
- Déclenchement auto ESP32
- Profils adaptatifs
- Synchronisation gavage → SQAL

**Pages**: 340 lignes
**Niveau**: Avancé

---

## 🦆 Simulateur Gavage

### Utilisation rapide

```bash
cd simulators/gavage_realtime
python main.py --nb-lots 3 --acceleration 1440
```

**Mode**: 1 jour = 60 secondes

### Paramètres

| Paramètre | Valeur par défaut | Description |
|-----------|-------------------|-------------|
| `--backend-url` | `ws://localhost:8000/ws/gavage` | URL WebSocket backend |
| `--nb-lots` | `3` | Nombre de lots à simuler |
| `--acceleration` | `1440` | Facteur d'accélération (1440 = 1j en 60s) |

### Modes d'accélération

| Mode | Acceleration | 1 jour réel = | Usage |
|------|--------------|---------------|-------|
| Production | `1` | 24h | Prod réelle |
| Test modéré | `144` | 10 min | Tests longs |
| **Test rapide** | **`1440`** | **60s** | **Défaut** |
| Test ultra | `86400` | 1s | Démo rapide |

---

## 🔬 Simulateur SQAL

### Utilisation rapide

```bash
cd simulators/sqal
python main.py --device ESP32_LL_01 --interval 30
```

### Paramètres

| Paramètre | Valeur par défaut | Description |
|-----------|-------------------|-------------|
| `--device` | `ESP32_LL_01` | ID du device ESP32 |
| `--backend-url` | `ws://backend:8000/ws/sensors/` | URL WebSocket |
| `--interval` | `30` | Intervalle entre mesures (s) |
| `--config-profile` | `foiegras_standard_barquette` | Profil qualité |

---

## 🔄 Lot Monitor

### Utilisation rapide

```bash
cd simulators/sqal
python lot_monitor.py \
  --polling-interval 60 \
  --samples-per-lot 5
```

### Paramètres

| Paramètre | Valeur par défaut | Description |
|-----------|-------------------|-------------|
| `--db-url` | `postgresql://...` | URL PostgreSQL |
| `--backend-url` | `ws://localhost:8000/ws/sensors/` | WebSocket SQAL |
| `--device-id` | `ESP32_SQAL_AUTO` | ID device auto |
| `--samples-per-lot` | `5` | Échantillons par lot |
| `--polling-interval` | `60` | Intervalle polling (s) |

---

## 📊 Flux complet

```
1. GAVAGE SIMULATOR
   ├─ Crée lots (J-1)
   ├─ Gavage 2×/jour (J0-J14)
   └─ Envoie via /ws/gavage
       │
       v
2. BACKEND
   ├─ Sauvegarde DB
   ├─ Broadcast frontends
   └─ Si terminé → sqal_pending_lots
       │
       v
3. LOT MONITOR
   ├─ Polling sqal_pending_lots (60s)
   ├─ Détecte lots terminés
   └─ Lance ESP32 Simulator
       │
       v
4. SQAL SIMULATOR
   ├─ 5 échantillons/lot
   └─ Envoie via /ws/sensors/
```

---

## 🧪 Tests

### Test simulation complète

```bash
# Terminal 1: Backend
cd backend-api && uvicorn app.main:app --reload

# Terminal 2: Gavage
cd simulators/gavage_realtime
python main.py --nb-lots 1 --acceleration 86400

# Terminal 3: Lot Monitor
cd simulators/sqal
python lot_monitor.py --polling-interval 10

# Attendre ~15 secondes
# Résultat: 1 lot créé → gavé → terminé → inspecté SQAL
```

---

## 📈 Performance

| Scénario | Lots | Gavages/jour | Charge CPU | RAM |
|----------|------|--------------|------------|-----|
| Test | 1 | 2 | <1% | 10 MB |
| Dev | 3 | 6 | <5% | 30 MB |
| Prod | 10 | 20 | <10% | 100 MB |

---

**Retour**: [Index principal](../README.md)
