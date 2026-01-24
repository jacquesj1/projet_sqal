#!/usr/bin/env python3
"""
================================================================================
SIMULATEUR DE DONNÉES DE GAVAGE RÉALISTE
================================================================================
Description : Génère des données réalistes de gavage basées sur Pretraite_End_2024_claude.csv
Usage       : python gavage_data_simulator.py --nb-lots 100 --nb-gaveurs 65 --output simulated_data.csv
Date        : 2024-12-14
================================================================================
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import argparse
import random
from typing import Dict, List, Tuple


class GavageDataSimulator:
    """
    Simulateur de données de gavage réaliste basé sur statistiques réelles
    """

    def __init__(self, reference_csv: str = None):
        """
        Initialiser le simulateur

        Args:
            reference_csv: Chemin vers CSV de référence pour calibrer les distributions
        """
        self.reference_csv = reference_csv
        self.stats = self._analyze_reference_data() if reference_csv else self._default_stats()

        # Sites
        self.sites = ['LL', 'LS', 'MT']
        self.site_names = {
            'LL': 'Bretagne',
            'LS': 'Pays de Loire',
            'MT': 'Maubourguet'
        }

        # Souches
        self.souches = [
            'CF80* - M15 V2E SFM',
            'MMG AS - PKL*',
            'MMG AS - PKLC'
        ]

        # Noms gaveurs français réalistes
        self.prenoms = [
            'Jean', 'Pierre', 'Michel', 'André', 'Philippe', 'Alain', 'Jacques',
            'François', 'Bernard', 'Patrick', 'Christian', 'Daniel', 'Marc',
            'Laurent', 'Stéphane', 'Christophe', 'Thierry', 'David', 'Nicolas',
            'Isabelle', 'Marie', 'Sylvie', 'Catherine', 'Nathalie', 'Anne',
            'Martine', 'Monique', 'Christine', 'Sophie', 'Valérie'
        ]

        self.noms = [
            'Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard',
            'Petit', 'Durand', 'Leroy', 'Moreau', 'Simon', 'Laurent',
            'Lefebvre', 'Michel', 'Garcia', 'David', 'Bertrand', 'Roux',
            'Vincent', 'Fournier', 'Morel', 'Girard', 'Andre', 'Lefevre',
            'Mercier', 'Dupont', 'Lambert', 'Bonnet', 'Francois', 'Martinez'
        ]

    def _default_stats(self) -> Dict:
        """Statistiques par défaut basées sur les spécifications"""
        return {
            'itm': {'mean': 14.97, 'std': 2.0, 'min': 10, 'max': 20},
            'sigma': {'mean': 2.1, 'std': 0.5, 'min': 1.0, 'max': 4.0},
            'mortalite': {'mean': 3.2, 'std': 2.0, 'min': 0, 'max': 12},
            'duree_gavage': {'mean': 10.2, 'std': 1.5, 'min': 8, 'max': 14},
            'nb_canards': {'mean': 800, 'std': 300, 'min': 400, 'max': 1500},
            'dose_initiale': {'mean': 200, 'std': 20, 'min': 150, 'max': 250},
            'dose_finale': {'mean': 490, 'std': 30, 'min': 400, 'max': 550}
        }

    def _analyze_reference_data(self) -> Dict:
        """Analyser CSV de référence pour calibrer les distributions"""
        try:
            df = pd.read_csv(self.reference_csv, sep=';', encoding='latin-1')

            return {
                'itm': {
                    'mean': df['ITM'].mean(),
                    'std': df['ITM'].std(),
                    'min': df['ITM'].min(),
                    'max': df['ITM'].max()
                },
                'sigma': {
                    'mean': df['Sigma'].mean(),
                    'std': df['Sigma'].std(),
                    'min': df['Sigma'].min(),
                    'max': df['Sigma'].max()
                },
                'mortalite': {
                    'mean': df['dPctgPerteGav'].mean(),
                    'std': df['dPctgPerteGav'].std(),
                    'min': df['dPctgPerteGav'].min(),
                    'max': df['dPctgPerteGav'].max()
                },
                'duree_gavage': {
                    'mean': df['duree_gavage'].mean(),
                    'std': df['duree_gavage'].std(),
                    'min': df['duree_gavage'].min(),
                    'max': df['duree_gavage'].max()
                },
                'nb_canards': {
                    'mean': df['Nb_MEG'].mean(),
                    'std': df['Nb_MEG'].std(),
                    'min': df['Nb_MEG'].min(),
                    'max': df['Nb_MEG'].max()
                }
            }
        except Exception as e:
            print(f"⚠️  Erreur lecture CSV référence: {e}")
            return self._default_stats()

    def generate_gaveurs(self, nb_gaveurs: int) -> List[Dict]:
        """Générer liste de gaveurs réalistes"""
        gaveurs = []

        for i in range(nb_gaveurs):
            prenom = random.choice(self.prenoms)
            nom = random.choice(self.noms)
            site = random.choice(self.sites)

            gaveur = {
                'id': i + 1,
                'nom': f"{prenom} {nom}",
                'prenom': prenom,
                'nom_famille': nom,
                'site_code': site,
                'telephone': f"0{random.randint(1,9)}{random.randint(10,99):02d}{random.randint(10,99):02d}{random.randint(10,99):02d}{random.randint(10,99):02d}",
                'email': f"{prenom.lower()}.{nom.lower()}@gaveur.fr",
                'performance_level': random.choice(['excellent', 'tres_bon', 'bon', 'moyen', 'faible'])
            }

            gaveurs.append(gaveur)

        return gaveurs

    def generate_lot(
        self,
        lot_number: int,
        gaveur: Dict,
        date_debut: datetime
    ) -> Dict:
        """
        Générer un lot de gavage complet

        Args:
            lot_number: Numéro du lot
            gaveur: Informations gaveur
            date_debut: Date début gavage

        Returns:
            Dict avec toutes les données du lot
        """

        # Paramètres de base
        site_code = gaveur['site_code']
        code_lot = f"{site_code}{lot_number:07d}"

        # Durée gavage (8-14 jours, distribution normale centrée sur 10)
        duree = int(np.clip(
            np.random.normal(self.stats['duree_gavage']['mean'], self.stats['duree_gavage']['std']),
            self.stats['duree_gavage']['min'],
            self.stats['duree_gavage']['max']
        ))

        # Nombre de canards
        nb_canards = int(np.clip(
            np.random.normal(self.stats['nb_canards']['mean'], self.stats['nb_canards']['std']),
            self.stats['nb_canards']['min'],
            self.stats['nb_canards']['max']
        ))

        # Performance selon niveau gaveur
        performance_mult = {
            'excellent': 1.15,
            'tres_bon': 1.05,
            'bon': 1.0,
            'moyen': 0.95,
            'faible': 0.85
        }[gaveur['performance_level']]

        # ITM (Indice Technique Moyen)
        itm_base = self.stats['itm']['mean'] * performance_mult
        itm = np.clip(
            np.random.normal(itm_base, self.stats['itm']['std']),
            self.stats['itm']['min'],
            self.stats['itm']['max']
        )

        # Sigma (écart type poids foie)
        sigma = np.clip(
            np.random.normal(self.stats['sigma']['mean'], self.stats['sigma']['std']),
            self.stats['sigma']['min'],
            self.stats['sigma']['max']
        )

        # Mortalité (inversement corrélée à la performance)
        mortalite_base = self.stats['mortalite']['mean'] / performance_mult
        mortalite = np.clip(
            np.abs(np.random.normal(mortalite_base, self.stats['mortalite']['std'])),
            self.stats['mortalite']['min'],
            self.stats['mortalite']['max']
        )

        # Génération doses journalières
        doses_data = self._generate_doses_journalieres(duree, performance_mult)

        # Calculer totaux
        total_corn_target = sum(doses_data['feed_target'])
        total_corn_real = sum(doses_data['feed_real'])

        # Canards abattus
        nb_morts = int(nb_canards * mortalite / 100)
        nb_accroches = nb_canards - nb_morts - random.randint(0, 10)  # quelques enlevés

        # Lot data
        lot = {
            'code_lot': code_lot,
            'site_code': site_code,
            'gaveur_id': gaveur['id'],
            'gaveur_nom': gaveur['nom'],
            'souche': random.choice(self.souches),
            'debut_lot': date_debut.strftime('%d/%m/%Y'),
            'duree_gavage': duree,
            'nb_canards_meg': nb_canards,
            'nb_canards_morts': nb_morts,
            'nb_canards_accroches': nb_accroches,
            'nb_canards_enleves': nb_canards - nb_accroches - nb_morts,
            'itm': round(itm, 2),
            'sigma': round(sigma, 2),
            'pctg_perte_gavage': round(mortalite, 4),
            'total_corn_target': round(total_corn_target, 2),
            'total_corn_real': round(total_corn_real, 2),
            'age_animaux': random.randint(95, 115),
            'eleveur': f"ELEVEUR_{random.randint(1, 50)}",
            'prod_igp_fr': random.choice([True, False]),
            **doses_data['doses_dict']  # Ajouter toutes les doses journalières
        }

        return lot

    def _generate_doses_journalieres(
        self,
        duree: int,
        performance_mult: float
    ) -> Dict:
        """
        Générer doses journalières réalistes

        Modèle : progression linéaire de ~200g à ~490g avec variation
        """

        # Dose initiale et finale
        dose_init = np.random.normal(200, 20)
        dose_finale = np.random.normal(490, 30)

        # Progression linéaire avec petites variations
        doses_target = []
        doses_real = []
        cumul = []

        cumul_total = 0

        for jour in range(1, duree + 1):
            # Dose théorique (progression linéaire)
            progress = (jour - 1) / (duree - 1) if duree > 1 else 0
            dose_theo = dose_init + (dose_finale - dose_init) * progress
            dose_theo = round(dose_theo)

            # Dose réelle (variation ±5% selon performance)
            variation_pct = np.random.normal(0, 5 / performance_mult)
            dose_reelle = dose_theo * (1 + variation_pct / 100)
            dose_reelle = round(dose_reelle)

            doses_target.append(dose_theo)
            doses_real.append(dose_reelle)
            cumul_total += dose_reelle
            cumul.append(cumul_total)

        # Créer dictionnaire pour CSV (27 jours max)
        doses_dict = {}
        for jour in range(1, 28):
            if jour <= duree:
                doses_dict[f'feedTarget_{jour}'] = doses_target[jour-1]
                doses_dict[f'feedCornReal_{jour}'] = doses_real[jour-1]
                doses_dict[f'cumulCorn_{jour}'] = cumul[jour-1]
                doses_dict[f'corn_variation_{jour}'] = doses_real[jour-1] - doses_target[jour-1]
                doses_dict[f'delta_feed_{jour}'] = doses_real[jour-1] - doses_real[jour-2] if jour > 1 else 0
            else:
                doses_dict[f'feedTarget_{jour}'] = 0
                doses_dict[f'feedCornReal_{jour}'] = 0
                doses_dict[f'cumulCorn_{jour}'] = 0
                doses_dict[f'corn_variation_{jour}'] = 0
                doses_dict[f'delta_feed_{jour}'] = 0

        return {
            'feed_target': doses_target,
            'feed_real': doses_real,
            'doses_dict': doses_dict
        }

    def generate_dataset(
        self,
        nb_lots: int,
        nb_gaveurs: int,
        start_date: datetime = None
    ) -> pd.DataFrame:
        """
        Générer dataset complet

        Args:
            nb_lots: Nombre de lots à générer
            nb_gaveurs: Nombre de gaveurs
            start_date: Date début simulation

        Returns:
            DataFrame avec tous les lots
        """

        if start_date is None:
            start_date = datetime(2024, 1, 1)

        print(f"\n🦆 Génération de {nb_lots} lots pour {nb_gaveurs} gaveurs")
        print("="*70)

        # Générer gaveurs
        print(f"👨‍🌾 Génération de {nb_gaveurs} gaveurs...")
        gaveurs = self.generate_gaveurs(nb_gaveurs)
        print(f"   ✅ {len(gaveurs)} gaveurs créés")

        # Distribution par site
        site_counts = {}
        for g in gaveurs:
            site_counts[g['site_code']] = site_counts.get(g['site_code'], 0) + 1

        for site, count in site_counts.items():
            print(f"      {site}: {count} gaveurs")

        # Générer lots
        print(f"\n📦 Génération de {nb_lots} lots...")
        lots = []

        current_date = start_date

        for i in range(nb_lots):
            # Sélectionner gaveur aléatoire
            gaveur = random.choice(gaveurs)

            # Générer lot
            lot = self.generate_lot(i + 1, gaveur, current_date)
            lots.append(lot)

            # Avancer date (nouveau lot tous les 2-3 jours en moyenne)
            current_date += timedelta(days=random.randint(1, 4))

            if (i + 1) % 10 == 0:
                print(f"   {i + 1}/{nb_lots} lots générés...")

        print(f"   ✅ {len(lots)} lots créés")

        # Créer DataFrame
        df = pd.DataFrame(lots)

        # Statistiques
        print(f"\n📊 Statistiques générées :")
        print(f"   ITM moyen : {df['itm'].mean():.2f} ± {df['itm'].std():.2f} kg")
        print(f"   Sigma moyen : {df['sigma'].mean():.2f} ± {df['sigma'].std():.2f}")
        print(f"   Mortalité moyenne : {df['pctg_perte_gavage'].mean():.2f}%")
        print(f"   Durée moyenne : {df['duree_gavage'].mean():.1f} jours")

        print(f"\n   Lots par site :")
        for site in self.sites:
            site_lots = len(df[df['site_code'] == site])
            pct = site_lots / len(df) * 100
            print(f"      {site}: {site_lots} lots ({pct:.1f}%)")

        return df


def main():
    parser = argparse.ArgumentParser(
        description='Simulateur de données de gavage réaliste'
    )
    parser.add_argument(
        '--nb-lots',
        type=int,
        default=100,
        help='Nombre de lots à générer (défaut: 100)'
    )
    parser.add_argument(
        '--nb-gaveurs',
        type=int,
        default=65,
        help='Nombre de gaveurs (défaut: 65)'
    )
    parser.add_argument(
        '--output',
        type=str,
        default='simulated_gavage_data.csv',
        help='Fichier CSV de sortie (défaut: simulated_gavage_data.csv)'
    )
    parser.add_argument(
        '--reference',
        type=str,
        help='CSV de référence pour calibrer les distributions'
    )
    parser.add_argument(
        '--start-date',
        type=str,
        default='2024-01-01',
        help='Date début (format YYYY-MM-DD, défaut: 2024-01-01)'
    )

    args = parser.parse_args()

    # Créer simulateur
    simulator = GavageDataSimulator(reference_csv=args.reference)

    # Générer données
    start_date = datetime.strptime(args.start_date, '%Y-%m-%d')
    df = simulator.generate_dataset(args.nb_lots, args.nb_gaveurs, start_date)

    # Sauvegarder
    df.to_csv(args.output, sep=';', index=False, encoding='latin-1')

    print(f"\n✅ Données sauvegardées : {args.output}")
    print(f"   {len(df)} lots")
    print(f"   {len(df.columns)} colonnes")


if __name__ == '__main__':
    main()
