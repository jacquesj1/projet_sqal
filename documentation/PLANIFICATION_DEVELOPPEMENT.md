# 📅 Planification Développement - Système Gaveurs V3.0

**Date création**: 14 Janvier 2026
**Dernière mise à jour**: 14 Janvier 2026
**Status**: 🔄 En cours

---

## ✅ **Travaux Terminés Aujourd'hui** (14 Janvier 2026)

### 1. Fix Site Analytics - Gaveurs Clustering
- **Fichier**: `euralis-frontend/app/euralis/sites/[code]/analytics/page.tsx:88-90`
- **Problème**: Aucun gaveur ne montrait de cluster
- **Solution**: Changé de `getGaveurClusters()` à `getGaveursPerformances(siteCode)`
- **Status**: ✅ Terminé

### 2. Fix Performance vs Sites - N/A Values
- **Fichier**: `backend-api/app/routers/euralis.py:199-223`
- **Problème**: Table comparaison affichait N/A pour toutes les métriques
- **Solution**: Endpoint retourne maintenant tous les champs (itm_moyen, mortalite, production_kg, rank)
- **Status**: ✅ Code modifié - ⚠️ **NÉCESSITE RESTART BACKEND**

### 3. Fix Analytics Gaveur - Heatmap Display
- **Fichier**: `gaveurs-frontend/components/analytics/HeatmapPerformance.tsx`
- **Problème**: Message vague quand lots manquaient
- **Solution**:
  - Retiré limite `.slice(0, 10)`
  - Ajouté tracking "X lots total, Y lots avec données"
  - Message amélioré avec instructions claires
- **Status**: ✅ Terminé

### 4. Page Prévisions - Vue 3 Sites Unifiée ⭐
- **Fichier**: `euralis-frontend/app/euralis/previsions/page.tsx`
- **Nouveauté**: Option "🌍 Tous les Sites (Vue Unifiée)"
- **Fonctionnalités**:
  - Fetch parallèle des 3 sites (LL, LS, MT)
  - Agrégation production par date
  - KPIs combinés avec indicateur "(3 sites)"
  - Utilise vraie API Prophet `/api/euralis/ml/forecasts`
- **Status**: ✅ Terminé

### 5. Fix Sankey Flux Production
- **Fichier**: `gaveurs-frontend/components/analytics/SankeyFluxProduction.tsx:83`
- **Problème**: Affichait "Lot 121" au lieu de "LL2512001"
- **Solution**: Utilise maintenant `lot.code_lot` au lieu de `lot.id`
- **Status**: ✅ Terminé

### 6. Retrait Réseau Corrélations
- **Fichier**: `gaveurs-frontend/app/analytics/page.tsx`
- **Raison**: Visualisation peu utile selon utilisateur
- **Actions**:
  - Retiré import `NetworkGraphCorrelations`
  - Retiré type `'network'` de `TabId`
  - Retiré onglet interface
  - Retiré section aide
- **Status**: ✅ Terminé

---

## 🔥 **Actions Urgentes** (À faire immédiatement)

### 1. Restart Backend ⚠️ PRIORITÉ HAUTE
**Pourquoi**: Activer le fix "Performance vs Sites"

```bash
cd backend-api
# Arrêter le backend actuel (Ctrl+C)
venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```

**Validation**: Vérifier que `http://localhost:3000/euralis/sites/LL/analytics` affiche des valeurs au lieu de N/A dans la table "Performance vs Sites"

---

## 📊 **Phase 2 - Court Terme** (1-2 semaines)

### Priorité 1: UX & Visualisations

#### 2.1. Graphiques Détails Site
- **Fichier cible**: `euralis-frontend/app/euralis/sites/[code]/page.tsx`
- **Technologies**: Chart.js ou Recharts
- **Graphiques à ajouter**:
  - Évolution ITM moyen par mois (ligne)
  - Répartition lots par statut (camembert)
  - Production hebdomadaire (barres)
  - Tendance mortalité (ligne)
- **Estimation**: 4-6 heures
- **Status**: ⏳ Pending

