# 🏢 APPLICATION EURALIS - Pilotage Multi-Sites de Gavage

## 📊 ANALYSE DES DONNÉES FOURNIES

### Statistiques Actuelles
- **75 lots de gavage** traités
- **3 sites de production** :
  - 🌊 **Bretagne (LL)** : 11 lots (15%)
  - 🌾 **Pays de Loire (LS)** : 32 lots (43%)
  - 🏔️ **Maubourguet (MT)** : 32 lots (42%)
- **65 gaveurs** actifs
- **3 souches** : CF80* - M15 V2E SFM, MMG AS - PKL*, MMG AS - PKLC
- **Durée moyenne gavage** : 10.2 jours
- **ITM moyen** : 14.97 kg
- **Période** : Janvier 2024

### Structure des Données (174 colonnes)

**Identification Lot** :
- `CodeLot` : LL/LS/MT + numéro (ex: LL4801665)
- `Lot_GAV`, `Lot_PAG`
- `GEO`, `saison`

**Données Gavage** (27 jours possibles) :
- `feedTarget_1 à 27` : Dose théorique maïs par jour
- `feedCornReal_1 à 27` : Dose réelle maïs par jour
- `corn_variation_1 à 27` : Écart dose
- `cumulCorn_1 à 27` : Cumul maïs consommé
- `delta_feed_1 à 27` : Variation dose

**Performances** :
- `ITM` : Indice Technique Moyen (kg foie gras)
- `Sigma` : Écart type poids foie
- `dPctgPerteGav` : % mortalité gavage
- `duree_gavage` : Durée réelle (jours)
- `total_cornTarget`, `total_cornReal` : Total maïs consommé

**Traçabilité** :
- `Gaveur` : Nom gaveur
- `Eleveur` : Nom éleveur
- `Debut_du_lot` : Date début gavage
- `Nombre_enleve` : Canards enlevés
- `Quantite_accrochee` : Canards abattus
- `Age_des_animaux` : Âge à l'abattage
- `Souche` : Génétique

**Informations Gaveur** :
- `Civilite`, `RaisonSociale`, `NomUsage`
- `Adresse1`, `Adresse2`, `CodePostal`, `Commune`
- `Telephone1`, `Email`

**Plans Alimentation** :
- `Code_plan_alimentation`
- `Four_Alim_Elev`, `Four_Alim_Gav`
- `Code_plan_alimentation_compl`
- `Conso_Gav_Z1`

**Qualité** :
- `ProdIgpFR` : Production IGP France
- `Nb_MEG` : Nombre canards MEG (Mise En Gavage)

---

## 🎯 OBJECTIFS APPLICATION EURALIS

### Vision Macro
Application de **pilotage stratégique** pour la coopérative Euralis permettant :

1. **Vue Consolidée Multi-Sites** 🌍
   - Dashboard global 3 sites (LL, LS, MT)
   - Comparaisons performances inter-sites
   - Suivi temps réel production

2. **Analytics Hiérarchique** 📊
   - Niveau 1 : Coopérative (global)
   - Niveau 2 : Site (LL/LS/MT)
   - Niveau 3 : Gaveur
   - Niveau 4 : Lot

3. **Prévisions & Projections** 🔮
   - Prédiction production foie gras (tonnes)
   - Projection chiffre d'affaires
   - Optimisation planning abattage
   - Simulations scenarios

4. **Contrôle Qualité** ✅
   - Suivi ITM par site/gaveur
   - Détection anomalies
   - Benchmarking performances
   - Alertes qualité multi-niveaux

5. **Planification** 📅
   - Calendrier gavage multi-sites
   - Planning abattages
   - Gestion flux production
   - Optimisation logistique

6. **Outils Financiers** 💰
   - Tableaux de bord type "courtage"
   - Projections revenus
   - Analyse rentabilité par gaveur/site
   - Indicateurs clés performance (KPI)

---

## 🏗️ ARCHITECTURE TECHNIQUE

### Stack Technique

```
Frontend: Next.js 14 (App Router) + TypeScript + Tailwind CSS
Backend: FastAPI (PARTAGÉ avec app gaveurs)
Base de données: TimescaleDB (PARTAGÉE avec app gaveurs)
IA/ML: 
  - PySR (régression symbolique)
  - Prophet (prévisions séries temporelles)
  - Isolation Forest (détection anomalies)
  - Clustering (segmentation gaveurs)
Analytics: 
  - Apache Superset (dashboards BI)
  - Recharts (graphiques frontend)
Blockchain: Intégration chaîne existante gaveurs
SMS: Twilio/OVH (alertes critiques)
Monitoring: Prometheus + Grafana
```

### Spécificités Euralis

**Droits d'accès** :
- ✅ **Lecture complète** : Toutes données tous gaveurs
- ✅ **Contrôle global** : Alertes, validations, audits
- ✅ **Export avancé** : Rapports consolidés
- ✅ **Analytics avancés** : Prévisions, simulations
- ❌ **Pas de saisie directe** : Les gaveurs saisissent

**Base de données partagée** :
- Même DB que application gaveurs
- Vue matérialisée pour agrégations rapides
- Partitionnement par site (LL/LS/MT)
- Index optimisés pour requêtes macro

---

## 📊 MODÈLE DE DONNÉES EURALIS

### Tables Principales (Partagées)

#### 1. Sites Euralis
```sql
CREATE TABLE sites_euralis (
    id SERIAL PRIMARY KEY,
    code VARCHAR(2) UNIQUE NOT NULL,  -- LL, LS, MT
    nom VARCHAR(100) NOT NULL,
    region VARCHAR(100),
    adresse TEXT,
    responsable_site VARCHAR(100),
    telephone VARCHAR(20),
    email VARCHAR(255),
    capacite_gavage_max INTEGER,
    nb_gaveurs_actifs INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Données initiales
INSERT INTO sites_euralis (code, nom, region, capacite_gavage_max) VALUES
('LL', 'Site Bretagne', 'Bretagne', 50000),
('LS', 'Site Pays de Loire', 'Pays de Loire', 80000),
('MT', 'Site Maubourguet', 'Occitanie', 80000);
```

#### 2. Lots de Gavage (Extension table existante)
```sql
CREATE TABLE lots_gavage (
    id SERIAL PRIMARY KEY,
    code_lot VARCHAR(20) UNIQUE NOT NULL,  -- LL4801665, LS4801107, MT...
    site_code VARCHAR(2) NOT NULL REFERENCES sites_euralis(code),
    gaveur_id INTEGER NOT NULL REFERENCES gaveurs(id),
    eleveur VARCHAR(100),
    souche VARCHAR(50),  -- CF80*, MMG AS - PKL*, etc.
    
    -- Dates
    debut_lot DATE NOT NULL,
    fin_lot_prevue DATE,
    fin_lot_reelle DATE,
    date_abattage DATE,
    
    -- Quantités
    nb_canards_meg INTEGER,  -- Mise En Gavage
    nb_canards_enleves INTEGER,
    nb_canards_accroches INTEGER,  -- Abattus
    nb_canards_morts INTEGER,
    
    -- Durées
    duree_gavage_prevue INTEGER,
    duree_gavage_reelle INTEGER,
    age_animaux INTEGER,
    
    -- Performances
    itm DECIMAL(5,2),  -- Indice Technique Moyen
    itm_cut VARCHAR(10),  -- Catégorie ITM
    sigma DECIMAL(5,2),  -- Écart type poids foie
    sigma_cut VARCHAR(10),
    pctg_perte_gavage DECIMAL(5,2),  -- % mortalité
    
    -- Consommation maïs
    total_corn_target DECIMAL(8,2),  -- kg théorique
    total_corn_real DECIMAL(8,2),    -- kg réel
    qte_total_test DECIMAL(8,2),
    conso_gav_z1 DECIMAL(8,2),
    
    -- Plans alimentation
    code_plan_alimentation VARCHAR(50),
    four_alim_elev VARCHAR(100),
    four_alim_gav VARCHAR(100),
    code_plan_compl VARCHAR(50),
    
    -- Qualité
    prod_igp_fr BOOLEAN DEFAULT false,
    
    -- Statut
    statut VARCHAR(20) DEFAULT 'en_cours',  -- en_cours, termine, abattu
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour requêtes Euralis
CREATE INDEX idx_lots_site ON lots_gavage(site_code);
CREATE INDEX idx_lots_gaveur ON lots_gavage(gaveur_id);
CREATE INDEX idx_lots_debut ON lots_gavage(debut_lot);
CREATE INDEX idx_lots_statut ON lots_gavage(statut);
CREATE INDEX idx_lots_site_statut ON lots_gavage(site_code, statut);
```

