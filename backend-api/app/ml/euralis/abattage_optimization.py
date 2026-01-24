"""
================================================================================
Module: Optimisation Planning Abattages
================================================================================
Description : Optimisation allocation lots → abattoirs avec contraintes
Technologie : Algorithme hongrois (linear_sum_assignment - SciPy)
Usage       : Minimiser coûts transport + urgence + surcharge
================================================================================
"""

from scipy.optimize import linear_sum_assignment
import numpy as np
import pandas as pd
from typing import Dict, List, Tuple
from datetime import datetime, timedelta, date


class AbattageOptimizer:
    """
    Optimisation planning abattages
    """

    def __init__(self):
        # Matrice des distances site → abattoir (km)
        self.distances = {
            ('LL', 'abattoir_1'): 50,
            ('LL', 'abattoir_2'): 150,
            ('LS', 'abattoir_1'): 100,
            ('LS', 'abattoir_2'): 80,
            ('MT', 'abattoir_1'): 200,
            ('MT', 'abattoir_2'): 120,
        }

    def optimize_weekly_planning(
        self,
        lots_ready: List[Dict],
        abattoirs_capacity: Dict
    ) -> Dict[int, Tuple[str, date]]:
        """
        Optimiser planning hebdo

        Args:
            lots_ready: Liste lots prêts abattage
                [{
                    'id': int,
                    'site': str,
                    'nb_canards': int,
                    'date_fin_gavage': date,
                    'urgence': int  # 1-5 (5 = très urgent)
                }, ...]

            abattoirs_capacity: Capacités abattoirs par jour
                {
                    'abattoir_1': {
                        date(2024,12,15): 1000,  # canards
                        date(2024,12,16): 1200,
                        ...
                    },
                    'abattoir_2': {...}
                }

        Returns:
            Planning optimal : {lot_id: (abattoir_id, date)}
        """

        print(f"\n📅 Optimisation planning pour {len(lots_ready)} lots")

        # Construire matrice coûts
        n_lots = len(lots_ready)

        # Créer tous les slots (abattoir × date)
        slots = []
        for abattoir_id, dates_capacity in abattoirs_capacity.items():
            for date_abattage, capacity in dates_capacity.items():
                slots.append({
                    'abattoir_id': abattoir_id,
                    'date': date_abattage,
                    'capacity': capacity
                })

        n_slots = len(slots)

        if n_slots == 0:
            raise ValueError("Aucun slot d'abattage disponible")

        print(f"   {n_lots} lots × {n_slots} slots = {n_lots * n_slots} combinaisons")

        # Matrice de coûts
        cost_matrix = np.zeros((n_lots, n_slots))

        for lot_idx, lot in enumerate(lots_ready):
            for slot_idx, slot in enumerate(slots):

                # 1. Coût distance site → abattoir
                distance_cost = self._get_distance_cost(
                    lot['site'],
                    slot['abattoir_id']
                )

                # 2. Coût urgence (pénalité si retard)
                urgence_cost = self._get_urgence_cost(
                    lot['date_fin_gavage'],
                    slot['date'],
                    lot.get('urgence', 3)
                )

                # 3. Coût surcharge abattoir
                surcharge_cost = self._get_surcharge_cost(
                    lot['nb_canards'],
                    slot['capacity']
                )

                # Coût total (pondéré)
                cost_matrix[lot_idx, slot_idx] = (
                    distance_cost +
                    urgence_cost * 10 +  # Urgence prioritaire
                    surcharge_cost * 5
                )

        # Algorithme hongrois (linear_sum_assignment)
        print("   🧮 Résolution algorithme hongrois...")

        lot_indices, slot_indices = linear_sum_assignment(cost_matrix)

        # Construire planning
        planning = {}
        total_cost = 0

        for lot_idx, slot_idx in zip(lot_indices, slot_indices):
            lot = lots_ready[lot_idx]
            slot = slots[slot_idx]

            planning[lot['id']] = (slot['abattoir_id'], slot['date'])
            total_cost += cost_matrix[lot_idx, slot_idx]

        print(f"   ✅ Planning optimisé (coût total: {total_cost:.0f})")

        return planning

    def _get_distance_cost(self, site_code: str, abattoir_id: str) -> float:
        """
        Coût basé sur distance site → abattoir

        Args:
            site_code: Code du site
            abattoir_id: ID de l'abattoir

        Returns:
            Coût distance
        """

        return self.distances.get((site_code, abattoir_id), 100)

    def _get_urgence_cost(
        self,
        date_fin_gavage: date,
        date_abattage: date,
        urgence: int
    ) -> float:
        """
        Coût basé sur délai fin gavage → abattage et urgence

        Args:
            date_fin_gavage: Date fin de gavage
            date_abattage: Date abattage prévue
            urgence: Niveau d'urgence (1-5)

        Returns:
            Coût urgence
        """

        delta_days = (date_abattage - date_fin_gavage).days

        if delta_days < 0:
            return 1000  # Impossible (canards pas prêts)

        elif delta_days == 0:
            return 0  # Parfait

        elif delta_days <= 2:
            return 10 * urgence  # Acceptable

        else:
            # Pénalité croissante pour retard
            return 50 * delta_days * urgence

    def _get_surcharge_cost(self, nb_canards: int, capacite: int) -> float:
        """
        Coût si surcharge abattoir

        Args:
            nb_canards: Nombre de canards du lot
            capacite: Capacité de l'abattoir

        Returns:
            Coût surcharge
        """

        if nb_canards > capacite:
            return 1000  # Impossible

        else:
            # Coût proportionnel au taux de remplissage
            taux_remplissage = nb_canards / capacite
            return 20 * taux_remplissage

    def suggest_optimal_dates(
        self,
        lot: Dict,
        abattoirs_capacity: Dict,
        n_suggestions: int = 3
    ) -> List[Dict]:
        """
        Suggérer les meilleures dates pour un lot

        Args:
            lot: Informations du lot
            abattoirs_capacity: Capacités abattoirs
            n_suggestions: Nombre de suggestions

        Returns:
            Liste des meilleures options
        """

        suggestions = []

        for abattoir_id, dates_capacity in abattoirs_capacity.items():
            for date_abattage, capacity in dates_capacity.items():

                # Calculer coûts
                distance = self._get_distance_cost(lot['site'], abattoir_id)
                urgence = self._get_urgence_cost(
                    lot['date_fin_gavage'],
                    date_abattage,
                    lot.get('urgence', 3)
                )
                surcharge = self._get_surcharge_cost(lot['nb_canards'], capacity)

                total_cost = distance + urgence * 10 + surcharge * 5

                # Vérifier faisabilité
                if lot['nb_canards'] <= capacity and date_abattage >= lot['date_fin_gavage']:
                    suggestions.append({
                        'abattoir_id': abattoir_id,
                        'date': date_abattage,
                        'cost': total_cost,
                        'distance_km': distance,
                        'delai_jours': (date_abattage - lot['date_fin_gavage']).days,
                        'taux_remplissage': lot['nb_canards'] / capacity
                    })

        # Trier par coût
        suggestions.sort(key=lambda x: x['cost'])

        return suggestions[:n_suggestions]

    def analyze_capacity_usage(
        self,
        planning: Dict[int, Tuple[str, date]],
        lots_ready: List[Dict],
        abattoirs_capacity: Dict
    ) -> pd.DataFrame:
        """
        Analyser l'utilisation des capacités d'abattage

        Args:
            planning: Planning optimisé
            lots_ready: Lots à abattre
            abattoirs_capacity: Capacités

        Returns:
            DataFrame avec utilisation par abattoir et date
        """

        # Créer mapping lot_id → lot
        lots_map = {lot['id']: lot for lot in lots_ready}

        # Calculer utilisation
        usage = []

        for abattoir_id, dates_capacity in abattoirs_capacity.items():
            for date_abattage, capacity in dates_capacity.items():

                # Compter canards planifiés ce jour
                nb_canards_planifies = sum(
                    lots_map[lot_id]['nb_canards']
                    for lot_id, (abb_id, date_abb) in planning.items()
                    if abb_id == abattoir_id and date_abb == date_abattage
                )

                usage.append({
                    'abattoir_id': abattoir_id,
                    'date': date_abattage,
                    'capacite': capacity,
                    'utilisation': nb_canards_planifies,
                    'taux_utilisation': nb_canards_planifies / capacity if capacity > 0 else 0,
                    'capacite_restante': capacity - nb_canards_planifies
                })

        df = pd.DataFrame(usage)

        return df.sort_values(['abattoir_id', 'date'])

    def detect_bottlenecks(
        self,
        capacity_analysis: pd.DataFrame,
        threshold: float = 0.9
    ) -> List[Dict]:
        """
        Détecter les goulots d'étranglement

        Args:
            capacity_analysis: Analyse d'utilisation
            threshold: Seuil de saturation (défaut 90%)

        Returns:
            Liste des jours saturés
        """

        bottlenecks = capacity_analysis[
            capacity_analysis['taux_utilisation'] >= threshold
        ]

        return bottlenecks.to_dict('records')

    def generate_planning_report(
        self,
        planning: Dict,
        lots_ready: List[Dict]
    ) -> Dict:
        """
        Générer rapport de planning

        Args:
            planning: Planning optimisé
            lots_ready: Lots planifiés

        Returns:
            Rapport détaillé
        """

        lots_map = {lot['id']: lot for lot in lots_ready}

        # Statistiques par site
        sites_stats = {}
        for lot_id, (abattoir_id, date_abattage) in planning.items():
            site = lots_map[lot_id]['site']

            if site not in sites_stats:
                sites_stats[site] = {
                    'nb_lots': 0,
                    'nb_canards': 0,
                    'abattoirs': set()
                }

            sites_stats[site]['nb_lots'] += 1
            sites_stats[site]['nb_canards'] += lots_map[lot_id]['nb_canards']
            sites_stats[site]['abattoirs'].add(abattoir_id)

        # Statistiques par abattoir
        abattoirs_stats = {}
        for lot_id, (abattoir_id, date_abattage) in planning.items():
            if abattoir_id not in abattoirs_stats:
                abattoirs_stats[abattoir_id] = {
                    'nb_lots': 0,
                    'nb_canards': 0,
                    'dates': set()
                }

            abattoirs_stats[abattoir_id]['nb_lots'] += 1
            abattoirs_stats[abattoir_id]['nb_canards'] += lots_map[lot_id]['nb_canards']
            abattoirs_stats[abattoir_id]['dates'].add(date_abattage)

        return {
            'nb_lots_total': len(planning),
            'nb_canards_total': sum(lots_map[lid]['nb_canards'] for lid in planning.keys()),
            'sites': {k: {**v, 'abattoirs': list(v['abattoirs'])} for k, v in sites_stats.items()},
            'abattoirs': {k: {**v, 'dates': sorted(list(v['dates']))} for k, v in abattoirs_stats.items()}
        }


