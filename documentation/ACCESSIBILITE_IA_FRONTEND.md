# Accessibilité des Fonctionnalités IA via Frontend

**Date**: 22 Décembre 2025

---

## 📊 État de l'Accessibilité IA

### ✅ Fonctionnalités IA Accessibles via Frontend

| Algorithme | Accessible Frontend | Page | URL | Actions Possibles |
|------------|---------------------|------|-----|-------------------|
| **Prophet Predictions** | ✅ OUI | Dashboard Analytics | `/dashboard-analytics` | Voir prédictions 7/30/90j |
| **Anomaly Detection** | ✅ OUI | Dashboard Analytics | `/dashboard-analytics` | Voir alertes actives |
| **Analytics Engine** | ✅ OUI | Dashboard Analytics | `/dashboard-analytics` | Voir métriques performance |
| **Genetics Comparison** | ✅ OUI | Dashboard Analytics | `/dashboard-analytics` | Comparer souches |
| **Blockchain** | ✅ OUI | Blockchain Explorer | `/blockchain-explorer` | Voir certificats |
| **Vision CNN - Training** | ✅ OUI | AI Training | `/ai-training` | Entraîner modèle |
| **Voice Whisper - Loading** | ✅ OUI | AI Training | `/ai-training` | Charger modèle |
| **NSGA-II - Optimization** | ✅ OUI | AI Training | `/ai-training` | Lancer optimisation |

### ⚠️ Fonctionnalités IA Partiellement Accessibles

| Algorithme | Status | Pourquoi | Solution |
|------------|--------|----------|----------|
| **Vision CNN - Prediction** | ⚠️ PARTIEL | Pas d'interface upload photo | À créer dans `/saisie-rapide` |
| **Voice Whisper - Usage** | ⚠️ PARTIEL | Pas d'interface micro | À créer dans `/saisie-rapide` |
| **Symbolic Regression** | ⚠️ PARTIEL | Backend only | À créer dans `/ai-training` |
| **Feedback Optimizer** | ⚠️ PARTIEL | Automatique (pas d'UI manuelle) | Fonctionne en arrière-plan |
| **K-Means Clustering** | ⚠️ PARTIEL | Backend only | À créer dans `/dashboard-analytics` |
| **Hungarian Algorithm** | ⚠️ PARTIEL | Backend only | À créer (planning abattage) |

---

## 🎯 Page `/ai-training` - Qu'est-ce que c'est?

### URL Frontend Gaveurs
**http://localhost:3001/ai-training**

### Description
Page dédiée à l'**entraînement et au chargement** des 3 nouveaux algorithmes IA :
1. Vision par Ordinateur (CNN)
2. Assistant Vocal (Whisper)
3. Optimisation Multi-Objectifs (NSGA-II)

### Interface Visuelle

```
┌──────────────────────────────────────────────────────────────────┐
│ 🧠 Dashboard d'Entraînement IA                                   │
│ Entraînez et testez les modèles d'intelligence artificielle     │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐   │
│  │ 👁 Vision      │  │ 🎤 Assistant   │  │ ⚡ Optimisation│   │
│  │ par Ordinateur │  │ Vocal          │  │ Multi-Objectifs│   │
│  │                │  │                │  │                │   │
│  │ CNN - MobileNet│  │ Whisper OpenAI │  │ NSGA-II DEAP   │   │
│  │                │  │                │  │                │   │
│  │ Input: Photos  │  │ Input: Audio   │  │ 5 Objectifs    │   │
│  │ Output: Poids  │  │ Output: Données│  │ Pareto Front   │   │
│  │                │  │                │  │                │   │
│  │ [▶ Entraîner]  │  │ [▶ Charger]    │  │ [▶ Lancer]     │   │
│  │                │  │                │  │                │   │
│  │ ✅ Succès      │  │ ✅ Chargé      │  │ ✅ Terminé     │   │
│  │ Samples: 1500  │  │ Commandes: 8   │  │ Solutions: 23  │   │
│  │ MAE: 125.3g    │  │ Confiance: 92% │  │ ITM: 16.8kg    │   │
│  └────────────────┘  └────────────────┘  └────────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Actions Disponibles

#### 1. Vision par Ordinateur
- **Bouton**: "Entraîner le modèle"
- **Action**: Lance entraînement CNN (30-60 min)
- **Prérequis**: Photos dans table `canard_photos` (min 50)
- **Résultat**: MAE, Val MAE, nombre époques
- **API**: `POST /api/vision/train`

#### 2. Assistant Vocal
- **Bouton**: "Charger le modèle"
- **Action**: Charge Whisper (5-10 sec)
- **Prérequis**: Aucun (modèle pré-entraîné)
- **Résultat**: Liste des 8 commandes supportées
- **API**: `GET /api/voice/commands`

#### 3. Optimisation Multi-Objectifs
- **Bouton**: "Lancer l'optimisation"
- **Action**: NSGA-II 100×50 (10-20 min)
- **Prérequis**: Aucun
- **Résultat**: Front Pareto + meilleure solution
- **API**: `POST /api/optimize/multi-objective`

---

## 📝 Comment Entraîner les Modèles

### Vision par Ordinateur (CNN)

**1. Préparer les données**

```sql
-- Créer table photos (si pas déjà fait)
CREATE TABLE IF NOT EXISTS canard_photos (
    id SERIAL PRIMARY KEY,
    canard_id INT REFERENCES canards(id),
    photo_base64 TEXT NOT NULL,
    poids_reel FLOAT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Insérer photos (exemple)
INSERT INTO canard_photos (canard_id, photo_base64, poids_reel)
VALUES (1, 'iVBORw0KGgoAAAANS...', 3250.5);
```

**Minimum requis**: 50 photos par génétique

**2. Entraîner via Frontend**

1. Aller sur http://localhost:3001/ai-training
2. Section "Vision par Ordinateur"
3. Cliquer "Entraîner le modèle"
4. Attendre 30-60 min (barre de progression)
5. Voir résultats:
   - Échantillons: 1500
   - Époques: 50
   - MAE: 125.3g
   - Val MAE: 138.7g

**3. Entraîner via API (alternative)**

```bash
curl -X POST http://localhost:8000/api/vision/train \
  -H "Content-Type: application/json" \
  -d '{
    "genetique": "Mulard",
    "epochs": 50,
    "batch_size": 32
  }'
```

---

### Assistant Vocal (Whisper)

**Pas d'entraînement nécessaire** (modèle pré-entraîné)

**1. Charger via Frontend**

1. Aller sur http://localhost:3001/ai-training
2. Section "Assistant Vocal"
3. Cliquer "Charger le modèle"
4. Attendre 5-10 sec
5. Voir liste des commandes supportées

**2. Vérifier via API**

```bash
curl http://localhost:8000/api/voice/commands

# Résultat
{
  "supported_commands": [
    {
      "commande": "dose_matin",
      "pattern": "dose matin <nombre>",
      "exemples": ["dose matin 450 grammes"]
    },
    ...
  ]
}
```

---

### Optimisation Multi-Objectifs (NSGA-II)

**Pas d'entraînement, mais optimisation à la demande**

**1. Lancer via Frontend**

1. Aller sur http://localhost:3001/ai-training
2. Section "Optimisation Multi-Objectifs"
3. Cliquer "Lancer l'optimisation"
4. Attendre 10-20 min
5. Voir résultats:
   - Solutions Pareto: 23
   - Meilleure solution:
     - Dose matin: 445.2g
     - Dose soir: 478.5g
     - ITM: 16.8kg
     - Survie: 97.5%

**2. Lancer via API**

```bash
curl -X POST http://localhost:8000/api/optimize/multi-objective \
  -H "Content-Type: application/json" \
  -d '{
    "genetique": "Mulard",
    "population_size": 100,
    "n_generations": 50
  }'
