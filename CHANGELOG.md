# Changelog - Système Gaveurs V3.0

Toutes les modifications notables de ce projet sont documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

---

## [3.0.0] - 2025-01-15

### Ajouté

#### Phase 3: Infrastructure de Tests Complète
- **Backend Tests (163 tests)** - Pytest avec couverture complète
  - 12 tests de santé système
  - 16 tests E2E couvrant le flux complet (gaveur → qualité → consommateur)
  - 15 tests WebSocket (temps réel SQAL)
  - Tests unitaires pour tous les routers et services
  - Fixtures partagées pour les données de test

- **Frontend SQAL Tests (87 tests, 84% passent)**
  - Tests Jest pour tous les composants UI
  - Tests des hooks React personnalisés
  - Tests d'intégration WebSocket
  - Configuration Jest avec mocks Next.js et Recharts
  - 1.68% coverage (composants UI seulement)

- **Frontend Euralis Tests (106 tests, 97% passent)**
  - Tests complets des 7 pages du dashboard
  - Tests des 15+ composants UI réutilisables
  - Tests des services API
  - Configuration Jest complète

- **Frontend Gaveurs Tests (260 tests, 98.9% passent)**
  - Infrastructure de tests la plus complète
  - Tests de tous les composants blockchain
  - Tests des graphiques et visualisations
  - Tests des formulaires de saisie gavage
  - 6.41% coverage

- **Scripts de Tests Automatisés**
  - `scripts/run_tests.sh` - Orchestration complète des tests (Linux/macOS)
  - `scripts/run_tests.bat` - Version Windows
  - Installation automatique des dépendances de test
  - Génération de rapports de couverture HTML
  - Support pour tests unitaires, E2E, WebSocket séparément

- **Corrections TypeScript SQAL**
  - 16 erreurs TypeScript corrigées
  - Types Recharts pour les formatters
  - Types Keycloak pour onLoad
  - Gestion des propriétés optionnelles
  - Exports de modules corrigés

#### Phase 4: CI/CD et DevOps Production

- **GitHub Actions Workflow (`.github/workflows/ci-cd.yml`)**
  - Pipeline CI/CD complet avec 3 phases (Test, Build, Deploy)
  - Tests backend avec services PostgreSQL et Redis
  - Tests frontend en parallèle (matrix strategy)
  - Build multi-stage Docker pour toutes les images
  - Security scanning avec Trivy et Snyk
  - Coverage reporting vers Codecov
  - Déploiement automatique staging et production
  - Rollback automatique en cas d'échec
  - Notifications Slack/Discord
  - Workflow dispatch pour déploiements manuels
  - Support des tags de release

- **Docker Compose Production (`docker-compose.prod.yml`)**
  - Configuration optimisée pour production
  - 3 réseaux isolés (frontend, backend, db)
  - Utilisateurs non-root pour tous les services
  - Read-only filesystems où possible
  - Resource limits (CPU, memory)
  - Health checks pour tous les services
  - Log rotation avec json-file driver
  - SSL/TLS avec Let's Encrypt (Certbot)
  - Redis pour caching et sessions
  - Gunicorn avec 4 workers pour backend
  - Nginx reverse proxy optimisé

- **Multi-stage Dockerfiles Production**
  - `backend-api/Dockerfile.prod` - Python 3.11 + Julia + PySR
  - `euralis-frontend/Dockerfile.prod` - Next.js build + Nginx runtime
  - `gaveurs-frontend/Dockerfile.prod` - Next.js build + Nginx runtime
  - `sqal/Dockerfile.prod` - Vite build + Nginx runtime
  - `simulator-sqal/Dockerfile.prod` - Python simulator
  - Optimisation des images (multi-stage builds)
  - Cache layers pour builds rapides
  - Security hardening (non-root, minimal packages)

- **Scripts Backup/Restore Automatisés**
  - `scripts/backup.sh` - Script Linux/macOS (700+ lignes)
  - `scripts/backup.bat` - Script Windows (500+ lignes)
  - Support TimescaleDB avec hypertables
  - Compression (tar/gzip ou 7z)
  - Chiffrement GPG (AES256)
  - Upload vers AWS S3 ou Azure Blob Storage
  - Politiques de rétention (daily/weekly/monthly)
  - Notifications email et Slack
  - Mode dry-run pour tests
  - Logging détaillé avec timestamps
  - Vérification d'intégrité des backups
  - Script restore avec support décryption

#### Phase 5: Authentification Keycloak Centralisée

