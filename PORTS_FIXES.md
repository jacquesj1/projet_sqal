# 🔧 Ports Fixes pour les Frontends

## ✅ Ports Assignés (Maintenant Fixes)

J'ai modifié les `package.json` pour **forcer des ports spécifiques** :

| Frontend | Port | URL | Commande |
|----------|------|-----|----------|
| **Euralis** | **3000** | `http://localhost:3000/euralis/dashboard` | `npm run dev` (forcé `-p 3000`) |
| **Gaveurs** | **3001** | `http://localhost:3001` | `npm run dev` (forcé `-p 3001`) |
| **SQAL** | **5173** | `http://localhost:5173` | `npm run dev` (Vite par défaut) |

---

## 📝 Modifications Appliquées

### 1. Euralis Frontend
**Fichier** : [euralis-frontend/package.json](euralis-frontend/package.json:7)

```json
"scripts": {
  "dev": "next dev -p 3000",
  "start": "next start -p 3000"
}
```

### 2. Gaveurs Frontend
**Fichier** : [gaveurs-v3/gaveurs-ai-blockchain/frontend/package.json](gaveurs-v3/gaveurs-ai-blockchain/frontend/package.json:6)

```json
"scripts": {
  "dev": "next dev -p 3001",
  "start": "next start -p 3001"
}
```

---

## 🚀 Redémarrer les Frontends

**Arrêtez et relancez** pour appliquer les nouveaux ports :

### Terminal Euralis
```bash
# Ctrl+C pour arrêter
cd euralis-frontend
npm run dev
# Devrait afficher: ○ Local: http://localhost:3000
```

### Terminal Gaveurs
```bash
# Ctrl+C pour arrêter
cd gaveurs-v3/gaveurs-ai-blockchain/frontend
npm run dev
# Devrait afficher: ○ Local: http://localhost:3001
```

---

## ✅ URLs Définitives

**Mémorisez ces URLs** :

1. **Euralis** : `http://localhost:3000/euralis/dashboard`
2. **Gaveurs** : `http://localhost:3001`
3. **SQAL** : `http://localhost:5173`
4. **Backend API** : `http://localhost:8000`
5. **Swagger** : `http://localhost:8000/docs`

---

## 🎯 Votre Cas Spécifique

Vous aviez tapé : `http://localhost:3001/euralis/dashboard`

**Avec les nouveaux ports fixes** :
- ✅ **Correct** : `http://localhost:3000/euralis/dashboard` (Euralis sur 3000)
- ✅ **Correct** : `http://localhost:3001` (Gaveurs sur 3001)

---

**Date** : 27 décembre 2025
**Fichiers modifiés** :
- `euralis-frontend/package.json`
- `gaveurs-v3/gaveurs-ai-blockchain/frontend/package.json`
**Type** : Configuration permanente
