"""
Router API - Simulator Control
Endpoints pour contrôler les simulateurs via l'interface web de démonstration
"""

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import Optional, Dict, List
import asyncio
import subprocess
import os
import signal
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/control", tags=["Simulator Control"])

# ============================================================================
# Helper Functions
# ============================================================================

def get_python_executable() -> str:
    """
    Retourne le chemin vers l'exécutable Python à utiliser.
    En production (venv activé): utilise sys.executable
    En développement: utilise le Python du venv backend si disponible
    """
    import sys

    # Si on est dans un venv, utiliser ce Python
    if hasattr(sys, 'real_prefix') or (hasattr(sys, 'base_prefix') and sys.base_prefix != sys.prefix):
        return sys.executable

    # Sinon, essayer de trouver le venv du backend
    backend_venv_python = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
        "venv",
        "Scripts" if os.name == 'nt' else "bin",
        "python.exe" if os.name == 'nt' else "python"
    )

    if os.path.exists(backend_venv_python):
        return backend_venv_python

    # Fallback sur python système
    return "python"

def get_simulators_base_path() -> str:
    """
    Retourne le chemin de base vers les simulateurs.
    Détecte automatiquement si on est dans Docker ou en local.

    Dans Docker: /simulators (volume mount)
    En local: ../../../simulators (relatif à ce fichier)
    """
    # Check if running in Docker
    if os.path.exists("/.dockerenv") or os.path.exists("/simulators"):
        return "/simulators"

    # Local development - chemin relatif depuis backend-api/app/routers/
    return os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
        "simulators"
    )

# ============================================================================
# Process Management
# ============================================================================

class SimulatorProcess:
    """Gère un processus de simulateur"""

    def __init__(self, simulator_type: str):
        self.simulator_type = simulator_type
        self.process: Optional[subprocess.Popen] = None
        self.status = "stopped"
        self.start_time: Optional[datetime] = None
        self.stats = {
            "messages_sent": 0,
            "errors": 0,
            "uptime_seconds": 0
        }
        self.last_error: Optional[str] = None

    def is_running(self) -> bool:
        """Vérifie si le processus est actif"""
        if self.process is None:
            return False
        return self.process.poll() is None

    def get_uptime(self) -> int:
        """Retourne l'uptime en secondes"""
        if not self.start_time or not self.is_running():
            return 0
        return int((datetime.now() - self.start_time).total_seconds())


