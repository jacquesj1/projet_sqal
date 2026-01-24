# 🎛️ SQAL Simulators Control Panel

**Frontend web professionnel** pour piloter les simulateurs SQAL via Docker API.

## 📋 Fonctionnalités

✅ **Dashboard temps réel** - Refresh automatique (2s/5s/10s/30s)
✅ **Gestion des simulateurs** - Start/Stop/Kill par device
✅ **Scénarios pré-configurés** :
  - Multi-Site Demo (4 devices, 3 sites Euralis)
  - Stress Test (10 devices, 10s interval)
  - Production Demo (2 production lines)
✅ **Statistiques live** - Total/Running/Stopped/Errors
✅ **Actions bulk** - Stop All en un clic
✅ **Interface moderne** - React 18 + TypeScript + Tailwind CSS + Lucide Icons

---

## 🚀 Quick Start

### Development Mode

```bash
cd control-panel-frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Frontend accessible à : **http://localhost:5174**

### Production Mode (Docker)

```bash
# Build and start
docker-compose up -d control-panel

# Check logs
docker-compose logs -f control-panel

# Stop
docker-compose down
```

Frontend accessible à : **http://localhost:5174**

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│  Control Panel Frontend (React + Vite)      │
│  Port: 5174                                 │
│  - Dashboard                                │
│  - Simulator Management                     │
│  - Scenarios                                │
└─────────────────────────────────────────────┘
           ↓ HTTP REST + WebSocket
┌─────────────────────────────────────────────┐
│  Backend API (FastAPI)                      │
│  Port: 8000                                 │
│  Router: /api/control-panel/                │
│  - Start/Stop simulators                    │
│  - Get status                               │
│  - Docker API integration                   │
└─────────────────────────────────────────────┘
           ↓ Docker API
┌─────────────────────────────────────────────┐
│  Docker Containers                          │
│  - sqal_simulator_esp32_ll_01               │
│  - sqal_simulator_esp32_ll_02               │
│  - sqal_simulator_esp32_ls_01               │
│  - sqal_simulator_esp32_mt_01               │
└─────────────────────────────────────────────┘
```

---

## 📡 Backend API Endpoints

### Health & Stats
- `GET /api/control-panel/health` - Health check
- `GET /api/control-panel/stats` - Global statistics

### Simulators Management
- `POST /api/control-panel/simulators/start` - Start simulator
- `POST /api/control-panel/simulators/stop` - Stop simulator
- `POST /api/control-panel/simulators/stop-all` - Stop all simulators
- `GET /api/control-panel/simulators/status/{device_id}` - Get status
- `GET /api/control-panel/simulators/list` - List all simulators
- `GET /api/control-panel/simulators/logs/{device_id}` - Get logs

### Scenarios
- `POST /api/control-panel/scenarios/start` - Start pre-configured scenario

### WebSocket
- `WS /api/control-panel/ws/logs/{device_id}` - Stream logs in real-time

---

## 🎯 Usage Examples

### Start a Single Simulator

```bash
curl -X POST http://localhost:8000/api/control-panel/simulators/start \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "ESP32_TEST_01",
    "location": "Test Line A",
    "interval": 30,
    "config_profile": "foiegras_standard_barquette",
    "duration": 0
  }'
```

### Start Multi-Site Scenario

```bash
curl -X POST http://localhost:8000/api/control-panel/scenarios/start \
  -H "Content-Type: application/json" \
  -d '{
    "scenario_name": "multi_site",
    "duration": 0
  }'
```

### Stop All Simulators

```bash
curl -X POST http://localhost:8000/api/control-panel/simulators/stop-all \
  -H "Content-Type: application/json"
```

---

## 🛠️ Development

### Project Structure

