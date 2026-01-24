import hashlib
import json
from datetime import datetime
from typing import Dict, List, Optional
import asyncpg
from Crypto.PublicKey import RSA
from Crypto.Signature import pkcs1_15
from Crypto.Hash import SHA256
import logging

logger = logging.getLogger(__name__)


class Block:
    """
    Bloc de la blockchain contenant les données de gavage
    """
    
    def __init__(
        self,
        index: int,
        timestamp: datetime,
        type_evenement: str,
        canard_id: int,
        gaveur_id: int,
        donnees: Dict,
        hash_precedent: str,
        abattoir_id: Optional[int] = None
    ):
        self.index = index
        self.timestamp = timestamp
        self.type_evenement = type_evenement
        self.canard_id = canard_id
        self.gaveur_id = gaveur_id
        self.abattoir_id = abattoir_id
        self.donnees = donnees
        self.hash_precedent = hash_precedent
        self.hash_actuel = self.calculer_hash()
        self.signature_numerique = ""
    
    def calculer_hash(self) -> str:
        """Calcule le hash SHA-256 du bloc"""
        contenu = {
            "index": self.index,
            "timestamp": self.timestamp.isoformat(),
            "type_evenement": self.type_evenement,
            "canard_id": self.canard_id,
            "gaveur_id": self.gaveur_id,
            "abattoir_id": self.abattoir_id,
            "donnees": self.donnees,
            "hash_precedent": self.hash_precedent
        }
        
        contenu_str = json.dumps(contenu, sort_keys=True)
        return hashlib.sha256(contenu_str.encode()).hexdigest()
    
    def signer_bloc(self, cle_privee: RSA.RsaKey):
        """Signe le bloc avec la clé privée"""
        h = SHA256.new(self.hash_actuel.encode())
        signature = pkcs1_15.new(cle_privee).sign(h)
        self.signature_numerique = signature.hex()
    
    def verifier_signature(self, cle_publique: RSA.RsaKey) -> bool:
        """Vérifie la signature du bloc"""
        try:
            h = SHA256.new(self.hash_actuel.encode())
            signature_bytes = bytes.fromhex(self.signature_numerique)
            pkcs1_15.new(cle_publique).verify(h, signature_bytes)
            return True
        except (ValueError, TypeError):
            return False
    
    def to_dict(self) -> Dict:
        """Convertit le bloc en dictionnaire"""
        return {
            "index": self.index,
            "timestamp": self.timestamp.isoformat(),
            "type_evenement": self.type_evenement,
            "canard_id": self.canard_id,
            "gaveur_id": self.gaveur_id,
            "abattoir_id": self.abattoir_id,
            "donnees": self.donnees,
            "hash_precedent": self.hash_precedent,
            "hash_actuel": self.hash_actuel,
            "signature_numerique": self.signature_numerique
        }


