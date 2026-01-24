# 🔐 Login Gaveur & Données Simulateur

**Date** : 30 décembre 2025
**Statut** : **COMPLET** ✅

---

## 📋 Réponses aux Questions

### 1. ❓ Le simulateur génère-t-il des données visualisables pour jean.martin@gaveur.fr ?

**Réponse** : **NON**, actuellement le simulateur génère des **données CSV**, pas des données dans la base PostgreSQL.

**Fichier** : [Simulator/gavage_data_simulator.py](Simulator/gavage_data_simulator.py)

**Ce qu'il fait** :
- Génère des gaveurs avec emails `prenom.nom@gaveur.fr` (ligne 136)
- Génère des lots de gavage avec doses journalières
- **Sauvegarde dans un fichier CSV** (pas dans la base de données)

**Exemple de sortie** :
```python
gaveur = {
    'id': 1,
    'nom': 'Jean Martin',
    'email': 'jean.martin@gaveur.fr',
    'site_code': 'LL',
    'performance_level': 'bon'
}

# Sauvegardé dans simulated_gavage_data.csv
df.to_csv('simulated_gavage_data.csv', sep=';')
```

**Pour visualiser ces données** :
1. Il faut **importer le CSV dans PostgreSQL**
2. OU créer un nouveau script qui envoie les données directement à l'API

---

### 2. ✅ Workflow de Login - Page Lots comme Accueil

**Votre proposition** :
```
1. Gaveur arrive sur http://localhost:3001
2. Affiche page de login
3. Entre credentials : jean.martin@gaveur.fr / gaveur123
4. Si succès → Redirection vers /lots (page d'accueil)
5. Si échec → Message d'erreur
```

**Réponse** : **Totalement d'accord !** C'est le workflow le plus logique. ✅

---

## ✅ Solutions Implémentées

### 1. Page de Login Gaveur

**Fichier créé** : [gaveurs-frontend/app/page.tsx](gaveurs-frontend/app/page.tsx)

**Interface** :

```
┌──────────────────────────────────┐
│      🦆 Gaveurs App              │
│  Connectez-vous à votre espace   │
├──────────────────────────────────┤
│                                  │
│  Email                           │
│  [jean.martin@gaveur.fr        ] │
│                                  │
│  Mot de passe                    │
│  [••••••••                     ] │
│                                  │
│  [🔑 Se connecter]               │
│                                  │
├──────────────────────────────────┤
│  Compte de test disponible:      │
│  jean.martin@gaveur.fr           │
│  gaveur123                       │
└──────────────────────────────────┘
```

**Fonctionnalités** :
- ✅ Formulaire email/password
- ✅ Validation côté client
- ✅ Appel API `POST /api/auth/gaveur/login`
- ✅ Stockage token et infos gaveur dans localStorage
- ✅ Redirection vers `/lots` après succès
- ✅ Message d'erreur si échec

**Code clé** :

```typescript
const handleLogin = async (e: React.FormEvent) => {
  e.preventDefault();

  const response = await fetch(`${apiUrl}/api/auth/gaveur/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error('Identifiants invalides');
  }

  const data = await response.json();

  // Stocker les informations
  localStorage.setItem('gaveur_id', data.gaveur.id);
  localStorage.setItem('gaveur_nom', data.gaveur.nom);
  localStorage.setItem('gaveur_email', data.gaveur.email);
  localStorage.setItem('gaveur_token', data.token);

  // Redirection vers page lots
  router.push('/lots');
};
```

---

### 2. Route Backend d'Authentification

**Fichier créé** : [backend-api/app/routers/auth.py](backend-api/app/routers/auth.py)

**Endpoint** : `POST /api/auth/gaveur/login`

**Request** :
```json
{
  "email": "jean.martin@gaveur.fr",
  "password": "gaveur123"
}
```

**Response** (succès):
```json
{
  "success": true,
  "gaveur": {
    "id": 1,
    "nom": "Jean Martin",
    "prenom": "Jean",
    "email": "jean.martin@gaveur.fr",
    "telephone": "0612345678",
    "site": "LL"
  },
  "token": "abc123xyz456..." // Token temporaire
}
```

**Response** (échec):
```json
{
  "detail": "Email ou mot de passe invalide"
}
```

**Logique** :

```python
@router.post("/gaveur/login")
async def login_gaveur(credentials: LoginRequest, request: Request):
    pool = request.app.state.db_pool

    async with pool.acquire() as conn:
        # Chercher gaveur par email
        gaveur = await conn.fetchrow(
            """
            SELECT id, nom, prenom, email, telephone, site_origine
            FROM gaveurs
            WHERE email = $1
            """,
            credentials.email
        )

        if not gaveur:
            raise HTTPException(status_code=401, detail="Email ou mot de passe invalide")

        # TEMPORAIRE : Accepter "gaveur123" pour tous les comptes
        if credentials.password != "gaveur123":
            raise HTTPException(status_code=401, detail="Email ou mot de passe invalide")

        # Générer token temporaire
        token = secrets.token_urlsafe(32)

        return LoginResponse(
            success=True,
            gaveur={...},
            token=token
        )
