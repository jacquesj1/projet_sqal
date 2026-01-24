# 📚 Documentation - Système Gaveurs V3.0

**Projet**: Système intelligent de gavage avec IA, IoT, Blockchain et Temps Réel
**Version**: 3.0.0
**Date**: 25 Décembre 2024
**Status**: Production Ready + Phase 3 Tests (84% complété)

---

## 📚 Organisation de la documentation

La documentation est organisée par **thèmes** pour faciliter la navigation :

```
documentation/
├── README.md                           # Ce fichier (index principal)
│
├── 01-GUIDES_DEMARRAGE/               # 🚀 Guides de démarrage rapide
│   ├── QUICKSTART.md                   # Démarrage rapide complet (5 min)
│   ├── DEMARRAGE_SIMULATEURS.md        # Guide simulateurs temps réel
│   └── NOUVEAUX_SCRIPTS.md             # Scripts build/start/stop
│
├── 02-ARCHITECTURE/                   # 🏗️ Architecture système
│   ├── SYSTEME_COMPLET.md              # Vue d'ensemble système complet
│   ├── ARCHITECTURE_UNIFIEE.md         # Backend unifié
│   ├── ARCHITECTURE_SIMULATORS.md      # Architecture simulateurs temps réel
│   └── SCRIPTS_GUIDE.md                # Guide scripts système
│
├── 03-FONCTIONNALITES/                # ⚙️ Fonctionnalités principales
│   ├── BOUCLE_FERMEE.md                # Boucle feedback consommateur
│   ├── FRONTEND_WEBSOCKET.md           # WebSocket temps réel frontends
│   ├── ACCESSIBILITE_IA.md             # Accès IA via frontends
│   └── FONCTIONNALITES_AVANCEES.md     # Fonctionnalités avancées
│
├── 04-KEYCLOAK_AUTH/                  # 🔐 Authentification Keycloak
│   ├── INTEGRATION_KEYCLOAK.md         # Guide intégration
│   ├── CONFIGURATION_GUIDE.md          # Configuration détaillée
│   └── PLAN_INTEGRATION.md             # Plan d'intégration
│
├── 05-SIMULATEURS/                    # 🦆 Simulateurs temps réel
│   ├── SIMULATEURS_REALTIME.md         # Documentation complète
│   ├── SIMULATOR_GAVAGE.md             # Simulateur gavage
│   ├── SIMULATOR_SQAL.md               # Simulateur SQAL
│   └── LOT_MONITOR.md                  # Monitoring automatique
│
├── 06-IA_ML/                          # 🤖 Intelligence Artificielle
│   ├── GUIDE_ALGORITHMES.md            # Guide complet 9 algorithmes
│   ├── ML_ALGORITHMS_STATUS.md         # Status algorithmes ML
│   └── COMPLETION_IA.md                # Complétion IA
│
├── 07-SQAL/                           # 🔬 Contrôle qualité SQAL
│   ├── INTEGRATION_COMPLETE.md         # Intégration SQAL
│   ├── ARCHITECTURE.md                 # Architecture SQAL
│   ├── HOW_IT_WORKS.md                 # Fonctionnement SQAL
│   └── WEBSOCKET_DATA_FLOW.md          # Flux WebSocket SQAL
│
└── 08-COMPLETIONS/                    # ✅ Rapports de complétion
    ├── INTEGRATION_FINALE.md           # Intégration complète finale
    ├── SIMULATEURS_COMPLETE.md         # Simulateurs terminés
    └── STATUS_PROJET.md                # Status général projet
```

---

## 🚀 Par où commencer ?

### Nouveau sur le projet ?

1. **[QUICKSTART](01-GUIDES_DEMARRAGE/QUICKSTART.md)** - Démarrage rapide en 5 minutes
2. **[SYSTEME_COMPLET](02-ARCHITECTURE/SYSTEME_COMPLET.md)** - Vue d'ensemble du système
3. **[DEMARRAGE_SIMULATEURS](01-GUIDES_DEMARRAGE/DEMARRAGE_SIMULATEURS.md)** - Lancer les simulateurs

### Développeur Backend ?

1. **[ARCHITECTURE_UNIFIEE](02-ARCHITECTURE/ARCHITECTURE_UNIFIEE.md)** - Architecture backend
2. **[SCRIPTS_GUIDE](02-ARCHITECTURE/SCRIPTS_GUIDE.md)** - Scripts système
3. **[GUIDE_ALGORITHMES](06-IA_ML/GUIDE_ALGORITHMES.md)** - Algorithmes ML

### Développeur Frontend ?

