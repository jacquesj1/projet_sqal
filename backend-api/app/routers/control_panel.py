"""
==============================================================================
Control Panel Router - Simulateurs Management
==============================================================================
Endpoints pour gérer les simulateurs SQAL via Docker API.
Permet de démarrer/arrêter/monitorer les simulateurs depuis un frontend web.

Auteur: Claude Code
Date: 2026-01-06
==============================================================================
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import JSONResponse
from typing import List, Dict, Optional, Literal
from pydantic import BaseModel, Field
from datetime import datetime
import asyncio
import logging
import json

# Docker API client
try:
    import docker
    from docker.errors import DockerException, NotFound, APIError
    DOCKER_AVAILABLE = True
except ImportError:
    DOCKER_AVAILABLE = False

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/control-panel", tags=["Control Panel"])


# ============================================================================
# Pydantic Models
# ============================================================================

class SimulatorConfig(BaseModel):
    """Configuration d'un simulateur SQAL"""
    device_id: str = Field(..., description="Device ID (ex: ESP32_LL_01)")
    location: str = Field(..., description="Location (ex: Ligne A - Landes)")
    backend_url: str = Field(default="ws://backend:8000/ws/sensors/", description="Backend WebSocket URL")
    interval: int = Field(default=30, ge=1, le=300, description="Sampling interval (seconds)")
    config_profile: str = Field(default="foiegras_standard_barquette", description="Config profile name")


class SimulatorStartRequest(BaseModel):
    """Request pour démarrer un simulateur"""
    device_id: str = Field(..., description="Device ID unique")
    location: str = Field(default="Docker Simulator", description="Location description")
    interval: int = Field(default=30, ge=1, le=300, description="Sampling interval (seconds)")
    config_profile: str = Field(default="foiegras_standard_barquette", description="Config profile")
    duration: int = Field(default=0, ge=0, description="Duration in seconds (0 = infinite)")


class SimulatorStopRequest(BaseModel):
    """Request pour arrêter un simulateur"""
    device_id: str = Field(..., description="Device ID to stop")
    force: bool = Field(default=False, description="Force kill if not responding")


class SimulatorStatus(BaseModel):
    """Status d'un simulateur"""
    device_id: str
    container_name: str
    status: Literal["running", "stopped", "error", "not_found"]
    created_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    uptime_seconds: Optional[int] = None
    location: Optional[str] = None
    interval: Optional[int] = None
    config_profile: Optional[str] = None


class ScenarioRequest(BaseModel):
    """Request pour lancer un scénario pré-configuré"""
    scenario_name: Literal["multi_site", "stress_test", "production_demo"]
    duration: int = Field(default=0, ge=0, description="Duration for each simulator (0 = infinite)")


class ControlPanelStats(BaseModel):
    """Statistiques globales du control panel"""
    total_simulators: int
    running_simulators: int
    stopped_simulators: int
    error_simulators: int
    docker_available: bool
    backend_healthy: bool


# ============================================================================
# Docker Client Management
# ============================================================================

