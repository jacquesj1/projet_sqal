# ⚡ Démo Auto-Enchaînée - Guide Complet

## 🎯 Objectif

La **Démo Auto-Enchaînée** permet de lancer une démonstration complète de la boucle fermée Gaveurs V3.0 en **un seul clic**, avec **configuration centralisée** de tous les paramètres.

Au lieu de cliquer manuellement sur 4 boutons différents (Gavage → Monitor → SQAL → Consommateurs), tout s'enchaîne automatiquement.

---

## ✨ Fonctionnalités

### 🎬 Flux Automatique

```
1. USER clique "⚡ Démo Auto-Enchaînée"
   ↓
2. Configure TOUS les paramètres dans une modale
   ↓
3. Clic "🚀 Lancer Démo Complète"
   ↓
4. GAVAGE démarre (14 jours accélérés)
   ↓
5. MONITOR détecte fin de lot (polling automatique)
   ↓
6. SQAL lance automatiquement (inspection qualité)
   ↓
7. CONSOMMATEURS démarre automatiquement (feedbacks)
   ↓
8. Récap final affiché dans les logs
```

### 📊 Configuration Centralisée

Tous les paramètres configurables en une seule fois :

**GAVAGE** :
- Nombre de lots (1-10)
- Accélération temps (×1440 ou ×86400)

**SQAL** :
- Device ID (ESP32_DEMO_01)
- Nombre d'échantillons par lot (1-50)
- Intervalle mesures (1-60 secondes)

**CONSOMMATEURS** :
- Nombre de feedbacks (1-100)
- Intervalle feedbacks (1-60 secondes)
- Profil distribution (Réaliste, Optimiste, Pessimiste)

**OPTIONS** :
- ✅ Activer Monitor automatique
- ✅ Afficher logs détaillés

---

## 🚀 Comment Utiliser

### Étape 1 : Préparer l'Environnement

**Pré-requis** :
```bash
# 1. Backend Docker actif
docker-compose up -d timescaledb redis backend

# 2. Vérifier santé
curl http://localhost:8000/health
# Doit retourner: {"status":"healthy"...}

# 3. Ouvrir Control Panel
# Double-clic sur: control-panel/index.html
```

**Ouvrir les Frontends** (optionnel mais recommandé) :
```bash
# Terminal 1 : SQAL
cd sqal
npm run dev
# → http://localhost:5173

# Terminal 2 : Euralis
cd euralis-frontend
npm run dev
# → http://localhost:3000/euralis/dashboard

# Terminal 3 : Gaveurs
cd gaveurs-v3/gaveurs-ai-blockchain/frontend
npm run dev
# → http://localhost:3001
```

---

### Étape 2 : Lancer la Démo Auto-Enchaînée

#### Dans le Control Panel :

1. **Cliquer sur "⚡ Démo Auto-Enchaînée (3 min)"**

2. **Modale s'ouvre** avec configuration par défaut :
   ```
   GAVAGE:
   - Lots: 1
   - Accélération: ×86400 (1s/jour → 14s pour J14)

   SQAL:
   - Device: ESP32_DEMO_01
   - Échantillons: 10
   - Intervalle: 3s

   CONSOMMATEURS:
   - Feedbacks: 20
   - Intervalle: 5s
   - Profil: Réaliste
   ```

3. **Modifier si nécessaire** (ou laisser par défaut)

4. **Cliquer "🚀 Lancer Démo Complète"**

---

### Étape 3 : Observer l'Enchaînement

#### Dans le Control Panel - Logs

**Logs Gavage** :
```
[17:20:00] ⚡ ========================================
[17:20:00] ⚡ DÉMARRAGE DÉMO AUTO-ENCHAÎNÉE
[17:20:00] ⚡ ========================================
[17:20:00] 🚀 ÉTAPE 1/4: Démarrage simulateur gavage
[17:20:00] 📦 1 lots, accélération ×86400
[17:20:01] ✅ Gavage démarré - En attente fin J14...
[17:20:01] ⏱️ Temps estimé jusqu'à J14: 14s
[17:20:15] ✅ Lot terminé détecté: LL_AUTO_001
```

