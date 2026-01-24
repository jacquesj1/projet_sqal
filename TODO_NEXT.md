# 📋 TODO List - Prochaines Sessions

**Date de création**: 2026-01-15
**Mis à jour**: 2026-01-16 - Après Sprint 3 Backend Complet

---

## ✅ TERMINÉ - Sprint 3 Backend - IA Courbes Optimales 🎉

**Statut**: ✅ COMPLET (Backend)
**Date**: 2026-01-16
**Durée réelle**: 2h30

**Réalisations**:
- ✅ Analysé données historiques par gaveur (15 lots avec doses détaillées)
- ✅ Créé 2 tables + 1 vue (`courbes_optimales_gaveurs`, `courbes_recommandations_historique`, `v_courbes_efficacite`)
- ✅ Module ML complet `app/ml/euralis/courbes_personnalisees.py` (400+ lignes)
  - 5 courbes de référence par cluster (0-4)
  - Ajustements intelligents (ITM ±3%, mortalité -5%)
  - Recommandations personnalisées automatiques
- ✅ 3 Endpoints API opérationnels:
  - `GET /api/euralis/ml/gaveur/{id}/courbe-recommandee` ✅
  - `POST /api/euralis/ml/gaveur/{id}/courbe-recommandee/sauvegarder` ✅
  - `GET /api/euralis/ml/gaveur/{id}/performance-history` ✅
- ✅ Tests réussis (Gaveur ALUSSE: ITM 18.93 → courbe optimisée ITM cible 16.01)
- ✅ Documentation complète: `SPRINT3_COURBES_OPTIMALES_RECAP.md`

**Voir détails**: `SPRINT3_COURBES_OPTIMALES_RECAP.md`

---

## 🎯 Objectifs Principaux (Ordre de Priorité)

### 1. ✅ Sprint 3 Frontend - Interface Courbes Optimales 🎨
**Statut**: ✅ COMPLET
**Priorité**: 🟡 MOYENNE (Backend déjà opérationnel)
**Durée réelle**: 3-4 heures
**Date**: 2026-01-16

**Objectif**: Interface visuelle pour les recommandations de courbes

#### Phase 1 - Page Recommandations (2h)
- [x] Créer page `/euralis/courbes-optimales` - Liste tous les gaveurs avec clustering
- [x] Créer page `/euralis/gaveurs/[id]/courbes` - Détail courbe personnalisée
- [x] Graphique courbe recommandée (Recharts LineChart)
  - 3 lignes: Matin, Soir, Total
  - Tableau jour par jour avec cumuls
- [x] Workflow validation 3 étapes
  - Étape 1: REVUE (examiner la courbe)
  - Étape 2: VALIDÉE (ajouter notes optionnelles)
  - Étape 3: SAUVEGARDÉE (courbe prête pour gaveur)
- [x] Bloc métadonnées (cluster, ITM historique, ITM cible, total maïs)
- [x] Recommandations IA personnalisées

#### Phase 2 - Historique Performances (1-2h)
- [x] Composant Historique Performances intégré
  - Timeline 10 derniers lots
  - Stats résumé (ITM moyen, meilleur ITM, production totale, tendance)
  - Tableau détaillé avec tous les lots
- [x] Ajouté méthodes API dans `euralis/api.ts`:
  - `async getGaveurCourbeRecommandee(gaveurId, nbCanards, souche)`
  - `async sauvegarderCourbeRecommandee(gaveurId, courbeData)`
  - `async getGaveurPerformanceHistory(gaveurId, limit)`

#### Corrections Appliquées
- [x] Fix incohérence clusters (backend utilise maintenant vrai cluster ML)
- [x] Fix erreur 400 pour gaveurs sans site_code
- [x] Fix null safety pour statistiques performances
- [x] Page redirect `/euralis/courbes` → `/euralis/courbes-optimales`

**Livrable**: ✅ Interface complète visualisation + sauvegarde courbes personnalisées

**Documentation**: `SPRINT3_FRONTEND_COMPLETE.md`