class DockerManager:
    """Gestionnaire de containers Docker pour simulateurs"""

    def __init__(self):
        if not DOCKER_AVAILABLE:
            logger.error("❌ Docker SDK not available. Install with: pip install docker")
            self.client = None
            return

        try:
            self.client = docker.from_env()
            self.client.ping()
            logger.info("✅ Docker client initialized successfully")
        except DockerException as e:
            logger.error(f"❌ Failed to connect to Docker daemon: {e}")
            self.client = None

    def is_available(self) -> bool:
        """Check if Docker is available"""
        return self.client is not None

    def get_container_name(self, device_id: str) -> str:
        """Generate container name from device_id"""
        return f"sqal_simulator_{device_id.lower()}"

    async def start_simulator(self, config: SimulatorStartRequest) -> Dict:
        """Start a SQAL simulator container"""
        if not self.is_available():
            raise HTTPException(status_code=503, detail="Docker not available")

        container_name = self.get_container_name(config.device_id)

        # Check if container already exists
        try:
            existing = self.client.containers.get(container_name)
            if existing.status == "running":
                return {
                    "status": "already_running",
                    "device_id": config.device_id,
                    "container_name": container_name,
                    "message": f"Simulator {config.device_id} is already running"
                }
            else:
                # Remove stopped container
                existing.remove(force=True)
                logger.info(f"Removed stopped container: {container_name}")
        except NotFound:
            pass  # Container doesn't exist, we can create it

        # Build command
        command = [
            "python", "esp32_simulator.py",
            "--device-id", config.device_id,
            "--location", config.location,
            "--url", "ws://backend:8000/ws/sensors/",
            "--rate", str(1.0 / config.interval)  # Convert interval to rate
            # Note: config_profile not supported as CLI arg in esp32_simulator.py
        ]

        if config.duration > 0:
            command.extend(["--duration", str(config.duration)])

        # Environment variables
        environment = {
            "DEVICE_ID": config.device_id,
            "BACKEND_WS_URL": "ws://backend:8000/ws/sensors/",
            "LOG_LEVEL": "info"
        }

        # Start container
        try:
            container = self.client.containers.run(
                image="gaveurs_simulator_sqal:latest",  # Pre-built image
                name=container_name,
                command=command,
                environment=environment,
                network="gaveurs_network",
                detach=True,
                remove=False,  # Keep container for logs
                labels={
                    "app": "gaveurs",
                    "component": "sqal-simulator",
                    "device_id": config.device_id,
                    "managed_by": "control-panel"
                }
            )

            logger.info(f"✅ Started simulator: {config.device_id} ({container_name})")

            return {
                "status": "started",
                "device_id": config.device_id,
                "container_name": container_name,
                "container_id": container.id[:12],
                "message": f"Simulator {config.device_id} started successfully"
            }

        except APIError as e:
            logger.error(f"❌ Failed to start simulator {config.device_id}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to start simulator: {str(e)}")

    async def stop_simulator(self, device_id: str, force: bool = False) -> Dict:
        """Stop a SQAL simulator container"""
        if not self.is_available():
            raise HTTPException(status_code=503, detail="Docker not available")

        container_name = self.get_container_name(device_id)

        try:
            container = self.client.containers.get(container_name)

            if container.status != "running":
                return {
                    "status": "not_running",
                    "device_id": device_id,
                    "message": f"Simulator {device_id} is not running"
                }

            # Stop container
            if force:
                container.kill()
                logger.info(f"🛑 Killed simulator: {device_id}")
            else:
                container.stop(timeout=10)
                logger.info(f"🛑 Stopped simulator: {device_id}")

            return {
                "status": "stopped",
                "device_id": device_id,
                "container_name": container_name,
                "message": f"Simulator {device_id} stopped successfully"
            }

        except NotFound:
            raise HTTPException(status_code=404, detail=f"Simulator {device_id} not found")
        except APIError as e:
            logger.error(f"❌ Failed to stop simulator {device_id}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to stop simulator: {str(e)}")

    async def get_simulator_status(self, device_id: str) -> SimulatorStatus:
        """Get status of a specific simulator"""
        if not self.is_available():
            return SimulatorStatus(
                device_id=device_id,
                container_name=self.get_container_name(device_id),
                status="error"
            )

        container_name = self.get_container_name(device_id)

        try:
            container = self.client.containers.get(container_name)

            # Parse container info
            attrs = container.attrs
            created = datetime.fromisoformat(attrs['Created'].replace('Z', '+00:00'))

            status_map = {
                "running": "running",
                "exited": "stopped",
                "paused": "stopped",
                "restarting": "running",
                "dead": "error"
            }

            status = status_map.get(container.status, "error")

            # Calculate uptime
            uptime_seconds = None
            started_at = None
            if status == "running" and attrs['State']['StartedAt']:
                started_at = datetime.fromisoformat(attrs['State']['StartedAt'].replace('Z', '+00:00'))
                uptime_seconds = int((datetime.now(started_at.tzinfo) - started_at).total_seconds())

            # Parse environment variables (list of "KEY=VALUE" strings)
            env_list = attrs.get('Config', {}).get('Env', []) or []
            env_dict = {}
            for env_var in env_list:
                if '=' in env_var:
                    key, value = env_var.split('=', 1)
                    env_dict[key] = value

            return SimulatorStatus(
                device_id=device_id,
                container_name=container_name,
                status=status,
                created_at=created,
                started_at=started_at,
                uptime_seconds=uptime_seconds,
                location=env_dict.get('LOCATION', env_dict.get('DEVICE_LOCATION')),
                interval=int(env_dict['INTERVAL']) if 'INTERVAL' in env_dict else None,
                config_profile=env_dict.get('CONFIG_PROFILE')
            )

        except NotFound:
            return SimulatorStatus(
                device_id=device_id,
                container_name=container_name,
                status="not_found"
            )
        except Exception as e:
            logger.error(f"❌ Failed to get status for {device_id}: {e}")
            return SimulatorStatus(
                device_id=device_id,
                container_name=container_name,
                status="error"
            )

    async def list_all_simulators(self) -> List[SimulatorStatus]:
        """List all SQAL simulator containers"""
        if not self.is_available():
            return []

        try:
            containers = self.client.containers.list(
                all=True,
                filters={"label": "component=sqal-simulator"}
            )

            statuses = []
            for container in containers:
                device_id = container.labels.get('device_id', 'unknown')
                status = await self.get_simulator_status(device_id)
                statuses.append(status)

            return statuses

        except Exception as e:
            logger.error(f"❌ Failed to list simulators: {e}")
            return []

    async def get_container_logs(self, device_id: str, tail: int = 100) -> str:
        """Get logs from a simulator container"""
        if not self.is_available():
            return "Docker not available"

        container_name = self.get_container_name(device_id)

        try:
            container = self.client.containers.get(container_name)
            logs = container.logs(tail=tail, timestamps=True).decode('utf-8')
            return logs
        except NotFound:
            return f"Container {container_name} not found"
        except Exception as e:
            logger.error(f"❌ Failed to get logs for {device_id}: {e}")
            return f"Error getting logs: {str(e)}"


# Global Docker manager instance
docker_manager = DockerManager()


# ============================================================================
# API Endpoints
# ============================================================================

