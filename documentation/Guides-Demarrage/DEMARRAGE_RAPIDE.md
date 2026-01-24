# 🚀 Démarrage Rapide - Euralis Multi-Sites

Guide ultra-rapide pour démarrer l'application Euralis en 5 minutes.

---

## ⚡ Installation Express (5 minutes)

### 1️⃣ Base de Données (2 min)

```bash
# Connexion PostgreSQL
psql -U postgres

# Créer DB + utilisateur
CREATE DATABASE gaveurs_db;
CREATE USER gaveurs_user WITH PASSWORD 'gaveurs_pass';
GRANT ALL PRIVILEGES ON DATABASE gaveurs_db TO gaveurs_user;

# Activer TimescaleDB
\c gaveurs_db
CREATE EXTENSION IF NOT EXISTS timescaledb;

# Créer toutes les tables (900 lignes SQL)
\i gaveurs-v3/gaveurs-ai-blockchain/backend/scripts/complete_timescaledb_schema.sql

# Quitter
\q
```

**✅ Résultat attendu** : "✅ SCHÉMA TIMESCALEDB EURALIS - INSTALLATION TERMINÉE" avec 12 tables créées.

---

### 2️⃣ Générer Données de Test (1 min)

```bash
# Aller dans Simulator
cd Simulator

# Générer 100 lots avec 65 gaveurs
python gavage_data_simulator.py --nb-lots 100

# Vous devriez voir :
# ✅ 100 lots créés
# ✅ 174 colonnes
# 📊 Statistiques : ITM moyen, Sigma, etc.
```

**✅ Fichier créé** : `simulated_gavage_data.csv` (174 colonnes)

---

### 3️⃣ Importer Données dans DB (30 sec)

```bash
# Retour à backend
cd ../gaveurs-v3/gaveurs-ai-blockchain/backend

# Importer CSV
python scripts/import_euralis_data.py ../../Simulator/simulated_gavage_data.csv

# Rafraîchir vue matérialisée
psql -U postgres -d gaveurs_db -c "SELECT refresh_performances_sites();"
```

**✅ Résultat attendu** : 100 lots importés + 2700 doses journalières insérées.

---

### 4️⃣ Démarrer Backend (30 sec)

```bash
# Toujours dans backend/
export DATABASE_URL="postgresql://gaveurs_user:gaveurs_pass@localhost:5432/gaveurs_db"

# Installer dépendances (première fois)
pip install -r requirements.txt

# Démarrer FastAPI
uvicorn app.main:app --reload --port 8000
```

**✅ Backend accessible** : http://localhost:8000
**✅ Documentation** : http://localhost:8000/docs

---

### 5️⃣ Démarrer Frontend (1 min)

**Nouveau terminal** :

```bash
cd euralis-frontend

# Installer dépendances (première fois)
npm install

# Créer .env.local
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local

# Démarrer Next.js
npm run dev
```

**✅ Frontend accessible** : http://localhost:3000/euralis/dashboard

---

## 🎉 C'est Prêt !

Ouvrez votre navigateur :

### 7 Pages Fonctionnelles

1. **Dashboard** : http://localhost:3000/euralis/dashboard
   - KPIs globaux
   - Graphique production
   - Tableau 3 sites

2. **Sites** : http://localhost:3000/euralis/sites
   - Vue détaillée par site
   - Performance, Production, Canards, Lots

3. **Gaveurs** : http://localhost:3000/euralis/gaveurs
   - Analytics 65 gaveurs
   - Clustering K-Means (5 groupes)

4. **Prévisions** : http://localhost:3000/euralis/previsions
   - Prophet 7/30/90 jours
   - Production + ITM prévus

5. **Qualité** : http://localhost:3000/euralis/qualite
   - ITM vs Sigma
   - Anomalies Isolation Forest

6. **Abattages** : http://localhost:3000/euralis/abattages
   - Planning optimisé
   - Coûts transport

7. **Finance** : http://localhost:3000/euralis/finance
   - Revenus, Coûts, Marge
   - Rentabilité par site

---

## ✅ Vérifications Rapides

### Backend fonctionne ?

```bash
# Test santé
curl http://localhost:8000/api/euralis/health

# Devrait retourner :
# {"status":"healthy","service":"Euralis API","sites":3,...}
```

### Frontend fonctionne ?

1. Ouvrir : http://localhost:3000/euralis/dashboard
2. Vérifier : 4 KPIs affichés
3. Console (F12) : Aucune erreur rouge

### Données importées ?

```bash
# Compter lots
psql -U postgres -d gaveurs_db -c "SELECT COUNT(*) FROM lots_gavage;"
# Devrait afficher : 100

# Vérifier performances
psql -U postgres -d gaveurs_db -c "SELECT * FROM performances_sites;"
# Devrait afficher : 3 sites avec statistiques
```

---

