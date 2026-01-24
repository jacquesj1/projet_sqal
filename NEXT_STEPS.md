# 🎯 Prochaines Étapes - Euralis Multi-Sites

Roadmap pour passer de **Phase 1 (Complète)** à **Production Complète**.

---

## ✅ Phase 1 - TERMINÉE (14 Décembre 2024)

- ✅ Backend partagé opérationnel
- ✅ 12 Tables TimescaleDB (2 hypertables)
- ✅ 15 Routes API Euralis
- ✅ 5 Modules IA/ML (PySR, Prophet, K-Means, Isolation Forest, Hongrois)
- ✅ 7 Pages Frontend complètes
- ✅ Simulateur de données réaliste
- ✅ Documentation exhaustive

---

## 🚀 Phase 2 - Intégration Données Réelles (Semaine 1-2)

### Backend

**1. Connecter API aux données réelles**

```python
# Endpoints à créer dans routers/euralis.py

@router.get("/gaveurs/performances")
async def get_gaveurs_performances(site_code: str = None):
    """Performance détaillée de tous les gaveurs"""
    # TODO: Implémenter requête SQL
    pass

@router.get("/qualite/analyse")
async def get_qualite_analyse(site_code: str = None):
    """Analyse qualité ITM/Sigma avec anomalies"""
    # TODO: Implémenter avec Isolation Forest
    pass

@router.get("/abattages/planning")
async def get_planning_abattages(date_debut: date, date_fin: date):
    """Planning abattages optimisé"""
    # TODO: Implémenter avec algorithme hongrois
    pass

@router.get("/finance/indicateurs")
async def get_finance_indicateurs():
    """Indicateurs financiers par site"""
    # TODO: Calculer revenus/coûts/marges
    pass
```

**2. Entraîner modèles IA/ML**

```bash
# Script à créer : scripts/train_ml_models.py

python scripts/train_ml_models.py

# Devrait :
# 1. Charger données lots_gavage
# 2. Entraîner PySR par site×souche
# 3. Entraîner Prophet pour prévisions
# 4. Calculer clusters K-Means
# 5. Détecter anomalies Isolation Forest
# 6. Sauvegarder résultats en DB
```

**Fichiers à créer** :

```python
# backend/scripts/train_ml_models.py (~200 lignes)
from app.ml.euralis.multi_site_regression import MultiSiteRegression
from app.ml.euralis.production_forecasting import ProductionForecaster
from app.ml.euralis.gaveur_clustering import GaveurClusterer
from app.ml.euralis.anomaly_detection import AnomalyDetector

async def main():
    # 1. Charger données
    df = await load_lots_data()

    # 2. PySR
    regression = MultiSiteRegression()
    models = regression.train_by_site_and_souche(df)
    await save_formules_pysr(models)

    # 3. Prophet
    forecaster = ProductionForecaster()
    for site in ['LL', 'LS', 'MT']:
        previsions = forecaster.forecast_site(df, site, horizons=[7, 30, 90])
        await save_previsions(previsions)

    # 4. K-Means
    clusterer = GaveurClusterer()
    clusters = clusterer.cluster_gaveurs(df)
    await save_clusters(clusters)

    # 5. Isolation Forest
    detector = AnomalyDetector()
    anomalies = detector.detect_lot_anomalies(df)
    await save_anomalies(anomalies)
```

**3. Tâches CRON pour rafraîchissements**

```bash
# /etc/cron.d/euralis ou Windows Task Scheduler

# Rafraîchir vue matérialisée (toutes les heures)
0 * * * * psql -U postgres -d gaveurs_db -c "SELECT refresh_performances_sites();"

# Réentraîner modèles (tous les jours à 2h)
0 2 * * * cd /path/to/backend && python scripts/train_ml_models.py

# Détecter nouvelles anomalies (toutes les 6h)
0 */6 * * * cd /path/to/backend && python scripts/detect_anomalies.py
```

### Frontend

