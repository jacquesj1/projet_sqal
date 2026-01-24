#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Demo avec fichier de configuration YAML
Inspection Foie Gras VL53L8CH avec profils prédéfinis
"""

from vl53l8ch_raw_simulator import VL53L8CH_RawSimulator
from vl53l8ch_data_analyzer import VL53L8CH_DataAnalyzer
from vl53l8ch_visualizations import visualize_complete_analysis, visualize_3d_advanced
from as7341_visualizations import visualize_spectral_analysis, visualize_spectral_simple
from fusion_visualizations import visualize_fusion_dashboard
from config_loader import ConfigLoader
from foiegras_fusion_simulator import FoieGrasFusionSimulator
import matplotlib
matplotlib.use('TkAgg')
import matplotlib.pyplot as plt
import sys
import argparse

def main():
    """Demo principal avec configuration YAML"""

    # Arguments ligne de commande
    parser = argparse.ArgumentParser(description='Demo inspection foie gras avec configuration')
    parser.add_argument('--profile', type=str,
                       help='Nom du profil à utiliser (voir config_foiegras.yaml)')
    parser.add_argument('--list-profiles', action='store_true',
                       help='Lister les profils disponibles')
    parser.add_argument('--config', type=str, default='config_foiegras.yaml',
                       help='Chemin du fichier de configuration')
    parser.add_argument('--no-viz', action='store_true',
                       help='Ne pas afficher les visualisations')
    parser.add_argument('--fusion', action='store_true',
                       help='Utiliser le mode fusion (VL53L8CH + AS7341)')

    args = parser.parse_args()

    # Charger la configuration
    loader = ConfigLoader(args.config)

    # Lister les profils si demandé
    if args.list_profiles:
        print("\n" + "=" * 70)
        print("PROFILS DISPONIBLES")
        print("=" * 70)
        profiles = loader.list_profiles()
        for name, description in profiles.items():
            print(f"\n{name}:")
            print(f"  {description}")
        print("\n" + "=" * 70)
        print("\nUsage: python demo_avec_config.py --profile <nom_profil>")
        print(f"Exemple: python demo_avec_config.py --profile foiegras_standard_barquette")
        return

    try:
        # Charger le profil
        loader.load(args.profile)

        print("\n" + "=" * 70)
        print("DEMO INSPECTION FOIE GRAS - Configuration YAML")
        print("=" * 70)

        # Afficher les infos du profil
        loader.print_profile_info()

        # Extraire les paramètres
        vl53l8ch_params = loader.get_vl53l8ch_params()
        as7341_params = loader.get_as7341_params()
        measurement_params = loader.get_measurement_params()
        viz_params = loader.get_visualization_params()

        # Mode fusion ou mode simple
        if args.fusion and as7341_params.get('enabled', False):
            print("\n[MODE FUSION] VL53L8CH + AS7341")

            # 1. Créer le simulateur de fusion
            print("\n[1/5] Création du simulateur de fusion...")
            fusion_sim = FoieGrasFusionSimulator(vl53l8ch_params, as7341_params)

            # 2. Générer les données complètes
            print("[2/5] Génération des données (ToF + Spectral)...")
            fusion_result = fusion_sim.simulate_complete_inspection(**measurement_params)

            # 3. Extraire les résultats
            print("[3/5] Extraction des résultats de fusion...")
            raw_data = fusion_result['vl53l8ch_raw']
            analysis_data = fusion_result['vl53l8ch_analysis']
            as7341_analysis = fusion_result['as7341_analysis']
            fusion_data = fusion_result['fusion_result']
        else:
            print("\n[MODE SIMPLE] VL53L8CH uniquement")
            if args.fusion:
                print("[INFO] AS7341 désactivé dans le profil - mode fusion ignoré")

            # 1. Créer le simulateur
            print("\n[1/5] Création du simulateur...")
            sim = VL53L8CH_RawSimulator(**vl53l8ch_params)

            # 2. Générer les données brutes
            print("[2/5] Génération des données brutes...")
            raw_data = sim.simulate_measurement(**measurement_params)

            # 3. Analyser les données
            print("[3/5] Analyse des données...")
            analyzer = VL53L8CH_DataAnalyzer()
            analysis_data = analyzer.process(raw_data)
            as7341_analysis = None
            fusion_data = None

        # 4. Afficher les résultats
        print("\n" + "=" * 70)
        print("RÉSULTATS DE L'ANALYSE")
        print("=" * 70)

        if fusion_data:
            # Affichage mode fusion
            print(f"[FUSION] Grade final:     {fusion_data['final_grade']}")
            print(f"[FUSION] Score final:     {fusion_data['final_score']:.3f}")
            print(f"  - ToF score:           {fusion_data['tof_score']:.3f} ({fusion_data['tof_contribution']*100:.0f}%)")
            print(f"  - Spectral score:      {fusion_data['spectral_score']:.3f} ({fusion_data['spectral_contribution']*100:.0f}%)")
            print(f"\n[ToF] Volume:            {fusion_data['metrics']['volume_mm3']:.0f} mm³")
            print(f"[Spectral] Freshness:    {fusion_data['metrics']['freshness_index']:.2f}")
            print(f"[Spectral] Fat quality:  {fusion_data['metrics']['fat_quality_index']:.2f}")
            print(f"\nDéfauts combinés: {len(fusion_data['combined_defects'])}")
            if fusion_data['combined_defects']:
                print("\nDétail des défauts:")
                for i, defect in enumerate(fusion_data['combined_defects'][:10], 1):
                    defect_type = defect.get('type', 'unknown')
                    source = defect.get('source', 'ToF')
                    if 'pos' in defect:
                        print(f"  {i}. [{source}] {defect_type} en {defect['pos']} - sévérité: {defect['severity']:.2f}")
                    else:
                        print(f"  {i}. [{source}] {defect_type}")
        else:
            # Affichage mode simple
            print(f"Grade:           {analysis_data['grade']}")
            print(f"Score qualité:   {analysis_data['quality_score']:.3f}")
            print(f"Volume:          {analysis_data['stats']['volume_trapezoidal_mm3']:.0f} mm³")
            print(f"Défauts détectés: {len(analysis_data['defects'])}")
            if analysis_data['defects']:
                print("\nDétail des défauts:")
                for i, defect in enumerate(analysis_data['defects'], 1):
                    print(f"  {i}. {defect['type']} en {defect['pos']} - sévérité: {defect['severity']:.2f}")

        print("=" * 70)

        # 5. Visualisations (si activées)
        if not args.no_viz:
            print("\n[4/5] Génération des visualisations...")

            # Dashboard de fusion si mode fusion activé
            if fusion_data and as7341_analysis:
                print("  - Dashboard de FUSION (VL53L8CH + AS7341)...")
                fig_fusion = visualize_fusion_dashboard(
                    fusion_result,
                    f"Multi-Sensor Fusion Dashboard - {loader.current_profile}"
                )

                # Analyse détaillée AS7341
                print("  - Analyse détaillée AS7341 (Spectral)...")
                fig_spectral = visualize_spectral_analysis(
                    as7341_analysis,
                    fusion_result['as7341_raw'],
                    f"AS7341 Spectral Analysis - {loader.current_profile}"
                )
            else:
                # Mode ToF seul - Dashboard VL53L8CH
                print("  - Dashboard VL53L8CH (ToF uniquement)...")
                fig_dashboard = visualize_complete_analysis(analysis_data, raw_data,
                                                           f"VL53L8CH Dashboard - {loader.current_profile}")

            # Générer les visualisations 3D VL53L8CH
            display_modes = viz_params['display_modes']
            if display_modes:
                print(f"[5/5] Génération des visualisations 3D VL53L8CH ({len(display_modes)} mode(s))...")

                for mode in display_modes:
                    colormap = viz_params['colormaps'].get(mode, 'viridis')
                    print(f"  - Génération: {mode}...")

                    fig = visualize_3d_advanced(
                        analysis_data=analysis_data,
                        raw_data=raw_data,
                        display_mode=mode,
                        style=viz_params['style'],
                        show_defects=viz_params['show_defects'],
                        interpolate_surface=viz_params['interpolate_surface'],
                        colormap=colormap
                    )
                    fig.suptitle(f"VL53L8CH 3D - {mode} - {loader.current_profile}",
                                fontsize=14)

            # Afficher toutes les fenêtres
            print("\n" + "=" * 70)
            if fusion_data:
                print("Affichage des visualisations (VL53L8CH + AS7341)...")
            else:
                print("Affichage des visualisations (VL53L8CH)...")
            print("Fermez les fenêtres pour terminer le programme.")
            print("=" * 70)
            plt.show()
        else:
            print("\n[INFO] Visualisations désactivées (--no-viz)")

    except Exception as e:
        print(f"\n[ERREUR] {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
