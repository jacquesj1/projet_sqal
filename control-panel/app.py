"""
Control Panel - Système Gaveurs V3.0
Supervision et contrôle de l'écosystème complet

Auteur: Claude Sonnet 4.5
Date: 11 Janvier 2026
"""

from flask import Flask, render_template, jsonify, request
import requests
import subprocess
import os
import psutil

app = Flask(__name__)

# Configuration des services
SERVICES = {
    'backend': {
        'name': 'Backend API',
        'url': 'http://localhost:8000',
        'health': '/health',
        'port': 8000,
        'docker': 'gaveurs_backend'
    },
    'frontend_gaveurs': {
        'name': 'Frontend Gaveurs',
        'url': 'http://localhost:3001',
        'health': '/',
        'port': 3001,
        'docker': None  # Running with npm
    },
    'frontend_euralis': {
        'name': 'Frontend Euralis',
        'url': 'http://localhost:3000',
        'health': '/',
        'port': 3000,
        'docker': None
    },
    'frontend_sqal': {
        'name': 'Frontend SQAL',
        'url': 'http://localhost:5173',
        'health': '/',
        'port': 5173,
        'docker': None
    }
}

@app.route('/')
def index():
    """Dashboard principal"""
    return render_template('index.html', services=SERVICES)

@app.route('/api/status')
def get_status():
    """Retourne le statut de tous les services"""
    status = {}

    for key, service in SERVICES.items():
        try:
            response = requests.get(
                f"{service['url']}{service['health']}",
                timeout=2
            )
            status[key] = {
                'running': response.status_code == 200,
                'status_code': response.status_code,
                'url': service['url']
            }
        except Exception as e:
            status[key] = {
                'running': False,
                'error': str(e),
                'url': service['url']
            }

    return jsonify(status)

@app.route('/api/metrics')
def get_metrics():
    """Récupère les métriques du backend"""
    try:
        response = requests.get('http://localhost:8000/api/metrics/', timeout=5)
        if response.status_code == 200:
            return jsonify(response.json())
    except:
        pass

    return jsonify({'error': 'Backend not available'}), 503

@app.route('/api/system')
def get_system_info():
    """Informations système"""
    return jsonify({
        'cpu_percent': psutil.cpu_percent(interval=0.1),
        'memory': {
            'percent': psutil.virtual_memory().percent,
            'available_mb': round(psutil.virtual_memory().available / 1024 / 1024, 2)
        },
        'disk': {
            'percent': psutil.disk_usage('/').percent,
            'free_gb': round(psutil.disk_usage('/').free / 1024 / 1024 / 1024, 2)
        }
    })

@app.route('/api/simulator/sqal/start', methods=['POST'])
def start_sqal_simulator():
    """Démarre le simulateur SQAL"""
    try:
        # Vérifier si déjà running
        for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
            if proc.info['cmdline'] and 'simulator-sqal' in ' '.join(proc.info['cmdline']):
                return jsonify({'success': False, 'message': 'Simulator already running'}), 400

        # Démarrer le simulateur
        subprocess.Popen(
            ['python', 'src/main.py', '--device', 'ESP32_LL_01', '--interval', '5'],
            cwd='../simulator-sqal',
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )

        return jsonify({'success': True, 'message': 'SQAL Simulator started'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/simulator/sqal/stop', methods=['POST'])
def stop_sqal_simulator():
    """Arrête le simulateur SQAL"""
    try:
        killed = 0
        for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
            if proc.info['cmdline'] and 'simulator-sqal' in ' '.join(proc.info['cmdline']):
                proc.kill()
                killed += 1

        if killed > 0:
            return jsonify({'success': True, 'message': f'Stopped {killed} simulator process(es)'})
        else:
            return jsonify({'success': False, 'message': 'No simulator running'}), 404
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/links')
def get_links():
    """Retourne les liens principaux de démo"""
    return jsonify({
        'dashboards': {
            '3_courbes': 'http://localhost:3001/lots/3468/courbes-sprint3',
            'euralis': 'http://localhost:3000/euralis/dashboard',
            'sqal': 'http://localhost:5173',
            'lots': 'http://localhost:3001/lots'
        },
        'apis': {
            'health': 'http://localhost:8000/health',
            'docs': 'http://localhost:8000/docs',
            'metrics': 'http://localhost:8000/api/metrics/',
            'cache': 'http://localhost:8000/api/metrics/cache'
        },
        'blockchain': {
            'explorer': 'http://localhost:3001/blockchain-explorer',
            'qr_demo': 'http://localhost:3001/blockchain'
        }
    })

if __name__ == '__main__':
    print("\n" + "="*70)
    print("🎯 CONTROL PANEL - Système Gaveurs V3.0")
    print("="*70)
    print("\nAccès: http://localhost:5000")
    print("\nFonctionnalités:")
    print("  • Statut temps réel des 4 services")
    print("  • Contrôle simulateur SQAL")
    print("  • Métriques système (CPU/RAM/Disk)")
    print("  • Liens rapides démo")
    print("\n" + "="*70 + "\n")

    app.run(debug=True, host='0.0.0.0', port=5000)
