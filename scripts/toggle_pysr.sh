#!/bin/bash

# ============================================
# Script de Basculement PySR (Régression Symbolique)
# ============================================
# Usage:
#   ./scripts/toggle_pysr.sh enable   # Activer PySR
#   ./scripts/toggle_pysr.sh disable  # Désactiver PySR
#   ./scripts/toggle_pysr.sh status   # Vérifier l'état
# ============================================

set -e

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fichiers à modifier
MAIN_PY="backend-api/app/main.py"
DOSE_SERVICE_PY="backend-api/app/services/dose_correction_service.py"

# Fonction pour afficher un message coloré
print_color() {
    local color=$1
    shift
    echo -e "${color}$@${NC}"
}

# Fonction pour vérifier l'état actuel de PySR
check_pysr_status() {
    if grep -q "^from app.ml.symbolic_regression import get_symbolic_engine" "$MAIN_PY" 2>/dev/null; then
        echo "enabled"
    else
        echo "disabled"
    fi
}

# Fonction pour activer PySR
enable_pysr() {
    print_color "$BLUE" "🔧 Activation de PySR (Régression Symbolique)..."
    echo ""

    # Étape 1: Décommenter l'import dans main.py
    print_color "$YELLOW" "📝 Étape 1/5: Modification de app/main.py..."
    if [ -f "$MAIN_PY" ]; then
        sed -i 's|^# TEMPORAIRE: PySR désactivé pour démarrage rapide (Julia installation longue)$||' "$MAIN_PY"
        sed -i 's|^# from app.ml.symbolic_regression import get_symbolic_engine$|from app.ml.symbolic_regression import get_symbolic_engine|' "$MAIN_PY"

        # Décommenter les endpoints PySR
        sed -i 's|^# @app.post("/api/ml/discover-formula/{genetique}")|@app.post("/api/ml/discover-formula/{genetique}")|' "$MAIN_PY"
        sed -i 's|^# async def discover_formula|async def discover_formula|' "$MAIN_PY"
        sed -i 's|^# @app.get("/api/ml/predict-doses/{canard_id}")|@app.get("/api/ml/predict-doses/{canard_id}")|' "$MAIN_PY"
        sed -i 's|^# async def predict_optimal_doses|async def predict_optimal_doses|' "$MAIN_PY"

        print_color "$GREEN" "  ✅ app/main.py modifié"
    else
        print_color "$RED" "  ❌ Fichier $MAIN_PY non trouvé"
        exit 1
    fi

    # Étape 2: Décommenter l'import dans dose_correction_service.py
    print_color "$YELLOW" "📝 Étape 2/5: Modification de app/services/dose_correction_service.py..."
    if [ -f "$DOSE_SERVICE_PY" ]; then
        sed -i 's|^# TEMPORAIRE: PySR désactivé pour démarrage rapide$||' "$DOSE_SERVICE_PY"
        sed -i 's|^# from app.ml.symbolic_regression import get_symbolic_engine$|from app.ml.symbolic_regression import get_symbolic_engine|' "$DOSE_SERVICE_PY"
        print_color "$GREEN" "  ✅ dose_correction_service.py modifié"
    else
        print_color "$RED" "  ❌ Fichier $DOSE_SERVICE_PY non trouvé"
        exit 1
    fi

    # Étape 3: Installer les packages Julia
    print_color "$YELLOW" "📦 Étape 3/5: Installation des packages Julia..."
    if command -v docker-compose &> /dev/null; then
        if docker-compose ps backend | grep -q "Up"; then
            print_color "$BLUE" "  ⏳ Installation de SymbolicRegression.jl..."
            docker-compose exec -T backend julia -e 'using Pkg; Pkg.add("SymbolicRegression")' || {
                print_color "$YELLOW" "  ⚠️  Installation Julia échouée (peut-être déjà installé)"
            }
            print_color "$GREEN" "  ✅ Packages Julia configurés"
        else
            print_color "$YELLOW" "  ⚠️  Backend non démarré, packages Julia non installés"
            print_color "$YELLOW" "  ℹ️  Démarrez le backend puis exécutez:"
            print_color "$YELLOW" "     docker-compose exec backend julia -e 'using Pkg; Pkg.add(\"SymbolicRegression\")'"
        fi
    else
        print_color "$YELLOW" "  ⚠️  docker-compose non disponible"
    fi

    # Étape 4: Rebuild le backend
    print_color "$YELLOW" "🔨 Étape 4/5: Rebuild du backend..."
    if command -v docker-compose &> /dev/null; then
        docker-compose build backend
        print_color "$GREEN" "  ✅ Backend rebuild"
    else
        print_color "$YELLOW" "  ⚠️  Rebuild manuel requis"
    fi

    # Étape 5: Redémarrer le backend
    print_color "$YELLOW" "🔄 Étape 5/5: Redémarrage du backend..."
    if command -v docker-compose &> /dev/null; then
        docker-compose restart backend
        print_color "$GREEN" "  ✅ Backend redémarré"

        # Attendre que le backend soit prêt
        print_color "$BLUE" "  ⏳ Attente du démarrage (30s)..."
        sleep 30

        # Test du endpoint
        print_color "$YELLOW" "  🧪 Test du backend..."
        if curl -s http://localhost:8000/health > /dev/null 2>&1; then
            print_color "$GREEN" "  ✅ Backend opérationnel"
        else
            print_color "$RED" "  ❌ Backend non accessible"
        fi
    else
        print_color "$YELLOW" "  ⚠️  Redémarrage manuel requis"
    fi

    echo ""
    print_color "$GREEN" "✅ PySR ACTIVÉ avec succès!"
    echo ""
    print_color "$BLUE" "📊 Endpoints PySR disponibles:"
    print_color "$BLUE" "  - POST /api/ml/discover-formula/{genetique}"
    print_color "$BLUE" "  - GET  /api/ml/predict-doses/{canard_id}"
    echo ""
}

