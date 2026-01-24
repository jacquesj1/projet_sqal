# 🦆 Système Gaveurs V2.1 - IA & Blockchain

**Application full-stack intelligente pour le suivi et l'optimisation du gavage avec traçabilité blockchain complète**

![Version](https://img.shields.io/badge/version-2.1.0-blue.svg)
![License](https://img.shields.io/badge/license-Proprietary-red.svg)
![Python](https://img.shields.io/badge/python-3.11-blue.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.109-green.svg)
![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)

---

## 🎯 Vue d'ensemble

Le **Système Gaveurs V2.1** est une solution complète et innovante pour la filière foie gras, combinant :

- **Intelligence Artificielle** : Régression symbolique (PySR) pour découvrir les formules optimales de gavage
- **Corrections automatiques** : Alertes SMS quand la dose réelle diffère de la dose théorique calculée par l'IA
- **Blockchain** : Traçabilité complète et inviolable de la naissance à l'abattoir
- **Temps réel** : WebSocket pour monitoring live des canards
- **Monitoring** : Prometheus + Grafana pour métriques et dashboards

---

## ✨ Fonctionnalités principales

### 🤖 Intelligence Artificielle

- **Régression Symbolique (PySR)** : Découverte automatique de formules mathématiques interprétables
  - Prédiction du gain de poids en fonction des doses
  - Optimisation multi-paramètres (température, humidité, génétique)
  - Formules exportables et compréhensibles par les gaveurs

- **Calcul de doses optimales** : 
  - Recommandations personnalisées par canard
  - Adaptation selon la génétique (Mulard, Barbarie, Pékin)
  - Prise en compte des conditions environnementales

### 📊 Corrections en temps réel

- **Alertes automatiques** quand écart dose réelle vs théorique > 10%
- **SMS instantanés** aux gaveurs avec :
  - Écart constaté (grammes et %)
  - Correction proposée pour la prochaine session
  - Impact prévu sur le gavage
- **Seuils configurables** : Warning (10%) et Critique (25%)

### ⛓️ Blockchain

- **Traçabilité complète** : Chaque événement enregistré de façon immuable
  - Initialisation canard (origine, génétique, poids initial)
  - Chaque gavage (doses, poids, température)
  - Pesées intermédiaires
  - Abattage final
  
- **Cryptographie RSA** : Signature numérique de chaque bloc
- **Certificats consommateurs** : QR code vérifiable avec tout l'historique
- **Vérification d'intégrité** : API pour auditer la chaîne complète

### 📱 Alertes multi-niveaux

**Critiques (SMS + App)** :
- Mortalité anormale
- Température hors zone de confort
- Perte de poids soudaine

**Importantes (App + Email)** :
- Déviation courbe prévue
- Performance en baisse

**Info (App)** :
- Rappels de pesée
- Optimisations suggérées

---

## 🏗️ Architecture technique

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND (Next.js 14)                  │
│  - Dashboard temps réel    - Graphiques courbes            │
│  - Alertes & Notifications - Blockchain Explorer           │
└────────────────┬────────────────────────────────────────────┘
                 │ REST + WebSocket
┌────────────────┼────────────────────────────────────────────┐
│                ▼     BACKEND (FastAPI)                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  API Routes  │  WebSocket  │  Services  │  ML Engine │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Régression Symbolique │ Corrections │ Blockchain     │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────┬────────────────────────────────────────────┘
                 │
    ┌────────────┼───────────────┬──────────────┐
    ▼            ▼               ▼              ▼
┌────────┐  ┌──────────┐   ┌────────┐    ┌──────────┐
│TimescaleDB│Redis     │   │Twilio  │    │Prometheus│
│PostgreSQL│ (Cache)   │   │ SMS    │    │ Grafana  │
└──────────┘ └─────────┘   └────────┘    └──────────┘
```

### Stack technologique

- **Frontend** : Next.js 14, TypeScript, Tailwind CSS, Recharts
- **Backend** : FastAPI (Python 3.11), asyncpg, WebSocket
- **Database** : TimescaleDB (PostgreSQL + time-series)
- **IA/ML** : 
  - PySR (Régression symbolique)
  - scikit-learn
  - Prophet (prévisions temporelles)
  - TensorFlow/PyTorch
- **Blockchain** : Cryptographie RSA, SHA-256
- **SMS** : Twilio ou OVH SMS API
- **Monitoring** : Prometheus, Grafana
- **Containerization** : Docker, Docker Compose

---

## 📊 Données collectées

### Données principales

1. **Gaveur** : Nom, téléphone, email, certifications
2. **Canard** : 
   - Numéro identification (bague)
   - Génétique (Mulard, Barbarie, Pékin, Mixte)
   - Date naissance, origine élevage
   - Poids initial
3. **Gavage** (2x/jour) :
   - Doses maïs (matin/soir)
   - Poids (matin/soir)
   - Heures de gavage
   - Température stabule
   - Humidité stabule
4. **Lot maïs** : Origine, taux humidité, qualité
5. **Abattoir** : Lieu, date, données finales

### Données enrichies automatiquement

- Dose théorique calculée par IA
- Écart dose réelle vs théorique
- Corrections proposées
- Gain de poids journalier
- Indice de consommation
- Alertes générées
- Prédictions de courbes

---

## 🚀 Installation et démarrage

### Prérequis

- Docker & Docker Compose
- Git
- Compte Twilio (ou OVH) pour SMS

### Installation

```bash
# Cloner le repository
git clone [votre-repo]
cd gaveurs-ai-blockchain

# Copier et configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec vos credentials Twilio/OVH

# Démarrer tous les services
docker-compose up -d

# Vérifier que tout fonctionne
docker-compose ps
```

### Accès aux services

- **Frontend** : http://localhost:3000
- **API Backend** : http://localhost:8000
- **Documentation API** : http://localhost:8000/docs
- **Grafana** : http://localhost:3001 (admin/admin)
- **Prometheus** : http://localhost:9090
- **PgAdmin** : http://localhost:5050

---

## 📖 Guide d'utilisation

### 1. Initialiser la blockchain

```bash
POST /api/blockchain/init
{
  "gaveur_id": 1,
  "canard_ids": [1, 2, 3, 4, 5],
  "description": "Lot du 07/12/2025"
}
```

### 2. Enregistrer un gavage

```bash
POST /api/gavage/
{
  "canard_id": 1,
  "dose_matin": 450,
  "dose_soir": 480,
  "heure_gavage_matin": "08:30:00",
  "heure_gavage_soir": "18:30:00",
  "poids_matin": 3200,
  "poids_soir": 3290,
  "temperature_stabule": 22.5,
  "humidite_stabule": 65.0,
  "lot_mais_id": 1,
  "remarques": "Canard en bonne santé"
}
```

**Ce qui se passe automatiquement** :
1. ✅ Calcul de la dose théorique par l'IA
2. ✅ Comparaison dose réelle vs théorique
3. ✅ Si écart > 10% → Génération correction + SMS
4. ✅ Ajout événement à la blockchain
5. ✅ Mise à jour métriques Prometheus

### 3. Découvrir la formule optimale

```bash
POST /api/ml/discover-formula/mulard?max_iterations=50
```

Résultat :
```json
{
  "genetique": "mulard",
  "formule_symbolique": "0.42*dose_matin^0.8 + 0.38*dose_soir^0.75 - 0.15*temperature + 12.3",
  "score_r2_train": 0.89,
  "score_r2_test": 0.86,
  "nombre_echantillons": 1542
}
```

### 4. Obtenir le certificat de traçabilité

```bash
GET /api/blockchain/canard/1/certificat
```

Génère un certificat consommateur avec :
- Toute la traçabilité blockchain
- Origine, génétique, élevage
- Durée gavage, doses totales
- Abattoir et date
- Hashes blockchain vérifiables

---

## 🔔 Système d'alertes SMS

### Configuration Twilio

Dans `.env` :
```env
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+33123456789
```

### Configuration OVH (alternative)

```env
SMS_PROVIDER=ovh
OVH_SMS_ACCOUNT=sms-xxxxx
OVH_SMS_LOGIN=your_login
OVH_SMS_PASSWORD=your_password
OVH_SMS_SENDER=Gaveurs
```

### Types de SMS envoyés

1. **Corrections de dose** :
```
📊 CORRECTION Canard #123
Théorique: 450g
Réelle: 520g
Écart: 70g (15.6%)
➡️ Réduire de -35g au gavage soir
```

2. **Alertes critiques** :
```
🚨 ALERTE CANARD #123
Perte de poids anormale: -120g
Action immédiate requise
```

3. **Rappels** :
```
⏰ Rappel gavage soir: 12 canard(s) à gaver
```

---

## 📈 Monitoring et métriques

### Dashboards Grafana préconfigurés

1. **Vue Globale** :
   - Nombre de gavages/jour
   - Taux de mortalité
   - Performance par gaveur
   
2. **Performance IA** :
   - Précision des prédictions
   - Écarts moyens doses
   - R² des modèles

3. **Blockchain** :
   - Nombre de blocs
   - Transactions/jour
   - Intégrité de la chaîne

### Métriques Prometheus

- `gavages_total` : Nombre total de gavages
- `alertes_total{niveau}` : Alertes par niveau
- `sms_total{type}` : SMS envoyés par type
- `http_requests_total` : Requêtes API
- `http_request_duration_seconds` : Latence API

---

## 🧪 Tests

```bash
# Tests backend
cd backend
pytest tests/ --cov=app

# Tests frontend
cd frontend
npm run test
```

---

## 📚 Documentation API complète

Accéder à : http://localhost:8000/docs

Toutes les routes disponibles :
- `/api/gaveurs/` - Gestion des gaveurs
- `/api/canards/` - Gestion des canards
- `/api/gavage/` - Enregistrement gavages
- `/api/ml/` - IA et régression symbolique
- `/api/corrections/` - Historique corrections
- `/api/blockchain/` - Blockchain et certificats
- `/api/alertes/` - Alertes et notifications
- `/api/stats/` - Statistiques

---

## 🔐 Sécurité

- Authentification JWT
- Mots de passe hashés (bcrypt)
- Clés RSA 2048 bits pour blockchain
- HTTPS obligatoire en production
- Rate limiting sur API
- Validation Pydantic de toutes les entrées

---

## 🚧 Roadmap V2.2

- [ ] Vision par ordinateur (détection automatique poids)
- [ ] Assistant vocal pour saisie mains-libres
- [ ] Application mobile native (iOS/Android)
- [ ] Export automatique comptabilité
- [ ] API publique pour abattoirs
- [ ] Dashboard consommateur avec QR codes

---

## 🤝 Support

Pour toute question ou assistance :
- Email : support@adeep.fr
- Documentation : https://docs.gaveurs.fr
- Issues GitHub : [lien]

---

## 📄 Licence

Copyright © 2025 A Deep Adventure. Tous droits réservés.
Licence propriétaire - Usage commercial interdit sans autorisation.

---

## 👨‍💻 Auteur

**JJ - A Deep Adventure**
- CEO & CTO
- Expert AgTech, IA & IoT
- 20+ ans d'expérience en systèmes critiques (Airbus Defense & Space)

---

*Système Gaveurs V2.1 - L'avenir du gavage intelligent* 🦆🤖⛓️