# ============================================================================
# EXEMPLE D'UTILISATION
# ============================================================================

if __name__ == "__main__":
    # Créer instance
    optimizer = AbattageOptimizer()

    # Lots prêts pour abattage
    lots_ready = [
        {'id': 1, 'site': 'LL', 'nb_canards': 500, 'date_fin_gavage': date(2024, 12, 18), 'urgence': 4},
        {'id': 2, 'site': 'LS', 'nb_canards': 800, 'date_fin_gavage': date(2024, 12, 19), 'urgence': 3},
        {'id': 3, 'site': 'MT', 'nb_canards': 600, 'date_fin_gavage': date(2024, 12, 20), 'urgence': 5},
        {'id': 4, 'site': 'LL', 'nb_canards': 400, 'date_fin_gavage': date(2024, 12, 21), 'urgence': 2},
    ]

    # Capacités abattoirs
    abattoirs_capacity = {
        'abattoir_1': {
            date(2024, 12, 19): 1000,
            date(2024, 12, 20): 1200,
            date(2024, 12, 21): 1000,
        },
        'abattoir_2': {
            date(2024, 12, 19): 800,
            date(2024, 12, 20): 900,
            date(2024, 12, 21): 800,
        }
    }

    # Optimiser
    planning = optimizer.optimize_weekly_planning(lots_ready, abattoirs_capacity)

    print("\n📋 Planning optimisé:")
    for lot_id, (abattoir, date_abb) in planning.items():
        lot = next(l for l in lots_ready if l['id'] == lot_id)
        print(f"   Lot {lot_id} ({lot['site']}) → {abattoir} le {date_abb}")

    # Rapport
    report = optimizer.generate_planning_report(planning, lots_ready)

    print(f"\n📊 Rapport:")
    print(f"   Total: {report['nb_lots_total']} lots, {report['nb_canards_total']} canards")
