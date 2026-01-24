#!/bin/bash
# ============================================================================
# Script de démarrage de l'API Docker Control
# ============================================================================

echo ""
echo "============================================================================"
echo "    API Docker Control - Simulateurs Gaveurs V3.0"
echo "============================================================================"
echo ""

# Vérifier si Python est installé
if ! command -v python3 &> /dev/null; then
    echo "[ERREUR] Python3 n'est pas installé"
    echo ""
    echo "Installez Python depuis: https://www.python.org/downloads/"
    exit 1
fi

# Créer un environnement virtuel s'il n'existe pas
if [ ! -d "venv" ]; then
    echo "[INFO] Création de l'environnement virtuel..."
    python3 -m venv venv
fi

# Activer l'environnement virtuel
echo "[INFO] Activation de l'environnement virtuel..."
source venv/bin/activate

# Installer les dépendances
echo "[INFO] Installation des dépendances..."
pip install -q --upgrade pip
pip install -q -r requirements.txt

# Démarrer l'API
echo ""
echo "============================================================================"
echo "[INFO] Démarrage de l'API sur http://localhost:8889"
echo "[INFO] Documentation disponible sur http://localhost:8889/docs"
echo "============================================================================"
echo ""

python3 docker_api.py