#### 3. Doses Journalières Maïs (TimescaleDB Hypertable)
```sql
CREATE TABLE doses_journalieres (
    time TIMESTAMPTZ NOT NULL,
    lot_id INTEGER NOT NULL REFERENCES lots_gavage(id),
    jour_gavage INTEGER NOT NULL,  -- 1 à 27
    
    -- Doses
    feed_target DECIMAL(6,2),  -- Dose théorique (g)
    feed_real DECIMAL(6,2),    -- Dose réelle (g)
    
    -- Calculs
    corn_variation DECIMAL(6,2),  -- Écart
    cumul_corn DECIMAL(8,2),       -- Cumul depuis début
    delta_feed DECIMAL(6,2),       -- Variation vs J-1
    
    -- Métadonnées
    saisie_par INTEGER,
    remarques TEXT
);

SELECT create_hypertable('doses_journalieres', 'time');

-- Index
CREATE INDEX idx_doses_lot ON doses_journalieres(lot_id, jour_gavage);
CREATE INDEX idx_doses_time ON doses_journalieres(time DESC);
```

#### 4. Vue Matérialisée Performances Sites
```sql
CREATE MATERIALIZED VIEW performances_sites AS
SELECT 
    s.code as site_code,
    s.nom as site_nom,
    DATE_TRUNC('month', l.debut_lot) as mois,
    
    -- Volumes
    COUNT(DISTINCT l.id) as nb_lots,
    COUNT(DISTINCT l.gaveur_id) as nb_gaveurs,
    SUM(l.nb_canards_meg) as total_canards_meg,
    SUM(l.nb_canards_accroches) as total_canards_abattus,
    SUM(l.nb_canards_morts) as total_canards_morts,
    
    -- Performances
    AVG(l.itm) as itm_moyen,
    STDDEV(l.itm) as itm_ecart_type,
    AVG(l.sigma) as sigma_moyen,
    AVG(l.pctg_perte_gavage) as mortalite_moyenne,
    AVG(l.duree_gavage_reelle) as duree_moyenne,
    
    -- Consommation
    SUM(l.total_corn_real) as total_mais_kg,
    AVG(l.total_corn_real / NULLIF(l.nb_canards_meg, 0)) as mais_par_canard_kg,
    
    -- Production estimée foie gras
    SUM(l.nb_canards_accroches * l.itm / 1000) as production_foie_kg,
    
    -- Taux de réussite
    AVG(l.nb_canards_accroches::DECIMAL / NULLIF(l.nb_canards_meg, 0) * 100) as taux_reussite_pct
    
FROM lots_gavage l
JOIN sites_euralis s ON l.site_code = s.code
WHERE l.statut IN ('termine', 'abattu')
GROUP BY s.code, s.nom, DATE_TRUNC('month', l.debut_lot);

-- Refresh automatique toutes les heures
CREATE INDEX idx_perf_sites_mois ON performances_sites(mois DESC);
```

#### 5. Prévisions Production (IA)
```sql
CREATE TABLE previsions_production (
    id SERIAL PRIMARY KEY,
    site_code VARCHAR(2) REFERENCES sites_euralis(code),
    date_prevision DATE NOT NULL,
    horizon_jours INTEGER NOT NULL,  -- 7, 14, 30, 90 jours
    
    -- Prévisions
    nb_lots_prevu INTEGER,
    nb_canards_prevu INTEGER,
    production_foie_kg_prevu DECIMAL(10,2),
    chiffre_affaires_prevu DECIMAL(12,2),
    
    -- Intervalles de confiance
    production_min DECIMAL(10,2),
    production_max DECIMAL(10,2),
    confiance_pct DECIMAL(5,2),
    
    -- Métadonnées
    methode VARCHAR(50),  -- prophet, arima, regression
    modele_version VARCHAR(20),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_prev_site_date ON previsions_production(site_code, date_prevision DESC);
```

#### 6. Alertes Euralis (Multi-niveaux)
```sql
CREATE TABLE alertes_euralis (
    id SERIAL PRIMARY KEY,
    time TIMESTAMPTZ DEFAULT NOW(),
    
    -- Scope
    niveau VARCHAR(20) NOT NULL,  -- coopérative, site, gaveur, lot
    site_code VARCHAR(2) REFERENCES sites_euralis(code),
    gaveur_id INTEGER REFERENCES gaveurs(id),
    lot_id INTEGER REFERENCES lots_gavage(id),
    
    -- Alerte
    type_alerte VARCHAR(100) NOT NULL,
    severite VARCHAR(20) NOT NULL,  -- critique, important, warning, info
    message TEXT NOT NULL,
    
    -- Données
    valeur_mesuree DECIMAL(10,2),
    valeur_seuil DECIMAL(10,2),
    valeur_reference DECIMAL(10,2),
    
    -- Actions
    action_requise TEXT,
    acquittee BOOLEAN DEFAULT false,
    acquittee_par INTEGER,
    acquittee_le TIMESTAMPTZ,
    
    -- Notifications
    sms_envoye BOOLEAN DEFAULT false,
    email_envoye BOOLEAN DEFAULT false,
    
    -- Blockchain
    blockchain_hash VARCHAR(64)
);

SELECT create_hypertable('alertes_euralis', 'time');

CREATE INDEX idx_alertes_niveau ON alertes_euralis(niveau, severite);
CREATE INDEX idx_alertes_site ON alertes_euralis(site_code, time DESC);
```

#### 7. Planification Abattages
```sql
CREATE TABLE planning_abattages (
    id SERIAL PRIMARY KEY,
    site_code VARCHAR(2) NOT NULL REFERENCES sites_euralis(code),
    abattoir VARCHAR(100) NOT NULL,
    
    -- Dates
    date_abattage DATE NOT NULL,
    heure_debut TIME,
    heure_fin TIME,
    
    -- Capacités
    capacite_max INTEGER,
    nb_lots_planifies INTEGER DEFAULT 0,
    nb_canards_planifies INTEGER DEFAULT 0,
    
    -- Lots associés
    lots_ids INTEGER[],
    
    -- Statut
    statut VARCHAR(20) DEFAULT 'planifie',  -- planifie, confirme, realise, annule
    
    -- Métadonnées
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_planning_site_date ON planning_abattages(site_code, date_abattage);
```

---

