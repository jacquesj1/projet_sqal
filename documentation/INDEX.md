# Index Documentation - Système Gaveurs V3.0

Guide complet pour naviguer dans toute la documentation du projet.

---

## 🚀 Démarrage Rapide

Nouveau dans le projet ? Commencez par ces documents :

1. **[README.md](../README.md)** - Vue d'ensemble du projet
2. **[DEMARRAGE_RAPIDE.md](DEMARRAGE_RAPIDE.md)** - Guide de démarrage 5 minutes
3. **[CLAUDE.md](../CLAUDE.md)** - Instructions pour Claude Code

---

## 📚 Documentation par Phase

### Phase 1-2: Architecture

- **[SYSTEME_COMPLET_BOUCLE_FERMEE.md](SYSTEME_COMPLET_BOUCLE_FERMEE.md)** - Vue complète système + boucle feedback
- **[ARCHITECTURE_UNIFIEE.md](ARCHITECTURE_UNIFIEE.md)** - Backend FastAPI + TimescaleDB (38+ tables)
- **[INTEGRATION_SQAL_COMPLETE.md](INTEGRATION_SQAL_COMPLETE.md)** - SQAL IoT sensors + WebSocket
- **[SQAL_WEBSOCKET_DATA_FLOW.md](SQAL_WEBSOCKET_DATA_FLOW.md)** - Flow WebSocket détaillé

### Phase 3: Tests

- Backend: 163 tests (Pytest)
- SQAL: 87 tests Jest (84%)
- Euralis: 106 tests Jest (97%)
- Gaveurs: 260 tests Jest (98.9%)
- Scripts: `scripts/run_tests.sh` et `.bat`

### Phase 4: CI/CD et DevOps

- **[GUIDE_DEPLOIEMENT_PRODUCTION.md](GUIDE_DEPLOIEMENT_PRODUCTION.md)** ⭐ **NOUVEAU**
  - Déploiement production complet
  - CI/CD GitHub Actions
  - Docker Compose production
  - Backup/restore automatisés
  - Monitoring, sécurité, troubleshooting

### Phase 5: Authentification

- **[KEYCLOAK_SETUP.md](KEYCLOAK_SETUP.md)** ⭐ **NOUVEAU**
  - Keycloak Docker setup
  - 4 clients (frontends + backend)
  - 6 rôles hiérarchiques
  - JWT validation backend

### Phase 7: Données et IA

- **[INTEGRATION_DONNEES_REELLES_EURALIS.md](INTEGRATION_DONNEES_REELLES_EURALIS.md)** ⭐ **NOUVEAU**
  - Import CSV Euralis (174 colonnes)
  - 6 modèles ML/IA (PySR, Prophet, K-Means, Isolation Forest, Random Forest, Hungarian)
  - Pipeline d'entraînement complet
- **[PYSR_GUIDE.md](PYSR_GUIDE.md)** ⭐ **NOUVEAU**
  - Guide PySR - Régression Symbolique
  - Script toggle pour activer/désactiver PySR
  - Mode rapide (15s) vs mode IA (2min)
- **[Courbes-Gavage-IA/](Courbes-Gavage-IA/)** ⭐ **SPRINT 4 - NOUVEAU**
  - Documentation complète courbe prédictive IA
  - Algorithme rattrapage progressif avec lissage 80/20
  - Visualisations graphiques ASCII
  - Guide debugging erreurs 500
  - Récapitulatif Sprint 4

---

## 🛠️ Guides Techniques

### Scripts

- **[SCRIPTS_GUIDE.md](SCRIPTS_GUIDE.md)** - Guide complet scripts build/start/test
- **[NOUVEAUX_SCRIPTS_README.md](NOUVEAUX_SCRIPTS_README.md)** - Vue d'ensemble scripts

### Fichiers Créés Phase 4-7

**CI/CD**:
- `.github/workflows/ci-cd.yml` - Pipeline complet (test, build, deploy)

**Docker Production**:
- `docker-compose.prod.yml`
- `backend-api/Dockerfile.prod`
- `euralis-frontend/Dockerfile.prod`
- `gaveurs-frontend/Dockerfile.prod`
- `sqal/Dockerfile.prod`
- `simulator-sqal/Dockerfile.prod`

**Backup/Restore**:
- `scripts/backup.sh` (Linux/macOS, 700+ lignes)
- `scripts/backup.bat` (Windows, 500+ lignes)

---

## 📖 Changelog et Versions

- **[CHANGELOG.md](../CHANGELOG.md)** ⭐ **NOUVEAU** - Historique complet
  - v3.0.0 (2025-01-15) - Tests, CI/CD, Keycloak, Production, IA
  - v2.0.0 (2024-12-XX) - Version initiale

---

## 🔍 Recherche Rapide par Fonctionnalité

- **Boucle feedback** → SYSTEME_COMPLET_BOUCLE_FERMEE.md
- **WebSocket** → SQAL_WEBSOCKET_DATA_FLOW.md
- **Authentification** → KEYCLOAK_SETUP.md
- **Déploiement** → GUIDE_DEPLOIEMENT_PRODUCTION.md
- **CI/CD** → .github/workflows/ci-cd.yml + GUIDE_DEPLOIEMENT_PRODUCTION.md
- **Backup** → scripts/backup.sh + GUIDE_DEPLOIEMENT_PRODUCTION.md
- **IA/ML** → INTEGRATION_DONNEES_REELLES_EURALIS.md
- **Courbe Prédictive IA** → Courbes-Gavage-IA/README.md ⭐ SPRINT 4
- **Tests** → SCRIPTS_GUIDE.md

---

## 📁 Structure Documentation

```
documentation/
├── INDEX.md (ce fichier) ⭐
├── GUIDE_DEPLOIEMENT_PRODUCTION.md ⭐ NOUVEAU
├── KEYCLOAK_SETUP.md ⭐ NOUVEAU
├── INTEGRATION_DONNEES_REELLES_EURALIS.md ⭐ NOUVEAU
├── SYSTEME_COMPLET_BOUCLE_FERMEE.md
├── ARCHITECTURE_UNIFIEE.md
├── INTEGRATION_SQAL_COMPLETE.md
├── SQAL_WEBSOCKET_DATA_FLOW.md
├── SCRIPTS_GUIDE.md
├── NOUVEAUX_SCRIPTS_README.md
├── DEMARRAGE_RAPIDE.md
└── Courbes-Gavage-IA/ ⭐ SPRINT 4 - NOUVEAU
    ├── README.md (index du répertoire)
    ├── ALGO_COURBE_PREDICTIVE.md (technique détaillé)
    ├── VISUAL_ALGO_PREDICTIVE.md (graphiques ASCII)
    ├── FIX_PREDICTIVE_500.md (debugging)
    └── SPRINT4_SUCCESS.md (récapitulatif)

Racine/
├── README.md
├── CLAUDE.md
└── CHANGELOG.md ⭐ NOUVEAU
```

---

**Dernière mise à jour**: 2026-01-10 | **Version**: 3.0.0 (Sprint 4 en cours)
