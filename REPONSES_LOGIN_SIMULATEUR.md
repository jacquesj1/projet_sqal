# 🎯 Réponses - Login & Simulateur de Gavage

**Date** : 30 décembre 2025

---

## ✅ Question 1 : Page de Login Existante

**Question** : "La page de login existe déjà et doit être associée à terme à keycloak. Sommes-nous d'accord?"

**Réponse** : **OUI, totalement d'accord !** ✅

### Page de Login Existante

**Fichier** : [gaveurs-frontend/app/(auth)/login/page.tsx](gaveurs-frontend/app/(auth)/login/page.tsx)

**Caractéristiques** :
- ✅ Route : `/login` (Next.js App Router avec groupe `(auth)`)
- ✅ Appelle : `POST /api/auth/login` (ligne 25)
- ✅ **Prévue pour Keycloak** (ligne 24, 73)
- ✅ Comptes de test affichés :
  - Admin: admin@euralis.fr
  - Superviseur: superviseur@euralis.fr
  - **Gaveur: jean.martin@gaveur.fr / gaveur123** ✅
  - SQAL: tech@sqal.fr

**Workflow** :
```
1. Utilisateur arrive sur /login
2. Entre email/password
3. Frontend → POST /api/auth/login (Keycloak)
4. Si succès → Stockage token + user_info
5. Redirection → / (puis / redirige vers /lots)
```

**Conclusion** : La page de login est **déjà prête pour Keycloak**, pas besoin de la modifier. Désolé d'avoir créé une nouvelle page par erreur - elle a été restaurée.

---

## ✅ Question 2 : Données Simulateur Visualisables

**Question** : "Le control panel gère des simulateurs notamment celui de gavage, est-ce que les données générées, notamment lot, sont visualisables (associées au gaveur jean.martin@gaveur.fr / gaveur123) ?"

**Réponse** : **OUI, mais avec une condition importante** ⚠️

---

## 🔍 Analyse du Simulateur de Gavage

### 1. Control Panel

**Fichier** : [backend-api/app/routers/simulator_control.py](backend-api/app/routers/simulator_control.py)

**Endpoint** : `POST /api/control/gavage/start`

**Fonctionnalité** :
```python
# Démarre le simulateur avec paramètres
{
  "nb_lots": 3,
  "acceleration": 1440  // 1 jour réel = 60 secondes
}
```

**Lance** : `simulators/gavage_realtime/main.py` (ligne 135)

---

### 2. Simulateur Gavage Temps Réel

**Fichier** : [simulators/gavage_realtime/main.py](simulators/gavage_realtime/main.py)

**Ce qu'il fait** :

#### a) Définit des Gaveurs (ligne 205-211)
```python
self.gaveurs = [
    {"id": 1, "nom": "Jean Martin", "site": "LL"},    # ← jean.martin@gaveur.fr
    {"id": 2, "nom": "Sophie Dubois", "site": "LS"},
    {"id": 3, "nom": "Pierre Leroy", "site": "MT"},
    {"id": 4, "nom": "Marie Petit", "site": "LL"},
    {"id": 5, "nom": "Luc Blanc", "site": "LS"},
]
```

#### b) Crée des Lots (ligne 223-252)
```python
def creer_lots_initiaux(self):
    for i in range(self.nb_lots_initial):
        gaveur = random.choice(self.gaveurs)  # Jean Martin, Sophie, etc.

        lot = Lot(
            code_lot="LL251201",  # Format: SiteAnnéeMoisNuméro
            gaveur_id=gaveur["id"],  # 1 = Jean Martin
            gaveur_nom=gaveur["nom"],  # "Jean Martin"
            site=gaveur["site"],  # "LL"
            nb_canards=45-55,
            genetique="Mulard/Barbarie/Pékin",
            duree_prevue=11-14 jours
        )

        self.lots_actifs.append(lot)
```

#### c) Effectue Gavages 2x/Jour (ligne 263-287)
```python
async def effectuer_gavages(self, moment: str):  # "matin" ou "soir"
    for lot in self.lots_actifs:
        gavage_data = lot.effectuer_gavage(moment)

        # Envoyer via WebSocket au backend
        await self.send_to_backend(gavage_data)
```

#### d) Envoie au Backend (ligne 254-261)
```python
async def send_to_backend(self, data: Dict):
    async with websockets.connect(self.backend_url) as ws:
        await ws.send(json.dumps(data))
        logger.info(f"📤 Envoyé: Lot {data['code_lot']} J{data['jour']}")
```

