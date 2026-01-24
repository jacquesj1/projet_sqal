# Guide de Configuration Keycloak - Système Gaveurs V3.0

**Date**: 22 Décembre 2025

---

## 🚀 Démarrage Rapide

### 1. Démarrer Keycloak

**Windows**:
```bash
scripts\start-keycloak.bat
```

**Linux/Mac**:
```bash
chmod +x scripts/start-keycloak.sh
./scripts/start-keycloak.sh
```

**Ou manuellement**:
```bash
# Créer réseau
docker network create gaveurs-network

# Démarrer services
docker-compose -f docker-compose.keycloak.yml up -d

# Voir logs
docker logs -f gaveurs-keycloak
```

### 2. Accès Admin Console

**URL**: http://localhost:8080

**Credentials**:
- Username: `admin`
- Password: `admin_secure_2024`

---

## 📋 Configuration Étape par Étape

### Étape 1: Créer le Realm

1. Cliquer sur **Master** (dropdown en haut à gauche)
2. Cliquer sur **Create Realm**
3. **Realm name**: `gaveurs-production`
4. **Enabled**: ON
5. Cliquer **Create**

### Étape 2: Créer les Clients (3 frontends)

#### Client 1: Backend API

1. **Clients** → **Create client**
2. **Client type**: `OpenID Connect`
3. **Client ID**: `backend-api`
4. **Name**: `Backend API`
5. Cliquer **Next**

6. **Client authentication**: ON
7. **Authorization**: OFF
8. **Authentication flow**: cocher toutes les options
9. Cliquer **Next**

10. **Root URL**: `http://localhost:8000`
11. **Valid redirect URIs**: `*`
12. **Web origins**: `*`
13. Cliquer **Save**

14. Aller dans l'onglet **Credentials**
15. **Copier le Client Secret** → À mettre dans `.env` backend

#### Client 2: Euralis Frontend

1. **Clients** → **Create client**
2. **Client ID**: `euralis-frontend`
3. **Name**: `Euralis Dashboard`
4. Cliquer **Next**

5. **Client authentication**: OFF (public client)
6. **Authorization**: OFF
7. **Authentication flow**:
   - ✅ Standard flow
   - ✅ Direct access grants
8. Cliquer **Next**

9. **Root URL**: `http://localhost:3000`
10. **Valid redirect URIs**:
    - `http://localhost:3000/*`
    - `http://localhost:3000/auth/callback`
11. **Valid post logout redirect URIs**: `http://localhost:3000/*`
12. **Web origins**: `http://localhost:3000`
13. Cliquer **Save**

#### Client 3: Gaveurs Frontend

1. **Clients** → **Create client**
2. **Client ID**: `gaveurs-frontend`
3. **Name**: `Gaveurs Individual App`
4. Répéter les mêmes étapes que Euralis mais avec:
   - **Root URL**: `http://localhost:3001`
   - **Valid redirect URIs**: `http://localhost:3001/*`
   - **Web origins**: `http://localhost:3001`

#### Client 4: SQAL Frontend

1. **Clients** → **Create client**
2. **Client ID**: `sqal-frontend`
3. **Name**: `SQAL Quality Control`
4. Répéter les mêmes étapes mais avec:
   - **Root URL**: `http://localhost:5173`
   - **Valid redirect URIs**: `http://localhost:5173/*`
   - **Web origins**: `http://localhost:5173`

### Étape 3: Créer les Realm Roles

**Menu** → **Realm roles** → **Create role**

Créer ces 5 rôles:

1. **Role name**: `admin`
   - **Description**: `Administrateur système - accès total`

2. **Role name**: `superviseur`
   - **Description**: `Superviseur Euralis - multi-sites`

3. **Role name**: `gaveur`
   - **Description**: `Gaveur individuel`

4. **Role name**: `technicien_sqal`
   - **Description**: `Technicien SQAL - contrôle qualité`

