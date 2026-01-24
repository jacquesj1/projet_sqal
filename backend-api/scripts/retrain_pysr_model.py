"""
Script de réentraînement du modèle PySR pour génération de courbes théoriques

Ce script:
1. Charge les données depuis pysrData.csv
2. Nettoie et formate les données
3. Entraîne un nouveau modèle PySR avec contraintes pour éviter overflow
4. Sauvegarde le modèle dans backend-api/models/

Usage:
    python scripts/retrain_pysr_model.py
"""

import pandas as pd
import numpy as np
import pickle
import json
import ast
from pathlib import Path
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split

print("=" * 60)
print("REENTRAINEMENT MODELE PYSR")
print("=" * 60)

# Chemins
BASE_DIR = Path(__file__).parent.parent
DATA_PATH = BASE_DIR.parent / "documentation" / "Courbes-Gavage-IA" / "pysrData.csv"
MODEL_PATH = BASE_DIR / "models" / "model_pysr_GavIA_v2.pkl"
SCALER_PATH = BASE_DIR / "models" / "scaler_pysr_v2.pkl"

print(f"\nChargement donnees depuis: {DATA_PATH}")

# Lire le fichier CSV brut
with open(DATA_PATH, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Parser manuellement (chaque enregistrement sur 2 lignes)
data_records = []
header = lines[0].strip().split(',')

i = 1
while i < len(lines):
    line1 = lines[i].strip()
    if i + 1 < len(lines):
        line2 = lines[i + 1].strip()
        # Combiner les 2 lignes
        full_line = line1 + line2
        # Enlever les quotes au début et fin
        if full_line.startswith('"') and full_line.endswith('"""'):
            full_line = full_line[1:-3]  # Enlever " au début et """ à la fin

        # Parser la ligne: 0,89.0,381.78,7610.0,11.0,"[221. 242. ...]"
        parts = full_line.split(',', 5)  # Split max 5 fois (6 colonnes)
        if len(parts) == 6:
            idx = parts[0]
            age = float(parts[1])
            weight_goal = float(parts[2])
            food_intake_goal = float(parts[3])
            diet_duration = float(parts[4])

            # Parser l'array nutrition_curve
            curve_str = parts[5]
            # Enlever les doubles quotes internes
            curve_str = curve_str.replace('""', '')
            curve_str = curve_str.replace('"', '')
            curve_str = curve_str.strip()

            # Convertir string array en liste Python
            try:
                # Si c'est du format numpy [221. 242. ...]
                curve_str = curve_str.replace('[', '').replace(']', '')
                curve_values = [float(x) for x in curve_str.split()]

                data_records.append({
                    'age': age,
                    'weight_goal': weight_goal,
                    'food_intake_goal': food_intake_goal,
                    'diet_duration': int(diet_duration),
                    'nutrition_curve': curve_values
                })
            except:
                pass  # Skip malformed records

        i += 2  # Skip next line (already processed)
    else:
        i += 1

print(f"OK - {len(data_records)} enregistrements charges")

# Créer DataFrame
df = pd.DataFrame(data_records)

print("\n=== STATISTIQUES DATASET ===")
print(df[['age', 'weight_goal', 'food_intake_goal', 'diet_duration']].describe())

# Préparer données pour PySR
# On va prédire les doses individuelles (pas le array complet)
# Créer un dataset où chaque ligne = (age, weight_goal, food_intake_goal, diet_duration, day) -> dose

training_data = []
for _, row in df.iterrows():
    age = row['age']
    weight_goal = row['weight_goal']
    food_intake_goal = row['food_intake_goal']
    diet_duration = row['diet_duration']
    curve = row['nutrition_curve']

    # Pour chaque jour de gavage
    for day, dose in enumerate(curve[:diet_duration], start=1):
        training_data.append({
            'age': age,
            'weight_goal': weight_goal,
            'food_intake_goal': food_intake_goal,
            'diet_duration': diet_duration,
            'day': day,
            'dose': dose
        })

train_df = pd.DataFrame(training_data)
print(f"\nOK - Dataset etendu: {len(train_df)} lignes (jour par jour)")

# Features et target
X = train_df[['age', 'weight_goal', 'food_intake_goal', 'diet_duration', 'day']].values
y = train_df['dose'].values

print(f"\nFeatures shape: {X.shape}")
print(f"Target shape: {y.shape}")

# Normaliser les features (IMPORTANT pour éviter overflow)
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

print("\n=== NORMALISATION FEATURES ===")
print("Moyennes:", scaler.mean_)
print("Ecarts-types:", scaler.scale_)

# Split train/test
X_train, X_test, y_train, y_test = train_test_split(
    X_scaled, y, test_size=0.2, random_state=42
)

print(f"\nTrain: {len(X_train)} samples")
print(f"Test: {len(X_test)} samples")

# Entraîner PySR
print("\n" + "=" * 60)
print("ENTRAINEMENT PYSR (peut prendre 5-15 minutes)")
print("=" * 60)

try:
    from pysr import PySRRegressor

    model = PySRRegressor(
        niterations=20,  # Test rapide (augmenter à 100+ en prod)
        binary_operators=["+", "*", "-", "/"],
        unary_operators=["square", "cube"],  # PAS exp pour éviter overflow !
        populations=10,  # Réduit pour vitesse
        population_size=20,  # Réduit pour vitesse
        ncyclesperiteration=300,  # Réduit pour vitesse
        maxsize=15,  # Réduit complexité max
        maxdepth=8,  # Réduit profondeur max
        parsimony=0.005,  # Favorise simplicité
        timeout_in_seconds=300,  # 5 minutes max
        random_state=42,
        verbosity=1,
        progress=True,
        model_selection="best",  # Sélectionner meilleur modèle
        early_stop_condition=(
            "stop_if(loss, complexity) = loss < 100 && complexity < 12"  # Moins strict pour vitesse
        )
    )

    print("\nDemarrage entrainement...")
    model.fit(X_train, y_train)

    print("\nOK - Entrainement termine !")

    # Evaluer sur test set
    y_pred = model.predict(X_test)
    mae = np.mean(np.abs(y_test - y_pred))
    rmse = np.sqrt(np.mean((y_test - y_pred) ** 2))
    r2 = 1 - np.sum((y_test - y_pred) ** 2) / np.sum((y_test - y_test.mean()) ** 2)

    print("\n=== PERFORMANCE MODELE ===")
    print(f"MAE (Mean Absolute Error): {mae:.2f}g")
    print(f"RMSE (Root Mean Squared Error): {rmse:.2f}g")
    print(f"R² Score: {r2:.4f}")

    # Afficher la meilleure équation
    print("\n=== MEILLEURE EQUATION ===")
    print(model.sympy())

    # Sauvegarder modèle
    MODEL_PATH.parent.mkdir(exist_ok=True)
    with open(MODEL_PATH, 'wb') as f:
        pickle.dump(model, f)
    print(f"\nOK - Modele sauvegarde: {MODEL_PATH}")

    # Sauvegarder scaler
    with open(SCALER_PATH, 'wb') as f:
        pickle.dump(scaler, f)
    print(f"OK - Scaler sauvegarde: {SCALER_PATH}")

    # Test rapide
    print("\n=== TEST PREDICTION ===")
    # Exemple: age=90, weight_goal=400, food_intake_goal=7600, diet_duration=14, day=1
    test_input = np.array([[90, 400, 7600, 14, 1]])
    test_input_scaled = scaler.transform(test_input)
    test_pred = model.predict(test_input_scaled)
    print(f"Prediction jour 1 (age=90, poids=400g, duree=14j): {test_pred[0]:.1f}g")

    # Générer courbe complète
    print("\nCourbe complete (14 jours):")
    for day in range(1, 15):
        test_input = np.array([[90, 400, 7600, 14, day]])
        test_input_scaled = scaler.transform(test_input)
        dose = model.predict(test_input_scaled)[0]
        print(f"  Jour {day:2d}: {dose:6.1f}g")

    print("\n" + "=" * 60)
    print("SUCCES - Modele PySR v2 pret a utiliser !")
    print("=" * 60)
    print(f"\nFichiers crees:")
    print(f"  - {MODEL_PATH}")
    print(f"  - {SCALER_PATH}")
    print(f"\nProchaine etape:")
    print(f"  Mettre a jour pysr_predictor.py pour utiliser le nouveau modele + scaler")

except ImportError:
    print("\nERREUR: ERREUR: pysr n'est pas installe")
    print("Installation: pip install pysr")
except Exception as e:
    print(f"\nERREUR: ERREUR lors de l'entrainement: {e}")
    import traceback
    traceback.print_exc()
