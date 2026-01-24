# Control Panel V2 - Gaveurs System

Interface web unifiée pour gérer tous les simulateurs du système Gaveurs (SQAL, Gavage, Consumer Feedback).

## 🚀 Démarrage rapide

### Prérequis
- Node.js 18+
- Backend API en cours d'exécution sur `http://localhost:8000`

### Installation

```bash
npm install
```

### Développement

```bash
npm run dev
```

L'application sera disponible sur **http://localhost:3002**

### Production

```bash
npm run build
npm start
```

## 📋 Fonctionnalités

### ✅ Implémenté

- **Dashboard global** avec statistiques temps réel
- **Status orchestration** : Vue d'ensemble de tous les simulateurs
- **Actions rapides** :
  - Démarrer scénario complet (Gavage + SQAL + Consumer)
  - Arrêter tous les simulateurs
- **Auto-refresh** : Mise à jour automatique toutes les 5 secondes
- **Statistiques lots** : Total, actifs, complétés, ITM moyen
- **Status Docker** : Vérification disponibilité Docker

### 🚧 À développer

- **Onglet SQAL** : Gestion détaillée devices SQAL individuels
- **Onglet Gavage** : Configuration paramètres gavage (lots, accélération)
- **Onglet Consumer** : Configuration feedbacks (ratings, fréquence)
- **Logs en temps réel** : Stream WebSocket des logs simulateurs
- **Graphiques** : Visualisation métriques (doses, poids, feedbacks)
- **Timeline lots** : Traçabilité Gavage → SQAL → Consumer

## 🎨 Stack technique

- **Framework** : Next.js 14 (App Router)
- **Language** : TypeScript
- **Styling** : Tailwind CSS
- **Icons** : Lucide React
- **HTTP Client** : Axios
- **Refresh** : Auto-refresh 5s (pas de WebSocket encore)

## 📡 API Endpoints utilisés

### Orchestration
- `GET /api/control-panel/orchestrate/status` - Status global
- `POST /api/control-panel/orchestrate/start` - Démarrer scénario
- `POST /api/control-panel/orchestrate/stop-all` - Arrêter tout

### Stats
- `GET /api/control-panel/stats` - Statistiques panel
- `GET /api/control-panel/health` - Santé système

### SQAL
- `GET /api/control-panel/simulators/list` - Liste simulateurs SQAL
- `POST /api/control-panel/simulators/start` - Démarrer SQAL
- `POST /api/control-panel/simulators/stop` - Arrêter SQAL

### Gavage
- `GET /api/control-panel/gavage/status` - Status gavage
- `POST /api/control-panel/gavage/start` - Démarrer gavage
- `POST /api/control-panel/gavage/stop` - Arrêter gavage

### Consumer
- `GET /api/control-panel/consumer/status` - Status consumer
- `POST /api/control-panel/consumer/start` - Démarrer consumer
- `POST /api/control-panel/consumer/stop` - Arrêter consumer

## 🔧 Configuration

### Variables d'environnement

Créer `.env.local` :

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Ports

- **Frontend** : 3002 (configuré pour éviter conflits avec Euralis:3000 et Gaveurs:3001)
- **Backend** : 8000

## 📦 Structure du projet

```
control-panel-v2/
├── app/
│   ├── layout.tsx          # Layout principal
│   ├── page.tsx            # Dashboard principal
│   └── globals.css         # Styles globaux
├── components/             # Composants réutilisables (à venir)
├── lib/
│   └── api.ts             # Service API
├── types/
│   └── api.ts             # Types TypeScript
├── public/                # Assets statiques
└── README.md              # Ce fichier
```

## 🎯 Scénarios disponibles

### Complete Demo
Chaîne complète : Gavage → SQAL → Consumer
- 3 lots gavage
- 2 devices SQAL
- 10 feedbacks/heure
- Accélération 1440x (1 jour en 60s)

### Quality Focus (à venir)
Focus qualité : SQAL multi-sites + Consumer feedback intensif

### Gavage Realtime (à venir)
Simulation gavage uniquement

### Consumer Analysis (à venir)
Analyse satisfaction sur lots existants

## 🐛 Debugging

### Le frontend ne se connecte pas au backend

1. Vérifier que le backend est en cours d'exécution :
   ```bash
   curl http://localhost:8000/api/control-panel/health
   ```

2. Vérifier la variable d'environnement :
   ```bash
   cat .env.local
   ```

3. Vérifier les logs console du navigateur (F12)

### Docker non disponible

Le Control Panel nécessite Docker pour gérer les simulateurs. Vérifier :
```bash
docker ps
```

## 📝 Notes

- **Port 3002** : Choisi pour éviter conflits avec autres frontends
- **Auto-refresh 5s** : Pour status temps réel sans WebSocket
- **TypeScript strict** : Typage complet pour éviter erreurs
- **Tailwind CSS** : Cohérence avec autres frontends du projet

## 🔗 Documentation associée

- [CONTROL_PANEL_V2_BACKEND_COMPLETE.md](../documentation/CONTROL_PANEL_V2_BACKEND_COMPLETE.md)
- [CONTROL_PANEL_V2_SPEC.md](../documentation/CONTROL_PANEL_V2_SPEC.md)
- [DB_FIXES_GAVAGE_LOTS.md](../documentation/DB_FIXES_GAVAGE_LOTS.md)

## 👥 Développement

Pour ajouter de nouvelles fonctionnalités :

1. Ajouter types dans `types/api.ts`
2. Ajouter fonctions API dans `lib/api.ts`
3. Créer composants dans `components/`
4. Intégrer dans `app/page.tsx`

---

**Version** : 1.0.0
**Date** : 2026-01-07
**Auteur** : Claude Code
