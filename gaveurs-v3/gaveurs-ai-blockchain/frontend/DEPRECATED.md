# ⚠️ FRONTEND DEPRECATED

## Ce frontend n'est plus utilisé

**Date de dépréciation** : 28 décembre 2025

## Frontend Officiel

Utilisez désormais : **`gaveurs-frontend/`** (à la racine du projet)

## Raisons

1. ✅ **gaveurs-frontend/** a plus de pages (20 vs 16)
2. ✅ **gaveurs-frontend/** est utilisé par Docker (production)
3. ✅ **gaveurs-frontend/** a des fonctionnalités avancées :
   - `/saisie-rapide` - Saisie rapide gavage
   - `/blockchain-explorer` - Explorer blockchain
   - `/ai-training` - Entraînement IA
   - `/dashboard-analytics` - Analytics avancés

## Migration

Si vous utilisiez ce frontend, migrez vers :

```bash
cd gaveurs-frontend
npm install
npm run dev
# → http://localhost:3000
```

## WebSocket

Les deux frontends utilisent la même configuration :
- Endpoint : `ws://localhost:8000/ws/gaveur/${gaveurId}`
- Aucune migration nécessaire

## Docker

Le `docker-compose.yml` utilise déjà `gaveurs-frontend/` :

```yaml
frontend-gaveurs:
  build:
    context: ./gaveurs-frontend
    dockerfile: Dockerfile
  ports:
    - "3000:3000"
```

---

**NE PAS SUPPRIMER** ce répertoire pour l'instant (peut contenir du code de référence).

Archivage planifié : Q1 2026
