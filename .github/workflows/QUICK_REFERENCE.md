# GitHub Actions Quick Reference Card

## Workflow Triggers

| Branch | Trigger | Jobs Run | Deploy To |
|--------|---------|----------|-----------|
| `feature/*` | Push/PR | Lint, Test, Build | None |
| `develop` | Push | Lint, Test, Build, E2E | Staging |
| `main` | Push | Lint, Test, Build, E2E, Security | Production |

## Test Execution Times

| Job | Duration | Tests | Coverage |
|-----|----------|-------|----------|
| Backend Tests | ~8-12 min | 163 | 80% |
| SQAL Frontend | ~4-6 min | 104 | 60% |
| Euralis Frontend | ~4-6 min | 109 | 70% |
| Gaveurs Frontend | ~6-8 min | 263 | 60% |
| E2E Tests | ~8-10 min | 16+ | N/A |
| **TOTAL** | **~30-40 min** | **639+** | **70%** |

## Quick Commands

### Run Tests Locally (Same as CI)

```bash
# Backend
cd backend-api
export DATABASE_URL="postgresql://gaveurs_admin:gaveurs_test_password@localhost:5432/gaveurs_db_test"
pytest tests/ -v --cov=app --cov-fail-under=80

# Frontend SQAL
cd sqal
npm run test:coverage

# Frontend Euralis
cd euralis-frontend
npm run test:coverage

# Frontend Gaveurs
cd gaveurs-v3/gaveurs-ai-blockchain/frontend
npm run test:coverage

# E2E
cd tests
pytest e2e/ -v -m e2e
```

### Trigger Workflow Manually

```bash
# Using GitHub CLI
gh workflow run ci-cd.yml --ref develop

# Or via GitHub UI
# Actions → CI/CD Pipeline → Run workflow → Select branch → Run
```

### Check Workflow Status

```bash
# List workflow runs
gh run list --workflow=ci-cd.yml

# View specific run
gh run view <run-id>

# View logs
gh run view <run-id> --log

# Watch run in real-time
gh run watch <run-id>
```

### Download Artifacts

```bash
# List artifacts
gh run view <run-id> --artifacts

# Download specific artifact
gh run download <run-id> -n backend-coverage-report

# Download all artifacts
gh run download <run-id>
```

## Common Workflow Patterns

### Feature Development

```bash
# 1. Create feature branch
git checkout -b feature/my-feature

# 2. Make changes and commit
git add .
git commit -m "feat: Add new feature"

# 3. Push (triggers CI)
git push -u origin feature/my-feature

# 4. Check CI status
gh pr checks

# 5. Create PR when CI passes
gh pr create --base develop --title "feat: Add new feature"
```

### Hotfix Production

```bash
# 1. Create hotfix branch from main
git checkout main
git pull
git checkout -b hotfix/critical-bug

# 2. Fix and commit
git add .
git commit -m "fix: Resolve critical bug"

# 3. Push and create PR to main
git push -u origin hotfix/critical-bug
gh pr create --base main --title "fix: Resolve critical bug"

# 4. After approval, merge will auto-deploy to production
```

### Deploy to Staging

```bash
# 1. Merge feature to develop
git checkout develop
git pull
git merge feature/my-feature

# 2. Push to trigger staging deployment
git push origin develop

# 3. Monitor deployment
gh run watch

# 4. Verify in staging
curl https://staging-api.euralis-gaveurs.com/health
```

### Deploy to Production

```bash
# 1. Create PR from develop to main
gh pr create --base main --head develop --title "Release: Deploy to production"

# 2. Request approvals (requires 2 reviewers)

# 3. After approval, merge triggers production deployment

# 4. Approve deployment in GitHub UI (manual approval required)

# 5. Monitor deployment
gh run watch

# 6. Verify in production
curl https://api.euralis-gaveurs.com/health
```

## CI/CD Status Checks

### Required Checks (Before Merge)

- ✅ `lint-and-typecheck` - All 4 components
- ✅ `test-backend` - 163 tests passing
- ✅ `test-frontends (SQAL)` - 104 tests passing
- ✅ `test-frontends (Euralis)` - 109 tests passing
- ✅ `test-frontends (Gaveurs)` - 263 tests passing
- ✅ `test-e2e` - E2E + WebSocket tests passing
- ✅ `build-backend` - Docker build successful
- ✅ `build-frontends (euralis)` - Docker build successful
- ✅ `build-frontends (gaveurs)` - Docker build successful
- ✅ `build-frontends (sqal)` - Docker build successful
- ✅ `security-scan` - No critical vulnerabilities

### Bypassing Checks (Admin Only)