## 🎨 INTERFACE UTILISATEUR EURALIS

### 1. Dashboard Principal Multi-Sites

**URL** : `/euralis/dashboard`

**Layout** :
```
┌─────────────────────────────────────────────────────────────┐
│  🏢 EURALIS - Pilotage Multi-Sites                          │
│  📅 Semaine 48 - 2024      👤 Marie Dupont (Admin)          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  📊 VUE GLOBALE - 3 SITES                                   │
│  ┌──────────┬──────────┬──────────┬──────────┐             │
│  │ 📈 Prod. │ 🦆 Lots  │ 👨‍🌾 Gav. │ ⚠️ Alert.│             │
│  │ 245.3 T  │   187    │   65     │    12    │             │
│  │ +12% ↑   │ -3% ↓    │ +5 ↑     │ -8 ↓     │             │
│  └──────────┴──────────┴──────────┴──────────┘             │
│                                                              │
│  🌍 PERFORMANCES PAR SITE                                    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Site         Lots  ITM   Σ    Mort% Prod(T)  CA(M€) │    │
│  │ LL Bretagne   11  14.85 2.1   3.2%   38.5    1.92  │    │
│  │ LS P.Loire    32  15.12 1.9   2.8%  105.8    5.29  │    │
│  │ MT Maubourg   32  14.89 2.3   3.5%  101.0    5.05  │    │
│  │ ─────────────────────────────────────────────────── │    │
│  │ TOTAL         75  14.97 2.1   3.2%  245.3   12.26  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  📈 ÉVOLUTION PRODUCTION (Graphique)                         │
│  [Courbes multi-sites + tendance + prévisions 30j]          │
│                                                              │
│  🚨 ALERTES ACTIVES                                          │
│  [Liste des alertes critiques et importantes]               │
└─────────────────────────────────────────────────────────────┘
```

**KPIs Principaux** :
- Production totale foie gras (tonnes)
- Nombre de lots actifs/terminés
- ITM moyen pondéré
- Taux de mortalité global
- Chiffre d'affaires prévisionnel

**Graphiques** :
- Évolution production par site (stacked area chart)
- Comparaison ITM par site (bar chart)
- Distribution performances gaveurs (box plot)
- Prévisions production 30/60/90 jours (line chart avec IC)

---

### 2. Vue Détaillée Site

**URL** : `/euralis/sites/{code}`  (LL, LS, MT)

**Sections** :
1. **En-tête Site**
   - Nom, région, responsable
   - KPIs site (lots, gaveurs, production)
   - Statut temps réel

2. **Tableau de Bord Site**
   - Graphiques performances
   - Top/Flop gaveurs
   - Évolution mensuelle
   - Comparaison vs autres sites

3. **Liste Gaveurs Actifs**
   - Tableau avec performances
   - Tri/filtres multiples
   - Actions rapides

4. **Planning Abattages**
   - Calendrier visuel
   - Lots programmés
   - Capacités disponibles

5. **Alertes Site**
   - Liste alertes actives
   - Historique
   - Actions correctives

---

### 3. Analytics Gaveur (Vue Euralis)

**URL** : `/euralis/gaveurs/{id}`

**Différence vs App Gaveur** :
- Vue Euralis = **Analyse comparative**
- Accès complet historique
- Benchmarking vs pairs
- Recommandations Euralis

**Sections** :
1. **Profil Gaveur**
   - Informations complètes
   - Historique collaboration
   - Certifications

2. **Performances**
   - KPIs globaux
   - Évolution temporelle
   - Comparaison site/coopérative

3. **Lots en Cours**
   - Liste avec statuts
   - Alertes actives
   - Actions requises

4. **Historique Lots**
   - Tableau complet
   - Statistiques agrégées
   - Export données

5. **Recommandations IA**
   - Optimisations suggérées
   - Best practices
   - Alertes prédictives

---

### 4. Prévisions & Projections

**URL** : `/euralis/previsions`

**Fonctionnalités** :

#### A. Prévisions Production
```
┌─────────────────────────────────────────────┐
│ 🔮 PRÉVISIONS PRODUCTION                    │
│                                              │
│ Horizon : ○ 7j  ● 30j  ○ 90j  ○ 12 mois    │
│ Site    : ☑ Tous  □ LL  □ LS  □ MT         │
│                                              │
│ 📊 Production Prévisionnelle (Graphique)    │
│  [Courbe avec intervalle confiance 95%]     │
│                                              │
│ 📈 PRÉVISIONS DÉTAILLÉES                     │
│  ┌──────────────────────────────────────┐   │
│  │ Site  | 7j    | 30j   | 90j    | An  │   │
│  │ LL    | 12.5T | 48.2T | 145.8T | ...│   │
│  │ LS    | 34.8T |132.4T | 398.1T | ...│   │
│  │ MT    | 33.2T |126.7T | 381.2T | ...│   │
│  └──────────────────────────────────────┘   │
│                                              │
│ 💰 Impact Financier                          │
│  CA prévisionnel 30j : 6.45 M€ (±5%)        │
└─────────────────────────────────────────────┘
```

#### B. Simulations Scenarios
- **What-If Analysis** :
  - "Si on augmente ITM de 0.5kg..."
  - "Si on réduit mortalité de 1%..."
  - "Si on ajoute 10 gaveurs..."

- **Optimisation Multi-Objectifs** :
  - Maximiser production
  - Minimiser mortalité
  - Optimiser coûts
  - Équilibrer sites

#### C. Planification Stratégique
- Calendrier prévisionnel 12 mois
- Besoin en gaveurs
- Capacités abattage
- Approvisionnement maïs

---

### 5. Contrôle Qualité

**URL** : `/euralis/qualite`

**Modules** :

#### A. Tableau de Bord Qualité
- ITM global et par site
- Distribution Sigma
- Taux conformité IGP
- Évolution qualité

#### B. Détection Anomalies
- **Lots atypiques** :
  - ITM hors norme
  - Mortalité excessive
  - Durée gavage anormale
  - Consommation maïs aberrante

- **Gaveurs sous-performants** :
  - ITM < seuil
  - Mortalité > seuil
  - Écarts répétés

#### C. Benchmarking
- **Classement gaveurs** :
  - Par ITM
  - Par efficacité (IC)
  - Par régularité
  - Par conformité

- **Comparaison sites** :
  - Performances relatives
  - Best practices
  - Axes amélioration

#### D. Alertes Qualité Multi-Niveaux
```sql
-- Exemples types alertes Euralis

-- Niveau Coopérative
"Production globale -15% vs prévision" → CRITIQUE
"ITM moyen sous objectif 2 mois consécutifs" → IMPORTANT

-- Niveau Site
"Site LS : 5 lots avec mortalité >5%" → CRITIQUE
"Site MT : ITM -8% vs moyenne coopérative" → WARNING

-- Niveau Gaveur
"Gaveur X : 3 lots consécutifs ITM <13kg" → IMPORTANT
"Gaveur Y : Écarts doses >20% sur 80% gavages" → WARNING

-- Niveau Lot
"Lot LL4801665 : Mortalité 12% (seuil 5%)" → CRITIQUE
"Lot LS4801107 : ITM 11.2kg (objectif 14kg)" → IMPORTANT
```

---

### 6. Gestion Abattages

**URL** : `/euralis/abattages`

**Fonctionnalités** :