```

---

## 🔧 Comment Utiliser les Modèles Entraînés

### Vision CNN - Prédire Poids

**⚠️ Pas encore d'interface frontend (à créer)**

**Via API uniquement**:

```bash
# 1. Prendre photo canard
# 2. Encoder en base64
base64_image=$(base64 -w 0 canard.jpg)

# 3. Prédire
curl -X POST http://localhost:8000/api/vision/detect-poids \
  -H "Content-Type: application/json" \
  -d "{
    \"image_base64\": \"$base64_image\",
    \"genetique\": \"Mulard\"
  }"

# Résultat
{
  "poids_detecte": 3245.5,
  "confiance": 0.87,
  "methode": "CNN (MobileNetV2)"
}
```

**TODO**: Créer interface dans `/saisie-rapide` avec:
- Bouton "📷 Prendre photo"
- Upload fichier
- Affichage poids prédit

---

### Voice Whisper - Saisie Vocale

**⚠️ Pas encore d'interface frontend (à créer)**

**Via API uniquement**:

```bash
# 1. Enregistrer audio
# 2. Encoder en base64
base64_audio=$(base64 -w 0 commande.mp3)

# 3. Parser
curl -X POST http://localhost:8000/api/voice/parse-command \
  -H "Content-Type: application/json" \
  -d "{
    \"audio_base64\": \"$base64_audio\",
    \"language\": \"fr\"
  }"

