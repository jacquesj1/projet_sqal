# Architecture Système

## 📚 Documents disponibles

### [SYSTEME_COMPLET.md](../SYSTEME_COMPLET_BOUCLE_FERMEE.md)
**Vue d'ensemble complète du système avec boucle feedback fermée**

- Architecture globale
- Flux de données complet
- 7 composants principaux
- Boucle feedback consommateur

**Pages**: 100+
**Niveau**: Vue d'ensemble

---

### [ARCHITECTURE_UNIFIEE.md](../ARCHITECTURE_UNIFIEE.md)
**Backend unifié FastAPI servant 3 frontends**

- Structure backend
- Routes API (50+)
- Services et modèles
- WebSocket endpoints

**Pages**: 80+
**Niveau**: Backend avancé

---

### [ARCHITECTURE_SIMULATORS.md](../../ARCHITECTURE_SIMULATORS_REALTIME.md)
**Architecture des simulateurs temps réel**

- Simulateur gavage
- Simulateur SQAL
- Synchronisation
- Flux WebSocket

**Pages**: 50+
**Niveau**: Simulateurs

---

### [SCRIPTS_GUIDE.md](../SCRIPTS_GUIDE.md)
**Guide complet des scripts système**

- Scripts build (build.sh/bat)
- Scripts start/stop
- Scripts de test
- Health check

**Pages**: 40+
**Niveau**: DevOps

---

## 🏗️ Schémas d'architecture

### Architecture globale

```
┌────────────────────────────────────────────────────────┐
│                  ARCHITECTURE GLOBALE                   │
└────────────────────────────────────────────────────────┘

┌─────────────┐
│ TimescaleDB │ ← Base de données (38 tables, 4 hypertables)
└──────┬──────┘
       │
       v
┌─────────────────────┐
│  Backend FastAPI    │ ← API unifiée (port 8000)
│  - 50+ routes       │
│  - 9 algo ML        │
│  - WebSocket ×3     │
└──────┬──────────────┘
       │
       ├──────────────┬──────────────┬──────────────┐
       v              v              v              v
┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐
│ Frontend   │  │ Frontend   │  │ Frontend   │  │ Simulateurs│
│ Gaveurs    │  │ Euralis    │  │ SQAL       │  │ Temps Réel │
│ (3001)     │  │ (3000)     │  │ (5173)     │  │            │
└────────────┘  └────────────┘  └────────────┘  └────────────┘
```

### Flux données temps réel

```
Simulateur → WebSocket → Backend → Broadcast → Frontends
                            ↓
                       TimescaleDB
```

---

## 📊 Composants principaux

| Composant | Technologie | Port | Documentation |
|-----------|-------------|------|---------------|
| TimescaleDB | PostgreSQL 15 | 5432 | - |
| Backend API | FastAPI | 8000 | [ARCHITECTURE_UNIFIEE.md](../ARCHITECTURE_UNIFIEE.md) |
| Frontend Gaveurs | Next.js | 3001 | - |
| Frontend Euralis | Next.js | 3000 | - |
| Frontend SQAL | React+Vite | 5173 | [07-SQAL](../07-SQAL/) |
| Simulateur Gavage | Python | - | [05-SIMULATEURS](../05-SIMULATEURS/) |
| Simulateur SQAL | Python | - | [05-SIMULATEURS](../05-SIMULATEURS/) |

---

## 🔗 Liens entre composants

### Backend → Frontends

- **REST API**: HTTP/JSON
- **WebSocket**: Temps réel

### Simulateurs → Backend

- **WebSocket**: `/ws/gavage` et `/ws/sensors/`

### Backend → Database

- **asyncpg**: Pool de connexions

---

**Retour**: [Index principal](../README.md)
