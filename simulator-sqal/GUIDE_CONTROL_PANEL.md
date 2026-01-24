# 🎛️ Guide d'utilisation du Control Panel SQAL

Ce guide vous montre comment utiliser le Control Panel pour lancer et gérer plusieurs simulateurs ESP32 simultanément.

## 📋 Prérequis

1. **Backend SQAL en cours d'exécution** :
   ```bash
   cd d:\GavAI\projet-euralis-gaveurs
   docker-compose up -d
   ```

2. **Vérifier que le backend est accessible** :
   ```bash
   curl http://localhost:8000/health
   ```

## 🚀 Utilisation du Control Panel

### **Option 1: Mode Interactif (Recommandé pour débuter)**

Le mode interactif offre un menu simple pour gérer vos simulateurs :

```bash
cd simulator-sqal
python control_panel.py --interactive
```

**Menu disponible :**
```
📋 MENU:
  1. Démarrer un simulateur
  2. Arrêter un simulateur
  3. Voir le statut
  4. Scénario multi-sites (4 devices)
  5. Test de charge
  6. Arrêter tous les simulateurs
  0. Quitter
```

**Exemple de session :**
```
👉 Votre choix: 1
  Device ID (ex: ESP32_LL_01): ESP32_LL_01
  Fréquence Hz (ex: 0.5): 0.5
  Durée secondes (0=infini): 300

✅ Simulateur ESP32_LL_01 démarré (PID: 12345)
   Rate: 0.5 Hz | Duration: 300s
```

### **Option 2: Scénario Multi-Sites**

Lance automatiquement 4 simulateurs représentant les 3 sites Euralis :

```bash
cd simulator-sqal
python control_panel.py --multi-site
```

**Ce qui est lancé :**
- `ESP32_LL_01` - Site Landes, Ligne A (0.5 Hz)
- `ESP32_LL_02` - Site Landes, Ligne B (0.4 Hz)
- `ESP32_LS_01` - Site Landes Sud (0.6 Hz)
- `ESP32_MT_01` - Site Mont-de-Marsan (0.5 Hz)

**Durée :** Infinie (appuyez sur `Ctrl+C` pour arrêter)

### **Option 3: Test de Charge**

Lance plusieurs simulateurs pour tester la capacité du backend :

```bash
# 5 devices, 1 Hz, 60 secondes
python control_panel.py --stress-test --devices 5 --rate 1.0 --duration 60

# 10 devices, 2 Hz, 2 minutes
python control_panel.py --stress-test --devices 10 --rate 2.0 --duration 120
```

### **Option 4: Device Unique**

Lance un seul simulateur avec des paramètres personnalisés :

```bash
# Device unique, 0.5 Hz, 5 minutes
python control_panel.py --device ESP32_DEMO_01 --rate 0.5 --duration 300

# Device unique, 1 Hz, infini
python control_panel.py --device ESP32_CUSTOM --rate 1.0 --duration 0
```

## 📊 Vérifier les données dans la base

### **Voir tous les devices actifs :**
```bash
docker exec -i gaveurs_timescaledb psql -U gaveurs_admin -d gaveurs_db -c "
  SELECT device_id, COUNT(*) as samples, MAX(time) as last_sample
  FROM sqal_sensor_samples
  GROUP BY device_id
  ORDER BY last_sample DESC;
"
```

### **Voir les derniers échantillons :**
```bash
docker exec -i gaveurs_timescaledb psql -U gaveurs_admin -d gaveurs_db -c "
  SELECT sample_id, device_id, time, fusion_final_grade, fusion_final_score
  FROM sqal_sensor_samples
  ORDER BY time DESC
  LIMIT 20;
"
```

### **Statistiques par device :**
```bash
docker exec -i gaveurs_timescaledb psql -U gaveurs_admin -d gaveurs_db -c "
  SELECT
    device_id,
    COUNT(*) as total_samples,
    AVG(fusion_final_score) as avg_score,
    COUNT(CASE WHEN fusion_final_grade = 'A+' THEN 1 END) as grade_a_plus,
    COUNT(CASE WHEN fusion_final_grade = 'A' THEN 1 END) as grade_a,
    COUNT(CASE WHEN fusion_final_grade = 'B' THEN 1 END) as grade_b,
    COUNT(CASE WHEN fusion_final_grade = 'C' THEN 1 END) as grade_c,
    COUNT(CASE WHEN fusion_final_grade = 'REJECT' THEN 1 END) as grade_reject
  FROM sqal_sensor_samples
  GROUP BY device_id;
"
```

