FROM python:3.11-slim

# Métadonnées
LABEL maintainer="A Deep Adventure <contact@adeep.fr>"
LABEL description="Système Gaveurs V2.1 - Backend FastAPI avec IA et Blockchain"

# Variables d'environnement
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Répertoire de travail
WORKDIR /app

# Dépendances système pour compilations (PySR, cryptographie, etc.)
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

# Install Julia manually (required for PySR)
# Using juliaup for simplified installation
RUN curl -fsSL https://install.julialang.org | sh -s -- -y
ENV PATH="/root/.juliaup/bin:${PATH}"

# Install Julia SymbolicRegression package for PySR
RUN julia -e 'using Pkg; Pkg.add("SymbolicRegression")'

# Copier requirements
COPY requirements.txt .

# Installer dépendances Python
RUN pip install --upgrade pip && \
    pip install -r requirements.txt

# Copier le code applicatif
COPY ./app /app/app

# Exposer le port
EXPOSE 8000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Commande de démarrage
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
