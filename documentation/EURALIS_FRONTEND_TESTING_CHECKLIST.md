# Euralis Frontend - Checklist de Test Visuel

**Date**: 09 Janvier 2026

---

## 🎯 Objectif

Valider visuellement que toutes les pages du frontend Euralis s'affichent correctement et que les interactions fonctionnent.

---

## ✅ Checklist de Test

### 🔐 1. Page Login (`/login`)

**URL**: http://localhost:3000/login

**Tests à effectuer**:
- [ ] Page s'affiche correctement
- [ ] Logo Euralis visible
- [ ] Formulaire avec email + password
- [ ] Credentials de test affichés en bas
- [ ] Bouton "Se connecter" présent

**Test connexion**:
- [ ] Entrer `superviseur@euralis.fr` / `super123`
- [ ] Cliquer "Se connecter"
- [ ] Redirection vers `/euralis/dashboard`
- [ ] Token stocké dans localStorage

**Résultat**: ⬜ Pass / ⬜ Fail

---

### 📊 2. Dashboard Principal (`/euralis/dashboard`)

**URL**: http://localhost:3000/euralis/dashboard

**Tests à effectuer**:
- [ ] 4 KPI cards en haut (Production, ITM, Mortalité, Efficacité)
- [ ] Graphique "Production sur 30 jours" visible
- [ ] Graphique "Comparaison ITM par site" visible
- [ ] Section "Dernières alertes" en bas
- [ ] Bouton "Rafraîchir" fonctionne
- [ ] Navigation vers "Sites" fonctionne

**Résultat**: ⬜ Pass / ⬜ Fail

---

### 🏭 3. Liste des Sites (`/euralis/sites`)

**URL**: http://localhost:3000/euralis/sites

**Tests à effectuer**:
- [ ] Titre "Sites Euralis" affiché
- [ ] 3 cartes sites (LL, LS, MT)
- [ ] Chaque carte affiche:
  - [ ] Code site + nom (ex: LL - Bretagne)
  - [ ] Nombre lots actifs
  - [ ] ITM moyen
  - [ ] Taux mortalité
- [ ] Boutons "Voir détails" présents
- [ ] Boutons "Gaveurs" et "Lots" présents

**Test navigation**:
- [ ] Cliquer "Voir détails" sur site LL → redirige vers `/euralis/sites/LL`

**Résultat**: ⬜ Pass / ⬜ Fail

---

### 🔍 4. Détails Site (`/euralis/sites/[code]`)

**URL**: http://localhost:3000/euralis/sites/LL

**Tests à effectuer**:
- [ ] Breadcrumb "Sites > LL - Bretagne" affiché
- [ ] Titre "Site LL - Bretagne"
- [ ] Bouton "Retour aux sites" fonctionne
- [ ] Section "Vue d'ensemble" avec stats
- [ ] Section "Lots récents" avec tableau
- [ ] Boutons "Gaveurs" et "Lots" dans header

**Test navigation**:
- [ ] Cliquer "Gaveurs" → redirige vers `/euralis/sites/LL/gaveurs`
- [ ] Cliquer "Lots" → redirige vers `/euralis/sites/LL/lots`
- [ ] Cliquer breadcrumb "Sites" → retour liste sites

**Résultat**: ⬜ Pass / ⬜ Fail

---

### 👥 5. Gaveurs d'un Site (`/euralis/sites/[code]/gaveurs`)

**URL**: http://localhost:3000/euralis/sites/LL/gaveurs

**Tests à effectuer**:
- [ ] Breadcrumb "Sites > LL - Bretagne > Gaveurs"
- [ ] Titre "Gaveurs du site LL - Bretagne"
- [ ] Nombre gaveurs affiché (ex: "2 gaveurs actifs")
- [ ] Grille de cartes gaveurs
- [ ] Chaque carte affiche:
  - [ ] Avatar avec initiales (cercle bleu)
  - [ ] Nom + prénom
  - [ ] Gaveur ID
  - [ ] Email (icône enveloppe)
  - [ ] Téléphone (icône téléphone) ou "N/A"
  - [ ] Site origine (icône pin)
  - [ ] Nombre lots gérés
  - [ ] Bouton "Voir le profil →"
