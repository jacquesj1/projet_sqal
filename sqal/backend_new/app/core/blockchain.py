"""
Blockchain Integration Module
Generates cryptographic hashes for quality data immutability and traceability
"""
import hashlib
import json
from datetime import datetime
from typing import Dict, Any, Optional
import qrcode
import io
import base64
from pydantic import BaseModel


class BlockchainData(BaseModel):
    """Data structure for blockchain certification"""
    timestamp: str
    sample_id: str
    device_id: str
    lot_abattage: Optional[str] = None
    eleveur: Optional[str] = None
    provenance: Optional[str] = None
    vl53l8ch_score: float
    as7341_score: float
    fusion_final_score: float
    fusion_final_grade: str
    defects: list = []


def generate_blockchain_hash(quality_data: Dict[str, Any]) -> str:
    """
    Generate SHA-256 blockchain hash for quality data

    Args:
        quality_data: Dictionary containing quality analysis results

    Returns:
        Hex string blockchain hash with 0x prefix

    Example:
        >>> data = {
        ...     "sample_id": "SAMPLE-001",
        ...     "fusion_final_score": 0.87,
        ...     "fusion_final_grade": "A"
        ... }
        >>> hash = generate_blockchain_hash(data)
        >>> print(hash)
        0x1a2b3c4d5e6f...
    """
    # Create immutable data structure
    blockchain_data = {
        "timestamp": quality_data.get("timestamp", datetime.utcnow().isoformat()),
        "sample_id": quality_data.get("sample_id"),
        "device_id": quality_data.get("device_id"),
        "lot_abattage": quality_data.get("lot_abattage"),
        "eleveur": quality_data.get("eleveur"),
        "provenance": quality_data.get("provenance"),
        "vl53l8ch_score": quality_data.get("vl53l8ch_score"),
        "as7341_score": quality_data.get("as7341_score"),
        "fusion_final_score": quality_data.get("fusion_final_score"),
        "fusion_final_grade": quality_data.get("fusion_final_grade"),
        "defects": quality_data.get("defects", [])
    }

    # Convert to deterministic JSON string (sorted keys)
    data_string = json.dumps(blockchain_data, sort_keys=True, ensure_ascii=False)

    # Generate SHA-256 hash
    hash_obj = hashlib.sha256(data_string.encode('utf-8'))
    blockchain_hash = hash_obj.hexdigest()

    return f"0x{blockchain_hash}"


def generate_qr_code(blockchain_hash: str, size: int = 256) -> str:
    """
    Generate QR code for blockchain hash

    Args:
        blockchain_hash: Blockchain hash to encode
        size: QR code size in pixels (default: 256)

    Returns:
        Base64-encoded PNG image string

    Example:
        >>> hash = "0x1a2b3c4d5e6f..."
        >>> qr_base64 = generate_qr_code(hash)
        >>> print(qr_base64[:50])
        iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAA...
    """
    # Create QR code instance
    qr = qrcode.QRCode(
        version=1,  # Auto-size
        error_correction=qrcode.constants.ERROR_CORRECT_H,  # High error correction (30%)
        box_size=10,
        border=4,
    )

    # Add blockchain hash data
    qr.add_data(blockchain_hash)
    qr.make(fit=True)

    # Create image
    img = qr.make_image(fill_color="black", back_color="white")

    # Resize to requested size
    img = img.resize((size, size))

    # Convert to base64
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    img_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')

    return img_base64


