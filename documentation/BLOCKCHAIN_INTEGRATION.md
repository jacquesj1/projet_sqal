# Blockchain Integration for Consumer Feedback System

## Overview

The blockchain integration provides **end-to-end traceability** for foie gras products from production through consumer feedback. This creates an immutable record that consumers can verify to ensure product authenticity.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    BLOCKCHAIN FLOW                              │
└─────────────────────────────────────────────────────────────────┘

1. GAVAGE PRODUCTION
   ├── Gaveur enters feeding data
   └── Data stored in gavage_data (hypertable)

2. SQAL QUALITY CONTROL
   ├── IoT sensors capture quality metrics
   │   ├── VL53L8CH ToF sensor (8x8 matrix)
   │   └── AS7341 spectral sensor (10 channels)
   ├── Quality score calculated
   └── → BLOCKCHAIN EVENT: sqal_quality_control
       └── Hash: abc123...

3. PRODUCT REGISTRATION
   ├── Product registered after SQAL approval
   ├── QR code generated
   └── → BLOCKCHAIN EVENT: consumer_product_registration
       ├── Hash: def456...
       └── Links: QR code ↔ Blockchain hash

4. CONSUMER SCAN
   ├── Consumer scans QR code
   ├── Backend retrieves product traceability
   └── Blockchain hash shown (verifiable)

5. BLOCKCHAIN VERIFICATION (Optional)
   ├── Consumer requests verification
   ├── GET /api/consumer/blockchain/verify/{hash}
   └── ✅ Authenticity confirmed
```

## Key Components

### 1. Blockchain Service

**File**: [backend-api/app/blockchain/blockchain_service.py](backend-api/app/blockchain/blockchain_service.py:469-645)

**New Methods**:

- `ajouter_evenement_sqal_quality()` - Records SQAL quality control events
- `ajouter_evenement_consumer_product()` - Records consumer product registration
- `verifier_product_blockchain()` - Verifies blockchain hash authenticity

**Block Structure**:
```python
Block {
    index: int
    timestamp: datetime
    type_evenement: str  # "sqal_quality_control" | "consumer_product_registration"
    canard_id: int
    gaveur_id: int
    donnees: Dict  # Event-specific data
    hash_precedent: str  # Previous block hash (chaining)
    hash_actuel: str  # SHA-256 hash of this block
    signature_numerique: str  # RSA signature
}
```

### 2. Consumer Feedback Service

**File**: [backend-api/app/services/consumer_feedback_service.py](backend-api/app/services/consumer_feedback_service.py:61-156)

**Enhanced Method**: `register_product_after_sqal()`

**Flow**:
1. Calls SQL function to create product + QR code
2. Retrieves product data (lot, site, SQAL scores)
3. Initializes blockchain if needed
4. Creates blockchain event for product
5. Links product to blockchain hash
6. Returns `(product_id, qr_code)`

**Blockchain Integration**:
```python
# Automatically adds blockchain event when product is registered
bloc = await self.blockchain.ajouter_evenement_consumer_product(
    product_id=product_id,
    lot_id=lot_id,
    gaveur_id=gaveur_id,
    donnees_produit={...}
)