**⚠️ NOT RECOMMENDED**

Use only for emergency hotfixes:
1. Settings → Branches → Edit rule
2. Temporarily disable "Require status checks"
3. Merge PR
4. Re-enable checks immediately

## Secrets Management

### View Configured Secrets

```bash
# List repository secrets (names only, not values)
gh secret list

# List environment secrets
gh secret list --env staging
gh secret list --env production
```

### Add/Update Secrets

```bash
# Add repository secret
gh secret set AWS_ACCESS_KEY_ID

# Add environment secret
gh secret set AWS_ACCESS_KEY_ID --env production

# Set from file
gh secret set AWS_SECRET_ACCESS_KEY < secret.txt

# Set inline
echo "my-secret-value" | gh secret set MY_SECRET
```

### Required Secrets Checklist

**Repository Secrets:**
- [ ] `AWS_ACCESS_KEY_ID`
- [ ] `AWS_SECRET_ACCESS_KEY`
- [ ] `AWS_REGION`
- [ ] `SLACK_WEBHOOK_URL` (optional)
- [ ] `DISCORD_WEBHOOK_URL` (optional)
- [ ] `SNYK_TOKEN` (optional)

**Environment Secrets (Staging):**
- [ ] `AWS_ACCESS_KEY_ID`
- [ ] `AWS_SECRET_ACCESS_KEY`
- [ ] `AWS_REGION`

**Environment Secrets (Production):**
- [ ] `AWS_ACCESS_KEY_ID`
- [ ] `AWS_SECRET_ACCESS_KEY`
- [ ] `AWS_REGION`

## Debugging Failed Workflows

### Check Logs

```bash
# View failed run
gh run view <run-id>

# View specific job logs
gh run view <run-id> --job <job-id> --log

# Download logs
gh run view <run-id> --log > workflow.log
```

### Enable Debug Logging

```bash
# Add repository secrets
gh secret set ACTIONS_RUNNER_DEBUG --body "true"
gh secret set ACTIONS_STEP_DEBUG --body "true"

# Re-run workflow
gh run rerun <run-id>

# Remove debug secrets after debugging
gh secret remove ACTIONS_RUNNER_DEBUG
gh secret remove ACTIONS_STEP_DEBUG
```

### Common Failure Reasons

| Error | Cause | Solution |
|-------|-------|----------|
| `Tests failed` | Broken code | Fix tests locally first |
| `Coverage below threshold` | Insufficient tests | Add tests to new code |
| `Docker build timeout` | Large dependencies | Increase timeout or optimize |
| `AWS deployment failed` | Bad credentials | Verify AWS secrets |
| `Secret not found` | Missing secret | Add secret in Settings |
| `Permission denied` | GITHUB_TOKEN lacks perms | Check workflow permissions |

## Coverage Reports

### View Coverage

```bash
# After workflow completes, download coverage report
gh run download <run-id> -n backend-coverage-report

# Open HTML report
cd htmlcov
open index.html  # macOS
xdg-open index.html  # Linux
start index.html  # Windows
```

### Coverage Thresholds

| Component | Threshold | Current |
|-----------|-----------|---------|
| Backend | 80% | ~85% |
| Frontend SQAL | 60% | ~65% |
| Frontend Euralis | 70% | ~75% |
| Frontend Gaveurs | 60% | ~68% |

### View on Codecov

```
https://codecov.io/gh/YOUR_USERNAME/projet-euralis-gaveurs
```

## Docker Images

### View Built Images

```bash
# List packages in GitHub Container Registry
gh api /user/packages?package_type=container

# View specific image tags
gh api /user/packages/container/projet-euralis-gaveurs-backend/versions
```

### Pull Images Locally

```bash
# Login to GHCR
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Pull backend image
docker pull ghcr.io/USERNAME/projet-euralis-gaveurs/backend:latest

# Pull frontend images
docker pull ghcr.io/USERNAME/projet-euralis-gaveurs/frontend-euralis:latest
docker pull ghcr.io/USERNAME/projet-euralis-gaveurs/frontend-gaveurs:latest
docker pull ghcr.io/USERNAME/projet-euralis-gaveurs/frontend-sqal:latest
```

### Run Images Locally

```bash
# Run backend
docker run -p 8000:8000 \
  -e DATABASE_URL="postgresql://..." \
  ghcr.io/USERNAME/projet-euralis-gaveurs/backend:latest

# Run frontend
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_API_URL="http://localhost:8000" \
  ghcr.io/USERNAME/projet-euralis-gaveurs/frontend-euralis:latest
```

## Notifications

### Slack

**Channel:** `#deployments`