# Fonction pour désactiver PySR
disable_pysr() {
    print_color "$BLUE" "🔧 Désactivation de PySR (mode rapide)..."
    echo ""

    # Étape 1: Commenter l'import dans main.py
    print_color "$YELLOW" "📝 Étape 1/3: Modification de app/main.py..."
    if [ -f "$MAIN_PY" ]; then
        sed -i 's|^from app.ml.symbolic_regression import get_symbolic_engine$|# TEMPORAIRE: PySR désactivé pour démarrage rapide (Julia installation longue)\n# from app.ml.symbolic_regression import get_symbolic_engine|' "$MAIN_PY"

        # Commenter les endpoints PySR
        sed -i 's|^@app.post("/api/ml/discover-formula/{genetique}")|# @app.post("/api/ml/discover-formula/{genetique}")|' "$MAIN_PY"
        sed -i 's|^async def discover_formula|# async def discover_formula|' "$MAIN_PY"
        sed -i 's|^@app.get("/api/ml/predict-doses/{canard_id}")|# @app.get("/api/ml/predict-doses/{canard_id}")|' "$MAIN_PY"
        sed -i 's|^async def predict_optimal_doses|# async def predict_optimal_doses|' "$MAIN_PY"

        print_color "$GREEN" "  ✅ app/main.py modifié"
    else
        print_color "$RED" "  ❌ Fichier $MAIN_PY non trouvé"
        exit 1
    fi

    # Étape 2: Commenter l'import dans dose_correction_service.py
    print_color "$YELLOW" "📝 Étape 2/3: Modification de app/services/dose_correction_service.py..."
    if [ -f "$DOSE_SERVICE_PY" ]; then
        sed -i 's|^from app.ml.symbolic_regression import get_symbolic_engine$|# TEMPORAIRE: PySR désactivé pour démarrage rapide\n# from app.ml.symbolic_regression import get_symbolic_engine|' "$DOSE_SERVICE_PY"
        print_color "$GREEN" "  ✅ dose_correction_service.py modifié"
    else
        print_color "$RED" "  ❌ Fichier $DOSE_SERVICE_PY non trouvé"
        exit 1
    fi

    # Étape 3: Redémarrer le backend
    print_color "$YELLOW" "🔄 Étape 3/3: Redémarrage du backend..."
    if command -v docker-compose &> /dev/null; then
        docker-compose restart backend
        print_color "$GREEN" "  ✅ Backend redémarré"

        # Attendre que le backend soit prêt
        print_color "$BLUE" "  ⏳ Attente du démarrage (15s)..."
        sleep 15

        # Test du endpoint
        print_color "$YELLOW" "  🧪 Test du backend..."
        if curl -s http://localhost:8000/health > /dev/null 2>&1; then
            print_color "$GREEN" "  ✅ Backend opérationnel (mode rapide)"
        else
            print_color "$RED" "  ❌ Backend non accessible"
        fi
    else
        print_color "$YELLOW" "  ⚠️  Redémarrage manuel requis"
    fi

    echo ""
    print_color "$GREEN" "✅ PySR DÉSACTIVÉ avec succès!"
    echo ""
    print_color "$YELLOW" "ℹ️  Mode: Doses standards (empiriques)"
    print_color "$YELLOW" "ℹ️  Démarrage backend: ~15s au lieu de ~2min"
    echo ""
}