@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "docker_available": docker_manager.is_available(),
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/stats", response_model=ControlPanelStats)
async def get_stats():
    """Get control panel statistics"""
    simulators = await docker_manager.list_all_simulators()

    running = sum(1 for s in simulators if s.status == "running")
    stopped = sum(1 for s in simulators if s.status == "stopped")
    error = sum(1 for s in simulators if s.status == "error")

    return ControlPanelStats(
        total_simulators=len(simulators),
        running_simulators=running,
        stopped_simulators=stopped,
        error_simulators=error,
        docker_available=docker_manager.is_available(),
        backend_healthy=True  # TODO: Check backend health
    )


@router.post("/simulators/start")
async def start_simulator(config: SimulatorStartRequest):
    """Start a SQAL simulator"""
    result = await docker_manager.start_simulator(config)
    return JSONResponse(content=result)


@router.post("/simulators/stop")
async def stop_simulator(request: SimulatorStopRequest):
    """Stop a SQAL simulator"""
    result = await docker_manager.stop_simulator(request.device_id, request.force)
    return JSONResponse(content=result)


@router.post("/simulators/stop-all")
async def stop_all_simulators(force: bool = False):
    """Stop all running simulators"""
    simulators = await docker_manager.list_all_simulators()

    results = []
    for sim in simulators:
        if sim.status == "running":
            result = await docker_manager.stop_simulator(sim.device_id, force)
            results.append(result)

    return {
        "stopped_count": len(results),
        "results": results
    }


@router.get("/simulators/status/{device_id}", response_model=SimulatorStatus)
async def get_simulator_status(device_id: str):
    """Get status of a specific simulator"""
    return await docker_manager.get_simulator_status(device_id)


@router.get("/simulators/list", response_model=List[SimulatorStatus])
async def list_simulators():
    """List all simulators"""
    return await docker_manager.list_all_simulators()


@router.get("/simulators/logs/{device_id}")
async def get_simulator_logs(device_id: str, tail: int = 100):
    """Get logs from a simulator"""
    logs = await docker_manager.get_container_logs(device_id, tail)
    return {"device_id": device_id, "logs": logs}


@router.post("/scenarios/start")
async def start_scenario(request: ScenarioRequest):
    """Start a pre-configured scenario"""

    scenarios = {
        "multi_site": [
            {"device_id": "ESP32_LL_01", "location": "Ligne A - Landes", "interval": 30},
            {"device_id": "ESP32_LL_02", "location": "Ligne B - Landes", "interval": 45},
            {"device_id": "ESP32_LS_01", "location": "Landes Sud", "interval": 35},
            {"device_id": "ESP32_MT_01", "location": "Mont-de-Marsan", "interval": 40}
        ],
        "stress_test": [
            {"device_id": f"ESP32_STRESS_{i:02d}", "location": f"Stress Test {i}", "interval": 10}
            for i in range(1, 11)  # 10 simulators at 10s interval
        ],
        "production_demo": [
            {"device_id": "ESP32_DEMO_01", "location": "Demo Production Line 1", "interval": 20},
            {"device_id": "ESP32_DEMO_02", "location": "Demo Production Line 2", "interval": 25}
        ]
    }

    if request.scenario_name not in scenarios:
        raise HTTPException(status_code=400, detail=f"Unknown scenario: {request.scenario_name}")

    scenario_configs = scenarios[request.scenario_name]
    results = []

    for config in scenario_configs:
        start_request = SimulatorStartRequest(
            device_id=config["device_id"],
            location=config["location"],
            interval=config["interval"],
            config_profile="foiegras_standard_barquette",
            duration=request.duration
        )

        try:
            result = await docker_manager.start_simulator(start_request)
            results.append(result)
        except Exception as e:
            logger.error(f"Failed to start {config['device_id']}: {e}")
            results.append({
                "status": "error",
                "device_id": config["device_id"],
                "error": str(e)
            })

        # Small delay between starts to avoid overwhelming backend
        await asyncio.sleep(1)

    return {
        "scenario": request.scenario_name,
        "started_count": sum(1 for r in results if r.get("status") in ["started", "already_running"]),
        "results": results
    }


# ============================================================================
# Gavage Simulator Endpoints
# ============================================================================

class GavageSimulatorRequest(BaseModel):
    """Request pour démarrer un simulateur Gavage temps réel"""
    nb_lots: int = Field(default=3, ge=1, le=10, description="Nombre de lots à simuler")
    acceleration: int = Field(default=1440, ge=1, le=10000, description="Facteur d'accélération (1=temps réel, 1440=1j en 60s)")
    backend_url: str = Field(default="ws://backend:8000/ws/gavage", description="Backend WebSocket URL")
    duration: int = Field(default=0, ge=0, description="Durée en secondes (0=infini)")