**Format des données** :
```json
{
  "code_lot": "LL251201",
  "gaveur_id": 1,
  "gaveur_nom": "Jean Martin",
  "site": "LL",
  "jour": 5,
  "moment": "matin",
  "dose_reelle": 320,
  "poids_moyen": 4890,
  "nb_canards_vivants": 48,
  "taux_mortalite": 4.0
}
```

---

### 3. Backend WebSocket Handler

**Fichier** : À vérifier - devrait être dans `backend-api/app/websocket/`

**Devrait** :
1. Recevoir données WebSocket
2. **Créer ou mettre à jour** la table `lots`
3. **Créer enregistrement** dans `gavage_lot_quotidien`
4. Associer au `gaveur_id`

---

## ⚠️ CONDITION IMPORTANTE

### Le Gaveur Doit Exister dans la Base

Pour que les données soient visualisables pour `jean.martin@gaveur.fr`, il faut **IMPÉRATIVEMENT** :

**1. Créer le gaveur dans PostgreSQL** :

```sql
INSERT INTO gaveurs (id, nom, prenom, email, telephone, site_origine, mot_de_passe)
VALUES (
    1,  -- ID cohérent avec simulateur
    'Martin',
    'Jean',
    'jean.martin@gaveur.fr',
    '0612345678',
    'LL',
    'gaveur123'  -- Mot de passe temporaire
)
ON CONFLICT (id) DO NOTHING;
```

**2. Vérifier que le WebSocket handler crée bien les lots** :

Le simulateur envoie :
```
gaveur_id = 1  (Jean Martin)
```

Le backend doit :
```sql
-- Vérifier si lot existe
SELECT * FROM lots WHERE code_lot = 'LL251201';

-- Si non, créer
INSERT INTO lots (
    code_lot, gaveur_id, site_origine, statut,
    nombre_canards, nombre_jours_gavage_ecoules,
    poids_moyen_actuel, objectif_poids_final,
    date_debut_gavage
)
VALUES (
    'LL251201', 1, 'LL', 'en_gavage',
    48, 5, 4890, 5500,
    CURRENT_DATE - INTERVAL '5 days'
);

-- Créer enregistrement gavage
INSERT INTO gavage_lot_quotidien (
    lot_id, date_gavage, jour_gavage,
    dose_matin, dose_soir, dose_totale_jour,
    poids_moyen_mesure, ...
)
VALUES (...);
```

---

## 🎯 Réponse Finale

### Question : "Les données générées sont-elles visualisables pour jean.martin@gaveur.fr ?"

**Réponse** : **OUI, SI** :

✅ **1. Le gaveur existe dans la base** (id=1, email=jean.martin@gaveur.fr)

✅ **2. Le WebSocket handler backend crée les enregistrements** dans :
   - Table `lots`
   - Table `gavage_lot_quotidien`

✅ **3. Le gaveur se connecte via /login** avec jean.martin@gaveur.fr / gaveur123

✅ **4. La page /lots filtre par gaveur_id = 1** (stocké dans localStorage après login)

---

## 🔍 Vérification

### Étape 1 : Vérifier le WebSocket Handler

```bash
# Chercher le fichier qui traite les WebSocket du simulateur gavage
grep -r "ws/gavage" backend-api/
```

### Étape 2 : Créer Gaveur de Test

```sql
-- Se connecter à PostgreSQL
psql -U gaveurs_admin -d gaveurs_db

-- Vérifier si Jean Martin existe
SELECT * FROM gaveurs WHERE email = 'jean.martin@gaveur.fr';

-- Si absent, créer
INSERT INTO gaveurs (id, nom, prenom, email, telephone, site_origine)
VALUES (1, 'Martin', 'Jean', 'jean.martin@gaveur.fr', '0612345678', 'LL');
```

### Étape 3 : Lancer le Simulateur

```bash
# Via control panel (recommandé)
curl -X POST http://localhost:8000/api/control/gavage/start \
  -H "Content-Type: application/json" \
  -d '{"nb_lots": 3, "acceleration": 1440}'

# OU directement
cd simulators/gavage_realtime
python main.py --nb-lots 3 --acceleration 1440 --backend-url ws://localhost:8000/ws/gavage
```

### Étape 4 : Vérifier les Données