```

**Sécurité temporaire** :
- ⚠️ **Tous les gaveurs** ont le même mot de passe : `gaveur123`
- ⚠️ **Pas de hashing** (bcrypt/argon2)
- ⚠️ **Token simple** (pas JWT)
- ✅ **Fonctionnel pour développement**

---

### 3. Enregistrement du Router

**Fichier modifié** : [backend-api/app/main.py](backend-api/app/main.py)

**Changements** :
```python
# Ligne 26 : Import
from app.routers import euralis, sqal, consumer_feedback, simulator_control, bug_tracking, lots, ml, auth as gaveur_auth

# Ligne 337 : Enregistrement
app.include_router(gaveur_auth.router)  # Authentification gaveurs
```

---

## 🎯 Workflow Complet

### Workflow Utilisateur

```
1. Gaveur ouvre http://localhost:3001
   ↓
2. Affichage page de login
   ┌──────────────────────────────┐
   │ 🦆 Gaveurs App               │
   │ jean.martin@gaveur.fr        │
   │ gaveur123                    │
   │ [Se connecter]               │
   └──────────────────────────────┘
   ↓
3. Soumet formulaire
   ↓
4. Frontend → POST /api/auth/gaveur/login
   ↓
5. Backend vérifie dans table gaveurs
   ↓
   ┌─────────────────────┐
   │ Email trouvé ?      │
   │ NO → 401 Error      │
   │ YES ↓               │
   ├─────────────────────┤
   │ Password correct ?  │
   │ NO → 401 Error      │
   │ YES ↓               │
   └─────────────────────┘
   ↓
6. Retourne gaveur + token
   ↓
7. Frontend stocke dans localStorage:
   - gaveur_id
   - gaveur_nom
   - gaveur_email
   - gaveur_token
   ↓
8. Redirection → /lots
   ↓
9. Page lots affiche les lots du gaveur
```

### Workflow Technique

```
Frontend (Next.js)
├─ app/page.tsx (Login)
│  └─ POST /api/auth/gaveur/login
│     └─ Stockage localStorage
│        └─ router.push('/lots')
│
├─ app/lots/page.tsx (Accueil)
│  └─ Charge lots depuis localStorage.gaveur_id
│
└─ app/lots/[id]/gavage/page.tsx
   └─ Saisie gavage pour ce lot

Backend (FastAPI)
├─ app/routers/auth.py
│  └─ POST /api/auth/gaveur/login
│     └─ SELECT FROM gaveurs WHERE email = $1
│        └─ Vérif password (temporaire: "gaveur123")
│           └─ Return {gaveur, token}
│
└─ app/routers/lots.py
   └─ GET /api/lots
      └─ SELECT FROM lots WHERE gaveur_id = ?
```

---

## 📊 Table `gaveurs` Requise

Pour que le login fonctionne, la table `gaveurs` doit contenir au moins un gaveur :

```sql
-- Vérifier si Jean Martin existe
SELECT * FROM gaveurs WHERE email = 'jean.martin@gaveur.fr';

-- Si absent, créer un gaveur de test
INSERT INTO gaveurs (nom, prenom, email, telephone, site_origine)
VALUES ('Martin', 'Jean', 'jean.martin@gaveur.fr', '0612345678', 'LL')
RETURNING id;
```

**Créer aussi un lot pour ce gaveur** :

```sql
-- Supposons que gaveur_id = 1
INSERT INTO lots (
    code_lot, gaveur_id, site_origine, statut,
    nombre_canards, nombre_jours_gavage_ecoules,
    poids_moyen_actuel, objectif_poids_final,
    date_debut_gavage
)
VALUES (
    'LL_042', 1, 'LL', 'en_gavage',
    200, 12, 4854, 5500,
    CURRENT_DATE - INTERVAL '12 days'
)
RETURNING id;
```

---

## 🔄 Import Données Simulateur → Base de Données

Le simulateur `Simulator/gavage_data_simulator.py` génère un CSV. Pour l'utiliser :

### Option 1 : Import CSV Existant

```bash
# 1. Générer CSV avec le simulateur
cd Simulator
python gavage_data_simulator.py --nb-lots 10 --nb-gaveurs 5 --output test_data.csv

