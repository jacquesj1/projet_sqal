# 🎛️ Guide Configuration Avancée - Control Panel Docker

## 📋 Vue d'Ensemble

Le Control Panel Docker dispose maintenant de **deux interfaces** :

1. **index-docker.html** - Interface simple (comme avant)
2. **index-docker-advanced.html** - Interface avancée avec configuration ✨ **NOUVEAU**

## 🚀 Utilisation Rapide

### Démarrer l'Interface Avancée

```bash
# Terminal 1: API Docker Control
cd control-panel
python start-docker-api.sh   # ou .bat sur Windows

# Terminal 2: Serveur web
cd control-panel
python -m http.server 8888

# Navigateur - Interface AVANCÉE
http://localhost:8888/index-docker-advanced.html
```

## ⚙️ Nouvelles Fonctionnalités

### 1. **Bouton Configuration** sur Chaque Simulateur

Chaque carte de simulateur a maintenant un bouton **⚙️ Configuration Avancée** qui ouvre un modal de paramétrage.

### 2. **Modal SQAL IoT**

**Paramètres configurables** :
- **Device ID** : Identifiant unique du capteur (ex: `ESP32_DOCKER_01`, `ESP32_LL_02`)
- **Intervalle mesures** : Temps entre chaque mesure (5-300 secondes)
- **Localisation** : Emplacement physique du capteur (ex: `Ligne A - Docker`)
- **Profil de configuration** :
  - Foie gras standard barquette
  - Foie gras premium
  - Foie gras entier

**Actions** :
- **Annuler** : Ferme le modal sans appliquer
- **Appliquer & Redémarrer** : Applique les changements et redémarre le simulateur

### 3. **Modal Gavage CSV (Batch)**

**Paramètres configurables** :
- **Nombre de lots** : 1-1000 lots à générer
- **Nombre de gaveurs** : 1-200 gaveurs dans la simulation
- **Date de début** : Date de début de simulation (format YYYY-MM-DD)

**Actions** :
- **Annuler** : Ferme le modal
- **Appliquer & Générer** : Lance la génération avec les nouveaux paramètres

### 4. **Modal Gavage Temps Réel**

**Paramètres configurables** :
- **Nombre de lots** : 1-10 lots actifs simultanément
- **Accélération temps** :
  - ×1 : Temps réel (24h/jour) - **PRODUCTION**
  - ×144 : Test modéré (10 min/jour)
  - ×1440 : Test rapide (60s/jour) - **DÉFAUT**
  - ×86400 : Démo ultra (1s/jour) - **DEMO**

**Actions** :
- **Annuler** : Ferme le modal
- **Appliquer & Redémarrer** : Applique et redémarre avec nouveaux paramètres

## 🎯 Exemples d'Utilisation

### Scénario 1 : Démo Rapide (2 minutes)

1. Ouvrir le modal **Gavage Temps Réel** (⚙️ Configuration)
2. Paramètres :
   - Lots : **1**
   - Accélération : **×86400** (1 jour = 1 seconde)
3. Cliquer **Appliquer & Redémarrer**
4. Le simulateur simule 12 jours en ~12 secondes

### Scénario 2 : Test Réaliste (30 minutes)

1. Modal **Gavage Temps Réel**
2. Paramètres :
   - Lots : **5**
   - Accélération : **×1440** (1 jour = 60 secondes)
3. Le simulateur simule 5 lots pendant 12 jours chacun en ~12 minutes

### Scénario 3 : Production avec Multiples Capteurs SQAL

1. **Premier capteur** - Modal SQAL :
   - Device ID : `ESP32_LL_01`
   - Intervalle : 30s
   - Localisation : `Ligne A - Landes Lesgor`

2. Dupliquer le service dans docker-compose (créer `simulator-sqal-ligne-b`)

3. **Deuxième capteur** :
   - Device ID : `ESP32_LS_01`
   - Intervalle : 45s
   - Localisation : `Ligne A - Loire Sud`

### Scénario 4 : Génération CSV Massive