#### A. Planning Visuel
```
┌─────────────────────────────────────────────┐
│ 📅 PLANNING ABATTAGES                       │
│                                              │
│ Semaine : [←] 48 - 2024 [→]                 │
│ Site    : ☑ Tous  □ LL  □ LS  □ MT         │
│                                              │
│  Lun  Mar  Mer  Jeu  Ven  Sam  Dim          │
│  ───  ───  ───  ───  ───  ───  ───          │
│   -   12   15   18   22    -    -   LL      │
│   -   28   32   35   40    -    -   LS      │
│   -   25   30   33   38    -    -   MT      │
│       ───  ───  ───  ───                    │
│       65   77   86  100  lots total          │
│                                              │
│ 🏭 Abattoirs partenaires                     │
│  ▸ Abattoir A : Cap. 50 lots/jour           │
│  ▸ Abattoir B : Cap. 30 lots/jour           │
└─────────────────────────────────────────────┘
```

#### B. Optimisation Planning
- **Algorithme d'optimisation** :
  - Contraintes capacité abattoirs
  - Contraintes durée gavage
  - Minimisation transport
  - Équilibrage charge

- **Suggestions automatiques** :
  - "Lot X prêt dans 2 jours → Planifier abattage"
  - "Surcharge abattoir jeudi → Décaler 3 lots vendredi"

#### C. Suivi Temps Réel
- Lots en attente abattage
- Lots en cours abattage
- Résultats abattage (ITM réel vs prévu)

---

### 7. Outils Financiers

**URL** : `/euralis/finance`

**Modules** :

#### A. Dashboard Financier (Type Courtage)
```
┌─────────────────────────────────────────────┐
│ 💰 TABLEAU DE BORD FINANCIER                │
│                                              │
│ 📊 CHIFFRES CLÉS (Mois en cours)            │
│  ┌──────────┬──────────┬──────────────┐     │
│  │ CA Réel  │ CA Prévu │   Écart      │     │
│  │ 4.82 M€  │ 5.10 M€  │  -5.5% ⚠️    │     │
│  └──────────┴──────────┴──────────────┘     │
│                                              │
│ 📈 ÉVOLUTION CA (Graphique)                  │
│  [Courbe réel vs prévu + prévisions]        │
│                                              │
│ 🏆 TOP CONTRIBUTEURS                         │
│  1. Site LS : 2.15 M€ (44.6%)               │
│  2. Site MT : 2.05 M€ (42.5%)               │
│  3. Site LL : 0.62 M€ (12.9%)               │
│                                              │
│ 💡 INDICATEURS RENTABILITÉ                   │
│  • Marge brute :  28.5% (+2.1 pts)          │
│  • Coût/kg foie : 19.65€ (-0.85€)           │
│  • Prix moyen :   50.20€/kg (+1.20€)        │
└─────────────────────────────────────────────┘
```

#### B. Projections Revenus
- **Modèles prédictifs** :
  - Basé sur lots en cours
  - Basé sur tendances historiques
  - Basé sur saisonnalité

- **Scénarios** :
  - Optimiste (+10%)
  - Réaliste (tendance)
  - Pessimiste (-10%)

#### C. Analyse Rentabilité
- **Par site** :
  - CA, coûts, marge
  - ROI par gaveur
  - Évolution marges

- **Par gaveur** :
  - Performance financière
  - Coûts gavage
  - Rentabilité relative

- **Par lot** :
  - Coût revient
  - Prix vente estimé
  - Marge unitaire

#### D. Exports Comptables
- CSV, Excel, PDF
- Formats standards comptabilité
- Intégration ERP (SAP, Sage)

---

## 🤖 MODULES IA SPÉCIFIQUES EURALIS

### 1. Régression Symbolique Multi-Sites

**Objectif** : Découvrir formules optimales **par site et par souche**

```python
# app/ml/euralis/multi_site_regression.py

from pysr import PySRRegressor
import pandas as pd

class MultiSiteSymbolicRegression:
    """
    Régression symbolique pour chaque combinaison site × souche
    """
    
    def __init__(self):
        self.models = {}  # {(site, souche): model}
        
    def train_by_site_and_souche(self, df):
        """
        Entraîner un modèle par combinaison site-souche
        """
        results = {}
        
        for site in ['LL', 'LS', 'MT']:
            for souche in df['Souche'].unique():
                # Filtrer données
                data = df[(df['site_code'] == site) & (df['Souche'] == souche)]
                
                if len(data) < 20:  # Minimum de données
                    continue
                
                # Features
                X = data[[
                    'duree_gavage', 'total_corn_real', 'age_animaux',
                    'nb_canards_meg', 'pctg_perte_gavage'
                ]]
                
                # Target
                y = data['itm']
                
                # PySR
                model = PySRRegressor(
                    niterations=100,
                    binary_operators=["+", "*", "/", "-"],
                    unary_operators=["exp", "log", "sqrt"],
                    populations=20,
                    population_size=50,
                    maxsize=20,
                    model_selection="best"
                )
                
                model.fit(X, y)
                
                # Stocker
                key = (site, souche)
                self.models[key] = model
                
                results[key] = {
                    'formule': str(model.sympy()),
                    'r2_score': model.score(X, y),
                    'nb_samples': len(data)
                }
        
        return results
    
    def predict_itm(self, site, souche, features):
        """
        Prédire ITM pour une combinaison site-souche
        """
        key = (site, souche)
        if key in self.models:
            return self.models[key].predict([features])[0]
        else:
            # Fallback sur modèle général
            return self._predict_fallback(features)
```

**Utilisation** :
```python
# Découvrir formules optimales
regressor = MultiSiteSymbolicRegression()
formulas = regressor.train_by_site_and_souche(lots_df)

# Exemple résultat :
# ('LS', 'CF80*'): ITM = 0.85*duree + 0.003*total_corn - 2.1
# ('MT', 'MMG AS'): ITM = 1.12*log(total_corn) + 0.62*duree - 5.8
```

---

### 2. Prévisions Production Prophet

**Objectif** : Prédire production foie gras par site à 7/30/90 jours

```python
# app/ml/euralis/production_forecasting.py

from prophet import Prophet
import pandas as pd

class ProductionForecaster:
    """
    Prévisions de production avec Prophet (Facebook)
    """
    
    def __init__(self):
        self.models = {}  # {site_code: model}
        
    def train_site_model(self, site_code, historical_data):
        """
        Entraîner modèle Prophet pour un site
        
        Args:
            site_code: 'LL', 'LS', 'MT'
            historical_data: DataFrame avec colonnes:
                - date: Date
                - production_kg: Production foie gras en kg
        """
        # Préparer données pour Prophet
        df = historical_data[['date', 'production_kg']].copy()
        df.columns = ['ds', 'y']
        
        # Modèle Prophet
        model = Prophet(
            yearly_seasonality=True,
            weekly_seasonality=False,
            daily_seasonality=False,
            seasonality_mode='multiplicative',
            interval_width=0.95
        )
        
        # Ajouter saisonnalité mensuelle
        model.add_seasonality(
            name='monthly',
            period=30.5,
            fourier_order=5
        )
        
        # Entraîner
        model.fit(df)
        
        self.models[site_code] = model
        
        return model
    
    def forecast(self, site_code, periods_days=30):
        """
        Générer prévisions
        
        Returns:
            DataFrame avec colonnes:
                - date: Date
                - production_kg_prevu: Prévision
                - production_kg_min: Borne inf (95%)
                - production_kg_max: Borne sup (95%)
        """
        if site_code not in self.models:
            raise ValueError(f"Modèle non entraîné pour site {site_code}")
        
        model = self.models[site_code]
        
        # Créer dataframe futures
        future = model.make_future_dataframe(periods=periods_days)
        
        # Prédire
        forecast = model.predict(future)
        
        # Formatter résultats
        result = forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper']].tail(periods_days)
        result.columns = ['date', 'production_kg_prevu', 'production_kg_min', 'production_kg_max']
        
        return result
    
    def forecast_all_sites(self, periods_days=30):
        """
        Prévisions pour tous les sites
        """
        forecasts = {}
        
        for site in ['LL', 'LS', 'MT']:
            if site in self.models:
                forecasts[site] = self.forecast(site, periods_days)
        
        return forecasts
```

