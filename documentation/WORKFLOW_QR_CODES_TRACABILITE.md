# Workflow Complet - QR Codes & Traçabilité

**Date**: 08 Janvier 2026
**Version**: 2.0 (avec génération automatique)

---

## 📋 Vue d'Ensemble

Le système génère automatiquement des **QR codes** pour chaque produit après contrôle qualité SQAL. Ces QR codes permettent aux consommateurs de scanner et découvrir la traçabilité complète du produit via la **boucle fermée de feedback**.

---

## 🔄 Workflow Automatique (Production)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    1. SIMULATEUR SQAL                               │
│  Envoie données capteurs ToF + Spectral via WebSocket              │
│  → /ws/sensors/                                                     │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│             2. BACKEND - WebSocket Handler                          │
│  sensors_consumer.py                                                │
│  ✓ Validation Pydantic (SensorDataMessage)                         │
│  ✓ Sauvegarde TimescaleDB (sqal_sensor_samples)                    │
│  ✓ Génération alertes (si qualité < seuils)                        │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│       3. GÉNÉRATION QR CODE (Si échantillon conforme)              │
│  ✓ Vérification: fusion.is_compliant == True                       │
│  ✓ Vérification: fusion.final_grade != "REJECT"                    │
│  ✓ Déclenche tâche Celery asynchrone:                              │
│    generate_qr_code_async.delay(lot_id, sample_id, site_code)      │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│              4. CELERY WORKER - Génération QR                       │
│  Tâche: generate_qr_code_async                                     │
│  Queue: exports                                                     │
│  Durée: 2-5 secondes                                                │
│                                                                      │
│  Actions:                                                           │
│  ✓ Appel fonction SQL: register_consumer_product(lot_id, sample_id, site_code)  │
│  ✓ Génère product_id: FG_LL_20260108_0001                          │
│  ✓ Génère QR code: SQAL_3472_ESP32_LL_01_1234_FG_LL_20260108_0001_abc123...  │
│  ✓ Insère dans consumer_products:                                  │
│    - product_id, qr_code                                            │
│    - lot_id, sqal_sample_id                                         │
│    - Données qualité SQAL (score fusion, grade, compliance)       │
│    - Données lot (ITM, poids, durée gavage)                        │
│    - Blockchain hash (traçabilité)                                 │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                5. TABLE: consumer_products                          │
│  Stockage permanent du produit avec QR code                         │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│               6. CONSOMMATEUR SCANNE QR CODE                        │
│  Frontend Traceability → GET /api/consumer/scan/{qr_code}          │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│          7. BACKEND - Récupération Traçabilité Complète            │
│  consumer_feedback_service.scan_qr_code(qr_code)                   │
│                                                                      │
│  Retourne ProductTraceability:                                     │
│  ✓ Origine lot (gaveur, site, dates gavage)                        │
│  ✓ Qualité SQAL (grade, scores ToF + Spectral)                     │
│  ✓ Blockchain hash (traçabilité immuable)                          │
│  ✓ Statistiques produit (note moyenne si >5 avis)                  │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│             8. CONSOMMATEUR SOUMET FEEDBACK                         │
│  POST /api/consumer/feedback                                        │
│  {                                                                   │
│    "qr_code": "SQAL_3472_...",                                      │
│    "overall_rating": 5,                                             │
│    "taste_rating": 5,                                               │
│    "texture_rating": 4,                                             │
│    "appearance_rating": 5,                                          │
│    "value_rating": 4,                                               │
│    "comment": "Excellent produit!"                                  │
│  }                                                                   │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│      9. ANALYSE ML - Corrélations Production ↔ Satisfaction        │
│  app/ml/feedback_optimizer.py (Random Forest)                      │
│  Analyse corrélations:                                              │
│  - Paramètres gavage (dose, durée, ITM) ↔ Note consommateur       │
│  - Qualité SQAL (scores ToF, spectral) ↔ Satisfaction             │
│  → Génère courbes gavage optimisées                                │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│         10. AMÉLIORATION CONTINUE - Boucle Fermée                   │
│  Nouvelles courbes gavage appliquées aux lots suivants              │
│  → Amélioration qualité produit basée sur feedback réel             │
│  🔄 CYCLE RÉPÉTÉ                                                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🏗️ Architecture Base de Données

