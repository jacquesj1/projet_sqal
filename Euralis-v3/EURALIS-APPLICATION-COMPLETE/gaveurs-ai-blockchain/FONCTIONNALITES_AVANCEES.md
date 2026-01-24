# 🚀 Système Gaveurs V2.1 - Fonctionnalités Avancées

## 🆕 Nouvelles Fonctionnalités Innovantes

Cette mise à jour majeure ajoute des fonctionnalités de pointe en IA, analytics et interfaces utilisateur.

---

## 🤖 Système d'Alertes Intelligent avec IA

### Détection Automatique d'Anomalies

**Module** : `backend/app/ml/anomaly_detection.py`

#### Algorithme : Isolation Forest (Scikit-learn)

Détecte automatiquement les comportements anormaux :
- ✅ Perte de poids anormale
- ✅ Gain de poids insuffisant
- ✅ Température hors zone
- ✅ Humidité inadaptée
- ✅ Refus alimentaire (dose << théorique)
- ✅ Mortalité lot élevée
- ✅ Patterns anormaux détectés par ML

#### Types d'Alertes

**1. CRITIQUES (SMS + App)**
```python
🚨 PERTE DE POIDS CRITIQUE: -150g - INTERVENTION URGENTE
🚨 REFUS ALIMENTAIRE: Seulement 65% de la dose consommée
🚨 TEMPÉRATURE CRITIQUE: 28°C - Corriger immédiatement
```

**2. IMPORTANTES (App + Email)**
```python
⚠️ Perte de poids anormale: -85g - Surveiller
⚠️ Gain de poids sous la moyenne: 45g/jour
⚠️ Température hors zone de confort: 26°C
```

**3. INFORMATIVES (App)**
```python
ℹ️ Rappel de pesée
ℹ️ Changement de lot de maïs
ℹ️ Optimisations suggérées
```

### Seuils Configurables

```python
seuils = {
    "perte_poids_critique": -150,      # grammes
    "perte_poids_warning": -80,
    "gain_poids_faible_critique": 30,  # < 30g/jour
    "temperature_min": 18.0,
    "temperature_max": 25.0,
    "temperature_critique_min": 15.0,
    "temperature_critique_max": 28.0,
    "humidite_min": 50.0,
    "humidite_max": 75.0,
    "refus_alimentaire_pct": 30.0,     # Si dose < 70% théorique
    "mortalite_lot_pct": 5.0,          # Alerte si > 5% du lot
}
```

### API Routes

```bash
# Vérifier toutes les alertes d'un canard
POST /api/alertes/check-all/{canard_id}

# Dashboard des alertes
GET /api/alertes/dashboard/{gaveur_id}

# Acquitter une alerte
POST /api/alertes/{alerte_id}/acquitter

# Vérifier mortalité d'un lot
POST /api/alertes/check-mortalite-lot

# Détection anomalies ML
GET /api/anomalies/detect/{canard_id}?window_days=3
```

---

## 📊 Analytics Avancés avec Prophet

### Prévisions Prophet (Facebook AI)

**Module** : `backend/app/ml/analytics_engine.py`

#### Algorithme : Prophet (Forecasting)

Prévisions de courbes de poids avec intervalles de confiance 95%.

**Exemple de prévision** :
```json
{
  "canard_id": 1,
  "previsions": [
    {
      "date": "2025-12-15",
      "poids_predit": 4850,
      "poids_min": 4720,
      "poids_max": 4980
    }
  ],
  "confiance": 0.95,
  "methode": "Prophet (Facebook)"
}
```

### Métriques de Performance

**Calcul automatique de** :

1. **Score de Performance Global (0-100)**
   - 40% : Indice de Consommation
   - 40% : Gain de poids
   - 20% : Régularité

2. **Indice de Consommation (IC)**
   ```
   IC = kg maïs consommé / kg gain de poids
   IC optimal ≈ 3.5
   ```

3. **Taux de Croissance**
   ```
   Taux = Gain total / Jours de gavage
   ```

4. **Score de Régularité**
   - Basé sur la variance du gain journalier
   - Plus la variance est faible, meilleur le score

### Analyses Avancées

#### 1. Corrélation Température ↔ Gain de Poids