#### 2.2. Export Excel Lots
- **Fichier cible**: `gaveurs-frontend/app/lots/page.tsx`
- **Bibliothèque**: `xlsx` ou `exceljs`
- **Fonctionnalités**:
  - Bouton "Export Excel" dans header
  - Export tous les lots ou filtrés
  - Colonnes: code_lot, statut, nombre_canards, race, dates, performances
  - Format `.xlsx`
- **Estimation**: 2-3 heures
- **Status**: ⏳ Pending

### Priorité 2: Gestion & Organisation

#### 2.3. Page Gestion Alertes Dédiée
- **Route**: `/euralis/alertes`
- **Fonctionnalités**:
  - Liste complète des alertes (pagination)
  - Filtres: site, criticité, date, acquittée/non-acquittée
  - Acquittement individuel ou batch
  - Statistiques alertes (nombre par criticité)
  - Export CSV/PDF
- **API existante**: `/api/euralis/alertes` (déjà fonctionnelle)
- **Estimation**: 6-8 heures
- **Status**: ⏳ Pending

#### 2.4. Filtres Avancés Page Lots
- **Fichier**: `gaveurs-frontend/app/lots/page.tsx`
- **Filtres à ajouter**:
  - Plage de dates (début/fin)
  - Recherche par code_lot ou ID
  - Multi-select races
  - Tri (date, nombre canards, statut)
  - Sauvegarde filtres dans localStorage
- **Estimation**: 4-5 heures
- **Status**: ⏳ Pending

### Priorité 3: Temps Réel

#### 2.5. WebSocket Notifications Temps Réel
- **Backend**: Déjà implémenté (`/ws/realtime/`)
- **Frontend à modifier**:
  - `euralis-frontend/app/euralis/dashboard/page.tsx`
  - `gaveurs-frontend/app/dashboard/page.tsx`
- **Fonctionnalités**:
  - Toast notifications pour nouvelles alertes
  - Badge compteur alertes non-lues
  - Son notification (optionnel)
  - Auto-refresh données dashboard
- **Estimation**: 5-6 heures
- **Status**: ⏳ Pending

---

## 🔐 **Phase 3 - Moyen Terme** (2-4 semaines)

### 3.1. JWT + Refresh Tokens
- **Fichiers**:
  - `backend-api/app/routers/auth.py` (à créer)
  - `backend-api/app/middleware/auth.py` (à créer)
  - Tous les frontends (intercepteurs HTTP)
- **Fonctionnalités**:
  - Remplacer tokens temporaires par JWT
  - Access token (15 min) + Refresh token (7 jours)
  - Middleware vérification sur toutes les routes protégées
  - Auto-refresh avant expiration (frontend)
  - Blacklist tokens révoqués (Redis)
- **Estimation**: 12-15 heures
- **Status**: ⏳ Pending

### 3.2. Tests E2E (Playwright)
- **Fichiers**: `tests/e2e/` (nouveau dossier)
- **Scénarios à tester**:
  - Login → Dashboard → Lots → Analytics (flow complet)
  - Création nouveau lot
  - Saisie doses gavage
  - Génération courbe PySR
  - WebSocket temps réel
  - Export Excel
- **Estimation**: 15-20 heures
- **Status**: ⏳ Pending

---

## 🤖 **Phase 4 - Long Terme** (1-2 mois)

### 4.1. IA - Fonctionnalités Individuelles Gaveur

#### 4.1.1. Courbes Optimales PySR Individuelles
- **Endpoint**: `/api/euralis/gaveurs/{id}/courbes-optimales`
- **Fonctionnalité**: PySR appliqué aux données d'un gaveur spécifique
- **Estimation**: 8-10 heures

#### 4.1.2. Doses Recommandées (Feedback Loop)
- **Endpoint**: `/api/euralis/gaveurs/{id}/doses-recommandees`
- **Fonctionnalité**: Random Forest utilisant feedbacks QR consommateurs
- **Estimation**: 10-12 heures

#### 4.1.3. Prévisions Prophet Individuelles
- **Endpoint**: `/api/euralis/gaveurs/{id}/previsions`
- **Fonctionnalité**: Prophet au niveau gaveur (pas juste site)
- **Estimation**: 6-8 heures

### 4.2. Interface Saisie Rapide (Accessibilité IA)