```
control-panel-frontend/
├── src/
│   ├── components/
│   │   └── Dashboard.tsx          # Main dashboard component
│   ├── services/
│   │   └── api.ts                 # API client (axios)
│   ├── types/
│   │   └── index.ts               # TypeScript types
│   ├── App.tsx                    # Root component
│   ├── main.tsx                   # Entry point
│   └── index.css                  # Tailwind CSS
├── Dockerfile                     # Production build
├── nginx.conf                     # Nginx config for SPA
├── package.json
├── vite.config.ts
├── tsconfig.json
└── tailwind.config.js
```

### Environment Variables

Create `.env.local`:

```env
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
```

### Build for Production

```bash
npm run build
# Output: dist/
```

---

## 🐳 Docker

### Build Image

```bash
docker build -t gaveurs_control_panel:latest .
```

### Run Container

```bash
docker run -d \
  -p 5174:80 \
  --name control-panel \
  --network gaveurs_network \
  -e VITE_API_URL=http://localhost:8000 \
  -e VITE_WS_URL=ws://localhost:8000 \
  gaveurs_control_panel:latest
```

---

## 📊 Screenshots

### Dashboard
- **Stats Cards**: Total, Running, Stopped, Errors
- **Scenarios**: 3 pre-configured scenarios (1-click start)
- **Simulators Table**: Device ID, Status, Location, Uptime, Actions

### Actions
- **Start**: Green play button (stopped simulators only)
- **Stop**: Red stop button (running simulators only)
- **Force Kill**: Red trash button (force kill if not responding)
- **Stop All**: Red button in table header (bulk action)

### Status Badges
- 🟢 **Running** - Green badge with checkmark
- ⚪ **Stopped** - Gray badge with X
- 🔴 **Error** - Red badge with alert
- 🟡 **Not Found** - Yellow badge with alert

---

## 🚨 Troubleshooting

### Frontend can't reach backend

**Symptom**: `ERR_CONNECTION_REFUSED` or `Network Error`

**Solutions**:
1. Check backend is running: `curl http://localhost:8000/health`
2. Check CORS is enabled in backend `main.py`
3. Verify `VITE_API_URL` in `.env.local`

### Docker socket permission denied

**Symptom**: Backend can't access Docker API

**Solutions**:
```bash
# Linux: Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Windows: Ensure Docker Desktop is running
```

### Simulators not starting

**Symptom**: API returns 500 error when starting simulator

**Solutions**:
1. Check simulator image exists: `docker images | grep simulator`
2. Build simulator image: `docker build -t gaveurs_simulator_sqal:latest ./simulator-sqal`
3. Check backend has Docker socket access: `docker exec gaveurs_backend ls -la /var/run/docker.sock`

---

## 🎓 For Demos

### Demo Workflow

1. **Open Control Panel**: http://localhost:5174
2. **Click "Multi-Site Demo"** - Starts 4 simulators across 3 sites
3. **Monitor in real-time** - Dashboard refreshes every 5 seconds
4. **Open SQAL Dashboard**: http://localhost:5173 - See sensor data
5. **Stop All** - Click "Stop All" button when demo is done

### Demo Script (5 minutes)

```
00:00 - Open Control Panel
00:30 - Explain dashboard (stats, scenarios, simulators table)
01:00 - Click "Multi-Site Demo" scenario
01:30 - Show 4 simulators starting (status changes to "running")
02:00 - Switch to SQAL Dashboard (show sensor data flowing)
03:00 - Back to Control Panel (show uptime counting)
04:00 - Click individual "Stop" on ESP32_LL_01
04:30 - Click "Stop All" to stop remaining simulators
05:00 - Q&A
```

---

## 📦 Dependencies

### Runtime
- **react** `^18.2.0` - UI library
- **react-dom** `^18.2.0` - DOM rendering
- **axios** `^1.6.7` - HTTP client
- **lucide-react** `^0.323.0` - Icons
- **tailwindcss** `^3.4.1` - CSS framework

### Dev
- **vite** `^5.1.0` - Build tool
- **typescript** `^5.3.3` - Type safety
- **@vitejs/plugin-react** `^4.2.1` - React plugin

---

## 📝 License

Proprietary - Système Gaveurs V3.0

## 👨‍💻 Author

Claude Code - 2026-01-06
