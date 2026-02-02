# Consumer Feedback (QR → avis) : runbook

Ce document décrit :

- le comportement de l’endpoint `POST /api/consumer/feedback`
- les validations attendues (404/400 vs 200)
- la vérification SQL (insertion du feedback + auto-population ML)
- les commandes de redémarrage Docker utiles en dev

---

## 1) Endpoint `POST /api/consumer/feedback`

### Objectif

- Enregistrer un avis consommateur lié à un produit (`consumer_products`) identifié par un `qr_code`.
- Déclencher automatiquement le trigger SQL `auto_populate_ml_data()` qui alimente `consumer_feedback_ml_data`.

### Payload (exemple)

```json
{
  "qr_code": "SQAL_182298_LL-260202-4665-065_FG_LL_20260202_0000015144_86701c71bc48bb97",
  "product_id": "FG_LL_20260202_0000015144",
  "overall_rating": 1,
  "detailed_ratings": {
    "texture": 1,
    "flavor": 1,
    "color": 1,
    "aroma": 1,
    "freshness": 1
  },
  "comment": "string",
  "consumption_context": "home",
  "consumption_date": "2026-02-02T13:06:14.086Z",
  "consumer_age_range": "string",
  "consumer_region": "string",
  "would_recommend": true,
  "repurchase_intent": 1,
  "photo_urls": ["string"],
  "device_type": "string",
  "app_version": "string"
}
```

---

## 2) Validations attendues (API)

### 2.1 QR code invalide

Attendu :

- HTTP `404`
- body :

```json
{ "detail": "QR code invalide ou produit introuvable" }
```

### 2.2 `product_id` ne correspond pas au `qr_code`

Attendu :

- HTTP `400`
- body :

```json
{ "detail": "Le product_id ne correspond pas au QR code" }
```

### 2.3 Feedback valide

Attendu :

- HTTP `200`
- body :

```json
{
  "success": true,
  "feedback_id": 2853,
  "message": "Merci pour votre retour ! Il nous aidera à améliorer nos produits et nos méthodes de production.",
  "reward_points": 5
}
```

### 2.4 Erreur de validation Pydantic

Exemple : `repurchase_intent` doit être `>= 1` si fourni.

- HTTP `422`

---

## 3) Vérifications SQL

### 3.1 Récupérer un couple `product_id` / `qr_code` valide

```sql
SELECT product_id, qr_code, lot_id, sample_id
FROM consumer_products
WHERE is_active = TRUE
ORDER BY created_at DESC
LIMIT 5;
```

### 3.2 Vérifier que le feedback est bien inséré

```sql
SELECT feedback_id, time, product_id, overall_rating, repurchase_intent
FROM consumer_feedbacks
WHERE feedback_id = 2853;
```

### 3.3 Vérifier que le trigger a créé la ligne ML

```sql
SELECT ml_data_id, feedback_id, lot_id, sample_id, lot_itm, lot_avg_weight, lot_mortality_rate, created_at
FROM consumer_feedback_ml_data
WHERE feedback_id = 2853;
```

---

## 4) Redémarrage (dev)

Après modification du backend ou des services Celery :

```bash
docker compose up -d --build --force-recreate backend celery-worker
```

---

## 5) Notes d’implémentation (résumé)

- Le trigger SQL `auto_populate_ml_data()` doit être robuste aux cas “produit introuvable” (ne pas casser l’INSERT).
- L’API valide la cohérence `qr_code -> product_id` pour éviter les `500` et retourner des erreurs métier (404/400).