Analyse statistique complète :
- Coefficient de Pearson
- Régression linéaire
- Température optimale estimée
- Gain prédit à température optimale

#### 2. Détection de Patterns

Identifie les "best practices" du gaveur :
- ⏰ Meilleure heure de gavage matin/soir
- 🌡️ Température optimale
- ⚖️ Ratio dose matin/soir optimal

#### 3. Comparaison Génétiques

Compare les performances par génétique :
- Gain moyen
- Indice de consommation
- Taux de mortalité
- Dose moyenne

### API Routes Analytics

```bash
# Métriques de performance
GET /api/analytics/metrics/{canard_id}

# Prévisions Prophet
GET /api/analytics/predict-prophet/{canard_id}?jours=7

# Comparaison génétiques
GET /api/analytics/compare-genetiques?gaveur_id=1

# Corrélation température
GET /api/analytics/correlation-temperature/{canard_id}

# Détection patterns
GET /api/analytics/patterns/{gaveur_id}

# Rapport hebdomadaire
GET /api/analytics/weekly-report/{gaveur_id}
```

---

## 📱 Module de Saisie Rapide & Intelligente

**Composant** : `frontend/components/SaisieRapideGavage.tsx`

### Fonctionnalités Clés

#### 1. 🤖 Calcul Automatique Dose Théorique

Dès qu'un canard est sélectionné :
```typescript
✅ Appel automatique à l'API IA
✅ Calcul dose optimale matin/soir
✅ Affichage en temps réel
✅ Pré-remplissage des champs
```

#### 2. 🚨 Détection Écarts en Direct

Alerte visuelle si écart dose réelle/théorique :
- **< 10%** : ✅ Vert (OK)
- **10-25%** : ⚠️ Orange (Warning)
- **> 25%** : 🚨 Rouge (CRITIQUE)

#### 3. 🎤 Saisie Vocale (Mains Libres)

Commandes vocales pour saisie pendant gavage :
```
"dose matin 450"       → Remplit dose matin
"poids 3250"           → Remplit poids
"température 22"       → Remplit température
"remarques bon état"   → Remplit remarques
```

#### 4. 📷 Vision par Ordinateur

Détection automatique du poids par caméra :
```typescript
✅ Activation caméra
✅ Capture image
✅ Envoi au modèle de vision
✅ Détection automatique poids
✅ Remplissage automatique champ
```

#### 5. 📊 Statistiques Temps Réel

Affichage instantané :
- Gain de poids prévu (poids_soir - poids_matin)
- Dose totale journée
- Conformité IA (✓ ou ⚠️)

### Interface

**Highlights** :
- 🎨 Design moderne avec Tailwind CSS
- 📱 Responsive (mobile-friendly)
- ⚡ Temps réel (pas de rechargement)
- 🔔 Alertes visuelles immédiates
- 🚀 UX optimisée pour rapidité

---

## ⛓️ Blockchain Explorer Complet

**Composant** : `frontend/components/BlockchainExplorer.tsx`

### Fonctionnalités

#### 1. 🔍 Recherche Blockchain

Recherche par :
- ID canard
- N° d'identification (ex: FR-40-2024-0001)

#### 2. 📜 Certificat de Traçabilité

Certificat consommateur avec :
- ✅ Informations complètes (origine, génétique, dates)
- ✅ Données gavage (durée, doses, poids)
- ✅ Abattoir et date
- ✅ Vérification blockchain
- ✅ Tous les hashes de la chaîne

#### 3. ⏱️ Timeline Blockchain

Visualisation chronologique de TOUS les événements :

```
🌟 Bloc Genesis (01/12/2025)
│
🐣 Initialisation Canard #1 (02/12/2025)
│   - Origine, génétique, poids initial
│
🌽 Gavage Jour 1 (03/12/2025)
│   - Doses, poids, température
│
⚖️ Pesée (03/12/2025)
│   - Poids intermédiaire
│
🌽 Gavage Jour 2 (04/12/2025)
│
...
│
🏭 Abattage (15/12/2025)
    - Abattoir, poids final
```

#### 4. 🔐 Vérification d'Intégrité

Bouton "Vérifier Intégrité" :
- ✅ Vérifie tous les hashes
- ✅ Vérifie le chaînage
- ✅ Vérifie les signatures
- ✅ Affiche résultat (valide/compromis)