class SimulatorManager:
    """Gestionnaire global des simulateurs"""

    def __init__(self):
        self.simulators: Dict[str, SimulatorProcess] = {
            "gavage": SimulatorProcess("gavage"),
            "monitor": SimulatorProcess("monitor"),
            "sqal": SimulatorProcess("sqal"),
            "consumer": SimulatorProcess("consumer")
        }
        self.websocket_clients: List[WebSocket] = []

    async def broadcast_status(self):
        """Broadcast status to all connected WebSocket clients"""
        status = self.get_all_status()
        disconnected = []

        for ws in self.websocket_clients:
            try:
                await ws.send_json(status)
            except:
                disconnected.append(ws)

        # Remove disconnected clients
        for ws in disconnected:
            self.websocket_clients.remove(ws)

    def get_all_status(self) -> Dict:
        """Retourne le status de tous les simulateurs"""
        return {
            "timestamp": datetime.now().isoformat(),
            "simulators": {
                name: {
                    "status": sim.status,
                    "running": sim.is_running(),
                    "uptime": sim.get_uptime(),
                    "stats": sim.stats,
                    "last_error": sim.last_error
                }
                for name, sim in self.simulators.items()
            }
        }

    def start_gavage(self, nb_lots: int, acceleration: int) -> bool:
        """Démarre le simulateur de gavage"""
        sim = self.simulators["gavage"]

        if sim.is_running():
            raise HTTPException(status_code=409, detail="Gavage simulator already running")

        try:
            # Path to gavage simulator
            simulator_path = os.path.join(
                os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
                "simulators",
                "gavage_realtime",
                "main.py"
            )

            if not os.path.exists(simulator_path):
                raise FileNotFoundError(f"Gavage simulator not found at {simulator_path}")

            # Start process
            python_exec = get_python_executable()
            sim.process = subprocess.Popen(
                [
                    python_exec,
                    simulator_path,
                    "--nb-lots", str(nb_lots),
                    "--acceleration", str(acceleration),
                    "--backend-url", "ws://localhost:8000/ws/gavage"
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )

            sim.status = "running"
            sim.start_time = datetime.now()
            sim.stats = {"messages_sent": 0, "errors": 0, "uptime_seconds": 0}

            logger.info(f"✅ Gavage simulator started with PID {sim.process.pid}")
            return True

        except Exception as e:
            logger.error(f"❌ Failed to start gavage simulator: {e}")
            sim.status = "error"
            raise HTTPException(status_code=500, detail=str(e))

    def stop_gavage(self) -> bool:
        """Arrête le simulateur de gavage"""
        sim = self.simulators["gavage"]

        if not sim.is_running():
            raise HTTPException(status_code=404, detail="Gavage simulator not running")

        try:
            # Send SIGTERM (graceful shutdown)
            if os.name == 'nt':  # Windows
                sim.process.terminate()
            else:  # Unix
                os.kill(sim.process.pid, signal.SIGTERM)

            # Wait for process to finish
            sim.process.wait(timeout=5)

            sim.status = "stopped"
            sim.process = None
            sim.start_time = None

            logger.info("✅ Gavage simulator stopped")
            return True

        except subprocess.TimeoutExpired:
            # Force kill if graceful shutdown failed
            sim.process.kill()
            sim.status = "stopped"
            sim.process = None
            logger.warning("⚠️ Gavage simulator force killed after timeout")
            return True

        except Exception as e:
            logger.error(f"❌ Failed to stop gavage simulator: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    def start_monitor(self, polling_interval: int) -> bool:
        """Démarre le lot monitor"""
        sim = self.simulators["monitor"]

        if sim.is_running():
            raise HTTPException(status_code=409, detail="Monitor already running")

        try:
            # Path to monitor
            base_path = get_simulators_base_path()
            monitor_path = os.path.join(base_path, "sqal", "lot_monitor.py")

            if not os.path.exists(monitor_path):
                raise FileNotFoundError(f"Monitor not found at {monitor_path}")

            # Start process with backend's Python (has asyncpg)
            python_exec = get_python_executable()
            sim.process = subprocess.Popen(
                [
                    python_exec,
                    monitor_path,
                    "--polling-interval", str(polling_interval)
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )

            sim.status = "running"
            sim.start_time = datetime.now()
            sim.stats = {"messages_sent": 0, "errors": 0, "uptime_seconds": 0}

            logger.info(f"✅ Lot monitor started with PID {sim.process.pid}")
            return True

        except Exception as e:
            logger.error(f"❌ Failed to start monitor: {e}")
            sim.status = "error"
            raise HTTPException(status_code=500, detail=str(e))

    def stop_monitor(self) -> bool:
        """Arrête le lot monitor"""
        sim = self.simulators["monitor"]

        if not sim.is_running():
            raise HTTPException(status_code=404, detail="Monitor not running")

        try:
            # Send SIGTERM
            if os.name == 'nt':
                sim.process.terminate()
            else:
                os.kill(sim.process.pid, signal.SIGTERM)

            sim.process.wait(timeout=5)

            sim.status = "stopped"
            sim.process = None
            sim.start_time = None

            logger.info("✅ Monitor stopped")
            return True

        except subprocess.TimeoutExpired:
            sim.process.kill()
            sim.status = "stopped"
            sim.process = None
            logger.warning("⚠️ Monitor force killed after timeout")
            return True

        except Exception as e:
            logger.error(f"❌ Failed to stop monitor: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    def start_sqal(self, device_id: str, interval: int, nb_samples: int) -> bool:
        """Démarre le simulateur SQAL"""
        sim = self.simulators["sqal"]

        if sim.is_running():
            raise HTTPException(status_code=409, detail="SQAL simulator already running")

        try:
            # Path to SQAL simulator (esp32_simulator.py in simulator-sqal directory)
            # Check if in Docker
            if os.path.exists("/.dockerenv") or os.path.exists("/simulator-sqal"):
                sqal_path = "/simulator-sqal/esp32_simulator.py"
            else:
                # Local - relative to backend-api/app/routers/
                sqal_path = os.path.join(
                    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
                    "simulator-sqal",
                    "esp32_simulator.py"
                )

            if not os.path.exists(sqal_path):
                raise FileNotFoundError(f"SQAL simulator not found at {sqal_path}")

            # Calculate duration from samples and interval
            duration = nb_samples * interval

            # WebSocket URL: Always use localhost:8000 because simulator runs on host machine
            # even when backend is in Docker (subprocess launches on host, not in container)
            ws_url = "ws://localhost:8000/ws/sensors/"

            # Start process - Use system Python (simulator has its own dependencies)
            python_exec = "python"
            logger.info(f"Starting SQAL simulator: {python_exec} {sqal_path}")
            logger.info(f"  Device: {device_id}, Interval: {interval}s, Samples: {nb_samples}, Duration: {duration}s")
            logger.info(f"  WebSocket URL: {ws_url}")

            sim.process = subprocess.Popen(
                [
                    python_exec,
                    sqal_path,
                    "--device-id", device_id,
                    "--url", ws_url,
                    "--rate", str(1.0 / interval),  # Convert interval to rate (Hz)
                    "--duration", str(duration)
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )

            sim.status = "running"
            sim.start_time = datetime.now()
            sim.stats = {"messages_sent": 0, "errors": 0, "uptime_seconds": 0}
            sim.last_error = None

            # Start background thread to capture stderr
            def capture_stderr():
                try:
                    for line in sim.process.stderr:
                        line = line.strip()
                        if line:
                            logger.warning(f"[SQAL stderr] {line}")
                            sim.last_error = line
                            if "error" in line.lower() or "exception" in line.lower():
                                sim.stats["errors"] += 1
                except:
                    pass

            import threading
            threading.Thread(target=capture_stderr, daemon=True).start()

            logger.info(f"SQAL simulator started with PID {sim.process.pid}")
            return True

        except Exception as e:
            logger.error(f"❌ Failed to start SQAL simulator: {e}")
            sim.status = "error"
            raise HTTPException(status_code=500, detail=str(e))

    def stop_sqal(self) -> bool:
        """Arrête le simulateur SQAL"""
        sim = self.simulators["sqal"]

        if not sim.is_running():
            raise HTTPException(status_code=404, detail="SQAL simulator not running")

        try:
            # Send SIGTERM
            if os.name == 'nt':
                sim.process.terminate()
            else:
                os.kill(sim.process.pid, signal.SIGTERM)

            sim.process.wait(timeout=5)

            sim.status = "stopped"
            sim.process = None
            sim.start_time = None

            logger.info("✅ SQAL simulator stopped")
            return True

        except subprocess.TimeoutExpired:
            sim.process.kill()
            sim.status = "stopped"
            sim.process = None
            logger.warning("⚠️ SQAL simulator force killed after timeout")
            return True

        except Exception as e:
            logger.error(f"❌ Failed to stop SQAL simulator: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    def start_consumer(self, interval: int, num_feedbacks: Optional[int] = None, code_lot: Optional[str] = None) -> bool:
        """Démarre le simulateur de satisfaction clients"""
        sim = self.simulators["consumer"]

        if sim.is_running():
            raise HTTPException(status_code=409, detail="Consumer simulator already running")

        try:
            # Path to consumer simulator
            base_path = get_simulators_base_path()
            consumer_path = os.path.join(base_path, "consumer-satisfaction", "main.py")

            if not os.path.exists(consumer_path):
                raise FileNotFoundError(f"Consumer simulator not found at {consumer_path}")

            # Build command
            python_exec = get_python_executable()
            cmd = [
                python_exec,
                consumer_path,
                "--interval", str(interval),
            ]

            if num_feedbacks:
                cmd.extend(["--num-feedbacks", str(num_feedbacks)])

            if code_lot:
                cmd.extend(["--code-lot", str(code_lot)])

            # Start process
            sim.process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )

            sim.status = "running"
            sim.start_time = datetime.now()
            sim.stats = {"messages_sent": 0, "errors": 0, "uptime_seconds": 0}

            logger.info(f"✅ Consumer satisfaction simulator started with PID {sim.process.pid}")
            return True

        except Exception as e:
            logger.error(f"❌ Failed to start consumer simulator: {e}")
            sim.status = "error"
            raise HTTPException(status_code=500, detail=str(e))

    def stop_consumer(self) -> bool:
        """Arrête le simulateur de satisfaction clients"""
        sim = self.simulators["consumer"]

        if not sim.is_running():
            raise HTTPException(status_code=404, detail="Consumer simulator not running")

        try:
            # Send SIGTERM
            if os.name == 'nt':
                sim.process.terminate()
            else:
                os.kill(sim.process.pid, signal.SIGTERM)

            sim.process.wait(timeout=5)

            sim.status = "stopped"
            sim.process = None
            sim.start_time = None

            logger.info("✅ Consumer satisfaction simulator stopped")
            return True

        except subprocess.TimeoutExpired:
            sim.process.kill()
            sim.status = "stopped"
            sim.process = None
            logger.warning("⚠️ Consumer simulator force killed after timeout")
            return True

        except Exception as e:
            logger.error(f"❌ Failed to stop consumer simulator: {e}")
            raise HTTPException(status_code=500, detail=str(e))


# Global manager instance
manager = SimulatorManager()


# ============================================================================
# Pydantic Models
# ============================================================================

class GavageStartRequest(BaseModel):
    nb_lots: int = 3
    acceleration: int = 1440

class MonitorStartRequest(BaseModel):
    polling_interval: int = 60

class SQALStartRequest(BaseModel):
    device_id: str = "ESP32_LL_01"
    interval: int = 30
    nb_samples: int = 50

class ConsumerStartRequest(BaseModel):
    interval: int = 10
    num_feedbacks: Optional[int] = None
    code_lot: Optional[str] = None


# ============================================================================
# REST API Endpoints
# ============================================================================

@router.get("/status")
async def get_status():
    """
    Retourne le status de tous les simulateurs
    """
    return manager.get_all_status()


@router.post("/gavage/start")
async def start_gavage_simulator(params: GavageStartRequest):
    """
    Démarre le simulateur de gavage temps réel

    Args:
        nb_lots: Nombre de lots à simuler (défaut: 3)
        acceleration: Facteur d'accélération (défaut: 1440 = 1 jour = 60s)
    """
    manager.start_gavage(params.nb_lots, params.acceleration)
    await manager.broadcast_status()

    return {
        "success": True,
        "message": f"Gavage simulator started with {params.nb_lots} lots (×{params.acceleration})"
    }


@router.post("/gavage/stop")
async def stop_gavage_simulator():
    """
    Arrête le simulateur de gavage
    """
    manager.stop_gavage()
    await manager.broadcast_status()

    return {
        "success": True,
        "message": "Gavage simulator stopped"
    }


@router.post("/monitor/start")
async def start_monitor(params: MonitorStartRequest):
    """
    Démarre le lot monitor

    Args:
        polling_interval: Intervalle de polling en secondes (défaut: 60)
    """
    manager.start_monitor(params.polling_interval)
    await manager.broadcast_status()

    return {
        "success": True,
        "message": f"Lot monitor started (polling every {params.polling_interval}s)"
    }


@router.post("/monitor/stop")
async def stop_monitor():
    """
    Arrête le lot monitor
    """
    manager.stop_monitor()
    await manager.broadcast_status()

    return {
        "success": True,
        "message": "Lot monitor stopped"
    }


@router.post("/sqal/start")
async def start_sqal_simulator(params: SQALStartRequest):
    """
    Démarre le simulateur SQAL (ESP32 digital twin)

    Args:
        device_id: ID du device ESP32 (défaut: ESP32_LL_01)
        interval: Intervalle entre mesures en secondes (défaut: 30)
        nb_samples: Nombre d'échantillons à générer (défaut: 50)
    """
    manager.start_sqal(params.device_id, params.interval, params.nb_samples)
    await manager.broadcast_status()

    return {
        "success": True,
        "message": f"SQAL simulator started ({params.device_id}, {params.nb_samples} samples)"
    }


@router.post("/sqal/stop")
async def stop_sqal_simulator():
    """
    Arrête le simulateur SQAL
    """
    manager.stop_sqal()
    await manager.broadcast_status()

    return {
        "success": True,
        "message": "SQAL simulator stopped"
    }


@router.get("/sqal/logs")
async def get_sqal_logs():
    """
    Récupère les logs stderr du simulateur SQAL
    """
    sim = manager.simulators["sqal"]

    if sim.process is None:
        return {"logs": "No process running"}

    # Read stderr non-blocking
    try:
        import select
        if sim.process.stderr and select.select([sim.process.stderr], [], [], 0)[0]:
            logs = sim.process.stderr.read()
            return {"logs": logs if logs else "No stderr output"}
        else:
            return {"logs": "No stderr available yet"}
    except Exception as e:
        # On Windows, select doesn't work with pipes, read what's available
        if sim.process.poll() is not None:  # Process finished
            stdout, stderr = sim.process.communicate()
            return {"logs": stderr if stderr else "No stderr output", "stdout": stdout}
        else:
            return {"logs": "Process still running, cannot read logs yet"}


@router.post("/consumer/start")
async def start_consumer_simulator(params: ConsumerStartRequest):
    """
    Démarre le simulateur de satisfaction clients

    Args:
        interval: Intervalle entre feedbacks en secondes (défaut: 10)
        num_feedbacks: Nombre de feedbacks à générer (optionnel, défaut: illimité)
    """
    manager.start_consumer(params.interval, params.num_feedbacks, params.code_lot)
    await manager.broadcast_status()

    return {
        "success": True,
        "message": f"Consumer satisfaction simulator started (feedback every {params.interval}s)"
    }


@router.post("/consumer/stop")
async def stop_consumer_simulator():
    """
    Arrête le simulateur de satisfaction clients
    """
    manager.stop_consumer()
    await manager.broadcast_status()

    return {
        "success": True,
        "message": "Consumer satisfaction simulator stopped"
    }


@router.post("/stop-all")
async def stop_all_simulators():
    """
    Arrête tous les simulateurs actifs
    """
    stopped = []
    errors = []

    for name, sim in manager.simulators.items():
        if sim.is_running():
            try:
                if name == "gavage":
                    manager.stop_gavage()
                elif name == "monitor":
                    manager.stop_monitor()
                elif name == "sqal":
                    manager.stop_sqal()
                elif name == "consumer":
                    manager.stop_consumer()
                stopped.append(name)
            except Exception as e:
                errors.append(f"{name}: {str(e)}")

    await manager.broadcast_status()

    return {
        "success": len(errors) == 0,
        "stopped": stopped,
        "errors": errors
    }


# ============================================================================
# WebSocket Endpoint
# ============================================================================

@router.websocket("/ws")
async def websocket_control(websocket: WebSocket):
    """
    WebSocket pour updates temps réel du control panel

    Envoie automatiquement le status de tous les simulateurs toutes les 2 secondes
    """
    await websocket.accept()
    manager.websocket_clients.append(websocket)

    logger.info(f"🔌 Control panel WebSocket connected ({len(manager.websocket_clients)} clients)")

    try:
        # Send initial status
        await websocket.send_json(manager.get_all_status())

        # Keep connection alive and send periodic updates
        while True:
            await asyncio.sleep(2)

            # Update uptime stats
            for sim in manager.simulators.values():
                if sim.is_running():
                    sim.stats["uptime_seconds"] = sim.get_uptime()

            # Send status update
            await websocket.send_json(manager.get_all_status())

    except WebSocketDisconnect:
        logger.info("🔌 Control panel WebSocket disconnected")
    except Exception as e:
        logger.error(f"❌ WebSocket error: {e}")
    finally:
        if websocket in manager.websocket_clients:
            manager.websocket_clients.remove(websocket)