---

### 2. ✅ Interface Saisie Rapide (Vision + Voice) 📸🎤
**Statut**: ✅ BACKEND COMPLET
**Priorité**: 🔴 HAUTE
**Durée réelle**: 4 heures (backend only)
**Date**: 2026-01-16

**Objectif**: Réduire le temps de saisie des gaveurs avec OCR et reconnaissance vocale

#### Phase 1 - Analyse Besoins (1h)
- [x] Identifier les formulaires à numériser
  - Bons de livraison maïs → `parse_bon_livraison()`
  - Fiches mortalité → `parse_fiche_mortalite()`
  - Fiches lot → `parse_fiche_lot()`
- [x] Lister les commandes vocales prioritaires
  - Dose: "dose matin 450 grammes"
  - Poids: "poids 3250 grammes"
  - Température: "température 22 degrés"
  - Mortalité: "mortalité 2 canards lot 456"
  - Humidité: "humidité 65 pourcent"

#### Phase 2 - Backend OCR (2h) ✅ COMPLET
- [x] Service OCR complet `app/services/ocr_service.py`
  - Tesseract OCR avec support français
  - Extraction texte depuis base64 ou fichier
  - Score de confiance
- [x] API OCR `app/routers/ocr.py` - 4 endpoints:
  - `POST /api/ocr/scan-image` - Extraction texte brut
  - `POST /api/ocr/scan-document` - Parsing intelligent par type
  - `POST /api/ocr/upload-file` - Upload fichier image
  - `GET /api/ocr/document-types` - Documentation types supportés
- [x] Parseurs intelligents pour 3 types de documents:
  - Bon livraison: date, numéro, quantité kg, prix
  - Fiche mortalité: date, lot, nb morts, causes
  - Fiche lot: code, date début, nb canards, souche, poids

#### Phase 3 - Backend Voice (2h) ✅ COMPLET
- [x] Parser NLP `app/services/voice_parser.py`
  - Regex patterns pour 5 types de commandes
  - Auto-détection session (matin/soir) et lot_code
  - Conversion unités automatique (kg → g)
  - Tolérance variations langage naturel
- [x] API Voice `app/routers/voice.py` - 4 endpoints:
  - `POST /api/voice/parse` - Parse commande unique
  - `POST /api/voice/parse-batch` - Parse batch (max 50)
  - `POST /api/voice/suggestions` - Génère suggestions auto-complétion
  - `GET /api/voice/commands/examples` - Documentation intégrée
- [x] Support 5 types de commandes:
  - Dose (matin/soir, g/kg)
  - Poids (matin/soir, g/kg)
  - Température (°C)
  - Humidité (%)
  - Mortalité (nb canards)

#### Phase 4 - Frontend Mobile-First ⏳ À FAIRE
- [ ] Améliorer page `/saisie-rapide` existante
  - [ ] Intégrer backend voice parser (remplacer parsing local)
  - [ ] Ajouter composant `OCRCameraModal.tsx`
  - [ ] Preview documents scannés avant validation
  - [ ] Historique scans/commandes vocales
- [ ] Tests utilisateurs
  - [ ] 5 gaveurs testent voice + OCR
  - [ ] Mesurer gain de temps réel
  - [ ] Collecter feedback

**Livrable Backend**: ✅ API complète OCR + Voice opérationnelle
**Livrable Frontend**: ⏳ Interface d'intégration à finaliser

**Documentation**: `SAISIE_RAPIDE_COMPLETE.md`

---

### 3. App Mobile Consommateur 📱
**Statut**: À planifier
**Priorité**: 🟡 MOYENNE
**Durée estimée**: 8-12 heures

**Objectif**: App mobile pour consommateurs (scan QR + feedback)

#### Phase 1 - Architecture (1-2h)
- [ ] Décider stack technique
  - **Option A**: PWA (Progressive Web App)
    - Avantage: Un seul code (React)
    - Inconvénient: Fonctionnalités natives limitées
  - **Option B**: React Native
    - Avantage: Performance native
    - Inconvénient: Setup plus complexe