- [ ] Section stats globales en bas (total lots gérés)
- [ ] Bouton "Retour aux sites" fonctionne

**Test navigation**:
- [ ] Cliquer "Voir le profil" → redirige vers `/euralis/gaveurs/{id}`
- [ ] Cliquer breadcrumb "LL - Bretagne" → retour détails site

**Résultat**: ⬜ Pass / ⬜ Fail

---

### 📦 6. Lots d'un Site (`/euralis/sites/[code]/lots`)

**URL**: http://localhost:3000/euralis/sites/LL/lots

**Tests à effectuer**:
- [ ] Breadcrumb "Sites > LL - Bretagne > Lots"
- [ ] Titre "Lots du site LL - Bretagne"
- [ ] Nombre lots affiché (ex: "X lots au total")
- [ ] Filtres rapides (Tous, En cours, Terminés)
- [ ] Tableau avec colonnes:
  - [ ] Code Lot
  - [ ] Gaveur ID
  - [ ] Souche
  - [ ] Début Gavage
  - [ ] Durée (jours)
  - [ ] ITM
  - [ ] Statut (badge coloré)
  - [ ] Actions ("Voir détails →")
- [ ] Stats rapides en bas:
  - [ ] ITM Moyen
  - [ ] Durée Moyenne
  - [ ] Perte Moyenne
  - [ ] Gaveurs Actifs
- [ ] Bouton "Retour aux sites" fonctionne

**Test navigation**:
- [ ] Cliquer "Voir détails" → redirige vers `/euralis/lots/{id}`
- [ ] Filtres statut cliquables (affichent nombre)

**Résultat**: ⬜ Pass / ⬜ Fail

---

### 📋 7. Détails d'un Lot (`/euralis/lots/[id]`)

**URL**: http://localhost:3000/euralis/lots/122

**Tests à effectuer**:
- [ ] Breadcrumb "Sites > Lots > {code_lot}"
- [ ] Titre "Lot {code_lot}"
- [ ] Section "Informations générales" avec:
  - [ ] Code lot
  - [ ] Site
  - [ ] Gaveur ID
  - [ ] Souche
  - [ ] Début gavage
  - [ ] Statut (badge)
- [ ] Section "Statistiques de performance" avec:
  - [ ] ITM
  - [ ] Durée gavage
  - [ ] Perte gavage
  - [ ] Sigma
- [ ] Section "Historique des doses" avec:
  - [ ] Message "Aucune donnée disponible" si vide
  - [ ] OU graphique + tableau si données présentes
- [ ] Bouton "Retour" fonctionne

**Test avec lot ayant des données** (lot 3468):
- [ ] Accéder à http://localhost:3000/euralis/lots/3468
- [ ] Vérifier que le tableau de doses s'affiche
- [ ] Vérifier que le graphique s'affiche (si implémenté)

**Résultat**: ⬜ Pass / ⬜ Fail

---

## 🔄 Tests Auto-Refresh

### Dashboard Auto-Refresh (30s)

**Test**:
1. Ouvrir `/euralis/dashboard`
2. Noter la valeur d'un KPI
3. Modifier une donnée dans la DB (optionnel)
4. Attendre 30 secondes
5. Vérifier que les KPIs se rafraîchissent automatiquement

**Résultat**: ⬜ Pass / ⬜ Fail

---

## 🎨 Tests Design

### Responsive Design

**Tests à effectuer** (pour chaque page):
- [ ] Desktop (>1024px) - layout optimal
- [ ] Tablet (768-1024px) - grilles adaptées
- [ ] Mobile (<768px) - stacking vertical

**Résultat**: ⬜ Pass / ⬜ Fail

---

### Couleurs par Site

**Vérifier que les couleurs correspondent**:
- [ ] Site LL (Bretagne) → Orange
- [ ] Site LS (Pays de Loire) → Vert
- [ ] Site MT (Maubourguet) → Bleu

