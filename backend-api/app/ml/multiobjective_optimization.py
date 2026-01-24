"""
Multi-Objective Optimization Module - NSGA-II Algorithm
Optimizes duck feeding parameters with multiple competing objectives

Objectifs simultanés:
1. Maximiser poids du foie (ITM)
2. Minimiser mortalité
3. Minimiser coûts d'alimentation
4. Minimiser durée de gavage
5. Maximiser satisfaction consommateur

Uses NSGA-II (Non-dominated Sorting Genetic Algorithm II)
"""

import numpy as np
import asyncpg
from typing import Dict, List, Optional, Tuple
from datetime import datetime
import logging
from dataclasses import dataclass

# DEAP imports (Distributed Evolutionary Algorithms in Python)
try:
    from deap import algorithms, base, creator, tools
    import random
    DEAP_AVAILABLE = True
except ImportError:
    DEAP_AVAILABLE = False
    logging.warning("DEAP not available. Install with: pip install deap")

logger = logging.getLogger(__name__)


@dataclass
class FeedingParameters:
    """Paramètres de gavage à optimiser"""
    dose_matin: float  # grammes
    dose_soir: float  # grammes
    temperature_stabule: float  # degrés Celsius
    humidite_stabule: float  # pourcentage
    duree_gavage: int  # jours
    nb_repas_jour: int  # nombre de repas par jour


@dataclass
class OptimizationObjectives:
    """Objectifs d'optimisation (scores à maximiser)"""
    poids_foie: float  # kg (ITM)
    survie: float  # 1 - taux_mortalite
    efficacite_cout: float  # ITM / cout_total
    rapidite: float  # 1 / duree_gavage
    satisfaction_consommateur: float  # note 0-5


