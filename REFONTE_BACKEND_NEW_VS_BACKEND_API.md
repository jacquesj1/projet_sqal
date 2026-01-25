# Refonte cible “backend_new” vs backend-api (cadrage)

## 1. Objectif

Ce document décrit ce que doit accomplir une refonte du `backend-api` vers une architecture inspirée de `sqal/backend_new` (dite “backend_new”), tout en conservant la continuité fonctionnelle de la démo et en limitant les risques.

L’objectif n’est pas de “tout réécrire” immédiatement, mais de définir une cible claire et un plan de migration incrémental.

## 2. Constat actuel (backend-api)

- API FastAPI existante, orientée démo.
- Accès DB principalement via `asyncpg` (SQL manuel) et services applicatifs.
- SQAL: ingestion et lecture historiques, migration en cours vers SQLAlchemy ORM (double-write, puis bascule des reads).
- Fonctionnalités “core” (observabilité, résilience, cache, rate limiting, etc.) peu structurées ou incomplètes.

## 3. Cible (backend_new) : ce que la refonte apporte

### 3.1 Architecture modulaire

**Cible**
- Un découpage explicite en modules “core” (transverses) et “routers” (domaines).
- Séparation nette entre:
  - `app/core/*` (infrastructure: DB, cache, rate limit, metrics, health, etc.)
  - `app/models/*` (ORM)
  - `app/schemas/*` (Pydantic)
  - `app/routers/*` (endpoints)
  - `app/services/*` (logique métier)

**Valeur**
- Meilleure maintenabilité, ajout de features plus rapide, isolation des responsabilités.

### 3.2 Modèle de données enrichi (SQAL + ML)

**Cible**
- Standardiser l’écriture/lecture via ORM (SQLAlchemy async) sur les tables cibles (`sensor_samples`, etc.).
- Étendre progressivement le modèle de données pour supporter:
  - enrichissement ML (features, scores, explications)
  - suivi des modèles (registry), entraînements, prédictions (si nécessaire)
  - traçabilité/audit (si requis)

**Valeur**
- Base propre pour industrialiser les usages ML et la traçabilité.

### 3.3 “Core” production-ready

**Cible**
- Ajouter/standardiser des briques:
  - health checks cohérents
  - métriques
  - cache (Redis)
  - rate limiting
  - gestion de shutdown
  - patterns de résilience (circuit breaker / retry) là où c’est critique

**Valeur**
- Robustesse prod, diagnostic plus simple, meilleure maîtrise des coûts/latences.

### 3.4 Auth / multi-tenancy / RBAC (si requis)

**Cible**
- Centraliser la configuration auth (Keycloak) et la gestion des permissions.
- Introduire la notion d’organisation / device / audit log si nécessaire.

**Valeur**
- Sécurité, extensibilité pour plusieurs “cas d’usage” et clients.

## 4. Contraintes

- Ne pas casser la démo.
- Conserver les endpoints existants (ou fournir compat + versioning).
- Migration progressive, avec capacité de rollback.
- Éviter d’embarquer des secrets dans Git (fichiers `.env*` non versionnés, uniquement des `.env.example`).

## 5. Plan de migration recommandé (incrémental)

### Phase A — Stabiliser la migration ORM dans backend-api (court terme)

**But**: finir la migration SQAL vers ORM (writes/reads) tout en gardant les endpoints.

Livrables:
- Double-write maintenu temporairement
- Bascule complète des lectures vers `sensor_samples`
- (Option) dépréciation/suppression de l’ancien stockage après validation

### Phase B — Introduire l’architecture modulaire dans backend-api (sans réécrire)

**But**: refactoriser l’organisation du code (pas le comportement).

Actions:
- Créer un `app/core/` dans `backend-api` et y déplacer progressivement:
  - DB (SQLAlchemy session factory / engine)
  - config
  - health / metrics
- Réorganiser les routers par domaine

### Phase C — Convergence “backend_new”

**But**: aligner les patterns et briques avec `backend_new`.

Actions:
- Reprendre les modules core utiles (cache, rate limit, circuit breaker) avec un périmètre minimal.
- Harmoniser les modèles/schemas (Pydantic) et la validation des messages.
- Intégrer progressivement les endpoints ML (registry, training jobs, predictions) si et seulement si nécessaire.

### Phase D — Décision finale: unifier ou séparer

Deux options:
- **Option 1 (monorepo / un backend unique)**: `backend-api` devient la base et adopte les patterns `backend_new`.
- **Option 2 (deux backends)**: `backend_new` devient un produit SQAL séparé, `backend-api` reste “gaveurs / orchestration”.

Critères de décision:
- besoin réel d’API ML/IA “produit”
- coût de maintenance
- exigences de sécurité/tenancy

## 6. Points de vigilance / risques

- Incompatibilités de schéma DB / migrations: nécessité d’Alembic propre + validations.
- Dérive de scope (refonte trop large).
- Secrets/Push protection GitHub: bannir les `.env` versionnés.
- Changements d’endpoints: prévoir compat ou versioning.

## 7. Définition de “Done” pour la refonte

- Le backend est structuré par modules (core/models/schemas/routers/services).
- Toutes les opérations SQAL critiques passent par ORM.
- Observabilité minimale en place (health, métriques).
- Stratégie de déploiement claire (docker-compose / prod) et configuration non sensible versionnée (exemples).
- Les endpoints nécessaires à la démo fonctionnent sans régression.

