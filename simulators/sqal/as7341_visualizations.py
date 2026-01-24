#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AS7341 VISUALIZATIONS
Visualisations complètes pour l'analyse spectrale AS7341
"""

import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.gridspec import GridSpec
import numpy as np
from typing import Dict, Any, Optional


# ============================================================================
# CONFIGURATION DES CANAUX SPECTRAUX
# ============================================================================

SPECTRAL_CHANNELS = {
    "F1_violet": {"wavelength": 415, "color": "#8B00FF", "label": "Violet"},
    "F2_indigo": {"wavelength": 445, "color": "#4B0082", "label": "Indigo"},
    "F3_blue": {"wavelength": 480, "color": "#0000FF", "label": "Blue"},
    "F4_cyan": {"wavelength": 515, "color": "#00FFFF", "label": "Cyan"},
    "F5_green": {"wavelength": 555, "color": "#00FF00", "label": "Green"},
    "F6_yellow": {"wavelength": 590, "color": "#FFFF00", "label": "Yellow"},
    "F7_orange": {"wavelength": 630, "color": "#FF8C00", "label": "Orange"},
    "F8_red": {"wavelength": 680, "color": "#FF0000", "label": "Red"},
    "NIR": {"wavelength": 910, "color": "#8B4513", "label": "NIR"},
}


# ============================================================================
# VISUALISATION SPECTRALE COMPLÈTE
# ============================================================================

def visualize_spectral_analysis(analysis_data: Dict[str, Any],
                                raw_data: Dict[str, Any],
                                title: str = "AS7341 Spectral Analysis") -> plt.Figure:
    """
    Crée une visualisation complète de l'analyse spectrale

    Args:
        analysis_data: Résultat de AS7341_DataAnalyzer.process()
        raw_data: Données brutes de AS7341_RawSimulator
        title: Titre de la figure

    Returns:
        Figure matplotlib
    """
    fig = plt.figure(figsize=(16, 10))
    gs = GridSpec(3, 3, figure=fig, hspace=0.3, wspace=0.3)

    # 1. Spectre brut (en haut à gauche)
    ax1 = fig.add_subplot(gs[0, 0])
    _plot_raw_spectrum(ax1, raw_data)

    # 2. Spectre normalisé (en haut au centre)
    ax2 = fig.add_subplot(gs[0, 1])
    _plot_normalized_spectrum(ax2, raw_data)

    # 3. Ratios spectraux (en haut à droite)
    ax3 = fig.add_subplot(gs[0, 2])
    _plot_spectral_ratios(ax3, analysis_data)

    # 4. Métriques de qualité (milieu à gauche)
    ax4 = fig.add_subplot(gs[1, 0])
    _plot_quality_metrics(ax4, analysis_data)

    # 5. Grade et score (milieu au centre)
    ax5 = fig.add_subplot(gs[1, 1])
    _plot_grade_score(ax5, analysis_data)

    # 6. Radar chart qualité (milieu à droite)
    ax6 = fig.add_subplot(gs[1, 2], projection='polar')
    _plot_quality_radar(ax6, analysis_data)

    # 7. Défauts détectés (bas à gauche)
    ax7 = fig.add_subplot(gs[2, 0])
    _plot_defects(ax7, analysis_data)

    # 8. Distribution des canaux (bas au centre)
    ax8 = fig.add_subplot(gs[2, 1])
    _plot_channel_distribution(ax8, raw_data)

    # 9. Indicateurs clés (bas à droite)
    ax9 = fig.add_subplot(gs[2, 2])
    _plot_key_indicators(ax9, analysis_data)

    fig.suptitle(title, fontsize=16, fontweight='bold')

    return fig


def _plot_raw_spectrum(ax, raw_data: Dict[str, Any]):
    """Spectre brut avec couleurs des canaux"""
    counts = raw_data["raw_counts"]

    channels = []
    values = []
    colors = []

    for ch_name, ch_info in SPECTRAL_CHANNELS.items():
        if ch_name in counts:
            channels.append(ch_info["label"])
            values.append(counts[ch_name])
            colors.append(ch_info["color"])

    bars = ax.bar(channels, values, color=colors, alpha=0.7, edgecolor='black')
    ax.set_ylabel("Counts (raw)", fontsize=10)
    ax.set_title("Raw Spectral Counts", fontsize=11, fontweight='bold')
    ax.tick_params(axis='x', rotation=45)
    ax.grid(True, alpha=0.3)

    # Ajouter valeurs sur les barres
    for bar, val in zip(bars, values):
        height = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2., height,
                f'{int(val)}', ha='center', va='bottom', fontsize=8)


def _plot_normalized_spectrum(ax, raw_data: Dict[str, Any]):
    """Spectre normalisé (0-1)"""
    counts = raw_data["raw_counts"]

    # Exclure Clear et Flicker
    spectral_counts = {k: v for k, v in counts.items()
                      if k in SPECTRAL_CHANNELS}

    if not spectral_counts:
        ax.text(0.5, 0.5, "No spectral data", ha='center', va='center')
        return

    max_count = max(spectral_counts.values())
    if max_count == 0:
        max_count = 1

    wavelengths = []
    normalized = []
    colors = []

    for ch_name, count in spectral_counts.items():
        ch_info = SPECTRAL_CHANNELS[ch_name]
        wavelengths.append(ch_info["wavelength"])
        normalized.append(count / max_count)
        colors.append(ch_info["color"])

    # Tracer ligne + points
    ax.plot(wavelengths, normalized, 'k-', linewidth=2, alpha=0.3)
    ax.scatter(wavelengths, normalized, c=colors, s=100, edgecolor='black',
              linewidth=1.5, zorder=5)

    ax.set_xlabel("Wavelength (nm)", fontsize=10)
    ax.set_ylabel("Normalized Intensity", fontsize=10)
    ax.set_title("Normalized Spectrum", fontsize=11, fontweight='bold')
    ax.set_ylim(0, 1.1)
    ax.grid(True, alpha=0.3)


def _plot_spectral_ratios(ax, analysis_data: Dict[str, Any]):
    """Ratios spectraux clés"""
    ratios = analysis_data["spectral_ratios"]

    # Ratios clés avec leurs limites
    key_ratios = {
        "violet_orange_ratio": ("V/O\nFreshness", 0.5),
        "nir_violet_ratio": ("NIR/V\nStructure", 3.0),
        "lipid_index": ("Lipid\nQuality", 4.0),
        "discoloration_index": ("Discol.\nIndex", 8.0),
    }

    labels = []
    values = []
    limits = []

    for ratio_name, (label, limit) in key_ratios.items():
        if ratio_name in ratios:
            labels.append(label)
            values.append(ratios[ratio_name])
            limits.append(limit)

    x = np.arange(len(labels))
    bars = ax.bar(x, values, color='steelblue', alpha=0.7, edgecolor='black')

    # Limites de référence
    for i, limit in enumerate(limits):
        ax.axhline(y=limit, xmin=(i-0.4)/len(labels), xmax=(i+0.4)/len(labels),
                  color='red', linestyle='--', linewidth=2, alpha=0.7)

    ax.set_xticks(x)
    ax.set_xticklabels(labels, fontsize=9)
    ax.set_ylabel("Ratio Value", fontsize=10)
    ax.set_title("Key Spectral Ratios", fontsize=11, fontweight='bold')
    ax.grid(True, alpha=0.3, axis='y')

    # Valeurs sur les barres
    for bar, val in zip(bars, values):
        height = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2., height,
                f'{val:.2f}', ha='center', va='bottom', fontsize=8)


def _plot_quality_metrics(ax, analysis_data: Dict[str, Any]):
    """Métriques de qualité (jauges horizontales)"""
    metrics = analysis_data["quality_metrics"]

    metric_names = {
        "freshness_index": "Freshness",
        "fat_quality_index": "Fat Quality",
        "color_uniformity": "Color Uniformity",
        "oxidation_index": "Oxidation"
    }

    labels = []
    values = []
    colors = []

    for key, name in metric_names.items():
        val = getattr(metrics, key, 0)
        labels.append(name)
        values.append(val)

        # Couleur selon valeur
        if key == "oxidation_index":  # Inverse pour oxydation
            color = 'green' if val < 0.3 else 'orange' if val < 0.6 else 'red'
        else:
            color = 'green' if val > 0.7 else 'orange' if val > 0.4 else 'red'
        colors.append(color)

    y = np.arange(len(labels))
    bars = ax.barh(y, values, color=colors, alpha=0.7, edgecolor='black')

    # Ligne de référence à 0.5
    ax.axvline(x=0.5, color='gray', linestyle='--', linewidth=1, alpha=0.5)

    ax.set_yticks(y)
    ax.set_yticklabels(labels, fontsize=10)
    ax.set_xlabel("Index (0-1)", fontsize=10)
    ax.set_xlim(0, 1)
    ax.set_title("Quality Metrics", fontsize=11, fontweight='bold')
    ax.grid(True, alpha=0.3, axis='x')

    # Valeurs
    for bar, val in zip(bars, values):
        width = bar.get_width()
        ax.text(width + 0.02, bar.get_y() + bar.get_height()/2.,
                f'{val:.2f}', ha='left', va='center', fontsize=9, fontweight='bold')


def _plot_grade_score(ax, analysis_data: Dict[str, Any]):
    """Affichage du grade et score"""
    grade = analysis_data["grade"]
    score = analysis_data["quality_score"]

    ax.axis('off')

    # Couleur selon grade
    grade_colors = {
        "A+": "darkgreen",
        "A": "green",
        "B": "orange",
        "C": "darkorange",
        "REJECT": "red"
    }
    grade_color = grade_colors.get(grade, "gray")

    # Affichage du grade
    ax.text(0.5, 0.7, grade, ha='center', va='center',
           fontsize=80, fontweight='bold', color=grade_color,
           bbox=dict(boxstyle='round,pad=0.3', facecolor='white',
                    edgecolor=grade_color, linewidth=3))

    # Affichage du score
    ax.text(0.5, 0.25, f"Score: {score:.3f}", ha='center', va='center',
           fontsize=24, fontweight='bold')

    # Barre de score
    bar_y = 0.1
    bar_width = 0.6
    bar_x_start = 0.5 - bar_width/2

    # Fond de la barre
    rect_bg = mpatches.Rectangle((bar_x_start, bar_y), bar_width, 0.05,
                                 facecolor='lightgray', edgecolor='black')
    ax.add_patch(rect_bg)

    # Barre de score
    score_color = 'green' if score > 0.7 else 'orange' if score > 0.4 else 'red'
    rect_score = mpatches.Rectangle((bar_x_start, bar_y), bar_width * score, 0.05,
                                    facecolor=score_color, edgecolor='black', linewidth=2)
    ax.add_patch(rect_score)

    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.set_title("Overall Grade", fontsize=11, fontweight='bold')


def _plot_quality_radar(ax, analysis_data: Dict[str, Any]):
    """Radar chart des métriques de qualité"""
    metrics = analysis_data["quality_metrics"]

    categories = ['Freshness', 'Fat Quality', 'Color\nUniformity', 'Anti-Oxidation']
    values = [
        metrics.freshness_index,
        metrics.fat_quality_index,
        metrics.color_uniformity,
        1.0 - metrics.oxidation_index  # Inverse pour cohérence
    ]

    # Nombre de variables
    N = len(categories)

    # Angles pour chaque axe
    angles = [n / float(N) * 2 * np.pi for n in range(N)]
    values += values[:1]  # Fermer le polygone
    angles += angles[:1]

    # Plot
    ax.plot(angles, values, 'o-', linewidth=2, color='steelblue')
    ax.fill(angles, values, alpha=0.25, color='steelblue')

    # Fixer les limites
    ax.set_ylim(0, 1)

    # Labels
    ax.set_xticks(angles[:-1])
    ax.set_xticklabels(categories, fontsize=9)

    # Grille
    ax.set_yticks([0.25, 0.5, 0.75, 1.0])
    ax.set_yticklabels(['0.25', '0.5', '0.75', '1.0'], fontsize=8)
    ax.grid(True)

    ax.set_title("Quality Radar", fontsize=11, fontweight='bold', pad=20)


def _plot_defects(ax, analysis_data: Dict[str, Any]):
    """Liste des défauts détectés"""
    defects = analysis_data["defects"]

    ax.axis('off')

    if not defects:
        ax.text(0.5, 0.5, "✓ No defects detected", ha='center', va='center',
               fontsize=16, color='green', fontweight='bold')
    else:
        ax.text(0.5, 0.95, f"⚠ {len(defects)} Defects Detected",
               ha='center', va='top', fontsize=14, fontweight='bold', color='red')

        y_pos = 0.85
        for i, defect in enumerate(defects[:8], 1):  # Max 8 défauts
            ax.text(0.05, y_pos, f"{i}. {defect}",
                   ha='left', va='top', fontsize=10,
                   bbox=dict(boxstyle='round,pad=0.3', facecolor='lightyellow',
                            edgecolor='orange', alpha=0.7))
            y_pos -= 0.1

        if len(defects) > 8:
            ax.text(0.05, y_pos, f"... and {len(defects)-8} more",
                   ha='left', va='top', fontsize=9, style='italic')

    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.set_title("Defects Analysis", fontsize=11, fontweight='bold')


def _plot_channel_distribution(ax, raw_data: Dict[str, Any]):
    """Distribution des intensités par région spectrale"""
    counts = raw_data["raw_counts"]

    # Grouper par région
    regions = {
        "UV-Violet": ["F1_violet", "F2_indigo"],
        "Blue-Cyan": ["F3_blue", "F4_cyan"],
        "Green-Yellow": ["F5_green", "F6_yellow"],
        "Orange-Red": ["F7_orange", "F8_red"],
        "NIR": ["NIR"]
    }

    region_names = []
    region_sums = []
    region_colors = []

    color_map = {
        "UV-Violet": "#8B00FF",
        "Blue-Cyan": "#0080FF",
        "Green-Yellow": "#80FF00",
        "Orange-Red": "#FF4000",
        "NIR": "#8B4513"
    }

    for region_name, channels in regions.items():
        total = sum(counts.get(ch, 0) for ch in channels)
        region_names.append(region_name)
        region_sums.append(total)
        region_colors.append(color_map[region_name])

    # Pie chart
    wedges, texts, autotexts = ax.pie(region_sums, labels=region_names,
                                       colors=region_colors, autopct='%1.1f%%',
                                       startangle=90, textprops={'fontsize': 9})

    # Style des pourcentages
    for autotext in autotexts:
        autotext.set_color('white')
        autotext.set_fontweight('bold')

    ax.set_title("Spectral Region Distribution", fontsize=11, fontweight='bold')


def _plot_key_indicators(ax, analysis_data: Dict[str, Any]):
    """Indicateurs clés (freshness, fat, oxidation)"""
    metrics = analysis_data["quality_metrics"]
    ratios = analysis_data["spectral_ratios"]

    ax.axis('off')

    indicators = [
        ("Freshness", metrics.freshness_index, "✓" if metrics.freshness_index > 0.7 else "⚠"),
        ("Fat Quality", metrics.fat_quality_index, "✓" if metrics.fat_quality_index > 0.7 else "⚠"),
        ("Oxidation", metrics.oxidation_index, "✓" if metrics.oxidation_index < 0.3 else "⚠"),
    ]

    y_pos = 0.9
    for name, value, icon in indicators:
        # Couleur
        if name == "Oxidation":
            color = 'green' if value < 0.3 else 'orange' if value < 0.6 else 'red'
        else:
            color = 'green' if value > 0.7 else 'orange' if value > 0.4 else 'red'

        # Texte
        ax.text(0.1, y_pos, f"{icon} {name}:", ha='left', va='top',
               fontsize=12, fontweight='bold')
        ax.text(0.9, y_pos, f"{value:.2f}", ha='right', va='top',
               fontsize=12, fontweight='bold', color=color)

        # Barre
        bar_y = y_pos - 0.08
        rect_bg = mpatches.Rectangle((0.1, bar_y), 0.8, 0.04,
                                     facecolor='lightgray', edgecolor='black')
        ax.add_patch(rect_bg)

        rect_val = mpatches.Rectangle((0.1, bar_y), 0.8 * value, 0.04,
                                      facecolor=color, edgecolor='black', linewidth=2)
        ax.add_patch(rect_val)

        y_pos -= 0.25

    # Ratios importants
    ax.text(0.5, 0.15, "Key Ratios:", ha='center', va='top',
           fontsize=11, fontweight='bold', style='italic')

    ax.text(0.1, 0.08, f"V/O: {ratios.get('violet_orange_ratio', 0):.2f}",
           ha='left', va='top', fontsize=9)
    ax.text(0.9, 0.08, f"Lipid: {ratios.get('lipid_index', 0):.2f}",
           ha='right', va='top', fontsize=9)

    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.set_title("Key Indicators", fontsize=11, fontweight='bold')


# ============================================================================
# VISUALISATION SIMPLE (COMPACT)
# ============================================================================

def visualize_spectral_simple(analysis_data: Dict[str, Any],
                              raw_data: Dict[str, Any]) -> plt.Figure:
    """
    Visualisation compacte pour intégration rapide
    """
    fig, axes = plt.subplots(1, 3, figsize=(15, 4))

    # 1. Spectre
    _plot_normalized_spectrum(axes[0], raw_data)

    # 2. Métriques
    _plot_quality_metrics(axes[1], analysis_data)

    # 3. Grade
    _plot_grade_score(axes[2], analysis_data)

    plt.tight_layout()

    return fig


# ============================================================================
# DEMO / TEST
# ============================================================================

if __name__ == "__main__":
    from as7341_raw_simulator import AS7341_RawSimulator
    from as7341_data_analyzer import AS7341_DataAnalyzer

    print("=" * 70)
    print("AS7341 VISUALIZATIONS - Demo")
    print("=" * 70)

    # Simuler données
    sim = AS7341_RawSimulator(random_seed=42)

    # Test 1: Produit frais
    print("\n1. Foie gras frais")
    raw_data1 = sim.simulate_measurement(
        product_type="normal",
        freshness=0.95,
        fat_quality=0.9,
        oxidation_level=0.05
    )

    analyzer = AS7341_DataAnalyzer()
    analysis1 = analyzer.process(raw_data1)

    fig1 = visualize_spectral_analysis(analysis1, raw_data1,
                                       "AS7341 - Foie Gras Frais (A+)")

    # Test 2: Produit oxydé
    print("\n2. Foie gras oxydé")
    raw_data2 = sim.simulate_measurement(
        product_type="defective",
        freshness=0.5,
        fat_quality=0.4,
        oxidation_level=0.8
    )

    analysis2 = analyzer.process(raw_data2)

    fig2 = visualize_spectral_analysis(analysis2, raw_data2,
                                       "AS7341 - Foie Gras Oxydé (B)")

    print("\n" + "=" * 70)
    print("Visualisations créées! Fermez les fenêtres pour terminer.")
    print("=" * 70)

    plt.show()
