#!/usr/bin/env python3
"""
================================================================================
Simulateur de Données de Gavage - Point d'entrée unifié
================================================================================
Description : Génère des données réalistes de gavage
Usage       : python main.py --nb-lots 100 --output data.csv
================================================================================
"""

# Importer le simulateur (maintenant dans le même dossier)
from gavage_data_simulator import main as original_main

if __name__ == '__main__':
    print("🦆 Simulateur de Données de Gavage - Version Dockerisée")
    print("="*70)
    original_main()
