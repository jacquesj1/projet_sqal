# 🚀 Guide de Démarrage Rapide - Système Gaveurs V2.1

## Installation en 5 minutes

### 1. Cloner le projet
```bash
git clone [votre-repository]
cd gaveurs-ai-blockchain
```

### 2. Configuration

**Créer le fichier .env** (copier depuis .env.example) :
```bash
cp .env.example .env
```

**Éditer .env et configurer au minimum** :

Pour Twilio (SMS) :
```env
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx        # Votre Account SID
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxx      # Votre Auth Token
TWILIO_PHONE_NUMBER=+33123456789          # Votre numéro Twilio
```

OU pour OVH SMS :
```env
SMS_PROVIDER=ovh
OVH_SMS_ACCOUNT=sms-xxxxx
OVH_SMS_LOGIN=your_login
OVH_SMS_PASSWORD=your_password
```

### 3. Lancer le système

**Option A - Script automatique** :
```bash
./start.sh
```

**Option B - Manuellement** :
```bash
docker-compose up -d
```

### 4. Vérifier que tout fonctionne

```bash
# Voir l'état des services
docker-compose ps

# Voir les logs
docker-compose logs -f backend
```

### 5. Accéder aux services

- **Frontend** : http://localhost:3000
- **API** : http://localhost:8000
- **Documentation API** : http://localhost:8000/docs
- **Grafana** : http://localhost:3001 (admin/admin)

---

## 🧪 Test rapide de l'API

### 1. Créer un gaveur
```bash
curl -X POST http://localhost:8000/api/gaveurs/ \
  -H "Content-Type: application/json" \
  -d '{
    "nom": "Dupont",
    "prenom": "Jean",
    "email": "jean.dupont@example.com",
    "telephone": "+33612345678",
    "password": "motdepasse123",
    "adresse": "12 Route des Landes, 40000 Mont-de-Marsan"
  }'
```

### 2. Créer un canard
```bash
curl -X POST http://localhost:8000/api/canards/ \
  -H "Content-Type: application/json" \
  -d '{
    "numero_identification": "FR-001-2024-0001",
    "gaveur_id": 1,
    "genetique": "mulard",
    "date_naissance": "2024-10-15T10:00:00Z",
    "origine_elevage": "Ferme Durand",
    "numero_lot_canard": "LOT-2024-001",
    "poids_initial": 3200
  }'
```

### 3. Initialiser la blockchain
```bash
curl -X POST http://localhost:8000/api/blockchain/init \
  -H "Content-Type: application/json" \
  -d '{
    "gaveur_id": 1,
    "canard_ids": [1],
    "description": "Premier lot test"
  }'
```

### 4. Enregistrer un gavage
```bash
curl -X POST http://localhost:8000/api/gavage/ \
  -H "Content-Type: application/json" \
  -d '{
    "canard_id": 1,
    "dose_matin": 450,
    "dose_soir": 480,
    "heure_gavage_matin": "08:30:00",
    "heure_gavage_soir": "18:30:00",
    "poids_matin": 3200,
    "poids_soir": 3290,
    "temperature_stabule": 22.5,
    "humidite_stabule": 65.0,
    "lot_mais_id": 1
  }'
```

**Résultat attendu** :
- ✅ Gavage enregistré
- ✅ Dose théorique calculée par l'IA
- ✅ Si écart > 10% → SMS envoyé au gaveur
- ✅ Événement ajouté à la blockchain

### 5. Obtenir le certificat blockchain
```bash
curl http://localhost:8000/api/blockchain/canard/1/certificat
```

---

## 📊 Accéder aux dashboards

### Grafana
1. Ouvrir http://localhost:3001
2. Login : `admin` / `admin`
3. Explorer les dashboards :
   - Vue Globale
   - Performance IA
   - Blockchain

### Prometheus
1. Ouvrir http://localhost:9090
2. Explorer les métriques :
   - `gavages_total`
   - `alertes_total`
   - `sms_total`

---

## 🛑 Arrêter le système

```bash
# Arrêter tous les services
docker-compose down

# Arrêter et supprimer les volumes (⚠️ supprime les données)
docker-compose down -v
```

---

## 🐛 Dépannage

### Les services ne démarrent pas
```bash
# Vérifier les logs
docker-compose logs

# Redémarrer un service spécifique
docker-compose restart backend
```

### Problème de connexion à la base de données
```bash
# Vérifier que TimescaleDB est démarré
docker-compose ps timescaledb

# Voir les logs de la base
docker-compose logs timescaledb
```

### SMS non envoyés
```bash
# Vérifier les credentials dans .env
cat .env | grep TWILIO

# Voir les logs du backend
docker-compose logs backend | grep SMS
```

---

## 📚 Documentation complète

Voir le fichier [README.md](README.md) pour la documentation complète.

---

## ✅ Checklist de démarrage

- [ ] Docker et Docker Compose installés
- [ ] Fichier .env créé et configuré
- [ ] Credentials SMS (Twilio ou OVH) configurés
- [ ] Services démarrés avec `docker-compose up -d`
- [ ] API accessible sur http://localhost:8000
- [ ] Frontend accessible sur http://localhost:3000
- [ ] Premier gaveur créé
- [ ] Premier canard créé
- [ ] Blockchain initialisée
- [ ] Premier gavage enregistré avec succès

---

**🎉 Félicitations ! Le Système Gaveurs V2.1 est opérationnel !**