1. **[FRONTEND_WEBSOCKET](03-FONCTIONNALITES/FRONTEND_WEBSOCKET.md)** - WebSocket temps réel
2. **[ACCESSIBILITE_IA](03-FONCTIONNALITES/ACCESSIBILITE_IA.md)** - Accès IA depuis frontend
3. **[CONFIGURATION_KEYCLOAK](04-KEYCLOAK_AUTH/CONFIGURATION_GUIDE.md)** - Auth Keycloak

### DevOps / Déploiement ?

1. **[NOUVEAUX_SCRIPTS](01-GUIDES_DEMARRAGE/NOUVEAUX_SCRIPTS.md)** - Scripts build/start/stop
2. **[INTEGRATION_KEYCLOAK](04-KEYCLOAK_AUTH/INTEGRATION_KEYCLOAK.md)** - Keycloak Docker
3. **[SIMULATEURS_REALTIME](05-SIMULATEURS/SIMULATEURS_REALTIME.md)** - Simulateurs production

### Testeur / QA ?

1. **[DEMARRAGE_SIMULATEURS](01-GUIDES_DEMARRAGE/DEMARRAGE_SIMULATEURS.md)** - Lancer tests
2. **[STATUS_PROJET](08-COMPLETIONS/STATUS_PROJET.md)** - Status fonctionnalités
3. **[INTEGRATION_FINALE](08-COMPLETIONS/INTEGRATION_FINALE.md)** - Tests E2E

---

## 📖 Guides thématiques

### 🚀 Démarrage et Installation

| Guide | Description | Temps |
|-------|-------------|-------|
| [QUICKSTART](01-GUIDES_DEMARRAGE/QUICKSTART.md) | Démarrage rapide complet | 5 min |
| [DEMARRAGE_SIMULATEURS](01-GUIDES_DEMARRAGE/DEMARRAGE_SIMULATEURS.md) | Guide simulateurs temps réel | 10 min |
| [NOUVEAUX_SCRIPTS](01-GUIDES_DEMARRAGE/NOUVEAUX_SCRIPTS.md) | Scripts build/start/stop | 15 min |

### 🏗️ Architecture

| Document | Description | Niveau |
|----------|-------------|--------|
| [SYSTEME_COMPLET](02-ARCHITECTURE/SYSTEME_COMPLET.md) | Vue d'ensemble système | Débutant |
| [ARCHITECTURE_UNIFIEE](02-ARCHITECTURE/ARCHITECTURE_UNIFIEE.md) | Backend unifié | Avancé |
| [ARCHITECTURE_SIMULATORS](02-ARCHITECTURE/ARCHITECTURE_SIMULATORS.md) | Simulateurs temps réel | Avancé |
| [SCRIPTS_GUIDE](02-ARCHITECTURE/SCRIPTS_GUIDE.md) | Guide scripts système | Intermédiaire |

### ⚙️ Fonctionnalités

| Document | Description | Pages |
|----------|-------------|-------|
| [BOUCLE_FERMEE](03-FONCTIONNALITES/BOUCLE_FERMEE.md) | Feedback consommateur | 50+ |
| [FRONTEND_WEBSOCKET](03-FONCTIONNALITES/FRONTEND_WEBSOCKET.md) | WebSocket temps réel | 800+ |
| [ACCESSIBILITE_IA](03-FONCTIONNALITES/ACCESSIBILITE_IA.md) | Accès IA frontends | 300+ |
| [FONCTIONNALITES_AVANCEES](03-FONCTIONNALITES/FONCTIONNALITES_AVANCEES.md) | Features avancées | 400+ |

### 🔐 Authentification (Keycloak)

| Document | Description | Status |
|----------|-------------|--------|
| [INTEGRATION_KEYCLOAK](04-KEYCLOAK_AUTH/INTEGRATION_KEYCLOAK.md) | Guide intégration | ✅ Complet |
| [CONFIGURATION_GUIDE](04-KEYCLOAK_AUTH/CONFIGURATION_GUIDE.md) | Config détaillée (50+ pages) | ✅ Complet |
| [PLAN_INTEGRATION](04-KEYCLOAK_AUTH/PLAN_INTEGRATION.md) | Plan d'intégration | ✅ Complet |

### 🦆 Simulateurs Temps Réel

| Document | Description | Lignes |
|----------|-------------|--------|
| [SIMULATEURS_REALTIME](05-SIMULATEURS/SIMULATEURS_REALTIME.md) | Doc complète | 900+ |
| [SIMULATOR_GAVAGE](05-SIMULATEURS/SIMULATOR_GAVAGE.md) | Simulateur gavage | 400+ |
| [SIMULATOR_SQAL](05-SIMULATEURS/SIMULATOR_SQAL.md) | Simulateur SQAL | 300+ |
| [LOT_MONITOR](05-SIMULATEURS/LOT_MONITOR.md) | Monitoring auto | 200+ |

