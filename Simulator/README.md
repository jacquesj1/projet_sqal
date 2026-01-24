# 🦆 Simulateur de Données de Gavage Réaliste

Générateur de données synthétiques de gavage basé sur les statistiques réelles de `Pretraite_End_2024_claude.csv`.

---

## 📋 Vue d'ensemble

Ce simulateur génère des données réalistes pour :
- **Lots de gavage** avec 174 colonnes (compatible avec schéma CSV Euralis)
- **65 gaveurs** répartis sur 3 sites (LL, LS, MT)
- **27 jours de doses journalières** par lot
- **Distributions statistiques** calibrées sur données réelles

---

## 🚀 Installation

```bash
# Installer dépendances Python
pip install pandas numpy

# Vérifier installation
python gavage_data_simulator.py --help
```

---

## 📊 Usage

### Génération simple (valeurs par défaut)

```bash
python gavage_data_simulator.py
```

Génère :
- **100 lots**
- **65 gaveurs**
- Fichier de sortie : `simulated_gavage_data.csv`

### Génération personnalisée

```bash
python gavage_data_simulator.py \
    --nb-lots 500 \
    --nb-gaveurs 80 \
    --output mes_donnees_2024.csv \
    --start-date 2024-01-01
```

### Calibrage sur données réelles

Pour calibrer les distributions sur vos données réelles :

```bash
python gavage_data_simulator.py \
    --reference /chemin/vers/Pretraite_End_2024_claude.csv \
    --nb-lots 200 \
    --output simulated_calibrated.csv
```

⚠️ **Important** : Le fichier référence doit avoir le format CSV Euralis (séparateur `;`, encoding `latin-1`)

---

## 🎛️ Options

| Option | Type | Défaut | Description |
|--------|------|--------|-------------|
| `--nb-lots` | int | 100 | Nombre de lots à générer |
| `--nb-gaveurs` | int | 65 | Nombre de gaveurs (répartis sur 3 sites) |
| `--output` | str | `simulated_gavage_data.csv` | Fichier CSV de sortie |
| `--reference` | str | None | CSV de référence pour calibrer distributions |
| `--start-date` | str | `2024-01-01` | Date de début (format YYYY-MM-DD) |

---

## 📈 Statistiques Générées

### Distributions par défaut

| Métrique | Moyenne | Écart type | Min | Max |
|----------|---------|------------|-----|-----|
| **ITM** (kg) | 14.97 | 2.0 | 10 | 20 |
| **Sigma** | 2.1 | 0.5 | 1.0 | 4.0 |
| **Mortalité** (%) | 3.2 | 2.0 | 0 | 12 |
| **Durée gavage** (j) | 10.2 | 1.5 | 8 | 14 |
| **Nb canards** | 800 | 300 | 400 | 1500 |
| **Dose initiale** (g) | 200 | 20 | 150 | 250 |
| **Dose finale** (g) | 490 | 30 | 400 | 550 |

### Niveaux de performance gaveurs

Le simulateur génère 5 niveaux de gaveurs :

| Niveau | % gaveurs | Multiplicateur ITM | Mortalité |
|--------|-----------|-------------------|-----------|
| Excellent | 20% | +15% | -15% |
| Très bon | 25% | +5% | -5% |
| Bon | 30% | 0% | 0% |
| Moyen | 15% | -5% | +5% |
| Faible | 10% | -15% | +15% |

---

## 📂 Format de Sortie

Le fichier CSV généré contient **174 colonnes** :

### Colonnes principales

- **CodeLot** : Code unique du lot (ex: `LL4801001`)
- **Debut_du_lot** : Date de début (format DD/MM/YYYY)
- **duree_gavage** : Durée réelle (8-14 jours)
- **Gaveur** : Nom complet du gaveur
- **Souche** : Type de canard (3 souches)
- **GEO** : Site (BRETAGNE, PAYS DE LA LOIRE, MAUBOURGUET)

### Métriques performance

- **ITM** : Indice Technique Moyen (kg foie/canard)
- **Sigma** : Écart type poids foies (homogénéité)
- **dPctgPerteGav** : Mortalité (%)

### Canards

- **Nb_MEG** : Nombre mise en gavage
- **Nombre_enleve** : Canards enlevés
- **Quantite_accrochee** : Canards abattus

### Doses journalières (27 jours × 5 colonnes)

Pour chaque jour (1 à 27) :
- **feedTarget_X** : Dose théorique (g)
- **feedCornReal_X** : Dose réelle (g)
- **corn_variation_X** : Écart (g)
- **cumulCorn_X** : Cumul total (g)
- **delta_feed_X** : Variation par rapport à J-1 (g)

### Informations gaveur

- **Civilite**, **RaisonSociale**, **NomUsage**
- **Adresse1**, **Adresse2**, **CodePostal**, **Commune**
- **Telephone1**, **Email**

### Totaux

- **total_cornTarget** : Total doses théoriques
- **total_cornReal** : Total doses réelles

---

## 🔬 Algorithme de Simulation

### 1. Génération des gaveurs

```python
# 65 gaveurs répartis aléatoirement sur 3 sites
# Noms français réalistes (30 prénoms × 30 noms)
# 5 niveaux de performance
```

### 2. Génération d'un lot

```python
# Durée : Distribution normale centrée sur 10 jours (8-14)
# ITM : Ajusté selon performance gaveur
# Mortalité : Inversement corrélée à la performance
# Sigma : Distribution normale (1.0-4.0)
```

### 3. Doses journalières