- **Documentation Keycloak Complète (`KEYCLOAK_SETUP.md`)**
  - Docker Compose pour Keycloak + PostgreSQL
  - Configuration du realm `sqal_realm`
  - 4 clients configurés (sqal-frontend, euralis-frontend, gaveurs-frontend, backend-api)
  - Hiérarchie de 6 rôles (super_admin → org_admin → quality_manager → production_operator → data_analyst → viewer)
  - Rôles composites configurés
  - 6 utilisateurs de test avec credentials
  - Backend JWT validation (Python + python-jose)
  - Decorators pour vérification des rôles
  - Tests d'authentification via curl
  - Configuration HTTPS pour production

- **Backend JWT Integration (`app/auth/keycloak.py`)**
  - Récupération de la clé publique Keycloak
  - Vérification et décodage des tokens JWT
  - Middleware `verify_token` pour routes protégées
  - Decorator `require_role` pour contrôle d'accès basé sur rôle
  - Decorator `require_any_role` pour rôles multiples acceptés
  - Gestion des erreurs 401 Unauthorized et 403 Forbidden
  - Support PKCE pour clients publics

#### Phase 7: Intégration Données Réelles et IA

- **Documentation Intégration Euralis (`INTEGRATION_DONNEES_REELLES_EURALIS.md`)**
  - Workflow complet d'import CSV (174 colonnes)
  - API endpoint `/api/euralis/import-csv` avec validation Pydantic
  - Feature engineering pour ML (total_duree_gavage, courbe_pente, progression_poids)
  - Nettoyage et normalisation des données
  - Gestion des valeurs manquantes et outliers
  - Intégration TimescaleDB hypertables

- **Guide Entraînement Modèles IA**
  - **PySR (Symbolic Regression)** pour prédiction ITM
    - Configuration optimale (100 iterations, 50 populations)
    - Feature engineering automatique
    - Équations mathématiques découvertes
    - Sauvegarde modèles en DB
    - API `/api/ml/pysr/train` et `/api/ml/pysr/predict`

  - **Prophet (Forecasting)** pour prévisions production
    - Prédictions 7/30/90 jours
    - Détection de saisonnalité
    - Gestion des jours fériés français
    - Intervals de confiance
    - API `/api/ml/prophet/train` et `/api/ml/prophet/forecast`

  - **K-Means Clustering** pour segmentation gaveurs
    - 5 clusters de performance (Excellence, Très bon, Bon, À surveiller, Critique)
    - Normalisation StandardScaler
    - Visualisation avec PCA
    - Recommandations personnalisées par cluster
    - API `/api/ml/clustering/train` et `/api/ml/clustering/predict`

  - **Isolation Forest** pour détection d'anomalies
    - Contamination 5%
    - Scores d'anomalie
    - Alertes automatiques
    - API `/api/ml/anomaly/train` et `/api/ml/anomaly/detect`

  - **Random Forest** pour optimisation feedback consommateur
    - Closed-loop optimization (consommateur → production)
    - Feature importance
    - Hyperparameter tuning avec GridSearchCV
    - Validation croisée 5-fold
    - API `/api/ml/feedback/train` et `/api/ml/feedback/optimize`

  - **Hungarian Algorithm** pour optimisation abattage
    - Matrice coûts distance × volume
    - Assignment optimal gaveurs → abattoirs
    - Minimisation coûts transport
    - API `/api/ml/abattage/optimize`

- **Pipeline Complet d'Entraînement**
  - Script d'orchestration `scripts/train_all_models.py`
  - Monitoring des performances modèles
  - Ré-entraînement périodique
  - Versioning des modèles
  - Rollback si dégradation performance

#### Documentation Complète

- **Guide de Déploiement Production (`GUIDE_DEPLOIEMENT_PRODUCTION.md`)**
  - Prérequis serveur et logiciels
  - Architecture complète avec diagrammes
  - Instructions déploiement initial étape par étape
  - Configuration CI/CD GitHub Actions
  - Backup/restore automatisés
  - Keycloak setup complet
  - Monitoring Prometheus/Grafana
  - Sécurité (firewall, fail2ban, SSL/TLS, Docker hardening)
  - Maintenance (mises à jour, nettoyage, logs rotation)
  - Troubleshooting (10+ problèmes courants avec solutions)
  - Checklist de déploiement
  - Variables d'environnement complètes

- **Changelog (`CHANGELOG.md`)**
  - Historique complet des modifications
  - Format Keep a Changelog
  - Semantic versioning

### Modifié

