# ✅ Corrections WebSocket et API - 27 décembre 2025

## 📋 Résumé des Corrections

### 1. ✅ Endpoint `/api/alertes/gaveur/1` - CORRIGÉ
**Problème**: Erreur 500 Internal Server Error
**Cause**: La table `alertes` n'a pas de colonne `id` (clé primaire composite `time+canard_id`), mais le code essayait de créer des objets Pydantic `Alerte` qui attendaient un champ `id`.

**Solution**:
- Fichier: [backend-api/app/main.py:832](backend-api/app/main.py#L832)
- Changement: Retour de dictionnaires Python au lieu d'objets Pydantic
- Statut: **200 OK** ✅

**Test**:
```bash
curl http://localhost:8000/api/alertes/gaveur/1?acquittee=false
# Retourne maintenant 10 alertes en JSON (200 OK)
```

---

### 2. ✅ WebSocket Singleton Pattern - Frontend Gaveurs
**Problème**: Connexions WebSocket fermées immédiatement (erreurs 1005/1006)
**Cause**: React Strict Mode en dev monte/démonte les composants 2 fois, provoquant la fermeture des WebSocket

**Solution**: Pattern singleton avec variables globales
- Fichier: [gaveurs-v3/gaveurs-ai-blockchain/frontend/context/WebSocketContext.tsx](gaveurs-v3/gaveurs-ai-blockchain/frontend/context/WebSocketContext.tsx)
- Changements:
  - Variables globales `globalWS` et `globalReconnectTimeout` (lignes 17-19)
  - Réutilisation de connexion existante si `readyState === OPEN` (lignes 34-39)
  - Cleanup ne ferme plus la connexion (ligne 117)

**Comportement attendu**:
```javascript
// Premier montage du composant
WebSocket connecté

// Démontage (React Strict Mode)
WebSocketProvider cleanup - connexion maintenue

// Remontage
WebSocket déjà connecté, réutilisation
```

---

### 3. ✅ WebSocket Euralis - useEffect Dependencies
**Problème**: Même erreurs 1005/1006 sur frontend Euralis
**Cause**: `useEffect` avec `[reconnectAttempts]` comme dépendance provoquait des remontages

**Solution**:
- Fichier: [euralis-frontend/components/realtime/RealtimeSitesMonitor.tsx:179](euralis-frontend/components/realtime/RealtimeSitesMonitor.tsx#L179)
- Changement: Variable locale `currentReconnectAttempts` au lieu de state
- useEffect dependencies: `[]` au lieu de `[reconnectAttempts]`

---

## 🎯 Actions Requises - IMPORTANT

### Étape 1: Fermer TOUS les onglets du navigateur
Le problème actuel montre que **deux endpoints WebSocket différents** tentent de se connecter depuis le même port (3000):
- `/ws/gaveur/1` (correct pour ce frontend)
- `/ws/realtime/` (incorrect - devrait être sur port 3001)

**Cela indique**:
- Plusieurs onglets ouverts OU
- Cache navigateur avec ancien code JavaScript

**Action**:
1. Fermez **TOUS** les onglets localhost:3000 et localhost:3001
2. Fermez complètement le navigateur (pas juste la fenêtre)
3. Attendez 5 secondes

---

### Étape 2: Ouvrir UNIQUEMENT Frontend Gaveurs
```
1. Ouvrir navigateur
2. Aller sur: http://localhost:3000
3. F12 (console)
4. Ctrl+F5 (hard refresh - force rechargement sans cache)
```

---

### Étape 3: Vérifier Console
Vous devriez voir **UN SEUL** des messages suivants:

✅ **Messages attendus (BON SIGNE)**:
```
WebSocket connecté
```
ou
```
WebSocket déjà connecté, réutilisation
WebSocketProvider cleanup - connexion maintenue
```

❌ **Messages à NE PAS voir (MAUVAIS SIGNE)**:
```
✅ WebSocket Euralis connecté    ← Mauvais endpoint
WebSocket fermé: 1005             ← Connexion fermée
WebSocket fermé: 1006             ← Connexion fermée
🔄 Reconnexion dans 5s            ← Reconnexion en boucle
```

Si vous voyez `/ws/realtime/` dans la console, c'est que vous êtes sur le **mauvais frontend** ou que le **cache** n'est pas vidé.

---

### Étape 4: Vérifier URL et Indicateur
**Dans la console du navigateur, tapez**:
```javascript
console.log(window.location.href)
```

**Résultat attendu**:
```
http://localhost:3000/
```

**Vérifier l'indicateur visuel**:
- En bas à gauche de la page, vous devriez voir: **🟢 Connecté**
- Si vous voyez **🔴 Déconnecté**, la connexion n'est pas stable

---

## 🔍 Diagnostic Avancé (si problèmes persistent)

### Vider Cache Navigateur Complet
**Chrome**:
```
Ctrl+Shift+Del
→ Cocher "Images et fichiers en cache"
→ Plage de temps: "Toutes les périodes"
→ Effacer les données
```

**Firefox**:
```
Ctrl+Shift+Del
→ Cocher "Cache"
→ Plage de temps: "Tout"
→ Effacer maintenant
```

**Edge**:
```
Ctrl+Shift+Del
→ Cocher "Images et fichiers mis en cache"
→ Plage de temps: "Tout"
→ Effacer
```

---

### Redémarrer Frontend (si cache ne fonctionne pas)
```bash
# Trouver le processus Node.js
netstat -ano | findstr ":3000"
# Note le PID (ex: 7188)

# Tuer le processus
taskkill /F /PID 7188

# Redémarrer frontend
cd gaveurs-v3\gaveurs-ai-blockchain\frontend
npm run dev
```

---

## 📊 État Actuel du Système

### ✅ Fonctionnel
- Backend API: Tous endpoints (y compris `/api/alertes/gaveur/1`) ✅
- Base de données: TimescaleDB + toutes tables ✅
- Simulateur gavage: Envoie données toutes les 30s (3 lots à J11) ✅
- WebSocket backend: `/ws/gaveur/{id}` et `/ws/realtime/` prêts ✅
- Code singleton WebSocket: Implémenté dans frontend ✅

### ⚠️ Nécessite Action Utilisateur
- **Vider cache navigateur** pour charger nouveau code JavaScript
- **Fermer tous les onglets** pour éviter connexions multiples
- **Hard refresh** (Ctrl+F5) pour forcer rechargement

---

## 🧪 Checklist de Test Final

Une fois le hard refresh effectué sur http://localhost:3000:

### Console Navigateur (F12)
- [ ] Message `WebSocket connecté` OU `WebSocket déjà connecté, réutilisation`
- [ ] Indicateur visuel **🟢 Connecté** en bas à gauche
- [ ] Aucune erreur 1005/1006 répétée toutes les 5 secondes
- [ ] Aucune tentative de connexion à `/ws/realtime/`
- [ ] Aucune erreur 500 sur `/api/alertes/gaveur/1`
- [ ] Dashboard charge correctement (pas d'erreur "Failed to fetch")

### Logs Backend
```bash
docker exec gaveurs_timescaledb psql -U gaveurs_admin -d gaveurs_db \
  -c "SELECT NOW(), 'Backend healthy' as status"
# Devrait retourner timestamp actuel
```

### Stabilité WebSocket
- [ ] Connexion reste ouverte > 1 minute sans fermeture
- [ ] Aucun message de reconnexion dans la console
- [ ] Indicateur reste vert pendant toute la session

---

## 📞 Prochaines Étapes

### Étape Immédiate
**Fermez tous les onglets, puis**:
1. Ouvrez http://localhost:3000
2. F12 (console)
3. Ctrl+F5 (hard refresh)
4. Copiez-collez les **10 premiers messages de la console** dans le chat

Cela permettra de vérifier que le nouveau code singleton WebSocket est bien chargé.

---

### Si Tout Fonctionne
Une fois que vous voyez:
- ✅ `WebSocket connecté` (ou `déjà connecté, réutilisation`)
- ✅ Indicateur vert en bas à gauche
- ✅ Dashboard charge sans erreur 500

**Alors le système est opérationnel** et vous pouvez:
1. Tester navigation dans le dashboard
2. Vérifier que les données temps réel s'affichent
3. Tester les alertes
4. Tester l'historique des gavages

---

## 🔧 Fichiers Modifiés

| Fichier | Lignes | Changement |
|---------|--------|------------|
| [backend-api/app/main.py](backend-api/app/main.py#L832) | 832 | Retour dict au lieu de Pydantic Alerte |
| [gaveurs-v3/.../WebSocketContext.tsx](gaveurs-v3/gaveurs-ai-blockchain/frontend/context/WebSocketContext.tsx#L17-L19) | 17-19 | Variables globales singleton |
| [gaveurs-v3/.../WebSocketContext.tsx](gaveurs-v3/gaveurs-ai-blockchain/frontend/context/WebSocketContext.tsx#L34-L39) | 34-39 | Réutilisation connexion existante |
| [gaveurs-v3/.../WebSocketContext.tsx](gaveurs-v3/gaveurs-ai-blockchain/frontend/context/WebSocketContext.tsx#L117) | 117 | Cleanup ne ferme plus connexion |
| [euralis-frontend/.../RealtimeSitesMonitor.tsx](euralis-frontend/components/realtime/RealtimeSitesMonitor.tsx#L72) | 72 | Variable locale reconnectAttempts |
| [euralis-frontend/.../RealtimeSitesMonitor.tsx](euralis-frontend/components/realtime/RealtimeSitesMonitor.tsx#L179) | 179 | useEffect deps: [] |

---

**Dernière mise à jour**: 27 décembre 2025, 08:35 UTC
**Statut**: Corrections appliquées, test utilisateur requis
