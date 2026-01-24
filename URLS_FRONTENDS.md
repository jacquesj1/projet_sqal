# 🌐 URLs des Frontends - Guide Rapide

## ✅ URLs Correctes à Utiliser

| Frontend | Port | URL Correcte | ❌ URL Incorrecte |
|----------|------|--------------|-------------------|
| **SQAL** | 5173 | `http://localhost:5173` | - |
| **Euralis** | 3000 | `http://localhost:3000/euralis/dashboard` | `http://localhost:3000` (redirige) |
| **Gaveurs** | 3001 | `http://localhost:3001` | `http://localhost:3001/euralis` ❌ |
| **Control Panel** | - | `file:///...control-panel/index.html` | - |
| **Backend API** | 8000 | `http://localhost:8000/health` | - |
| **Swagger** | 8000 | `http://localhost:8000/docs` | - |

---

## 🔍 Erreur Commune

### Erreur : `GET http://localhost:3001/euralis 404 (Not Found)`

**Cause** : Vous avez essayé d'accéder à `http://localhost:3001/euralis`

**Solution** : Utilisez `http://localhost:3001` (sans `/euralis`)

Le frontend **Gaveurs** (port 3001) n'a **pas** de route `/euralis`. Cette route existe uniquement dans le frontend **Euralis** (port 3000).

---

## 📋 Checklist Démarrage

### 1. Démarrer les Services Docker
```bash
docker-compose up -d timescaledb redis backend
```

**Vérification** :
```bash
curl http://localhost:8000/health
# Devrait retourner: {"status":"healthy"...}
```

---

### 2. Démarrer les 3 Frontends

#### Terminal 1 : SQAL
```bash
cd sqal
npm run dev
```
**Ouvrir** : http://localhost:5173

---

#### Terminal 2 : Euralis
```bash
cd euralis-frontend
npm run dev
```
**Ouvrir** : http://localhost:3000/euralis/dashboard

⚠️ **Important** : Utilisez `/euralis/dashboard`, pas juste `/euralis`

---

#### Terminal 3 : Gaveurs
```bash
cd gaveurs-v3/gaveurs-ai-blockchain/frontend
npm run dev
```
**Ouvrir** : http://localhost:3001

⚠️ **Important** : Juste la racine `/`, ne PAS ajouter `/euralis`

---

### 3. Ouvrir Control Panel

**Double-clic** sur : `control-panel/index.html`

**OU navigateur** : `file:///d:/GavAI/projet-euralis-gaveurs/control-panel/index.html`

---

## 🎯 Onglets Recommandés pour la Démo

Ouvrir **5 onglets** dans votre navigateur :

1. **Control Panel** : `file:///.../control-panel/index.html`
2. **SQAL** : `http://localhost:5173`
3. **Euralis** : `http://localhost:3000/euralis/dashboard`
4. **Gaveurs** : `http://localhost:3001`
5. **Swagger** : `http://localhost:8000/docs`

---

## 🔧 Troubleshooting

### Problème : 404 Not Found

**Symptômes** :
```
GET http://localhost:3001/euralis 404 (Not Found)
```

**Solutions** :

1. **Vérifier l'URL dans la barre d'adresse**
   - ✅ Correct : `http://localhost:3001`
   - ❌ Incorrect : `http://localhost:3001/euralis`

2. **Vider le cache du navigateur**
   ```
   Ctrl+Shift+Delete → Cocher "Cached images and files" → Clear data
   ```

3. **Vérifier que le bon terminal tourne**
   ```bash
   # Terminal doit afficher :
   ✓ Ready in X ms
   ○ Local:   http://localhost:3001
   ```

---

### Problème : WebSocket Non Connecté

**Symptômes** : Indicateur rouge "Déconnecté" dans le frontend

**Solutions** :

1. **Vérifier que le backend est actif**
   ```bash
   curl http://localhost:8000/health
   ```

2. **Vérifier la configuration .env.local**
   - SQAL : `VITE_API_URL=http://localhost:8000`
   - Euralis : `NEXT_PUBLIC_WS_URL=ws://localhost:8000`
   - Gaveurs : `NEXT_PUBLIC_WS_URL=ws://localhost:8000`

3. **Redémarrer le frontend**
   ```bash
   # Ctrl+C dans le terminal, puis
   npm run dev
   ```

---

### Problème : Redirection vers /login

**Symptômes** : Le frontend redirige automatiquement vers la page de login

**Cause** : Middleware d'authentification actif

**Solution** : Vérifiez que l'authentification a été désactivée

**Frontends Euralis et Gaveurs** : Voir [DESACTIVER_AUTH_EURALIS.md](DESACTIVER_AUTH_EURALIS.md)

Le middleware doit contenir :
```typescript
export function middleware(request: NextRequest) {
  // DÉMO MODE: Désactiver l'authentification
  return NextResponse.next();
  /* ... code commenté ... */
}
```

**Action** : Si le middleware n'est pas modifié, suivez le guide et **redémarrez le frontend**.

---

## 📊 Ports Récapitulatifs

| Service | Port | Protocol | URL |
|---------|------|----------|-----|
| TimescaleDB | 5432 | PostgreSQL | `postgresql://localhost:5432` |
| Redis | 6379 | Redis | `redis://localhost:6379` |
| Backend API | 8000 | HTTP | `http://localhost:8000` |
| SQAL Frontend | 5173 | HTTP | `http://localhost:5173` |
| Euralis Frontend | 3000 | HTTP | `http://localhost:3000` |
| Gaveurs Frontend | 3001 | HTTP | `http://localhost:3001` |

---

## ✅ Test Rapide

**Commandes pour vérifier que tout fonctionne** :

```bash
# 1. Backend
curl http://localhost:8000/health

# 2. SQAL (doit retourner du HTML)
curl http://localhost:5173

# 3. Euralis (doit retourner du HTML)
curl http://localhost:3000/euralis/dashboard

# 4. Gaveurs (doit retourner du HTML)
curl http://localhost:3001

# 5. Docker
docker ps --filter "name=gaveurs"
# Doit afficher: timescaledb, redis, backend
```

---

**Date** : 27 décembre 2025
**Version** : 3.0.0 Final
**Type** : Guide de référence rapide