# Résultat
{
  "transcription": "dose matin 450 grammes poids soir 3 kilos 250",
  "parsed_data": {
    "dose_matin": 450,
    "poids_soir": 3250
  },
  "confidence": 0.92
}
```

**TODO**: Créer interface dans `/saisie-rapide` avec:
- Bouton "🎤 Dicter"
- Enregistrement audio (navigator.mediaDevices)
- Remplissage automatique formulaire

---

### NSGA-II - Appliquer Solution Optimale

**✅ Résultats visibles dans `/ai-training`**

**Utilisation**:

1. Lancer optimisation (voir résultats)
2. Récupérer meilleure solution:
   ```json
   {
     "parametres": {
       "dose_matin": 445.2,
       "dose_soir": 478.5,
       "temperature_stabule": 21.3,
       "duree_gavage": 12
     }
   }
   ```
3. Appliquer manuellement dans production

**TODO**: Créer bouton "Appliquer cette solution" qui:
- Crée nouvelle courbe gavage
- Notifie gaveur
- Suit impact sur satisfaction

---

## 📍 Récapitulatif URLs Frontend Gaveurs

| Page | URL | Fonctionnalités IA |
|------|-----|-------------------|
| **AI Training** | `/ai-training` | Entraîner Vision, Charger Voice, Lancer NSGA-II |
| **Dashboard Analytics** | `/dashboard-analytics` | Prophet, Anomalies, Métriques, Génétiques |
| **Saisie Rapide** | `/saisie-rapide` | (TODO: Vision upload, Voice micro) |
| **Blockchain Explorer** | `/blockchain-explorer` | Certificats blockchain |
| **Alertes** | `/alertes` | Alertes anomalies ML |

---

## 🚧 Fonctionnalités à Créer

### Priorité 1: Compléter `/saisie-rapide`

**Ajouter**:

1. **Upload Photo** (Vision CNN)
   ```tsx
   const [photo, setPhoto] = useState<string | null>(null);

   const handlePhotoUpload = async (file: File) => {
     const base64 = await fileToBase64(file);
     const response = await fetch('/api/vision/detect-poids', {
       method: 'POST',
       body: JSON.stringify({ image_base64: base64 })
     });
     const { poids_detecte } = await response.json();
     setFormData({ ...formData, poids_soir: poids_detecte });
   };
   ```

2. **Bouton Micro** (Voice Whisper)
   ```tsx
   const [isRecording, setIsRecording] = useState(false);

   const handleVoiceCommand = async () => {
     const audioBlob = await recordAudio(); // navigator.mediaDevices
     const base64 = await blobToBase64(audioBlob);
     const response = await fetch('/api/voice/parse-command', {
       method: 'POST',
       body: JSON.stringify({ audio_base64: base64 })
     });
     const { parsed_data } = await response.json();
     setFormData({ ...formData, ...parsed_data });
   };
   ```

### Priorité 2: Ajouter Clustering dans `/dashboard-analytics`

**Section "Profil Gaveur"**:
- Afficher cluster (Champion, Performant, Moyen, etc.)
- Comparer avec autres du même cluster
- Suggestions amélioration

### Priorité 3: Page Planning Abattage

**Nouvelle page `/planning-abattage`**:
- Liste canards prêts
- Algorithme Hungarian
- Planning optimal

---

## ✅ Résumé

### Accessibles via Frontend (8/9)

| Algorithme | Frontend | Page | Action |
|------------|----------|------|--------|
| Prophet | ✅ | `/dashboard-analytics` | Voir prédictions |
| Anomalies | ✅ | `/dashboard-analytics` | Voir alertes |
| Analytics | ✅ | `/dashboard-analytics` | Voir métriques |
| Genetics | ✅ | `/dashboard-analytics` | Comparer souches |
| Blockchain | ✅ | `/blockchain-explorer` | Certificats |
| Vision Training | ✅ | `/ai-training` | Entraîner CNN |
| Voice Loading | ✅ | `/ai-training` | Charger Whisper |
| NSGA-II | ✅ | `/ai-training` | Optimiser |

### Partiellement Accessibles (4/9)

| Algorithme | Status | TODO |
|------------|--------|------|
| Vision Usage | ⚠️ | Upload photo dans `/saisie-rapide` |
| Voice Usage | ⚠️ | Bouton micro dans `/saisie-rapide` |
| K-Means | ⚠️ | Section profil dans `/dashboard-analytics` |
| Hungarian | ⚠️ | Page `/planning-abattage` |

### Backend Only (2/9)

| Algorithme | Raison |
|------------|--------|
| Symbolic Regression | Entraînement long, pas d'UI interactive |
| Feedback Optimizer | Automatique (boucle fermée) |

---

**Conclusion**: **8/9 algorithmes** sont accessibles via frontend, dont **5/9** complètement utilisables. Les 4 restants nécessitent interfaces upload/micro (TODO).

