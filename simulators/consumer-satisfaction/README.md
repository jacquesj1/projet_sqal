# 🎭 Simulateur de Satisfaction Clients

Génère des feedbacks consommateurs réalistes pour fermer la boucle de feedback du système Gaveurs V3.0.

## 🎯 Objectif

Ce simulateur permet de **boucler la boucle fermée** :

```
Gavage → SQAL → QR Code → Consommateur → Feedback → IA → Optimisation → Gavage
                                           ↑
                                    VOUS ÊTES ICI
```

## 🚀 Démarrage Rapide

### Prérequis

```bash
cd simulators/consumer-satisfaction
pip install -r requirements.txt
```

### Lancement

```bash
# Mode par défaut (1 feedback toutes les 10s)
python main.py

# Mode rapide (1 feedback toutes les 5s)
python main.py --interval 5

# Mode batch (20 feedbacks puis arrêt)
python main.py --num-feedbacks 20 --interval 2
```

## ⚙️ Options

| Argument | Description | Défaut |
|----------|-------------|--------|
| `--api-url` | URL du backend API | `http://localhost:8000` |
| `--interval` | Secondes entre chaque feedback | `10` |
| `--num-feedbacks` | Nombre de feedbacks à générer | Illimité |

## 🎭 Profils de Consommateurs

Le simulateur génère des feedbacks selon 5 profils réalistes :

| Profil | Poids | Note | Comportement |
|--------|-------|------|--------------|
| 😍 **Enthousiaste** | 15% | 4-5 ⭐ | Commentaires très positifs |
| 😊 **Satisfait** | 45% | 3-4 ⭐ | Commentaires positifs |
| 😐 **Neutre** | 25% | 3 ⭐ | Commentaires neutres |
| 😕 **Déçu** | 10% | 2-3 ⭐ | Commentaires négatifs |
| 😠 **Mécontent** | 5% | 1-2 ⭐ | Commentaires très négatifs |

## 🧠 Corrélation Qualité SQAL ↔ Satisfaction

Le simulateur **corrèle intelligemment** la note consommateur avec le grade SQAL :

- **Grade A+/A** → Boost +1 étoile (ex: 3→4, 4→5)
- **Grade B** → Aucun ajustement
- **Grade C/D** → Pénalité -1 étoile (ex: 4→3, 3→2)

Cela simule le fait qu'un produit de meilleure qualité objective (SQAL) génère plus de satisfaction client.

## 📊 Fonctionnement

### 1. Récupération des Produits

```http
GET /api/consumer/products
```

Récupère tous les produits avec QR codes disponibles.

### 2. Simulation Scan QR

```http
GET /api/consumer/scan/{qr_code}
```

Simule un consommateur scannant le QR code avec son smartphone.

### 3. Génération Feedback

Le simulateur génère :
- **Note globale** (1-5) basée sur le profil consommateur + qualité SQAL
- **Notes détaillées** : texture, goût, fraîcheur (corrélées avec note globale)
- **Commentaire** : sélectionné parmi 25 templates réalistes
- **Contexte** : home, restaurant, celebration, gift, tasting

### 4. Envoi Feedback

```http
POST /api/consumer/feedback
{
  "qr_code": "SQAL_1_SAMPLE_001_...",
  "overall_rating": 4,
  "texture_rating": 5,
  "flavor_rating": 4,
  "freshness_rating": 4,
  "comment": "Très bon produit, conforme aux attentes.",
  "consumption_context": "home"
}
```

## 📈 Statistiques en Temps Réel

Le simulateur affiche :

```
📊 Stats finales:
{
  "feedbacks_sent": 50,
  "scans_simulated": 50,
  "errors": 0,
  "avg_rating": 3.8
}
```

## 🔗 Intégration Control Panel

Ce simulateur est intégré dans le **Control Panel** ([control-panel/index.html](../../control-panel/index.html)) et peut être piloté via l'API :

```http
POST /api/control/consumer/start
{
  "interval": 5,
  "num_feedbacks": 20
}
```

## 🧪 Exemple de Logs

```
2025-01-27 14:32:15 - INFO - 🎭 Simulateur de Satisfaction Clients démarré
2025-01-27 14:32:15 - INFO - 📡 API: http://localhost:8000
2025-01-27 14:32:15 - INFO - ⏱️  Intervalle: 10s
2025-01-27 14:32:16 - INFO - 📦 3 produits disponibles
2025-01-27 14:32:16 - INFO - 🛒 Produit sélectionné: FG_LS_20250127_001
2025-01-27 14:32:16 - INFO - 📱 Scan QR réussi: SQAL_1_SAMPLE_001_...
2025-01-27 14:32:17 - INFO - ✅ Feedback envoyé: ⭐4/5 (Satisfait) - Très bon produit, conforme aux attentes...
```

## 🐛 Troubleshooting

### Aucun produit disponible

```
⚠️  Aucun produit disponible pour feedback
```

**Solution** : Générer des produits avec QR codes via SQAL :

```bash
cd simulator-sqal
python src/main.py --device ESP32_LL_01 --interval 30
```

Après contrôle qualité, des QR codes seront générés automatiquement.

### Erreur connexion API

```
❌ Erreur fetch produits: Cannot connect to host localhost:8000
```

**Solution** : Vérifier que le backend est démarré :

```bash
curl http://localhost:8000/health
```

## 📊 Impact sur l'IA

Les feedbacks générés alimentent :

1. **Table `consumer_feedbacks`** (hypertable TimescaleDB)
2. **Module ML `feedback_optimizer.py`** (Random Forest)
3. **Recommandations gavage** optimisées

Après ~100 feedbacks, l'IA peut détecter des **corrélations** :

```
Corrélation détectée:
- Courbe progressive J1-J14 → Texture ⭐4.8/5
- Maïs Bio → Goût ⭐4.9/5
- Gaveur Jean Dupont → Satisfaction ⭐4.7/5

Recommandation: Reproduire ces paramètres pour lots futurs
```

## 🔄 Boucle Complète

Avec ce simulateur, le flux complet est :

1. **Gaveur** → Saisit gavage quotidien (frontend-gaveurs)
2. **Euralis** → Supervise multi-sites (euralis-frontend)
3. **SQAL** → Contrôle qualité IoT (simulator-sqal)
4. **QR Code** → Généré avec blockchain (backend)
5. **Consommateur** → Scanne QR (frontend-traceability) ✅
6. **Feedback** → Simulateur génère satisfaction ✅ **NOUVEAU**
7. **IA** → Analyse corrélations (feedback_optimizer.py)
8. **Optimisation** → Nouvelles courbes recommandées (backend)
9. **Retour Gaveur** → Applique recommandations ✅ **BOUCLE FERMÉE**

---

**Version** : 1.0.0
**Auteur** : A Deep Adventure
**Date** : 27 janvier 2025