# 2. Importer dans PostgreSQL (à créer)
psql -U gaveurs_admin -d gaveurs_db -c "\COPY gaveurs FROM 'test_data.csv' CSV HEADER"
```

### Option 2 : Nouveau Script Direct API

Créer `scripts/generate_from_simulator.py` :

```python
import requests
from Simulator.gavage_data_simulator import GavageDataSimulator

# Générer données
simulator = GavageDataSimulator()
gaveurs = simulator.generate_gaveurs(5)

# Envoyer à l'API
for gaveur in gaveurs:
    response = requests.post(
        'http://localhost:8000/api/gaveurs',
        json=gaveur
    )
    print(f"✅ Gaveur créé: {gaveur['email']}")
```

---

## ✅ Checklist

### Frontend
- ✅ Page de login créée ([gaveurs-frontend/app/page.tsx](gaveurs-frontend/app/page.tsx))
- ✅ Formulaire email/password
- ✅ Appel API `/api/auth/gaveur/login`
- ✅ Stockage localStorage (gaveur_id, token, etc.)
- ✅ Redirection vers `/lots` après succès
- ✅ Gestion erreurs (401)

### Backend
- ✅ Route `POST /api/auth/gaveur/login` créée
- ✅ Vérification email dans table `gaveurs`
- ✅ Vérification password (temporaire: "gaveur123")
- ✅ Génération token (secrets.token_urlsafe)
- ✅ Router enregistré dans `main.py`

### Base de Données
- ⏳ Créer gaveur de test (jean.martin@gaveur.fr)
- ⏳ Créer lots associés
- ⏳ (Optionnel) Importer données du simulateur CSV

---

## 🚀 Test du Workflow

### 1. Démarrer le backend
```bash
cd backend-api
uvicorn app.main:app --reload --port 8000
```

### 2. Démarrer le frontend
```bash
cd gaveurs-frontend
npm run dev
```

### 3. Créer gaveur de test
```sql
INSERT INTO gaveurs (nom, prenom, email, telephone, site_origine)
VALUES ('Martin', 'Jean', 'jean.martin@gaveur.fr', '0612345678', 'LL');
```

### 4. Tester le login
```
1. Ouvrir http://localhost:3001
2. Entrer:
   - Email: jean.martin@gaveur.fr
   - Password: gaveur123
3. Cliquer "Se connecter"
4. Devrait rediriger vers /lots
```

### 5. Vérifier localStorage
```javascript
// Dans console navigateur
console.log(localStorage.getItem('gaveur_id'));
console.log(localStorage.getItem('gaveur_nom'));
console.log(localStorage.getItem('gaveur_email'));
console.log(localStorage.getItem('gaveur_token'));
```

---

## 📝 Notes

### Sécurité Temporaire

**⚠️ ATTENTION** : Cette implémentation est **TEMPORAIRE** pour développement.

**Limitations** :
- Tous les gaveurs ont le même mot de passe
- Pas de hashing de mot de passe
- Token simple (pas JWT)
- Pas d'expiration de session
- Pas de refresh token

**À implémenter en Phase 4** :
- JWT (JSON Web Tokens)
- Keycloak pour authentification centralisée
- Hashing bcrypt/argon2 pour mots de passe
- Expiration tokens (15 min access, 7 jours refresh)
- Protection routes avec middleware
- Rôles et permissions (gaveur, superviseur, admin)

### Données Simulateur

Le simulateur `Simulator/gavage_data_simulator.py` est **indépendant** de l'API :
- Génère des **fichiers CSV**
- Ne communique **pas** avec la base de données
- Utile pour **tests ML** et **analyses statistiques**

Pour visualiser les données dans l'app :
1. **Option simple** : Créer manuellement des gaveurs/lots via SQL
2. **Option avancée** : Créer script d'import CSV → PostgreSQL
3. **Option future** : Modifier le simulateur pour appeler l'API directement

---

**Date de finalisation** : 30 décembre 2025
**Prochaine étape** :
1. Créer gaveur de test `jean.martin@gaveur.fr` dans la base
2. Tester le workflow de login
3. Vérifier que la page `/lots` affiche bien les lots du gaveur connecté