5. **Role name**: `consommateur`
   - **Description**: `Consommateur - feedback uniquement`

### Étape 4: Créer les Client Roles

#### euralis-frontend

1. **Clients** → **euralis-frontend** → **Roles** tab
2. **Create role**

Créer ces rôles:
- `view_all_sites` - Voir tous les sites
- `manage_gaveurs` - Gérer les gaveurs
- `view_analytics` - Voir les analytics
- `export_reports` - Exporter rapports
- `manage_lots` - Gérer les lots

#### gaveurs-frontend

1. **Clients** → **gaveurs-frontend** → **Roles** tab

Créer ces rôles:
- `manage_own_data` - Gérer ses propres données
- `view_own_analytics` - Voir ses analytics
- `use_ai_training` - Utiliser training IA
- `view_blockchain` - Voir blockchain
- `submit_feedback` - Soumettre feedback

#### sqal-frontend

1. **Clients** → **sqal-frontend** → **Roles** tab

Créer ces rôles:
- `view_sensors` - Voir capteurs
- `manage_quality` - Gérer qualité
- `export_reports` - Exporter rapports
- `calibrate_devices` - Calibrer dispositifs
- `view_realtime` - Voir temps réel

### Étape 5: Créer les Users

#### User 1: Administrateur

1. **Users** → **Add user**

**User details**:
- **Username**: `admin@euralis.fr`
- **Email**: `admin@euralis.fr`
- **Email verified**: ON
- **First name**: `Admin`
- **Last name**: `Euralis`
- **Enabled**: ON

2. Cliquer **Create**

3. **Credentials** tab:
   - **Password**: `admin123`
   - **Temporary**: OFF
   - Cliquer **Set password** → Confirmer

4. **Role mappings** tab:
   - **Assign role** → Chercher `admin` → Cocher → **Assign**

5. **Role mappings** tab → **Filter by clients**:
   - **euralis-frontend**: Assigner TOUS les rôles
   - **gaveurs-frontend**: Assigner TOUS les rôles
   - **sqal-frontend**: Assigner TOUS les rôles

#### User 2: Superviseur Euralis

1. **Users** → **Add user**

**User details**:
- **Username**: `superviseur@euralis.fr`
- **Email**: `superviseur@euralis.fr`
- **Email verified**: ON
- **First name**: `Marie`
- **Last name**: `Dupont`
- **Enabled**: ON

2. **Credentials**:
   - **Password**: `super123`
   - **Temporary**: OFF

3. **Role mappings**:
   - **Realm roles**: `superviseur`
   - **euralis-frontend roles**:
     - `view_all_sites`
     - `manage_gaveurs`
     - `view_analytics`
     - `export_reports`
     - `manage_lots`

#### User 3: Gaveur Jean Martin

1. **Users** → **Add user**

**User details**:
- **Username**: `jean.martin@gaveur.fr`
- **Email**: `jean.martin@gaveur.fr`
- **Email verified**: ON
- **First name**: `Jean`
- **Last name**: `Martin`
- **Enabled**: ON

2. **Credentials**:
   - **Password**: `gaveur123`
   - **Temporary**: OFF

3. **Role mappings**:
   - **Realm roles**: `gaveur`
   - **gaveurs-frontend roles**:
     - `manage_own_data`
     - `view_own_analytics`
     - `use_ai_training`
     - `view_blockchain`

4. **Attributes** tab → **Add attribute**:
   - **Key**: `gaveur_id`, **Value**: `1`
   - **Key**: `site`, **Value**: `LL`
   - Cliquer **Save**

#### User 4: Gaveur Sophie Dubois

1. **Users** → **Add user**

**User details**:
- **Username**: `sophie.dubois@gaveur.fr`
- **Email**: `sophie.dubois@gaveur.fr`
- **Email verified**: ON
- **First name**: `Sophie`
- **Last name**: `Dubois`
- **Enabled**: ON

2. **Credentials**:
   - **Password**: `gaveur123`
   - **Temporary**: OFF