def certify_quality_analysis(
    sample_id: str,
    device_id: str,
    vl53l8ch_score: float,
    as7341_score: float,
    fusion_final_score: float,
    fusion_final_grade: str,
    defects: list = None,
    lot_abattage: str = None,
    eleveur: str = None,
    provenance: str = None,
    generate_qr: bool = True
) -> Dict[str, str]:
    """
    Complete blockchain certification of quality analysis

    Args:
        sample_id: Unique sample identifier
        device_id: Device that performed the analysis
        vl53l8ch_score: VL53L8CH quality score
        as7341_score: AS7341 quality score
        fusion_final_score: Final fused score
        fusion_final_grade: Final quality grade (A+, A, B, C, REJECT)
        defects: List of detected defects
        lot_abattage: Slaughter batch number
        eleveur: Farmer name
        provenance: Origin/provenance
        generate_qr: Whether to generate QR code (default: True)

    Returns:
        Dictionary containing:
        - blockchain_hash: SHA-256 hash
        - blockchain_timestamp: ISO timestamp
        - qr_code_base64: Base64-encoded QR code (if generate_qr=True)
        - status: "certified"

    Example:
        >>> result = certify_quality_analysis(
        ...     sample_id="SAMPLE-001",
        ...     device_id="ESP32-001",
        ...     vl53l8ch_score=0.87,
        ...     as7341_score=0.85,
        ...     fusion_final_score=0.86,
        ...     fusion_final_grade="A+",
        ...     lot_abattage="LOT-2025-001",
        ...     eleveur="Ferme Dupont"
        ... )
        >>> print(result.keys())
        dict_keys(['blockchain_hash', 'blockchain_timestamp', 'qr_code_base64', 'status'])
    """
    # Prepare quality data
    quality_data = {
        "timestamp": datetime.utcnow().isoformat(),
        "sample_id": sample_id,
        "device_id": device_id,
        "lot_abattage": lot_abattage,
        "eleveur": eleveur,
        "provenance": provenance,
        "vl53l8ch_score": vl53l8ch_score,
        "as7341_score": as7341_score,
        "fusion_final_score": fusion_final_score,
        "fusion_final_grade": fusion_final_grade,
        "defects": defects or []
    }

    # Generate blockchain hash
    blockchain_hash = generate_blockchain_hash(quality_data)
    blockchain_timestamp = datetime.utcnow()

    # Prepare result
    result = {
        "blockchain_hash": blockchain_hash,
        "blockchain_timestamp": blockchain_timestamp.isoformat(),
        "status": "certified"
    }

    # Generate QR code if requested
    if generate_qr:
        qr_code_base64 = generate_qr_code(blockchain_hash)
        result["qr_code_base64"] = qr_code_base64

    return result


def verify_blockchain_hash(
    blockchain_hash: str,
    quality_data: Dict[str, Any]
) -> bool:
    """
    Verify blockchain hash integrity

    Args:
        blockchain_hash: Hash to verify
        quality_data: Original quality data

    Returns:
        True if hash is valid, False otherwise

    Example:
        >>> data = {"sample_id": "SAMPLE-001", "fusion_final_score": 0.87, ...}
        >>> hash = generate_blockchain_hash(data)
        >>> is_valid = verify_blockchain_hash(hash, data)
        >>> print(is_valid)
        True
    """
    # Regenerate hash from data
    regenerated_hash = generate_blockchain_hash(quality_data)

    # Compare hashes
    return blockchain_hash == regenerated_hash


# ============================================================================
# Blockchain Storage (Future Implementation)
# ============================================================================

async def store_on_blockchain(
    blockchain_hash: str,
    quality_data: Dict[str, Any],
    blockchain_type: str = "private"
) -> Optional[str]:
    """
    Store hash on actual blockchain (Ethereum, Polygon, Hyperledger, etc.)

    This is a placeholder for future blockchain integration.

    Args:
        blockchain_hash: Hash to store
        quality_data: Quality data metadata
        blockchain_type: "public" or "private"

    Returns:
        Transaction hash or record ID

    Future Implementation Options:
        - Ethereum/Polygon: Use web3.py
        - Hyperledger Fabric: Use fabric-sdk-py
        - Private chain: Use custom API
    """
    # TODO: Implement actual blockchain storage
    #
    # Example for Ethereum:
    # from web3 import Web3
    # w3 = Web3(Web3.HTTPProvider('https://polygon-rpc.com'))
    # contract = w3.eth.contract(address=CONTRACT_ADDRESS, abi=CONTRACT_ABI)
    # tx_hash = contract.functions.certifyQuality(
    #     blockchain_hash,
    #     quality_data['sample_id'],
    #     quality_data['fusion_final_grade']
    # ).transact({'from': account})
    # return tx_hash.hex()

    return None


async def verify_on_blockchain(
    blockchain_hash: str,
    blockchain_type: str = "private"
) -> Optional[Dict[str, Any]]:
    """
    Verify hash exists on blockchain

    This is a placeholder for future blockchain verification.

    Args:
        blockchain_hash: Hash to verify
        blockchain_type: "public" or "private"

    Returns:
        Blockchain record if found, None otherwise
    """
    # TODO: Implement actual blockchain verification
    return None
