#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
FUSION VISUALIZATIONS
Dashboard de fusion VL53L8CH + AS7341 pour inspection complète
"""

import matplotlib.pyplot as plt
from matplotlib.gridspec import GridSpec
import matplotlib.patches as mpatches
import numpy as np
from typing import Dict, Any


def visualize_fusion_dashboard(fusion_result: Dict[str, Any],
                               title: str = "Multi-Sensor Fusion Dashboard") -> plt.Figure:
    """
    Crée un dashboard complet montrant la fusion VL53L8CH + AS7341

    Args:
        fusion_result: Résultat complet de FoieGrasFusionSimulator
        title: Titre du dashboard

    Returns:
        Figure matplotlib
    """
    fig = plt.figure(figsize=(20, 12))
    gs = GridSpec(4, 4, figure=fig, hspace=0.35, wspace=0.3)

    # ========================================================================
    # LIGNE 1: VUE D'ENSEMBLE
    # ========================================================================

    # 1.1 Grade final fusionné (grande zone centrale)
    ax_grade = fig.add_subplot(gs[0, 1:3])
    _plot_fusion_grade(ax_grade, fusion_result)

    # 1.2 Scores individuels (gauche)
    ax_scores = fig.add_subplot(gs[0, 0])
    _plot_sensor_scores(ax_scores, fusion_result)

    # 1.3 Contribution des capteurs (droite)
    ax_contrib = fig.add_subplot(gs[0, 3])
    _plot_sensor_contribution(ax_contrib, fusion_result)

    # ========================================================================
    # LIGNE 2: VL53L8CH (ToF)
    # ========================================================================

    vl53l8ch_analysis = fusion_result['vl53l8ch_analysis']
    vl53l8ch_raw = fusion_result['vl53l8ch_raw']

    # 2.1 Heatmap distance
    ax_tof_heat = fig.add_subplot(gs[1, 0])
    _plot_tof_heatmap(ax_tof_heat, vl53l8ch_raw)

    # 2.2 Statistiques ToF
    ax_tof_stats = fig.add_subplot(gs[1, 1])
    _plot_tof_stats(ax_tof_stats, vl53l8ch_analysis)

    # 2.3 Défauts ToF
    ax_tof_defects = fig.add_subplot(gs[1, 2])
    _plot_tof_defects(ax_tof_defects, vl53l8ch_analysis)

    # 2.4 Grade ToF
    ax_tof_grade = fig.add_subplot(gs[1, 3])
    _plot_tof_grade(ax_tof_grade, vl53l8ch_analysis)

    # ========================================================================
    # LIGNE 3: AS7341 (Spectral) - si disponible
    # ========================================================================

    if fusion_result.get('as7341_analysis'):
        as7341_analysis = fusion_result['as7341_analysis']
        as7341_raw = fusion_result['as7341_raw']

        # 3.1 Spectre normalisé
        ax_spec_norm = fig.add_subplot(gs[2, 0])
        _plot_spectral_normalized(ax_spec_norm, as7341_raw)

        # 3.2 Métriques qualité
        ax_spec_metrics = fig.add_subplot(gs[2, 1])
        _plot_spectral_metrics(ax_spec_metrics, as7341_analysis)

        # 3.3 Défauts spectraux
        ax_spec_defects = fig.add_subplot(gs[2, 2])
        _plot_spectral_defects(ax_spec_defects, as7341_analysis)

        # 3.4 Grade spectral
        ax_spec_grade = fig.add_subplot(gs[2, 3])
        _plot_spectral_grade(ax_spec_grade, as7341_analysis)
    else:
        # Pas de données spectrales
        ax_no_spec = fig.add_subplot(gs[2, :])
        ax_no_spec.text(0.5, 0.5, "AS7341 Spectral Sensor: Disabled",
                       ha='center', va='center', fontsize=16, color='gray')
        ax_no_spec.axis('off')

    # ========================================================================
    # LIGNE 4: FUSION ET DÉFAUTS COMBINÉS
    # ========================================================================

    fusion_data = fusion_result['fusion_result']

    # 4.1 Timeline de qualité
    ax_timeline = fig.add_subplot(gs[3, 0:2])
    _plot_quality_timeline(ax_timeline, fusion_result)

    # 4.2 Défauts combinés
    ax_combined_defects = fig.add_subplot(gs[3, 2:4])
    _plot_combined_defects(ax_combined_defects, fusion_data)

    # Titre principal
    fig.suptitle(title, fontsize=18, fontweight='bold', y=0.98)

    return fig


# ============================================================================
# FONCTIONS D'AFFICHAGE
# ============================================================================

def _plot_fusion_grade(ax, fusion_result: Dict[str, Any]):
    """Grade final fusionné (grande zone)"""
    fusion_data = fusion_result['fusion_result']
    grade = fusion_data['final_grade']
    score = fusion_data['final_score']

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
    ax.text(0.5, 0.65, grade, ha='center', va='center',
           fontsize=100, fontweight='bold', color=grade_color,
           bbox=dict(boxstyle='round,pad=0.4', facecolor='white',
                    edgecolor=grade_color, linewidth=4))

    # Score
    ax.text(0.5, 0.25, f"Final Score: {score:.3f}", ha='center', va='center',
           fontsize=20, fontweight='bold')

    # Mode fusion
    mode = fusion_data.get('fusion_mode', 'Unknown')
    ax.text(0.5, 0.08, f"Mode: {mode}", ha='center', va='center',
           fontsize=14, style='italic', color='gray')

    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.set_title("FINAL GRADE (Fusion)", fontsize=14, fontweight='bold', pad=15)


def _plot_sensor_scores(ax, fusion_result: Dict[str, Any]):
    """Scores individuels des capteurs"""
    fusion_data = fusion_result['fusion_result']

    tof_score = fusion_data.get('tof_score', 0)
    spectral_score = fusion_data.get('spectral_score', 0)

    scores = [tof_score, spectral_score]
    labels = ['ToF\n(VL53L8CH)', 'Spectral\n(AS7341)']
    colors = ['steelblue', 'orange']

    bars = ax.barh(labels, scores, color=colors, alpha=0.7, edgecolor='black', linewidth=2)

    # Ligne de référence
    ax.axvline(x=0.5, color='gray', linestyle='--', linewidth=1, alpha=0.5)
    ax.axvline(x=0.75, color='green', linestyle='--', linewidth=1, alpha=0.5)

    ax.set_xlim(0, 1)
    ax.set_xlabel("Score", fontsize=10)
    ax.set_title("Individual Scores", fontsize=11, fontweight='bold')
    ax.grid(True, alpha=0.3, axis='x')

    # Valeurs
    for bar, score in zip(bars, scores):
        width = bar.get_width()
        ax.text(width + 0.02, bar.get_y() + bar.get_height()/2.,
                f'{score:.3f}', ha='left', va='center', fontsize=10, fontweight='bold')


def _plot_sensor_contribution(ax, fusion_result: Dict[str, Any]):
    """Contribution de chaque capteur (pie chart)"""
    fusion_data = fusion_result['fusion_result']

    tof_contrib = fusion_data.get('tof_contribution', 0.6)
    spectral_contrib = fusion_data.get('spectral_contribution', 0.4)

    sizes = [tof_contrib, spectral_contrib]
    labels = ['ToF', 'Spectral']
    colors = ['steelblue', 'orange']

    wedges, texts, autotexts = ax.pie(sizes, labels=labels, colors=colors,
                                       autopct=lambda pct: f'{pct:.0f}%',
                                       startangle=90, textprops={'fontsize': 10, 'fontweight': 'bold'})

    for autotext in autotexts:
        autotext.set_color('white')

    ax.set_title("Sensor Weights", fontsize=11, fontweight='bold')


def _plot_tof_heatmap(ax, vl53l8ch_raw: Dict[str, Any]):
    """Heatmap des distances ToF"""
    distances = vl53l8ch_raw['distance_matrix']

    im = ax.imshow(distances, cmap='viridis', aspect='equal')
    ax.set_title("ToF Distance Map", fontsize=10, fontweight='bold')
    ax.set_xlabel("X", fontsize=9)
    ax.set_ylabel("Y", fontsize=9)

    # Colorbar
    cbar = plt.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
    cbar.set_label('Distance (mm)', fontsize=8)


def _plot_tof_stats(ax, vl53l8ch_analysis: Dict[str, Any]):
    """Statistiques ToF"""
    stats = vl53l8ch_analysis['stats']

    ax.axis('off')

    info = [
        ("Volume", f"{stats['volume_trapezoidal_mm3']:.0f} mm³"),
        ("Hauteur moy", f"{stats['avg_height_mm']:.1f} mm"),
        ("Variation", f"{stats['height_variation_mm']:.1f} mm"),
        ("Uniformité", f"{stats['surface_uniformity']:.2f}"),
    ]

    y_pos = 0.9
    for label, value in info:
        ax.text(0.1, y_pos, f"{label}:", ha='left', va='top', fontsize=10, fontweight='bold')
        ax.text(0.9, y_pos, value, ha='right', va='top', fontsize=10)
        y_pos -= 0.2

    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.set_title("ToF Statistics", fontsize=10, fontweight='bold')


def _plot_tof_defects(ax, vl53l8ch_analysis: Dict[str, Any]):
    """Défauts ToF"""
    defects = vl53l8ch_analysis['defects']

    ax.axis('off')

    if not defects:
        ax.text(0.5, 0.5, "✓ No ToF defects", ha='center', va='center',
               fontsize=12, color='green', fontweight='bold')
    else:
        ax.text(0.5, 0.95, f"⚠ {len(defects)} Defect(s)",
               ha='center', va='top', fontsize=11, fontweight='bold', color='red')

        y_pos = 0.75
        for i, defect in enumerate(defects[:4], 1):
            defect_type = defect.get('type', 'unknown')
            ax.text(0.05, y_pos, f"{i}. {defect_type}",
                   ha='left', va='top', fontsize=9)
            y_pos -= 0.15

        if len(defects) > 4:
            ax.text(0.05, y_pos, f"... +{len(defects)-4} more",
                   ha='left', va='top', fontsize=8, style='italic')

    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.set_title("ToF Defects", fontsize=10, fontweight='bold')


def _plot_tof_grade(ax, vl53l8ch_analysis: Dict[str, Any]):
    """Grade ToF"""
    grade = str(vl53l8ch_analysis['grade'])[:20]
    score = vl53l8ch_analysis['quality_score']

    ax.axis('off')

    # Simplifier le grade si besoin
    if "REJET" in grade or "REJECT" in grade:
        display_grade = "REJECT"
        color = "red"
    elif grade in ["A+", "A", "B", "C"]:
        display_grade = grade
        color = {"A+": "darkgreen", "A": "green", "B": "orange", "C": "darkorange"}.get(grade, "gray")
    else:
        display_grade = grade[:10]
        color = "gray"

    ax.text(0.5, 0.6, display_grade, ha='center', va='center',
           fontsize=40, fontweight='bold', color=color)

    ax.text(0.5, 0.3, f"Score: {score:.3f}", ha='center', va='center',
           fontsize=12, fontweight='bold')

    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.set_title("ToF Grade", fontsize=10, fontweight='bold')


def _plot_spectral_normalized(ax, as7341_raw: Dict[str, Any]):
    """Spectre normalisé AS7341"""
    from as7341_visualizations import SPECTRAL_CHANNELS

    counts = as7341_raw["raw_counts"]
    spectral_counts = {k: v for k, v in counts.items() if k in SPECTRAL_CHANNELS}

    if not spectral_counts:
        ax.text(0.5, 0.5, "No spectral data", ha='center', va='center')
        return

    max_count = max(spectral_counts.values()) or 1

    wavelengths = []
    normalized = []
    colors = []

    for ch_name, count in spectral_counts.items():
        ch_info = SPECTRAL_CHANNELS[ch_name]
        wavelengths.append(ch_info["wavelength"])
        normalized.append(count / max_count)
        colors.append(ch_info["color"])

    ax.plot(wavelengths, normalized, 'k-', linewidth=2, alpha=0.3)
    ax.scatter(wavelengths, normalized, c=colors, s=80, edgecolor='black', linewidth=1.5, zorder=5)

    ax.set_xlabel("Wavelength (nm)", fontsize=9)
    ax.set_ylabel("Norm. Intensity", fontsize=9)
    ax.set_title("Spectral Profile", fontsize=10, fontweight='bold')
    ax.set_ylim(0, 1.1)
    ax.grid(True, alpha=0.3)


def _plot_spectral_metrics(ax, as7341_analysis: Dict[str, Any]):
    """Métriques spectrales"""
    metrics = as7341_analysis["quality_metrics"]

    ax.axis('off')

    info = [
        ("Freshness", metrics.freshness_index),
        ("Fat Quality", metrics.fat_quality_index),
        ("Uniformity", metrics.color_uniformity),
        ("Oxidation", metrics.oxidation_index),
    ]

    y_pos = 0.9
    for label, value in info:
        # Couleur
        if label == "Oxidation":
            color = 'green' if value < 0.3 else 'orange' if value < 0.6 else 'red'
        else:
            color = 'green' if value > 0.7 else 'orange' if value > 0.4 else 'red'

        ax.text(0.1, y_pos, f"{label}:", ha='left', va='top', fontsize=9, fontweight='bold')
        ax.text(0.9, y_pos, f"{value:.2f}", ha='right', va='top', fontsize=9,
               fontweight='bold', color=color)
        y_pos -= 0.2

    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.set_title("Spectral Metrics", fontsize=10, fontweight='bold')


def _plot_spectral_defects(ax, as7341_analysis: Dict[str, Any]):
    """Défauts spectraux"""
    defects = as7341_analysis['defects']

    ax.axis('off')

    if not defects:
        ax.text(0.5, 0.5, "✓ No spectral defects", ha='center', va='center',
               fontsize=12, color='green', fontweight='bold')
    else:
        ax.text(0.5, 0.95, f"⚠ {len(defects)} Defect(s)",
               ha='center', va='top', fontsize=11, fontweight='bold', color='orange')

        y_pos = 0.75
        for i, defect in enumerate(defects[:4], 1):
            ax.text(0.05, y_pos, f"{i}. {defect}",
                   ha='left', va='top', fontsize=9)
            y_pos -= 0.15

        if len(defects) > 4:
            ax.text(0.05, y_pos, f"... +{len(defects)-4} more",
                   ha='left', va='top', fontsize=8, style='italic')

    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.set_title("Spectral Defects", fontsize=10, fontweight='bold')


def _plot_spectral_grade(ax, as7341_analysis: Dict[str, Any]):
    """Grade spectral"""
    grade = as7341_analysis['grade']
    score = as7341_analysis['quality_score']

    ax.axis('off')

    grade_colors = {
        "A+": "darkgreen",
        "A": "green",
        "B": "orange",
        "C": "darkorange",
        "REJECT": "red"
    }
    color = grade_colors.get(grade, "gray")

    ax.text(0.5, 0.6, grade, ha='center', va='center',
           fontsize=40, fontweight='bold', color=color)

    ax.text(0.5, 0.3, f"Score: {score:.3f}", ha='center', va='center',
           fontsize=12, fontweight='bold')

    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.set_title("Spectral Grade", fontsize=10, fontweight='bold')


def _plot_quality_timeline(ax, fusion_result: Dict[str, Any]):
    """Timeline comparant les scores"""
    fusion_data = fusion_result['fusion_result']

    tof_score = fusion_data.get('tof_score', 0)
    spectral_score = fusion_data.get('spectral_score', 0)
    final_score = fusion_data.get('final_score', 0)

    stages = ['ToF\nOnly', 'Spectral\nOnly', 'Fusion\n(Final)']
    scores = [tof_score, spectral_score, final_score]
    colors = ['steelblue', 'orange', 'green']

    bars = ax.bar(stages, scores, color=colors, alpha=0.7, edgecolor='black', linewidth=2)

    # Ligne de référence grade A (0.75)
    ax.axhline(y=0.75, color='green', linestyle='--', linewidth=2, alpha=0.5, label='Grade A threshold')

    ax.set_ylabel("Quality Score", fontsize=10)
    ax.set_ylim(0, 1)
    ax.set_title("Quality Score Comparison", fontsize=11, fontweight='bold')
    ax.legend(loc='upper right', fontsize=8)
    ax.grid(True, alpha=0.3, axis='y')

    # Valeurs
    for bar, score in zip(bars, scores):
        height = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2., height + 0.02,
                f'{score:.3f}', ha='center', va='bottom', fontsize=10, fontweight='bold')


def _plot_combined_defects(ax, fusion_data: Dict[str, Any]):
    """Défauts combinés"""
    defects = fusion_data.get('combined_defects', [])

    ax.axis('off')

    if not defects:
        ax.text(0.5, 0.5, "✓ No defects detected", ha='center', va='center',
               fontsize=14, color='green', fontweight='bold')
    else:
        ax.text(0.5, 0.95, f"⚠ {len(defects)} Combined Defect(s)",
               ha='center', va='top', fontsize=12, fontweight='bold', color='red')

        y_pos = 0.85
        for i, defect in enumerate(defects[:6], 1):
            defect_type = defect.get('type', 'unknown')
            source = defect.get('source', 'ToF')

            color = 'steelblue' if source == 'ToF' else 'orange'

            ax.text(0.05, y_pos, f"{i}. [{source}] {defect_type}",
                   ha='left', va='top', fontsize=9,
                   bbox=dict(boxstyle='round,pad=0.2', facecolor='lightyellow',
                            edgecolor=color, alpha=0.7))
            y_pos -= 0.12

        if len(defects) > 6:
            ax.text(0.05, y_pos, f"... and {len(defects)-6} more defects",
                   ha='left', va='top', fontsize=9, style='italic')

    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.set_title("Combined Defects (ToF + Spectral)", fontsize=11, fontweight='bold')


# ============================================================================
# DEMO / TEST
# ============================================================================

if __name__ == "__main__":
    from foiegras_fusion_simulator import FoieGrasFusionSimulator

    print("=" * 70)
    print("FUSION VISUALIZATIONS - Demo")
    print("=" * 70)

    # Configuration
    vl53l8ch_params = {
        'resolution': 8,
        'height_sensor_mm': 100,
        'product_length_mm': 200,
        'product_width_mm': 100,
        'random_seed': 42
    }

    as7341_params = {
        'enabled': True,
        'integration_time_ms': 100,
        'gain': 4,
        'random_seed': 42
    }

    # Simulateur
    fusion_sim = FoieGrasFusionSimulator(vl53l8ch_params, as7341_params)

    # Test
    print("\nGénération dashboard de fusion...")
    result = fusion_sim.simulate_complete_inspection(
        product_type="normal",
        freshness=0.85,
        fat_quality=0.8,
        oxidation_level=0.15
    )

    fig = visualize_fusion_dashboard(result, "Multi-Sensor Fusion Dashboard - Demo")

    print("\n" + "=" * 70)
    print("Dashboard créé! Fermez la fenêtre pour terminer.")
    print("=" * 70)

    plt.show()
