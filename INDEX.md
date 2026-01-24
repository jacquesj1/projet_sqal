# 📚 INDEX - Système Gaveurs V3.0

**Version**: 3.0.0
**Date**: 25 décembre 2024
**Status**: Production Ready + Phase 3 Tests (84% complété)

---

## 🚀 DÉMARRAGE RAPIDE

### Pour Utilisateurs
- 📖 **[README.md](README.md)** - Vue d'ensemble complète du projet
- ⚡ **[DEMARRAGE_RAPIDE.md](DEMARRAGE_RAPIDE.md)** - Guide démarrage 5 minutes
- 🎮 **[DEMARRAGE_SIMULATEURS.md](DEMARRAGE_SIMULATEURS.md)** - Démarrer simulateurs IoT

### Pour Développeurs
- 🏗️ **[CLAUDE.md](CLAUDE.md)** - Instructions pour Claude Code (IA)
- 📜 **[NOUVEAUX_SCRIPTS_README.md](NOUVEAUX_SCRIPTS_README.md)** - Guide scripts build/start/test

---

## 📂 DOCUMENTATION PRINCIPALE

### 🎯 Statut & Roadmap
| Document | Description | Status |
|----------|-------------|--------|
| **[documentation/STATUS_PROJET.md](documentation/STATUS_PROJET.md)** | État complet du projet (100% fonctionnel) | ✅ À JOUR |
| **[PHASE_3_TESTS_RECAP.md](PHASE_3_TESTS_RECAP.md)** | Récap Phase 3 Tests (163 tests créés) | ✅ NOUVEAU |
| **[NEXT_STEPS.md](NEXT_STEPS.md)** | Prochaines étapes (Phases 2-12) | ✅ À JOUR |
| **[CHANGELOG.md](CHANGELOG.md)** | Historique des changements | ✅ Actif |

### 🏛️ Architecture
| Document | Description | Emplacement |
|----------|-------------|-------------|
| **Architecture Unifiée** | Backend partagé + 3 frontends | [documentation/ARCHITECTURE_UNIFIEE.md](documentation/ARCHITECTURE_UNIFIEE.md) |
| **Boucle Fermée Complète** | Gaveurs → SQAL → Consumer → IA | [documentation/SYSTEME_COMPLET_BOUCLE_FERMEE.md](documentation/SYSTEME_COMPLET_BOUCLE_FERMEE.md) |
| **Intégration SQAL** | WebSocket temps réel + IoT | [documentation/INTEGRATION_SQAL_COMPLETE.md](documentation/INTEGRATION_SQAL_COMPLETE.md) |

### 🧪 Tests (Phase 3)
| Document | Description | Status |
|----------|-------------|--------|
| **[documentation/TESTS_GUIDE.md](documentation/TESTS_GUIDE.md)** | Guide complet tests backend (pytest) | ✅ NOUVEAU |
| **[documentation/GUIDE_TESTS_FRONTEND.md](documentation/GUIDE_TESTS_FRONTEND.md)** | 📘 Guide complet tests frontend (Jest + RTL) | ✅ NOUVEAU |
| **[documentation/EURALIS_TESTS_RECAP.md](documentation/EURALIS_TESTS_RECAP.md)** | 📊 Récap 95+ tests Euralis frontend | ✅ NOUVEAU ⭐ |
| **[PHASE_3_TESTS_RECAP.md](PHASE_3_TESTS_RECAP.md)** | Récap 163 tests backend créés | ✅ NOUVEAU |
| **[FRONTEND_TESTS_RECAP.md](FRONTEND_TESTS_RECAP.md)** | Récap 177+ tests frontend créés (Euralis + SQAL) | ✅ MIS À JOUR ⭐ |

### 🔗 Blockchain
| Document | Description | Status |
|----------|-------------|--------|
| **[documentation/BLOCKCHAIN_INTEGRATION.md](documentation/BLOCKCHAIN_INTEGRATION.md)** | Intégration blockchain consumer feedback | ✅ NOUVEAU |

### 📜 Scripts
| Document | Description | Status |
|----------|-------------|--------|
| **[documentation/SCRIPTS_GUIDE.md](documentation/SCRIPTS_GUIDE.md)** | Guide complet scripts (build/start/test) | ✅ À JOUR |

---

## 🗂️ DOCUMENTATION PAR THÈME

### 01 - Guides Démarrage
📁 **[documentation/01-GUIDES_DEMARRAGE/](documentation/01-GUIDES_DEMARRAGE/)**
- Quick Start
- Installation
- Configuration environnement

### 02 - Architecture
📁 **[documentation/02-ARCHITECTURE/](documentation/02-ARCHITECTURE/)**
- Architecture unifiée
- Boucle feedback fermée
- Schémas base de données

### 03 - Fonctionnalités
📁 **[documentation/03-FONCTIONNALITES/](documentation/03-FONCTIONNALITES/)**
- Modules IA/ML (6 algorithmes)
- Consumer Feedback
- QR Codes + Blockchain

### 04 - Keycloak Auth
📁 **[documentation/04-KEYCLOAK_AUTH/](documentation/04-KEYCLOAK_AUTH/)**
- Configuration Keycloak
- JWT tokens
- Sécurité multi-rôles

