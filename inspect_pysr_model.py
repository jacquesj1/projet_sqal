#!/usr/bin/env python3
"""
Inspecte le modèle PySR pour comprendre son équation et ses paramètres
"""
import pickle
import sys

model_path = "documentation/Courbes-Gavage-IA/model_pysr_GavIA.pkl"

print("Chargement du modèle PySR...")
try:
    with open(model_path, 'rb') as f:
        model = pickle.load(f)

    print("\n" + "="*80)
    print("INFORMATIONS MODELE PYSR")
    print("="*80)

    # Type du modèle
    print(f"\nType: {type(model)}")

    # Attributs disponibles
    print(f"\nAttributs disponibles:")
    for attr in dir(model):
        if not attr.startswith('_'):
            print(f"  - {attr}")

    # Équation symbolique
    if hasattr(model, 'sympy'):
        print(f"\nÉquation symbolique (SymPy):")
        print(f"  {model.sympy()}")

    # Meilleure équation
    if hasattr(model, 'get_best'):
        print(f"\nMeilleure équation:")
        best = model.get_best()
        print(f"  {best}")

    # Features utilisées
    if hasattr(model, 'feature_names_in_'):
        print(f"\nFeatures d'entrée:")
        for i, feat in enumerate(model.feature_names_in_):
            print(f"  {i}: {feat}")

    # Équations disponibles (Hall of Fame)
    if hasattr(model, 'equations_'):
        print(f"\nNombre d'équations dans le Hall of Fame: {len(model.equations_)}")
        print(f"\nTop 5 équations (par complexité):")
        for i, eq in enumerate(model.equations_.head(5).itertuples()):
            print(f"\n  Équation {i+1}:")
            print(f"    Complexité: {eq.complexity}")
            print(f"    Loss: {eq.loss}")
            print(f"    Score: {eq.score}")
            if hasattr(eq, 'equation'):
                print(f"    Formule: {eq.equation}")

    # Test prédiction
    print(f"\n" + "="*80)
    print("TEST PREDICTION")
    print("="*80)

    import numpy as np

    # Exemple: age=90, weight_goal=400, food_intake_goal=7500, diet_duration=11
    X_test = np.array([[90, 400, 7500, 11]])

    print(f"\nEntrée test:")
    print(f"  age: 90 jours")
    print(f"  weight_goal: 400g (poids foie cible)")
    print(f"  food_intake_goal: 7500g (total aliment sur période)")
    print(f"  diet_duration: 11 jours")

    prediction = model.predict(X_test)
    print(f"\nPrédiction (courbe nutrition):")
    print(f"  {prediction}")

except FileNotFoundError:
    print(f"Erreur: Fichier {model_path} non trouvé")
    sys.exit(1)
except Exception as e:
    print(f"Erreur: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
