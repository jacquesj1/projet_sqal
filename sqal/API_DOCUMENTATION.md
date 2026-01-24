# SQAL Backend API - Documentation Complète

## 📋 Vue d'Ensemble

Le backend SQAL est une API REST + WebSocket construite avec Django, Django REST Framework et Django Channels.

**Base URL** : `http://localhost:8000`
**WebSocket URL** : `ws://localhost:8000`

---

## 🌐 REST API Endpoints

### 1. Dashboard API

#### GET `/api/dashboard/metrics/`
Métriques globales du Dashboard

**Réponse** :
```json
{
  "totalSamples": 1234,
  "samplesToday": 56,
  "averageQuality": 85.5,
  "gradeDistribution": {"A+": 10, "A": 20, "B": 15},
  "activeAlerts": 3,
  "successRate": 92.5,
  "activeDevices": 4,
  "trend": 5.2,
  "period": "7days"
}
```

#### GET `/api/dashboard/devices/`
État des appareils connectés

**Réponse** :
```json
{
  "devices": [
    {
      "id": "VL53_001",
      "type": "VL53L8CH",
      "status": "online",
      "lastSeen": "2025-01-09T12:00:00Z",
      "measurementCount": 1234
    }
  ],
  "total": 4,
  "online": 3,
  "offline": 1
}
```

---

### 2. Analysis API

#### GET `/api/analysis/`
Liste des analyses récentes (dernières 24h)

**Query Params** :
- `limit` (int) : Nombre de résultats (défaut: 50)
- `offset` (int) : Pagination
- `device_id` (string) : Filtrer par appareil
- `grade` (string) : Filtrer par grade

**Réponse** :
```json
{
  "analyses": [
    {
      "id": "SAMPLE-20250109-120000",
      "time": "2025-01-09T12:00:00Z",
      "grade": "A",
      "qualityScore": 92.5,
      "defects": ["minor_defect_1"],
      "numDefects": 1
    }
  ],
  "total": 100,
  "hasMore": true
}
```

#### GET `/api/analysis/{sample_id}/`
Détail complet d'une analyse

**Réponse** :
```json
{
  "id": "SAMPLE-20250109-120000",
  "time": "2025-01-09T12:00:00Z",
  "grade": "A",
  "qualityScore": 92.5,
  "vl53l8ch": {
    "grade": "A",
    "volumeMm3": 1234.5,
    "avgHeightMm": 45.2
  },
  "as7341": {
    "grade": "A",
    "freshnessIndex": 0.95,
    "oxidationIndex": 0.12
  }
}
```

#### GET `/api/analysis/history/`
Historique complet avec pagination

**Query Params** :
- `page` (int) : Numéro de page (défaut: 1)
- `page_size` (int) : Taille de page (défaut: 20)
- `start_date` (ISO) : Date de début
- `end_date` (ISO) : Date de fin
- `grade` (string) : Filtrer par grade

#### POST `/api/analysis/`
Déclencher une nouvelle analyse

**Body** :
```json
{
  "device_id": "VL53_001",
  "sample_id": "SAMPLE-20250109-120000"
}
```

---

### 3. AI API

#### GET `/api/ai/models/`
Liste des modèles ML/CNN disponibles

**Réponse** :
```json
{
  "models": [
    {
      "id": "vl53l8ch_cnn_v1",
      "name": "vl53l8ch_cnn_v1.h5",
      "type": "vl53l8ch",
      "version": "1.0.0",
      "accuracy": 0.95,
      "size": 1234567,
      "status": "active"
    }
  ],
  "total": 3
}
```

#### GET `/api/ai/metrics/`
Métriques de performance des modèles AI

**Réponse** :
```json
{
  "averageAccuracy": 0.94,
  "averageValAccuracy": 0.92,
  "bestModel": {
    "type": "fusion_ensemble",
    "accuracy": 0.96
  },
  "performanceHistory": [...]
}
```

#### POST `/api/ai/train/`
Lancer un entraînement de modèle

**Body** :
```json
{
  "model_type": "vl53l8ch_cnn",
  "epochs": 50,
  "batch_size": 32,
  "learning_rate": 0.001
}
```

**Réponse** :
```json
{
  "message": "Training started successfully",
  "trainingId": 123,
  "status": "pending"
}
```

#### GET `/api/ai/training-history/`
Historique des entraînements

**Query Params** :
- `limit` (int) : Nombre de résultats
- `model_type` (string) : Filtrer par type

---

### 4. Reports API

#### GET `/api/reports/`
Liste des rapports générés

**Query Params** :
- `limit` (int) : Nombre de résultats
- `report_type` (string) : Filtrer par type
- `status` (string) : Filtrer par statut

#### POST `/api/reports/create/`
Générer un nouveau rapport