### 🤖 Intelligence Artificielle

| Document | Description | Algorithmes |
|----------|-------------|-------------|
| [GUIDE_ALGORITHMES](06-IA_ML/GUIDE_ALGORITHMES.md) | Guide complet | 9 algos |
| [ML_ALGORITHMS_STATUS](06-IA_ML/ML_ALGORITHMS_STATUS.md) | Status ML | - |
| [COMPLETION_IA](06-IA_ML/COMPLETION_IA.md) | Complétion IA | - |

**Algorithmes disponibles**:
1. Régression Symbolique (PySR)
2. Random Forest (Feedback Optimizer)
3. Prophet (Forecasting)
4. K-Means (Clustering)
5. Isolation Forest (Anomaly Detection)
6. Hungarian (Optimization)
7. CNN Vision (MobileNetV2)
8. Voice Assistant (Whisper)
9. NSGA-II (Multi-objective)

### 🔬 Contrôle Qualité SQAL

| Document | Description | Capteurs |
|----------|-------------|----------|
| [INTEGRATION_COMPLETE](07-SQAL/INTEGRATION_COMPLETE.md) | Intégration SQAL | VL53L8CH + AS7341 |
| [ARCHITECTURE](07-SQAL/ARCHITECTURE.md) | Architecture SQAL | - |
| [HOW_IT_WORKS](07-SQAL/HOW_IT_WORKS.md) | Fonctionnement | - |
| [WEBSOCKET_DATA_FLOW](07-SQAL/WEBSOCKET_DATA_FLOW.md) | Flux WebSocket | - |

### ✅ Rapports de Complétion

| Document | Description | Date |
|----------|-------------|------|
| [INTEGRATION_FINALE](08-COMPLETIONS/INTEGRATION_FINALE.md) | Intégration complète | 23/12/2025 |
| [SIMULATEURS_COMPLETE](08-COMPLETIONS/SIMULATEURS_COMPLETE.md) | Simulateurs terminés | 23/12/2025 |
| [STATUS_PROJET](08-COMPLETIONS/STATUS_PROJET.md) | Status général | 23/12/2025 |

---

## 🔍 Recherche rapide

### Par fonctionnalité

| Fonctionnalité | Document principal |
|----------------|-------------------|
| WebSocket temps réel | [FRONTEND_WEBSOCKET](03-FONCTIONNALITES/FRONTEND_WEBSOCKET.md) |
| Simulateurs gavage | [SIMULATEURS_REALTIME](05-SIMULATEURS/SIMULATEURS_REALTIME.md) |
| Authentification | [INTEGRATION_KEYCLOAK](04-KEYCLOAK_AUTH/INTEGRATION_KEYCLOAK.md) |
| Algorithmes IA | [GUIDE_ALGORITHMES](06-IA_ML/GUIDE_ALGORITHMES.md) |
| Capteurs IoT | [INTEGRATION_COMPLETE](07-SQAL/INTEGRATION_COMPLETE.md) |
| Boucle feedback | [BOUCLE_FERMEE](03-FONCTIONNALITES/BOUCLE_FERMEE.md) |

### Par cas d'usage

| Cas d'usage | Documents |
|-------------|-----------|
| **Démarrer le système** | [QUICKSTART](01-GUIDES_DEMARRAGE/QUICKSTART.md) + [DEMARRAGE_SIMULATEURS](01-GUIDES_DEMARRAGE/DEMARRAGE_SIMULATEURS.md) |
| **Développer une feature** | [ARCHITECTURE_UNIFIEE](02-ARCHITECTURE/ARCHITECTURE_UNIFIEE.md) + [SCRIPTS_GUIDE](02-ARCHITECTURE/SCRIPTS_GUIDE.md) |
| **Intégrer Keycloak** | [INTEGRATION_KEYCLOAK](04-KEYCLOAK_AUTH/INTEGRATION_KEYCLOAK.md) + [CONFIGURATION_GUIDE](04-KEYCLOAK_AUTH/CONFIGURATION_GUIDE.md) |
| **Tester les simulateurs** | [DEMARRAGE_SIMULATEURS](01-GUIDES_DEMARRAGE/DEMARRAGE_SIMULATEURS.md) + [SIMULATOR_GAVAGE](05-SIMULATEURS/SIMULATOR_GAVAGE.md) |
| **Utiliser l'IA** | [GUIDE_ALGORITHMES](06-IA_ML/GUIDE_ALGORITHMES.md) + [ACCESSIBILITE_IA](03-FONCTIONNALITES/ACCESSIBILITE_IA.md) |

