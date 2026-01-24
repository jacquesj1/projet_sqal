#!/usr/bin/env python3
"""
Analyse et catégorise les fichiers Markdown à la racine
"""
import os
from pathlib import Path
from datetime import datetime
import re

# Catégories de fichiers
categories = {
    'GARDER_RACINE': [],      # Fichiers essentiels à garder à la racine
    'DEPLACER_DOC': [],        # À déplacer dans documentation/
    'OBSOLETE_SUPPRIMER': [],  # Fichiers obsolètes à supprimer
    'SESSION_ARCHIVE': [],     # Sessions de travail à archiver
    'SPRINT_ORGANISER': [],    # Documents Sprint à organiser
}

# Patterns pour identifier les catégories
PATTERNS = {
    'SESSION': re.compile(r'SESSION.*\.md', re.I),
    'SPRINT': re.compile(r'SPRINT\d+.*\.md', re.I),
    'FIX': re.compile(r'FIX_.*\.md', re.I),
    'DEBUG': re.compile(r'DEBUG_.*\.md', re.I),
    'CORRECTION': re.compile(r'CORRECTION.*\.md', re.I),
    'AMELIORATION': re.compile(r'AMELIORATION.*\.md', re.I),
    'RESUME': re.compile(r'RESUME.*\.md', re.I),
    'VALIDATION': re.compile(r'VALIDATION.*\.md', re.I),
    'CLEANUP': re.compile(r'CLEANUP.*\.md', re.I),
}

# Fichiers essentiels à GARDER à la racine
ESSENTIELS_RACINE = {
    'README.md',
    'CLAUDE.md',
    'CHANGELOG.md',
    'DEMARRAGE_RAPIDE.md',
}

# Fichiers à SUPPRIMER (obsolètes/redondants)
OBSOLETES = {
    # Doublons avec documentation/
    'ARCHITECTURE_MISE_A_JOUR.md',  # → documentation/ARCHITECTURE_UNIFIEE.md
    'BOUCLE_FERMEE_COMPLETE.md',    # → documentation/SYSTEME_COMPLET_BOUCLE_FERMEE.md
    'SECURITE_JWT_KEYCLOAK_COMPLETE.md',  # → documentation/KEYCLOAK_SETUP.md

    # Anciennes versions Control Panel
    'CONTROL_PANEL_V2_PROGRESS.md',
    'CONTROL_PANEL_V2_SPEC.md',
    'CHANGELOG_CONTROL_PANEL.md',
    'DEMARRAGE_CONTROL_PANEL.md',

    # Doublons Sprint
    'SPRINT3_COMPLETE.md',  # → documentation/SPRINT3_PYSR_3COURBES_COMPLET.md
    'SPRINT4_COMPLETE.md',  # → documentation/Courbes-Gavage-IA/SPRINT4_SUCCESS.md

    # Cleanup temporaires
    'CLEANUP_AUTH_ROUTES.md',  # Déjà intégré
    'CLEANUP_OBSOLETE_DIRS.md',
    'UPDATE_WINDOWS_SCRIPTS.md',

    # Sessions anciennes (> 1 mois)
    'SESSION_2024-12-25_CONTINUATION.md',
    'SESSION_2024-12-25_EURALIS_TESTS.md',
    'SESSION_2024-12-25_FINALE.md',
    'SESSION_2024-12-25_RECAP.md',
    'SESSION_COMPLETE_2024-12-24.md',
    'SESSION_28_DEC_2025_RESUME.md',

    # Résumés temporaires
    'SUMMARY.md',  # Trop générique
    'STATUS.md',   # Remplacé par CHANGELOG.md

    # Validations/tests temporaires
    'TESTS_VALIDATION.md',
    'VALIDATION_TESTS_SQAL_SUCCESS.md',

    # Corrections ponctuelles déjà appliquées
    'CORRECTION_ITM_MORTALITE.md',
    'CORRECTION_PRODUCTION_TOTALE.md',
    'CORRECTIONS_DASHBOARD.md',
    'CORRECTIONS_FINALES_GAVAGE.md',
    'DEBUG_DETECTION_JOUR_GAVAGE.md',
    'SMS_SERVICE_FIX.md',

    # Résumés génériques
    'TRAVAUX_REALISES.md',
    'SYNTHESE_INTEGRATION.md',
    'RESUME_FINAL_ITM.md',
    'RESUME_MODIFICATIONS_GAVAGE_PAGE.md',
}

