"""
Script de test - Comparaison Courbe Prédictive v1 vs v2

Compare les résultats entre:
- v1: Interpolation linéaire simple avec lissage 80/20
- v2: Algorithme hybride (spline + contraintes + lissage adaptatif)

Usage:
    python scripts/test_courbe_predictive_v2.py
"""

import sys
from pathlib import Path

# Ajouter app au path
BASE_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(BASE_DIR))

from app.services.courbe_predictive_v2 import generer_courbe_predictive_v2, ContraintesVeterinaires
import numpy as np

print("=" * 70)
print("TEST COURBE PREDICTIVE V2 - Algorithme Hybride")
print("=" * 70)

# Données de test
doses_reelles = [
    {"jour": 1, "dose_reelle_g": 220.0, "dose_theorique_g": 221.3},
    {"jour": 2, "dose_reelle_g": 240.0, "dose_theorique_g": 242.7},
    {"jour": 3, "dose_reelle_g": 260.0, "dose_theorique_g": 262.1},
    {"jour": 4, "dose_reelle_g": 280.0, "dose_theorique_g": 283.5},
    {"jour": 5, "dose_reelle_g": 200.0, "dose_theorique_g": 302.8},  # ECART !
]

doses_theoriques = [
    {"jour": 1, "dose_theorique_g": 221.3},
    {"jour": 2, "dose_theorique_g": 242.7},
    {"jour": 3, "dose_theorique_g": 262.1},
    {"jour": 4, "dose_theorique_g": 283.5},
    {"jour": 5, "dose_theorique_g": 302.8},
    {"jour": 6, "dose_theorique_g": 324.2},
    {"jour": 7, "dose_theorique_g": 343.6},
    {"jour": 8, "dose_theorique_g": 365.0},
    {"jour": 9, "dose_theorique_g": 384.3},
    {"jour": 10, "dose_theorique_g": 405.7},
    {"jour": 11, "dose_theorique_g": 425.1},
    {"jour": 12, "dose_theorique_g": 446.5},
    {"jour": 13, "dose_theorique_g": 465.9},
    {"jour": 14, "dose_theorique_g": 487.2},
]

dernier_jour_reel = 5
duree_totale = 14
race = "Mulard"

print("\n=== SCENARIO TEST ===")
print(f"Dernier jour reel: {dernier_jour_reel}")
print(f"Derniere dose reelle: {doses_reelles[-1]['dose_reelle_g']}g")
print(f"Derniere dose theorique: {doses_reelles[-1]['dose_theorique_g']}g")
print(f"Ecart: {doses_reelles[-1]['dose_reelle_g'] - doses_reelles[-1]['dose_theorique_g']:.1f}g")
print(f"Dose finale theorique: {doses_theoriques[-1]['dose_theorique_g']}g")
print(f"Jours restants: {duree_totale - dernier_jour_reel}")
print(f"Race: {race}")

# Test v1 (Linéaire simple)
print("\n" + "=" * 70)
print("V1 - INTERPOLATION LINEAIRE + LISSAGE 80/20")
print("=" * 70)

derniere_dose_reelle = float(doses_reelles[-1]['dose_reelle_g'])
dose_finale_theo = float(doses_theoriques[-1]['dose_theorique_g'])
jours_restants = duree_totale - dernier_jour_reel

# Algorithme v1 simplifié
increment_moyen = (dose_finale_theo - derniere_dose_reelle) / jours_restants
courbe_v1 = []

for j in range(1, jours_restants + 1):
    jour = dernier_jour_reel + j
    dose_predictive = derniere_dose_reelle + (increment_moyen * j)

    # Dose théorique du jour
    dose_theo_jour = next(
        d['dose_theorique_g'] for d in doses_theoriques if d['jour'] == jour
    )

    # Lissage 80/20
    dose_lissee = dose_predictive * 0.8 + dose_theo_jour * 0.2

    courbe_v1.append({"jour": jour, "dose_g": round(dose_lissee, 1)})

print("\nCourbe V1:")
for dose in courbe_v1:
    theo = next(d['dose_theorique_g'] for d in doses_theoriques if d['jour'] == dose['jour'])
    ecart = dose['dose_g'] - theo
    print(f"  Jour {dose['jour']:2d}: {dose['dose_g']:6.1f}g (theo: {theo:6.1f}g, ecart: {ecart:+6.1f}g)")

total_v1 = sum(d['dose_g'] for d in courbe_v1)
moyenne_v1 = total_v1 / len(courbe_v1)
print(f"\nTotal: {total_v1:.1f}g")
print(f"Moyenne: {moyenne_v1:.1f}g/jour")

# Vérifier violations contraintes
violations_v1 = []
for i, dose in enumerate(courbe_v1):
    if dose['dose_g'] > ContraintesVeterinaires.DOSE_MAX_ABSOLUE:
        violations_v1.append(f"Jour {dose['jour']}: {dose['dose_g']}g > 800g (MAX)")

    if i > 0:
        dose_prec = courbe_v1[i-1]['dose_g']
        increment = dose['dose_g'] - dose_prec
        if abs(increment) > ContraintesVeterinaires.INCREMENT_MAX_PAR_JOUR:
            violations_v1.append(
                f"Jour {dose['jour']}: increment {increment:+.1f}g > 50g"
            )