**Logs Monitor** :
```
[17:20:02] 🚀 ÉTAPE 2/4: Démarrage Monitor automatique
[17:20:02] 🔍 Polling actif pour détecter lots terminés
[17:20:02] ✅ Monitor actif - Détection lots...
[17:20:15] 📦 Lot LL_AUTO_001 détecté par Monitor
```

**Logs SQAL** :
```
[17:20:17] 🚀 ÉTAPE 3/4: Démarrage SQAL automatique
[17:20:17] 🔬 Inspection lot: LL_AUTO_001
[17:20:17] ✅ SQAL démarré - 10 échantillons à 3s
[17:20:17] ⏱️ Durée estimée: 30s
[17:20:20] 🔬 Mesure #1: Grade A+ (97.2)
[17:20:23] 🔬 Mesure #2: Grade A (89.4)
...
[17:20:47] 🔬 Mesure #10: Grade A+ (96.8)
```

**Logs Consommateurs** :
```
[17:20:49] 🚀 ÉTAPE 4/4: Démarrage Simulateur Consommateurs
[17:20:49] 👥 Génération feedbacks automatiques
[17:20:49] ✅ Simulateur démarré - 20 feedbacks à 5s
[17:20:49] ⏱️ Durée estimée: 100s
[17:20:54] 😊 Feedback #1: 5/5 (Moy: 5.0)
[17:20:59] 😊 Feedback #2: 4/5 (Moy: 4.5)
...
[17:22:29] 😊 Feedback #20: 4/5 (Moy: 4.1)
```

**Logs Final** :
```
[17:22:31] 🎉 ========================================
[17:22:31] 🎉 DÉMO AUTO-ENCHAÎNÉE TERMINÉE !
[17:22:31] 🎉 ========================================
```

---

### Étape 4 : Vérifier les Frontends

#### Frontend SQAL (http://localhost:5173)

- ✅ 10 échantillons affichés dans le tableau
- ✅ Grades A+, A, B visibles
- ✅ QR codes générés pour chaque échantillon

#### Frontend Euralis (http://localhost:3000/euralis/dashboard)

- ✅ Site LL mis à jour avec nouveau lot
- ✅ Statistiques production actualisées
- ✅ Feed d'activité affiche gavages temps réel

#### Frontend Gaveurs (http://localhost:3001)

- ✅ Courbes de poids se dessinent
- ✅ Indicateurs sanitaires mis à jour
- ✅ WebSocket temps réel actif

---

## ⏱️ Durée Estimée

Avec configuration par défaut :

| Étape | Durée |
|-------|-------|
| Gavage (14 jours ×86400) | **~14 secondes** |
| Monitor détection | **~2 secondes** |
| SQAL (10 échantillons × 3s) | **~30 secondes** |
| Consommateurs (20 feedbacks × 5s) | **~100 secondes** |
| **TOTAL** | **~2min 30s** |

---

## 🎛️ Configurations Recommandées

### 1. **Démo Ultra-Rapide (1 min)**

Pour présentation commerciale rapide :

```
GAVAGE:
- Lots: 1
- Accélération: ×86400

SQAL:
- Échantillons: 5
- Intervalle: 2s

CONSOMMATEURS:
- Feedbacks: 10
- Intervalle: 3s
```

**Durée totale** : ~1 minute

---

### 2. **Démo Standard (3 min)**

Configuration par défaut, équilibrée :

```
GAVAGE:
- Lots: 1
- Accélération: ×86400

SQAL:
- Échantillons: 10
- Intervalle: 3s

CONSOMMATEURS:
- Feedbacks: 20
- Intervalle: 5s
```

**Durée totale** : ~2min 30s

---

### 3. **Démo Détaillée (5 min)**

Pour démonstration approfondie :