**Exemple utilisation** :
```python
# Entraîner modèles
forecaster = ProductionForecaster()

for site in ['LL', 'LS', 'MT']:
    historical = get_historical_production(site)  # Données historiques
    forecaster.train_site_model(site, historical)

# Prévisions 30 jours
previsions = forecaster.forecast_all_sites(periods_days=30)

# Résultat pour site LS :
#     date        production_kg_prevu  production_kg_min  production_kg_max
# 0   2024-02-01  3542.5              3180.2             3904.8
# 1   2024-02-02  3588.1              3225.8             3950.4
# ...
```

---

### 3. Clustering Gaveurs (Segmentation)

**Objectif** : Segmenter gaveurs en groupes homogènes pour pilotage ciblé

```python
# app/ml/euralis/gaveur_clustering.py

from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
import pandas as pd

class GaveurSegmentation:
    """
    Clustering gaveurs selon performances
    """
    
    def __init__(self, n_clusters=5):
        self.n_clusters = n_clusters
        self.scaler = StandardScaler()
        self.kmeans = None
        self.cluster_labels = [
            'Excellent',
            'Très bon',
            'Bon',
            'À améliorer',
            'Critique'
        ]
        
    def segment_gaveurs(self, gaveurs_df):
        """
        Segmenter gaveurs en clusters
        
        Args:
            gaveurs_df: DataFrame avec métriques par gaveur:
                - itm_moyen
                - sigma_moyen
                - mortalite_moyenne
                - nb_lots
                - regularite (variance ITM)
        
        Returns:
            DataFrame avec colonne 'cluster' ajoutée
        """
        # Features pour clustering
        features = [
            'itm_moyen',
            'sigma_moyen', 
            'mortalite_moyenne',
            'nb_lots',
            'regularite'
        ]
        
        X = gaveurs_df[features]
        
        # Normaliser
        X_scaled = self.scaler.fit_transform(X)
        
        # K-Means
        self.kmeans = KMeans(
            n_clusters=self.n_clusters,
            random_state=42,
            n_init=10
        )
        
        clusters = self.kmeans.fit_predict(X_scaled)
        
        # Ordonner clusters par performance
        cluster_itm = gaveurs_df.groupby(clusters)['itm_moyen'].mean()
        cluster_order = cluster_itm.sort_values(ascending=False).index
        
        # Mapper vers labels
        cluster_mapping = {
            old_id: self.cluster_labels[new_id] 
            for new_id, old_id in enumerate(cluster_order)
        }
        
        gaveurs_df['cluster'] = pd.Series(clusters).map(cluster_mapping)
        
        return gaveurs_df
    
    def get_cluster_profiles(self, gaveurs_df):
        """
        Profils des clusters
        """
        profiles = gaveurs_df.groupby('cluster').agg({
            'itm_moyen': 'mean',
            'sigma_moyen': 'mean',
            'mortalite_moyenne': 'mean',
            'nb_lots': 'sum',
            'gaveur_id': 'count'
        }).round(2)
        
        profiles.columns = ['ITM', 'Sigma', 'Mortalité%', 'Total Lots', 'Nb Gaveurs']
        
        return profiles
```

**Exemple segmentation** :
```
Cluster        ITM   Sigma  Mortalité%  Total Lots  Nb Gaveurs
-----------------------------------------------------------------
Excellent      16.2   1.8      1.5%         145         8
Très bon       15.1   2.0      2.3%         312        18
Bon            14.5   2.2      3.1%         428        25
À améliorer    13.2   2.5      4.2%         156        10
Critique       11.8   3.1      6.8%          43         4
```

**Actions ciblées par cluster** :
- **Excellent** : Best practices à diffuser
- **Très bon** : Formation pour passer Excellent
- **Bon** : Suivi standard
- **À améliorer** : Accompagnement renforcé
- **Critique** : Audit + plan action urgent

---

### 4. Détection Anomalies Multi-Niveaux

**Objectif** : Détecter anomalies à tous les niveaux (coopérative, site, gaveur, lot)

```python
# app/ml/euralis/anomaly_detection.py

from sklearn.ensemble import IsolationForest
import numpy as np

class MultiLevelAnomalyDetector:
    """
    Détection d'anomalies à plusieurs niveaux
    """
    
    def __init__(self):
        self.models = {
            'lot': IsolationForest(contamination=0.1, random_state=42),
            'gaveur': IsolationForest(contamination=0.15, random_state=42),
            'site': IsolationForest(contamination=0.2, random_state=42)
        }
        
    def detect_lot_anomalies(self, lots_df):
        """
        Détecter lots anormaux
        
        Features analysées :
        - ITM vs moyenne site
        - Sigma vs moyenne
        - Mortalité
        - Durée gavage
        - Consommation maïs
        """
        features = lots_df[[
            'itm',
            'sigma',
            'pctg_perte_gavage',
            'duree_gavage_reelle',
            'total_corn_real'
        ]].fillna(0)
        
        # Prédire anomalies (-1 = anomalie, 1 = normal)
        predictions = self.models['lot'].fit_predict(features)
        
        lots_df['is_anomaly'] = predictions == -1
        
        # Scores anomalie
        lots_df['anomaly_score'] = self.models['lot'].score_samples(features)
        
        # Identifier raisons anomalie
        anomalies = lots_df[lots_df['is_anomaly']].copy()
        
        for idx, row in anomalies.iterrows():
            raisons = []
            
            if row['itm'] < lots_df['itm'].quantile(0.1):
                raisons.append(f"ITM très faible ({row['itm']:.2f} kg)")
            
            if row['pctg_perte_gavage'] > lots_df['pctg_perte_gavage'].quantile(0.9):
                raisons.append(f"Mortalité élevée ({row['pctg_perte_gavage']:.1f}%)")
            
            if row['sigma'] > lots_df['sigma'].quantile(0.9):
                raisons.append(f"Hétérogénéité forte (σ={row['sigma']:.2f})")
            
            lots_df.at[idx, 'raisons_anomalie'] = '; '.join(raisons)
        
        return lots_df
    
    def detect_gaveur_anomalies(self, gaveurs_stats_df):
        """
        Détecter gaveurs avec performances anormales
        """
        features = gaveurs_stats_df[[
            'itm_moyen',
            'mortalite_moyenne',
            'regularite',
            'nb_lots'
        ]].fillna(0)
        
        predictions = self.models['gaveur'].fit_predict(features)
        gaveurs_stats_df['is_anomaly'] = predictions == -1
        
        return gaveurs_stats_df
    
    def detect_site_anomalies(self, sites_stats_df):
        """
        Détecter anomalies au niveau site
        """
        features = sites_stats_df[[
            'itm_moyen',
            'production_totale',
            'mortalite_moyenne',
            'nb_gaveurs_actifs'
        ]].fillna(0)
        
        predictions = self.models['site'].fit_predict(features)
        sites_stats_df['is_anomaly'] = predictions == -1
        
        return sites_stats_df
```

