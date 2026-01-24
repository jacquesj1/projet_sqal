# 💬 MESSAGE POUR CLAUDE CODE - Copier-Coller

---

## Version Recommandée (Complète mais concise)

```
Salut Claude Code ! 🦆

J'ai besoin que tu développes l'Application Euralis de Pilotage Multi-Sites pour gérer 3 sites de gavage (Bretagne LL, Pays de Loire LS, Maubourguet MT) avec 65 gaveurs.

📁 STRUCTURE DU PROJET :

projet-euralis-gaveurs/
├── gaveurs-ai-blockchain/          # Backend partagé (EXISTANT)
│   └── backend/                    # FastAPI - ajouter routes /api/euralis/*
│
├── gaveurs-frontend/               # Frontend gaveurs (EXISTANT)
│
└── euralis-frontend/               # ← À CRÉER : Frontend Euralis
    └── app/euralis/                # 6 modules à développer

📚 LIS D'ABORD CES 3 DOCUMENTS (ordre important) :

1. BRIEF_CLAUDE_CODE_STRUCTURE.md
   → Comprendre la structure des répertoires et l'architecture partagée

2. EURALIS_APPLICATION_SPECIFICATIONS.md (1910 lignes)
   → Spécifications techniques complètes avec :
      • 7 tables SQL (code fourni)
      • 35 routes API détaillées
      • 5 modules IA/ML (code Python complet fourni)
      • 6 interfaces utilisateur

3. BRIEF_POUR_CLAUDE_CODE.md
   → Instructions détaillées de développement phase par phase

📊 DONNÉES :
• CSV fourni : Pretraite_End_2024_claude.csv
• 75 lots, 174 colonnes
• Séparateur ';', encoding 'latin-1'

⚠️ POINTS CRITIQUES :

1. Backend PARTAGÉ : Réutiliser gaveurs-ai-blockchain/backend/
   - Ajouter app/routers/euralis.py (35 routes)
   - Ajouter app/ml/euralis/ (5 modules IA/ML)
   - Préfixer toutes les routes par /api/euralis/

2. Base de données PARTAGÉE : Même DB que gaveurs
   - Ajouter 7 nouvelles tables
   - Script : backend/scripts/import_euralis_data.py

3. Frontend SÉPARÉ : Nouveau projet euralis-frontend/
   - Next.js 14 au même niveau que gaveurs-frontend/
   - 6 pages : dashboard, sites, gaveurs, previsions, qualite, finance

4. Code fourni : SQL complet + Python IA/ML complet dans SPECIFICATIONS
   - PySR (régression symbolique)
   - Prophet (prévisions)
   - KMeans (clustering)
   - IsolationForest (anomalies)
   - Algorithme hongrois (optimisation abattages)

🚀 DÉMARRAGE :

Phase 1 (Semaine 1) - Infrastructure :
1. Créer tables SQL (backend/scripts/create_euralis_tables.sql)
2. Importer CSV (backend/scripts/import_euralis_data.py)
3. Créer 10 routes API de base (backend/app/routers/euralis.py)
4. Créer dashboard frontend (euralis-frontend/app/euralis/dashboard/)

Commence par lire les 3 documents, puis attaque la Phase 1 !

Des questions sur la structure ou l'architecture ?
```

---

## Version Ultra-Courte (Si Claude Code veut juste l'essentiel)

```
Développe App Euralis Multi-Sites (3 sites LL/LS/MT, 65 gaveurs).

STRUCTURE :
projet/
├── gaveurs-ai-blockchain/backend/  ← Backend partagé (ajoute routes /api/euralis/*)
├── gaveurs-frontend/               ← Frontend gaveurs existant
└── euralis-frontend/               ← NOUVEAU à créer (Next.js 14)

LIS CES 3 DOCS :
1. BRIEF_CLAUDE_CODE_STRUCTURE.md (structure répertoires)
2. EURALIS_APPLICATION_SPECIFICATIONS.md (specs complètes)
3. BRIEF_POUR_CLAUDE_CODE.md (instructions développement)

STACK :
Next.js 14 + FastAPI partagé + TimescaleDB partagée + IA (PySR, Prophet)

DONNÉES :
CSV Pretraite_End_2024_claude.csv (75 lots, sep=';', encoding='latin-1')

IMPORTANT :
- Backend/DB PARTAGÉS avec app gaveurs
- Code SQL + Python IA/ML complet fourni
- Frontend SÉPARÉ au même niveau

Phase 1 : Tables SQL + Import CSV + 10 routes API + Dashboard

Prêt ?
```

---

## Ce Que Tu Dois Donner à Claude Code

**3 choses** :

1. **Le message ci-dessus** (version recommandée ou ultra-courte)

2. **Les 3 documents** :
   - BRIEF_CLAUDE_CODE_STRUCTURE.md
   - EURALIS_APPLICATION_SPECIFICATIONS.md
   - BRIEF_POUR_CLAUDE_CODE.md

3. **Le fichier CSV** :
   - Pretraite_End_2024_claude.csv

---

## Points Clés à Retenir

✅ **Backend partagé** dans `gaveurs-ai-blockchain/backend/`  
✅ **Frontend séparé** : nouveau projet `euralis-frontend/`  
✅ **Même niveau** que `gaveurs-frontend/`  
✅ **Code fourni** : SQL complet + 5 modules Python IA/ML  
✅ **35 routes API** à créer (préfixe `/api/euralis/`)  
✅ **6 pages** frontend à développer  

---

**Copie-colle simplement le message "Version Recommandée" ci-dessus dans Claude Code ! 🚀**
