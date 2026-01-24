"""
Unit Tests - Blockchain Consumer Feedback Integration
Tests les nouvelles méthodes blockchain pour traçabilité consommateur
"""

import pytest
from datetime import datetime
from app.blockchain.blockchain_service import GaveursBlockchain


@pytest.mark.unit
@pytest.mark.blockchain
@pytest.mark.asyncio
class TestBlockchainConsumerFeedback:
    """Tests unitaires pour intégration blockchain consumer feedback"""

    async def test_01_blockchain_initialization(self, db_pool):
        """Test 1: Vérifier initialisation blockchain"""
        blockchain = GaveursBlockchain(db_pool)
        await blockchain.initialiser_blockchain(gaveur_id=1, canard_ids=[])

        assert blockchain is not None
        assert blockchain.initialise is True
        assert len(blockchain.chaine) > 0
        print("✅ Test 1: Blockchain initialisée correctement")

    async def test_02_add_sqal_quality_event(self, db_pool):
        """Test 2: Ajouter événement contrôle qualité SQAL"""
        blockchain = GaveursBlockchain(db_pool)
        await blockchain.initialiser_blockchain(gaveur_id=1, canard_ids=[])

        donnees_sqal = {
            "sqal_score": 95.5,
            "sqal_grade": "A+",
            "sample_id": "SQAL_TEST_001",
            "vl53l8ch_data": [[100] * 8 for _ in range(8)],
            "as7341_data": {
                "415nm": 1000,
                "clear": 12000
            },
            "compliance": True,
            "control_timestamp": datetime.utcnow().isoformat()
        }

        bloc = await blockchain.ajouter_evenement_sqal_quality(
            lot_id=1,
            gaveur_id=1,
            donnees_sqal=donnees_sqal
        )

        assert bloc is not None
        assert bloc.type_evenement == "sqal_quality_control"
        assert bloc.hash_actuel is not None
        assert len(bloc.hash_actuel) == 64  # SHA-256
        assert bloc.donnees["sqal_score"] == 95.5
        assert bloc.donnees["sqal_grade"] == "A+"
        print(f"✅ Test 2: Événement SQAL ajouté - Hash: {bloc.hash_actuel[:16]}...")

    async def test_03_add_consumer_product_event(self, db_pool):
        """Test 3: Ajouter événement enregistrement produit consommateur"""
        blockchain = GaveursBlockchain(db_pool)
        await blockchain.initialiser_blockchain(gaveur_id=1, canard_ids=[])

        donnees_produit = {
            "product_id": "PROD_TEST_001",
            "site_code": "LL",
            "production_date": datetime.utcnow().isoformat(),
            "packaging_date": datetime.utcnow().isoformat(),
            "sqal_quality_score": 95.5,
            "sqal_grade": "A+",
            "qr_code": "SQAL_1_SAMPLE_001_PROD_001_ABC123",
            "certifications": ["IGP", "Label Rouge"]
        }

        bloc = await blockchain.ajouter_evenement_consumer_product(
            product_id="PROD_TEST_001",
            lot_id=1,
            gaveur_id=1,
            donnees_produit=donnees_produit
        )

        assert bloc is not None
        assert bloc.type_evenement == "consumer_product_registration"
        assert bloc.hash_actuel is not None
        assert bloc.donnees["product_id"] == "PROD_TEST_001"
        assert bloc.donnees["site_code"] == "LL"
        assert len(bloc.donnees["certifications"]) == 2
        print(f"✅ Test 3: Produit enregistré - Hash: {bloc.hash_actuel[:16]}...")

    async def test_04_verify_valid_blockchain_hash(self, db_pool):
        """Test 4: Vérifier hash blockchain valide"""
        blockchain = GaveursBlockchain(db_pool)
        await blockchain.initialiser_blockchain(gaveur_id=1, canard_ids=[])

        # Créer un produit
        donnees_produit = {
            "product_id": "PROD_TEST_002",
            "site_code": "LS",
            "production_date": datetime.utcnow().isoformat(),
            "sqal_quality_score": 92.0,
            "sqal_grade": "A",
            "qr_code": "SQAL_2_SAMPLE_002_PROD_002_XYZ456"
        }

        bloc = await blockchain.ajouter_evenement_consumer_product(
            product_id="PROD_TEST_002",
            lot_id=2,
            gaveur_id=1,
            donnees_produit=donnees_produit
        )

        # Vérifier le hash
        verification = await blockchain.verifier_product_blockchain(bloc.hash_actuel)

        assert verification["valid"] is True
        assert verification["data"]["product_id"] == "PROD_TEST_002"
        assert "verified_at" in verification
        assert "timestamp" in verification
        print(f"✅ Test 4: Hash vérifié avec succès")

    async def test_05_verify_invalid_blockchain_hash(self, db_pool):
        """Test 5: Vérifier qu'un hash invalide est rejeté"""
        blockchain = GaveursBlockchain(db_pool)
        await blockchain.initialiser_blockchain(gaveur_id=1, canard_ids=[])

        fake_hash = "0" * 64  # Hash invalide

        verification = await blockchain.verifier_product_blockchain(fake_hash)

        assert verification["valid"] is False
        assert "error" in verification
        assert verification["data"] is None
        print(f"✅ Test 5: Hash invalide correctement rejeté")

    async def test_06_blockchain_integrity(self, db_pool):
        """Test 6: Vérifier intégrité complète de la blockchain"""
        blockchain = GaveursBlockchain(db_pool)
        await blockchain.initialiser_blockchain(gaveur_id=1, canard_ids=[])

        # Ajouter plusieurs blocs
        for i in range(3):
            await blockchain.ajouter_evenement_consumer_product(
                product_id=f"PROD_TEST_{i:03d}",
                lot_id=i + 1,
                gaveur_id=1,
                donnees_produit={
                    "product_id": f"PROD_TEST_{i:03d}",
                    "site_code": "LL",
                    "sqal_quality_score": 90.0 + i,
                    "sqal_grade": "A"
                }
            )

        # Vérifier intégrité
        resultat = await blockchain.verifier_integrite_chaine()

        assert resultat["valide"] is True
        assert len(resultat["erreurs"]) == 0
        assert resultat["blocs_verifies"] >= 3
        print(f"✅ Test 6: Intégrité blockchain vérifiée ({resultat['blocs_verifies']} blocs)")

    async def test_07_blockchain_chaining(self, db_pool):
        """Test 7: Vérifier chaînage correct des blocs"""
        blockchain = GaveursBlockchain(db_pool)
        await blockchain.initialiser_blockchain(gaveur_id=1, canard_ids=[])

        # Ajouter 2 blocs
        bloc1 = await blockchain.ajouter_evenement_consumer_product(
            product_id="PROD_CHAIN_001",
            lot_id=1,
            gaveur_id=1,
            donnees_produit={"product_id": "PROD_CHAIN_001"}
        )

        bloc2 = await blockchain.ajouter_evenement_consumer_product(
            product_id="PROD_CHAIN_002",
            lot_id=2,
            gaveur_id=1,
            donnees_produit={"product_id": "PROD_CHAIN_002"}
        )

        # Vérifier chaînage
        assert bloc2.hash_precedent == bloc1.hash_actuel
        print(f"✅ Test 7: Chaînage correct bloc1 → bloc2")

    async def test_08_sqal_event_data_integrity(self, db_pool):
        """Test 8: Vérifier intégrité données SQAL dans blockchain"""
        blockchain = GaveursBlockchain(db_pool)
        await blockchain.initialiser_blockchain(gaveur_id=1, canard_ids=[])

        # Données SQAL complètes
        donnees_sqal = {
            "sqal_score": 97.3,
            "sqal_grade": "A++",
            "sample_id": "SQAL_INTEGRITY_TEST",
            "vl53l8ch_data": [[i * j for i in range(8)] for j in range(8)],
            "as7341_data": {
                "415nm": 1234,
                "445nm": 2345,
                "480nm": 3456,
                "515nm": 4567,
                "555nm": 5678,
                "590nm": 6789,
                "630nm": 7890,
                "680nm": 8901,
                "clear": 15000,
                "nir": 950
            },
            "compliance": True,
            "control_timestamp": "2024-12-25T10:30:00Z"
        }

        bloc = await blockchain.ajouter_evenement_sqal_quality(
            lot_id=42,
            gaveur_id=1,
            donnees_sqal=donnees_sqal
        )

        # Vérifier toutes les données
        assert bloc.donnees["sqal_score"] == 97.3
        assert bloc.donnees["sqal_grade"] == "A++"
        assert bloc.donnees["lot_id"] == 42
        assert len(bloc.donnees["vl53l8ch_data"]) == 8
        assert len(bloc.donnees["as7341_data"]) == 10
        assert bloc.donnees["compliance"] is True
        print(f"✅ Test 8: Intégrité données SQAL complètes vérifiée")

    async def test_09_product_certifications_storage(self, db_pool):
        """Test 9: Vérifier stockage certifications produit"""
        blockchain = GaveursBlockchain(db_pool)
        await blockchain.initialiser_blockchain(gaveur_id=1, canard_ids=[])

        certifications = ["IGP", "Label Rouge", "Bio", "AOC Canard à Foie Gras du Sud-Ouest"]

        donnees_produit = {
            "product_id": "PROD_CERT_001",
            "site_code": "MT",
            "certifications": certifications
        }

        bloc = await blockchain.ajouter_evenement_consumer_product(
            product_id="PROD_CERT_001",
            lot_id=1,
            gaveur_id=1,
            donnees_produit=donnees_produit
        )

        assert len(bloc.donnees["certifications"]) == 4
        assert "IGP" in bloc.donnees["certifications"]
        assert "Label Rouge" in bloc.donnees["certifications"]
        print(f"✅ Test 9: Certifications stockées correctement ({len(certifications)} labels)")

    async def test_10_multiple_sites_blockchain(self, db_pool):
        """Test 10: Vérifier support multi-sites dans blockchain"""
        blockchain = GaveursBlockchain(db_pool)
        await blockchain.initialiser_blockchain(gaveur_id=1, canard_ids=[])

        sites = ["LL", "LS", "MT"]
        blocs = []

        for i, site in enumerate(sites):
            bloc = await blockchain.ajouter_evenement_consumer_product(
                product_id=f"PROD_{site}_{i:03d}",
                lot_id=i + 1,
                gaveur_id=1,
                donnees_produit={
                    "product_id": f"PROD_{site}_{i:03d}",
                    "site_code": site,
                    "sqal_grade": "A"
                }
            )
            blocs.append(bloc)

        # Vérifier tous les sites
        for i, bloc in enumerate(blocs):
            assert bloc.donnees["site_code"] == sites[i]

        print(f"✅ Test 10: Multi-sites supportés (LL, LS, MT)")
