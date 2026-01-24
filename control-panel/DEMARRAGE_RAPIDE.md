# 🚀 Démarrage Rapide - Control Panel Docker

## ⚡ En 3 étapes

### Étape 1: Démarrer l'API Docker Control

**Windows** (double-clic):
```
control-panel\start-docker-api.bat
```

Ou en ligne de commande:
```bash
cd control-panel
start-docker-api.bat
```

**Linux/Mac**:
```bash
cd control-panel
chmod +x start-docker-api.sh
./start-docker-api.sh
```

➡️ **Laissez cette fenêtre ouverte** - L'API tourne sur **http://localhost:8889**

---

### Étape 2: Démarrer le serveur web du Control Panel

**Ouvrir un NOUVEAU terminal** et exécuter:

```bash
cd control-panel
python -m http.server 8888
```

➡️ **Laissez aussi cette fenêtre ouverte**

---

### Étape 3: Ouvrir le Control Panel dans le navigateur

**Cliquer sur ce lien**: [http://localhost:8888/index-docker.html](http://localhost:8888/index-docker.html)

Ou copier/coller dans Chrome, Firefox ou Edge:
```
http://localhost:8888/index-docker.html
```

---

## ✅ Vérifications

Vous devriez voir:

1. ✅ **En haut de la page**: "API Docker Control: ✅ Connecté (1.0.0)"
2. 📡 **Carte SQAL**: Avec boutons Démarrer/Arrêter/Logs
3. 🦆 **Carte Gavage**: Avec boutons Générer/Arrêter/Logs

---

## 🎯 Utilisation

### Démarrer le simulateur SQAL

1. Cliquer sur **▶️ Démarrer** dans la carte SQAL
2. Attendre quelques secondes
3. Le status passe à 🟢 **En cours**
4. Les données sont envoyées au backend toutes les 30 secondes

### Voir les logs

1. Cliquer sur **📋 Logs**
2. Les logs s'affichent en dessous
3. Cliquer à nouveau pour masquer

### Arrêter un simulateur

1. Cliquer sur **⏹️ Arrêter**
2. Le status passe à 🔴 **Arrêté**

---

## 🐛 Problèmes?

### "API non accessible"

**L'API n'est pas démarrée**

➡️ Solution: Lancer `start-docker-api.bat` dans un terminal

### "Page introuvable"

**Le serveur web n'est pas démarré**

➡️ Solution: Lancer `python -m http.server 8888` dans control-panel/

### "Erreur lors du démarrage du simulateur"

**Docker n'est pas démarré**

➡️ Solution:
1. Ouvrir Docker Desktop
2. Attendre qu'il soit complètement démarré (icône verte)
3. Réessayer

---

## 📺 Capture d'écran du résultat attendu

```
┌────────────────────────────────────────────────────────────┐
│  🐳 Panneau de Contrôle Docker                            │
│  Simulateurs Gaveurs V3.0                                  │
├────────────────────────────────────────────────────────────┤
│  API Docker Control: ✅ Connecté (1.0.0)                  │
├────────────────────────────────────────────────────────────┤
│  ┌──────────────────────┐  ┌──────────────────────┐      │
│  │ 📡 Simulateur SQAL  │  │ 🦆 Simulateur Gavage │      │
│  │ Capteurs IoT ESP32  │  │ Données de gavage    │      │
│  │ 🟢 En cours         │  │ 🔴 Arrêté            │      │
│  │                     │  │                      │      │
│  │ [▶️ Démarrer]       │  │ [▶️ Générer]         │      │
│  │ [⏹️ Arrêter]        │  │ [⏹️ Arrêter]         │      │
│  │ [🔄 Redémarrer]     │  │ [📋 Logs]            │      │
│  │ [📋 Logs]           │  │                      │      │
│  └──────────────────────┘  └──────────────────────┘      │
└────────────────────────────────────────────────────────────┘
```

---

## 🎉 C'est tout!

Vous pouvez maintenant:
- ✅ Démarrer/arrêter les simulateurs à volonté
- ✅ Voir les logs en temps réel
- ✅ Contrôler Docker depuis une interface web

**Besoin d'aide?** Consultez [README-DOCKER.md](README-DOCKER.md) pour plus de détails.