class MultiObjectiveOptimizer:
    """
    Optimiseur multi-objectifs utilisant NSGA-II

    NSGA-II est un algorithme génétique qui:
    1. Maintient une population de solutions
    2. Évalue chaque solution sur tous les objectifs
    3. Utilise le concept de dominance de Pareto
    4. Sélectionne les meilleures solutions non-dominées
    5. Génère une nouvelle population par crossover et mutation
    """

    def __init__(self, db_pool: asyncpg.Pool):
        self.db_pool = db_pool
        self.toolbox = None
        self.population_size = 100
        self.n_generations = 50
        self.crossover_prob = 0.8
        self.mutation_prob = 0.2

        # Bounds pour les paramètres
        self.bounds = {
            "dose_matin": (200, 600),  # grammes
            "dose_soir": (200, 600),  # grammes
            "temperature_stabule": (18, 24),  # °C
            "humidite_stabule": (50, 80),  # %
            "duree_gavage": (10, 18),  # jours
            "nb_repas_jour": (2, 3)  # repas
        }

        if not DEAP_AVAILABLE:
            logger.error("DEAP is required for Multi-Objective Optimization")

    def setup_deap(self):
        """
        Configure DEAP pour NSGA-II

        Création des types:
        - FitnessMulti: Fitness avec 5 objectifs à maximiser
        - Individual: Individu = liste de 6 paramètres
        """
        if not DEAP_AVAILABLE:
            raise RuntimeError("DEAP is not installed")

        # Create fitness class (5 objectives to MAXIMIZE)
        if not hasattr(creator, "FitnessMulti"):
            creator.create(
                "FitnessMulti",
                base.Fitness,
                weights=(1.0, 1.0, 1.0, 1.0, 1.0)  # Tous positifs = maximiser
            )

        # Create individual class
        if not hasattr(creator, "Individual"):
            creator.create(
                "Individual",
                list,
                fitness=creator.FitnessMulti
            )

        # Create toolbox
        self.toolbox = base.Toolbox()

        # Attribute generators (6 paramètres)
        self.toolbox.register(
            "dose_matin",
            random.uniform,
            self.bounds["dose_matin"][0],
            self.bounds["dose_matin"][1]
        )
        self.toolbox.register(
            "dose_soir",
            random.uniform,
            self.bounds["dose_soir"][0],
            self.bounds["dose_soir"][1]
        )
        self.toolbox.register(
            "temperature",
            random.uniform,
            self.bounds["temperature_stabule"][0],
            self.bounds["temperature_stabule"][1]
        )
        self.toolbox.register(
            "humidite",
            random.uniform,
            self.bounds["humidite_stabule"][0],
            self.bounds["humidite_stabule"][1]
        )
        self.toolbox.register(
            "duree",
            random.randint,
            self.bounds["duree_gavage"][0],
            self.bounds["duree_gavage"][1]
        )
        self.toolbox.register(
            "nb_repas",
            random.randint,
            self.bounds["nb_repas_jour"][0],
            self.bounds["nb_repas_jour"][1]
        )

        # Individual = [dose_matin, dose_soir, temp, humidite, duree, nb_repas]
        self.toolbox.register(
            "individual",
            tools.initCycle,
            creator.Individual,
            (
                self.toolbox.dose_matin,
                self.toolbox.dose_soir,
                self.toolbox.temperature,
                self.toolbox.humidite,
                self.toolbox.duree,
                self.toolbox.nb_repas
            ),
            n=1
        )

        # Population
        self.toolbox.register(
            "population",
            tools.initRepeat,
            list,
            self.toolbox.individual
        )

        # Operators
        self.toolbox.register("mate", tools.cxSimulatedBinaryBounded, low=[
            self.bounds["dose_matin"][0],
            self.bounds["dose_soir"][0],
            self.bounds["temperature_stabule"][0],
            self.bounds["humidite_stabule"][0],
            self.bounds["duree_gavage"][0],
            self.bounds["nb_repas_jour"][0]
        ], up=[
            self.bounds["dose_matin"][1],
            self.bounds["dose_soir"][1],
            self.bounds["temperature_stabule"][1],
            self.bounds["humidite_stabule"][1],
            self.bounds["duree_gavage"][1],
            self.bounds["nb_repas_jour"][1]
        ], eta=20.0)

        self.toolbox.register("mutate", tools.mutPolynomialBounded, low=[
            self.bounds["dose_matin"][0],
            self.bounds["dose_soir"][0],
            self.bounds["temperature_stabule"][0],
            self.bounds["humidite_stabule"][0],
            self.bounds["duree_gavage"][0],
            self.bounds["nb_repas_jour"][0]
        ], up=[
            self.bounds["dose_matin"][1],
            self.bounds["dose_soir"][1],
            self.bounds["temperature_stabule"][1],
            self.bounds["humidite_stabule"][1],
            self.bounds["duree_gavage"][1],
            self.bounds["nb_repas_jour"][1]
        ], eta=20.0, indpb=0.2)

        self.toolbox.register("select", tools.selNSGA2)

    async def evaluate_individual(
        self,
        individual: List[float],
        genetique: str = "Mulard"
    ) -> Tuple[float, float, float, float, float]:
        """
        Évalue un individu sur les 5 objectifs

        Args:
            individual: [dose_matin, dose_soir, temp, humidite, duree, nb_repas]
            genetique: Type génétique du canard

        Returns:
            Tuple: (poids_foie, survie, efficacite_cout, rapidite, satisfaction)
        """
        dose_matin = individual[0]
        dose_soir = individual[1]
        temperature = individual[2]
        humidite = individual[3]
        duree = int(individual[4])
        nb_repas = int(individual[5])

        # 1. Prédire poids foie (ITM) - utiliser modèle ML ou formule empirique
        poids_foie = await self._predict_itm(
            dose_matin, dose_soir, temperature, humidite, duree, genetique
        )

        # 2. Prédire survie (1 - mortalité)
        survie = await self._predict_survie(
            dose_matin, dose_soir, temperature, humidite, duree, genetique
        )

        # 3. Calculer efficacité coût
        cout_total = self._calculate_cost(dose_matin, dose_soir, duree, nb_repas)
        efficacite_cout = poids_foie / cout_total if cout_total > 0 else 0

        # 4. Calculer rapidité (inverse de durée)
        rapidite = 1.0 / duree if duree > 0 else 0

        # 5. Prédire satisfaction consommateur
        satisfaction = await self._predict_satisfaction(
            poids_foie, dose_matin, dose_soir, genetique
        )

        return (poids_foie, survie, efficacite_cout, rapidite, satisfaction)

    async def _predict_itm(
        self,
        dose_matin: float,
        dose_soir: float,
        temperature: float,
        humidite: float,
        duree: int,
        genetique: str
    ) -> float:
        """
        Prédit l'ITM (poids foie) avec un modèle empirique

        Formule simplifiée basée sur les données historiques
        """
        # Modèle empirique simple (à remplacer par modèle ML entraîné)
        dose_moyenne = (dose_matin + dose_soir) / 2
        dose_totale = dose_moyenne * duree * 2  # 2 repas/jour

        # Facteur température (optimal = 21°C)
        temp_factor = 1.0 - abs(temperature - 21) * 0.02

        # Facteur humidité (optimal = 65%)
        humid_factor = 1.0 - abs(humidite - 65) * 0.005

        # Facteur génétique
        genetic_factors = {
            "Mulard": 1.0,
            "Barbarie": 0.85,
            "Pekin": 0.75
        }
        genetic_factor = genetic_factors.get(genetique, 0.9)

        # ITM = base + facteurs
        itm_base = (dose_totale / 1000) * 0.015  # Conversion empirique
        itm = itm_base * temp_factor * humid_factor * genetic_factor

        # Clamp entre valeurs réalistes
        return max(10.0, min(20.0, itm))

    async def _predict_survie(
        self,
        dose_matin: float,
        dose_soir: float,
        temperature: float,
        humidite: float,
        duree: int,
        genetique: str
    ) -> float:
        """
        Prédit le taux de survie (1 - mortalité)

        Returns:
            float: 0-1 (1 = 100% survie)
        """
        # Mortalité de base: 3%
        mortalite = 0.03

        # Facteurs de risque
        if dose_matin > 550 or dose_soir > 550:
            mortalite += 0.02  # Suralimentation

        if temperature < 19 or temperature > 23:
            mortalite += 0.01  # Stress thermique

        if duree > 15:
            mortalite += 0.01  # Gavage prolongé

        # Survie = 1 - mortalité
        survie = 1.0 - mortalite

        return max(0.85, min(0.99, survie))

    def _calculate_cost(
        self,
        dose_matin: float,
        dose_soir: float,
        duree: int,
        nb_repas: int
    ) -> float:
        """
        Calcule le coût total d'alimentation

        Args:
            dose_matin: Dose matin (grammes)
            dose_soir: Dose soir (grammes)
            duree: Durée gavage (jours)
            nb_repas: Nombre repas par jour

        Returns:
            float: Coût total en euros
        """
        # Prix du maïs: ~0.30€/kg
        prix_kg_mais = 0.30

        # Dose totale
        dose_jour = dose_matin + dose_soir
        dose_totale_kg = (dose_jour * duree) / 1000

        # Coût alimentation
        cout_alimentation = dose_totale_kg * prix_kg_mais

        # Coûts fixes (main d'œuvre, énergie, etc.)
        cout_fixe_jour = 2.0  # €/jour
        cout_fixe = cout_fixe_jour * duree

        return cout_alimentation + cout_fixe

    async def _predict_satisfaction(
        self,
        itm: float,
        dose_matin: float,
        dose_soir: float,
        genetique: str
    ) -> float:
        """
        Prédit la satisfaction consommateur

        Basé sur corrélations historiques feedback → paramètres production

        Returns:
            float: Score 0-5
        """
        # Satisfaction optimale pour ITM entre 15-17 kg
        if 15.0 <= itm <= 17.0:
            satisfaction_base = 4.5
        elif 14.0 <= itm < 15.0 or 17.0 < itm <= 18.0:
            satisfaction_base = 4.0
        else:
            satisfaction_base = 3.5

        # Bonus génétique Mulard
        if genetique == "Mulard":
            satisfaction_base += 0.3

        return min(5.0, satisfaction_base)

    async def optimize(
        self,
        genetique: str = "Mulard",
        population_size: int = 100,
        n_generations: int = 50
    ) -> Dict:
        """
        Lance l'optimisation NSGA-II

        Args:
            genetique: Type génétique
            population_size: Taille de la population
            n_generations: Nombre de générations

        Returns:
            Dict: {
                "pareto_front": List[Dict],  # Solutions optimales
                "best_solution": Dict,  # Meilleure solution (compromis)
                "statistics": Dict
            }
        """
        if not DEAP_AVAILABLE:
            return {
                "error": "DEAP not installed",
                "status": "failed"
            }

        # Setup DEAP
        self.setup_deap()
        self.population_size = population_size
        self.n_generations = n_generations

        # Register evaluation function
        async def evaluate_wrapper(individual):
            return await self.evaluate_individual(individual, genetique)

        # Create initial population
        population = self.toolbox.population(n=self.population_size)

        # Evaluate initial population
        logger.info(f"Evaluating initial population of {len(population)} individuals...")
        fitnesses = []
        for ind in population:
            fitness = await evaluate_wrapper(ind)
            fitnesses.append(fitness)

        for ind, fit in zip(population, fitnesses):
            ind.fitness.values = fit

        # Statistics
        stats = tools.Statistics(lambda ind: ind.fitness.values)
        stats.register("avg", np.mean, axis=0)
        stats.register("std", np.std, axis=0)
        stats.register("min", np.min, axis=0)
        stats.register("max", np.max, axis=0)

        logbook = tools.Logbook()
        logbook.header = "gen", "evals", "avg", "std", "min", "max"

        # Evolution loop
        for gen in range(self.n_generations):
            logger.info(f"Generation {gen + 1}/{self.n_generations}")

            # Select offspring
            offspring = self.toolbox.select(population, len(population))
            offspring = list(map(self.toolbox.clone, offspring))

            # Crossover
            for child1, child2 in zip(offspring[::2], offspring[1::2]):
                if random.random() < self.crossover_prob:
                    self.toolbox.mate(child1, child2)
                    del child1.fitness.values
                    del child2.fitness.values

            # Mutation
            for mutant in offspring:
                if random.random() < self.mutation_prob:
                    self.toolbox.mutate(mutant)
                    del mutant.fitness.values

            # Evaluate invalid individuals
            invalid_ind = [ind for ind in offspring if not ind.fitness.valid]
            fitnesses = []
            for ind in invalid_ind:
                fitness = await evaluate_wrapper(ind)
                fitnesses.append(fitness)

            for ind, fit in zip(invalid_ind, fitnesses):
                ind.fitness.values = fit

            # Replace population
            population[:] = self.toolbox.select(population + offspring, self.population_size)

            # Record statistics
            record = stats.compile(population)
            logbook.record(gen=gen, evals=len(invalid_ind), **record)

        # Extract Pareto front
        pareto_front = tools.sortNondominated(population, len(population), first_front_only=True)[0]

        # Format results
        pareto_solutions = []
        for ind in pareto_front:
            solution = {
                "parametres": {
                    "dose_matin": round(ind[0], 1),
                    "dose_soir": round(ind[1], 1),
                    "temperature_stabule": round(ind[2], 1),
                    "humidite_stabule": round(ind[3], 1),
                    "duree_gavage": int(ind[4]),
                    "nb_repas_jour": int(ind[5])
                },
                "objectifs": {
                    "poids_foie_kg": round(ind.fitness.values[0], 2),
                    "survie": round(ind.fitness.values[1], 3),
                    "efficacite_cout": round(ind.fitness.values[2], 3),
                    "rapidite": round(ind.fitness.values[3], 3),
                    "satisfaction": round(ind.fitness.values[4], 2)
                }
            }
            pareto_solutions.append(solution)

        # Best compromise solution (highest sum of normalized objectives)
        best_idx = self._find_best_compromise(pareto_front)
        best_solution = pareto_solutions[best_idx] if best_idx >= 0 else pareto_solutions[0]

        # Store in database
        await self._store_optimization_results(genetique, pareto_solutions, best_solution)

        return {
            "status": "success",
            "genetique": genetique,
            "population_size": population_size,
            "n_generations": n_generations,
            "pareto_front_size": len(pareto_solutions),
            "pareto_front": pareto_solutions,
            "best_solution": best_solution,
            "timestamp": datetime.utcnow().isoformat()
        }

    def _find_best_compromise(self, pareto_front: List) -> int:
        """
        Trouve la meilleure solution de compromis dans le front de Pareto

        Méthode: Normalisation puis somme pondérée des objectifs

        Returns:
            int: Index de la meilleure solution
        """
        if not pareto_front:
            return -1

        # Extract objectives
        objectives = np.array([ind.fitness.values for ind in pareto_front])

        # Normalize (min-max normalization)
        normalized = (objectives - objectives.min(axis=0)) / (objectives.max(axis=0) - objectives.min(axis=0) + 1e-10)

        # Weighted sum (equal weights)
        scores = normalized.sum(axis=1)

        # Best = highest score
        return int(np.argmax(scores))

    async def _store_optimization_results(
        self,
        genetique: str,
        pareto_solutions: List[Dict],
        best_solution: Dict
    ):
        """Store optimization results in database"""
        query = """
        INSERT INTO ml_optimization_results (
            genetique,
            pareto_front,
            best_solution,
            created_at
        ) VALUES ($1, $2, $3, NOW())
        """

        async with self.db_pool.acquire() as conn:
            await conn.execute(
                query,
                genetique,
                pareto_solutions,
                best_solution
            )


def get_multiobjective_optimizer(db_pool: asyncpg.Pool) -> MultiObjectiveOptimizer:
    """Factory function to get MultiObjectiveOptimizer instance"""
    return MultiObjectiveOptimizer(db_pool)