### Table: `consumer_products`

```sql
CREATE TABLE consumer_products (
    id SERIAL PRIMARY KEY,
    product_id VARCHAR(50) UNIQUE NOT NULL,              -- FG_LL_20260108_0001
    qr_code TEXT UNIQUE NOT NULL,                        -- SQAL_3472_ESP32_LL_01_1234_FG_LL_20260108_0001_abc123...
    lot_id INTEGER REFERENCES lots_gavage(id),
    sqal_sample_id VARCHAR(100),

    -- Données SQAL
    sqal_fusion_score FLOAT,
    sqal_fusion_grade VARCHAR(10),
    sqal_is_compliant BOOLEAN,
    sqal_tof_volume_mm3 FLOAT,
    sqal_tof_surface_uniformity FLOAT,
    sqal_spectral_freshness_index FLOAT,

    -- Données lot
    lot_code VARCHAR(50),
    lot_itm_moyen FLOAT,
    lot_poids_moyen_final_g FLOAT,
    lot_date_debut_gavage TIMESTAMP,
    lot_date_fin_gavage TIMESTAMP,
    lot_duree_gavage_jours INTEGER,

    -- Traçabilité
    blockchain_hash VARCHAR(64),
    created_at TIMESTAMP DEFAULT NOW(),

    -- Index
    INDEX idx_qr_code (qr_code),
    INDEX idx_lot_id (lot_id),
    INDEX idx_product_id (product_id)
);
```

### Fonction SQL: `generate_qr_code()`

```sql
CREATE OR REPLACE FUNCTION generate_qr_code(
    p_lot_id INTEGER,
    p_sample_id VARCHAR DEFAULT NULL,
    p_site_code VARCHAR DEFAULT 'LL'
)
RETURNS VARCHAR AS $$
DECLARE
    v_product_id VARCHAR;
    v_qr_code VARCHAR;
    v_signature VARCHAR;
BEGIN
    -- Générer product_id unique : FG_{site}_{date}_{seq}
    v_product_id := 'FG_' || p_site_code || '_' || TO_CHAR(NOW(), 'YYYYMMDD') || '_' ||
                    LPAD(nextval('consumer_products_seq')::TEXT, 4, '0');

    -- Générer signature cryptographique (SHA256)
    v_signature := encode(digest(v_product_id || p_lot_id::TEXT || COALESCE(p_sample_id, '') || NOW()::TEXT, 'sha256'), 'hex');

    -- Construire QR code : SQAL_{lot_id}_{sample_id}_{product_id}_{signature[:16]}
    v_qr_code := 'SQAL_' || p_lot_id || '_' ||
                 COALESCE(p_sample_id, 'NOSAMPLE') || '_' ||
                 v_product_id || '_' ||
                 SUBSTRING(v_signature, 1, 16);

    RETURN v_qr_code;
END;
$$ LANGUAGE plpgsql;
```

### Fonction SQL: `register_consumer_product()`

