# Configuration Automatique Keycloak - Système Gaveurs V3.0

## 🎯 Vue d'ensemble

Scripts de configuration automatique qui configurent Keycloak pour permettre l'authentification sur les 3 frontends (Euralis, Gaveurs, SQAL).

**Ce qui est configuré automatiquement**:
- ✅ Realm: `gaveurs-production`
- ✅ 4 Clients (backend-api + 3 frontends)
- ✅ 5 Realm Roles (admin, superviseur, gaveur, technicien_sqal, consommateur)
- ✅ Client Roles spécifiques à chaque frontend
- ✅ 5 Utilisateurs de test avec mots de passe

---

## 🚀 Démarrage Rapide

### Prérequis

1. **Keycloak doit être démarré**:
   ```bash
   # Windows
   docker-compose -f docker-compose.keycloak.yml up -d

   # Linux/Mac
   docker-compose -f docker-compose.keycloak.yml up -d
   ```

2. **Curl doit être installé** (pour les appels API)
   - Windows: Inclus dans Windows 10+
   - Linux: `sudo apt-get install curl`
   - Mac: Préinstallé

### Utilisation

#### Windows

```bash
cd d:\GavAI\projet-euralis-gaveurs
scripts\configure-keycloak.bat
```

#### Linux/Mac

```bash
cd /path/to/projet-euralis-gaveurs
chmod +x scripts/configure-keycloak.sh
./scripts/configure-keycloak.sh
```

**Durée**: ~30 secondes pour la configuration complète

---

## 📋 Ce qui est configuré

### 1. Realm: `gaveurs-production`

**Paramètres**:
- Nom: `gaveurs-production`
- Enregistrement utilisateurs: Activé
- Reset password: Activé
- Remember me: Activé
- Login avec email: Activé

### 2. Clients (4)

| Client ID | Type | Port | Description |
|-----------|------|------|-------------|
| `backend-api` | Confidential | 8000 | API FastAPI avec auth |
| `euralis-frontend` | Public | 3000 | Dashboard multi-sites |
| `gaveurs-frontend` | Public | 3001 | App gaveur individuel |
| `sqal-frontend` | Public | 5173 | Contrôle qualité IoT |

**URLs de redirection configurées**:
- Euralis: `http://localhost:3000/*`, `http://localhost:3000/auth/callback`
- Gaveurs: `http://localhost:3001/*`, `http://localhost:3001/auth/callback`
- SQAL: `http://localhost:5173/*`, `http://localhost:5173/auth/callback`

### 3. Realm Roles (5)

| Rôle | Description | Frontends |
|------|-------------|-----------|
| `admin` | Administrateur système - accès total | Tous (3) |
| `superviseur` | Superviseur Euralis multi-sites | Euralis |
| `gaveur` | Gaveur individuel | Gaveurs |
| `technicien_sqal` | Technicien SQAL contrôle qualité | SQAL |
| `consommateur` | Consommateur - feedback uniquement | - |

### 4. Client Roles

#### euralis-frontend
- `view_all_sites` - Voir tous les sites
- `manage_gaveurs` - Gérer les gaveurs
- `view_analytics` - Voir les analytics
- `export_reports` - Exporter rapports
- `manage_lots` - Gérer les lots

#### gaveurs-frontend
- `manage_own_data` - Gérer ses propres données
- `view_own_analytics` - Voir ses analytics
- `use_ai_training` - Utiliser training IA
- `view_blockchain` - Voir blockchain
- `submit_feedback` - Soumettre feedback

#### sqal-frontend
- `view_sensors` - Voir capteurs
- `manage_quality` - Gérer qualité
- `export_reports` - Exporter rapports
- `calibrate_devices` - Calibrer dispositifs
- `view_realtime` - Voir temps réel

### 5. Utilisateurs de Test (5)

| Email | Password | Rôle | Accès Frontend |
|-------|----------|------|----------------|
| `admin@euralis.fr` | `admin123` | admin | **Tous** (Euralis, Gaveurs, SQAL) |
| `superviseur@euralis.fr` | `super123` | superviseur | Euralis |
| `jean.martin@gaveur.fr` | `gaveur123` | gaveur | Gaveurs (Site LL, gaveur_id: 1) |
| `sophie.dubois@gaveur.fr` | `gaveur123` | gaveur | Gaveurs (Site LS, gaveur_id: 2) |
| `tech@sqal.fr` | `sqal123` | technicien_sqal | SQAL |

---

## 🔐 Récupération du Client Secret (Backend)

Après exécution du script, récupérez le client secret:

### Méthode 1: Via l'interface Keycloak (Recommandée)

1. Aller sur http://localhost:8080
2. Se connecter: `admin` / `admin_secure_2024`
3. Sélectionner realm: `gaveurs-production`
4. **Clients** → **backend-api**
5. **Credentials** tab
6. **Copier le Client secret**

### Méthode 2: Via l'API (Avancé)

Le script Linux affiche automatiquement le client secret à la fin.