#### 4.2.1. Upload Vision (Photo Dose)
- **Route**: `/gaveurs/saisie-rapide`
- **Technologie**: API Vision (OpenAI ou Google Cloud Vision)
- **Fonctionnalité**: Photo balance → OCR → auto-saisie dose
- **Estimation**: 15-20 heures

#### 4.2.2. Voice Input (Saisie Vocale)
- **Technologie**: Web Speech API ou Whisper
- **Fonctionnalité**: "Lot 1234, dose 450 grammes" → auto-saisie
- **Estimation**: 10-12 heures

### 4.3. App Mobile Consommateur
- **Technologie**: React Native
- **Fonctionnalités**:
  - Scan QR code produit
  - Historique traçabilité blockchain
  - Feedback satisfaction (rating + commentaire)
  - Notifications promotions
- **Estimation**: 60-80 heures (Sprint complet)

---

## 🔧 **Améliorations Techniques**

### Optimisations Backend
- [ ] Cache Redis pour endpoints ML
- [ ] Compression Gzip responses
- [ ] Rate limiting (10 req/sec par user)
- [ ] Logging structuré (JSON)
- [ ] Monitoring Prometheus + Grafana

### Optimisations Frontend
- [ ] Code splitting (routes lazy)
- [ ] Image optimization (next/image)
- [ ] Service Worker (offline mode)
- [ ] Analytics usage (Plausible ou Umami)

---

## 📈 **Métriques de Suivi**

### KPIs Développement
- **Code Coverage**: Objectif 80%
- **Performance**:
  - Backend: < 200ms (P95)
  - Frontend: Lighthouse Score > 90
- **Bugs**: < 5 bugs critiques en production
- **Uptime**: > 99.5%

### Timeline Global

```
┌────────────────────────────────────────────────────────────────┐
│ PHASE 1: Production Ready ✅ TERMINÉE (Décembre 2025)         │
│ - 3 Frontends + Backend Unifié + 6 Modules ML                  │
│ - Blockchain + SQAL + Simulateurs                              │
├────────────────────────────────────────────────────────────────┤
│ PHASE 2: UX & Temps Réel (Janvier-Février 2026) ⏳ EN COURS   │
│ - Graphiques, Export, Alertes, WebSocket                      │
│ - Durée estimée: 2-3 semaines                                 │
├────────────────────────────────────────────────────────────────┤
│ PHASE 3: Sécurité & Tests (Février-Mars 2026) ⏳ PLANIFIÉE    │
│ - JWT/Auth complète, Tests E2E, CI/CD                         │
│ - Durée estimée: 3-4 semaines                                 │
├────────────────────────────────────────────────────────────────┤
│ PHASE 4: IA Avancée & Mobile (Mars-Mai 2026) ⏳ PLANIFIÉE     │
│ - ML individuel, Vision/Voice, App mobile                     │
│ - Durée estimée: 8-10 semaines                                │
└────────────────────────────────────────────────────────────────┘
```

---

## 🎯 **Prochaine Session de Dev** (Recommandé)

### Option A: Quick Wins (2-3 heures)
1. Export Excel lots
2. Filtres avancés lots
3. Restart backend + validation fixes

### Option B: Feature Complète (6-8 heures)
1. Page gestion alertes dédiée (complète)
2. WebSocket notifications temps réel
3. Tests manuels + documentation

### Option C: IA Sprint (10-12 heures)
1. Courbes optimales PySR individuelles
2. API doses recommandées
3. Tests + intégration frontend

---

## 📝 **Notes Importantes**

### Dépendances Critiques
- **TimescaleDB**: Toutes les features temps-réel dépendent de l'hypertable
- **Prophet ML**: Nécessite historique ≥ 30 jours pour prévisions fiables
- **Blockchain**: Hyperledger Fabric doit être UP pour QR codes

### Contraintes Connues
- **Windows**: Certains scripts bash nécessitent adaptation `.bat`
- **Port conflicts**: 3000 (Euralis) vs 3001 (Gaveurs) en dev
- **WebSocket**: Pas de reconnexion auto (à implémenter)

---

**Dernière mise à jour**: 14 Janvier 2026
**Prochaine révision**: Après chaque session de dev
**Responsable**: Claude Code + Équipe Dev