- [ ] Définir fonctionnalités MVP
  - Scan QR code produit
  - Formulaire feedback (note 1-5 + commentaire)
  - Historique achats/avis
  - Profil utilisateur

#### Phase 2 - Backend API (2-3h)
- [ ] Créer endpoints API publics
  - `GET /api/public/product/{qr_code}` - Infos produit
  - `POST /api/public/feedback` - Soumettre feedback (anonyme OK)
  - `GET /api/public/user/{id}/history` - Historique utilisateur
- [ ] Sécurité API publique
  - Rate limiting (max 100 req/min)
  - Validation données entrantes
  - Pas d'infos sensibles exposées

#### Phase 3 - Frontend Mobile (4-5h)
- [ ] Créer structure app
  - Navigation (bottom tabs)
  - Écrans: Scanner, Historique, Profil
- [ ] Page Scanner QR
  - Intégration caméra (react-qr-reader ou native)
  - Détection QR code automatique
  - Affichage infos produit (lot, date, gaveur)
- [ ] Page Feedback
  - Rating 1-5 étoiles
  - Champ commentaire (optionnel)
  - Photos produit (optionnel)
  - Bouton soumettre
- [ ] Page Historique
  - Liste produits scannés
  - Feedbacks donnés
  - Stats personnelles

#### Phase 4 - Déploiement (1-2h)
- [ ] Build production
  - PWA: Déployer sur domaine HTTPS
  - React Native: Build APK Android
- [ ] Tests utilisateurs réels
  - 5-10 beta testeurs
  - Feedback et itérations

**Livrable**: App mobile consommateur fonctionnelle (MVP)

---

### 4. Dashboard Analytics Feedbacks 📊
**Statut**: Prêt à démarrer
**Priorité**: 🟡 MOYENNE
**Durée estimée**: 3-4 heures

**Objectif**: Dashboard d'analyse des retours consommateurs

#### Backend (1.5-2h)
- [ ] Endpoint `GET /api/analytics/feedbacks/overview`
  - Stats globales (moyenne notes, total feedbacks, tendance)
  - Répartition par note (1-5)
  - Taux de réponse
- [ ] Endpoint `GET /api/analytics/feedbacks/trends`
  - Évolution notes par période (jour/semaine/mois)
  - Comparaison périodes
- [ ] Endpoint `GET /api/analytics/feedbacks/correlations`
  - Corrélations feedbacks ↔ ITM, mortalité, durée gavage
  - Top lots (meilleurs notes)
  - Flop lots (pires notes)
- [ ] Endpoint `GET /api/analytics/feedbacks/wordcloud`
  - Extraction mots-clés commentaires (NLTK ou spaCy)
  - Fréquence mots positifs/négatifs

#### Frontend (1.5-2h)
- [ ] Page `/euralis/analytics/feedbacks`
- [ ] Composant Stats KPIs (4 cartes)
  - Note moyenne globale
  - Total feedbacks
  - Tendance 7j
  - Taux de réponse
- [ ] Composant Graphique évolution (LineChart)
  - Évolution notes sur 30/90 jours
  - Comparaison par site
- [ ] Composant Heatmap satisfaction
  - Grille lots × notes
  - Couleurs: vert (bon) → rouge (mauvais)
- [ ] Composant Corrélations (ScatterPlot)
  - ITM vs Note moyenne
  - Mortalité vs Note moyenne
- [ ] Composant Wordcloud
  - Nuage de mots commentaires
  - Taille proportionnelle à fréquence
- [ ] Composant Top/Flop lots
  - Classement 10 meilleurs/pires lots
  - Métriques associées

**Livrable**: Dashboard analytics feedbacks complet

---

## 📅 Planning Recommandé

### Semaine 1 (16-19 Jan)
- **Lundi-Mardi**: Sprint 3 IA Courbes Optimales (6h)
- **Mercredi-Jeudi**: Interface Saisie Rapide Vision+Voice (8h)
- **Vendredi**: Tests + Documentation (2h)