class GavageSimulatorManager:
    """Gestionnaire du simulateur Gavage"""

    CONTAINER_NAME = "gaveurs_simulator_gavage_realtime"
    IMAGE_NAME = "projet-euralis-gaveurs-simulator-gavage-realtime"
    NETWORK_NAME = "gaveurs_network"

    def __init__(self, docker_client):
        self.client = docker_client

    async def start(self, config: GavageSimulatorRequest) -> Dict:
        """Démarre le simulateur Gavage temps réel"""
        if not self.client:
            raise HTTPException(status_code=503, detail="Docker not available")

        try:
            # Check if already running
            try:
                container = self.client.containers.get(self.CONTAINER_NAME)
                if container.status == "running":
                    return {
                        "status": "already_running",
                        "container_name": self.CONTAINER_NAME,
                        "message": "Gavage simulator is already running"
                    }
                # Remove stopped container
                container.remove()
            except NotFound:
                pass

            # Build command
            command = [
                "python", "main.py",
                "--backend-url", config.backend_url,
                "--nb-lots", str(config.nb_lots),
                "--acceleration", str(config.acceleration)
            ]

            # Create container
            container = self.client.containers.run(
                image=self.IMAGE_NAME,
                name=self.CONTAINER_NAME,
                command=command,
                detach=True,
                network=self.NETWORK_NAME,
                environment={
                    "TZ": "Europe/Paris",
                    "BACKEND_WS_URL": config.backend_url,
                    "LOG_LEVEL": "info",
                    "ACCELERATION": str(config.acceleration),
                    "NB_LOTS": str(config.nb_lots)
                },
                restart_policy={"Name": "unless-stopped"}
            )

            logger.info(f"🚀 Started Gavage simulator: {self.CONTAINER_NAME}")

            # Link to lot registry
            from app.services.lot_registry import lot_registry
            for i in range(config.nb_lots):
                gaveur_id = f"G{100+i:03d}"
                nb_canards = 40 + (i * 5)
                lot_id = await lot_registry.create_lot(gaveur_id, nb_canards, start_gavage=True)
                logger.info(f"📝 Created lot {lot_id} for gaveur {gaveur_id}")

            return {
                "status": "started",
                "container_name": self.CONTAINER_NAME,
                "container_id": container.id[:12],
                "nb_lots": config.nb_lots,
                "acceleration": config.acceleration,
                "message": f"Gavage simulator started with {config.nb_lots} lots"
            }

        except APIError as e:
            logger.error(f"❌ Failed to start Gavage simulator: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to start simulator: {str(e)}")

    async def stop(self, force: bool = False) -> Dict:
        """Arrête le simulateur Gavage"""
        if not self.client:
            raise HTTPException(status_code=503, detail="Docker not available")

        try:
            container = self.client.containers.get(self.CONTAINER_NAME)

            if container.status != "running":
                return {
                    "status": "not_running",
                    "message": "Gavage simulator is not running"
                }

            if force:
                container.kill()
                logger.info(f"🛑 Killed Gavage simulator")
            else:
                container.stop(timeout=10)
                logger.info(f"🛑 Stopped Gavage simulator")

            return {
                "status": "stopped",
                "container_name": self.CONTAINER_NAME,
                "message": "Gavage simulator stopped successfully"
            }

        except NotFound:
            raise HTTPException(status_code=404, detail="Gavage simulator not found")
        except APIError as e:
            logger.error(f"❌ Failed to stop Gavage simulator: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to stop simulator: {str(e)}")

    async def get_status(self) -> Dict:
        """Récupère le status du simulateur Gavage"""
        if not self.client:
            return {"status": "docker_unavailable"}

        try:
            container = self.client.containers.get(self.CONTAINER_NAME)

            attrs = container.attrs
            created = datetime.fromisoformat(attrs['Created'].replace('Z', '+00:00'))

            status = "running" if container.status == "running" else "stopped"

            uptime_seconds = None
            started_at = None
            if status == "running" and attrs['State']['StartedAt']:
                started_at = datetime.fromisoformat(attrs['State']['StartedAt'].replace('Z', '+00:00'))
                uptime_seconds = int((datetime.now(started_at.tzinfo) - started_at).total_seconds())

            return {
                "status": status,
                "container_name": self.CONTAINER_NAME,
                "created_at": created.isoformat(),
                "started_at": started_at.isoformat() if started_at else None,
                "uptime_seconds": uptime_seconds
            }

        except NotFound:
            return {"status": "not_found"}
        except Exception as e:
            logger.error(f"❌ Failed to get Gavage simulator status: {e}")
            return {"status": "error", "error": str(e)}


# Global instance
gavage_manager = None


# ============================================================================
# Gavage Endpoints
# ============================================================================

@router.post("/gavage/start")
async def start_gavage_simulator(config: GavageSimulatorRequest):
    """Démarre le simulateur Gavage temps réel"""
    global gavage_manager
    if gavage_manager is None:
        if docker_manager.is_available():
            gavage_manager = GavageSimulatorManager(docker_manager.client)
        else:
            raise HTTPException(status_code=503, detail="Docker not available")

    result = await gavage_manager.start(config)
    return JSONResponse(content=result)


@router.post("/gavage/stop")
async def stop_gavage_simulator(force: bool = False):
    """Arrête le simulateur Gavage"""
    global gavage_manager
    if gavage_manager is None:
        if docker_manager.is_available():
            gavage_manager = GavageSimulatorManager(docker_manager.client)
        else:
            raise HTTPException(status_code=503, detail="Docker not available")

    result = await gavage_manager.stop(force)
    return JSONResponse(content=result)


@router.get("/gavage/status")
async def get_gavage_status():
    """Récupère le status du simulateur Gavage"""
    global gavage_manager
    if gavage_manager is None:
        if docker_manager.is_available():
            gavage_manager = GavageSimulatorManager(docker_manager.client)
        else:
            return {"status": "docker_unavailable"}

    return await gavage_manager.get_status()


