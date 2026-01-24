# Docker Build Fix Summary

Date: 2025-12-22

## Problem

Running `docker-compose build backend` resulted in errors:
1. Files not found: `requirements.txt` and `./app`
2. Warning about obsolete `version` field
3. Invalid package `hashlib` in requirements.txt
4. Julia package not available in Debian Trixie repository

## Root Cause

The `docker-compose.yml` was pointing to incorrect paths. The actual backend code is in `gaveurs-v3/gaveurs-ai-blockchain/backend/`, not `./backend/`.

## Solutions Applied

### 1. Fixed docker-compose.yml paths

**Changed:**
```yaml
# OLD
backend:
  build:
    context: ./backend

timescaledb:
  volumes:
    - ./backend/scripts:/docker-entrypoint-initdb.d:ro

frontend-euralis:
  build:
    context: ./frontend

frontend-gaveurs:
  build:
    context: ./gaveurs
```

**To:**
```yaml
# NEW
backend:
  build:
    context: ./gaveurs-v3/gaveurs-ai-blockchain/backend

timescaledb:
  volumes:
    - ./gaveurs-v3/gaveurs-ai-blockchain/backend/scripts:/docker-entrypoint-initdb.d:ro

frontend-euralis:
  build:
    context: ./euralis-frontend

frontend-gaveurs:
  build:
    context: ./gaveurs-v3/gaveurs-ai-blockchain/frontend
```

Also removed obsolete `version: '3.8'` line (commented out).

### 2. Fixed requirements.txt

**File:** `gaveurs-v3/gaveurs-ai-blockchain/backend/requirements.txt`

**Changed:**
```python
# OLD
pycryptodome==3.20.0
hashlib  # ❌ This is a built-in Python module!

# NEW
pycryptodome==3.20.0
# hashlib is built-in to Python, no need to install
```

### 3. Created missing Dockerfiles

**Created:**
- `euralis-frontend/Dockerfile` - Next.js multi-stage build with standalone output
- `gaveurs-v3/gaveurs-ai-blockchain/frontend/Dockerfile` - Next.js multi-stage build with standalone output

Both use the recommended Next.js Docker pattern with:
- Multi-stage builds (deps → builder → runner)
- Standalone output mode
- Non-root user
- Optimized layer caching

### 4. Updated Next.js configurations

**Files:**
- `euralis-frontend/next.config.js`
- `gaveurs-v3/gaveurs-ai-blockchain/frontend/next.config.js`

**Added:**
```javascript
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',  // ✅ Required for Docker
  // ... rest of config
}
```

### 5. Fixed Julia installation in backend Dockerfile

**File:** `gaveurs-v3/gaveurs-ai-blockchain/backend/Dockerfile`

**Changed:**
```dockerfile
# OLD - Julia package not available in Debian Trixie
RUN apt-get update && apt-get install -y \
    ... \
    julia \  # ❌ Not available!
    ...

RUN julia -e 'using Pkg; Pkg.add("SymbolicRegression")'

# NEW - Install Julia using juliaup
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    gfortran \
    libopenblas-dev \
    liblapack-dev \
    git \
    curl \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Install Julia manually using juliaup
RUN curl -fsSL https://install.julialang.org | sh -s -- -y
ENV PATH="/root/.juliaup/bin:${PATH}"

# Install SymbolicRegression package for PySR
RUN julia -e 'using Pkg; Pkg.add("SymbolicRegression")'
```

## Testing

To test the fixes:

```bash
# Build all services
docker-compose build

# Build specific service
docker-compose build backend
docker-compose build frontend-euralis
docker-compose build frontend-gaveurs
docker-compose build frontend-sqal

# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Stop all
docker-compose down
```

## Services & Ports

After successful build and start:

| Service | Port | URL |
|---------|------|-----|
| TimescaleDB | 5432 | postgresql://gaveurs_admin:***@localhost:5432/gaveurs_db |
| Backend API | 8000 | http://localhost:8000 |
| API Docs | 8000 | http://localhost:8000/docs |
| Euralis Frontend | 3000 | http://localhost:3000 |
| Gaveurs Frontend | 3001 | http://localhost:3001 |
| SQAL Frontend | 5173 | http://localhost:5173 |

## Files Modified

1. ✅ `docker-compose.yml` - Fixed all paths
2. ✅ `gaveurs-v3/gaveurs-ai-blockchain/backend/requirements.txt` - Removed hashlib
3. ✅ `gaveurs-v3/gaveurs-ai-blockchain/backend/Dockerfile` - Fixed Julia installation
4. ✅ `euralis-frontend/next.config.js` - Added standalone output
5. ✅ `gaveurs-v3/gaveurs-ai-blockchain/frontend/next.config.js` - Added standalone output

## Files Created

1. ✅ `euralis-frontend/Dockerfile` - New
2. ✅ `gaveurs-v3/gaveurs-ai-blockchain/frontend/Dockerfile` - New
3. ✅ `DOCKER_FIX_SUMMARY.md` - This file

## Known Issues

### Julia Installation Time
The backend Docker build takes ~10-15 minutes due to:
- Installing Julia via juliaup
- Downloading Julia binaries
- Installing SymbolicRegression package

**Solution:** Be patient, this is normal for first build. Subsequent builds will be cached.

### Standalone Mode Requirement
Next.js frontends require `output: 'standalone'` in `next.config.js` for Docker deployment.

**Impact:**
- ✅ Smaller Docker images
- ✅ Faster container startup
- ⚠️ Requires copying `.next/standalone` in Dockerfile

## Next Steps

1. Wait for backend build to complete
2. Build frontend images
3. Test with `docker-compose up -d`
4. Verify all services are healthy
5. Run health check: `python scripts/health_check.py`

## References

- Next.js Docker docs: https://nextjs.org/docs/pages/building-your-application/deploying#docker-image
- Julia installation: https://github.com/JuliaLang/juliaup
- PySR documentation: https://github.com/MilesCranmer/PySR
