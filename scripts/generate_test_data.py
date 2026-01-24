#!/usr/bin/env python3
"""
Test Data Generator for Système Gaveurs V3.0
Generates realistic test data for the complete system
"""

import asyncio
import asyncpg
import random
from datetime import datetime, timedelta
from typing import List, Dict, Any
import argparse
import sys

# Colors for terminal output
class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    BOLD = '\033[1m'
    END = '\033[0m'


class TestDataGenerator:
    """Generate realistic test data"""

    def __init__(self, host: str = "localhost", port: int = 5432,
                 database: str = "gaveurs_db", user: str = "gaveurs_admin",
                 password: str = "gaveurs_secure_2024"):
        self.host = host
        self.port = port
        self.database = database
        self.user = user
        self.password = password
        self.conn = None

        # Data templates
        self.sites = ["LL", "LS", "MT"]
        self.genetiques = [
            "PALMIPEDES SELECT",
            "GOURMAUD SELECTION",
            "ORVIA PREMIUM",
            "GRIMAUD FRERES"
        ]

        self.prenoms_gaveurs = [
            "Jean", "Pierre", "Marie", "Sophie", "Luc", "Paul", "Jacques",
            "Michel", "André", "François", "Bernard", "Henri", "Antoine"
        ]

        self.noms_gaveurs = [
            "Dupont", "Martin", "Bernard", "Thomas", "Petit", "Robert",
            "Richard", "Durand", "Dubois", "Moreau", "Laurent", "Simon"
        ]

    def log_info(self, message: str):
        print(f"{Colors.BLUE}[INFO]{Colors.END} {message}")

    def log_success(self, message: str):
        print(f"{Colors.GREEN}[SUCCESS]{Colors.END} {message}")

    def log_error(self, message: str):
        print(f"{Colors.RED}[ERROR]{Colors.END} {message}")

    async def connect(self) -> bool:
        """Connect to database"""
        try:
            self.log_info(f"Connecting to {self.host}:{self.port}/{self.database}...")

            self.conn = await asyncpg.connect(
                host=self.host,
                port=self.port,
                database=self.database,
                user=self.user,
                password=self.password,
                timeout=10
            )

            self.log_success("Connected to database")
            return True

        except Exception as e:
            self.log_error(f"Connection failed: {str(e)}")
            return False

    async def disconnect(self):
        """Disconnect from database"""
        if self.conn:
            await self.conn.close()
            self.log_info("Disconnected from database")

    async def generate_sites(self, num_sites: int = 3) -> List[int]:
        """Generate site data"""
        self.log_info(f"Generating {num_sites} sites...")

        site_data = [
            ("LL", "Site Landais", "40000 Mont-de-Marsan", 2500),
            ("LS", "Site Landes Sud", "40100 Dax", 2000),
            ("MT", "Site Multi-Tech", "40200 Mimizan", 1800)
        ]

        created = 0

        for code, nom, adresse, capacite in site_data[:num_sites]:
            try:
                await self.conn.execute("""
                    INSERT INTO sites_euralis (code, nom, adresse, capacite_max, active, created_at)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT (code) DO NOTHING
                """, code, nom, adresse, capacite, True, datetime.now())

                created += 1

            except Exception as e:
                self.log_error(f"Failed to create site {code}: {str(e)}")

        self.log_success(f"Created {created} sites")
        return [site[0] for site in site_data[:num_sites]]

    async def generate_gaveurs(self, num_gaveurs: int = 10) -> List[str]:
        """Generate gaveur data"""
        self.log_info(f"Generating {num_gaveurs} gaveurs...")

        gaveur_ids = []
        created = 0

        for i in range(num_gaveurs):
            gaveur_id = f"GAV{i+1:03d}"
            nom = random.choice(self.noms_gaveurs)
            prenom = random.choice(self.prenoms_gaveurs)
            site_code = random.choice(self.sites)
            experience = random.randint(1, 20)

            try:
                await self.conn.execute("""
                    INSERT INTO gaveurs (gaveur_id, nom, prenom, site_code, experience_annees, actif, created_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    ON CONFLICT (gaveur_id) DO NOTHING
                """, gaveur_id, nom, prenom, site_code, experience, True, datetime.now())

                gaveur_ids.append(gaveur_id)
                created += 1

            except Exception as e:
                self.log_error(f"Failed to create gaveur {gaveur_id}: {str(e)}")

        self.log_success(f"Created {created} gaveurs")
        return gaveur_ids

    async def generate_lots(self, gaveur_ids: List[str], num_lots: int = 20) -> List[int]:
        """Generate lot data"""
        self.log_info(f"Generating {num_lots} lots...")

        lot_ids = []
        created = 0

        for i in range(num_lots):
            numero_lot = f"LOT-{datetime.now().year}-{i+1:04d}"
            site_code = random.choice(self.sites)
            gaveur_id = random.choice(gaveur_ids)
            genetique = random.choice(self.genetiques)
            nombre_animaux = random.randint(80, 150)
            itm_cible = round(random.uniform(25.0, 30.0), 1)

            # Random date in last 90 days
            date_debut = datetime.now() - timedelta(days=random.randint(0, 90))

            # Determine status based on date
            days_since_start = (datetime.now() - date_debut).days
            if days_since_start < 12:
                statut = "en_cours"
                date_fin = None
            else:
                statut = "termine"
                date_fin = date_debut + timedelta(days=random.randint(12, 15))

            try:
                lot_id = await self.conn.fetchval("""
                    INSERT INTO lots_gavage (
                        numero_lot, site_code, gaveur_id, genetique, nombre_animaux,
                        date_debut, date_fin, itm_cible, statut, created_at
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    ON CONFLICT (numero_lot) DO NOTHING
                    RETURNING id
                """, numero_lot, site_code, gaveur_id, genetique, nombre_animaux,
                     date_debut, date_fin, itm_cible, statut, datetime.now())

                if lot_id:
                    lot_ids.append(lot_id)
                    created += 1

            except Exception as e:
                self.log_error(f"Failed to create lot {numero_lot}: {str(e)}")

        self.log_success(f"Created {created} lots")
        return lot_ids

    async def generate_gavage_sessions(self, lot_ids: List[int], sessions_per_lot: int = 10) -> int:
        """Generate gavage session data"""
        self.log_info(f"Generating gavage sessions ({sessions_per_lot} per lot)...")

        created = 0

        for lot_id in lot_ids:
            # Get lot info
            lot_info = await self.conn.fetchrow("""
                SELECT numero_lot, gaveur_id, date_debut, itm_cible, nombre_animaux
                FROM lots_gavage
                WHERE id = $1
            """, lot_id)

            if not lot_info:
                continue

            for day in range(sessions_per_lot):
                timestamp = lot_info['date_debut'] + timedelta(days=day)

                # Calculate dose (increases over days)
                base_dose = lot_info['itm_cible'] / 12 * 100  # grams per animal
                dose_factor = 0.6 + (day / 12) * 0.4  # Start at 60%, increase to 100%
                dose = base_dose * dose_factor

                quantite_distribuee = round(dose * lot_info['nombre_animaux'], 2)
                nombre_animaux_gaves = lot_info['nombre_animaux'] - random.randint(0, 3)
                duree_minutes = random.randint(30, 60)

                observations_list = [
                    "Session normale",
                    "Bonne prise alimentaire",
                    "Quelques refus",
                    "Excellente session",
                    None
                ]
                observations = random.choice(observations_list)

                try:
                    await self.conn.execute("""
                        INSERT INTO sessions_gavage (
                            lot_id, gaveur_id, timestamp, quantite_distribuee,
                            nombre_animaux_gaves, duree_minutes, observations
                        )
                        VALUES ($1, $2, $3, $4, $5, $6, $7)
                    """, lot_id, lot_info['gaveur_id'], timestamp, quantite_distribuee,
                         nombre_animaux_gaves, duree_minutes, observations)

                    created += 1

                except Exception as e:
                    pass  # Duplicate entries are OK

        self.log_success(f"Created {created} gavage sessions")
        return created

    async def generate_sqal_devices(self, num_devices: int = 3) -> List[str]:
        """Generate SQAL device data"""
        self.log_info(f"Generating {num_devices} SQAL devices...")

        device_ids = []
        created = 0

        for i in range(num_devices):
            device_id = f"ESP32-{self.sites[i]}-001"
            site_code = self.sites[i]
            location = f"Quality Control Station {i+1}"

            try:
                await self.conn.execute("""
                    INSERT INTO sqal_devices (
                        device_id, site_code, location, vl53l8ch_calibrated,
                        as7341_calibrated, active, last_seen
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    ON CONFLICT (device_id) DO NOTHING
                """, device_id, site_code, location, True, True, True, datetime.now())

                device_ids.append(device_id)
                created += 1

            except Exception as e:
                self.log_error(f"Failed to create device {device_id}: {str(e)}")

        self.log_success(f"Created {created} SQAL devices")
        return device_ids

    async def generate_sqal_samples(self, device_ids: List[str], lot_ids: List[int],
                                   num_samples: int = 50) -> List[str]:
        """Generate SQAL sensor sample data"""
        self.log_info(f"Generating {num_samples} SQAL samples...")

        sample_ids = []
        created = 0

        grades = ["A+", "A", "A", "B", "C", "REJECT"]
        grade_weights = [0.2, 0.5, 0.2, 0.08, 0.02]  # Distribution

        for i in range(num_samples):
            sample_id = f"SAMPLE-{datetime.now().strftime('%Y%m%d')}-{i+1:05d}"
            device_id = random.choice(device_ids)
            lot_id = random.choice(lot_ids) if random.random() > 0.3 else None

            # Generate realistic sensor data
            # VL53L8CH (ToF) - 8x8 matrix
            base_distance = random.randint(140, 160)
            distance_matrix = [
                [base_distance + random.randint(-10, 10) for _ in range(8)]
                for _ in range(8)
            ]

            # AS7341 (Spectral)
            as7341_channels = {
                "415nm": random.randint(1000, 1500),
                "445nm": random.randint(1300, 1800),
                "480nm": random.randint(1600, 2200),
                "515nm": random.randint(1800, 2400),
                "555nm": random.randint(2000, 2600),
                "590nm": random.randint(1900, 2500),
                "630nm": random.randint(1700, 2300),
                "680nm": random.randint(1400, 2000),
                "clear": random.randint(13000, 17000),
                "nir": random.randint(1200, 1600)
            }

            # Quality metrics
            vl53l8ch_quality = round(random.uniform(0.75, 0.95), 4)
            as7341_freshness = round(random.uniform(0.80, 0.95), 4)

            # Fusion score and grade
            fusion_score = round((vl53l8ch_quality * 0.6 + as7341_freshness * 0.4), 4)

            if fusion_score >= 0.90:
                grade = "A+"
            elif fusion_score >= 0.80:
                grade = "A"
            elif fusion_score >= 0.70:
                grade = "B"
            elif fusion_score >= 0.60:
                grade = "C"
            else:
                grade = "REJECT"

            # Random timestamp in last 30 days
            timestamp = datetime.now() - timedelta(days=random.randint(0, 30),
                                                  hours=random.randint(0, 23),
                                                  minutes=random.randint(0, 59))

            try:
                await self.conn.execute("""
                    INSERT INTO sqal_sensor_samples (
                        time, sample_id, device_id, lot_id,
                        vl53l8ch_distance_matrix, vl53l8ch_quality_score,
                        as7341_channels, as7341_freshness_index,
                        fusion_final_score, fusion_final_grade
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                """, timestamp, sample_id, device_id, lot_id,
                     {"matrix": distance_matrix}, vl53l8ch_quality,
                     as7341_channels, as7341_freshness,
                     fusion_score, grade)

                sample_ids.append(sample_id)
                created += 1

            except Exception as e:
                pass  # Duplicate entries are OK

        self.log_success(f"Created {created} SQAL samples")
        return sample_ids

    async def generate_consumer_products(self, sample_ids: List[str], lot_ids: List[int],
                                        num_products: int = 30) -> List[str]:
        """Generate consumer product data with QR codes"""
        self.log_info(f"Generating {num_products} consumer products...")

        product_ids = []
        created = 0

        for i in range(min(num_products, len(sample_ids))):
            sample_id = sample_ids[i]

            # Get sample info
            sample_info = await self.conn.fetchrow("""
                SELECT lot_id, device_id, fusion_final_score, fusion_final_grade
                FROM sqal_sensor_samples
                WHERE sample_id = $1
                LIMIT 1
            """, sample_id)

            if not sample_info or not sample_info['lot_id']:
                continue

            # Get site from device
            site_code = await self.conn.fetchval("""
                SELECT site_code FROM sqal_devices WHERE device_id = $1
            """, sample_info['device_id'])

            product_id = f"PROD-{datetime.now().year}-{i+1:06d}"
            qr_code = f"SQAL_{sample_info['lot_id']}_{sample_id}_{product_id}_ABC123DEF456"

            try:
                await self.conn.execute("""
                    INSERT INTO consumer_products (
                        product_id, lot_id, sample_id, site_code, qr_code,
                        sqal_score, sqal_grade, registered_at
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    ON CONFLICT (product_id) DO NOTHING
                """, product_id, sample_info['lot_id'], sample_id, site_code, qr_code,
                     sample_info['fusion_final_score'], sample_info['fusion_final_grade'],
                     datetime.now())

                product_ids.append(product_id)
                created += 1

            except Exception as e:
                pass

        self.log_success(f"Created {created} consumer products")
        return product_ids

    async def generate_consumer_feedbacks(self, product_ids: List[str],
                                         num_feedbacks: int = 20) -> int:
        """Generate consumer feedback data"""
        self.log_info(f"Generating {num_feedbacks} consumer feedbacks...")

        created = 0

        comments = [
            "Excellent foie gras! Very smooth texture.",
            "Good quality, will buy again.",
            "Perfect for special occasions.",
            "Rich flavor, melts in your mouth.",
            "Great product, highly recommend!",
            "Good but a bit expensive.",
            "Nice texture and taste.",
            "Superb quality!",
            "Very satisfied with this purchase.",
            "Will definitely recommend to friends."
        ]

        for i in range(min(num_feedbacks, len(product_ids))):
            product_id = product_ids[i]

            # Get QR code
            qr_code = await self.conn.fetchval("""
                SELECT qr_code FROM consumer_products WHERE product_id = $1
            """, product_id)

            if not qr_code:
                continue

            # Generate ratings (biased towards positive)
            overall_rating = random.choices([3, 4, 5], weights=[0.1, 0.3, 0.6])[0]
            taste_rating = overall_rating + random.randint(-1, 1)
            texture_rating = overall_rating + random.randint(-1, 1)
            appearance_rating = overall_rating + random.randint(-1, 1)

            # Clamp ratings
            taste_rating = max(1, min(5, taste_rating))
            texture_rating = max(1, min(5, texture_rating))
            appearance_rating = max(1, min(5, appearance_rating))

            comment = random.choice(comments) if random.random() > 0.3 else None
            would_recommend = overall_rating >= 4

            # Random consumption date in last 14 days
            consumption_date = datetime.now() - timedelta(days=random.randint(0, 14))
            scan_timestamp = consumption_date - timedelta(hours=random.randint(1, 48))

            try:
                await self.conn.execute("""
                    INSERT INTO consumer_feedbacks (
                        time, qr_code, consumer_ip_hash, overall_rating,
                        taste_rating, texture_rating, appearance_rating,
                        comment, consumption_date, would_recommend, scan_timestamp
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                """, datetime.now(), qr_code, f"hash_{i:05d}", overall_rating,
                     taste_rating, texture_rating, appearance_rating,
                     comment, consumption_date, would_recommend, scan_timestamp)

                created += 1

            except Exception as e:
                pass

        self.log_success(f"Created {created} consumer feedbacks")
        return created

    async def run(self, num_gaveurs: int = 10, num_lots: int = 20,
                 sessions_per_lot: int = 10, num_samples: int = 50,
                 num_products: int = 30, num_feedbacks: int = 20) -> int:
        """Run test data generation"""
        print(f"\n{Colors.CYAN}{'='*70}{Colors.END}")
        print(f"{Colors.CYAN}{Colors.BOLD}Test Data Generation{Colors.END}")
        print(f"{Colors.CYAN}{'='*70}{Colors.END}\n")

        if not await self.connect():
            return 1

        try:
            # Generate data in order
            await self.generate_sites()
            print()

            gaveur_ids = await self.generate_gaveurs(num_gaveurs)
            print()

            lot_ids = await self.generate_lots(gaveur_ids, num_lots)
            print()

            await self.generate_gavage_sessions(lot_ids, sessions_per_lot)
            print()

            device_ids = await self.generate_sqal_devices()
            print()

            sample_ids = await self.generate_sqal_samples(device_ids, lot_ids, num_samples)
            print()

            product_ids = await self.generate_consumer_products(sample_ids, lot_ids, num_products)
            print()

            await self.generate_consumer_feedbacks(product_ids, num_feedbacks)
            print()

            print(f"{Colors.GREEN}{Colors.BOLD}✅ TEST DATA GENERATION COMPLETED{Colors.END}\n")
            return 0

        except Exception as e:
            self.log_error(f"Data generation failed: {str(e)}")
            return 1

        finally:
            await self.disconnect()


async def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="Test data generator for Système Gaveurs V3.0")

    parser.add_argument("--host", default="localhost", help="Database host")
    parser.add_argument("--port", type=int, default=5432, help="Database port")
    parser.add_argument("--database", default="gaveurs_db", help="Database name")
    parser.add_argument("--user", default="gaveurs_admin", help="Database user")
    parser.add_argument("--password", default="gaveurs_secure_2024", help="Database password")
    parser.add_argument("--gaveurs", type=int, default=10, help="Number of gaveurs to generate")
    parser.add_argument("--lots", type=int, default=20, help="Number of lots to generate")
    parser.add_argument("--samples", type=int, default=50, help="Number of SQAL samples")
    parser.add_argument("--feedbacks", type=int, default=20, help="Number of consumer feedbacks")

    args = parser.parse_args()

    generator = TestDataGenerator(
        host=args.host,
        port=args.port,
        database=args.database,
        user=args.user,
        password=args.password
    )

    exit_code = await generator.run(
        num_gaveurs=args.gaveurs,
        num_lots=args.lots,
        num_samples=args.samples,
        num_feedbacks=args.feedbacks
    )

    sys.exit(exit_code)


if __name__ == "__main__":
    asyncio.run(main())