**1. Remplacer données mockées**

Dans chaque page, remplacer :

```typescript
// AVANT (mockées)
const mockData = [...];
setData(mockData);

// APRÈS (API réelle)
const data = await euralisAPI.getGaveursPerformances();
setData(data);
```

**Fichiers à modifier** :
- `app/euralis/gaveurs/page.tsx` - Ligne ~30
- `app/euralis/previsions/page.tsx` - Ligne ~40
- `app/euralis/qualite/page.tsx` - Ligne ~35
- `app/euralis/abattages/page.tsx` - Ligne ~30
- `app/euralis/finance/page.tsx` - Ligne ~25

**2. Gestion d'erreurs robuste**

```typescript
// Ajouter dans chaque page
const [error, setError] = useState<string | null>(null);

try {
  const data = await euralisAPI.getData();
  setData(data);
} catch (err) {
  setError("Erreur chargement données");
  console.error(err);
}

// Afficher erreur
{error && (
  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
    <p className="text-red-800">{error}</p>
  </div>
)}
```

**3. Loading states améliorés**

```typescript
// Remplacer loading simple par skeleton
{loading ? (
  <div className="space-y-4">
    <div className="h-32 bg-gray-200 animate-pulse rounded-lg" />
    <div className="h-64 bg-gray-200 animate-pulse rounded-lg" />
  </div>
) : (
  // Contenu réel
)}
```

---

## 🧪 Phase 3 - Tests & Qualité (Semaine 3)

### Backend Tests

**1. Tests unitaires (pytest)**

```bash
# Créer tests/
mkdir -p gaveurs-v3/gaveurs-ai-blockchain/backend/tests

# Structure
tests/
├── __init__.py
├── test_routes_euralis.py      # Tests 15 routes
├── test_ml_pysr.py              # Tests PySR
├── test_ml_prophet.py           # Tests Prophet
├── test_ml_kmeans.py            # Tests K-Means
├── test_ml_isolation.py         # Tests Isolation Forest
└── test_ml_hungarian.py         # Tests Hongrois
```

**Exemple test** :

```python
# tests/test_routes_euralis.py
import pytest
from httpx import AsyncClient
from app.main import app

@pytest.mark.asyncio
async def test_get_sites():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get("/api/euralis/sites")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3  # 3 sites
    assert data[0]["code"] in ["LL", "LS", "MT"]

@pytest.mark.asyncio
async def test_dashboard_kpis():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get("/api/euralis/dashboard/kpis")
    assert response.status_code == 200
    kpis = response.json()
    assert "production_totale_kg" in kpis
    assert "nb_lots_actifs" in kpis
```

**Lancer tests** :

```bash
cd gaveurs-v3/gaveurs-ai-blockchain/backend
pytest tests/ -v
```

### Frontend Tests

**1. Tests composants (Jest + React Testing Library)**

```bash
cd euralis-frontend
npm install --save-dev @testing-library/react @testing-library/jest-dom jest

# Créer tests
mkdir -p __tests__/components
mkdir -p __tests__/pages
```

**Exemple test** :

```typescript
// __tests__/components/KPICard.test.tsx
import { render, screen } from '@testing-library/react';
import { KPICard } from '@/components/euralis/kpis/KPICard';

describe('KPICard', () => {
  it('renders title and value', () => {
    render(
      <KPICard title="Production" value="1500 kg" color="blue" />
    );

    expect(screen.getByText('Production')).toBeInTheDocument();
    expect(screen.getByText('1500 kg')).toBeInTheDocument();
  });

  it('displays trend when provided', () => {
    render(
      <KPICard
        title="ITM"
        value="15.2 kg"
        trend={{ value: 5, direction: 'up' }}
      />
    );

    expect(screen.getByText(/5%/)).toBeInTheDocument();
  });
});
```

**2. Tests E2E (Playwright)**

```bash
npm install --save-dev @playwright/test

# Créer e2e/
mkdir -p e2e
```