**Résultat**: ⬜ Pass / ⬜ Fail

---

### Badges Statut

**Vérifier les badges lots**:
- [ ] `en_cours` → Badge vert
- [ ] `en_gavage` → Badge bleu
- [ ] `termine` → Badge gris
- [ ] `planifie` → Badge jaune

**Résultat**: ⬜ Pass / ⬜ Fail

---

## 🐛 Tests Erreurs

### Page Lot Inexistant

**Test**:
1. Accéder à http://localhost:3000/euralis/lots/99999
2. Vérifier message d'erreur approprié

**Résultat attendu**: Erreur 404 ou message "Lot non trouvé"

**Résultat**: ⬜ Pass / ⬜ Fail

---

### Page Lot Sans Données (Bug Corrigé)

**Test**:
1. Accéder à http://localhost:3000/euralis/lots/122
2. Vérifier que la page s'affiche (pas d'erreur 404)
3. Vérifier message "Aucune donnée disponible" dans section historique

**Résultat attendu**: Page s'affiche avec message approprié

**Résultat**: ⬜ Pass / ⬜ Fail

---

### Backend Déconnecté

**Test**:
1. Arrêter le backend: `docker-compose stop backend`
2. Rafraîchir le dashboard
3. Vérifier message d'erreur réseau

**Résultat attendu**: Message "Impossible de charger les données"

**Résultat**: ⬜ Pass / ⬜ Fail

**Cleanup**: Redémarrer backend: `docker-compose start backend`

---

## 📊 Résumé des Tests

| Page | Tests Passés | Tests Échoués | Status |
|------|--------------|---------------|--------|
| Login | ⬜ / 5 | ⬜ | ⬜ |
| Dashboard | ⬜ / 6 | ⬜ | ⬜ |
| Sites | ⬜ / 6 | ⬜ | ⬜ |
| Détails Site | ⬜ / 7 | ⬜ | ⬜ |
| Gaveurs Site | ⬜ / 12 | ⬜ | ⬜ |
| Lots Site | ⬜ / 12 | ⬜ | ⬜ |
| Détails Lot | ⬜ / 10 | ⬜ | ⬜ |
| **TOTAL** | **⬜ / 58** | **⬜** | **⬜** |

---

## 🚀 Comment Exécuter

### 1. Démarrer Backend

```bash
docker-compose up -d backend timescaledb
# Attendre que le backend soit prêt
curl http://localhost:8000/health
```

### 2. Démarrer Frontend

```bash
cd euralis-frontend
npm run dev
```

### 3. Ouvrir Navigateur

```
http://localhost:3000/login
```

### 4. Se Connecter

```
Email: superviseur@euralis.fr
Password: super123
```

### 5. Tester Chaque Page

Suivre la checklist ci-dessus dans l'ordre.

---

## 📝 Notes de Test

### Session de Test 1

**Date**: ___________
**Testeur**: ___________

**Notes**:
```
[Espace pour notes libres]
```

**Bugs trouvés**:
- [ ] Bug 1: ___________
- [ ] Bug 2: ___________
- [ ] Bug 3: ___________

**Suggestions**:
- [ ] ___________
- [ ] ___________
- [ ] ___________

---

## ✅ Critères de Validation

Pour considérer le frontend **Production Ready**, tous les critères suivants doivent être validés:

- [ ] **100% des tests passent** (58/58)
- [ ] **Aucune erreur console** dans le navigateur
- [ ] **Responsive fonctionne** sur 3 tailles d'écran
- [ ] **Auto-refresh fonctionne** sur dashboard
- [ ] **Navigation complète** (toutes les pages accessibles)
- [ ] **Gestion erreurs** appropriée (404, erreurs réseau)
- [ ] **Performance acceptable** (<2s chargement page)

---

**Conclusion**: Une fois cette checklist validée à 100%, le frontend Euralis Phase 1 sera officiellement **Production Ready**.

**Auteur**: Claude Code
**Date**: 09 Janvier 2026
**Version**: 1.0