# ============================================================================
# Consumer Feedback Simulator Endpoints
# ============================================================================

class ConsumerSimulatorRequest(BaseModel):
    """Request pour démarrer un simulateur Consumer Feedback"""
    feedbacks_per_hour: int = Field(default=10, ge=1, le=100, description="Nombre de feedbacks par heure")
    min_rating: int = Field(default=3, ge=1, le=5, description="Note minimum (1-5)")
    max_rating: int = Field(default=5, ge=1, le=5, description="Note maximum (1-5)")
    duration: int = Field(default=0, ge=0, description="Durée en secondes (0=infini)")
    use_active_lots: bool = Field(default=True, description="Utiliser les lots actifs du registry")


class ConsumerSimulatorManager:
    """Gestionnaire du simulateur Consumer Feedback"""

    CONTAINER_NAME = "gaveurs_simulator_consumer"
    # Nom de l'image généré par docker-compose: {project}_{service}
    # ou via build explicite: docker build -f simulators/Dockerfile.consumer -t gaveurs-simulator-consumer .
    IMAGE_NAME = "projet-euralis-gaveurs-simulator-consumer"  # Docker Compose default
    IMAGE_NAME_ALT = "gaveurs-simulator-consumer"  # Alternative if built manually
    NETWORK_NAME = "gaveurs_network"

    def __init__(self, docker_client):
        self.client = docker_client

    async def start(self, config: ConsumerSimulatorRequest) -> Dict:
        """Démarre le simulateur Consumer Feedback"""
        if not self.client:
            raise HTTPException(status_code=503, detail="Docker not available")

        try:
            # Check if already running
            try:
                container = self.client.containers.get(self.CONTAINER_NAME)
                if container.status == "running":
                    return {
                        "status": "already_running",
                        "container_name": self.CONTAINER_NAME,
                        "message": "Consumer simulator is already running"
                    }
                # Remove stopped container
                container.remove()
            except NotFound:
                pass

            # Get active lots from registry
            from app.services.lot_registry import lot_registry
            active_lots = await lot_registry.get_active_lots()
            lot_ids = [lot.lot_id for lot in active_lots] if config.use_active_lots else []

            # Build command - Convert feedbacks_per_hour to interval in seconds
            # feedbacks_per_hour=10 -> 1 feedback every 360 seconds
            interval_seconds = max(1, int(3600 / config.feedbacks_per_hour))

            # Build command with actual simulator arguments
            command = [
                "python", "main.py",
                "--api-url", "http://backend:8000",
                "--interval", str(interval_seconds)
            ]

            # Try to find available image (docker-compose or manually built)
            image_to_use = None
            for img_name in [self.IMAGE_NAME, self.IMAGE_NAME_ALT]:
                try:
                    self.client.images.get(img_name)
                    image_to_use = img_name
                    logger.info(f"✅ Found consumer image: {img_name}")
                    break
                except Exception:
                    continue

            if not image_to_use:
                raise HTTPException(
                    status_code=500,
                    detail=f"Image Docker consumer non trouvée. Lancez: docker-compose build simulator-consumer"
                )

            # Create container
            container = self.client.containers.run(
                image=image_to_use,
                name=self.CONTAINER_NAME,
                command=command,
                detach=True,
                network=self.NETWORK_NAME,
                environment={
                    "TZ": "Europe/Paris",
                    "BACKEND_URL": "http://backend:8000",
                    "LOG_LEVEL": "info",
                    "FEEDBACKS_PER_HOUR": str(config.feedbacks_per_hour)
                },
                restart_policy={"Name": "unless-stopped"}
            )

            logger.info(f"🚀 Started Consumer simulator: {self.CONTAINER_NAME}")

            return {
                "status": "started",
                "container_name": self.CONTAINER_NAME,
                "container_id": container.id[:12],
                "feedbacks_per_hour": config.feedbacks_per_hour,
                "active_lots_count": len(lot_ids),
                "message": f"Consumer simulator started targeting {len(lot_ids)} lots"
            }

        except APIError as e:
            logger.error(f"❌ Failed to start Consumer simulator: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to start simulator: {str(e)}")

    async def stop(self, force: bool = False) -> Dict:
        """Arrête le simulateur Consumer"""
        if not self.client:
            raise HTTPException(status_code=503, detail="Docker not available")

        try:
            container = self.client.containers.get(self.CONTAINER_NAME)

            if container.status != "running":
                return {
                    "status": "not_running",
                    "message": "Consumer simulator is not running"
                }

            if force:
                container.kill()
                logger.info(f"🛑 Killed Consumer simulator")
            else:
                container.stop(timeout=10)
                logger.info(f"🛑 Stopped Consumer simulator")

            return {
                "status": "stopped",
                "container_name": self.CONTAINER_NAME,
                "message": "Consumer simulator stopped successfully"
            }

        except NotFound:
            raise HTTPException(status_code=404, detail="Consumer simulator not found")
        except APIError as e:
            logger.error(f"❌ Failed to stop Consumer simulator: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to stop simulator: {str(e)}")

    async def get_status(self) -> Dict:
        """Récupère le status du simulateur Consumer"""
        if not self.client:
            return {"status": "docker_unavailable"}

        try:
            container = self.client.containers.get(self.CONTAINER_NAME)

            attrs = container.attrs
            created = datetime.fromisoformat(attrs['Created'].replace('Z', '+00:00'))

            status = "running" if container.status == "running" else "stopped"

            uptime_seconds = None
            started_at = None
            if status == "running" and attrs['State']['StartedAt']:
                started_at = datetime.fromisoformat(attrs['State']['StartedAt'].replace('Z', '+00:00'))
                uptime_seconds = int((datetime.now(started_at.tzinfo) - started_at).total_seconds())

            return {
                "status": status,
                "container_name": self.CONTAINER_NAME,
                "created_at": created.isoformat(),
                "started_at": started_at.isoformat() if started_at else None,
                "uptime_seconds": uptime_seconds
            }

        except NotFound:
            return {"status": "not_found"}
        except Exception as e:
            logger.error(f"❌ Failed to get Consumer simulator status: {e}")
            return {"status": "error", "error": str(e)}


