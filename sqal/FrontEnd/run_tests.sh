#!/bin/bash

# ============================================================================
# Script de test pour SQAL Frontend
# Exécute les tests Jest avec différentes options
# ============================================================================

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Functions
print_header() {
  echo -e "${BLUE}========================================${NC}"
  echo -e "${BLUE}  $1${NC}"
  echo -e "${BLUE}========================================${NC}"
  echo ""
}

print_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
  echo -e "${RED}✗ $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠ $1${NC}"
}

# Main
print_header "SQAL Frontend - Tests Jest"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  print_warning "node_modules not found. Running npm install..."
  npm install
fi

# Parse command
COMMAND=${1:-"all"}

case $COMMAND in
  "install"|"deps")
    print_header "Installation des dépendances de test"
    npm install --save-dev jest @testing-library/react @testing-library/jest-dom @testing-library/user-event jest-environment-jsdom ts-jest @types/jest
    print_success "Dépendances installées"
    ;;

  "all")
    print_header "Exécution de tous les tests"
    npm test -- --coverage
    ;;

  "unit")
    print_header "Exécution des tests unitaires"
    npm test -- --testPathPattern="__tests__" --coverage
    ;;

  "components")
    print_header "Exécution des tests de composants"
    npm test -- --testPathPattern="components.*test" --coverage
    ;;

  "services")
    print_header "Exécution des tests de services"
    npm test -- --testPathPattern="services.*test" --coverage
    ;;

  "watch")
    print_header "Mode watch - Tests en continu"
    npm run test:watch
    ;;

  "coverage")
    print_header "Génération du rapport de coverage"
    npm test -- --coverage --coverageReporters=html
    print_success "Coverage report généré dans ./coverage/index.html"
    ;;

  "verbose"|"-v")
    print_header "Exécution des tests (mode verbose)"
    npm test -- --verbose --coverage
    ;;

  "clear")
    print_header "Nettoyage du cache Jest"
    npm test -- --clearCache
    print_success "Cache nettoyé"
    ;;

  "update")
    print_header "Mise à jour des snapshots"
    npm test -- -u
    print_success "Snapshots mis à jour"
    ;;

  "ci")
    print_header "Exécution des tests (mode CI)"
    npm test -- --ci --coverage --maxWorkers=2
    ;;

  "help"|"-h"|"--help")
    echo "Usage: ./run_tests.sh [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  install, deps    - Installer les dépendances de test"
    echo "  all              - Exécuter tous les tests avec coverage (défaut)"
    echo "  unit             - Exécuter les tests unitaires uniquement"
    echo "  components       - Exécuter les tests de composants"
    echo "  services         - Exécuter les tests de services"
    echo "  watch            - Exécuter les tests en mode watch"
    echo "  coverage         - Générer le rapport de coverage HTML"
    echo "  verbose, -v      - Exécuter les tests en mode verbose"
    echo "  clear            - Nettoyer le cache Jest"
    echo "  update           - Mettre à jour les snapshots"
    echo "  ci               - Exécuter les tests en mode CI"
    echo "  help, -h         - Afficher cette aide"
    echo ""
    echo "Examples:"
    echo "  ./run_tests.sh all"
    echo "  ./run_tests.sh components"
    echo "  ./run_tests.sh coverage"
    ;;

  *)
    print_error "Commande inconnue: $COMMAND"
    echo "Utilisez './run_tests.sh help' pour voir les commandes disponibles"
    exit 1
    ;;
esac

echo ""
print_success "Tests terminés!"