# Updates product with blockchain hash
await self.link_product_to_blockchain(product_id, bloc.hash_actuel)
```

### 3. API Endpoints

**File**: [backend-api/app/routers/consumer_feedback.py](backend-api/app/routers/consumer_feedback.py:385-507)

#### New Endpoints:

**1. Verify Blockchain Hash** (PUBLIC)
```http
GET /api/consumer/blockchain/verify/{blockchain_hash}
```

**Response**:
```json
{
  "valid": true,
  "blockchain_hash": "abc123...",
  "timestamp": "2025-12-25T10:30:00Z",
  "type_evenement": "consumer_product_registration",
  "product_data": {
    "product_id": "PROD_LL_001",
    "lot_id": 42,
    "site_code": "LL",
    "sqal_quality_score": 95.5,
    "sqal_grade": "A+"
  },
  "verified_at": "2025-12-25T15:45:00Z",
  "message": "✅ Produit authentique - Traçabilité blockchain vérifiée"
}
```

**2. Get Product Blockchain History** (PUBLIC)
```http
GET /api/consumer/blockchain/product/{product_id}/history
```

**Response**:
```json
{
  "product_id": "PROD_LL_001",
  "blockchain_enabled": true,
  "blockchain_verified": true,
  "total_events": 2,
  "events": [
    {
      "index": 15,
      "timestamp": "2025-12-20T08:00:00Z",
      "type_evenement": "sqal_quality_control",
      "donnees": {
        "lot_id": 42,
        "sqal_score": 95.5,
        "sqal_grade": "A+",
        "sample_id": "SQAL_LL_042_001"
      },
      "hash": "abc123..."
    },
    {
      "index": 16,
      "timestamp": "2025-12-20T09:00:00Z",
      "type_evenement": "consumer_product_registration",
      "donnees": {
        "product_id": "PROD_LL_001",
        "lot_id": 42,
        "site_code": "LL",
        "packaging_date": "2025-12-20"
      },
      "hash": "def456..."
    }
  ],
  "message": "✅ 2 événement(s) blockchain trouvé(s)"
}
```

## Database Schema

### blockchain Table

```sql
CREATE TABLE blockchain (
    id SERIAL PRIMARY KEY,
    index INTEGER NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    type_evenement VARCHAR(100) NOT NULL,
    canard_id INTEGER,
    gaveur_id INTEGER,
    abattoir_id INTEGER,
    donnees JSONB NOT NULL,
    hash_precedent VARCHAR(64) NOT NULL,
    hash_actuel VARCHAR(64) NOT NULL UNIQUE,
    signature_numerique TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_blockchain_hash ON blockchain(hash_actuel);
CREATE INDEX idx_blockchain_type ON blockchain(type_evenement);
CREATE INDEX idx_blockchain_product ON blockchain USING gin(donnees);
```

### consumer_products Table (Enhanced)

```sql
ALTER TABLE consumer_products ADD COLUMN IF NOT EXISTS blockchain_hash VARCHAR(64);
ALTER TABLE consumer_products ADD COLUMN IF NOT EXISTS blockchain_verified BOOLEAN DEFAULT FALSE;

CREATE INDEX idx_consumer_products_blockchain ON consumer_products(blockchain_hash);
```

## Event Types

### 1. sqal_quality_control

**When**: After SQAL IoT sensors analyze a sample

**Data**:
```json
{
  "lot_id": 42,
  "sqal_score": 95.5,
  "sqal_grade": "A+",
  "sample_id": "SQAL_LL_042_001",
  "vl53l8ch_data": {...},
  "as7341_data": {...},
  "compliance": true,
  "control_timestamp": "2025-12-20T08:00:00Z"
}
```

### 2. consumer_product_registration

**When**: Product is registered for consumer sale

**Data**:
```json
{
  "product_id": "PROD_LL_001",
  "lot_id": 42,
  "site_code": "LL",
  "production_date": "2025-12-15",
  "packaging_date": "2025-12-20",
  "sqal_quality_score": 95.5,
  "sqal_grade": "A+",
  "qr_code": "SQAL_42_001_PROD_LL_001_XYZ",
  "certifications": ["IGP", "Label Rouge"]
}
```

## Cryptography

### Hash Algorithm

- **SHA-256** for block hashing
- 64-character hexadecimal output
- Includes all block data + previous hash (chaining)

### Digital Signatures

- **RSA-2048** key pairs per gaveur
- **PKCS#1 v1.5** signature scheme
- Private key signs block hash
- Public key stored in database for verification

### QR Code Security

QR codes include cryptographic signature:
```
Format: SQAL_{lot_id}_{sample_id}_{product_id}_{signature}

Example: SQAL_42_SAMPLE_001_PROD_LL_001_a3f8c2d1
```

The signature is generated from:
- Lot ID
- Sample ID
- Product ID
- Timestamp
- Secret salt

## Testing

### Unit Tests

**File**: [backend-api/tests/test_blockchain_consumer.py](backend-api/tests/test_blockchain_consumer.py)

**Run Tests**:
```bash
cd backend-api
source venv/bin/activate  # Windows: venv\Scripts\activate
python tests/test_blockchain_consumer.py
```

**Test Coverage**:
1. ✅ Blockchain initialization
2. ✅ Add SQAL quality event
3. ✅ Add consumer product event
4. ✅ Verify blockchain hash
5. ✅ Reject invalid hash
6. ✅ Check blockchain integrity
7. ✅ E2E product registration with blockchain

### Manual Testing

**1. Register a Product**:
```bash
curl -X POST http://localhost:8000/api/consumer/internal/register-product \
  -H "Content-Type: application/json" \
  -d '{
    "lot_id": 1,
    "sample_id": "SQAL_TEST_001",
    "site_code": "LL"
  }'