```
GAVAGE:
- Lots: 1
- Accélération: ×86400

SQAL:
- Échantillons: 20
- Intervalle: 5s

CONSOMMATEURS:
- Feedbacks: 50
- Intervalle: 3s
```

**Durée totale** : ~5 minutes

---

### 4. **Test Réaliste (15 min)**

Avec plusieurs lots :

```
GAVAGE:
- Lots: 3
- Accélération: ×1440 (60s/jour)

SQAL:
- Échantillons: 10
- Intervalle: 10s

CONSOMMATEURS:
- Feedbacks: 30
- Intervalle: 10s
```

**Durée totale** : ~15 minutes

---

## 🔧 Troubleshooting

### Problème 1 : Gavage ne démarre pas

**Symptômes** :
```
[17:20:00] ❌ Erreur: Échec démarrage gavage
```

**Solutions** :
1. Vérifier backend actif : `curl http://localhost:8000/health`
2. Vérifier logs Docker : `docker logs gaveurs_backend`
3. Redémarrer backend : `docker-compose restart backend`

---

### Problème 2 : SQAL ne se lance pas automatiquement

**Symptômes** : Monitor détecte le lot mais SQAL ne démarre pas

**Causes possibles** :
- API control/sqal/start non disponible
- Device ID invalide

**Solutions** :
1. Vérifier endpoint : `curl http://localhost:8000/api/control/sqal/start -X POST`
2. Changer Device ID dans modale
3. Vérifier logs backend pour erreurs

---

### Problème 3 : Consommateurs - "Aucun QR code disponible"

**Symptômes** :
```
[17:22:00] ❌ Erreur: Échec démarrage
[17:22:00] 💡 Vérifiez que des QR codes ont été générés par SQAL
```

**Cause** : SQAL n'a pas généré de QR codes

**Solutions** :
1. Attendre que SQAL termine complètement
2. Vérifier table `consumer_products` :
   ```bash
   docker exec gaveurs_timescaledb psql -U gaveurs_admin -d gaveurs_db \
     -c "SELECT COUNT(*) FROM consumer_products WHERE qr_code IS NOT NULL"
   ```
3. Relancer SQAL manuellement si besoin

---

### Problème 4 : Timeout atteint

**Symptômes** :
```
[17:20:30] ⚠️ Timeout atteint - Force trigger SQAL
```

**Cause** : Le lot n'a pas été détecté dans le temps imparti

**Solutions** :
- Normal en mode ×86400 (démarre quand même)
- Si répété : vérifier API monitor/status
- Augmenter durée gavage si accélération faible

---

## 🆚 Comparaison Modes

| Critère | Mode Manuel | Mode Auto-Enchaîné |
|---------|-------------|-------------------|
| **Clics requis** | 4 boutons | 1 bouton |
| **Configuration** | 4 panneaux séparés | 1 modale centralisée |
| **Timing** | Manuel (risque oubli) | Automatique |
| **Démo commerciale** | ⚠️ Risque erreur | ✅ Fluide |
| **Flexibilité** | ✅ Contrôle total | ⚠️ Séquence fixe |
| **Recommandé pour** | Tests/Debug | Démonstrations |

---

## 📋 Checklist Avant Démo

- [ ] Backend Docker actif (`docker ps`)
- [ ] Health check OK (`curl http://localhost:8000/health`)
- [ ] Frontends lancés (SQAL, Euralis, Gaveurs)
- [ ] Control Panel ouvert (`control-panel/index.html`)
- [ ] Tables DB initialisées (`consumer_products` existe)
- [ ] Configuration modale vérifiée
- [ ] Logs Control Panel visibles

---

## 🎤 Script Commercial (3 Minutes)

### Slide 1 : Introduction (30s)
> "Bonjour, je vais vous montrer **le premier système au monde** qui optimise la production de foie gras basée sur la **satisfaction réelle des consommateurs**.
>
> Vous voyez ici 4 interfaces : le Control Panel pour piloter, et 3 frontends (Gaveurs, Euralis, SQAL)."