3. **Role mappings**:
   - **Realm roles**: `gaveur`
   - **gaveurs-frontend roles**: Tous

4. **Attributes**:
   - **gaveur_id**: `2`
   - **site**: `LS`

#### User 5: Technicien SQAL

1. **Users** → **Add user**

**User details**:
- **Username**: `tech@sqal.fr`
- **Email**: `tech@sqal.fr`
- **Email verified**: ON
- **First name**: `Technicien`
- **Last name**: `SQAL`
- **Enabled**: ON

2. **Credentials**:
   - **Password**: `sqal123`
   - **Temporary**: OFF

3. **Role mappings**:
   - **Realm roles**: `technicien_sqal`
   - **sqal-frontend roles**:
     - `view_sensors`
     - `manage_quality`
     - `export_reports`
     - `view_realtime`

### Étape 6: Récupérer le Client Secret (Backend)

1. **Clients** → **backend-api**
2. **Credentials** tab
3. **Copier le Client secret**
4. L'ajouter dans `backend-api/.env`:
   ```
   KEYCLOAK_CLIENT_SECRET=votre-secret-ici
   ```

---

## ✅ Vérification Configuration

### Tester l'authentification

1. Aller sur http://localhost:8080/realms/gaveurs-production/account
2. Tenter de se connecter avec:
   - **Username**: `jean.martin@gaveur.fr`
   - **Password**: `gaveur123`
3. Si succès → Configuration OK ✅

### Vérifier les rôles

1. **Users** → **jean.martin@gaveur.fr**
2. **Role mappings** tab
3. Vérifier:
   - ✅ Realm role: `gaveur`
   - ✅ Client roles (gaveurs-frontend): 4 rôles

---

## 📝 Résumé des Comptes Créés

| Email | Password | Realm Role | Frontends Autorisés |
|-------|----------|------------|---------------------|
| admin@euralis.fr | admin123 | admin | Tous (3) |
| superviseur@euralis.fr | super123 | superviseur | euralis-frontend |
| jean.martin@gaveur.fr | gaveur123 | gaveur | gaveurs-frontend |
| sophie.dubois@gaveur.fr | gaveur123 | gaveur | gaveurs-frontend |
| tech@sqal.fr | sqal123 | technicien_sqal | sqal-frontend |

---

## 🔧 Configuration Avancée (Optionnel)

### Activer l'enregistrement des utilisateurs

1. **Realm settings** → **Login** tab
2. **User registration**: ON
3. **Email as username**: ON
4. **Save**

### Personnaliser le thème de login

1. **Realm settings** → **Themes** tab
2. **Login theme**: Choisir un thème
3. Ou créer un thème custom dans `/opt/keycloak/themes/`

### Configurer les tokens

1. **Realm settings** → **Tokens** tab
2. **Access Token Lifespan**: `5 minutes` (par défaut)
3. **Refresh Token Lifespan**: `30 minutes`
4. **Save**

---

## 🐛 Troubleshooting

### Keycloak ne démarre pas

```bash
# Vérifier logs
docker logs gaveurs-keycloak

# Vérifier DB
docker logs gaveurs-keycloak-db

# Redémarrer
docker-compose -f docker-compose.keycloak.yml restart
```

### Erreur "Realm not found"

- Vérifier que le realm `gaveurs-production` est bien créé
- URL correcte: `http://localhost:8080/realms/gaveurs-production`

### Client secret non visible

- Vérifier que **Client authentication** est ON
- Aller dans **Credentials** tab
- Cliquer **Regenerate** si nécessaire

---

## 📚 Documentation Keycloak

- **Official Docs**: https://www.keycloak.org/documentation
- **Admin Guide**: https://www.keycloak.org/docs/latest/server_admin/
- **Securing Apps**: https://www.keycloak.org/docs/latest/securing_apps/

---

**Configuration terminée !** ✅

Prochaine étape: Intégrer Keycloak avec le backend API
