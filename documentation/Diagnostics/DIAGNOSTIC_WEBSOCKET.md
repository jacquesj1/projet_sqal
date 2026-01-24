# 🔍 Diagnostic WebSocket - Guide Utilisateur

## 🚨 Situation Actuelle

Vous avez des erreurs WebSocket parce que **plusieurs frontends essaient de se connecter simultanément** et il y a confusion sur quelle page utilise quel endpoint.

---

## 📍 Identification du Problème

### Symptômes dans vos logs :
```
✅ WebSocket Gavage connecté          ← Connexion /ws/gaveur/{id}
🔌 WebSocket fermé: 1005               ← Se ferme immédiatement
ws://localhost:8000/ws/realtime/       ← Essaie aussi de se connecter
🔌 WebSocket fermé: 1006
```

**Diagnostic** : La page que vous visualisez essaie de se connecter à **DEUX endpoints différents**, ce qui n'est pas normal.

---

## ✅ Solution Rapide

### Étape 1 : Fermez TOUS les onglets du navigateur
```
1. Fermez tous les onglets localhost:3000 et localhost:3001
2. Fermez complètement le navigateur (pas juste la fenêtre)
3. Attendez 5 secondes
```

### Étape 2 : Ouvrez UNIQUEMENT le frontend Gaveurs
```
1. Ouvrez votre navigateur
2. Allez sur : http://localhost:3000
3. Ouvrez la console (F12)
4. Faites un hard refresh : Ctrl+Shift+R (ou Ctrl+F5)
```

### Étape 3 : Vérifiez les logs console
Vous devriez voir **UN SEUL** des messages suivants :
- `WebSocket connecté` (bon signe ✅)
- `WebSocket déjà connecté, réutilisation` (bon signe ✅)
- `WebSocketProvider cleanup - connexion maintenue` (normal)

Vous **NE DEVEZ PAS** voir :
- `✅ WebSocket Euralis connecté` (mauvais endpoint)
- Tentatives de connexion à `/ws/realtime/`
- Erreurs 1005/1006 répétées toutes les 5 secondes

---

## 🔍 Identification du Frontend Actuel

Si vous ne savez pas sur quelle page vous êtes, vérifiez :

### Dans la console du navigateur, tapez :
```javascript
console.log(window.location.href)
```

**Résultats attendus** :
- `http://localhost:3000/` → Frontend Gaveurs ✅
- `http://localhost:3001/euralis/dashboard` → Frontend Euralis (MAUVAIS pour tester le fix gaveur)

---

## 📊 Endpoints WebSocket par Frontend

| Frontend | Port | URL WebSocket | Fichier |
|----------|------|---------------|---------|
| **Gaveurs** (individuel) | 3000 | `/ws/gaveur/1` | `context/WebSocketContext.tsx` ← CORRIGÉ ✅ |
| **Euralis** (supervision) | 3001 | `/ws/realtime/` | `components/realtime/RealtimeSitesMonitor.tsx` ← CORRIGÉ ✅ |
| **SQAL** (qualité) | 5173 | `/ws/realtime/` | `src/services/websocket.ts` |

---

## 🐛 Problèmes Secondaires Détectés

### 1. Erreur 500 - `/api/alertes/gaveur/1`
```
GET http://localhost:8000/api/alertes/gaveur/1?acquittee=false
500 (Internal Server Error)
```

**Impact** : Bloque le chargement du dashboard gaveur

**Action** : Je vais corriger cet endpoint dans le backend

### 2. CORS Bloqué
```
Access to fetch at 'http://localhost:8000/api/alertes/gaveur/1'
from origin 'http://localhost:3000' has been blocked by CORS policy
```

**Cause** : L'erreur 500 provoque un rejet CORS

**Solution** : Corriger l'erreur 500 résoudra le CORS

---

## 🧪 Test Final - Checklist

Après avoir rechargé la page **http://localhost:3000** :

### Console Navigateur (F12)
- [ ] `WebSocket connecté` ou `WebSocket déjà connecté`
- [ ] Aucune erreur 1005/1006 répétée
- [ ] Aucune tentative de connexion à `/ws/realtime/`
- [ ] Indicateur "Connecté" en vert (en bas à gauche de la page)

### Logs Backend
```bash
docker-compose logs -f backend | grep "gaveur 1"
```
- [ ] `✅ WebSocket connection established for gaveur 1`
- [ ] PAS de déconnexion immédiate après
- [ ] Connexion stable pendant > 1 minute

---

## 🔧 Si les Problèmes Persistent

### Diagnostic Avancé

1. **Vérifier qu'il n'y a qu'un seul onglet ouvert** :
   ```javascript
   // Dans la console du navigateur
   console.log('Onglets:', performance.getEntriesByType('navigation').length)
   ```

2. **Vérifier le code JavaScript chargé** :
   ```javascript
   // Dans la console
   console.log('WebSocket URL:', process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000')
   ```

3. **Forcer le rechargement sans cache** :
   - Chrome : Ctrl+Shift+Del → Cocher "Images et fichiers en cache" → Effacer
   - Firefox : Ctrl+Shift+Del → Cocher "Cache" → Effacer
   - Edge : Ctrl+Shift+Del → Cocher "Images et fichiers mis en cache" → Effacer

4. **Redémarrer le frontend Docker** :
   ```bash
   docker-compose restart frontend-gaveurs
   ```

---

## 📞 État Actuel du Système

### ✅ Ce qui fonctionne
- Backend API : Tous endpoints sauf `/api/alertes/gaveur/{id}`
- Simulateur gavage_realtime : Envoie données toutes les 30s
- TimescaleDB : Données persistées
- WebSocket backend : Prêt à recevoir connexions

### ⚠️ Ce qui nécessite action
- Ouvrir le bon frontend (localhost:3000 SANS autres onglets)
- Corriger endpoint `/api/alertes/gaveur/1` (500 error)
- Hard refresh pour charger nouveau code JavaScript

---

## 🎯 Prochaine Étape Immédiate

1. **FERMEZ tous les onglets** du navigateur
2. **Ouvrez http://localhost:3000**
3. **F12** (ouvrir console)
4. **Ctrl+F5** (hard refresh)
5. **Copiez-collez** les 10 premiers messages de la console ici

Cela nous permettra de voir si le nouveau code singleton WebSocket est chargé.

---

**Dernière mise à jour** : 27 décembre 2025, 09:30 UTC