# Global instance
consumer_manager = None


# ============================================================================
# Consumer Endpoints
# ============================================================================

@router.post("/consumer/start")
async def start_consumer_simulator(config: ConsumerSimulatorRequest):
    """Démarre le simulateur Consumer Feedback"""
    global consumer_manager
    if consumer_manager is None:
        if docker_manager.is_available():
            consumer_manager = ConsumerSimulatorManager(docker_manager.client)
        else:
            raise HTTPException(status_code=503, detail="Docker not available")

    result = await consumer_manager.start(config)
    return JSONResponse(content=result)


@router.post("/consumer/stop")
async def stop_consumer_simulator(force: bool = False):
    """Arrête le simulateur Consumer"""
    global consumer_manager
    if consumer_manager is None:
        if docker_manager.is_available():
            consumer_manager = ConsumerSimulatorManager(docker_manager.client)
        else:
            raise HTTPException(status_code=503, detail="Docker not available")

    result = await consumer_manager.stop(force)
    return JSONResponse(content=result)


@router.get("/consumer/status")
async def get_consumer_status():
    """Récupère le status du simulateur Consumer"""
    global consumer_manager
    if consumer_manager is None:
        if docker_manager.is_available():
            consumer_manager = ConsumerSimulatorManager(docker_manager.client)
        else:
            return {"status": "docker_unavailable"}

    return await consumer_manager.get_status()


# ============================================================================
# Orchestrated Scenarios - Full Chain Simulation
# ============================================================================

class OrchestrationConfig(BaseModel):
    """Configuration pour un scénario orchestré complet"""
    scenario_name: Literal[
        "complete_demo",       # Gavage → SQAL → Consumer (demo complète)
        "quality_focus",       # SQAL multi-sites + Consumer feedback
        "gavage_realtime",     # Gavage temps réel uniquement
        "consumer_analysis"    # Consumer feedback sur lots existants
    ]
    duration: int = Field(default=0, ge=0, description="Durée totale (0=infini)")
    acceleration: int = Field(default=1440, ge=1, le=10000, description="Facteur d'accélération temps")
    nb_lots: int = Field(default=3, ge=1, le=10, description="Nombre de lots pour Gavage")
    nb_sqal_devices: int = Field(default=4, ge=1, le=10, description="Nombre de devices SQAL")
    feedbacks_per_hour: int = Field(default=10, ge=1, le=100, description="Feedbacks/heure")


class OrchestrationStatus(BaseModel):
    """Status d'un scénario orchestré"""
    scenario_name: str
    status: Literal["starting", "running", "partial", "stopped", "error"]
    started_at: Optional[datetime] = None
    gavage_status: str
    sqal_devices_running: int
    consumer_status: str
    total_simulators: int
    running_simulators: int


