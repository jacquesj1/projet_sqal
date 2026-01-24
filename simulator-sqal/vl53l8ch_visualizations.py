# vl53l8ch_visualizations.py
"""
VL53L8CH ADVANCED VISUALIZATIONS
Fonctions de visualisation avancées combinant données brutes et résultats d'analyse
pour l'inspection qualité du foie gras.
"""

from typing import Dict
import numpy as np
import matplotlib.pyplot as plt

def visualize_complete_analysis(analysis_data: Dict, raw_data: Dict, title: str = "Analyse VL53L8CH Foie Gras"):
    """Visualisation complète des résultats d'analyse avec explications détaillées

    Args:
        analysis_data: Output from VL53L8CH_DataAnalyzer.process()
        raw_data: Output from VL53L8CH_RawSimulator.simulate_measurement()
        title: Title for the visualization
    """

    fig, axes = plt.subplots(2, 4, figsize=(22, 12))
    fig.suptitle(title, fontsize=18, fontweight='bold')

    # Données from raw_data
    distances = raw_data["distance_matrix"]
    reflectances = raw_data["reflectance_matrix"]
    amplitudes = raw_data["amplitude_matrix"]
    resolution = raw_data["meta"]["resolution"]

    # Analysis results from analysis_data
    defects = analysis_data["defects"]
    stats = analysis_data["stats"]
    bins_analysis = analysis_data.get("bins_analysis")

    # Configuration globale des graphiques
    plt.rcParams.update({'font.size': 10})

    # 1. Distances avec explications
    im1 = axes[0, 0].imshow(distances, cmap='viridis_r', interpolation='nearest',
                           vmin=30, vmax=80)
    axes[0, 0].set_title('DISTANCES CAPTEUR-SURFACE\n(Plus foncé = plus proche)',
                        fontsize=11, fontweight='bold')

    # Colorbar avec explications
    cbar1 = plt.colorbar(im1, ax=axes[0, 0], shrink=0.8)
    cbar1.set_label('Distance (mm)\n\n30mm = Très épais\n50mm = Normal\n80mm = Fin',
                   fontsize=9, linespacing=1.5)

    # Zones de référence
    axes[0, 0].text(0.02, 0.98, 'INTERPRÉTATION:\n• Zones sombres: Foie gras épais\n• Zones claires: Foie gras fin\n• Variations brutales: Défauts possibles',
                   transform=axes[0, 0].transAxes, fontsize=8, verticalalignment='top',
                   bbox=dict(boxstyle="round,pad=0.3", facecolor="white", alpha=0.8))

    # Grille et axes
    axes[0, 0].set_xticks(range(resolution))
    axes[0, 0].set_yticks(range(resolution))
    axes[0, 0].set_xlabel('Position X (zones capteur)', fontsize=9)
    axes[0, 0].set_ylabel('Position Y (zones capteur)', fontsize=9)

    # 2. Réflectances avec seuils visuels
    im2 = axes[0, 1].imshow(reflectances, cmap='RdYlBu_r', interpolation='nearest',
                           vmin=30, vmax=80)
    axes[0, 1].set_title('PROPRIÉTÉS OPTIQUES\n(Réflectance infrarouge)',
                        fontsize=11, fontweight='bold')

    cbar2 = plt.colorbar(im2, ax=axes[0, 1], shrink=0.8)
    cbar2.set_label('Réflectance (%)\n\n40-70% = Normal foie gras\n<40% = Trop absorbant\n>70% = Trop réfléchissant',
                   fontsize=9, linespacing=1.5)

    # Zones normales en overlay
    normal_min, normal_max = 40, 70
    axes[0, 1].contour(reflectances, levels=[normal_min, normal_max],
                      colors=['green', 'green'], linewidths=2, linestyles=['--', '--'])
    axes[0, 1].text(0.02, 0.98, f'SEUILS QUALITÉ:\nZone verte: {normal_min}-{normal_max}% (Normal)\nHors zone: Défaut optique',
                   transform=axes[0, 1].transAxes, fontsize=8, verticalalignment='top',
                   bbox=dict(boxstyle="round,pad=0.3", facecolor="lightgreen", alpha=0.8))

    axes[0, 1].set_xticks(range(resolution))
    axes[0, 1].set_yticks(range(resolution))
    axes[0, 1].set_xlabel('Position X (zones capteur)', fontsize=9)
    axes[0, 1].set_ylabel('Position Y (zones capteur)', fontsize=9)

    # 3. Amplitudes signal avec explications physiques
    im3 = axes[0, 2].imshow(amplitudes, cmap='plasma', interpolation='nearest')
    axes[0, 2].set_title('QUALITÉ DU SIGNAL\n(Intensité retour infrarouge)',
                        fontsize=11, fontweight='bold')

    cbar3 = plt.colorbar(im3, ax=axes[0, 2], shrink=0.8)
    cbar3.set_label('Amplitude signal\n\nÉlevée = Bon retour IR\nFaible = Matériau absorbant\nou distance excessive',
                   fontsize=9, linespacing=1.5)

    # Calcul seuil signal faible
    signal_threshold = np.mean(amplitudes) - np.std(amplitudes)
    axes[0, 2].contour(amplitudes, levels=[signal_threshold], colors=['red'], linewidths=2)
    axes[0, 2].text(0.02, 0.98, 'DIAGNOSTIC SIGNAL:\n• Couleur chaude: Signal fort (bon)\n• Couleur froide: Signal faible\n• Ligne rouge: Seuil d\'alerte',
                   transform=axes[0, 2].transAxes, fontsize=8, verticalalignment='top',
                   bbox=dict(boxstyle="round,pad=0.3", facecolor="lightyellow", alpha=0.8))

    axes[0, 2].set_xticks(range(resolution))
    axes[0, 2].set_yticks(range(resolution))
    axes[0, 2].set_xlabel('Position X (zones capteur)', fontsize=9)
    axes[0, 2].set_ylabel('Position Y (zones capteur)', fontsize=9)

    # 4. Histogramme CNH avec interprétation
    if raw_data.get("bins_matrix") is not None:
        bins_matrix = raw_data["bins_matrix"]
        # Handle different bin matrix shapes (8x8x128 or 32x128)
        if bins_matrix.ndim == 3:
            # Shape is (res, res, n_bins), compute mean across spatial dimensions
            mean_histogram = np.mean(bins_matrix.reshape(-1, bins_matrix.shape[-1]), axis=0)
            std_histogram = np.std(bins_matrix.reshape(-1, bins_matrix.shape[-1]), axis=0)
        else:
            # Shape is (32, n_bins), compute mean across zones
            mean_histogram = np.mean(bins_matrix, axis=0)
            std_histogram = np.std(bins_matrix, axis=0)

        bins_range = np.arange(len(mean_histogram))
        axes[0, 3].plot(bins_range, mean_histogram, 'b-', linewidth=2, label='Profil moyen')
        axes[0, 3].fill_between(bins_range, mean_histogram - std_histogram,
                               mean_histogram + std_histogram, alpha=0.3, color='blue', label='Variation')

        axes[0, 3].set_title('SIGNATURE MATÉRIAU\n(Histogramme infrarouge)',
                            fontsize=11, fontweight='bold')
        axes[0, 3].set_xlabel('Bins de distance (proche → loin)', fontsize=9)
        axes[0, 3].set_ylabel('Intensité du retour IR', fontsize=9)
        axes[0, 3].grid(True, alpha=0.3)
        axes[0, 3].legend(fontsize=8)

        # Annotations explicatives
        peak_bin = np.argmax(mean_histogram)
        axes[0, 3].annotate(f'Pic principal\n(surface foie gras)',
                           xy=(peak_bin, mean_histogram[peak_bin]),
                           xytext=(peak_bin + 8, mean_histogram[peak_bin] + 50),
                           arrowprops=dict(arrowstyle='->', color='red'),
                           fontsize=8, ha='center')

        axes[0, 3].text(0.02, 0.98, 'LECTURE:\n• Pic étroit: Surface lisse\n• Pic large: Surface rugueuse\n• Multi-pics: Transparence/multi-couches',
                       transform=axes[0, 3].transAxes, fontsize=8, verticalalignment='top',
                       bbox=dict(boxstyle="round,pad=0.3", facecolor="lightcyan", alpha=0.8))

    # 5. Carte défauts avec légende couleurs
    defect_map = np.zeros((resolution, resolution))
    defect_severity_map = np.zeros((resolution, resolution))

    # Extract defect positions and severities from defects list
    for defect in defects:
        pos = defect.get("pos")
        severity = defect.get("severity", 0.0)
        if pos and len(pos) == 2:
            i, j = pos
            if 0 <= i < resolution and 0 <= j < resolution:
                defect_map[i, j] = 1
                defect_severity_map[i, j] += severity

    im5 = axes[1, 0].imshow(defect_severity_map, cmap='Reds', interpolation='nearest',
                           vmin=0, vmax=1)
    axes[1, 0].set_title('CARTE DES DÉFAUTS\n(Sévérité cumulée)',
                        fontsize=11, fontweight='bold')

    cbar5 = plt.colorbar(im5, ax=axes[1, 0], shrink=0.8)
    cbar5.set_label('Sévérité défaut\n\n0 = Aucun défaut\n0.5 = Défaut mineur\n1 = Défaut majeur',
                   fontsize=9, linespacing=1.5)

    # Code couleur défauts
    defect_color_guide = '''TYPES DE DÉFAUTS:
× Rouge: Corps étranger
× Orange: Déformation surface
× Jaune: Variation texture
× Violet: Variation densité
× Rose: Signal incohérent'''

    axes[1, 0].text(0.02, 0.98, defect_color_guide,
                   transform=axes[1, 0].transAxes, fontsize=8, verticalalignment='top',
                   bbox=dict(boxstyle="round,pad=0.3", facecolor="mistyrose", alpha=0.8))

    axes[1, 0].set_xticks(range(resolution))
    axes[1, 0].set_yticks(range(resolution))
    axes[1, 0].set_xlabel('Position X (zones capteur)', fontsize=9)
    axes[1, 0].set_ylabel('Position Y (zones capteur)', fontsize=9)

    # 6. Distribution défauts avec interprétation
    # Extract defect types from defects list
    defect_types = [d.get("type", "Unknown") for d in defects]
    if defect_types:
        from collections import Counter
        type_counts = Counter(defect_types)
        types = list(type_counts.keys())
        counts = list(type_counts.values())

        # Couleurs selon criticité
        colors = []
        for defect_type in types:
            if "Corps étranger" in defect_type:
                colors.append('red')  # Critique
            elif "Déformation" in defect_type:
                colors.append('orange')  # Important
            elif any(word in defect_type for word in ["texture", "densité"]):
                colors.append('yellow')  # Mineur
            else:
                colors.append('gray')  # Autre

        bars = axes[1, 1].bar(range(len(types)), counts, color=colors, alpha=0.7, edgecolor='black')
        axes[1, 1].set_xticks(range(len(types)))
        axes[1, 1].set_xticklabels([t[:15] + '...' if len(t) > 15 else t for t in types],
                                  rotation=45, ha='right', fontsize=8)
        axes[1, 1].set_title('RÉPARTITION DES DÉFAUTS\n(Nombre par type)',
                            fontsize=11, fontweight='bold')
        axes[1, 1].set_ylabel('Nombre de zones affectées', fontsize=9)

        # Ajout valeurs sur barres
        for bar, count in zip(bars, counts):
            axes[1, 1].text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.1,
                           str(count), ha='center', va='bottom', fontweight='bold')

        # Légende criticité
        criticite_text = '''NIVEAUX DE CRITICITÉ:
Rouge: REJET obligatoire
Orange: Déclassement possible
Jaune: Surveillance renforcée
Gris: Information'''

        axes[1, 1].text(0.02, 0.98, criticite_text,
                       transform=axes[1, 1].transAxes, fontsize=8, verticalalignment='top',
                       bbox=dict(boxstyle="round,pad=0.3", facecolor="wheat", alpha=0.8))
    else:
        axes[1, 1].text(0.5, 0.5, 'AUCUN DÉFAUT DÉTECTÉ\n\n✓ Produit conforme\n✓ Qualité excellente',
                       ha='center', va='center', transform=axes[1, 1].transAxes,
                       fontsize=14, color='green', fontweight='bold',
                       bbox=dict(boxstyle="round,pad=0.5", facecolor="lightgreen", alpha=0.8))
        axes[1, 1].set_title('STATUT QUALITÉ', fontsize=11, fontweight='bold')

    # 7. Score qualité avec interprétation
    quality_score = analysis_data["quality_score"]
    grade = analysis_data["grade"]

    # Gauge score avec zones colorées
    angles = np.linspace(0, np.pi, 100)
    scores = np.linspace(0, 1, 100)

    # Zones qualité
    colors_gauge = []
    for score in scores:
        if score >= 0.85:
            colors_gauge.append('green')
        elif score >= 0.70:
            colors_gauge.append('orange')
        elif score >= 0.55:
            colors_gauge.append('red')
        else:
            colors_gauge.append('darkred')

    for i in range(len(angles)-1):
        axes[1, 2].fill_between([angles[i], angles[i+1]], [0, 0], [1, 1],
                               color=colors_gauge[i], alpha=0.3)

    # Aiguille du score
    score_angle = quality_score * np.pi
    axes[1, 2].plot([score_angle, score_angle], [0, 0.8], 'k-', linewidth=4)
    axes[1, 2].plot(score_angle, 0.8, 'ko', markersize=8)

    axes[1, 2].set_xlim(0, np.pi)
    axes[1, 2].set_ylim(0, 1)
    axes[1, 2].set_title(f'SCORE QUALITÉ: {quality_score:.3f}\n{grade}',
                        fontsize=11, fontweight='bold')

    # Échelle score
    score_labels = ['REJET\n< 0.55', 'GRADE C\n0.55-0.70', 'GRADE B\n0.70-0.85', 'GRADE A\n> 0.85']
    score_positions = [0.2, 0.6, 1.0, 1.4]
    for pos, label in zip(score_positions, score_labels):
        axes[1, 2].text(pos, -0.15, label, ha='center', va='top', fontsize=8, fontweight='bold')

    axes[1, 2].set_xticks([])
    axes[1, 2].set_yticks([])
    axes[1, 2].axis('off')

    interpretation_score = '''INTERPRÉTATION SCORE:
• > 0.85: Excellente qualité
• 0.70-0.85: Bonne qualité
• 0.55-0.70: Qualité acceptable
• < 0.55: Qualité insuffisante'''

    axes[1, 2].text(0.02, 0.3, interpretation_score,
                   transform=axes[1, 2].transAxes, fontsize=8, verticalalignment='top',
                   bbox=dict(boxstyle="round,pad=0.3", facecolor="lightblue", alpha=0.8))

    # 8. Résumé exécutif avec recommandations
    axes[1, 3].axis('off')

    # Calcul statistiques importantes
    volume = stats.get('volume_trapezoidal_mm3', stats.get('volume_mm3', 0))
    nb_defects = len(defect_types)
    surface_uniformity = stats['surface_uniformity']

    # Dimensions grille et produit
    grid_x = raw_data["meta"].get("grid_coverage_x_mm", 0)
    grid_y = raw_data["meta"].get("grid_coverage_y_mm", 0)
    ellipsoid = raw_data["meta"].get("ellipsoid_dimensions")

    # Recommandations selon résultats
    if quality_score >= 0.85:
        recommendation = "✓ ACCEPTER - Produit excellent"
        action_color = "lightgreen"
    elif quality_score >= 0.70:
        recommendation = "⚠ ACCEPTER - Surveiller qualité"
        action_color = "lightyellow"
    elif quality_score >= 0.55:
        recommendation = "⚠ DÉCLASSER - Qualité limitée"
        action_color = "orange"
    else:
        recommendation = "✗ REJETER - Qualité insuffisante"
        action_color = "lightcoral"

    summary_text = f'''RÉSUMÉ INSPECTION AUTOMATIQUE

DIMENSIONS:
Grille capteur: {grid_x:.0f}x{grid_y:.0f} mm'''

    if ellipsoid:
        summary_text += f"""
Produit mesuré: {ellipsoid['length_mm']:.0f}x{ellipsoid['width_mm']:.0f}x{ellipsoid['height_mm']:.0f} mm"""

    summary_text += f"""

MESURES PHYSIQUES:
Volume estimé: {volume:.0f} mm³
Surface uniformité: {surface_uniformity:.2f}
Nombre défauts: {nb_defects}

CLASSIFICATION:
Grade final: {grade}
Score qualité: {quality_score:.3f}

DÉCISION RECOMMANDÉE:
{recommendation}

ACTIONS SUGGÉRÉES:"""

    if nb_defects == 0:
        summary_text += "\n• Aucune action requise\n• Produit conforme spécifications"
    else:
        summary_text += f"\n• Vérifier zones marquées en rouge"
        if any("Corps étranger" in dt for dt in defect_types):
            summary_text += "\n• ALERTE: Corps étranger détecté"
        if quality_score < 0.7:
            summary_text += "\n• Contrôle qualité renforcé"

    axes[1, 3].text(0.05, 0.95, summary_text, transform=axes[1, 3].transAxes,
                   verticalalignment='top', fontsize=10, fontfamily='monospace',
                   bbox=dict(boxstyle="round,pad=0.5", facecolor=action_color, alpha=0.8))

    # Marquage des défauts sur toutes les cartes avec légendes
    defect_symbols = {'foreign_body': 'X', 'surface_deformation': 's',
                     'Corps étranger': 'X', 'Déformation surface': 's',
                     'Variation texture': '^', 'Variation densité': 'o',
                     'Inconsistance signal': '+', 'Réflectance faible': 'v',
                     'Réflectance élevée': 'D', 'Variation optique locale': '*'}

    for defect in defects:
        pos = defect.get("pos")
        defect_type = defect.get("type", "Unknown")
        if pos and len(pos) == 2:
            i, j = pos
            if 0 <= i < resolution and 0 <= j < resolution:
                symbol = defect_symbols.get(defect_type, 'x')
                # Marquage sur les 3 premières cartes
                for ax_idx in range(3):
                    axes[0, ax_idx].plot(j, i, symbol, color='red', markersize=10,
                                        markeredgewidth=2, markeredgecolor='white')

    # Dimensions grille
    zone_size_x = raw_data["meta"].get("zone_size_x_mm", raw_data["meta"]["zone_size_mm"])
    zone_size_y = raw_data["meta"].get("zone_size_y_mm", raw_data["meta"]["zone_size_mm"])

    # Ajout d'un guide de lecture général
    fig.text(0.02, 0.02,
             f'GUIDE DE LECTURE: Les zones capteur correspondent à une grille {resolution}×{resolution} sur la surface du foie gras. '
             f'Chaque pixel représente une zone de {zone_size_x:.1f}×{zone_size_y:.1f}mm. Les couleurs indiquent l\'intensité des mesures. '
             'Les symboles rouges marquent les défauts détectés automatiquement.',
             fontsize=9, style='italic', wrap=True,
             bbox=dict(boxstyle="round,pad=0.3", facecolor="lightgray", alpha=0.7))

    plt.tight_layout(rect=[0, 0.08, 1, 0.96])
    return fig