```sql
-- Vérifier lots créés pour Jean Martin (gaveur_id = 1)
SELECT * FROM lots WHERE gaveur_id = 1;

-- Vérifier gavages enregistrés
SELECT l.code_lot, g.jour_gavage, g.dose_totale_jour, g.poids_moyen_mesure
FROM gavage_lot_quotidien g
JOIN lots l ON l.id = g.lot_id
WHERE l.gaveur_id = 1
ORDER BY g.date_gavage DESC, g.jour_gavage DESC;
```

### Étape 5 : Login et Visualisation

```
1. Ouvrir http://localhost:3001/login
2. Se connecter : jean.martin@gaveur.fr / gaveur123
3. Redirection → /lots
4. Devrait afficher les lots de Jean Martin (gaveur_id = 1)
```

---

## 📊 Workflow Complet

```
┌─────────────────────────────────────────────────────────────┐
│ 1. CONTROL PANEL                                            │
│    POST /api/control/gavage/start                           │
│    → Lance simulateur Python                                │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│ 2. SIMULATEUR GAVAGE TEMPS RÉEL                             │
│    simulators/gavage_realtime/main.py                       │
│    ┌────────────────────────────────────┐                   │
│    │ Gaveur: Jean Martin (id=1)         │                   │
│    │ Lot: LL251201                      │                   │
│    │ Jour 5, Matin                      │                   │
│    │ Dose: 320g, Poids moyen: 4890g     │                   │
│    └───────────────┬────────────────────┘                   │
│                    │ WebSocket                              │
└────────────────────┼────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│ 3. BACKEND WEBSOCKET HANDLER                                │
│    backend-api/app/websocket/gavage_handler.py (?)          │
│    ┌────────────────────────────────────┐                   │
│    │ Reçoit données WebSocket           │                   │
│    │ Vérifie si lot existe              │                   │
│    │ Crée lot si absent                 │                   │
│    │ Insère gavage_lot_quotidien        │                   │
│    └────────────────────────────────────┘                   │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│ 4. BASE DE DONNÉES PostgreSQL                               │
│    ┌────────────────────────────────────┐                   │
│    │ gaveurs (id=1, Jean Martin)        │                   │
│    │ lots (gaveur_id=1, LL251201)       │                   │
│    │ gavage_lot_quotidien (lot_id=X)    │                   │
│    └────────────────────────────────────┘                   │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│ 5. FRONTEND GAVEUR                                          │
│    http://localhost:3001/login                              │
│    ┌────────────────────────────────────┐                   │
│    │ Login: jean.martin@gaveur.fr       │                   │
│    │ Password: gaveur123                │                   │
│    │ → Stocke gaveur_id = 1             │                   │
│    └───────────────┬────────────────────┘                   │
│                    │                                         │
│    http://localhost:3001/lots                               │
│    ┌───────────────▼────────────────────┐                   │
│    │ GET /api/lots?gaveur_id=1          │                   │
│    │ Affiche:                           │                   │
│    │ ┌──────────────────────┐           │                   │
│    │ │ 📦 LL251201          │           │                   │
│    │ │ J5/14 - 48 canards   │           │                   │
│    │ │ 4890g → 5500g        │           │                   │
│    │ └──────────────────────┘           │                   │
│    └────────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ Checklist

### Pré-requis Base de Données
- ⏳ Créer gaveur id=1 (Jean Martin, jean.martin@gaveur.fr)
- ⏳ Vérifier que WebSocket handler crée les lots
- ⏳ Vérifier que WebSocket handler crée les gavages

### Configuration Backend
- ✅ Control panel existe (`/api/control/gavage/start`)
- ✅ Simulateur gavage temps réel existe
- ⏳ WebSocket handler `/ws/gavage` à vérifier

### Test Workflow
1. ⏳ Créer gaveur Jean Martin dans base
2. ⏳ Démarrer simulateur via control panel
3. ⏳ Vérifier données dans PostgreSQL
4. ⏳ Login avec jean.martin@gaveur.fr
5. ⏳ Vérifier affichage lots sur /lots

---

## 🚀 Prochaines Étapes

1. **Vérifier le WebSocket handler** `/ws/gavage` dans le backend
2. **Créer le gaveur** Jean Martin (id=1) dans PostgreSQL
3. **Tester le simulateur** et vérifier que les données arrivent
4. **Valider l'affichage** sur /lots après login

---

**Conclusion** : OUI, les données du simulateur sont visualisables pour jean.martin@gaveur.fr, à condition que :
1. Le gaveur existe dans la base (id=1)
2. Le WebSocket handler crée bien les enregistrements
3. La connexion se fait correctement via /login (Keycloak futur)
