# 📦 Fonctionnalités

Documentation des fonctionnalités principales du système Gaveurs V3.0.

---

## 📚 Documents disponibles

### [SYSTEME_COMPLET_BOUCLE_FERMEE.md](../../SYSTEME_COMPLET_BOUCLE_FERMEE.md)
**Documentation complète de la boucle fermée consommateur**

- Flux complet gaveur → consommateur → IA → optimisation
- 6 modules IA/ML détaillés
- QR codes + blockchain traceability
- Feedback optimizer (Random Forest)
- Architecture end-to-end

**Pages**: 1200+
**Niveau**: Complet

---

### [FRONTEND_WEBSOCKET_INTEGRATION.md](../FRONTEND_WEBSOCKET_INTEGRATION.md)
**Intégration WebSocket temps réel dans les frontends**

- Hook React `useRealtimeGavage`
- Composants monitoring temps réel
- Agrégation multi-sites
- Auto-reconnect et heartbeat
- Tests et troubleshooting

**Pages**: 800+
**Niveau**: Développeur

---

### [INTEGRATION_COMPLETE_FINALE.md](../../INTEGRATION_COMPLETE_FINALE.md)
**Récapitulatif intégration système temps réel**

- Phase 1: Backend (11 fichiers, ~3350 lignes)
- Phase 2: Frontend (6 fichiers, ~1740 lignes)
- Flux de données complet
- WebSocket endpoints
- Documentation complète

**Pages**: 600+
**Niveau**: Récapitulatif

---

## 🎯 Fonctionnalités Principales

### 1. 🦆 Gavage Temps Réel

**Description**: Système de suivi en temps réel des opérations de gavage

**Composants**:
- Simulateur gavage temps réel (`simulators/gavage_realtime/`)
- WebSocket endpoint `/ws/gavage`
- Dashboard gaveur avec monitoring live
- Alertes automatiques

**Documentation**: [05-SIMULATEURS](../05-SIMULATEURS/README.md)

---

### 2. 🔬 Contrôle Qualité SQAL

**Description**: Inspection qualité par capteurs IoT (ToF + Spectral)

**Composants**:
- Simulateur ESP32 (`simulators/sqal/`)
- Capteurs VL53L8CH (8x8 ToF matrices)
- Capteurs AS7341 (10 canaux spectraux)
- Grading automatique (A+, A, B, C, D)
- Dashboard temps réel

**Documentation**: [07-SQAL](../07-SQAL/README.md)

---

### 3. 📊 Supervision Multi-Sites

**Description**: Tableau de bord Euralis pour supervision 3 sites (LL, LS, MT)

**Fonctionnalités**:
- Agrégation temps réel par site
- Statistiques globales (65 gaveurs, 200+ lots)
- Graphiques performances
- Alertes critiques
- Prévisions IA/ML

**Routes API**:
```
GET  /api/euralis/sites              # Liste sites
GET  /api/euralis/gaveurs             # 65 gaveurs
GET  /api/euralis/lots                # 200+ lots
GET  /api/euralis/stats/global        # Statistiques globales
GET  /api/euralis/stats/sites         # Stats par site
GET  /api/euralis/analytics/forecast  # Prévisions Prophet
GET  /api/euralis/analytics/clusters  # Clustering K-Means
```

**Pages Frontend**:
- Dashboard multi-sites (`/euralis/dashboard`)
- Lots actifs (`/euralis/lots`)
- Gaveurs par site (`/euralis/gaveurs`)
- Performances par site (`/euralis/performances`)
- Alertes globales (`/euralis/alertes`)
- Prévisions ML (`/euralis/previsions`)
- Configuration (`/euralis/settings`)

---

### 4. 🤖 Modules IA/ML

**Description**: 6 algorithmes d'intelligence artificielle

**Modules**:

1. **Symbolic Regression** (PySR)
   - Découverte formules optimales gavage
   - Prédiction ITM (Indice Transformation Maïs)
   - Fichier: `app/ml/symbolic_regression.py`

2. **Feedback Optimizer** (Random Forest)
   - Optimisation basée sur feedback consommateurs
   - Corrélations paramètres production ↔ satisfaction
   - Fichier: `app/ml/feedback_optimizer.py`

3. **Production Forecasting** (Prophet)
   - Prévisions 7/30/90 jours
   - Fichier: `app/ml/euralis/production_forecasting.py`

4. **Gaveur Clustering** (K-Means)
   - Segmentation 5 clusters performance
   - Fichier: `app/ml/euralis/gaveur_clustering.py`

5. **Anomaly Detection** (Isolation Forest)
   - Détection anomalies production
   - Fichier: `app/ml/euralis/anomaly_detection.py`

6. **Abattage Optimization** (Hungarian)
   - Optimisation planning abattoir
   - Fichier: `app/ml/euralis/abattage_optimization.py`