1. Modal **Gavage CSV**
2. Paramètres :
   - Lots : **500**
   - Gaveurs : **100**
   - Date début : `2023-01-01`
3. Génère 500 lots historiques pour analyse

## 📊 Affichage des Paramètres Actuels

L'interface affiche **en temps réel** les paramètres actifs dans chaque carte :

**SQAL** :
```
Intervalle: 30s
Device ID: ESP32_DOCKER_01
WebSocket: ws://backend:8000/ws/sensors/
```

**Gavage CSV** :
```
Lots: 100
Gaveurs: 65
Mode: Génération unique (CSV)
```

**Gavage Temps Réel** :
```
Lots: 3
Accélération: 1440× (1 jour = 60s)
WebSocket: ws://backend:8000/ws/gavage
```

## 🔧 Raccourcis Clavier

- **Échap (Escape)** : Ferme tous les modals ouverts
- **Clic en dehors du modal** : Ferme le modal

## 🎨 Interface Visuelle

### Boutons de Contrôle

| Bouton | Couleur | Action |
|--------|---------|--------|
| ▶️ Démarrer | Vert | Lance le simulateur |
| ⏹️ Arrêter | Rouge | Arrête le simulateur |
| 🔄 Redémarrer | Orange | Redémarre |
| 📋 Logs | Bleu | Affiche/masque les logs |
| ⚙️ Configuration | Violet | Ouvre le modal de config |

### Indicateurs de Status

| Icône | Couleur | Signification |
|-------|---------|---------------|
| 🟢 En cours | Vert | Simulateur actif |
| 🔴 Arrêté | Rouge | Simulateur arrêté |
| ⚪ Pas créé | Jaune | Conteneur jamais lancé |

## 💡 Conseils

1. **Tester d'abord avec accélération max** : Utilisez ×86400 pour vérifier que tout fonctionne en quelques secondes

2. **Surveiller les logs** : Cliquez sur 📋 Logs pour voir l'activité en temps réel

3. **Ne pas redémarrer trop souvent** : Attendez que le simulateur soit complètement arrêté avant de redémarrer

4. **Production = ×1** : Pour une simulation réaliste, utilisez accélération ×1 (24h réelles)

5. **Sauvegarder les paramètres** : Notez vos configurations favorites pour les réutiliser

## 🔄 Différences avec l'Interface Simple

| Fonctionnalité | Simple | Avancée |
|----------------|--------|---------|
| Démarrage/Arrêt | ✅ | ✅ |
| Logs en temps réel | ✅ | ✅ |
| Auto-refresh status | ✅ | ✅ |
| **Configuration paramètres** | ❌ | ✅ |
| **Modals interactifs** | ❌ | ✅ |
| **Affichage config actuelle** | ❌ | ✅ |
| **Personnalisation avancée** | ❌ | ✅ |

## 📝 Notes Importantes

1. **Les changements de configuration nécessitent un redémarrage** du simulateur pour être pris en compte

2. **L'API Docker Control doit être lancée** avant d'utiliser l'interface

3. **Les paramètres sont stockés** dans la session du navigateur (localStorage prévu pour version future)

4. **Pour des changements permanents**, modifiez directement [docker-compose.yml](../docker-compose.yml#L283-L306)

## 🆘 Dépannage

**Le modal ne s'ouvre pas** :
- Vérifiez la console navigateur (F12)
- Rechargez la page (Ctrl+R)

**Les paramètres ne sont pas appliqués** :
- Redémarrez le simulateur après avoir cliqué "Appliquer"
- Vérifiez les logs du simulateur

**Erreur "API non accessible"** :
- Lancez `start-docker-api.bat` ou `.sh`
- Vérifiez que le port 8889 n'est pas utilisé

## 🔗 Liens Utiles

- [README Control Panel](README-DOCKER.md)
- [Démarrage Rapide](DEMARRAGE_RAPIDE.md)
- [Docker Compose](../docker-compose.yml)
- [Documentation API](http://localhost:8889/docs) - Swagger UI

---

**Bon paramétrage ! 🎛️**