def analyze_files():
    """Analyse tous les fichiers MD à la racine"""
    md_files = list(Path('.').glob('*.md'))

    print(f"📊 Analyse de {len(md_files)} fichiers Markdown à la racine...\n")

    for md_file in md_files:
        filename = md_file.name

        # Catégorie 1: Essentiels à la racine
        if filename in ESSENTIELS_RACINE:
            categories['GARDER_RACINE'].append(filename)
            continue

        # Catégorie 2: Obsolètes à supprimer
        if filename in OBSOLETES:
            categories['OBSOLETE_SUPPRIMER'].append(filename)
            continue

        # Catégorie 3: Sessions de travail
        if PATTERNS['SESSION'].match(filename):
            categories['SESSION_ARCHIVE'].append(filename)
            continue

        # Catégorie 4: Sprints
        if PATTERNS['SPRINT'].match(filename):
            categories['SPRINT_ORGANISER'].append(filename)
            continue

        # Catégorie 5: Reste → déplacer dans documentation/
        categories['DEPLACER_DOC'].append(filename)

    return categories

def print_report(categories):
    """Affiche le rapport d'analyse"""
    print("=" * 80)
    print("📋 RAPPORT D'ANALYSE - FICHIERS MARKDOWN RACINE")
    print("=" * 80)
    print()

    total = sum(len(files) for files in categories.values())

    print(f"✅ GARDER À LA RACINE ({len(categories['GARDER_RACINE'])} fichiers)")
    print("   Fichiers essentiels pour navigation projet")
    for f in sorted(categories['GARDER_RACINE']):
        print(f"   • {f}")
    print()

    print(f"🗑️  À SUPPRIMER - OBSOLÈTES ({len(categories['OBSOLETE_SUPPRIMER'])} fichiers)")
    print("   Fichiers redondants/dépassés/temporaires")
    for f in sorted(categories['OBSOLETE_SUPPRIMER']):
        print(f"   • {f}")
    print()

    print(f"📦 SESSIONS À ARCHIVER ({len(categories['SESSION_ARCHIVE'])} fichiers)")
    print("   → Déplacer vers documentation/archive/sessions/")
    for f in sorted(categories['SESSION_ARCHIVE']):
        print(f"   • {f}")
    print()

    print(f"🎯 SPRINTS À ORGANISER ({len(categories['SPRINT_ORGANISER'])} fichiers)")
    print("   → Déplacer vers documentation/Sprints/")
    for f in sorted(categories['SPRINT_ORGANISER']):
        print(f"   • {f}")
    print()

    print(f"📚 À DÉPLACER DANS DOCUMENTATION ({len(categories['DEPLACER_DOC'])} fichiers)")
    print("   → Analyser et placer dans répertoires appropriés")
    for f in sorted(categories['DEPLACER_DOC']):
        print(f"   • {f}")
    print()

    print("=" * 80)
    print(f"TOTAL: {total} fichiers analysés")
    print(f"  • Garder racine: {len(categories['GARDER_RACINE'])}")
    print(f"  • Supprimer: {len(categories['OBSOLETE_SUPPRIMER'])}")
    print(f"  • Archiver: {len(categories['SESSION_ARCHIVE'])}")
    print(f"  • Organiser: {len(categories['SPRINT_ORGANISER']) + len(categories['DEPLACER_DOC'])}")
    print("=" * 80)

if __name__ == '__main__':
    cats = analyze_files()
    print_report(cats)

    # Sauvegarder le rapport
    with open('CLEANUP_REPORT.txt', 'w', encoding='utf-8') as f:
        f.write("RAPPORT DE NETTOYAGE - FICHIERS MARKDOWN\n")
        f.write(f"Généré le: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write("=" * 80 + "\n\n")

        for category, files in cats.items():
            f.write(f"\n{category} ({len(files)} fichiers):\n")
            for filename in sorted(files):
                f.write(f"  - {filename}\n")

    print("\n✅ Rapport sauvegardé dans CLEANUP_REPORT.txt")
