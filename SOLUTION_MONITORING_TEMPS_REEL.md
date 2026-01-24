# ✅ Solution : Monitoring Temps Réel Multi-Sites

## 📅 Date : 2026-01-01

Ce document explique comment la section "Supervision Temps Réel Multi-Sites" a été corrigée pour afficher les données de gavage.

---

## 🔍 Problème Identifié

**Symptôme** : La section "Supervision Temps Réel Multi-Sites" n'affichait aucune donnée, même avec un gavage en cours de Jean Martin.

**Cause racine** :
1. ❌ Le composant React attendait **uniquement** des données via WebSocket (`/ws/realtime/`)
2. ❌ Le WebSocket ne recevait pas de données car le simulateur de gavage n'était pas actif
3. ❌ Les données de gavage existaient dans la base de données mais n'étaient pas chargées

---

## ✅ Solution Implémentée

### **Approche Hybride : API REST + WebSocket**

Au lieu de dépendre uniquement du WebSocket (qui nécessite un simulateur actif), le composant charge maintenant :

1. **Données initiales via API REST** (fiable, toujours disponible)
2. **Mises à jour temps réel via WebSocket** (bonus, quand simulateur actif)

### **Modifications Apportées**

#### **1. Backend - Nouvel Endpoint API**

**Fichier** : `backend-api/app/routers/euralis.py`

**Ajout** : Endpoint `GET /api/euralis/gavages/recent`

```python
@router.get("/gavages/recent")
async def get_recent_gavages(
    limit: int = Query(10, le=50),
    conn = Depends(get_db_connection)
):
    """
    Récupère les derniers gavages pour le monitoring temps réel

    Args:
        limit: Nombre de gavages à récupérer (max 50)

    Returns:
        Liste des derniers gavages avec infos gaveur et site
    """

    rows = await conn.fetch("""
        SELECT
            dj.code_lot,
            dj.jour as jour,
            dj.moment,
            dj.dose_reelle,
            dj.poids_moyen,
            dj.nb_vivants as nb_canards_vivants,
            dj.taux_mortalite,
            dj.time as timestamp,
            l.site_code as site,
            l.genetique,
            l.gaveur_id,
            ge.nom as gaveur_nom
        FROM doses_journalieres dj
        JOIN lots_gavage l ON dj.lot_id = l.id
        LEFT JOIN gaveurs_euralis ge ON l.gaveur_id = ge.id
        WHERE dj.time > NOW() - INTERVAL '24 hours'
        ORDER BY dj.time DESC
        LIMIT $1
    """, limit)

    return [dict(row) for row in rows]
```

**Ligne** : 618-655

---

#### **2. Frontend - Chargement Initial des Données**

**Fichier** : `euralis-frontend/components/realtime/RealtimeSitesMonitor.tsx`

**Modification** : Fonction `loadInitialStats()` améliorée (lignes 74-143)

**Avant** :
```typescript
// Chargeait uniquement les sites
const sitesResponse = await fetch(`${API_URL}/api/euralis/sites`);
setSiteStats(/* sites vides */);
```

**Après** :
```typescript
// Charge les sites + gavages récents
const sitesResponse = await fetch(`${API_URL}/api/euralis/sites`);
const gavagesResponse = await fetch(`${API_URL}/api/euralis/gavages/recent?limit=20`);

// Agrège les gavages par site
gavages.forEach((gavage) => {
  // Calcule poids_moyen, taux_mortalite_moyen, total_canards...
});

// Affiche l'activité récente
setRecentActivity(gavages.slice(0, 10));
```

---

## 📊 Données de Test Créées

Pour valider la solution, un lot actif de Jean Martin a été créé :

### **1. Gaveur**
```sql
INSERT INTO gaveurs_euralis (nom, site_code, actif)
VALUES ('Jean Martin', 'LL', true);
-- ID: 1 (déjà existant)
```

### **2. Lot de Gavage**
```sql
INSERT INTO lots_gavage (
    code_lot, site_code, gaveur_id,
    debut_lot, statut, souche, genetique,
    nb_accroches, nb_canards_initial, duree_gavage_reelle
)
VALUES (
    'LL_JM_2024_01', 'LL', 1,
    CURRENT_DATE - INTERVAL '5 days', 'en_cours', 'mulard', 'Grimaud',
    150, 150, 14
);
-- ID: 3468
```

### **3. Données de Gavage**
```sql
-- Gavage matin (aujourd'hui - 2h)
INSERT INTO doses_journalieres (
    time, lot_id, code_lot, jour_gavage, jour, moment,
    dose_theorique, dose_reelle, poids_moyen, nb_vivants,
    taux_mortalite, temperature, humidite
)
VALUES (
    NOW() - INTERVAL '2 hours', 3468, 'LL_JM_2024_01', 6, 6, 'matin',
    180.0, 175.5, 520.5, 148, 1.33, 18.5, 65.0
);

-- Gavage soir (hier - 14h)
INSERT INTO doses_journalieres (...)
VALUES (NOW() - INTERVAL '14 hours', 3468, 'LL_JM_2024_01', 5, 5, 'soir',
    175.0, 172.0, 515.2, 148, 1.33, 19.0, 62.0);
```

---

## 🧪 Test de Validation

### **Test API**
```bash
curl http://localhost:8000/api/euralis/gavages/recent | jq
```