@router.post("/orchestrate/start")
async def start_orchestrated_scenario(config: OrchestrationConfig):
    """
    Démarre un scénario orchestré complet avec tous les simulateurs

    Scenarios disponibles:
    - complete_demo: Gavage (3 lots) + SQAL (4 devices) + Consumer feedback
    - quality_focus: SQAL multi-sites (6 devices) + Consumer feedback intensif
    - gavage_realtime: Gavage temps réel uniquement (simulation production)
    - consumer_analysis: Consumer feedback sur lots existants (analyse satisfaction)
    """

    global gavage_manager, consumer_manager

    # Initialize managers if needed
    if gavage_manager is None and docker_manager.is_available():
        gavage_manager = GavageSimulatorManager(docker_manager.client)
    if consumer_manager is None and docker_manager.is_available():
        consumer_manager = ConsumerSimulatorManager(docker_manager.client)

    results = {
        "scenario": config.scenario_name,
        "status": "starting",
        "gavage": None,
        "sqal_devices": [],
        "consumer": None,
        "errors": []
    }

    try:
        # Scenario: Complete Demo (Gavage → SQAL → Consumer)
        if config.scenario_name == "complete_demo":
            # 1. Start Gavage simulator
            try:
                gavage_config = GavageSimulatorRequest(
                    nb_lots=config.nb_lots,
                    acceleration=config.acceleration,
                    duration=config.duration
                )
                gavage_result = await gavage_manager.start(gavage_config)
                results["gavage"] = gavage_result
                logger.info("✅ Complete Demo: Gavage started")

                # Wait for lots to be created
                await asyncio.sleep(2)
            except Exception as e:
                logger.error(f"❌ Failed to start Gavage: {e}")
                results["errors"].append(f"Gavage: {str(e)}")

            # 2. Start SQAL devices (multi-site)
            sqal_configs = [
                {"device_id": "ESP32_DEMO_LL_01", "location": "Ligne A - Landes", "interval": 30},
                {"device_id": "ESP32_DEMO_LL_02", "location": "Ligne B - Landes", "interval": 35},
                {"device_id": "ESP32_DEMO_LS_01", "location": "Landes Sud", "interval": 40},
                {"device_id": "ESP32_DEMO_MT_01", "location": "Mont-de-Marsan", "interval": 45}
            ]

            for sqal_config in sqal_configs[:config.nb_sqal_devices]:
                try:
                    start_request = SimulatorStartRequest(
                        device_id=sqal_config["device_id"],
                        location=sqal_config["location"],
                        interval=sqal_config["interval"],
                        duration=config.duration
                    )
                    sqal_result = await docker_manager.start_simulator(start_request)
                    results["sqal_devices"].append(sqal_result)
                    await asyncio.sleep(1)  # Stagger starts
                except Exception as e:
                    logger.error(f"❌ Failed to start SQAL {sqal_config['device_id']}: {e}")
                    results["errors"].append(f"SQAL {sqal_config['device_id']}: {str(e)}")

            logger.info(f"✅ Complete Demo: {len(results['sqal_devices'])} SQAL devices started")

            # 3. Start Consumer simulator (after 5s delay for data to flow)
            await asyncio.sleep(5)
            try:
                consumer_config = ConsumerSimulatorRequest(
                    feedbacks_per_hour=config.feedbacks_per_hour,
                    min_rating=3,
                    max_rating=5,
                    duration=config.duration,
                    use_active_lots=True
                )
                consumer_result = await consumer_manager.start(consumer_config)
                results["consumer"] = consumer_result
                logger.info("✅ Complete Demo: Consumer simulator started")
            except Exception as e:
                logger.error(f"❌ Failed to start Consumer: {e}")
                results["errors"].append(f"Consumer: {str(e)}")

        # Scenario: Quality Focus (SQAL + Consumer)
        elif config.scenario_name == "quality_focus":
            # Start 6 SQAL devices
            sqal_configs = [
                {"device_id": "ESP32_QF_LL_01", "location": "Ligne A - Landes", "interval": 20},
                {"device_id": "ESP32_QF_LL_02", "location": "Ligne B - Landes", "interval": 25},
                {"device_id": "ESP32_QF_LS_01", "location": "Landes Sud", "interval": 30},
                {"device_id": "ESP32_QF_MT_01", "location": "Mont-de-Marsan", "interval": 35},
                {"device_id": "ESP32_QF_BS_01", "location": "Bayonne Sud", "interval": 40},
                {"device_id": "ESP32_QF_PX_01", "location": "Pays Basque", "interval": 45}
            ]

            for sqal_config in sqal_configs[:config.nb_sqal_devices]:
                try:
                    start_request = SimulatorStartRequest(
                        device_id=sqal_config["device_id"],
                        location=sqal_config["location"],
                        interval=sqal_config["interval"],
                        duration=config.duration
                    )
                    sqal_result = await docker_manager.start_simulator(start_request)
                    results["sqal_devices"].append(sqal_result)
                    await asyncio.sleep(1)
                except Exception as e:
                    results["errors"].append(f"SQAL {sqal_config['device_id']}: {str(e)}")

            # Start intensive Consumer feedback
            await asyncio.sleep(3)
            try:
                consumer_config = ConsumerSimulatorRequest(
                    feedbacks_per_hour=config.feedbacks_per_hour * 2,  # 2x plus intensif
                    min_rating=2,
                    max_rating=5,
                    duration=config.duration,
                    use_active_lots=True
                )
                consumer_result = await consumer_manager.start(consumer_config)
                results["consumer"] = consumer_result
            except Exception as e:
                results["errors"].append(f"Consumer: {str(e)}")

        # Scenario: Gavage Realtime Only
        elif config.scenario_name == "gavage_realtime":
            try:
                gavage_config = GavageSimulatorRequest(
                    nb_lots=config.nb_lots,
                    acceleration=config.acceleration,
                    duration=config.duration
                )
                gavage_result = await gavage_manager.start(gavage_config)
                results["gavage"] = gavage_result
            except Exception as e:
                results["errors"].append(f"Gavage: {str(e)}")

        # Scenario: Consumer Analysis (lots existants)
        elif config.scenario_name == "consumer_analysis":
            try:
                consumer_config = ConsumerSimulatorRequest(
                    feedbacks_per_hour=config.feedbacks_per_hour,
                    min_rating=1,
                    max_rating=5,
                    duration=config.duration,
                    use_active_lots=True
                )
                consumer_result = await consumer_manager.start(consumer_config)
                results["consumer"] = consumer_result
            except Exception as e:
                results["errors"].append(f"Consumer: {str(e)}")

        # Determine final status
        has_errors = len(results["errors"]) > 0
        running_count = sum([
            1 if results["gavage"] and results["gavage"].get("status") in ["started", "already_running"] else 0,
            len([d for d in results["sqal_devices"] if d.get("status") in ["started", "already_running"]]),
            1 if results["consumer"] and results["consumer"].get("status") in ["started", "already_running"] else 0
        ])

        if running_count == 0:
            results["status"] = "error"
        elif has_errors:
            results["status"] = "partial"
        else:
            results["status"] = "running"

        results["running_count"] = running_count
        results["started_at"] = datetime.now().isoformat()

        logger.info(f"🎬 Orchestrated scenario '{config.scenario_name}' started: {running_count} simulators running")

        return JSONResponse(content=results)

    except Exception as e:
        logger.error(f"❌ Failed to start orchestrated scenario: {e}")
        raise HTTPException(status_code=500, detail=f"Orchestration failed: {str(e)}")