if violations_v1:
    print("\nVIOLATIONS CONTRAINTES V1:")
    for v in violations_v1:
        print(f"  - {v}")
else:
    print("\nOK - Aucune violation contraintes")

# Test v2 (Hybride)
print("\n" + "=" * 70)
print("V2 - ALGORITHME HYBRIDE (Spline + Contraintes + Lissage Adaptatif)")
print("=" * 70)

courbe_v2 = generer_courbe_predictive_v2(
    doses_reelles=doses_reelles,
    doses_theoriques=doses_theoriques,
    dernier_jour_reel=dernier_jour_reel,
    duree_totale=duree_totale,
    race=race
)

print("\nCourbe V2:")
for dose in courbe_v2:
    theo = next(d['dose_theorique_g'] for d in doses_theoriques if d['jour'] == dose['jour'])
    ecart = dose['dose_g'] - theo
    print(f"  Jour {dose['jour']:2d}: {dose['dose_g']:6.1f}g (theo: {theo:6.1f}g, ecart: {ecart:+6.1f}g)")

total_v2 = sum(d['dose_g'] for d in courbe_v2)
moyenne_v2 = total_v2 / len(courbe_v2)
print(f"\nTotal: {total_v2:.1f}g")
print(f"Moyenne: {moyenne_v2:.1f}g/jour")

# Vérifier violations contraintes
violations_v2 = []
for i, dose in enumerate(courbe_v2):
    if dose['dose_g'] > ContraintesVeterinaires.DOSE_MAX_ABSOLUE:
        violations_v2.append(f"Jour {dose['jour']}: {dose['dose_g']}g > 800g (MAX)")

    if i > 0:
        dose_prec = courbe_v2[i-1]['dose_g']
        increment = dose['dose_g'] - dose_prec
        if abs(increment) > ContraintesVeterinaires.INCREMENT_MAX_PAR_JOUR:
            violations_v2.append(
                f"Jour {dose['jour']}: increment {increment:+.1f}g > 50g"
            )

if violations_v2:
    print("\nVIOLATIONS CONTRAINTES V2:")
    for v in violations_v2:
        print(f"  - {v}")
else:
    print("\nOK - Aucune violation contraintes")

# Comparaison
print("\n" + "=" * 70)
print("COMPARAISON V1 vs V2")
print("=" * 70)

print(f"\n{'Metrique':<30} {'V1':>12} {'V2':>12} {'Delta':>12}")
print("-" * 70)

# Total aliment
delta_total = total_v2 - total_v1
print(f"{'Total aliment (g)':<30} {total_v1:>12.1f} {total_v2:>12.1f} {delta_total:>+12.1f}")

# Moyenne
delta_moyenne = moyenne_v2 - moyenne_v1
print(f"{'Moyenne dose (g/j)':<30} {moyenne_v1:>12.1f} {moyenne_v2:>12.1f} {delta_moyenne:>+12.1f}")

# Ecart moyen vs theorique
ecart_moyen_v1 = np.mean([
    abs(d['dose_g'] - next(t['dose_theorique_g'] for t in doses_theoriques if t['jour'] == d['jour']))
    for d in courbe_v1
])
ecart_moyen_v2 = np.mean([
    abs(d['dose_g'] - next(t['dose_theorique_g'] for t in doses_theoriques if t['jour'] == d['jour']))
    for d in courbe_v2
])
delta_ecart = ecart_moyen_v2 - ecart_moyen_v1
print(f"{'Ecart moyen vs theo (g)':<30} {ecart_moyen_v1:>12.1f} {ecart_moyen_v2:>12.1f} {delta_ecart:>+12.1f}")

# Violations
print(f"{'Violations contraintes':<30} {len(violations_v1):>12} {len(violations_v2):>12} {len(violations_v2)-len(violations_v1):>+12}")

# Progression (std dev des incréments)
increments_v1 = [courbe_v1[i]['dose_g'] - courbe_v1[i-1]['dose_g'] for i in range(1, len(courbe_v1))]
increments_v2 = [courbe_v2[i]['dose_g'] - courbe_v2[i-1]['dose_g'] for i in range(1, len(courbe_v2))]
std_v1 = np.std(increments_v1)
std_v2 = np.std(increments_v2)
delta_std = std_v2 - std_v1
print(f"{'Regularite (std increments)':<30} {std_v1:>12.1f} {std_v2:>12.1f} {delta_std:>+12.1f}")

print("\n" + "=" * 70)
print("CONCLUSION")
print("=" * 70)

print("\nAmelioration V2:")
if len(violations_v2) < len(violations_v1):
    print(f"  OK - {len(violations_v1) - len(violations_v2)} violations en moins")
elif len(violations_v2) == 0:
    print("  OK - Aucune violation contraintes")

if abs(delta_ecart) < 5:
    print(f"  OK - Proximite theorique similaire ({delta_ecart:+.1f}g)")
elif delta_ecart < 0:
    print(f"  OK - Plus proche theorique ({delta_ecart:+.1f}g)")
else:
    print(f"  Info - Legerement plus eloigne theorique ({delta_ecart:+.1f}g)")

if std_v2 < std_v1:
    print(f"  OK - Progression plus reguliere (std {delta_std:+.1f})")

print("\n" + "=" * 70)
print("TEST TERMINE")
print("=" * 70)