### Semaine 2 (22-26 Jan)
- **Lundi-Mercredi**: App Mobile Consommateur (12h)
- **Jeudi**: Dashboard Analytics Feedbacks (4h)
- **Vendredi**: Tests E2E + Polish (4h)

---

## 📊 Priorisation Rationale

### Pourquoi Sprint 3 IA en priorité 1?
- **Impact métier direct**: Amélioration performances gaveurs
- **Valeur ajoutée**: Personnalisation vs approche générique
- **ROI rapide**: Gains ITM mesurables immédiatement

### Pourquoi Saisie Rapide en priorité 2?
- **Pain point gaveurs**: Saisie manuelle chronophage et source d'erreurs
- **Adoption**: Facilite l'utilisation quotidienne du système
- **Données qualité**: Moins d'erreurs = meilleures analyses

### Pourquoi App Mobile en priorité 3?
- **Boucle feedback**: Ferme le cycle production → consommation
- **Différenciation**: Feature innovante vs concurrence
- **Long terme**: Accumulation données consommateurs précieuses

### Pourquoi Dashboard Feedbacks en priorité 4?
- **Dépendance**: Requiert d'abord l'app mobile pour avoir des données
- **Moins critique**: Les feedbacks existent déjà, dashboard = visualisation
- **Peut attendre**: Analyses manuelles possibles en attendant

---

## ✅ Critères de Succès

### Sprint 3 IA
- [ ] 3-5 clusters de gaveurs identifiés
- [ ] Courbes personnalisées générées pour chaque cluster
- [ ] Interface de recommandation fonctionnelle
- [ ] Tests avec 5 gaveurs réels

### Saisie Rapide
- [ ] OCR détecte codes-barres/QR avec >95% précision
- [ ] Voice transcrit commandes avec >90% précision
- [ ] Temps saisie réduit de 50%
- [ ] 10 gaveurs testent l'interface

### App Mobile
- [ ] Scan QR fonctionne sur Android + iOS
- [ ] Formulaire feedback soumis en <30 secondes
- [ ] 50 feedbacks collectés en beta
- [ ] Note moyenne app >4/5

### Dashboard Feedbacks
- [ ] Toutes les visualisations affichées
- [ ] Données temps réel (<5s refresh)
- [ ] Corrélations production ↔ satisfaction calculées
- [ ] Export PDF rapports fonctionnel

---

## 🔧 Dépendances Techniques

### Sprint 3 IA
- **Backend**: Python 3.12, scikit-learn, numpy
- **Database**: Requiert historique >100 lots
- **Frontend**: React, Recharts pour graphiques

### Saisie Rapide
- **Backend**: Tesseract OCR, Whisper (ou Web Speech API)
- **Frontend**: react-webcam, MediaRecorder API
- **Mobile**: Autorisations caméra + micro

### App Mobile
- **PWA**: Service Worker, manifest.json
- **React Native**: Expo, react-native-camera, react-native-qrcode-scanner
- **Backend**: Endpoints publics (CORS configuré)

### Dashboard Feedbacks
- **Backend**: NLTK ou spaCy (NLP français)
- **Frontend**: D3.js pour wordcloud, Recharts pour graphiques
- **Database**: Index sur consumer_feedbacks.created_at

---

## 📚 Documentation à Créer

- [ ] `SPRINT_3_IA_COURBES.md` - Guide ML courbes personnalisées
- [ ] `SAISIE_RAPIDE_GUIDE.md` - Manuel OCR + Voice
- [ ] `APP_MOBILE_SETUP.md` - Setup développement mobile
- [ ] `ANALYTICS_FEEDBACKS_API.md` - Documentation endpoints feedbacks

---

**Créé le**: 2026-01-15
**Prochaine mise à jour**: Après chaque sprint terminé
**Estimé total**: ~24-30 heures de développement

🚀 **Prêt à démarrer Sprint 3 IA Courbes Optimales!**