```python
# Progression linéaire : ~200g (J1) → ~490g (J_final)
# Variation réelle : ±5% selon performance
# Cumul : Somme progressive des doses réelles
```

### 4. Réalisme

- **Corrélations** : ITM ↔ performance, Mortalité ↔ performance
- **Variations** : Bruit gaussien sur doses journalières
- **Contraintes** : Respect min/max pour toutes métriques

---

## 📊 Exemples de Données Générées

### Lot type (Excellent gaveur)

```
CodeLot: LL4801001
Gaveur: Jean Martin
Site: BRETAGNE (LL)
ITM: 17.2 kg (↑ +15% vs moyenne)
Sigma: 1.9 (homogène)
Mortalité: 2.1% (↓ -15% vs moyenne)
Durée: 11 jours
Canards: 950 MEG → 930 accrochés
Doses: 205g (J1) → 498g (J11)
```

### Lot type (Faible gaveur)

```
CodeLot: MT4802134
Gaveur: Sophie Dubois
Site: MAUBOURGUET (MT)
ITM: 12.8 kg (↓ -15% vs moyenne)
Sigma: 2.6 (hétérogène)
Mortalité: 5.8% (↑ +15% vs moyenne)
Durée: 9 jours
Canards: 650 MEG → 612 accrochés
Doses: 195g (J1) → 475g (J9)
```

---

## 🧪 Import dans TimescaleDB

Une fois le fichier généré, importez-le dans la base de données :

```bash
# Copier le fichier simulé
cp simulated_gavage_data.csv /chemin/vers/projet/

# Importer dans DB
cd gaveurs-v3/gaveurs-ai-blockchain/backend

python scripts/import_euralis_data.py /chemin/vers/simulated_gavage_data.csv
```

Vérification :

```sql
-- Connexion DB
psql -U postgres -d gaveurs_db

-- Vérifier import
SELECT COUNT(*) FROM lots_gavage;
SELECT COUNT(*) FROM doses_journalieres;

-- Rafraîchir vue matérialisée
SELECT refresh_performances_sites();

-- Vérifier performances
SELECT * FROM performances_sites;
```

---

## 🎯 Cas d'Usage

### 1. Tests de charge

```bash
# Générer 10 000 lots pour tester scalabilité
python gavage_data_simulator.py --nb-lots 10000 --nb-gaveurs 100
```

### 2. Démo clients

```bash
# Données réalistes pour présentation
python gavage_data_simulator.py --nb-lots 500 --start-date 2024-01-01
```

### 3. Formation modèles IA/ML

```bash
# Dataset large pour entraîner Prophet, PySR, etc.
python gavage_data_simulator.py --nb-lots 5000 --reference Pretraite_End_2024_claude.csv
```

### 4. Tests d'anomalies

```bash
# Générer avec référence pour tester détection anomalies
python gavage_data_simulator.py --nb-lots 1000 --reference Pretraite_End_2024_claude.csv
```

---

## 🔍 Validation des Données

Le simulateur affiche un rapport de validation :

```
🦆 Génération de 100 lots pour 65 gaveurs
======================================================================
👨‍🌾 Génération de 65 gaveurs...
   ✅ 65 gaveurs créés
      LL: 23 gaveurs
      LS: 19 gaveurs
      MT: 23 gaveurs

📦 Génération de 100 lots...
   10/100 lots générés...
   20/100 lots générés...
   ...
   ✅ 100 lots créés

📊 Statistiques générées :
   ITM moyen : 15.03 ± 2.12 kg
   Sigma moyen : 2.08 ± 0.51
   Mortalité moyenne : 3.18%
   Durée moyenne : 10.1 jours

   Lots par site :
      LL: 34 lots (34.0%)
      LS: 31 lots (31.0%)
      MT: 35 lots (35.0%)

✅ Données sauvegardées : simulated_gavage_data.csv
   100 lots
   174 colonnes
```

---

## 🐛 Résolution de Problèmes

### Erreur : `ModuleNotFoundError: No module named 'pandas'`

```bash
pip install pandas numpy
```

### Erreur : `FileNotFoundError` (fichier référence)

Vérifiez le chemin du fichier `--reference` :

```bash
# Chemin absolu recommandé
python gavage_data_simulator.py --reference /chemin/absolu/vers/Pretraite_End_2024_claude.csv
```

### Warning : Statistiques incohérentes

Si vous utilisez `--reference` et obtenez des warnings :

1. Vérifiez le format CSV (séparateur `;`, encoding `latin-1`)
2. Vérifiez les colonnes requises : `ITM`, `Sigma`, `dPctgPerteGav`, `duree_gavage`, `Nb_MEG`

---

## 📝 Limitations

- **Dates** : Les lots sont espacés de 1-4 jours aléatoirement
- **Sites** : Répartition aléatoire (pas de contrainte capacité)
- **Souches** : 3 souches prédéfinies (distribution uniforme)
- **Gaveurs** : Noms génériques français (pas de données personnelles réelles)

---

## 🚀 Améliorations Futures

- [ ] Support multi-années avec saisonnalité
- [ ] Corrélations souche × site
- [ ] Simulation d'anomalies contrôlées
- [ ] Export multi-format (JSON, Parquet, SQL)
- [ ] Interface graphique (streamlit)

---

## 📞 Support

Pour toute question ou bug :

1. Vérifier la documentation ci-dessus
2. Consulter `gavage_data_simulator.py --help`
3. Vérifier les logs d'erreur Python

---

**Version** : 1.0.0
**Date** : 14 Décembre 2024
**Auteur** : Système Euralis Multi-Sites
**Licence** : Usage interne Euralis