#### 5. 📥 Export & QR Code

- **Télécharger Certificat** (JSON)
- **Générer QR Code** pour consommateur
  - URL de vérification publique
  - Scan → Voir traçabilité complète

### Interface

**Highlights** :
- 🎨 Design gradient bleu/violet
- 🔍 Recherche instantanée
- 📜 Certificat professionnel
- ⛓️ Timeline interactive
- 🔒 Indicateurs de sécurité
- 📱 Responsive

---

## 📈 Dashboard Analytics Complet

**Composant** : `frontend/components/DashboardAnalytics.tsx`

### 4 Sections Principales

#### 1. 🚨 Alertes Actives

**KPIs** :
- Alertes critiques actives
- Alertes importantes actives
- Alertes dernières 24h
- SMS envoyés

**Liste des alertes** :
- Filtrable par niveau
- Acquittable en 1 clic
- Affichage détaillé (canard, type, message, date)

#### 2. 📊 Analytics Canard

**Sélection canard** → Affiche :

**Scores de Performance** (4 jauges) :
- Score Global (/100)
- Score IC (/100)
- Score Gain de Poids (/100)
- Score Régularité (/100)

**Prédiction Poids Final** :
- Poids prédit au jour 14
- Basé sur régression linéaire
- Affichage en grand avec confiance

#### 3. 🔮 Prédictions Prophet

**Graphique Area Chart** avec :
- Courbe de prédiction centrale
- Zone de confiance 95% (min/max)
- Axe temporel (7 jours)
- Légende interactive

#### 4. 🏆 Comparaison Génétiques

**Graphique Bar Chart** :
- Gain moyen par génétique
- Indice de consommation par génétique

**Tableau détaillé** :
- Nombre de canards
- Gain moyen
- Dose moyenne
- IC
- Taux de mortalité
- 🏆 Icône pour meilleure génétique

### 📈 Rapport Hebdomadaire

Box récapitulatif avec :
- Canards actifs
- Gavages total
- Gain moyen
- Top 3 performers

### Librairies

- **Recharts** : Tous les graphiques
- **Lucide React** : Icônes
- **Tailwind CSS** : Styling

---

## 🚀 Fonctionnalités Innovantes

### 1. Vision par Ordinateur

**Route** : `POST /api/vision/detect-poids`

Détection automatique du poids par image :
- Capture photo du canard
- Envoi au modèle TensorFlow/PyTorch
- Détection automatique du poids
- Retour avec confiance

**À implémenter** : Modèle CNN entraîné sur photos de canards

### 2. Assistant Vocal

**Route** : `POST /api/voice/parse-command`

Transcription et parsing de commandes :
- Enregistrement audio
- Transcription (Google Speech-to-Text / Whisper)
- Parsing intelligent
- Remplissage automatique formulaire

### 3. Optimisation Multi-Objectifs

**Route** : `POST /api/optimize/multi-objective`

Algorithme génétique pour optimiser :
- ✅ Maximiser poids foie
- ✅ Minimiser mortalité
- ✅ Optimiser coûts maïs

Retourne solution Pareto-optimale.

### 4. Suggestions IA

**Route** : `GET /api/insights/ai-suggestions/{gaveur_id}`

L'IA génère des suggestions personnalisées :
```json
{
  "type": "timing",
  "titre": "Optimiser l'heure de gavage",
  "description": "Vos meilleurs résultats sont à 08:00",
  "impact_prevu": "+5% de gain de poids",
  "priorite": "haute"
}
```

### 5. Export Avancés

**Routes** :
- `GET /api/export/rapport-pdf/{gaveur_id}` - Rapport PDF complet
- `GET /api/export/excel/{gaveur_id}` - Export Excel

---

## 📊 Nouveaux Schémas de Données

### Analytics

```python
class PerformanceMetrics:
    score_performance: float  # 0-100
    score_ic: float
    score_gain: float
    score_regularite: float
    gain_moyen_journalier: float
    indice_consommation: float
    poids_final_predit: float
```

### Alertes

```python
class AlerteDashboard:
    critiques_actives: int
    importantes_actives: int
    info_actives: int
    alertes_24h: int
    sms_envoyes: int
```

---

## 🎯 Workflow Complet

