# CI/CD Pipeline Documentation

## Overview

This directory contains GitHub Actions workflows for the **Système Gaveurs V3.0** project. The CI/CD pipeline provides comprehensive automated testing, building, security scanning, and deployment for the complete intelligent duck fattening management system.

## Workflows

### `ci-cd.yml` - Main CI/CD Pipeline

The main workflow handles all aspects of continuous integration and deployment across all components of the system.

## Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     TRIGGER (Push/PR)                            │
└─────────────────────────────────────────────────────────────────┘
                              ║
                ┌─────────────╨────────────┐
                │                           │
         ┌──────▼──────┐            ┌──────▼──────┐
         │   Linting   │            │  Security   │
         │ & TypeCheck │            │   Scanning  │
         └──────┬──────┘            └─────────────┘
                │
    ┌───────────┴───────────┐
    │                       │
┌───▼────┐          ┌───────▼────────┐
│Backend │          │   Frontends    │
│ Tests  │          │  Tests (3x)    │
│163 test│          │ SQAL/Euralis/  │
└───┬────┘          │   Gaveurs      │
    │               └───────┬────────┘
    │                       │
    └───────────┬───────────┘
                │
         ┌──────▼──────┐
         │  E2E Tests  │
         │  + WebSocket│
         └──────┬──────┘
                │
    ┌───────────┴───────────┐
    │                       │
┌───▼────┐          ┌───────▼────────┐
│Backend │          │   Frontends    │
│ Build  │          │  Build (3x)    │
│ Docker │          │    Docker      │
└───┬────┘          └───────┬────────┘
    │                       │
    └───────────┬───────────┘
                │
         ┌──────▼──────┐
         │   Deploy    │
         │  Staging/   │
         │ Production  │
         └─────────────┘
```

## Jobs

### 1. Linting & Type Checking (`lint-and-typecheck`)

**Matrix Strategy:** Runs in parallel for all 4 components

- **Backend** (Python):
  - Black formatter
  - Flake8 linting
  - MyPy type checking

- **Frontends** (TypeScript/JavaScript):
  - ESLint
  - TypeScript type checking
  - Prettier formatting validation

**Timeout:** 10 minutes per component

### 2. Backend Tests (`test-backend`)

**Service Containers:**
- TimescaleDB (PostgreSQL 15)
- Redis 7

**Test Execution:**
1. Unit tests (fast, no external dependencies)
2. Integration tests (database + Redis)
3. Full test suite with coverage

**Coverage Requirements:**
- Minimum: 70%
- Reports: XML, HTML, Terminal
- Upload to Codecov

**Total Tests:** 163

**Timeout:** 30 minutes

### 3. Frontend Tests (`test-frontends`)

**Matrix Strategy:** Parallel execution for 3 frontends

| Frontend | Path | Tests | Coverage Threshold |
|----------|------|-------|-------------------|
| SQAL | `sqal/` | 104 | 60% |
| Euralis | `euralis-frontend/` | 109 | 70% |
| Gaveurs | `gaveurs-v3/gaveurs-ai-blockchain/frontend/` | 263 | 60% |

**Test Framework:** Jest + React Testing Library

**Features:**
- Coverage reporting
- Artifact upload
- Codecov integration

**Total Tests:** 476 across all frontends

**Timeout:** 20 minutes per frontend

### 4. E2E Tests (`test-e2e`)

**Requires:** Backend + Frontend tests passed

**Setup:**
- Start TimescaleDB + Redis
- Initialize database schema
- Generate test data
- Start backend server
- Health check validation

**Test Suites:**
1. E2E flow tests (complete user workflows)
2. WebSocket tests (real-time sensor data)

**Timeout:** 30 minutes

### 5. Build Backend (`build-backend`)

**Docker Image Build:**
- Multi-stage build optimization
- Layer caching with GitHub Actions cache
- Push to GitHub Container Registry (ghcr.io)

**Tags Generated:**
- `latest` (main branch only)
- Branch name (e.g., `develop`, `feature/xyz`)
- Git SHA (e.g., `develop-abc123`)
- Semantic version (if tagged)

**Build Args:**
- `BUILD_DATE`
- `VCS_REF`
- `VERSION`

**Timeout:** 30 minutes

### 6. Build Frontends (`build-frontends`)

**Matrix Strategy:** 3 Docker images built in parallel

| Frontend | Port | Image Name |
|----------|------|------------|
| Euralis | 3000 | `frontend-euralis` |
| Gaveurs | 3001 | `frontend-gaveurs` |
| SQAL | 5173 | `frontend-sqal` |

**Features:**
- Build-time environment variables
- GitHub Container Registry push
- Docker layer caching

**Timeout:** 20 minutes per frontend

### 7. Security Scanning (`security-scan`)

**Tools:**
- **Trivy**: Vulnerability scanning for Docker images and file systems
- **Snyk**: Python dependency security analysis
- **npm audit**: Frontend package vulnerabilities

**SARIF Upload:** Results uploaded to GitHub Security tab

**Severity Threshold:** HIGH and CRITICAL

**Timeout:** 15 minutes

### 8. Deploy to Staging (`deploy-staging`)

**Trigger:** Push to `develop` branch only

**Environment:**
- Name: `staging`
- URL: `https://staging.euralis-gaveurs.com`
- Manual approval required (GitHub Environment protection)

