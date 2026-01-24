# 🚀 Sprint 4 - Guide Démarrage Rapide

Guide pour tester rapidement le workflow 3-courbes PySR sans configuration complexe.

---

## ⚡ Démarrage Ultra-Rapide (3 minutes)

### Option A: Mode Démo (Sans Authentification)

**Le plus simple pour tester immédiatement les nouvelles pages.**

1. **Démarrer le backend**:
```bash
cd backend-api
# Activer l'environnement virtuel
source venv/bin/activate  # Windows: venv\Scripts\activate

# Démarrer FastAPI
uvicorn app.main:app --reload --port 8000
```

2. **Créer des données de test**:
```bash
# Depuis la racine du projet
./scripts/test_sprint4_frontend.sh
# Windows: scripts\test_sprint4_frontend.bat
```

3. **Démarrer le frontend gaveurs**:
```bash
cd gaveurs-frontend
npm run dev
```

4. **Accéder au menu démo**:
```
http://localhost:3000/demo/menu
```

5. **Cliquer sur "Dashboard 3-Courbes"** → Accès direct sans login!

---

### Option B: Avec Authentification (Fallback sans Keycloak)

**Si vous voulez tester le flow complet avec login.**

1. **Démarrer backend et frontend** (étapes 1-3 ci-dessus)

2. **Aller à la page de login**:
```
http://localhost:3000/login
```

3. **Se connecter avec un compte superviseur**:
- Email: `superviseur@euralis.fr`
- Mot de passe: `super123`

OU

- Email: `admin@euralis.fr`
- Mot de passe: `admin123`

4. **Naviguer vers**:
```
http://localhost:3000/lots/3468/courbes-sprint3
```

**Note**: Si Keycloak n'est pas démarré, le backend utilise automatiquement le **fallback** d'authentification simple.

---

## 📊 Pages à Tester

### 1. Frontend Euralis (Superviseurs)

**Liste des courbes**:
```
http://localhost:3000/euralis/courbes
```
- ✅ Table avec filtres statut/site
- ✅ Stats cards (EN_ATTENTE, VALIDEE, etc.)
- ✅ Navigation vers détails

**Détail d'une courbe**:
```
http://localhost:3000/euralis/courbes/1
```
- ✅ Graphique Chart.js
- ✅ Équation PySR
- ✅ Modal validation superviseur
- ✅ Workflow valider/rejeter

### 2. Frontend Gaveurs

**Dashboard 3-Courbes** (★ NOUVEAU Sprint 4):
```
http://localhost:3000/lots/3468/courbes-sprint3
```
- ✅ Graphique 2 courbes (théorique + réelle)
- ✅ Stats cards temps réel
- ✅ Table historique doses
- ✅ Panel corrections IA
- ✅ Modal saisie dose

**Menu Démo** (Bypass auth):
```
http://localhost:3000/demo/menu
```
- ✅ Accès rapide à toutes les pages de démo
- ✅ Setup automatique utilisateur mock

---

## 🔧 Configuration Keycloak (Optionnel)

**Si vous voulez utiliser Keycloak complet:**

### Prérequis
- Docker installé
- Keycloak configuré sur port 8080

### Démarrer Keycloak

```bash
# Avec Docker
docker run -d \
  -p 8080:8080 \
  -e KEYCLOAK_ADMIN=admin \
  -e KEYCLOAK_ADMIN_PASSWORD=admin \
  quay.io/keycloak/keycloak:latest \
  start-dev
```

### Accéder à Keycloak Admin
```
http://localhost:8080/admin
Login: admin / admin
```

### Créer le Realm `gaveurs-production`

1. Aller dans "Master" dropdown (en haut à gauche)
2. Cliquer "Create realm"
3. Name: `gaveurs-production`
4. Save

### Créer le Client `backend-api`

1. Aller dans Clients → Create client
2. Client ID: `backend-api`
3. Client authentication: ON
4. Standard flow: ON
5. Direct access grants: ON
6. Save

7. Onglet Credentials → Copier le "Client secret"
8. Mettre à jour dans `backend-api/.env`:
   ```
   KEYCLOAK_CLIENT_SECRET=<votre-secret-copié>
   ```

### Créer des Utilisateurs Test

**Superviseur**:
- Username: `superviseur@euralis.fr`
- Email: `superviseur@euralis.fr`
- First name: Marie
- Last name: Dupont
- Password: `super123` (Temporary: OFF)