---

### 5. Optimisation Planning Abattages

**Objectif** : Optimiser allocation lots → abattoirs avec contraintes multiples

```python
# app/ml/euralis/abattage_optimization.py

from scipy.optimize import linear_sum_assignment
import numpy as np

class AbattageOptimizer:
    """
    Optimisation planning abattages
    """
    
    def optimize_weekly_planning(self, lots_ready, abattoirs_capacity):
        """
        Optimiser planning hebdo
        
        Args:
            lots_ready: Liste lots prêts abattage
                [{id, site, nb_canards, date_fin_gavage, urgence}, ...]
            abattoirs_capacity: Capacités abattoirs par jour
                {abattoir_id: {date: capacite}, ...}
        
        Returns:
            Planning optimal : {lot_id: (abattoir_id, date)}
        """
        # Construire matrice coûts
        # Coût = distance + urgence + surcharge
        
        n_lots = len(lots_ready)
        n_slots = sum(len(dates) for dates in abattoirs_capacity.values())
        
        cost_matrix = np.zeros((n_lots, n_slots))
        
        slot_idx = 0
        slot_mapping = {}
        
        for abattoir_id, dates_capacity in abattoirs_capacity.items():
            for date, capacity in dates_capacity.items():
                for lot_idx, lot in enumerate(lots_ready):
                    # Coût distance site → abattoir
                    distance_cost = self._get_distance_cost(
                        lot['site'], 
                        abattoir_id
                    )
                    
                    # Coût urgence (pénalité si retard)
                    urgence_cost = self._get_urgence_cost(
                        lot['date_fin_gavage'],
                        date
                    )
                    
                    # Coût surcharge abattoir
                    surcharge_cost = self._get_surcharge_cost(
                        lot['nb_canards'],
                        capacity
                    )
                    
                    cost_matrix[lot_idx, slot_idx] = (
                        distance_cost + 
                        urgence_cost * 10 +  # Urgence prioritaire
                        surcharge_cost * 5
                    )
                
                slot_mapping[slot_idx] = (abattoir_id, date)
                slot_idx += 1
        
        # Algorithme hongrois (linear_sum_assignment)
        lot_indices, slot_indices = linear_sum_assignment(cost_matrix)
        
        # Construire planning
        planning = {}
        for lot_idx, slot_idx in zip(lot_indices, slot_indices):
            lot_id = lots_ready[lot_idx]['id']
            abattoir_id, date = slot_mapping[slot_idx]
            planning[lot_id] = (abattoir_id, date)
        
        return planning
    
    def _get_distance_cost(self, site_code, abattoir_id):
        """
        Coût basé sur distance site → abattoir
        """
        # Matrice distances (à paramétrer selon réalité)
        distances = {
            ('LL', 'abattoir_1'): 50,
            ('LL', 'abattoir_2'): 150,
            ('LS', 'abattoir_1'): 100,
            ('LS', 'abattoir_2'): 80,
            ('MT', 'abattoir_1'): 200,
            ('MT', 'abattoir_2'): 120,
        }
        
        return distances.get((site_code, abattoir_id), 100)
    
    def _get_urgence_cost(self, date_fin_gavage, date_abattage):
        """
        Coût basé sur délai fin gavage → abattage
        """
        delta_days = (date_abattage - date_fin_gavage).days
        
        if delta_days < 0:
            return 1000  # Impossible (canards pas prêts)
        elif delta_days == 0:
            return 0  # Parfait
        elif delta_days <= 2:
            return 10  # Acceptable
        else:
            return 50 * delta_days  # Pénalité croissante
    
    def _get_surcharge_cost(self, nb_canards, capacite):
        """
        Coût si surcharge abattoir
        """
        if nb_canards > capacite:
            return 100  # Impossible
        else:
            # Coût proportionnel au taux remplissage
            return 20 * (nb_canards / capacite)
```

---

## 🔔 SYSTÈME D'ALERTES EURALIS

### Types d'Alertes Spécifiques

#### 1. Alertes Niveau Coopérative
```python
# Exemples alertes coopérative

ALERTES_COOPERATIVE = {
    'production_globale_baisse': {
        'condition': 'production_mois < production_mois_precedent * 0.85',
        'severite': 'critique',
        'sms': True,
        'destinataires': ['directeur_general', 'directeur_production'],
        'message': "Production globale -15% vs mois précédent"
    },
    
    'itm_moyen_sous_objectif': {
        'condition': 'itm_moyen < 14.5 AND nb_mois_consecutifs >= 2',
        'severite': 'important',
        'sms': False,
        'message': "ITM moyen sous objectif (14.5kg) depuis 2 mois"
    },
    
    'mortalite_globale_elevee': {
        'condition': 'mortalite_moyenne > 5.0',
        'severite': 'critique',
        'sms': True,
        'message': "Mortalité globale >5% - Risque sanitaire"
    },
    
    'prevision_production_baisse': {
        'condition': 'prevision_30j < objectif_30j * 0.90',
        'severite': 'important',
        'sms': False,
        'message': "Prévision production à 30j : -10% vs objectif"
    }
}
```

#### 2. Alertes Niveau Site
```python
ALERTES_SITE = {
    'site_sous_performance': {
        'condition': 'itm_site < itm_moyenne_coop * 0.92',
        'severite': 'important',
        'sms': False,
        'destinataires': ['responsable_site'],
        'message': "Site {site} : ITM -8% vs moyenne coopérative"
    },
    
    'lots_multiples_anomalies': {
        'condition': 'COUNT(lots_anomalies) >= 5',
        'severite': 'critique',
        'sms': True,
        'message': "Site {site} : 5 lots avec anomalies détectées"
    },
    
    'capacite_abattage_critique': {
        'condition': 'lots_prets_abattage > capacite_hebdo * 1.2',
        'severite': 'important',
        'sms': True,
        'message': "Site {site} : Saturation capacité abattage (+20%)"
    },
    
    'gaveurs_sous_performance': {
        'condition': 'COUNT(gaveurs_cluster_critique) >= 3',
        'severite': 'warning',
        'sms': False,
        'message': "Site {site} : 3 gaveurs en cluster 'Critique'"
    }
}
```

#### 3. Alertes Niveau Gaveur (Vue Euralis)
```python
ALERTES_GAVEUR_EURALIS = {
    'gaveur_3_lots_consecutifs_faibles': {
        'condition': 'itm_lot1 < 13 AND itm_lot2 < 13 AND itm_lot3 < 13',
        'severite': 'critique',
        'sms': True,
        'destinataires': ['responsable_site', 'technicien_secteur'],
        'message': "Gaveur {nom} : 3 lots consécutifs ITM <13kg - Audit requis"
    },
    
    'gaveur_ecarts_doses_repetitifs': {
        'condition': 'ecart_doses_moyen > 20 AND nb_lots >= 3',
        'severite': 'important',
        'sms': False,
        'message': "Gaveur {nom} : Écarts doses >20% sur plusieurs lots"
    },
    
    'gaveur_mortalite_elevee': {
        'condition': 'mortalite_moyenne > 6.0',
        'severite': 'critique',
        'sms': True,
        'message': "Gaveur {nom} : Mortalité moyenne 6% - Intervention urgente"
    }
}
```

---

## 📱 MODULES SMS EURALIS

### Configuration Multi-Destinataires