**Deployment Steps:**
1. Configure AWS credentials
2. Update ECS services (4 services)
3. Wait for stability
4. Run smoke tests
5. Notify via Slack

**Services Updated:**
- `backend-service`
- `frontend-euralis-service`
- `frontend-gaveurs-service`
- `frontend-sqal-service`

**Smoke Tests:**
- Backend health check
- Frontend accessibility

**Timeout:** 20 minutes

### 9. Deploy to Production (`deploy-production`)

**Trigger:** Push to `main` branch only

**Environment:**
- Name: `production`
- URL: `https://euralis-gaveurs.com`
- Manual approval required (GitHub Environment protection)

**Deployment Steps:**
1. Create pre-deployment database backup
2. Configure AWS credentials
3. Update ECS services (4 services)
4. Wait for stability
5. Run production smoke tests
6. Create GitHub release
7. Notify via Slack

**Smoke Tests:**
- `https://api.euralis-gaveurs.com/health`
- `https://euralis-gaveurs.com`
- `https://gaveurs.euralis-gaveurs.com`
- `https://sqal.euralis-gaveurs.com`

**Rollback:** Automatic rollback on failure

**Timeout:** 30 minutes

### 10. Notify Status (`notify-status`)

**Trigger:** Always runs after all jobs complete

**Notifications:**
- Slack webhook (configurable)
- Discord webhook (configurable)

**Status Reported:**
- Test results (Backend, Frontends, E2E)
- Build results
- Security scan results
- Deployment status

## Environment Variables

### Global

```yaml
PYTHON_VERSION: '3.11'
NODE_VERSION: '18.x'
POSTGRES_VERSION: '15'
REGISTRY: ghcr.io
```

### Per-Job

| Job | Environment Variables | Purpose |
|-----|---------------------|---------|
| `test-backend` | `DATABASE_URL`, `REDIS_URL`, `APP_ENV` | Database connection |
| `test-e2e` | `API_URL`, `WS_URL`, `DATABASE_URL` | Backend connectivity |
| `deploy-*` | AWS credentials | Deployment authentication |

## Secrets Required

### GitHub Secrets

Configure these in **Settings → Secrets and variables → Actions**:

#### Required for all environments:
- `GITHUB_TOKEN` (auto-provided)

#### AWS Deployment (Required for staging/production):
- `AWS_ACCESS_KEY_ID` - AWS access key
- `AWS_SECRET_ACCESS_KEY` - AWS secret key
- `AWS_REGION` - AWS region (e.g., `eu-west-1`)

#### Notifications (Optional):
- `SLACK_WEBHOOK_URL` - Slack webhook for notifications
- `DISCORD_WEBHOOK_URL` - Discord webhook for notifications

#### Security Scanning (Optional):
- `SNYK_TOKEN` - Snyk API token for security scanning

#### Frontend Build (Optional):
- `API_URL` - Production API URL (defaults to localhost)

## GitHub Environments

### Setup Environments

Create two environments in **Settings → Environments**:

#### 1. Staging
- **Name:** `staging`
- **URL:** `https://staging.euralis-gaveurs.com`
- **Protection rules:**
  - Required reviewers: 1 (optional)
  - Wait timer: 0 minutes
- **Secrets:**
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `AWS_REGION`

#### 2. Production
- **Name:** `production`
- **URL:** `https://euralis-gaveurs.com`
- **Protection rules:**
  - Required reviewers: 2 (recommended)
  - Wait timer: 5 minutes
  - Restrict to `main` branch only
- **Secrets:**
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `AWS_REGION`

## Triggers

### Automatic Triggers

```yaml
on:
  push:
    branches:
      - main          # Production deployment
      - develop       # Staging deployment
      - 'feature/**'  # Testing only
      - 'hotfix/**'   # Testing only
  pull_request:
    branches:
      - main          # Full CI before merge
      - develop       # Full CI before merge
```

### Manual Trigger

```yaml
workflow_dispatch: # Available in GitHub Actions UI
```