# Fonction pour afficher le statut
show_status() {
    local status=$(check_pysr_status)

    echo ""
    print_color "$BLUE" "📊 État de PySR (Régression Symbolique)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    if [ "$status" = "enabled" ]; then
        print_color "$GREEN" "✅ PySR: ACTIVÉ"
        echo ""
        echo "Fonctionnalités disponibles:"
        echo "  - Découverte de formules symboliques optimales"
        echo "  - Calcul de doses théoriques par IA"
        echo "  - Endpoints ML actifs"
        echo ""
        echo "Endpoints:"
        echo "  POST /api/ml/discover-formula/{genetique}"
        echo "  GET  /api/ml/predict-doses/{canard_id}"
    else
        print_color "$RED" "❌ PySR: DÉSACTIVÉ"
        echo ""
        echo "Mode actuel:"
        echo "  - Doses standards (empiriques)"
        echo "  - Démarrage rapide (~15s)"
        echo "  - Pas de dépendance Julia"
        echo ""
        echo "Pour activer PySR:"
        echo "  ./scripts/toggle_pysr.sh enable"
    fi

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    # Vérifier si Julia est installé
    if command -v docker-compose &> /dev/null; then
        if docker-compose ps backend | grep -q "Up"; then
            print_color "$BLUE" "🔍 Vérification Julia dans le container..."
            if docker-compose exec -T backend julia --version > /dev/null 2>&1; then
                JULIA_VERSION=$(docker-compose exec -T backend julia --version | head -1)
                print_color "$GREEN" "  ✅ Julia installé: $JULIA_VERSION"
            else
                print_color "$RED" "  ❌ Julia non installé"
            fi
        else
            print_color "$YELLOW" "  ⚠️  Backend non démarré"
        fi
    fi

    echo ""
}

# Menu principal
case "${1:-}" in
    enable)
        enable_pysr
        ;;
    disable)
        disable_pysr
        ;;
    status)
        show_status
        ;;
    *)
        print_color "$RED" "❌ Usage invalide"
        echo ""
        echo "Usage:"
        echo "  $0 enable    # Activer PySR (régression symbolique)"
        echo "  $0 disable   # Désactiver PySR (mode rapide)"
        echo "  $0 status    # Vérifier l'état actuel"
        echo ""
        echo "Exemples:"
        echo "  ./scripts/toggle_pysr.sh enable   # Activer avec Julia"
        echo "  ./scripts/toggle_pysr.sh disable  # Mode rapide sans Julia"
        echo "  ./scripts/toggle_pysr.sh status   # Voir l'état"
        exit 1
        ;;
esac