```

**Response**:
```json
{
  "success": true,
  "product_id": "PROD_LL_001_20251225",
  "qr_code": "SQAL_1_SQAL_TEST_001_PROD_LL_001_20251225_abc123",
  "message": "Produit enregistré avec succès. QR code prêt pour impression."
}
```

**2. Scan QR Code**:
```bash
curl http://localhost:8000/api/consumer/scan/SQAL_1_SQAL_TEST_001_PROD_LL_001_20251225_abc123
```

**Response** (includes blockchain_hash):
```json
{
  "success": true,
  "traceability": {
    "product_id": "PROD_LL_001_20251225",
    "blockchain_hash": "def456789...",
    "blockchain_verified": true,
    ...
  }
}
```

**3. Verify Blockchain**:
```bash
curl http://localhost:8000/api/consumer/blockchain/verify/def456789...
```

**Response**:
```json
{
  "valid": true,
  "message": "✅ Produit authentique - Traçabilité blockchain vérifiée"
}
```

## Consumer Mobile App Integration

### QR Scan Flow (Consumer App)

```javascript
// 1. Consumer scans QR code
const qrCode = scanQRCode();

// 2. Fetch product traceability
const response = await fetch(`/api/consumer/scan/${qrCode}`);
const { traceability } = await response.json();

// 3. Display product info + blockchain badge
if (traceability.blockchain_verified) {
  showBlockchainBadge(traceability.blockchain_hash);
}

// 4. User can verify blockchain (optional)
const verifyBlockchain = async (hash) => {
  const result = await fetch(`/api/consumer/blockchain/verify/${hash}`);
  const { valid, message } = await result.json();

  if (valid) {
    showSuccessMessage("✅ Produit authentique vérifié sur blockchain");
  } else {
    showWarningMessage("⚠️ Impossible de vérifier la blockchain");
  }
};
```

### UI Elements

**Blockchain Badge** (shown on product detail page):
```
┌─────────────────────────────────┐
│ 🔗 Traçabilité Blockchain       │
│                                 │
│ ✅ Produit vérifié              │
│                                 │
│ Hash: def456...                 │
│ Date: 2025-12-20 09:00          │
│                                 │
│ [Voir l'historique complet]     │
└─────────────────────────────────┘
```

**Verification Screen**:
```
┌─────────────────────────────────┐
│ Vérification Blockchain         │
│                                 │
│ ✅ Authentique                  │
│                                 │
│ Événement: Enregistrement       │
│ Date: 2025-12-20 09:00 UTC      │
│ Lot: #42 (Site LL)              │
│ Qualité SQAL: 95.5/100 (A+)     │
│                                 │
│ Ce produit est authentique et   │
│ sa traçabilité a été vérifiée   │
│ sur la blockchain.              │
└─────────────────────────────────┘
```

## Security Considerations

### ✅ Implemented

1. **Immutability**: Blockchain records cannot be modified
2. **Hash Verification**: SHA-256 ensures data integrity
3. **Digital Signatures**: RSA-2048 prevents forgery
4. **Chaining**: Each block references previous block hash
5. **Timestamping**: All events are timestamped

### ⚠️ Future Enhancements

1. **Distributed Blockchain**: Currently centralized in PostgreSQL
   - **Recommendation**: Migrate to Hyperledger Fabric for true distributed consensus

2. **Key Management**: Private keys stored in memory
   - **Recommendation**: Use HSM (Hardware Security Module) or cloud KMS

3. **Public Verification**: Consumers trust backend verification
   - **Recommendation**: Expose public blockchain explorer

4. **Smart Contracts**: No automated business logic on blockchain
   - **Recommendation**: Implement Hyperledger Fabric chaincode

## Migration to Hyperledger Fabric

The current implementation is a **simplified blockchain** stored in PostgreSQL. For production, migrate to **Hyperledger Fabric**:

### Current (PostgreSQL)
- ✅ Fast development
- ✅ Integrated with existing database
- ❌ Centralized (single point of trust)
- ❌ No consensus mechanism

### Target (Hyperledger Fabric)
- ✅ Distributed ledger
- ✅ Multi-organization consensus
- ✅ Chaincode (smart contracts)
- ✅ Industry-standard for supply chain
- ❌ Higher complexity

### Migration Path

1. Keep current PostgreSQL blockchain for development
2. Export blockchain events to Fabric chaincode
3. Run dual-write: PostgreSQL + Fabric
4. Gradually migrate verification to Fabric
5. Deprecate PostgreSQL blockchain once Fabric is stable

## Summary

The blockchain integration provides:

- ✅ **Immutable traceability** from production to consumer
- ✅ **Cryptographic verification** of product authenticity
- ✅ **Public transparency** via verification endpoints
- ✅ **Closed feedback loop** connecting production → quality → consumer satisfaction
- ✅ **Foundation for Hyperledger Fabric** migration

This creates **trust** between producers (Euralis), quality control (SQAL), and consumers through verifiable, tamper-proof records.