```sql
CREATE OR REPLACE FUNCTION register_consumer_product(
    p_lot_id INTEGER,
    p_sample_id VARCHAR,
    p_site_code VARCHAR
)
RETURNS TABLE (
    product_id VARCHAR,
    qr_code VARCHAR
) AS $$
DECLARE
    v_product_id VARCHAR;
    v_qr_code VARCHAR;
    v_sqal_data RECORD;
    v_lot_data RECORD;
BEGIN
    -- Récupérer données SQAL (dernier échantillon)
    SELECT
        fusion_final_score,
        fusion_final_grade,
        fusion_is_compliant,
        vl53l8ch_volume_mm3,
        vl53l8ch_surface_uniformity,
        as7341_freshness_index
    INTO v_sqal_data
    FROM sqal_sensor_samples
    WHERE sample_id = p_sample_id
    ORDER BY time DESC
    LIMIT 1;

    -- Récupérer données lot
    SELECT
        l.code_lot,
        l.itm_moyen,
        l.poids_moyen_final_g,
        l.date_debut_gavage,
        l.date_fin_prevue_gavage,
        EXTRACT(EPOCH FROM (l.date_fin_prevue_gavage - l.date_debut_gavage)) / 86400 as duration_days
    INTO v_lot_data
    FROM lots_gavage l
    WHERE l.id = p_lot_id;

    -- Générer QR code
    v_qr_code := generate_qr_code(p_lot_id, p_sample_id, p_site_code);

    -- Extraire product_id du QR code
    v_product_id := SPLIT_PART(v_qr_code, '_', 4);

    -- Insérer produit
    INSERT INTO consumer_products (
        product_id,
        qr_code,
        lot_id,
        sqal_sample_id,
        sqal_fusion_score,
        sqal_fusion_grade,
        sqal_is_compliant,
        sqal_tof_volume_mm3,
        sqal_tof_surface_uniformity,
        sqal_spectral_freshness_index,
        lot_code,
        lot_itm_moyen,
        lot_poids_moyen_final_g,
        lot_date_debut_gavage,
        lot_date_fin_gavage,
        lot_duree_gavage_jours
    ) VALUES (
        v_product_id,
        v_qr_code,
        p_lot_id,
        p_sample_id,
        v_sqal_data.fusion_final_score,
        v_sqal_data.fusion_final_grade,
        v_sqal_data.fusion_is_compliant,
        v_sqal_data.vl53l8ch_volume_mm3,
        v_sqal_data.vl53l8ch_surface_uniformity,
        v_sqal_data.as7341_freshness_index,
        v_lot_data.code_lot,
        v_lot_data.itm_moyen,
        v_lot_data.poids_moyen_final_g,
        v_lot_data.date_debut_gavage,
        v_lot_data.date_fin_prevue_gavage,
        v_lot_data.duration_days
    );

    -- Retourner product_id et qr_code
    RETURN QUERY SELECT v_product_id, v_qr_code;
END;
$$ LANGUAGE plpgsql;
```

---

## 🚀 Utilisation

### Génération Automatique (Production)

Les QR codes sont générés **automatiquement** après chaque contrôle SQAL si l'échantillon est conforme:

```python
# backend-api/app/websocket/sensors_consumer.py (ligne 274)

# Déclenche génération QR code uniquement si échantillon conforme
if sensor_data.fusion.is_compliant and sensor_data.fusion.final_grade != QualityGrade.REJECT:
    generate_qr_code_async.delay(
        lot_id=sensor_data.lot_id,
        sample_id=sensor_data.sample_id,
        site_code=site_code
    )
```

### Génération Manuelle (API)

Pour générer un QR code manuellement:

```bash
curl -X POST "http://localhost:8000/api/tasks/qr-code/generate?lot_id=3472&sample_id=ESP32_LL_01_1234&site_code=LL"

# Réponse:
{
  "status": "submitted",
  "task_id": "abc-123-def-456",
  "lot_id": 3472,
  "sample_id": "ESP32_LL_01_1234",
  "message": "QR code generation started"
}

# Vérifier statut
curl "http://localhost:8000/api/tasks/status/abc-123-def-456"

# Réponse (terminé):
{
  "task_id": "abc-123-def-456",
  "status": "SUCCESS",
  "result": {
    "status": "success",
    "lot_id": 3472,
    "sample_id": "ESP32_LL_01_1234",
    "product_id": "FG_LL_20260108_0001",
    "qr_code": "SQAL_3472_ESP32_LL_01_1234_FG_LL_20260108_0001_abc123def456"
  }
}
```

### Scan QR Code (Consommateur)