**How to trigger manually:**
1. Go to **Actions** tab
2. Select **CI/CD Pipeline**
3. Click **Run workflow**
4. Select branch
5. Click **Run workflow**

## Caching Strategy

### npm Dependencies

```yaml
- uses: actions/setup-node@v4
  with:
    cache: 'npm'
    cache-dependency-path: package-lock.json
```

**Cache Key:** Hash of `package-lock.json`

**Cache Location:** `~/.npm`

### pip Dependencies

```yaml
- uses: actions/setup-python@v5
  with:
    cache: 'pip'
    cache-dependency-path: requirements.txt
```

**Cache Key:** Hash of `requirements.txt`

**Cache Location:** `~/.cache/pip`

### Docker Layers

```yaml
- uses: docker/build-push-action@v5
  with:
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

**Cache Key:** Layer checksums

**Cache Location:** GitHub Actions cache

## Coverage Reports

### Backend Coverage

- **Tool:** pytest-cov
- **Threshold:** 80%
- **Formats:** XML, HTML, Terminal
- **Upload:** Codecov (flag: `backend`)
- **Artifact:** `backend-coverage-report`

### Frontend Coverage

- **Tool:** Jest coverage
- **Thresholds:**
  - SQAL: 60%
  - Euralis: 70%
  - Gaveurs: 60%
- **Upload:** Codecov (flags: `frontend-SQAL`, `frontend-Euralis`, `frontend-Gaveurs`)
- **Artifacts:** `SQAL-coverage-report`, `Euralis-coverage-report`, `Gaveurs-coverage-report`

## Artifacts

### Generated Artifacts

| Artifact Name | Job | Retention | Contents |
|---------------|-----|-----------|----------|
| `backend-coverage-report` | `test-backend` | 30 days | HTML coverage report |
| `{Frontend}-coverage-report` | `test-frontends` | 30 days | Jest coverage reports |
| `e2e-test-results` | `test-e2e` | 30 days | E2E test results |
| `backend-docker-metadata` | `build-backend` | 7 days | Dockerfile, requirements |

### Downloading Artifacts

1. Go to **Actions** tab
2. Select workflow run
3. Scroll to **Artifacts** section
4. Click artifact name to download

## Status Badges

Add these badges to your README.md:

### CI/CD Status

```markdown
![CI/CD Pipeline](https://github.com/YOUR_USERNAME/projet-euralis-gaveurs/actions/workflows/ci-cd.yml/badge.svg)
```

### Coverage

```markdown
[![codecov](https://codecov.io/gh/YOUR_USERNAME/projet-euralis-gaveurs/branch/main/graph/badge.svg)](https://codecov.io/gh/YOUR_USERNAME/projet-euralis-gaveurs)
```

## Troubleshooting

### Common Issues

#### 1. Tests Failing in CI but Passing Locally

**Cause:** Environment differences

**Solution:**
```bash
# Run tests with same environment as CI
export DATABASE_URL="postgresql://gaveurs_admin:gaveurs_test_password@localhost:5432/gaveurs_db_test"
export REDIS_URL="redis://localhost:6379"
export APP_ENV=test
pytest tests/ -v
```

#### 2. Docker Build Timeout

**Cause:** Large dependencies (Julia for PySR)

**Solution:**
- Increase timeout in workflow
- Use pre-built base image
- Optimize Dockerfile layers

#### 3. Coverage Threshold Not Met

**Cause:** New code without tests

**Solution:**
```bash
# Check coverage locally
pytest tests/ --cov=app --cov-report=html
open htmlcov/index.html
```

#### 4. Deployment Failing

**Cause:** AWS credentials expired or incorrect

**Solution:**
- Verify secrets in GitHub Settings
- Check AWS IAM permissions
- Review CloudWatch logs

#### 5. Julia Installation Failing

**Cause:** Network timeout or incompatible version

**Solution:**
- Use cached Julia installation
- Pin specific Julia version
- Consider removing PySR from CI builds

### Debugging Workflows

#### Enable Debug Logging

Add secrets to repository:
- `ACTIONS_RUNNER_DEBUG`: `true`
- `ACTIONS_STEP_DEBUG`: `true`

#### Re-run Failed Jobs

1. Go to **Actions** tab
2. Select failed workflow
3. Click **Re-run failed jobs**

#### SSH into Runner (Advanced)

Use `tmate` action for interactive debugging:

```yaml
- name: Setup tmate session
  uses: mxschmitt/action-tmate@v3
  if: failure()
```

## Performance Optimization

### Current Pipeline Duration

| Branch | Average Time |
|--------|-------------|
| `feature/*` | 15-20 minutes (tests + builds only) |
| `develop` | 25-30 minutes (includes staging deploy) |
| `main` | 35-45 minutes (includes production deploy) |

### Optimization Tips

1. **Use Matrix Strategy:** Already implemented for frontends
2. **Cache Dependencies:** Already implemented for npm/pip/Docker
3. **Fail Fast:** Set `fail-fast: true` in matrix (currently `false` for visibility)
4. **Conditional Jobs:** Skip builds on documentation-only changes
5. **Self-Hosted Runners:** Consider for faster builds (costs vs. time trade-off)

### Conditional Execution Example

```yaml
# Skip CI for documentation changes
on:
  push:
    paths-ignore:
      - '**.md'
      - 'docs/**'
```

## Best Practices

### 1. Branch Strategy

```
main (production)
  ↑
develop (staging)
  ↑
feature/* (CI only)
hotfix/* (CI only)
```

### 2. Commit Messages

Use conventional commits for automatic changelog:

```
feat: Add new ML model for prediction
fix: Resolve WebSocket connection issue
docs: Update API documentation
test: Add E2E tests for consumer feedback
chore: Update dependencies
```

### 3. Pull Request Workflow

1. Create feature branch
2. Push commits (triggers CI)
3. Create PR to `develop`
4. Review test results in PR checks
5. Merge to `develop` (triggers staging deploy)
6. Test in staging
7. Create PR from `develop` to `main`
8. Merge to `main` (triggers production deploy)

### 4. Environment Protection

Always require manual approval for production:

```yaml
environment:
  name: production
  url: https://euralis-gaveurs.com
```

GitHub will pause workflow and request approval.

## Monitoring

### GitHub Actions Dashboard

View real-time status:
1. Go to **Actions** tab
2. See workflow runs
3. Click run for detailed logs

### Codecov Dashboard

Track coverage trends:
- Visit `https://codecov.io/gh/YOUR_USERNAME/projet-euralis-gaveurs`
- View coverage graphs
- Compare branches

### Slack Notifications

Configure webhook in secrets to receive:
- Deployment success/failure
- Test failures
- Security alerts

### Discord Notifications

Alternative to Slack:
- Configure `DISCORD_WEBHOOK_URL`
- Automatic status updates

## Security Considerations

### 1. Secret Management

- Never commit secrets to repository
- Use GitHub Secrets for all sensitive data
- Rotate secrets regularly

### 2. Dependency Scanning

- Trivy scans Docker images
- Snyk scans Python packages
- npm audit scans JavaScript packages

### 3. SARIF Upload

Security results uploaded to GitHub Security tab:
1. Go to **Security** tab
2. Click **Code scanning alerts**
3. Review vulnerabilities

### 4. Container Registry

Images pushed to GitHub Container Registry:
- Private by default
- Access controlled by GitHub permissions
- Automatic scanning enabled

## Costs & Quotas

### GitHub Actions Quotas

**Free Tier (Public Repos):**
- Unlimited minutes
- 2,000 minutes/month (private repos)

**Pro/Team:**
- 3,000-50,000 minutes/month
- $0.008/minute for Linux runners

### Estimated Usage

| Workflow Type | Duration | Runs/Month | Total Minutes |
|--------------|----------|------------|---------------|
| Feature PR | 20 min | 50 | 1,000 min |
| Develop Push | 30 min | 20 | 600 min |
| Main Push | 45 min | 10 | 450 min |
| **Total** | | | **~2,050 min** |

**Note:** This fits within free tier for public repos.

### Cost Optimization

1. Use caching aggressively
2. Skip unnecessary jobs with conditions
3. Fail fast on test failures
4. Consider self-hosted runners for heavy workloads

## Maintenance

### Regular Tasks

#### Weekly
- Review failed workflow runs
- Check coverage trends
- Update dependencies if needed

#### Monthly
- Review security scan results
- Update GitHub Actions versions
- Clean up old artifacts
- Review and rotate secrets

#### Quarterly
- Audit workflow performance
- Update Node.js/Python versions
- Review and optimize build times
- Update documentation

## Support

### Getting Help

1. Check this documentation
2. Review workflow logs in GitHub Actions
3. Check `documentation/` folder in repository
4. Contact DevOps team

### Useful Links

- [GitHub Actions Documentation](https://docs.github.com/actions)
- [Docker Build Push Action](https://github.com/docker/build-push-action)
- [Codecov Documentation](https://docs.codecov.com)
- [AWS ECS Documentation](https://docs.aws.amazon.com/ecs/)

## Changelog

### Version 1.0.0 (2025-01-XX)

**Initial Release:**
- Complete CI/CD pipeline
- 639 total tests across all components
- Docker builds for all services
- Staging and production deployments
- Security scanning integration
- Notification system
- Coverage reporting
