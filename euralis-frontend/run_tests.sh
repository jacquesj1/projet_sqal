#!/bin/bash
# Script d'exécution des tests Euralis Frontend
# Usage: ./run_tests.sh [commande]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Couleurs pour output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BLUE}=====================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}=====================================${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Fonction principale
run_tests() {
    local command=${1:-"all"}

    case $command in
        "install")
            print_header "Installation des dépendances de tests"
            npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event jest jest-environment-jsdom
            print_success "Dépendances installées"
            ;;

        "all")
            print_header "Exécution de tous les tests Euralis"
            npm test -- --passWithNoTests
            print_success "Tous les tests passés"
            ;;

        "watch")
            print_header "Mode watch - Tests Euralis"
            npm test -- --watch
            ;;

        "coverage")
            print_header "Génération du rapport de coverage"
            npm test -- --coverage --passWithNoTests
            print_success "Rapport de coverage généré dans coverage/"
            echo ""
            print_warning "Ouvrez coverage/index.html dans votre navigateur pour voir le rapport"
            ;;

        "components")
            print_header "Tests des composants uniquement"
            npm test -- src/__tests__/components --passWithNoTests
            print_success "Tests composants terminés"
            ;;

        "api")
            print_header "Tests de l'API client uniquement"
            npm test -- src/__tests__/lib --passWithNoTests
            print_success "Tests API terminés"
            ;;

        "verbose")
            print_header "Tests en mode verbose"
            npm test -- --verbose --passWithNoTests
            ;;

        "help")
            echo "Usage: ./run_tests.sh [commande]"
            echo ""
            echo "Commandes disponibles:"
            echo "  install     - Installe les dépendances de test"
            echo "  all         - Exécute tous les tests (défaut)"
            echo "  watch       - Mode watch (re-exécute à chaque modification)"
            echo "  coverage    - Génère un rapport de coverage HTML"
            echo "  components  - Teste uniquement les composants"
            echo "  api         - Teste uniquement l'API client"
            echo "  verbose     - Exécute les tests en mode verbose"
            echo "  help        - Affiche cette aide"
            ;;

        *)
            print_error "Commande inconnue: $command"
            echo "Utilisez './run_tests.sh help' pour voir les commandes disponibles"
            exit 1
            ;;
    esac
}

# Point d'entrée
if [ $# -eq 0 ]; then
    run_tests "all"
else
    run_tests "$1"
fi