Sur Windows, utiliser cette commande:
```bash
curl -X GET "http://localhost:8080/admin/realms/gaveurs-production/clients/<CLIENT_UUID>/client-secret" ^
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

### Configuration Backend

Ajouter le secret dans `backend-api/.env`:

```bash
# Keycloak Authentication
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=gaveurs-production
KEYCLOAK_CLIENT_ID=backend-api
KEYCLOAK_CLIENT_SECRET=<votre-client-secret-ici>
```

---

## 🧪 Test de l'Authentification

### Test 1: Connexion Console Keycloak

```bash
# URL: http://localhost:8080/realms/gaveurs-production/account
# Username: jean.martin@gaveur.fr
# Password: gaveur123
```

Si succès → Configuration OK ✅

### Test 2: Test Token API

```bash
curl -X POST "http://localhost:8080/realms/gaveurs-production/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=jean.martin@gaveur.fr" \
  -d "password=gaveur123" \
  -d "grant_type=password" \
  -d "client_id=gaveurs-frontend"
```

Devrait retourner un `access_token` ✅

### Test 3: Connexion Frontend

1. Démarrer un frontend:
   ```bash
   cd euralis-frontend
   npm run dev
   ```

2. Aller sur http://localhost:3000

3. Cliquer "Login" (si implémenté)

4. Se connecter avec `superviseur@euralis.fr` / `super123`

---

## 🔧 Variables d'Environnement

Les scripts utilisent ces variables (optionnelles):

```bash
# URL Keycloak (défaut: http://localhost:8080)
KEYCLOAK_URL=http://localhost:8080

# Admin credentials (défauts)
KEYCLOAK_ADMIN=admin
KEYCLOAK_ADMIN_PASSWORD=admin_secure_2024
```

**Override example**:
```bash
# Linux/Mac
export KEYCLOAK_URL=http://keycloak.mydomain.com:8080
./scripts/configure-keycloak.sh

# Windows
set KEYCLOAK_URL=http://keycloak.mydomain.com:8080
scripts\configure-keycloak.bat
```

---

## 🐛 Dépannage

### Erreur: "Keycloak failed to start"

**Cause**: Keycloak pas démarré ou pas accessible

**Solution**:
```bash
# Vérifier si Keycloak tourne
docker ps | grep keycloak

# Démarrer Keycloak
docker-compose -f docker-compose.keycloak.yml up -d

# Voir les logs
docker logs gaveurs-keycloak -f

# Attendre 30-60s puis relancer le script
```

### Erreur: "Failed to get access token"

**Cause**: Credentials admin incorrects

**Solution**:
1. Vérifier dans `docker-compose.keycloak.yml`:
   ```yaml
   KEYCLOAK_ADMIN: admin
   KEYCLOAK_ADMIN_PASSWORD: admin_secure_2024
   ```

2. Redémarrer Keycloak:
   ```bash
   docker-compose -f docker-compose.keycloak.yml down
   docker-compose -f docker-compose.keycloak.yml up -d
   ```

3. Attendre 60s et relancer le script

### Erreur: "Realm already exists" (warnings)

**Cause**: Configuration déjà existante (normal)

**Solution**: Les warnings sont normaux si vous relancez le script. Il met à jour la config existante.

### Erreur: "curl: command not found"

**Cause**: Curl non installé

**Solution**:
```bash
# Ubuntu/Debian
sudo apt-get install curl

# Mac (via Homebrew)
brew install curl

# Windows
# Curl inclus dans Windows 10+
# Si absent: télécharger depuis https://curl.se/windows/
```

---

## 📚 Documentation Keycloak

- **Official Docs**: https://www.keycloak.org/documentation
- **Admin REST API**: https://www.keycloak.org/docs-api/latest/rest-api/
- **Securing Apps**: https://www.keycloak.org/docs/latest/securing_apps/

---

## 🔄 Réinitialisation

Pour repartir de zéro:

### Option 1: Supprimer le realm via l'interface

1. Keycloak Console → `gaveurs-production`
2. **Realm settings** → **Action** → **Delete**
3. Relancer le script de configuration

### Option 2: Réinitialiser complètement Keycloak

```bash
# Arrêter et supprimer les volumes
docker-compose -f docker-compose.keycloak.yml down -v

# Redémarrer
docker-compose -f docker-compose.keycloak.yml up -d

# Attendre 60s puis relancer le script
scripts/configure-keycloak.sh
```

---

## ✅ Checklist de Vérification

Après exécution du script, vérifier:

- [ ] Console Keycloak accessible: http://localhost:8080
- [ ] Login admin fonctionne: `admin` / `admin_secure_2024`
- [ ] Realm `gaveurs-production` existe
- [ ] 4 clients créés (backend-api, euralis-frontend, gaveurs-frontend, sqal-frontend)
- [ ] 5 realm roles créés
- [ ] Client roles créés pour chaque frontend
- [ ] 5 utilisateurs de test créés
- [ ] Login test fonctionne: `jean.martin@gaveur.fr` / `gaveur123`
- [ ] Client secret backend-api récupéré et ajouté à `.env`

---

## 🎯 Prochaines Étapes

1. **Récupérer le client secret** backend-api et l'ajouter à `backend-api/.env`

2. **Intégrer dans les frontends**:
   - Installer `@react-oauth/google` ou `keycloak-js`
   - Configurer l'authentification
   - Ajouter boutons Login/Logout
   - Protéger les routes

3. **Tester l'authentification** sur chaque frontend

4. **Personnaliser**:
   - Ajouter plus d'utilisateurs
   - Ajuster les rôles selon besoins
   - Personnaliser le thème de login

---

**Configuration automatisée terminée!** ✅

Les utilisateurs peuvent maintenant se connecter aux frontends avec les comptes de test.