### Scénario : Saisie de Gavage Optimale

1. **Gaveur arrive** avec smartphone
2. **Ouvre module de saisie rapide**
3. **Sélectionne canard** dans dropdown
   - ✅ IA calcule automatiquement dose théorique
   - ✅ Affichage recommandation
4. **Active assistant vocal** 🎤
   - Dit : "dose matin 450, dose soir 480"
   - ✅ Champs remplis automatiquement
5. **Active caméra** 📷 pour pesée
   - Vision détecte poids : 3250g
   - ✅ Champ poids rempli
6. **Saisie température/humidité** manuellement
7. **Valide**
   - ✅ Enregistrement en DB
   - ✅ Calcul écart dose théorique/réelle
   - ✅ Si écart > 10% → Génération correction
   - ✅ Si écart > 25% → SMS automatique
   - ✅ Ajout événement blockchain
   - ✅ Vérification alertes (poids, température, etc.)
   - ✅ Si alerte → SMS si critique
8. **Consulte dashboard analytics**
   - Voir scores de performance
   - Voir prédictions Prophet
   - Voir alertes actives

### Scénario : Vérification Consommateur

1. **Consommateur** au supermarché
2. **Scanne QR Code** sur emballage
3. **Ouvre Blockchain Explorer**
4. **Voit certificat complet** :
   - Origine, génétique, élevage
   - Durée gavage, doses totales
   - Abattoir, date
5. **Explore timeline blockchain**
   - Voit TOUS les événements
   - Hashes vérifiables
6. **Vérifie intégrité** de la chaîne
   - ✅ Blockchain intègre
7. **Télécharge certificat** PDF

---

## 🏆 Résumé des Améliorations

| Fonctionnalité | Avant | Après |
|----------------|-------|-------|
| **Alertes** | Basiques | IA + ML (Isolation Forest) |
| **Saisie** | Manuelle | Vocale + Vision + IA |
| **Prévisions** | Régression simple | Prophet (Facebook AI) |
| **Analytics** | Basiques | Scores, corrélations, patterns |
| **Blockchain** | API seulement | Explorer complet + QR Code |
| **Dashboard** | Inexistant | 4 sections + graphiques |

---

## 📦 Nouveaux Fichiers Créés

### Backend (3 fichiers Python, ~1200 lignes)

1. `backend/app/ml/anomaly_detection.py` (~500 lignes)
   - Détection anomalies ML
   - Système d'alertes complet
   - Vérification mortalité

2. `backend/app/ml/analytics_engine.py` (~450 lignes)
   - Prévisions Prophet
   - Métriques de performance
   - Analyses corrélations
   - Détection patterns
   - Rapports hebdomadaires

3. `backend/app/api/advanced_routes.py` (~250 lignes)
   - Routes analytics
   - Routes alertes
   - Routes fonctionnalités innovantes
   - Routes export

### Frontend (3 composants React, ~1100 lignes)

1. `frontend/components/SaisieRapideGavage.tsx` (~350 lignes)
   - Saisie intelligente
   - Vocal + Vision
   - Alertes en temps réel

2. `frontend/components/BlockchainExplorer.tsx` (~400 lignes)
   - Recherche blockchain
   - Timeline interactive
   - Certificats
   - Vérification intégrité

3. `frontend/components/DashboardAnalytics.tsx` (~350 lignes)
   - 4 sections (alertes, analytics, prédictions, comparaison)
   - Graphiques Recharts
   - KPIs temps réel

---

## 🚀 Pour Démarrer

### Installation

```bash
# Backend - Installer nouvelles dépendances
pip install prophet scikit-learn --break-system-packages

# Frontend - Installer Recharts
npm install recharts lucide-react
```

### Lancer

```bash
# Backend
uvicorn app.main:app --reload

# Frontend
npm run dev
```

### Tester

```bash
# Test analytics
curl http://localhost:8000/api/analytics/metrics/1

# Test prédictions Prophet
curl http://localhost:8000/api/analytics/predict-prophet/1?jours=7

# Test détection anomalies
curl http://localhost:8000/api/anomalies/detect/1?window_days=3
```

---

**🎉 Système Gaveurs V2.1 - Maintenant avec IA Avancée, Analytics Prophet et Fonctionnalités Innovantes !**
