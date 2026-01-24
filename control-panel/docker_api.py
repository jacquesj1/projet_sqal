#!/usr/bin/env python3
"""
================================================================================
API REST pour piloter les simulateurs Docker depuis le Control Panel
================================================================================
Usage: python docker_api.py
Port: 8889
================================================================================
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import subprocess
import json
import os
from typing import Dict, List
from pathlib import Path

app = FastAPI(
    title="Simulators Docker Control API",
    description="API REST pour piloter les simulateurs Docker",
    version="1.0.0"
)

# CORS pour permettre les appels depuis le control panel
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Chemin vers le docker-compose.yml (racine du projet)
PROJECT_ROOT = Path(__file__).parent.parent
os.chdir(PROJECT_ROOT)

def run_docker_compose(args: List[str]) -> Dict:
    """Execute une commande docker-compose et retourne le résultat"""
    try:
        cmd = ["docker-compose"] + args
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30
        )

        return {
            "success": result.returncode == 0,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "returncode": result.returncode
        }
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "stdout": "",
            "stderr": "Command timeout (30s)",
            "returncode": -1
        }
    except Exception as e:
        return {
            "success": False,
            "stdout": "",
            "stderr": str(e),
            "returncode": -1
        }

def get_container_status(service_name: str) -> Dict:
    """Récupère le status d'un conteneur"""
    result = run_docker_compose(["ps", "--format", "json", service_name])

    if not result["success"]:
        return {"status": "error", "message": result["stderr"]}

    try:
        # docker-compose ps --format json retourne une ligne JSON par service
        lines = result["stdout"].strip().split('\n')
        if not lines or not lines[0]:
            return {"status": "not_found", "running": False}

        container_info = json.loads(lines[0])
        state = container_info.get("State", "unknown")

        return {
            "status": state,
            "running": state == "running",
            "name": container_info.get("Name", ""),
            "service": container_info.get("Service", "")
        }
    except (json.JSONDecodeError, IndexError):
        return {"status": "unknown", "running": False}

@app.get("/")
async def root():
    """Health check"""
    return {
        "service": "Simulators Docker Control API",
        "version": "1.0.0",
        "status": "running"
    }

@app.get("/api/simulators/status")
async def get_all_status():
    """Récupère le status de tous les simulateurs"""
    sqal_status = get_container_status("simulator-sqal")
    gavage_status = get_container_status("simulator-gavage")
    gavage_realtime_status = get_container_status("simulator-gavage-realtime")

    return {
        "sqal": sqal_status,
        "gavage": gavage_status,
        "gavage_realtime": gavage_realtime_status
    }

@app.post("/api/simulators/sqal/start")
async def start_sqal():
    """Démarre le simulateur SQAL"""
    result = run_docker_compose(["up", "-d", "simulator-sqal"])

    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["stderr"])

    return {
        "message": "Simulateur SQAL démarré",
        "output": result["stdout"]
    }

@app.post("/api/simulators/sqal/stop")
async def stop_sqal():
    """Arrête le simulateur SQAL"""
    result = run_docker_compose(["stop", "simulator-sqal"])

    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["stderr"])

    return {
        "message": "Simulateur SQAL arrêté",
        "output": result["stdout"]
    }

@app.post("/api/simulators/sqal/restart")
async def restart_sqal():
    """Redémarre le simulateur SQAL"""
    result = run_docker_compose(["restart", "simulator-sqal"])

    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["stderr"])

    return {
        "message": "Simulateur SQAL redémarré",
        "output": result["stdout"]
    }

@app.get("/api/simulators/sqal/logs")
async def get_sqal_logs(lines: int = 50):
    """Récupère les logs du simulateur SQAL"""
    result = run_docker_compose(["logs", "--tail", str(lines), "simulator-sqal"])

    return {
        "logs": result["stdout"],
        "error": result["stderr"] if not result["success"] else None
    }

@app.post("/api/simulators/gavage/start")
async def start_gavage():
    """Démarre le simulateur Gavage"""
    result = run_docker_compose(["up", "-d", "simulator-gavage"])

    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["stderr"])

    return {
        "message": "Simulateur Gavage démarré",
        "output": result["stdout"]
    }

@app.post("/api/simulators/gavage/stop")
async def stop_gavage():
    """Arrête le simulateur Gavage"""
    result = run_docker_compose(["stop", "simulator-gavage"])

    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["stderr"])

    return {
        "message": "Simulateur Gavage arrêté",
        "output": result["stdout"]
    }

@app.get("/api/simulators/gavage/logs")
async def get_gavage_logs(lines: int = 50):
    """Récupère les logs du simulateur Gavage"""
    result = run_docker_compose(["logs", "--tail", str(lines), "simulator-gavage"])

    return {
        "logs": result["stdout"],
        "error": result["stderr"] if not result["success"] else None
    }

@app.post("/api/simulators/gavage-realtime/start")
async def start_gavage_realtime():
    """Démarre le simulateur Gavage Temps Réel"""
    result = run_docker_compose(["up", "-d", "simulator-gavage-realtime"])

    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["stderr"])

    return {
        "message": "Simulateur Gavage Temps Réel démarré",
        "output": result["stdout"]
    }

@app.post("/api/simulators/gavage-realtime/stop")
async def stop_gavage_realtime():
    """Arrête le simulateur Gavage Temps Réel"""
    result = run_docker_compose(["stop", "simulator-gavage-realtime"])

    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["stderr"])

    return {
        "message": "Simulateur Gavage Temps Réel arrêté",
        "output": result["stdout"]
    }

@app.post("/api/simulators/gavage-realtime/restart")
async def restart_gavage_realtime():
    """Redémarre le simulateur Gavage Temps Réel"""
    result = run_docker_compose(["restart", "simulator-gavage-realtime"])

    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["stderr"])

    return {
        "message": "Simulateur Gavage Temps Réel redémarré",
        "output": result["stdout"]
    }

@app.get("/api/simulators/gavage-realtime/logs")
async def get_gavage_realtime_logs(lines: int = 100):
    """Récupère les logs du simulateur Gavage Temps Réel"""
    result = run_docker_compose(["logs", "--tail", str(lines), "simulator-gavage-realtime"])

    return {
        "logs": result["stdout"],
        "error": result["stderr"] if not result["success"] else None
    }

@app.post("/api/simulators/all/start")
async def start_all():
    """Démarre tous les simulateurs"""
    result = run_docker_compose(["up", "-d", "simulator-sqal", "simulator-gavage", "simulator-gavage-realtime"])

    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["stderr"])

    return {
        "message": "Tous les simulateurs démarrés",
        "output": result["stdout"]
    }

@app.post("/api/simulators/all/stop")
async def stop_all():
    """Arrête tous les simulateurs"""
    result = run_docker_compose(["stop", "simulator-sqal", "simulator-gavage", "simulator-gavage-realtime"])

    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["stderr"])

    return {
        "message": "Tous les simulateurs arrêtés",
        "output": result["stdout"]
    }

if __name__ == "__main__":
    import uvicorn

    print("=" * 80)
    print("🐳 API Docker Control - Simulateurs Gaveurs V3.0")
    print("=" * 80)
    print(f"📡 API disponible sur: http://localhost:8889")
    print(f"📖 Documentation: http://localhost:8889/docs")
    print(f"📂 Projet: {PROJECT_ROOT}")
    print("=" * 80)
    print()

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8889,
        log_level="info"
    )
