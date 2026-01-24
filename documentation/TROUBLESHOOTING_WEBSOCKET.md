# Guide Dépannage WebSocket

## Problème: WebSocket se déconnecte continuellement

### Symptômes

Dans la console du frontend Gaveurs (http://localhost:3000):
```
✅ WebSocket Gavage connecté
🔗 Connexion établie: Connecté au flux temps réel SQAL
🔌 WebSocket fermé: 1005 / 1006
🔄 Reconnexion dans 5000ms (tentative 1/10)
❌ Erreur WebSocket: Event {type: 'error', ...}
```

### Explication

Le WebSocket se connecte avec succès mais se ferme immédiatement pour deux raisons:

1. **Code 1005** : Fermeture normale sans raison spécifique (le client ferme la connexion)
2. **Code 1006** : Fermeture anormale (perte de connexion réseau ou erreur serveur)

### Causes possibles

#### Cause 1: Pas de données à envoyer

Le backend WebSocket attend des messages du client pour maintenir la connexion active. Si aucune donnée de gavage n'est disponible, la connexion reste idle et peut timeout.

**Solution**: Insérer des données de test (déjà fait ✅)
```cmd
docker-compose exec -T timescaledb psql -U gaveurs_admin -d gaveurs_db < scripts\insert_test_data.sql
```

#### Cause 2: Pas de keep-alive (ping/pong)

Le WebSocket nécessite des messages réguliers pour rester ouvert. Sans ping/pong, la connexion timeout après quelques secondes.

**Vérification**:
```javascript
// Le frontend devrait envoyer des pings réguliers
setInterval(() => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'ping' }));
  }
}, 30000); // Toutes les 30 secondes
```

#### Cause 3: Le backend n'envoie pas de données

Le WebSocket du gaveur (`/ws/gaveur/{gaveur_id}`) est un canal passif qui attend que le backend broadcast des données de gavage. Si aucun nouveau gavage n'est enregistré, rien n'est envoyé.

**Vérification**: Le backend doit envoyer des données périodiquement.

### Solutions

#### Solution 1: Vérifier que les données existent

```cmd
docker-compose exec -T timescaledb psql -U gaveurs_admin -d gaveurs_db -c "SELECT COUNT(*) FROM gavage_data;"
```

Devrait retourner > 0 (actuellement: 175 ✅)

#### Solution 2: Tester le WebSocket manuellement

**Avec wscat** (Node.js):
```bash
npm install -g wscat
wscat -c "ws://localhost:8000/ws/gaveur/1"
```

**Avec curl** (simple check):
```bash
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: test123==" http://localhost:8000/ws/gaveur/1
```

Devrait retourner: `HTTP/1.1 101 Switching Protocols`

#### Solution 3: Accepter les reconnexions automatiques

Le frontend a déjà un mécanisme de reconnexion automatique (toutes les 5s). **C'est normal** si :
- La connexion se rétablit rapidement
- Les données s'affichent quand même dans le dashboard

**Vérifier**: Rafraîchir http://localhost:3000 et observer si les données de gavage s'affichent malgré les reconnexions.

#### Solution 4: Modifier le timeout WebSocket

Dans le backend, augmenter le timeout:

```python
# backend-api/app/main.py, ligne 952
while True:
    try:
        # Augmenter le timeout
        data = await asyncio.wait_for(
            websocket.receive_text(),
            timeout=60.0  # 60 secondes au lieu de défaut
        )
    except asyncio.TimeoutError:
        # Envoyer un ping pour maintenir la connexion
        await websocket.send_json({"type": "ping", "timestamp": datetime.utcnow().isoformat()})
    except Exception as e:
        logger.info(f"WebSocket closed for gaveur {gaveur_id}: {e}")
        break
```

### État actuel du système

✅ **Backend**: Healthy et connecté à la DB
✅ **Données**: 50 canards, 175 gavages, 10 alertes
✅ **WebSocket endpoint**: `/ws/gaveur/1` accessible
⚠️ **Reconnexions**: Normales si aucune donnée temps réel

### Comportement attendu

Le WebSocket est conçu pour transmettre des **nouveaux gavages en temps réel**. Si vous ne créez pas de nouveaux gavages via l'interface, il n'y a rien à transmettre, donc la connexion peut sembler inactive.

**Pour tester le WebSocket en action**:
1. Ouvrir http://localhost:3000
2. Aller sur "Saisie Rapide" ou "Gavage"
3. Créer un nouveau gavage
4. Observer le WebSocket recevoir les données instantanément

### Logs Backend

Pour voir ce qui se passe côté serveur:

```cmd
docker-compose logs backend --tail 50 -f
```

Rechercher:
- `✅ WebSocket connection established for gaveur X`
- `🔴 WebSocket disconnected for gaveur X`
- Erreurs Python

### WebSocket vs HTTP Polling

Si le WebSocket est trop instable, le frontend peut utiliser le **polling HTTP** en fallback:

```javascript
// Toutes les 5 secondes, récupérer les nouvelles données
setInterval(async () => {
  const response = await fetch('http://localhost:8000/api/canards/gaveur/1');
  const canards = await response.json();
  // Mettre à jour l'UI
}, 5000);
```

Cela fonctionne très bien pour un petit nombre d'utilisateurs (<100).

---

## Problème: Control Panel ne démarre pas

### Symptômes

Double-clic sur `control-panel/index.html` ne démarre pas les simulateurs.

### Solution

Le control-panel nécessite:

1. **Backend en cours d'exécution**:
   ```cmd
   docker-compose ps backend
   ```
   Devrait montrer `Up` et `healthy`.

2. **Servir index.html via HTTP** (pas file://)

   **Option A - Python**:
   ```cmd
   cd control-panel
   python -m http.server 8888
   ```
   Ouvrir: http://localhost:8888

   **Option B - Node.js**:
   ```cmd
   cd control-panel
   npx http-server -p 8888
   ```
   Ouvrir: http://localhost:8888

3. **Vérifier l'endpoint de contrôle**:
   ```cmd
   curl http://localhost:8000/api/control/status
   ```

   Devrait retourner:
   ```json
   {
     "timestamp": "...",
     "simulators": {
       "gavage": {"status": "stopped", ...},
       "monitor": {"status": "stopped", ...},
       "sqal": {"status": "stopped", ...}
     }
   }
   ```

### Démarrage des simulateurs

**Depuis le control-panel**:
1. Ouvrir http://localhost:8888
2. Cliquer sur "🚀 Démo Rapide (2 min)"
3. Observer les logs en temps réel

**Manuellement** (pour debug):
```cmd
# Simulateur SQAL
docker-compose up -d simulator-sqal

# Vérifier les logs
docker-compose logs simulator-sqal --tail 20
```

---

## Résumé - Que faire maintenant ?

### WebSocket Frontend Gaveurs

**Comportement actuel**: Normal ✅
- Le WebSocket se reconnecte automatiquement
- Les données s'affichent dans le dashboard
- Les reconnexions sont attendues si aucun nouveau gavage n'est créé en temps réel

**Action**: Aucune si le dashboard affiche les données correctement.

**Si problème persiste**:
1. Vérifier les logs backend: `docker-compose logs backend -f`
2. Tester création d'un gavage via l'UI pour voir le WebSocket en action
3. Accepter que le polling HTTP est un fallback valide

### Control Panel

**Action**: Servir via HTTP
```cmd
cd control-panel
python -m http.server 8888
```

Puis ouvrir http://localhost:8888 et tester la démo.

---

**Dernière mise à jour**: 2025-12-26
**Version**: 3.0.0