## 🔧 Dépannage Express

### Problème : Backend ne démarre pas

```bash
# Vérifier DATABASE_URL
echo $DATABASE_URL
# Doit afficher : postgresql://gaveurs_user:gaveurs_pass@localhost:5432/gaveurs_db

# Réinstaller dépendances
cd gaveurs-v3/gaveurs-ai-blockchain/backend
pip install --upgrade -r requirements.txt
```

### Problème : Frontend erreur 404 API

```bash
# Vérifier .env.local
cat euralis-frontend/.env.local
# Doit contenir : NEXT_PUBLIC_API_URL=http://localhost:8000

# Vérifier backend tourne
curl http://localhost:8000/health
```

### Problème : Pas de données dans dashboard

```bash
# Réimporter données
cd gaveurs-v3/gaveurs-ai-blockchain/backend
python scripts/import_euralis_data.py ../../Simulator/simulated_gavage_data.csv

# Rafraîchir vue
psql -U postgres -d gaveurs_db -c "SELECT refresh_performances_sites();"

# Redémarrer backend (Ctrl+C puis relancer)
uvicorn app.main:app --reload --port 8000
```

### Problème : Erreur TimescaleDB

```bash
# Vérifier extension installée
psql -U postgres -d gaveurs_db -c "\dx"
# Devrait afficher : timescaledb

# Si absent, installer :
psql -U postgres -d gaveurs_db -c "CREATE EXTENSION IF NOT EXISTS timescaledb;"
```

---

## 📊 Générer Plus de Données

### 500 lots pour tests de charge

```bash
cd Simulator
python gavage_data_simulator.py --nb-lots 500 --nb-gaveurs 80 --output test_500lots.csv

cd ../gaveurs-v3/gaveurs-ai-blockchain/backend
python scripts/import_euralis_data.py ../../Simulator/test_500lots.csv
psql -U postgres -d gaveurs_db -c "SELECT refresh_performances_sites();"
```

### Calibrer sur vos données réelles

```bash
cd Simulator
python gavage_data_simulator.py \
    --reference ../Pretraite_End_2024_claude.csv \
    --nb-lots 200 \
    --output calibrated_data.csv
```

---

## 🎯 Commandes Essentielles

```bash
# Démarrer backend (terminal 1)
cd gaveurs-v3/gaveurs-ai-blockchain/backend
export DATABASE_URL="postgresql://gaveurs_user:gaveurs_pass@localhost:5432/gaveurs_db"
uvicorn app.main:app --reload --port 8000

# Démarrer frontend (terminal 2)
cd euralis-frontend
npm run dev

# Rafraîchir stats (terminal 3)
psql -U postgres -d gaveurs_db -c "SELECT refresh_performances_sites();"

# Générer données (terminal 3)
cd Simulator
python gavage_data_simulator.py --nb-lots 100
```

---

## 📚 Documentation Complète

Pour plus de détails, consultez :

1. **QUICKSTART_VERIFICATION.md** - Guide vérification étape par étape
2. **DEVELOPMENT_COMPLETE_REPORT.md** - Rapport complet développement
3. **README.md** - Architecture générale
4. **Simulator/README.md** - Guide simulateur détaillé

---

## 🆘 Support Rapide

### API ne répond pas

```bash
# Vérifier processus
ps aux | grep uvicorn

# Tuer et relancer
pkill -f uvicorn
cd gaveurs-v3/gaveurs-ai-blockchain/backend
uvicorn app.main:app --reload --port 8000
```

### Frontend page blanche

```bash
# Vérifier logs terminal npm
# Généralement problème de dépendances

cd euralis-frontend
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### DB erreur connexion

```bash
# Vérifier PostgreSQL démarre
sudo systemctl status postgresql  # Linux
brew services list  # macOS
# Windows : Services → PostgreSQL

# Tester connexion
psql -U postgres -d gaveurs_db
# Si ça marche, le problème est ailleurs
```

---

## ✅ Checklist Démarrage

Avant de tester :

- [ ] PostgreSQL + TimescaleDB installés
- [ ] Python 3.9+ installé
- [ ] Node.js 18+ installé
- [ ] Tables créées (12 tables)
- [ ] Données importées (100+ lots)
- [ ] Backend démarré (port 8000)
- [ ] Frontend démarré (port 3000)
- [ ] Tests API réussis (curl)
- [ ] Dashboard affiche KPIs

---

## 🎊 Succès !

Si vous voyez les 4 KPIs sur le dashboard avec des valeurs, **c'est gagné** ! 🎉

Vous pouvez maintenant :
- Explorer les 7 pages
- Tester les filtres
- Générer plus de données
- Connecter vos données réelles

---

**Temps total estimé : 5-10 minutes**
**Difficulté : Facile**
**Statut : Production Ready**

🦆 **Bon gavage intelligent !** 🦆