**Exemple E2E** :

```typescript
// e2e/dashboard.spec.ts
import { test, expect } from '@playwright/test';

test('dashboard displays KPIs', async ({ page }) => {
  await page.goto('http://localhost:3000/euralis/dashboard');

  // Vérifier 4 KPIs
  await expect(page.getByText('Production Totale')).toBeVisible();
  await expect(page.getByText('Lots Actifs')).toBeVisible();
  await expect(page.getByText('Gaveurs Actifs')).toBeVisible();
  await expect(page.getByText('Alertes Critiques')).toBeVisible();

  // Vérifier graphique chargé
  await expect(page.locator('svg.recharts-surface')).toBeVisible();
});

test('navigation works', async ({ page }) => {
  await page.goto('http://localhost:3000/euralis/dashboard');

  // Cliquer sur "Sites"
  await page.click('text=Sites');
  await expect(page).toHaveURL(/\/euralis\/sites/);

  // Vérifier contenu page Sites
  await expect(page.getByText('Sites de Production')).toBeVisible();
});
```

---

## 🔐 Phase 4 - Authentification & Sécurité (Semaine 4)

### Backend

**1. JWT Authentication**

```bash
pip install python-jose[cryptography] passlib[bcrypt]
```

```python
# app/auth.py
from jose import JWTError, jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta

SECRET_KEY = "your-secret-key"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None
```

**2. Middleware Authorization**

```python
# app/dependencies.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = verify_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    return payload

# Utilisation dans routes
@router.get("/api/euralis/sites")
async def get_sites(user = Depends(get_current_user)):
    # user contient : {"user_id": 123, "role": "superviseur"}
    ...
```

**3. Rôles et Permissions**

```python
# app/models/user.py
from enum import Enum

class UserRole(str, Enum):
    GAVEUR = "gaveur"           # Accès limité à ses données
    SUPERVISEUR = "superviseur" # Accès complet Euralis
    ADMIN = "admin"             # Accès tout + config

# Vérification permission
def require_role(required_role: UserRole):
    def role_checker(user = Depends(get_current_user)):
        if user["role"] not in [required_role.value, UserRole.ADMIN.value]:
            raise HTTPException(status_code=403, detail="Permission denied")
        return user
    return role_checker

# Utilisation
@router.get("/api/euralis/dashboard/kpis")
async def get_kpis(user = Depends(require_role(UserRole.SUPERVISEUR))):
    ...
```

### Frontend

**1. Auth Context**

```typescript
// lib/auth/context.tsx
import { createContext, useContext, useState } from 'react';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const login = async (email: string, password: string) => {
    const response = await fetch('http://localhost:8000/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    setToken(data.access_token);
    setUser(data.user);
    localStorage.setItem('token', data.access_token);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext)!;
```

**2. Protected Routes**

```typescript
// components/ProtectedRoute.tsx
import { useAuth } from '@/lib/auth/context';
import { useRouter } from 'next/navigation';

export function ProtectedRoute({ children, requiredRole }) {
  const { user } = useAuth();
  const router = useRouter();

  if (!user) {
    router.push('/login');
    return null;
  }

  if (requiredRole && user.role !== requiredRole) {
    return <div>Accès refusé</div>;
  }

  return children;
}
```

---

## 📊 Phase 5 - Dashboards Avancés (Semaine 5-6)

### Fonctionnalités

**1. Filtres avancés**
- Période personnalisée (date picker)
- Multi-sélection sites/gaveurs
- Export résultats (CSV, Excel, PDF)

**2. Graphiques interactifs**
- Zoom/pan sur charts
- Tooltips détaillés
- Drill-down (clic sur barre → détails)

**3. Alertes en temps réel**
- WebSocket pour notifications live
- Son/notification navigateur
- Badge compteur alertes non lues

**4. Comparaisons**
- Période vs période (2024 vs 2023)
- Site vs site (LL vs LS vs MT)
- Gaveur vs moyenne

