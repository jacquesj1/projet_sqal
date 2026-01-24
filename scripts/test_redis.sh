#!/bin/bash
# Script de test Redis
# ====================
# Vérifie que Redis est accessible et fonctionne correctement

set -e

echo "=========================================="
echo "Test de connexion Redis"
echo "=========================================="
echo ""

# Configuration
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"

echo "🔍 Test 1: Vérifier si Redis est accessible..."
if command -v redis-cli &> /dev/null; then
    if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping &> /dev/null; then
        echo "✅ Redis répond au PING"
    else
        echo "❌ Redis ne répond pas"
        exit 1
    fi
else
    echo "⚠️  redis-cli non installé, vérification via curl..."
    # Alternative avec Docker
    if docker ps | grep gaveurs_redis &> /dev/null; then
        if docker exec gaveurs_redis redis-cli ping &> /dev/null; then
            echo "✅ Redis répond au PING (via Docker)"
        else
            echo "❌ Redis ne répond pas"
            exit 1
        fi
    else
        echo "❌ Redis container non trouvé"
        exit 1
    fi
fi

echo ""
echo "🔍 Test 2: Tester SET/GET..."
if command -v redis-cli &> /dev/null; then
    redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" SET test_key "Hello Redis" > /dev/null
    VALUE=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" GET test_key)
    if [ "$VALUE" = "Hello Redis" ]; then
        echo "✅ SET/GET fonctionne correctement"
        redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" DEL test_key > /dev/null
    else
        echo "❌ SET/GET échoué"
        exit 1
    fi
else
    docker exec gaveurs_redis redis-cli SET test_key "Hello Redis" > /dev/null
    VALUE=$(docker exec gaveurs_redis redis-cli GET test_key)
    if [ "$VALUE" = "Hello Redis" ]; then
        echo "✅ SET/GET fonctionne correctement (via Docker)"
        docker exec gaveurs_redis redis-cli DEL test_key > /dev/null
    else
        echo "❌ SET/GET échoué"
        exit 1
    fi
fi

echo ""
echo "🔍 Test 3: Vérifier les informations Redis..."
if command -v redis-cli &> /dev/null; then
    INFO=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" INFO server | grep redis_version)
    echo "✅ $INFO"
else
    INFO=$(docker exec gaveurs_redis redis-cli INFO server | grep redis_version)
    echo "✅ $INFO"
fi

echo ""
echo "=========================================="
echo "✅ Tous les tests Redis ont réussi!"
echo "=========================================="