### Slide 2 : Lancement (10s)
> "Je clique sur **'Démo Auto-Enchaînée'**. Regardez : je configure **TOUT en une fois** - gavage, qualité, consommateurs."
>
> *[Montrer modale]*
>
> "Je clique **'Lancer'**. Tout s'enchaîne automatiquement."

### Slide 3 : Gavage (30s)
> "Regardez le Control Panel : le simulateur gavage démarre. Regardez le **Frontend Euralis** : le site LL s'actualise en temps réel.
>
> Chaque gavage matin/soir apparaît dans le feed. Le Monitor détecte automatiquement le lot terminé."

### Slide 4 : SQAL (30s)
> "SQAL lance automatiquement. Basculez sur le **Frontend SQAL** : vous voyez les capteurs IoT en action.
>
> Texture mesurée par ToF 8×8, composition par spectral 10 canaux. Grades A+, A, B apparaissent. Pour chaque échantillon : **QR code blockchain** généré."

### Slide 5 : Consommateurs (30s)
> "Le simulateur consommateurs démarre automatiquement. Regardez : note 5/5, 4/5, 3/5... Note moyenne 4.1/5.
>
> **C'est la boucle fermée** : satisfaction client → optimisation gavage."

### Slide 6 : Conclusion (20s)
> "En **3 minutes**, vous avez vu **la chaîne complète** :
> - Gavage temps réel
> - Supervision multi-sites
> - Contrôle qualité IoT
> - Feedback consommateur
> - Optimisation IA
>
> Tout **automatique**, tout **temps réel**, tout **traçable blockchain**."

---

## 📊 Métriques de Succès

Après une démo auto-enchaînée réussie, vérifier :

```bash
# 1. Lots créés
docker exec gaveurs_timescaledb psql -U gaveurs_admin -d gaveurs_db \
  -c "SELECT COUNT(*) FROM lots_gavage WHERE code_lot LIKE 'LL_AUTO_%'"
# Attendu: 1 (ou plus si multi-lots)

# 2. Gavages enregistrés
docker exec gaveurs_timescaledb psql -U gaveurs_admin -d gaveurs_db \
  -c "SELECT COUNT(*) FROM gavage_data"
# Attendu: ~28 (14 jours × 2 gavages/jour)

# 3. Échantillons SQAL
docker exec gaveurs_timescaledb psql -U gaveurs_admin -d gaveurs_db \
  -c "SELECT COUNT(*) FROM sqal_sensor_samples"
# Attendu: 10 (config par défaut)

# 4. QR codes générés
docker exec gaveurs_timescaledb psql -U gaveurs_admin -d gaveurs_db \
  -c "SELECT COUNT(*) FROM consumer_products WHERE qr_code IS NOT NULL"
# Attendu: 10

# 5. Feedbacks consommateurs
docker exec gaveurs_timescaledb psql -U gaveurs_admin -d gaveurs_db \
  -c "SELECT COUNT(*) FROM consumer_feedbacks"
# Attendu: 20 (config par défaut)
```

---

## 🔄 Différence avec "Démo Rapide"

| Fonctionnalité | Démo Rapide (Ancien) | Démo Auto-Enchaînée (Nouveau) |
|----------------|----------------------|-------------------------------|
| **Configuration** | Pré-définie, non modifiable | ✅ Modale paramétrable |
| **Enchaînement** | Gavage + Monitor uniquement | ✅ Gavage → Monitor → SQAL → Consommateurs |
| **SQAL** | ❌ Manuel | ✅ Automatique |
| **Consommateurs** | ❌ Manuel | ✅ Automatique |
| **Durée** | ~2 minutes | ~3 minutes |
| **Usage** | Test rapide | **Démo commerciale complète** |

---

**Date** : 27 décembre 2025
**Version** : 1.0.0
**Auteur** : Claude Code
**Type** : Guide utilisateur + documentation technique