---

## 📊 Statistiques du projet

### Code

- **Backend**: ~15,000 lignes (Python/FastAPI)
- **Frontend Gaveurs**: ~8,000 lignes (Next.js/TypeScript)
- **Frontend Euralis**: ~10,000 lignes (Next.js/TypeScript)
- **Frontend SQAL**: ~6,000 lignes (React/Vite/TypeScript)
- **Simulateurs**: ~2,000 lignes (Python)
- **Total**: **~41,000 lignes**

### Documentation

- **Documents**: 40+ fichiers
- **Pages**: ~3,000 lignes
- **Guides**: 15 guides pratiques
- **Diagrammes**: 20+ schémas

### Fonctionnalités

- **Endpoints API**: 50+ routes
- **Tables DB**: 38 tables (4 hypertables)
- **Algorithmes ML**: 9 algorithmes
- **Frontends**: 3 applications
- **Simulateurs**: 2 simulateurs temps réel

---

## 🆘 Support et Troubleshooting

### Problèmes fréquents

| Problème | Solution | Document |
|----------|----------|----------|
| Backend ne démarre pas | Vérifier DATABASE_URL | [QUICKSTART](01-GUIDES_DEMARRAGE/QUICKSTART.md) |
| WebSocket déconnecté | Vérifier backend running | [FRONTEND_WEBSOCKET](03-FONCTIONNALITES/FRONTEND_WEBSOCKET.md) |
| Simulateur erreur | Appliquer migrations | [DEMARRAGE_SIMULATEURS](01-GUIDES_DEMARRAGE/DEMARRAGE_SIMULATEURS.md) |
| Keycloak 404 | Démarrer Docker Keycloak | [INTEGRATION_KEYCLOAK](04-KEYCLOAK_AUTH/INTEGRATION_KEYCLOAK.md) |
| IA non accessible | Vérifier routes API | [GUIDE_ALGORITHMES](06-IA_ML/GUIDE_ALGORITHMES.md) |

### Logs utiles

```bash
# Backend logs
tail -f backend-api/logs/backend.log

# Simulateur logs
cd simulators/gavage_realtime && python main.py

# Frontend logs
# Console navigateur (F12)

# Database logs
docker logs gaveurs-timescaledb
```

---

## 🔗 Liens utiles

### Projets

- **Backend API**: http://localhost:8000 ([docs](http://localhost:8000/docs))
- **Frontend Gaveurs**: http://localhost:3001
- **Frontend Euralis**: http://localhost:3000/euralis/dashboard
- **Frontend SQAL**: http://localhost:5173
- **Keycloak**: http://localhost:8080

### Repositories

- Code source: `./`
- Documentation: `./documentation/`
- Simulateurs: `./simulators/`
- Scripts: `./scripts/`

---

## 📝 Contribuer à la documentation

Pour ajouter ou modifier la documentation :

1. Placer le fichier dans le dossier thématique approprié
2. Mettre à jour cet index (README.md)
3. Utiliser le format Markdown
4. Inclure des exemples de code
5. Ajouter des diagrammes si nécessaire

---

## 📅 Historique des versions

| Version | Date | Modifications |
|---------|------|---------------|
| 3.0 | 23/12/2025 | Intégration complète temps réel + WebSocket frontends |
| 2.1 | 20/12/2025 | Ajout SQAL + Keycloak + IA complète |
| 2.0 | 15/12/2025 | Backend unifié + 3 frontends |
| 1.0 | 10/12/2025 | Version initiale |

---

**Dernière mise à jour**: 25 Décembre 2024
**Mainteneur**: Projet Euralis Gaveurs V3.0
**Contributeur IA**: Claude Sonnet 4.5

---

## 🆕 NOUVEAUTÉS v3.0 (25 Décembre 2024)

- ✅ **[TESTS_GUIDE.md](TESTS_GUIDE.md)** - Guide complet tests backend (163 tests créés)
- ✅ **[BLOCKCHAIN_INTEGRATION.md](BLOCKCHAIN_INTEGRATION.md)** - Blockchain consumer feedback
- ✅ **[../PHASE_3_TESTS_RECAP.md](../PHASE_3_TESTS_RECAP.md)** - Récap Phase 3 Tests
- ✅ **[../INDEX.md](../INDEX.md)** - Nouvel index global documentation