**Body** :
```json
{
  "report_type": "weekly",
  "title": "Rapport Hebdomadaire",
  "start_date": "2025-01-01T00:00:00Z",
  "end_date": "2025-01-07T23:59:59Z",
  "format": "pdf"
}
```

#### GET `/api/reports/{report_id}/`
Détail d'un rapport

#### GET `/api/reports/{report_id}/download/`
Télécharger un rapport (fichier)

---

### 5. Admin API

#### GET `/api/admin/devices/`
Gestion des appareils

**Query Params** :
- `status` (string) : Filtrer par statut (online, offline, all)

**Réponse** :
```json
{
  "devices": [
    {
      "id": "VL53_001",
      "type": "VL53L8CH",
      "name": "ToF Sensor 0001",
      "status": "online",
      "totalMeasurements": 12345,
      "location": "Production Line A",
      "firmware": "1.2.3"
    }
  ],
  "total": 4,
  "online": 3,
  "offline": 1
}
```

#### GET `/api/admin/users/`
Gestion des utilisateurs

**Réponse** :
```json
{
  "users": [
    {
      "id": 1,
      "username": "admin",
      "email": "admin@sqal.local",
      "isActive": true,
      "isStaff": true
    }
  ],
  "total": 10,
  "active": 8
}
```

#### GET `/api/admin/audit/`
Logs d'audit système

**Query Params** :
- `limit` (int) : Nombre de résultats
- `action` (string) : Filtrer par type d'action

#### GET `/api/admin/settings/`
Paramètres système

**Réponse** :
```json
{
  "system": {
    "version": "1.0.0",
    "environment": "development",
    "timezone": "Europe/Paris"
  },
  "database": {
    "engine": "TimescaleDB",
    "host": "localhost",
    "port": "5434"
  },
  "features": {
    "aiTraining": true,
    "reports": true,
    "blockchain": true
  }
}
```

---

## ⚡ WebSocket Endpoints

### 1. `ws://localhost:8000/ws/dashboard/`

Connexion WebSocket pour recevoir les données temps réel dans le frontend.

**Connexion** :
```javascript
const ws = new WebSocket('ws://localhost:8000/ws/dashboard/');

ws.onopen = () => {
  console.log('Connected to dashboard WebSocket');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};
```

**Messages reçus** :
```json
{
  "type": "sensor_update",
  "data": {
    "device_id": "VL53_001",
    "timestamp": "2025-01-09T12:00:00Z",
    "measurements": {...}
  }
}
```

**Commandes disponibles** :
```json
// Demander les dernières données
{
  "type": "get_latest"
}

// Demander l'historique
{
  "type": "get_history",
  "hours": 24
}
```

### 2. `ws://localhost:8000/ws/sensors/`

Connexion WebSocket pour les simulateurs Python (réception de données).

---

## 🔧 Configuration

### CORS
Le backend autorise les requêtes depuis :
- `http://localhost:5173` (Frontend SQAL)
- `http://localhost:3000` (Next.js)

### Authentication
- **Keycloak SSO** : Port 8080
- **Realm** : `sqal_realm`
- **Client** : `sqal-frontend`

### Base de Données
- **TimescaleDB** : Port 5434
- **Database** : `foiegras_db`
- **User** : `foiegras_user`

### Cache & Channel Layers
- **Redis** : Port 6380

---

## 📊 Codes de Statut HTTP

- `200 OK` : Succès
- `201 Created` : Ressource créée
- `202 Accepted` : Requête acceptée (traitement asynchrone)
- `400 Bad Request` : Paramètres invalides
- `404 Not Found` : Ressource non trouvée
- `500 Internal Server Error` : Erreur serveur

---

## 🚀 Démarrage Rapide

### Démarrer tous les services
```bash
cd backend_django
docker-compose up -d
```

### Vérifier que Django fonctionne
```bash
curl http://localhost:8000/api/dashboard/metrics/
```

### Tester WebSocket
```javascript
const ws = new WebSocket('ws://localhost:8000/ws/dashboard/');
ws.onopen = () => console.log('Connected!');
```

---

## 📝 Notes Importantes

1. **Tous les endpoints retournent du JSON**
2. **Les dates sont au format ISO 8601**
3. **Les WebSocket utilisent JSON pour les messages**
4. **Les tâches longues (training, rapports) sont asynchrones**
5. **Les erreurs incluent un champ `error` avec le message**

---

## 🔗 Liens Utiles

- **Frontend SQAL** : http://localhost:5173
- **Backend API** : http://localhost:8000
- **Keycloak Admin** : http://localhost:8080/admin
- **Django Admin** : http://localhost:8000/admin

---

**Version** : 1.0.0
**Dernière mise à jour** : 2025-01-09