**Admin**:
- Username: `admin@euralis.fr`
- Email: `admin@euralis.fr`
- First name: Jean
- Last name: Martin
- Password: `admin123` (Temporary: OFF)

### Redémarrer le Backend

```bash
cd backend-api
uvicorn app.main:app --reload
```

Maintenant le login utilisera Keycloak au lieu du fallback!

---

## 🐛 Troubleshooting

### Erreur 422 au login

**Symptôme**: `POST http://localhost:8000/api/auth/login 422 (Unprocessable Entity)`

**Causes possibles**:
1. ❌ Keycloak non démarré → ✅ **Solution**: Le fallback simple devrait fonctionner automatiquement
2. ❌ Format de requête incorrect → ✅ **Corrigé** dans le dernier commit (username au lieu de email)
3. ❌ Backend non démarré → ✅ Démarrez avec `uvicorn app.main:app --reload`

**Test rapide**: Vérifier que le backend répond
```bash
curl http://localhost:8000/health
# Devrait retourner: {"status":"healthy"}
```

### Frontend ne se connecte pas au backend

**Vérifier `.env.local`**:
```bash
# gaveurs-frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Si le fichier n'existe pas, le créer avec cette ligne.

### Dashboard 3-courbes vide

**Créer des données de test**:
```bash
./scripts/test_sprint4_frontend.sh
```

Ce script va:
1. Créer une courbe théorique PySR
2. La valider
3. Saisir 3 doses réelles
4. Afficher les URLs de test

### Erreur CORS

Si vous voyez des erreurs CORS dans la console:

1. Vérifier que le backend est sur port 8000
2. Vérifier que `NEXT_PUBLIC_API_URL` est correct dans `.env.local`
3. Le backend a déjà CORS configuré en mode développement (allow_origins=["*"])

---

## ✅ Checklist Test Complet

### Workflow Superviseur (Euralis)
- [ ] Aller sur `/euralis/courbes`
- [ ] Voir liste avec au moins 1 courbe EN_ATTENTE
- [ ] Cliquer "Voir" sur une courbe
- [ ] Vérifier graphique Chart.js (14 points)
- [ ] Vérifier équation PySR affichée
- [ ] Cliquer "Valider la courbe"
- [ ] Entrer nom + commentaire
- [ ] Valider
- [ ] Vérifier redirection vers liste
- [ ] Vérifier statut passé à VALIDEE

### Workflow Gaveur (Dashboard 3-Courbes)
- [ ] Aller sur `/lots/3468/courbes-sprint3`
- [ ] Vérifier graphique avec 2 courbes:
  - [ ] Courbe théorique (bleu pointillé)
  - [ ] Courbe réelle (vert rempli)
- [ ] Vérifier stats cards (jours, écarts, alertes)
- [ ] Vérifier table historique doses
- [ ] Cliquer "Saisir dose du jour"
- [ ] Entrer: Jour 4, Dose 195g
- [ ] Valider
- [ ] Vérifier apparition dans table
- [ ] Vérifier recalcul stats

### Test Corrections IA
- [ ] Saisir dose avec écart >10%: Jour 5, Dose 250g (théorique: 210g)
- [ ] Vérifier alerte rouge dans table
- [ ] Vérifier apparition correction IA dans panel
- [ ] Cliquer "Accepter" sur correction
- [ ] Vérifier disparition de la correction

---

## 📚 Documentation Complète

Pour plus de détails, voir:
- **[SPRINT4_COMPLETE.md](SPRINT4_COMPLETE.md)** - Documentation complète Sprint 4
- **[SPRINT3_COMPLETE.md](SPRINT3_COMPLETE.md)** - Backend Sprint 3
- **[README.md](README.md)** - Vue d'ensemble système

---

## 🎯 Résumé URLs Essentielles

| Page | URL | Description |
|------|-----|-------------|
| **Menu Démo** | http://localhost:3000/demo/menu | ★ Point d'entrée rapide sans auth |
| **Dashboard 3-Courbes** | http://localhost:3000/lots/3468/courbes-sprint3 | ★ Page principale Sprint 4 |
| **Euralis Liste** | http://localhost:3000/euralis/courbes | Liste courbes superviseur |
| **Euralis Détail** | http://localhost:3000/euralis/courbes/1 | Validation courbe |
| **Login** | http://localhost:3000/login | Authentification (fallback ou Keycloak) |
| **Backend Docs** | http://localhost:8000/docs | Swagger API interactive |
| **Health Check** | http://localhost:8000/health | Vérifier backend opérationnel |

---

**Bon test! 🦆**