### 05 - Simulateurs
📁 **[documentation/05-SIMULATEURS/](documentation/05-SIMULATEURS/)**
- Simulateur SQAL (VL53L8CH + AS7341)
- Digital Twin
- Configuration I2C

### 06 - IA & ML
📁 **[documentation/06-IA_ML/](documentation/06-IA_ML/)**
- PySR (Régression symbolique)
- Prophet (Prévisions)
- K-Means (Clustering)
- Isolation Forest (Anomalies)
- Hungarian (Optimisation abattages)
- Feedback Optimizer (Boucle fermée)

### 07 - SQAL
📁 **[documentation/07-SQAL/](documentation/07-SQAL/)**
- Architecture SQAL
- WebSocket flux temps réel
- Capteurs ToF + Spectral

### 08 - Compléments
📁 **[documentation/08-COMPLETIONS/](documentation/08-COMPLETIONS/)**
- Rapports de complétion
- Sessions de développement
- Logs projets

---

## 📊 FICHIERS TECHNIQUES

### Backend
- `backend-api/pytest.ini` - Config tests pytest
- `backend-api/run_tests.sh` - Exécution tests Linux/Mac
- `backend-api/run_tests.bat` - Exécution tests Windows

### Scripts
- `scripts/build.sh` - Build tous les services
- `scripts/start.sh` - Démarrer services
- `scripts/stop.sh` - Arrêter services
- `scripts/health_check.py` - Vérifier santé système

### Docker
- `docker-compose.yml` - Configuration Docker complète

---

## 🔢 STATISTIQUES PROJET

```
📦 Composants:
  ├─ Backend API (FastAPI)       ✅ 75+ endpoints
  ├─ Frontend Euralis (Next.js)  ✅ 7 pages
  ├─ Frontend Gaveurs (Next.js)  ✅ 12 pages
  └─ Frontend SQAL (React+Vite)  ✅ 5 pages

🗄️ Base de Données (TimescaleDB):
  ├─ Tables totales: 38
  ├─ Hypertables: 4
  └─ Continuous Aggregates: 8

🧠 Modules IA/ML: 6
  ├─ PySR (Régression symbolique)
  ├─ Prophet (Prévisions 7/30/90j)
  ├─ K-Means (Clustering 5 groupes)
  ├─ Isolation Forest (Anomalies)
  ├─ Hungarian (Optimisation)
  └─ Feedback Optimizer (Boucle fermée) ⭐

🔗 Blockchain:
  ├─ Events: 5 types
  ├─ Chaînage: SHA-256
  └─ Signatures: RSA-2048

🧪 Tests (Phase 3):
  ├─ Tests backend: 163 (pytest, httpx)
  ├─ Tests frontend: 62+ (Jest, RTL)
  ├─ Coverage backend: 75-80%
  ├─ Coverage frontend: ~35%
  └─ Total tests: 225+

📝 Lignes de code totales: ~40,800+
```

---

## 🎯 ROADMAP

### ✅ COMPLÉTÉ
- [x] **Phase 1**: Backend + Frontend + Simulateur (100%)
- [x] **Phase 2**: Intégration SQAL temps réel (100%)
- [x] **Blockchain**: Traçabilité consumer feedback (100%)
- [x] **Phase 3 Backend**: Tests Backend (163 tests, 75-80% coverage)
- [x] **Phase 3 Frontend (62%)**: Tests Frontend (62/100 tests, 35% coverage)

### ⏳ EN COURS
- [ ] **Phase 3**: Tests Frontend + E2E + Coverage
- [ ] **Phase 4**: CI/CD + Docker production
- [ ] **Phase 5**: Keycloak authentification
- [ ] **Phase 6**: App Mobile React Native
- [ ] **Phase 7**: IA réelle + données production

Voir **[NEXT_STEPS.md](NEXT_STEPS.md)** pour détails complets.

---

## 📞 SUPPORT

### Problèmes Courants
1. **Services ne démarrent pas**: Vérifier [DEMARRAGE_RAPIDE.md](DEMARRAGE_RAPIDE.md)
2. **Tests échouent**: Voir [documentation/TESTS_GUIDE.md](documentation/TESTS_GUIDE.md)
3. **Scripts erreurs**: Consulter [NOUVEAUX_SCRIPTS_README.md](NOUVEAUX_SCRIPTS_README.md)

### Commandes Utiles
```bash
# Health check complet
python scripts/health_check.py

# Tests backend
cd backend-api && ./run_tests.sh all

# Build tout
./scripts/build.sh all

# Démarrer tout
./scripts/start.sh all
```

---

## 📝 NOTES IMPORTANTES

### Fichiers Critiques (NE PAS MODIFIER)
- `CLAUDE.md` - Instructions IA
- `README.md` - Documentation principale
- `documentation/STATUS_PROJET.md` - État du projet

### Fichiers Archivés
Les anciens fichiers de documentation ont été déplacés vers:
- `documentation/archive/` - Anciennes versions
- `documentation/08-COMPLETIONS/` - Rapports sessions

---

**Dernière mise à jour**: 25 décembre 2024
**Contributeur**: Claude Sonnet 4.5
**Version documentation**: 3.0.0