```python
# app/services/euralis_sms_service.py

from twilio.rest import Client
import os

class EuralisSMSService:
    """
    Service SMS spécifique Euralis avec gestion multi-destinataires
    """
    
    def __init__(self):
        self.client = Client(
            os.getenv('TWILIO_ACCOUNT_SID'),
            os.getenv('TWILIO_AUTH_TOKEN')
        )
        self.from_number = os.getenv('TWILIO_PHONE_NUMBER')
        
        # Annuaire Euralis
        self.contacts = {
            'directeur_general': '+33612345678',
            'directeur_production': '+33612345679',
            'responsable_site_LL': '+33612345680',
            'responsable_site_LS': '+33612345681',
            'responsable_site_MT': '+33612345682',
            'technicien_secteur_1': '+33612345683',
            'technicien_secteur_2': '+33612345684',
        }
    
    def send_alert_sms(self, alerte_type, alerte_data, destinataires):
        """
        Envoyer SMS d'alerte
        
        Args:
            alerte_type: Type alerte
            alerte_data: Données alerte
            destinataires: Liste rôles destinataires
        """
        message = self._format_message(alerte_type, alerte_data)
        
        sent_to = []
        for role in destinataires:
            if role in self.contacts:
                phone = self.contacts[role]
                
                try:
                    self.client.messages.create(
                        body=message,
                        from_=self.from_number,
                        to=phone
                    )
                    sent_to.append(role)
                except Exception as e:
                    print(f"Erreur envoi SMS à {role}: {e}")
        
        return sent_to
    
    def _format_message(self, alerte_type, data):
        """
        Formater message SMS
        """
        templates = {
            'production_globale_baisse': (
                "🚨 EURALIS ALERTE\n"
                "Production: -{baisse}%\n"
                "Mois: {mois}\n"
                "Action requise"
            ),
            'site_sous_performance': (
                "⚠️ EURALIS ALERTE\n"
                "Site {site}: ITM {itm}kg\n"
                "Écart: {ecart}%\n"
                "Vérifier urgence"
            ),
            'lots_multiples_anomalies': (
                "🚨 EURALIS CRITIQUE\n"
                "Site {site}: {nb_lots} lots anomalies\n"
                "Audit immédiat"
            ),
            'gaveur_mortalite_elevee': (
                "🚨 EURALIS URGENT\n"
                "Gaveur: {nom}\n"
                "Mortalité: {mortalite}%\n"
                "Intervention requise"
            ),
        }
        
        template = templates.get(alerte_type, "EURALIS ALERTE: {message}")
        return template.format(**data)
```

---

## ⛓️ INTÉGRATION BLOCKCHAIN EURALIS

### Extension Blockchain pour Traçabilité Multi-Sites

```python
# app/blockchain/euralis_blockchain.py

from hashlib import sha256
import json

class EuralisBlockchain:
    """
    Extension blockchain pour Euralis
    Enregistre événements niveau coopérative
    """
    
    def __init__(self):
        self.chain = []
        
    def add_euralis_event(
        self,
        event_type,
        site_code,
        lot_ids,
        data,
        responsable_id
    ):
        """
        Ajouter événement Euralis à la blockchain
        
        Types événements :
        - validation_lot : Validation qualité lot par Euralis
        - planification_abattage : Planning abattage validé
        - audit_gaveur : Audit effectué
        - certification_site : Certification qualité site
        - transfert_lot : Transfert lot entre sites
        """
        event = {
            'index': len(self.chain),
            'timestamp': datetime.now().isoformat(),
            'event_type': event_type,
            'site_code': site_code,
            'lot_ids': lot_ids,
            'data': data,
            'responsable_id': responsable_id,
            'hash_precedent': self.chain[-1]['hash'] if self.chain else '0'
        }
        
        # Calculer hash
        event['hash'] = self._calculate_hash(event)
        
        # Ajouter à la chaîne
        self.chain.append(event)
        
        return event
    
    def _calculate_hash(self, event):
        """
        Calculer hash événement
        """
        event_string = json.dumps(event, sort_keys=True, default=str)
        return sha256(event_string.encode()).hexdigest()
    
    def verify_chain(self):
        """
        Vérifier intégrité chaîne
        """
        for i in range(1, len(self.chain)):
            current = self.chain[i]
            previous = self.chain[i-1]
            
            # Vérifier hash précédent
            if current['hash_precedent'] != previous['hash']:
                return False, f"Erreur bloc {i}: hash précédent invalide"
            
            # Recalculer hash
            recalculated = self._calculate_hash(current)
            if current['hash'] != recalculated:
                return False, f"Erreur bloc {i}: hash invalide"
        
        return True, "Chaîne valide"
    
    def get_lot_history(self, lot_id):
        """
        Historique complet lot (chaîne Euralis + chaîne gaveur)
        """
        events = [
            event for event in self.chain 
            if lot_id in event.get('lot_ids', [])
        ]
        
        return sorted(events, key=lambda x: x['timestamp'])
```

**Exemples événements Euralis** :
```python
# Validation lot
blockchain.add_euralis_event(
    event_type='validation_lot',
    site_code='LS',
    lot_ids=[123, 124, 125],
    data={
        'validateur': 'Marie Dupont',
        'itm_moyen': 15.2,
        'conformite_igp': True,
        'decision': 'VALIDE'
    },
    responsable_id=1
)

# Planification abattage
blockchain.add_euralis_event(
    event_type='planification_abattage',
    site_code='MT',
    lot_ids=[150, 151],
    data={
        'abattoir': 'Abattoir Sud-Ouest',
        'date_abattage': '2024-02-15',
        'nb_canards': 1250,
        'transport': 'Transporteur A'
    },
    responsable_id=2
)

# Audit gaveur
blockchain.add_euralis_event(
    event_type='audit_gaveur',
    site_code='LL',
    lot_ids=[],
    data={
        'gaveur_id': 45,
        'auditeur': 'Jean Martin',
        'score': 85,
        'recommandations': [
            'Améliorer traçabilité températures',
            'Formation doses optimales'
        ]
    },
    responsable_id=3
)
```

---

## 📊 VUES MATÉRIALISÉES OPTIMISÉES

### Continuous Aggregates pour Analytics Temps Réel