def visualize_3d_advanced(analysis_data: Dict,
                         raw_data: Dict,
                         display_mode: str = "height",
                         style: str = "surface",
                         show_defects: bool = True,
                         interpolate_surface: bool = True,
                         colormap: str = "viridis"):
    """
    Visualisation 3D avancée du foie gras avec options multiples

    Args:
        analysis_data: Output from VL53L8CH_DataAnalyzer.process()
        raw_data: Output from VL53L8CH_RawSimulator.simulate_measurement()
        display_mode: Mode d'affichage ('height', 'reflectance', 'amplitude', 'texture', 'density', 'defects')
        style: Style 3D ('surface', 'wireframe', 'scatter', 'contour3d')
        show_defects: Afficher marqueurs défauts
        interpolate_surface: Interpoler pour surface lisse
        colormap: Colormap matplotlib
    """

    fig = plt.figure(figsize=(16, 12))

    # Extract data from raw_data and analysis_data
    distances = raw_data["distance_matrix"]
    height_sensor = raw_data["meta"]["height_sensor_mm"]
    bins_analysis = analysis_data.get("bins_analysis")
    defects = analysis_data.get("defects", [])

    # Configuration selon mode d'affichage
    if display_mode == "height":
        # Surface 3D des hauteurs
        heights = height_sensor - distances  # Conversion en hauteurs
        data_3d = heights
        title = "Surface 3D - Hauteurs Foie Gras"
        z_label = "Hauteur (mm)"

    elif display_mode == "reflectance":
        # Surface colorée par réflectance
        heights = height_sensor - distances
        data_3d = heights
        color_data = raw_data["reflectance_matrix"]
        title = "Surface 3D - Propriétés Optiques"
        z_label = "Hauteur (mm)"

    elif display_mode == "amplitude":
        # Surface colorée par amplitude signal
        heights = height_sensor - distances
        data_3d = heights
        color_data = raw_data["amplitude_matrix"]
        title = "Surface 3D - Consistance Signal"
        z_label = "Hauteur (mm)"

    elif display_mode == "texture":
        # Surface colorée par texture
        heights = height_sensor - distances
        data_3d = heights
        if bins_analysis and "texture_score" in bins_analysis:
            color_data = np.array(bins_analysis["texture_score"])
        else:
            color_data = np.ones_like(heights) * 0.5
        title = "Surface 3D - Variations Texture"
        z_label = "Hauteur (mm)"

    elif display_mode == "density":
        # Surface colorée par densité
        heights = height_sensor - distances
        data_3d = heights
        if bins_analysis and "density_score" in bins_analysis:
            color_data = np.array(bins_analysis["density_score"])
        else:
            color_data = np.ones_like(heights) * 0.8
        title = "Surface 3D - Variations Densité"
        z_label = "Hauteur (mm)"

    elif display_mode == "defects":
        # Carte 3D des défauts
        heights = height_sensor - distances
        data_3d = heights
        res = raw_data["meta"]["resolution"]

        # Carte des sévérités de défauts
        defect_map = np.zeros((res, res))
        for defect in defects:
            pos = defect.get("pos")
            severity = defect.get("severity", 0.0)
            if pos and len(pos) == 2:
                i, j = pos
                if 0 <= i < res and 0 <= j < res:
                    defect_map[i, j] += severity
        color_data = defect_map
        title = "Surface 3D - Carte des Défauts"
        z_label = "Hauteur (mm)"

    # Création grilles coordonnées avec dimensions réelles
    zone_size_x = raw_data["meta"].get("zone_size_x_mm", raw_data["meta"]["zone_size_mm"])
    zone_size_y = raw_data["meta"].get("zone_size_y_mm", raw_data["meta"]["zone_size_mm"])
    resolution = raw_data["meta"]["resolution"]

    x_original = np.arange(resolution) * zone_size_x
    y_original = np.arange(resolution) * zone_size_y
    X_original, Y_original = np.meshgrid(x_original, y_original)

    # Interpolation pour surface plus lisse si demandée
    if interpolate_surface and style != "scatter":
        # Grille haute résolution
        x_max = (resolution - 1) * zone_size_x
        y_max = (resolution - 1) * zone_size_y
        x_interp = np.linspace(0, x_max, 25)
        y_interp = np.linspace(0, y_max, 25)
        X_interp, Y_interp = np.meshgrid(x_interp, y_interp)

        # Interpolation bicubique des données
        from scipy.interpolate import RectBivariateSpline
        interp_func = RectBivariateSpline(x_original, y_original, data_3d)
        Z_interp = interp_func(x_interp, y_interp)

        # Interpolation couleur si disponible
        if 'color_data' in locals():
            color_interp_func = RectBivariateSpline(x_original, y_original, color_data)
            color_interp = color_interp_func(x_interp, y_interp)

        X, Y, Z = X_interp, Y_interp, Z_interp
        if 'color_data' in locals():
            color_surface = color_interp
    else:
        X, Y, Z = X_original, Y_original, data_3d
        if 'color_data' in locals():
            color_surface = color_data

    # === Visualisation principale ===
    ax_main = fig.add_subplot(2, 2, (1, 2), projection='3d')

    # Rendu selon style choisi
    if style == "surface":
        if 'color_data' in locals():
            surf = ax_main.plot_surface(X, Y, Z, facecolors=plt.cm.get_cmap(colormap)(color_surface/np.max(color_surface)),
                                      alpha=0.9, shade=True, linewidth=0, antialiased=True)
        else:
            surf = ax_main.plot_surface(X, Y, Z, cmap=colormap, alpha=0.9, shade=True,
                                      linewidth=0, antialiased=True)

    elif style == "wireframe":
        surf = ax_main.plot_wireframe(X, Y, Z, color='blue', alpha=0.7, linewidth=1)

    elif style == "scatter":
        if 'color_data' in locals():
            surf = ax_main.scatter(X_original.flatten(), Y_original.flatten(), data_3d.flatten(),
                                 c=color_data.flatten(), cmap=colormap, s=50, alpha=0.8)
        else:
            surf = ax_main.scatter(X_original.flatten(), Y_original.flatten(), data_3d.flatten(),
                                 c=data_3d.flatten(), cmap=colormap, s=50, alpha=0.8)

    elif style == "contour3d":
        # Contours 3D à différents niveaux
        levels = np.linspace(np.min(Z), np.max(Z), 15)
        for level in levels:
            ax_main.contour(X, Y, Z, levels=[level], colors='blue', alpha=0.6)
        # Surface semi-transparente
        if 'color_data' in locals():
            # Use the recommended way to get colormap in newer matplotlib versions
            cmap = plt.colormaps[colormap]
            surf = ax_main.plot_surface(X, Y, Z, facecolors=cmap(color_surface/np.max(color_surface)),
                                      alpha=0.4, shade=True)
        else:
            surf = ax_main.plot_surface(X, Y, Z, cmap=colormap, alpha=0.4, shade=True)

    # Marquage des défauts si demandé
    if show_defects:
        # Couleurs par type de défaut
        defect_colors = {
            "foreign_body": "red",
            "surface_deformation": "orange",
            "Corps étranger": "red",
            "Déformation surface": "orange",
            "Variation texture": "yellow",
            "Variation densité": "purple",
            "Inconsistance signal": "pink",
            "Réflectance faible": "cyan",
            "Réflectance élevée": "magenta",
            "Variation optique locale": "lime"
        }

        for defect in defects:
            pos = defect.get("pos")
            dtype = defect.get("type", "Unknown")
            severity = defect.get("severity", 0.0)
            if pos and len(pos) == 2:
                i, j = pos
                if 0 <= i < resolution and 0 <= j < resolution:
                    x_defect = j * zone_size_x  # Conversion coordonnées
                    y_defect = i * zone_size_y
                    z_defect = data_3d[i, j] + 3  # Légèrement au-dessus

                    color = defect_colors.get(dtype, "black")
                    marker_size = 50 + severity * 100  # Taille selon sévérité

                    ax_main.scatter([x_defect], [y_defect], [z_defect],
                                  c=color, s=marker_size, marker='X',
                                  edgecolors='black', linewidth=2, alpha=0.9)

                    # Annotation du défaut
                    ax_main.text(x_defect, y_defect, z_defect + 2,
                               f"{dtype[:8]}\n{severity:.2f}",
                               fontsize=8, ha='center', va='bottom')

    # Configuration axes principal
    ax_main.set_xlabel('X (mm)', fontsize=12)
    ax_main.set_ylabel('Y (mm)', fontsize=12)
    ax_main.set_zlabel(z_label, fontsize=12)
    ax_main.set_title(title, fontsize=14, pad=20)

    # Ajustement vue 3D
    ax_main.view_init(elev=25, azim=45)
    ax_main.dist = 10

    # === Vues complémentaires ===

    # Vue de dessus (contours 2D)
    ax_top = fig.add_subplot(2, 2, 3)
    if 'color_data' in locals():
        contour = ax_top.contourf(X_original, Y_original, color_data, levels=15, cmap=colormap)
        plt.colorbar(contour, ax=ax_top, shrink=0.8)
        ax_top.set_title(f'Vue dessus - {display_mode}')
    else:
        contour = ax_top.contourf(X_original, Y_original, data_3d, levels=15, cmap=colormap)
        plt.colorbar(contour, ax=ax_top, shrink=0.8)
        ax_top.set_title('Vue dessus - Hauteurs')

    # Marquage défauts sur vue dessus
    if show_defects:
        for defect in defects:
            pos = defect.get("pos")
            severity = defect.get("severity", 0.0)
            if pos and len(pos) == 2:
                i, j = pos
                if 0 <= i < resolution and 0 <= j < resolution:
                    ax_top.plot(j * zone_size_x, i * zone_size_y, 'rx', markersize=8 + severity*5, markeredgewidth=2)

    ax_top.set_xlabel('X (mm)')
    ax_top.set_ylabel('Y (mm)')
    ax_top.set_aspect('equal')

    # Profils en coupe
    ax_profile = fig.add_subplot(2, 2, 4)

    # Profil central horizontal et vertical
    center_idx = resolution // 2
    center_row = data_3d[center_idx, :]  # Ligne centrale
    center_col = data_3d[:, center_idx]  # Colonne centrale

    x_profile_x = np.arange(resolution) * zone_size_x
    x_profile_y = np.arange(resolution) * zone_size_y
    ax_profile.plot(x_profile_x, center_row, 'b-', linewidth=2, label=f'Profil horizontal (Y={center_idx*zone_size_y:.0f}mm)')
    ax_profile.plot(x_profile_y, center_col, 'r-', linewidth=2, label=f'Profil vertical (X={center_idx*zone_size_x:.0f}mm)')

    # Marquage défauts sur profils
    if show_defects:
        for defect in defects:
            pos = defect.get("pos")
            severity = defect.get("severity", 0.0)
            if pos and len(pos) == 2:
                i, j = pos
                if 0 <= i < resolution and 0 <= j < resolution:
                    if i == center_idx:  # Défaut sur ligne centrale
                        ax_profile.plot(j * zone_size_x, center_row[j], 'bo', markersize=8, markerfacecolor='none')
                    if j == center_idx:  # Défaut sur colonne centrale
                        ax_profile.plot(i * zone_size_y, center_col[i], 'ro', markersize=8, markerfacecolor='none')

    ax_profile.set_xlabel('Position (mm)')
    ax_profile.set_ylabel('Hauteur (mm)')
    ax_profile.set_title('Profils en coupe')
    ax_profile.legend()
    ax_profile.grid(True, alpha=0.3)

    # Information globale
    stats = analysis_data["stats"]
    volume = stats.get('volume_trapezoidal_mm3', stats.get('volume_mm3', 0))
    avg_height = stats.get('avg_height_mm', 0)
    height_variation = stats.get('height_variation_mm', 0)
    surface_uniformity = stats.get('surface_uniformity', 0)
    grade = analysis_data.get('grade', 'Unknown')
    quality_score = analysis_data.get('quality_score', 0)

    # Ellipsoid and grid dimensions
    ellipsoid = raw_data["meta"].get("ellipsoid_dimensions")
    grid_x = raw_data["meta"].get("grid_coverage_x_mm", zone_size_x * resolution)
    grid_y = raw_data["meta"].get("grid_coverage_y_mm", zone_size_y * resolution)

    stats_text = f"""STATISTIQUES GLOBALES:
Volume: {volume:.0f} mm³
Hauteur moy: {avg_height:.1f} mm
Variation: {height_variation:.1f} mm
Uniformité: {surface_uniformity:.3f}

Grade: {grade}
Score: {quality_score:.3f}
Défauts: {len(defects)}

DIMENSIONS:
Grille: {grid_x:.0f}x{grid_y:.0f} mm"""

    if ellipsoid:
        stats_text += f"""
Produit: {ellipsoid['length_mm']:.0f}x{ellipsoid['width_mm']:.0f}x{ellipsoid['height_mm']:.0f} mm"""

    fig.text(0.02, 0.02, stats_text, fontsize=9, fontfamily='monospace',
             verticalalignment='bottom', bbox=dict(boxstyle="round,pad=0.3", facecolor="lightgray", alpha=0.8))

    plt.tight_layout()
    return fig