**Notifications:**
- ✅ Staging deployment success/failure
- ✅ Production deployment success/failure
- ❌ Test failures (optional)

### Discord

**Channel:** `#ci-cd`

**Notifications:**
- Pipeline status (success/failure)
- Test results summary
- Coverage changes

## Performance Tips

### Speed Up CI

```bash
# Use cached dependencies
# Already enabled in workflow with:
# - actions/cache for npm
# - actions/cache for pip
# - docker build cache

# Run tests in parallel
# Already enabled with matrix strategy

# Skip CI for docs-only changes
git commit -m "docs: Update README [skip ci]"
```

### Reduce Costs

```bash
# Cancel redundant workflow runs
gh run cancel <run-id>

# Cancel all runs for a PR
gh run list --branch feature/my-feature --json databaseId --jq '.[].databaseId' | xargs -I {} gh run cancel {}
```

## Monitoring

### Workflow Run History

```bash
# View last 10 runs
gh run list --limit 10

# View runs for specific branch
gh run list --branch main

# View runs by status
gh run list --status failure
```

### Deployment History

```bash
# View production deployments
gh run list --workflow=ci-cd.yml --branch main --limit 20
```

### Resource Usage

```bash
# View workflow usage (minutes)
gh api /repos/OWNER/REPO/actions/workflows/ci-cd.yml/timing
```

## Emergency Procedures

### Rollback Production

```bash
# 1. Identify last good deployment
gh run list --branch main --status success --limit 5

# 2. Checkout previous version
git checkout <previous-commit-sha>

# 3. Create rollback branch
git checkout -b hotfix/rollback

# 4. Force push to main (bypass protection)
# ⚠️ Requires admin access - use with extreme caution
git push origin hotfix/rollback:main --force

# Alternative: Revert commit
git revert <bad-commit-sha>
git push origin main
```

### Stop Running Deployment

```bash
# List running workflows
gh run list --status in_progress

# Cancel specific run
gh run cancel <run-id>
```

### Database Recovery

```bash
# List RDS snapshots
aws rds describe-db-snapshots \
  --db-instance-identifier euralis-gaveurs-prod

# Restore from snapshot (created before each deploy)
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier euralis-gaveurs-prod-restored \
  --db-snapshot-identifier pre-deploy-<run-id>
```

## Best Practices Checklist

### Before Committing

- [ ] Run tests locally
- [ ] Check code coverage
- [ ] Run linter
- [ ] Update documentation if needed
- [ ] Write meaningful commit message

### Before Creating PR

- [ ] Rebase on target branch
- [ ] Resolve conflicts
- [ ] Verify CI passes on your branch
- [ ] Add PR description with testing notes

### Before Merging

- [ ] All CI checks pass
- [ ] Required approvals received
- [ ] Conversations resolved
- [ ] Staging tested (for develop branch)

### After Merging

- [ ] Monitor deployment
- [ ] Verify health checks
- [ ] Run smoke tests
- [ ] Update release notes

## Useful Links

- **GitHub Actions Docs:** https://docs.github.com/actions
- **Workflow Runs:** https://github.com/OWNER/REPO/actions/workflows/ci-cd.yml
- **Secrets:** https://github.com/OWNER/REPO/settings/secrets/actions
- **Environments:** https://github.com/OWNER/REPO/settings/environments
- **Codecov:** https://codecov.io/gh/OWNER/REPO
- **Container Registry:** https://github.com/OWNER/REPO/pkgs/container/projet-euralis-gaveurs

## Support

**Questions?**
- Check `.github/workflows/README.md` for detailed documentation
- Review `documentation/GITHUB_ACTIONS_SETUP.md` for setup guide
- Create issue with label `ci/cd`
- Contact DevOps team

## Cheat Sheet

```bash
# Common Commands
gh workflow run ci-cd.yml          # Trigger workflow
gh run list                        # List runs
gh run view <run-id>               # View run details
gh run watch <run-id>              # Watch run live
gh run rerun <run-id>              # Rerun workflow
gh run cancel <run-id>             # Cancel workflow
gh run download <run-id>           # Download artifacts

# Secret Management
gh secret list                     # List secrets
gh secret set NAME                 # Add secret
gh secret remove NAME              # Remove secret

# PR Workflow
gh pr create                       # Create PR
gh pr checks                       # View PR checks
gh pr merge                        # Merge PR

# Logs
gh run view <run-id> --log         # View logs
gh run view <run-id> --log > out   # Save logs
```

---

**Last Updated:** 2025-01-XX
**Workflow Version:** 1.0.0
**Total Tests:** 639+
**Average CI Time:** 30-40 minutes