```sql
-- Vue performances temps réel par site
CREATE MATERIALIZED VIEW mv_performances_sites_realtime
WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('1 hour', g.time) AS hour,
    l.site_code,
    COUNT(DISTINCT g.id) AS nb_gavages,
    COUNT(DISTINCT l.id) AS nb_lots_actifs,
    AVG(g.poids_matin) AS poids_moyen,
    AVG(g.dose_matin + g.dose_soir) AS dose_moyenne_jour
FROM gavage_data g
JOIN lots_gavage l ON g.lot_id = l.id
WHERE l.statut = 'en_cours'
GROUP BY hour, l.site_code;

-- Refresh policy toutes les 15 minutes
SELECT add_continuous_aggregate_policy('mv_performances_sites_realtime',
    start_offset => INTERVAL '1 month',
    end_offset => INTERVAL '15 minutes',
    schedule_interval => INTERVAL '15 minutes');

-- Vue KPIs journaliers multi-sites
CREATE MATERIALIZED VIEW mv_kpis_daily
WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('1 day', l.debut_lot) AS jour,
    l.site_code,
    
    -- Volumes
    COUNT(DISTINCT l.id) AS nb_nouveaux_lots,
    SUM(l.nb_canards_meg) AS nb_canards_mis_en_gavage,
    
    -- Performances (lots terminés)
    AVG(CASE WHEN l.statut = 'termine' THEN l.itm END) AS itm_moyen,
    AVG(CASE WHEN l.statut = 'termine' THEN l.pctg_perte_gavage END) AS mortalite_moyenne,
    
    -- Production
    SUM(CASE WHEN l.statut = 'abattu' 
        THEN l.nb_canards_accroches * l.itm / 1000 
        END) AS production_foie_kg
        
FROM lots_gavage l
GROUP BY jour, l.site_code;

-- Vue ranking gaveurs par site
CREATE MATERIALIZED VIEW mv_ranking_gaveurs
WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('1 month', l.debut_lot) AS mois,
    l.site_code,
    l.gaveur_id,
    g.nom,
    
    -- Performances
    COUNT(l.id) AS nb_lots,
    AVG(l.itm) AS itm_moyen,
    STDDEV(l.itm) AS itm_variance,
    AVG(l.pctg_perte_gavage) AS mortalite_moyenne,
    
    -- Classement
    RANK() OVER (
        PARTITION BY time_bucket('1 month', l.debut_lot), l.site_code 
        ORDER BY AVG(l.itm) DESC
    ) AS rank_itm,
    
    RANK() OVER (
        PARTITION BY time_bucket('1 month', l.debut_lot), l.site_code 
        ORDER BY AVG(l.pctg_perte_gavage) ASC
    ) AS rank_mortalite
    
FROM lots_gavage l
JOIN gaveurs g ON l.gaveur_id = g.id
WHERE l.statut IN ('termine', 'abattu')
GROUP BY mois, l.site_code, l.gaveur_id, g.nom;
```

---

## 🚀 COMMANDES DE DÉMARRAGE

### Initialisation Projet

```bash
# 1. Backend (partagé avec app gaveurs)
cd gaveurs-ai-blockchain/backend

# Variables d'environnement Euralis
cat > .env.euralis << EOF
# Sites Euralis
SITE_LL_NAME="Site Bretagne"
SITE_LS_NAME="Site Pays de Loire"
SITE_MT_NAME="Site Maubourguet"

# Seuils alertes Euralis
SEUIL_ITM_MIN=14.5
SEUIL_MORTALITE_MAX=5.0
SEUIL_PRODUCTION_BAISSE=-0.15

# SMS Euralis
EURALIS_SMS_DIRECTEUR=+33612345678
EURALIS_SMS_PROD=+33612345679

# BI/Analytics
SUPERSET_URL=http://localhost:8088
SUPERSET_USER=admin
SUPERSET_PASSWORD=euralis2024

# ML Models
PROPHET_HORIZON_DAYS=30,90
PYSR_NITERATIONS=100
EOF

# Démarrer services
docker-compose up -d

# Importer données CSV Euralis
python3 scripts/import_euralis_data.py \
    --csv /path/to/Pretraite_End_2024_claude.csv \
    --site LL,LS,MT

# 2. Frontend Euralis
npx create-next-app@latest euralis-frontend --typescript --tailwind --app

cd euralis-frontend

# Installer dépendances spécifiques
npm install recharts lucide-react
npm install date-fns  # Gestion dates
npm install react-big-calendar  # Calendrier abattages
npm install @tanstack/react-table  # Tables avancées
npm install react-to-print  # Exports PDF

# Structure dossiers
mkdir -p app/euralis/{dashboard,sites,gaveurs,previsions,qualite,abattages,finance}
mkdir -p components/euralis/{kpis,charts,tables,planning}
mkdir -p lib/euralis

# Créer .env.local
cat > .env.local << EOF
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_EURALIS_MODE=true
NEXT_PUBLIC_SITES=LL,LS,MT
EOF

# Lancer dev
npm run dev
```

---

## 📋 CHECKLIST DÉVELOPPEMENT

### Phase 1 : Infrastructure (Semaine 1)
- [ ] Configuration base de données (tables sites, lots, doses)
- [ ] Vues matérialisées performances
- [ ] Import données CSV historiques
- [ ] API routes Euralis (50+ endpoints)
- [ ] Service SMS multi-destinataires
- [ ] Extension blockchain Euralis

### Phase 2 : IA/ML (Semaine 2)
- [ ] Régression symbolique multi-sites
- [ ] Prévisions Prophet par site
- [ ] Clustering gaveurs
- [ ] Détection anomalies multi-niveaux
- [ ] Optimisation planning abattages

### Phase 3 : Frontend - Dashboards (Semaine 3)
- [ ] Dashboard principal multi-sites
- [ ] Vue détaillée par site (LL, LS, MT)
- [ ] Analytics gaveur (vue Euralis)
- [ ] Module prévisions & projections
- [ ] Contrôle qualité

### Phase 4 : Frontend - Fonctionnalités Avancées (Semaine 4)
- [ ] Planning abattages interactif
- [ ] Outils financiers type courtage
- [ ] Exports avancés (PDF, Excel)
- [ ] Alertes multi-niveaux
- [ ] Intégration blockchain

### Phase 5 : Tests & Optimisation (Semaine 5)
- [ ] Tests performances requêtes
- [ ] Optimisation vues matérialisées
- [ ] Tests utilisateurs
- [ ] Documentation complète

### Phase 6 : Déploiement Production (Semaine 6)
- [ ] Configuration serveurs
- [ ] Migration données
- [ ] Formation utilisateurs Euralis
- [ ] Monitoring production

---

## 📊 ESTIMATION PROJET

### Ressources

**Développement** :
- Backend : 2 développeurs × 4 semaines
- Frontend : 2 développeurs × 4 semaines
- Data Science : 1 data scientist × 3 semaines
- Total : **~400 heures**

**Infrastructure** :
- Serveur backend : 4 cores, 16GB RAM
- Base de données : TimescaleDB cluster (master + replica)
- Analytics : Apache Superset instance
- Coût mensuel estimé : **~500€**

### Coûts

| Poste | Montant |
|-------|---------|
| Développement (400h @ 80€/h) | 32 000€ |
| Infrastructure (6 mois) | 3 000€ |
| Formation | 2 000€ |
| Maintenance (1 an) | 8 000€ |
| **TOTAL** | **45 000€** |

### ROI Estimé

**Gains annuels** :
- Optimisation production (+5%) : **+600 tonnes** → +30 M€
- Réduction mortalité (-1%) : **+30 000 canards** → +1.5 M€
- Optimisation abattages : **-100K€** coûts logistique
- Meilleure planification : **+200K€** trésorerie

**ROI** : **~70 000% la première année** 🚀

---

## 🎯 CONCLUSION

L'**Application Euralis** est un **outil de pilotage stratégique** de niveau coopérative qui :

✅ **Centralise** toutes les données de production des 3 sites  
✅ **Analyse** les performances à tous les niveaux (coopérative → site → gaveur → lot)  
✅ **Prédit** la production et le chiffre d'affaires avec IA avancée  
✅ **Optimise** la planification des abattages  
✅ **Alerte** en temps réel sur les anomalies critiques  
✅ **Contrôle** la qualité et la conformité  
✅ **S'intègre** parfaitement avec l'application gaveurs existante  

**Technologies clés** : Next.js 14, FastAPI, TimescaleDB, PySR, Prophet, Blockchain

**Prêt à développer** : Spécifications complètes pour backend + frontend + IA/ML

---

**🏢 Euralis - L'Excellence en Pilotage Multi-Sites 🦆**

*Du gaveur à la coopérative, une vision complète de la filière foie gras*