@router.post("/orchestrate/stop-all")
async def stop_all_orchestrated():
    """Arrête TOUS les simulateurs (SQAL + Gavage + Consumer)"""

    global gavage_manager, consumer_manager

    results = {
        "gavage": None,
        "sqal_devices": [],
        "consumer": None,
        "total_stopped": 0
    }

    # Stop Gavage
    if gavage_manager:
        try:
            gavage_result = await gavage_manager.stop(force=False)
            results["gavage"] = gavage_result
            if gavage_result.get("status") == "stopped":
                results["total_stopped"] += 1
        except Exception as e:
            logger.error(f"Failed to stop Gavage: {e}")

    # Stop all SQAL devices
    simulators = await docker_manager.list_all_simulators()
    for sim in simulators:
        if sim.status == "running":
            try:
                result = await docker_manager.stop_simulator(sim.device_id, force=False)
                results["sqal_devices"].append(result)
                if result.get("status") == "stopped":
                    results["total_stopped"] += 1
            except Exception as e:
                logger.error(f"Failed to stop SQAL {sim.device_id}: {e}")

    # Stop Consumer
    if consumer_manager:
        try:
            consumer_result = await consumer_manager.stop(force=False)
            results["consumer"] = consumer_result
            if consumer_result.get("status") == "stopped":
                results["total_stopped"] += 1
        except Exception as e:
            logger.error(f"Failed to stop Consumer: {e}")

    logger.info(f"🛑 Stopped {results['total_stopped']} simulators")

    return JSONResponse(content=results)


@router.get("/orchestrate/status")
async def get_orchestration_status():
    """Récupère le status global de tous les simulateurs"""

    global gavage_manager, consumer_manager

    # Get statuses
    gavage_status = await gavage_manager.get_status() if gavage_manager else {"status": "not_initialized"}
    consumer_status = await consumer_manager.get_status() if consumer_manager else {"status": "not_initialized"}
    sqal_simulators = await docker_manager.list_all_simulators()

    sqal_running = sum(1 for s in sqal_simulators if s.status == "running")

    # Get lot registry stats
    from app.services.lot_registry import lot_registry
    lot_stats = await lot_registry.get_lot_stats()

    return {
        "gavage": gavage_status,
        "sqal": {
            "total_devices": len(sqal_simulators),
            "running_devices": sqal_running,
            "devices": [{"device_id": s.device_id, "status": s.status} for s in sqal_simulators]
        },
        "consumer": consumer_status,
        "lots": {
            "total_lots": lot_stats.total_lots,
            "active_lots": lot_stats.active_lots,
            "completed_lots": lot_stats.completed_lots,
            "avg_itm": lot_stats.average_itm
        },
        "overall_status": {
            "total_simulators": 1 + len(sqal_simulators) + 1,  # Gavage + SQAL + Consumer
            "running_simulators": (
                (1 if gavage_status.get("status") == "running" else 0) +
                sqal_running +
                (1 if consumer_status.get("status") == "running" else 0)
            )
        }
    }


# ============================================================================
# WebSocket - Real-time Logs Stream
# ============================================================================

@router.websocket("/ws/logs/{device_id}")
async def websocket_logs(websocket: WebSocket, device_id: str):
    """Stream logs from a simulator in real-time"""
    await websocket.accept()

    logger.info(f"📡 WebSocket logs connection: {device_id}")

    try:
        if not docker_manager.is_available():
            await websocket.send_json({
                "type": "error",
                "message": "Docker not available"
            })
            await websocket.close()
            return

        container_name = docker_manager.get_container_name(device_id)

        try:
            container = docker_manager.client.containers.get(container_name)
        except NotFound:
            await websocket.send_json({
                "type": "error",
                "message": f"Container {container_name} not found"
            })
            await websocket.close()
            return

        # Stream logs
        for line in container.logs(stream=True, follow=True, timestamps=True):
            try:
                await websocket.send_json({
                    "type": "log",
                    "device_id": device_id,
                    "message": line.decode('utf-8').strip()
                })
            except WebSocketDisconnect:
                logger.info(f"📡 WebSocket disconnected: {device_id}")
                break
            except Exception as e:
                logger.error(f"Error sending log: {e}")
                break

    except Exception as e:
        logger.error(f"❌ WebSocket error for {device_id}: {e}")
        try:
            await websocket.send_json({
                "type": "error",
                "message": str(e)
            })
        except:
            pass
    finally:
        try:
            await websocket.close()
        except:
            pass