- **Scripts de Build et Démarrage**
  - `scripts/build.sh` et `build.bat` - Support build production
  - `scripts/start.sh` et `start.bat` - Support docker-compose.prod.yml
  - Détection automatique environnement (dev/prod)

- **Configuration Docker**
  - `docker-compose.yml` - Développement
  - `docker-compose.prod.yml` - Production (nouveau)
  - Séparation claire dev vs prod

- **Configuration Nginx**
  - Support WebSocket (Upgrade headers)
  - SSL/TLS configuration moderne
  - HSTS, OCSP stapling
  - Rate limiting
  - Compression gzip

- **Backend API**
  - Ajout endpoints ML training et monitoring
  - Integration Keycloak JWT
  - Amélioration gestion erreurs
  - Logging structuré

- **Documentation Principale**
  - README.md mis à jour avec nouvelles phases
  - CLAUDE.md avec nouveaux chemins
  - Index documentation dans documentation/

### Corrigé

- **TypeScript Compilation SQAL**
  - 16 erreurs TypeScript corrigées
  - Types Recharts pour formatters de graphiques
  - Type Keycloak `onLoad` avec unions littérales
  - Gestion propriétés optionnelles (`color?`)
  - Exports de modules ES6

- **Tests Frontend**
  - Mocks lucide-react pour tests Jest
  - Configuration jest.setup.ts complète
  - Types TypeScript pour mocks
  - Imports CSS dans tests

- **Performance Database**
  - Indexes optimisés pour requêtes ML
  - Continuous aggregates rafraîchies
  - Connection pooling configuré

- **Sécurité**
  - CORS restrictif en production
  - Secrets externalisés (.env)
  - Non-root users Docker
  - Read-only filesystems

### Déprécié

- Scripts bash sans support Windows
  - Maintenant tous les scripts ont version `.sh` ET `.bat`

### Supprimé

- Aucune suppression majeure dans cette version

### Sécurité

- **Chiffrement**
  - GPG AES256 pour backups
  - SSL/TLS 1.2+ uniquement
  - HTTPS obligatoire en production

- **Authentification**
  - JWT tokens avec RS256
  - PKCE pour clients publics
  - RBAC avec 6 rôles hiérarchiques

- **Docker**
  - Non-root users
  - Resource limits
  - Network isolation
  - No privileged containers

- **API**
  - Rate limiting (SlowAPI)
  - CORS restrictif
  - Input validation (Pydantic)
  - SQL injection prevention (parameterized queries)

- **Monitoring**
  - Security scanning Trivy
  - Dependency scanning Snyk
  - Fail2Ban pour SSH
  - Audit logging PostgreSQL

---

## [2.0.0] - 2024-12-XX (Pré-existant)

### Résumé des Fonctionnalités V2

- Backend FastAPI unifié avec 3 frontends
- TimescaleDB avec 38+ tables et 4 hypertables
- 6 modèles ML/IA (PySR, Prophet, K-Means, Isolation Forest, Random Forest, Hungarian)
- Closed feedback loop (consommateur → production)
- SQAL IoT sensors (VL53L8CH ToF + AS7341 Spectral)
- WebSocket temps réel
- Blockchain traceability (QR codes)
- Euralis multi-site supervision (174 colonnes CSV)

---

## Structure des Versions

Le projet suit le [Semantic Versioning](https://semver.org/) :

```
MAJOR.MINOR.PATCH

MAJOR: Changements incompatibles de l'API
MINOR: Ajout de fonctionnalités rétrocompatibles
PATCH: Corrections de bugs rétrocompatibles
```

### Versions Planifiées

- **v3.1.0** - Frontend Keycloak integration (Euralis + Gaveurs login flows)
- **v3.2.0** - Monitoring avancé avec Prometheus/Grafana dashboards
- **v3.3.0** - Tests E2E complets (Playwright)
- **v4.0.0** - Production ready avec tous les tests passants à 100%

---

## Contribution

Pour contribuer à ce projet :

1. Créer une branche feature (`git checkout -b feature/AmazingFeature`)
2. Commit les changements (`git commit -m 'Add AmazingFeature'`)
3. Push vers la branche (`git push origin feature/AmazingFeature`)
4. Ouvrir une Pull Request

Voir [CONTRIBUTING.md](CONTRIBUTING.md) pour plus de détails.

---

## Support

- **Documentation**: `documentation/`
- **Issues**: https://github.com/votre-org/projet-euralis-gaveurs/issues
- **Email**: support@votredomaine.com

---

**Dernière mise à jour**: 2025-01-15
**Version actuelle**: 3.0.0