---

## 🚢 Phase 6 - Déploiement Production (Semaine 7)

### Infrastructure

**1. Docker Compose**

```yaml
# docker-compose.yml
version: '3.8'

services:
  db:
    image: timescale/timescaledb:latest-pg14
    environment:
      POSTGRES_DB: gaveurs_db
      POSTGRES_USER: gaveurs_user
      POSTGRES_PASSWORD: gaveurs_pass
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  backend:
    build: ./gaveurs-v3/gaveurs-ai-blockchain/backend
    environment:
      DATABASE_URL: postgresql://gaveurs_user:gaveurs_pass@db:5432/gaveurs_db
    ports:
      - "8000:8000"
    depends_on:
      - db

  frontend:
    build: ./euralis-frontend
    environment:
      NEXT_PUBLIC_API_URL: http://backend:8000
    ports:
      - "3000:3000"
    depends_on:
      - backend

volumes:
  postgres_data:
```

**2. CI/CD (GitHub Actions)**

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run backend tests
        run: |
          cd gaveurs-v3/gaveurs-ai-blockchain/backend
          pytest
      - name: Run frontend tests
        run: |
          cd euralis-frontend
          npm test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to production
        run: |
          docker-compose up -d --build
```

**3. Monitoring**

- **Sentry** : Erreurs backend/frontend
- **Prometheus + Grafana** : Métriques (CPU, RAM, requêtes/s)
- **Uptime Robot** : Disponibilité API

---

## 📅 Timeline Suggérée

| Phase | Durée | Objectif |
|-------|-------|----------|
| **Phase 1** | ✅ Complète | Backend + Frontend + Simulateur |
| **Phase 2** | 1-2 semaines | Données réelles + Entraînement ML |
| **Phase 3** | 1 semaine | Tests (unitaires, E2E) |
| **Phase 4** | 1 semaine | Auth + Sécurité |
| **Phase 5** | 1-2 semaines | Dashboards avancés |
| **Phase 6** | 1 semaine | Déploiement production |
| **TOTAL** | **6-8 semaines** | Production complète |

---

## ✅ Checklist Avant Production

### Backend
- [ ] Toutes routes API connectées à données réelles
- [ ] Modèles IA/ML entraînés et sauvegardés
- [ ] Tests unitaires (>80% couverture)
- [ ] Authentication/Authorization
- [ ] Logs structurés (Sentry)
- [ ] Rate limiting
- [ ] CORS configuré production
- [ ] Variables d'environnement sécurisées

### Frontend
- [ ] Données mockées remplacées par API
- [ ] Gestion erreurs robuste
- [ ] Loading states
- [ ] Tests E2E passent
- [ ] Auth intégrée
- [ ] Build optimisé (bundle < 500KB)
- [ ] SEO (meta tags)
- [ ] Analytics (Google Analytics, Plausible)

### Database
- [ ] Backup automatique quotidien
- [ ] Politiques rétention configurées
- [ ] Index optimisés
- [ ] Monitoring performances
- [ ] Alertes disque plein

### Infrastructure
- [ ] Docker images buildent
- [ ] CI/CD fonctionne
- [ ] HTTPS configuré
- [ ] Firewall configuré
- [ ] Monitoring actif
- [ ] Documentation déploiement

---

## 📞 Support Continu

Après déploiement :

1. **Monitoring quotidien** : Vérifier Grafana/Sentry
2. **Rafraîchissement ML** : Réentraîner modèles chaque semaine
3. **Backup vérification** : Restaurer backup test chaque mois
4. **Mises à jour** : Dépendances sécurité (Dependabot)
5. **Formation utilisateurs** : Sessions mensuelles

---

**Date** : 14 Décembre 2024
**Version** : 2.1.0
**Statut Phase 1** : ✅ COMPLÈTE
**Prochain Jalon** : Phase 2 - Intégration Données Réelles

🚀 **Prêt pour la Production !** 🚀