## 🔧 Paramètres du simulateur

| Paramètre | Description | Valeurs recommandées |
|-----------|-------------|---------------------|
| `--device` | ID unique du device | ESP32_LL_01, ESP32_LS_01, etc. |
| `--rate` | Fréquence d'envoi (Hz) | 0.2 - 2.0 Hz |
| `--duration` | Durée en secondes | 60-300s (0=infini) |

**Recommandations :**
- **Production réelle** : 0.2-0.5 Hz (1 échantillon toutes les 2-5 secondes)
- **Tests** : 1-2 Hz pour générer rapidement des données
- **Stress test** : 2+ Hz avec plusieurs devices

## 📈 Scénarios d'utilisation

### **1. Développement / Debug**
```bash
# 1 device lent pour observer en détail
python control_panel.py --device ESP32_DEBUG --rate 0.2 --duration 120
```

### **2. Simulation Production**
```bash
# Scénario multi-sites représentant une journée de production
python control_panel.py --multi-site
# Laisser tourner plusieurs heures
```

### **3. Test de Performance**
```bash
# Test de charge progressive
python control_panel.py --stress-test --devices 5 --rate 1.0 --duration 60
python control_panel.py --stress-test --devices 10 --rate 1.0 --duration 60
python control_panel.py --stress-test --devices 20 --rate 1.0 --duration 60
```

### **4. Génération de Dataset**
```bash
# 4 devices pendant 1 heure pour créer un dataset
python control_panel.py --multi-site
# Arrêter après 1h avec Ctrl+C
```

## 🎨 Visualisation en temps réel

Pendant que les simulateurs tournent, ouvrez le dashboard SQAL :

```bash
# Frontend SQAL (React)
cd sqal
npm run dev
# → http://localhost:5173
```

Vous verrez :
- **Graphiques en temps réel** des échantillons
- **Distribution des grades** (A+, A, B, C, REJECT)
- **Statistiques par device**
- **Alertes qualité**

## ⚠️ Dépannage

### **Erreur: Connection refused**
```
❌ Vérifier que le backend est en cours :
docker-compose ps
curl http://localhost:8000/health
```

### **Erreur: Device déjà en cours**
```
❌ Arrêter d'abord le device existant :
python control_panel.py --interactive
# Choisir option 2 (Arrêter un simulateur)
```

### **Simulateurs ne s'arrêtent pas**
```bash
# Forcer l'arrêt de tous les processus Python
# Windows:
taskkill /F /IM python.exe /FI "WINDOWTITLE eq esp32_simulator*"

# Linux/Mac:
pkill -f esp32_simulator.py
```

## 📝 Logs

Les logs des simulateurs sont affichés en temps réel. Pour les capturer :

```bash
# Rediriger vers un fichier
python control_panel.py --device ESP32_TEST --rate 0.5 --duration 300 > logs/simulator.log 2>&1
```

## 🔗 Ressources

- **API Backend** : http://localhost:8000/docs
- **Dashboard SQAL** : http://localhost:5173
- **Dashboard Euralis** : http://localhost:3000/euralis/dashboard
- **Grafana** (si configuré) : http://localhost:3001

## 💡 Conseils

1. **Démarrer progressivement** : Commencez avec 1 device, puis augmentez
2. **Surveiller les ressources** : Vérifier CPU/RAM si >10 devices
3. **Utiliser des durées limitées** : Pour éviter de remplir la DB trop vite
4. **Nettoyer périodiquement** : Supprimer les anciennes données de test
5. **Logs backend** : `docker-compose logs -f backend` pour voir les erreurs

## 🎯 Objectifs de test

- ✅ **Validation fonctionnelle** : 1 device, 0.5 Hz, 5 minutes
- ✅ **Test multi-devices** : 4 devices, scénario multi-sites
- ✅ **Performance** : 10+ devices simultanés
- ✅ **Durabilité** : Scénario multi-sites pendant 1h+
- ✅ **Dataset** : Générer 1000+ échantillons pour ML