class GaveursBlockchain:
    """
    Blockchain pour traçabilité complète de la filière foie gras
    De la naissance du canard jusqu'à l'abattoir
    """
    
    def __init__(self, db_pool: asyncpg.Pool):
        self.db_pool = db_pool
        self.chaine: List[Block] = []
        self.cles_gaveurs: Dict[int, Dict] = {}  # {gaveur_id: {public, private}}
        self.initialise = False
    
    async def initialiser_blockchain(self, gaveur_id: int, canard_ids: List[int]):
        """
        Initialise la blockchain pour un gaveur et ses canards
        
        Args:
            gaveur_id: ID du gaveur
            canard_ids: Liste des IDs de canards à tracer
        """
        logger.info(f"Initialisation blockchain pour gaveur {gaveur_id}, {len(canard_ids)} canards")
        
        # Générer les clés RSA pour le gaveur s'il n'en a pas
        if gaveur_id not in self.cles_gaveurs:
            await self._generer_cles_gaveur(gaveur_id)
        
        # Créer le bloc genesis
        if not self.chaine:
            bloc_genesis = Block(
                index=0,
                timestamp=datetime.utcnow(),
                type_evenement="genesis",
                canard_id=0,
                gaveur_id=gaveur_id,
                donnees={
                    "description": "Bloc Genesis - Système Gaveurs V2.1",
                    "version": "2.1.0",
                    "date_creation": datetime.utcnow().isoformat()
                },
                hash_precedent="0"
            )
            
            bloc_genesis.signer_bloc(self.cles_gaveurs[gaveur_id]["private"])
            self.chaine.append(bloc_genesis)
            await self._sauvegarder_bloc(bloc_genesis)
        
        # Créer un bloc d'initialisation pour chaque canard
        for canard_id in canard_ids:
            await self._creer_bloc_initialisation_canard(gaveur_id, canard_id)
        
        self.initialise = True
        logger.info("Blockchain initialisée avec succès")
    
    async def _generer_cles_gaveur(self, gaveur_id: int):
        """Génère une paire de clés RSA pour un gaveur"""
        key = RSA.generate(2048)
        
        self.cles_gaveurs[gaveur_id] = {
            "private": key,
            "public": key.publickey()
        }
        
        # Sauvegarder la clé publique dans la DB
        cle_publique_pem = key.publickey().export_key().decode()
        
        query = """
        UPDATE gaveurs 
        SET cle_publique_blockchain = $1
        WHERE id = $2
        """
        
        async with self.db_pool.acquire() as conn:
            await conn.execute(query, cle_publique_pem, gaveur_id)
        
        logger.info(f"Clés RSA générées pour gaveur {gaveur_id}")
    
    async def _creer_bloc_initialisation_canard(self, gaveur_id: int, canard_id: int):
        """Crée le bloc d'initialisation pour un canard"""
        # Récupérer les infos du canard
        query = """
        SELECT 
            numero_identification,
            genetique,
            date_naissance,
            origine_elevage,
            numero_lot_canard,
            poids_initial
        FROM canards
        WHERE id = $1
        """
        
        async with self.db_pool.acquire() as conn:
            canard = await conn.fetchrow(query, canard_id)
        
        if not canard:
            raise ValueError(f"Canard {canard_id} non trouvé")
        
        bloc = Block(
            index=len(self.chaine),
            timestamp=datetime.utcnow(),
            type_evenement="initialisation_canard",
            canard_id=canard_id,
            gaveur_id=gaveur_id,
            donnees={
                "numero_identification": canard["numero_identification"],
                "genetique": canard["genetique"],
                "date_naissance": canard["date_naissance"].isoformat(),
                "origine_elevage": canard["origine_elevage"],
                "numero_lot": canard["numero_lot_canard"],
                "poids_initial": float(canard["poids_initial"])
            },
            hash_precedent=self.chaine[-1].hash_actuel
        )
        
        bloc.signer_bloc(self.cles_gaveurs[gaveur_id]["private"])
        self.chaine.append(bloc)
        await self._sauvegarder_bloc(bloc)
    
    async def ajouter_evenement_gavage(
        self,
        canard_id: int,
        gaveur_id: int,
        donnees_gavage: Dict
    ) -> Block:
        """
        Ajoute un événement de gavage à la blockchain
        
        Args:
            canard_id: ID du canard
            gaveur_id: ID du gaveur
            donnees_gavage: Données complètes du gavage (doses, poids, température, etc.)
            
        Returns:
            Bloc créé
        """
        if not self.initialise:
            raise RuntimeError("Blockchain non initialisée")
        
        bloc = Block(
            index=len(self.chaine),
            timestamp=datetime.utcnow(),
            type_evenement="gavage",
            canard_id=canard_id,
            gaveur_id=gaveur_id,
            donnees=donnees_gavage,
            hash_precedent=self.chaine[-1].hash_actuel
        )
        
        if gaveur_id not in self.cles_gaveurs:
            await self._generer_cles_gaveur(gaveur_id)
        
        bloc.signer_bloc(self.cles_gaveurs[gaveur_id]["private"])
        self.chaine.append(bloc)
        await self._sauvegarder_bloc(bloc)
        
        logger.info(f"Bloc gavage ajouté: canard {canard_id}, index {bloc.index}")
        return bloc
    
    async def ajouter_evenement_pesee(
        self,
        canard_id: int,
        gaveur_id: int,
        poids: float,
        session: str
    ) -> Block:
        """Ajoute un événement de pesée"""
        bloc = Block(
            index=len(self.chaine),
            timestamp=datetime.utcnow(),
            type_evenement="pesee",
            canard_id=canard_id,
            gaveur_id=gaveur_id,
            donnees={
                "poids": poids,
                "session": session,
                "unite": "grammes"
            },
            hash_precedent=self.chaine[-1].hash_actuel
        )
        
        bloc.signer_bloc(self.cles_gaveurs[gaveur_id]["private"])
        self.chaine.append(bloc)
        await self._sauvegarder_bloc(bloc)
        
        return bloc
    
    async def ajouter_evenement_abattage(
        self,
        canard_id: int,
        gaveur_id: int,
        abattoir_id: int,
        donnees_abattage: Dict
    ) -> Block:
        """
        Ajoute l'événement final d'abattage
        Marque la fin de traçabilité pour ce canard
        """
        bloc = Block(
            index=len(self.chaine),
            timestamp=datetime.utcnow(),
            type_evenement="abattage",
            canard_id=canard_id,
            gaveur_id=gaveur_id,
            abattoir_id=abattoir_id,
            donnees=donnees_abattage,
            hash_precedent=self.chaine[-1].hash_actuel
        )
        
        bloc.signer_bloc(self.cles_gaveurs[gaveur_id]["private"])
        self.chaine.append(bloc)
        await self._sauvegarder_bloc(bloc)
        
        logger.info(f"Événement abattage enregistré: canard {canard_id}")
        return bloc
    
    async def _sauvegarder_bloc(self, bloc: Block):
        """Sauvegarde un bloc dans TimescaleDB"""
        query = """
        INSERT INTO blockchain (
            index,
            timestamp,
            type_evenement,
            canard_id,
            gaveur_id,
            abattoir_id,
            donnees,
            hash_precedent,
            hash_actuel,
            signature_numerique
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        """
        
        async with self.db_pool.acquire() as conn:
            await conn.execute(
                query,
                bloc.index,
                bloc.timestamp,
                bloc.type_evenement,
                bloc.canard_id,
                bloc.gaveur_id,
                bloc.abattoir_id,
                json.dumps(bloc.donnees),
                bloc.hash_precedent,
                bloc.hash_actuel,
                bloc.signature_numerique
            )
    
    async def verifier_integrite_chaine(self) -> Dict:
        """
        Vérifie l'intégrité de toute la blockchain
        
        Returns:
            Dict avec résultat de vérification
        """
        if not self.chaine:
            return {"valide": True, "erreurs": [], "blocs_verifies": 0}
        
        erreurs = []
        
        for i in range(1, len(self.chaine)):
            bloc_actuel = self.chaine[i]
            bloc_precedent = self.chaine[i-1]
            
            # Vérifier le hash du bloc actuel
            if bloc_actuel.hash_actuel != bloc_actuel.calculer_hash():
                erreurs.append(f"Bloc {i}: Hash actuel invalide")
            
            # Vérifier le chaînage
            if bloc_actuel.hash_precedent != bloc_precedent.hash_actuel:
                erreurs.append(f"Bloc {i}: Chaînage rompu")
            
            # Vérifier la signature
            gaveur_id = bloc_actuel.gaveur_id
            if gaveur_id in self.cles_gaveurs:
                if not bloc_actuel.verifier_signature(self.cles_gaveurs[gaveur_id]["public"]):
                    erreurs.append(f"Bloc {i}: Signature invalide")
        
        return {
            "valide": len(erreurs) == 0,
            "erreurs": erreurs,
            "blocs_verifies": len(self.chaine)
        }
    
    async def get_historique_canard(self, canard_id: int) -> List[Dict]:
        """
        Récupère tout l'historique blockchain d'un canard
        
        Returns:
            Liste chronologique de tous les événements
        """
        query = """
        SELECT 
            index,
            timestamp,
            type_evenement,
            donnees,
            hash_actuel,
            signature_numerique,
            gaveur_id,
            abattoir_id
        FROM blockchain
        WHERE canard_id = $1
        ORDER BY index ASC
        """
        
        async with self.db_pool.acquire() as conn:
            records = await conn.fetch(query, canard_id)
        
        historique = []
        for record in records:
            historique.append({
                "index": record["index"],
                "timestamp": record["timestamp"].isoformat(),
                "type_evenement": record["type_evenement"],
                "donnees": json.loads(record["donnees"]),
                "hash": record["hash_actuel"],
                "gaveur_id": record["gaveur_id"],
                "abattoir_id": record["abattoir_id"]
            })
        
        return historique
    
    async def generer_certificat_tracabilite(self, canard_id: int) -> Dict:
        """
        Génère un certificat de traçabilité complet pour le consommateur
        
        Returns:
            Certificat avec toutes les informations vérifiables
        """
        historique = await self.get_historique_canard(canard_id)
        
        if not historique:
            raise ValueError(f"Aucun historique pour canard {canard_id}")
        
        # Extraire les informations clés
        init_data = next(
            (h for h in historique if h["type_evenement"] == "initialisation_canard"),
            None
        )
        
        gavages = [h for h in historique if h["type_evenement"] == "gavage"]
        abattage = next(
            (h for h in historique if h["type_evenement"] == "abattage"),
            None
        )
        
        # Calculer statistiques
        if gavages:
            duree_gavage = (
                datetime.fromisoformat(gavages[-1]["timestamp"]) -
                datetime.fromisoformat(gavages[0]["timestamp"])
            ).days
            
            doses_totales = sum(
                g["donnees"].get("dose_matin", 0) + g["donnees"].get("dose_soir", 0)
                for g in gavages
            )
        else:
            duree_gavage = 0
            doses_totales = 0
        
        certificat = {
            "canard_id": canard_id,
            "numero_identification": init_data["donnees"]["numero_identification"] if init_data else "N/A",
            "genetique": init_data["donnees"]["genetique"] if init_data else "N/A",
            "origine": init_data["donnees"]["origine_elevage"] if init_data else "N/A",
            "date_naissance": init_data["donnees"]["date_naissance"] if init_data else "N/A",
            "poids_initial": init_data["donnees"]["poids_initial"] if init_data else 0,
            "duree_gavage_jours": duree_gavage,
            "nombre_gavages": len(gavages),
            "dose_totale_mais_kg": doses_totales / 1000,
            "abattoir": abattage["donnees"] if abattage else None,
            "date_abattage": abattage["timestamp"] if abattage else None,
            "blockchain_hashes": [h["hash"] for h in historique],
            "verification_blockchain": "Authentique - Vérifiable sur blockchain",
            "date_generation_certificat": datetime.utcnow().isoformat()
        }
        
        return certificat


# Instance globale
blockchain: Optional[GaveursBlockchain] = None


def get_blockchain(db_pool: asyncpg.Pool) -> GaveursBlockchain:
    """Obtenir l'instance de la blockchain"""
    global blockchain
    if blockchain is None:
        blockchain = GaveursBlockchain(db_pool)
    return blockchain