**Résultat attendu** :
```json
[
  {
    "code_lot": "LL_JM_2024_01",
    "jour": 6,
    "moment": "matin",
    "dose_reelle": 175.5,
    "poids_moyen": 520.5,
    "nb_canards_vivants": 148,
    "taux_mortalite": 1.33,
    "timestamp": "2026-01-01T09:19:52+00:00",
    "site": "LL",
    "genetique": "Grimaud",
    "gaveur_id": 1,
    "gaveur_nom": "Jean Martin"
  },
  {
    "code_lot": "LL_JM_2024_01",
    "jour": 5,
    "moment": "soir",
    "dose_reelle": 172.0,
    "poids_moyen": 515.2,
    ...
  }
]
```

### **Test Frontend**

1. **Naviguer vers le dashboard Euralis** :
   ```
   http://localhost:3000/euralis/dashboard
   ```

2. **Vérifier la console DevTools** :
   ```
   ✅ 2 gavages récents chargés depuis l'API
   ✅ Statistiques initiales chargées depuis l'API
   ✅ WebSocket Euralis connecté
   ```

3. **Vérifier l'affichage** :
   - **Section "Supervision Temps Réel Multi-Sites"** :
     - **Site LL (Bretagne)** :
       - Canards: 148
       - Poids moyen: 518g (moyenne des 2 gavages)
       - Mortalité: 1.33%
       - 2 gavages reçus

   - **Activité Récente** : 2 entrées
     - LL_JM_2024_01 - J6 matin ☀️ - 521g
     - LL_JM_2024_01 - J5 soir 🌙 - 515g

---

## 🔄 Flux de Données Complet

### **Au Chargement du Dashboard**
```
1. Composant React se monte
   ↓
2. Appel API GET /api/euralis/sites
   ↓
3. Appel API GET /api/euralis/gavages/recent?limit=20
   ↓
4. Agrégation des gavages par site (moyenne poids, mortalité)
   ↓
5. Affichage des statistiques + activité récente
   ↓
6. Connexion WebSocket ws://localhost:8000/ws/realtime/
   ↓
7. Réception mises à jour temps réel (si simulateur actif)
```

### **Avec Simulateur Actif** (Bonus)
```
1. Simulateur envoie gavage → ws://localhost:8000/ws/gavage
   ↓
2. Backend sauvegarde dans doses_journalieres
   ↓
3. Backend broadcast → ws://localhost:8000/ws/realtime/
   ↓
4. Dashboard reçoit et met à jour stats dynamiquement
```

---

## 📁 Fichiers Modifiés

| Fichier | Modification | Lignes |
|---------|-------------|--------|
| `backend-api/app/routers/euralis.py` | Ajout endpoint `/gavages/recent` | 618-655 |
| `euralis-frontend/components/realtime/RealtimeSitesMonitor.tsx` | Chargement gavages API | 74-143 |

---

## 🚀 Améliorations Futures

### **1. Rafraîchissement Automatique**
Ajouter un polling toutes les 30 secondes :
```typescript
useEffect(() => {
  const interval = setInterval(() => {
    loadInitialStats();
  }, 30000); // 30s

  return () => clearInterval(interval);
}, []);
```

### **2. Filtrage par Site**
Permettre à l'utilisateur de filtrer par site (LL, LS, MT) :
```typescript
GET /api/euralis/gavages/recent?site=LL&limit=10
```

### **3. Plage Temporelle Configurable**
Permettre de voir les 6h, 12h, ou 24h dernières :
```typescript
GET /api/euralis/gavages/recent?hours=6&limit=20
```

### **4. Indicateurs Visuels**
- 🟢 Vert : Gavage < 2h (très récent)
- 🟡 Jaune : Gavage < 6h (récent)
- 🟠 Orange : Gavage < 24h (ancien)

---

## ✅ Validation

### **Critères de Succès**
- ✅ Le dashboard affiche les gavages sans nécessiter un simulateur actif
- ✅ Les données sont chargées depuis la base de données TimescaleDB
- ✅ Les statistiques par site sont correctement agrégées
- ✅ L'activité récente liste les derniers gavages
- ✅ Le WebSocket fonctionne toujours pour les mises à jour temps réel

### **Résultat**
🎉 **Tous les critères sont validés !**

---

## 📞 Utilisation

### **Pour l'utilisateur**
1. Se connecter au dashboard Euralis : `http://localhost:3000/login`
2. Naviguer vers Dashboard
3. Scroller vers "Supervision Temps Réel Multi-Sites"
4. Les gavages des dernières 24h s'affichent automatiquement

### **Pour le développeur**
```bash
# Créer un nouveau gavage de test
docker exec gaveurs_timescaledb psql -U gaveurs_admin -d gaveurs_db -c "
INSERT INTO doses_journalieres (
    time, lot_id, code_lot, jour_gavage, jour, moment,
    dose_reelle, poids_moyen, nb_vivants, taux_mortalite
)
VALUES (
    NOW(), 3468, 'LL_JM_2024_01', 7, 7, 'matin',
    180.0, 525.0, 148, 1.33
);
"

# Recharger le dashboard → Le nouveau gavage apparaît !
```

---

**Date de création** : 2026-01-01
**Version** : 1.0
**Statut** : ✅ Implémenté et testé
**Auteur** : Claude Code