```bash
# Scan QR code
curl "http://localhost:8000/api/consumer/scan/SQAL_3472_ESP32_LL_01_1234_FG_LL_20260108_0001_abc123def456"

# Réponse:
{
  "success": true,
  "traceability": {
    "product_id": "FG_LL_20260108_0001",
    "qr_code": "SQAL_3472_ESP32_LL_01_1234_FG_LL_20260108_0001_abc123def456",
    "lot": {
      "code_lot": "LL2601001",
      "itm_moyen": 125.5,
      "poids_moyen_final_g": 7850,
      "date_debut_gavage": "2026-01-01T00:00:00",
      "date_fin_gavage": "2026-01-14T00:00:00",
      "duree_gavage_jours": 14,
      "gaveur": {
        "nom": "Martin",
        "prenom": "Jean",
        "site_code": "LL"
      }
    },
    "sqal_quality": {
      "fusion_score": 0.87,
      "fusion_grade": "A+",
      "is_compliant": true,
      "tof_volume_mm3": 125000,
      "tof_surface_uniformity": 0.92,
      "spectral_freshness_index": 0.89
    },
    "blockchain": {
      "hash": "a1b2c3d4e5f6...",
      "timestamp": "2026-01-08T12:00:00"
    }
  },
  "already_reviewed": false,
  "average_rating": null,
  "total_reviews": 0
}
```

### Soumettre Feedback

```bash
curl -X POST "http://localhost:8000/api/consumer/feedback" \
  -H "Content-Type: application/json" \
  -d '{
    "qr_code": "SQAL_3472_ESP32_LL_01_1234_FG_LL_20260108_0001_abc123def456",
    "overall_rating": 5,
    "taste_rating": 5,
    "texture_rating": 4,
    "appearance_rating": 5,
    "value_rating": 4,
    "comment": "Excellent produit, texture parfaite!"
  }'

# Réponse:
{
  "success": true,
  "feedback_id": 123,
  "message": "Merci pour votre retour ! Il nous aidera à améliorer nos produits.",
  "reward_points": 10
}
```

---

## 📊 Monitoring avec Flower

Pour surveiller la génération des QR codes:

```bash
# Accéder à Flower
http://localhost:5555

# Auth: admin / gaveurs_flower_2024
```

Dans Flower, vous pouvez:
- ✅ Voir toutes les tâches `generate_qr_code_async` en cours
- ✅ Vérifier le statut (SUCCESS, PENDING, FAILURE)
- ✅ Voir le nombre de QR codes générés par heure
- ✅ Identifier les erreurs éventuelles

---

## 🔧 Troubleshooting

### QR code non généré

```bash
# Vérifier logs Celery worker
docker logs gaveurs_celery_worker --tail 50 | grep "QR code"

# Vérifier que l'échantillon est conforme
SELECT fusion_is_compliant, fusion_final_grade
FROM sqal_sensor_samples
WHERE sample_id = 'ESP32_LL_01_1234';

# Si fusion_final_grade = 'REJECT', le QR code n'est pas généré (normal)
```

### Vérifier QR codes générés

```bash
# Liste QR codes récents
docker exec -it gaveurs_timescaledb psql -U gaveurs_admin -d gaveurs_db -c "
SELECT product_id, qr_code, created_at
FROM consumer_products
ORDER BY created_at DESC
LIMIT 10;
"

# Compter QR codes par jour
docker exec -it gaveurs_timescaledb psql -U gaveurs_admin -d gaveurs_db -c "
SELECT DATE(created_at) as date, COUNT(*) as nb_qr_codes
FROM consumer_products
GROUP BY DATE(created_at)
ORDER BY date DESC;
"
```

### Régénérer QR code pour un échantillon

```bash
# Si QR code manquant, régénérer manuellement
curl -X POST "http://localhost:8000/api/tasks/qr-code/generate?lot_id=3472&sample_id=ESP32_LL_01_1234&site_code=LL"
```

---

## 📚 Fichiers Modifiés

### Nouveau
- `backend-api/app/tasks/export_tasks.py` → Ajout tâche `generate_qr_code_async()`
- `documentation/WORKFLOW_QR_CODES_TRACABILITE.md` → Ce document

### Modifié
- `backend-api/app/websocket/sensors_consumer.py` → Ajout appel Celery après sauvegarde
- `backend-api/app/routers/tasks.py` → Ajout route `/api/tasks/qr-code/generate`

---

**Auteur**: Claude Code
**Date**: 08 Janvier 2026
**Statut**: ✅ Implémentation complète