**Documentation**: [06-IA_ML](../06-IA_ML/README.md)

---

### 5. 🔗 Blockchain Traceability

**Description**: Traçabilité blockchain avec Hyperledger Fabric

**Fonctionnalités**:
- Enregistrement lots sur blockchain
- QR codes avec hash blockchain
- Vérification authenticité
- API publique consommateur

**Routes API**:
```
POST /api/consumer/qr/{qr_code}     # Scan QR code
GET  /api/consumer/product/{id}     # Info produit
POST /api/consumer/feedback         # Soumettre feedback
```

**Intégration**: `app/blockchain/fabric_integration.py`

---

### 6. 📱 Feedback Consommateur

**Description**: Boucle fermée consommateur → optimisation

**Flux**:
```
1. Consommateur achète produit
2. Scanne QR code sur emballage
3. Voit traçabilité complète (blockchain)
4. Soumet feedback (note 1-5 + commentaires)
5. IA analyse corrélations
6. Génère nouvelles courbes gavage optimisées
7. Retour aux gaveurs
   └─── 🔄 CYCLE RÉPÉTÉ
```

**Tables DB**:
- `consumer_products` - Produits consommateur
- `consumer_feedbacks` - Feedbacks (hypertable)
- `qr_codes` - QR codes + blockchain
- `feedback_analysis` - Analyses ML
- `optimization_suggestions` - Suggestions

**Documentation**: [SYSTEME_COMPLET_BOUCLE_FERMEE.md](../../SYSTEME_COMPLET_BOUCLE_FERMEE.md)

---

### 7. ⏱️ Monitoring Temps Réel

**Description**: WebSocket pour données live sur tous les frontends

**Composants**:

**Frontend Gaveurs**:
- Hook `useRealtimeGavage` (auto-reconnect)
- Composant `RealtimeGavageMonitor`
- Historique 20 derniers gavages
- Stats instantanées

**Frontend Euralis**:
- Composant `RealtimeSitesMonitor`
- Agrégation par site (LL, LS, MT)
- Moyennes mobiles
- Activité récente

**WebSocket Endpoints**:
- `/ws/realtime/` - Broadcast vers frontends
- `/ws/gavage` - Inbound depuis simulateur
- `/ws/sensors/` - Inbound depuis SQAL

**Documentation**: [FRONTEND_WEBSOCKET_INTEGRATION.md](../FRONTEND_WEBSOCKET_INTEGRATION.md)

---

## 📊 Statistiques Fonctionnalités

| Fonctionnalité | Frontend | Backend | DB Tables | IA/ML |
|----------------|----------|---------|-----------|-------|
| Gavage temps réel | ✅ | ✅ | 12 | ❌ |
| SQAL contrôle qualité | ✅ | ✅ | 7 | ✅ |
| Supervision multi-sites | ✅ | ✅ | 12 | ✅ |
| Modules IA/ML | ❌ | ✅ | 8 | ✅ (6) |
| Blockchain | ❌ | ✅ | 7 | ❌ |
| Feedback consommateur | ✅ | ✅ | 7 | ✅ |
| Monitoring temps réel | ✅ | ✅ | 4 | ❌ |

---

## 🧪 Tests Fonctionnalités

### Test intégration complète

```bash
# Terminal 1: Backend
cd backend-api
uvicorn app.main:app --reload

# Terminal 2: Simulateur gavage
cd simulators/gavage_realtime
python main.py --nb-lots 3 --acceleration 1440

# Terminal 3: Frontend Euralis
cd euralis-frontend
npm run dev

# Terminal 4: Frontend Gaveurs
cd gaveurs-frontend
npm run dev -- --port 3001

# Terminal 5: SQAL Simulator (optionnel)
cd simulators/sqal
python main.py --device ESP32_LL_01 --interval 30

# Terminal 6: Lot Monitor (optionnel)
cd simulators/sqal
python lot_monitor.py --polling-interval 60
```

### Vérifications

**Backend**:
- ✅ http://localhost:8000/docs
- ✅ http://localhost:8000/health
- ✅ WebSocket `/ws/realtime/` connecté

**Frontends**:
- ✅ http://localhost:3000/euralis/dashboard (Euralis)
- ✅ http://localhost:3001 (Gaveurs)
- ✅ http://localhost:5173 (SQAL)

**Données temps réel**:
- ✅ Gavages apparaissent dans dashboards
- ✅ Stats se mettent à jour
- ✅ Agrégation par site fonctionne
- ✅ Alertes détectées

---

## 🔗 Liens Utiles

- [Architecture](../02-ARCHITECTURE/README.md)
- [Simulateurs](../05-SIMULATEURS/README.md)
- [IA/ML](../06-IA_ML/README.md)
- [SQAL](../07-SQAL/README.md)
- [Guide démarrage](../01-GUIDES_DEMARRAGE/README.md)

---

**Retour**: [Index principal](../README.md)
