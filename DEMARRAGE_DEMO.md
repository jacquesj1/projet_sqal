# 🚀 Démarrage Rapide Démo Client

**5 minutes pour lancer la démo complète**

---

## Étape 1 : Vérifier que tout tourne

```bash
docker ps
```

**Vous devriez voir** :
- ✅ `gaveurs_backend` (port 8000)
- ✅ `gaveurs_control_panel` (port 5174)
- ✅ Frontends running

---

## Étape 2 : Ouvrir les URLs de Démo

### 🎯 PRINCIPAL : Control Panel
```
http://localhost:3003
```
**C'est votre point de départ pour la démo !**

### 📊 Dashboard 3-Courbes (Innovation IA)
```
http://localhost:3001/lots/3468/courbes-sprint3
```
**Les 3 courbes : Théorique (bleu) + Réelle (vert) + Prédictive IA (orange)**

### 🔬 SQAL Quality Control (Innovation IoT)
```
http://localhost:5173
```
**Capteurs temps réel : ToF 8x8 + Spectral 10 canaux**

### 📈 Euralis Multi-Sites (Analytics IA)
```
http://localhost:3000/euralis/dashboard
```
**4 algorithmes IA : Prophet, K-Means, Isolation Forest, Hungarian**

### 🔗 Blockchain Explorer
```
http://localhost:3001/blockchain-explorer
```
**Traçabilité QR codes + Feedback consommateurs**

---

## Étape 3 : Démarrer Simulateur SQAL (optionnel)

**Depuis le Control Panel** :
1. Ouvrir `http://localhost:3003`
2. Section "Simulateur SQAL"
3. Cliquer "▶️ Démarrer SQAL"
4. Ouvrir `http://localhost:5173` → Voir données temps réel

**Ou en ligne de commande** :
```bash
cd simulator-sqal
python src/main.py --device ESP32_LL_01 --interval 5
```

**Puis ouvrir** :
```
http://localhost:5173
```

---

## 🎬 Ordre de Présentation Recommandé

**1. Control Panel** (2 min)
→ `http://localhost:3003`
- Montrer écosystème complet
- 4 services + simulateurs
- Statut temps réel

**2. Dashboard 3-Courbes** (5 min) ⭐ INNOVATION PRINCIPALE
→ `http://localhost:3001/lots/3468/courbes-sprint3`
- Courbe Théorique (bleu) - PySR v2
- Courbe Réelle (vert) - Gaveur
- **Courbe Prédictive (orange) - IA rattrapage** ⭐

**3. SQAL IoT** (4 min)
→ `http://localhost:5173`
- Démarrer simulateur
- Montrer capteurs temps réel
- Grade automatique A+/A/B/C/D

**4. Blockchain** (3 min)
→ `http://localhost:3001/blockchain-explorer`
- QR codes produits
- Traçabilité immutable
- Feedback consommateurs → Boucle fermée IA

**5. Analytics Euralis** (3 min)
→ `http://localhost:3000/euralis/dashboard`
- Prévisions production
- Clustering gaveurs
- Détection anomalies
- Optimisation abattage

**TOTAL : 17 minutes**

---

## 💡 Points Clés à Marteler

### Innovation 1 : IA Double Niveau
- **PySR v2** : Courbe optimale (ML symbolique, 30,524 données)
- **Prédictif v2** : Rattrapage intelligent (spline + contraintes)
- **Précision** : ±5g (2x meilleure que v1)
- **Vitesse** : <50ms

### Innovation 2 : IoT Temps Réel
- **Capteurs pro** : VL53L8CH (ToF 8x8) + AS7341 (Spectral 10ch)
- **WebSocket** : Données live
- **Grade auto** : Objectivité totale
- **Traçabilité** : Chaque foie scanné

### Innovation 3 : Blockchain Traçabilité
- **QR codes** : Scan consommateur
- **Immutabilité** : Hyperledger Fabric
- **Feedback loop** : Consommateur → IA → Gaveur
- **Confiance** : Transparence totale

---

## 🆘 Si Problème

### Frontend ne charge pas
```bash
# Redémarrer via Docker
docker-compose restart

# Ou manuellement
cd gaveurs-frontend
npm run dev
```

### Simulateur SQAL ne démarre pas
```bash
cd simulator-sqal
pip install -r requirements.txt
python src/main.py --device ESP32_LL_01 --interval 5
```

### Backend erreur
```bash
docker logs gaveurs_backend --tail 50
```

---

## 📱 Test Responsive (Bonus)

**Ouvrir sur mobile/tablet** :
```
http://[IP_SERVEUR]:3001/lots/3468/courbes-sprint3
```

Montrer que le dashboard s'adapte parfaitement.

---

## 📄 Documents Post-Démo

**À envoyer au client** :
1. `DEMO_COMPLETE_CONTROL_PANEL.md` (guide complet)
2. `documentation/Courbes-Gavage-IA/SPRINT6_COMPLET.md` (technique)
3. `documentation/Courbes-Gavage-IA/SPRINT6_RESUME.md` (exécutif)
4. Screenshots dashboard 3-courbes

---

## 🎯 Message Final Client

> "Le Système Gaveurs V3.0 est unique dans le secteur :
> - **IoT** : Qualité objective en temps réel
> - **IA** : Optimisation continue production
> - **Blockchain** : Confiance consommateur garantie
>
> C'est une **solution complète** du gavage à l'assiette,
> avec une **boucle fermée** d'amélioration continue.
>
> ROI attendu : **6-12 mois**
> Déploiement : **2-3 mois**"

---

**Bon courage pour la démo ! Vous allez les impressionner.** 🦆🚀

---

**URLs Clés à Retenir** :
- Control Panel : `http://localhost:3003`
- Dashboard 3-Courbes : `http://localhost:3001/lots/3468/courbes-sprint3`
- SQAL : `http://localhost:5173`
- Métriques : `http://localhost:8000/api/metrics/`
