# CI/CD Deployment Checklist

## Pre-Deployment Checklist

Use this checklist to ensure proper CI/CD setup before going live.

### 1. Repository Setup

#### GitHub Settings
- [ ] Repository created on GitHub
- [ ] Admin access confirmed
- [ ] GitHub Actions enabled
  - Settings → Actions → General → Allow all actions
  - Settings → Actions → General → Read and write permissions
- [ ] GitHub Container Registry (GHCR) enabled
  - Settings → Packages → Enable package creation
- [ ] Branch protection rules configured
  - Main branch: 2 required reviewers, all checks required
  - Develop branch: 1 required reviewer, all checks required

### 2. Secrets Configuration

#### Repository Secrets (Settings → Secrets and variables → Actions)

**Required:**
- [ ] `AWS_ACCESS_KEY_ID` - AWS IAM access key
- [ ] `AWS_SECRET_ACCESS_KEY` - AWS IAM secret key
- [ ] `AWS_REGION` - AWS region (e.g., `eu-west-1`)

**Optional:**
- [ ] `SLACK_WEBHOOK_URL` - Slack notification webhook
- [ ] `DISCORD_WEBHOOK_URL` - Discord notification webhook
- [ ] `SNYK_TOKEN` - Snyk security scanning API token
- [ ] `CODECOV_TOKEN` - Codecov upload token (optional for public repos)

#### Verify Secrets
```bash
# List configured secrets (names only)
gh secret list

# Expected output:
# AWS_ACCESS_KEY_ID
# AWS_SECRET_ACCESS_KEY
# AWS_REGION
# SLACK_WEBHOOK_URL
# DISCORD_WEBHOOK_URL
```

### 3. Environment Configuration

#### Staging Environment (Settings → Environments → New environment)

**Configuration:**
- [ ] Name: `staging`
- [ ] URL: `https://staging.euralis-gaveurs.com`
- [ ] Protection rules:
  - [ ] Required reviewers: 0 or 1 (optional)
  - [ ] Wait timer: 0 minutes
  - [ ] Deployment branches: All branches
- [ ] Environment secrets:
  - [ ] `AWS_ACCESS_KEY_ID` (staging credentials)
  - [ ] `AWS_SECRET_ACCESS_KEY` (staging credentials)
  - [ ] `AWS_REGION`

#### Production Environment

**Configuration:**
- [ ] Name: `production`
- [ ] URL: `https://euralis-gaveurs.com`
- [ ] Protection rules:
  - [ ] Required reviewers: 2 (recommended)
  - [ ] Wait timer: 5 minutes
  - [ ] Deployment branches: Selected branches only → `main`
- [ ] Environment secrets:
  - [ ] `AWS_ACCESS_KEY_ID` (production credentials)
  - [ ] `AWS_SECRET_ACCESS_KEY` (production credentials)
  - [ ] `AWS_REGION`

### 4. AWS Infrastructure

#### IAM User Setup
- [ ] IAM user created: `github-actions-deploy`
- [ ] Policies attached:
  - [ ] `AmazonECS_FullAccess`
  - [ ] `AmazonEC2ContainerRegistryFullAccess`
  - [ ] `AmazonRDSFullAccess` (for backups)
- [ ] Access keys created and stored in GitHub Secrets

#### ECS Clusters
- [ ] Staging cluster created: `euralis-gaveurs-staging`
- [ ] Production cluster created: `euralis-gaveurs-production`

#### ECS Services (per environment)
- [ ] Backend service: `backend-service`
- [ ] Frontend Euralis service: `frontend-euralis-service`
- [ ] Frontend Gaveurs service: `frontend-gaveurs-service`
- [ ] Frontend SQAL service: `frontend-sqal-service`

#### RDS Database
- [ ] Staging database: `euralis-gaveurs-staging`
- [ ] Production database: `euralis-gaveurs-prod`
- [ ] Automated backups enabled
- [ ] Security groups configured

#### VPC & Networking
- [ ] VPC created
- [ ] Public and private subnets configured
- [ ] Internet gateway attached
- [ ] Security groups allow:
  - [ ] Backend → Database (port 5432)
  - [ ] Backend → Redis (port 6379)
  - [ ] Load balancer → Backend (port 8000)
  - [ ] Internet → Load balancer (ports 80, 443)

### 5. Notification Setup (Optional)

#### Slack Integration
- [ ] Slack app created: `GitHub Actions - Euralis Gaveurs`
- [ ] Incoming webhook enabled
- [ ] Channel selected: `#deployments`
- [ ] Webhook URL stored in GitHub Secret: `SLACK_WEBHOOK_URL`
- [ ] Test message sent successfully

#### Discord Integration
- [ ] Discord webhook created in channel: `#ci-cd`
- [ ] Webhook URL stored in GitHub Secret: `DISCORD_WEBHOOK_URL`
- [ ] Test message sent successfully

### 6. External Services (Optional)

#### Codecov
- [ ] Repository added to Codecov
- [ ] Upload token obtained (if private repo)
- [ ] Token stored in GitHub Secret: `CODECOV_TOKEN`
- [ ] Badge URL generated

#### Snyk Security
- [ ] Snyk account created
- [ ] Repository integrated
- [ ] API token obtained
- [ ] Token stored in GitHub Secret: `SNYK_TOKEN`
- [ ] Vulnerability thresholds configured

### 7. Local Testing

#### Test Prerequisites
- [ ] Docker installed
- [ ] Docker Compose installed
- [ ] GitHub CLI installed (`gh`)
- [ ] Node.js 18+ installed
- [ ] Python 3.11 installed

#### Run Tests Locally
```bash
# Backend tests
cd backend-api
export DATABASE_URL="postgresql://gaveurs_admin:gaveurs_test_password@localhost:5432/gaveurs_db_test"
pytest tests/ -v --cov=app --cov-fail-under=80

# Frontend SQAL tests
cd sqal
npm ci
npm run test:coverage

# Frontend Euralis tests
cd euralis-frontend
npm ci
npm run test:coverage

# Frontend Gaveurs tests
cd gaveurs-v3/gaveurs-ai-blockchain/frontend
npm ci
npm run test:coverage
```

**Verification:**
- [ ] All backend tests pass (163+)
- [ ] All frontend SQAL tests pass (104+)
- [ ] All frontend Euralis tests pass (109+)
- [ ] All frontend Gaveurs tests pass (263+)
- [ ] Coverage thresholds met

### 8. Initial Workflow Test

#### Test Branch
```bash
# Create test branch
git checkout -b test/ci-cd-setup

# Make small change
echo "# CI/CD Test" >> README.md

# Commit and push
git add README.md
git commit -m "test: CI/CD pipeline setup"
git push -u origin test/ci-cd-setup
```

#### Monitor Workflow
- [ ] Workflow appears in Actions tab
- [ ] All jobs start successfully
- [ ] Linting jobs complete
- [ ] Backend tests complete
- [ ] Frontend tests complete (all 3)
- [ ] Builds complete
- [ ] Security scan completes
- [ ] No deployment triggered (feature branch)

#### Check Results
- [ ] All checks passed (green checkmarks)
- [ ] Coverage reports uploaded
- [ ] Artifacts available
- [ ] No secrets exposed in logs

### 9. Staging Deployment Test

#### Merge to Develop
```bash
git checkout develop
git pull
git merge test/ci-cd-setup
git push origin develop
```

#### Monitor Staging Deployment
- [ ] Workflow triggered automatically
- [ ] All tests pass
- [ ] Builds complete
- [ ] Deployment to staging starts
- [ ] ECS services updated
- [ ] Health checks pass
- [ ] Smoke tests complete

#### Verify Staging
- [ ] Backend health: `curl https://staging-api.euralis-gaveurs.com/health`
- [ ] Frontend Euralis accessible: `https://staging.euralis-gaveurs.com`
- [ ] Frontend Gaveurs accessible: `https://staging-gaveurs.euralis-gaveurs.com`
- [ ] Frontend SQAL accessible: `https://staging-sqal.euralis-gaveurs.com`
- [ ] Database connectivity working
- [ ] WebSocket connections working

#### Check Notifications
- [ ] Slack notification received (if configured)
- [ ] Discord notification received (if configured)
- [ ] Email notification received (GitHub default)

### 10. Production Deployment Test

#### Create Production PR
```bash
git checkout main
git pull
gh pr create --base main --head develop --title "Deploy to production"
```

#### Pre-Merge Verification
- [ ] All CI checks pass on PR
- [ ] 2 reviewers approved
- [ ] All conversations resolved
- [ ] No merge conflicts

#### Merge and Monitor
- [ ] PR merged to main
- [ ] Workflow triggered
- [ ] All tests pass
- [ ] Builds complete
- [ ] Security scan passes
- [ ] Database backup created
- [ ] Deployment approval requested

#### Approve Deployment
- [ ] Navigate to Actions → Workflow run
- [ ] Click "Review deployments"
- [ ] Select "production"
- [ ] Click "Approve and deploy"

#### Verify Production
- [ ] Backend health: `curl https://api.euralis-gaveurs.com/health`
- [ ] Frontend Euralis accessible: `https://euralis-gaveurs.com`
- [ ] Frontend Gaveurs accessible: `https://gaveurs.euralis-gaveurs.com`
- [ ] Frontend SQAL accessible: `https://sqal.euralis-gaveurs.com`
- [ ] All functionalities working
- [ ] Performance acceptable
- [ ] No errors in logs

#### Post-Deployment
- [ ] GitHub release created
- [ ] Release notes accurate
- [ ] Slack notification received
- [ ] Discord notification received
- [ ] Monitoring dashboards updated

### 11. Rollback Test

#### Test Rollback Procedure
```bash
# Identify last good deployment
gh run list --branch main --status success --limit 5

# Revert to previous commit
git revert HEAD
git push origin main
```

#### Verify Rollback
- [ ] Workflow triggered
- [ ] Deployment successful
- [ ] Previous version restored
- [ ] Application functioning correctly

### 12. Documentation

#### Update Project Documentation
- [ ] README.md updated with CI/CD badges
- [ ] CONTRIBUTING.md updated with workflow information
- [ ] CLAUDE.md updated (if needed)
- [ ] API documentation updated (if needed)

#### CI/CD Documentation
- [ ] `.github/workflows/README.md` reviewed
- [ ] `documentation/GITHUB_ACTIONS_SETUP.md` reviewed
- [ ] `.github/workflows/QUICK_REFERENCE.md` reviewed
- [ ] `CICD_IMPLEMENTATION_SUMMARY.md` reviewed
- [ ] Team members trained on workflow usage

### 13. Monitoring Setup

#### GitHub Actions Monitoring
- [ ] Actions tab bookmarked
- [ ] Workflow run notifications enabled
- [ ] Failed workflow email notifications confirmed

#### Application Monitoring
- [ ] CloudWatch dashboards created
- [ ] CloudWatch alarms configured:
  - [ ] ECS service health
  - [ ] RDS connection count
  - [ ] Application errors
  - [ ] Response times
- [ ] Log aggregation configured

#### Cost Monitoring
- [ ] AWS Cost Explorer configured
- [ ] Budget alerts set up
- [ ] GitHub Actions usage tracked

### 14. Security Audit

#### Secrets Audit
- [ ] All secrets stored in GitHub Secrets (not hardcoded)
- [ ] No secrets in workflow files
- [ ] No secrets in logs
- [ ] Secret rotation schedule defined (90 days)

#### Access Control
- [ ] Team members have appropriate permissions
- [ ] Production environment restricted to authorized users
- [ ] Deployment approvals required
- [ ] Audit logs enabled

#### Vulnerability Management
- [ ] Security scanning enabled
- [ ] SARIF upload confirmed
- [ ] GitHub Security tab configured
- [ ] Vulnerability response process defined

### 15. Performance Optimization

#### Workflow Performance
- [ ] Caching enabled for npm dependencies
- [ ] Caching enabled for pip dependencies
- [ ] Caching enabled for Docker layers
- [ ] Matrix strategies used for parallel execution
- [ ] Timeouts configured appropriately

#### Benchmark Results
- [ ] Feature branch CI time: ~20-30 minutes
- [ ] Staging deployment time: ~30-45 minutes
- [ ] Production deployment time: ~40-60 minutes
- [ ] Cache hit rate > 80%

### 16. Team Training

#### Developer Training
- [ ] Workflow overview presented
- [ ] Branch strategy explained
- [ ] PR process documented
- [ ] Troubleshooting guide reviewed
- [ ] Quick reference distributed

#### DevOps Training
- [ ] Deployment process documented
- [ ] Rollback procedure practiced
- [ ] Monitoring setup explained
- [ ] Secret rotation process defined
- [ ] Incident response plan created

### 17. Disaster Recovery

#### Backup Strategy
- [ ] Database backups automated (before each production deploy)
- [ ] ECS task definitions versioned
- [ ] Docker images tagged and retained
- [ ] Configuration backed up

#### Recovery Procedures
- [ ] Database restore procedure documented
- [ ] Service restore procedure documented
- [ ] Rollback procedure documented
- [ ] Emergency contact list created

### 18. Compliance & Governance

#### Compliance Requirements
- [ ] Audit logs retained (GitHub Actions logs: 90 days)
- [ ] Deployment approvals documented
- [ ] Change management process defined
- [ ] Security scanning results archived

#### Governance
- [ ] CI/CD ownership assigned
- [ ] Workflow maintenance schedule defined
- [ ] Review cadence established (monthly)
- [ ] Continuous improvement process defined

## Post-Deployment Checklist

### Day 1
- [ ] Monitor first production deployment
- [ ] Check all services healthy
- [ ] Review logs for errors
- [ ] Verify notifications working
- [ ] Document any issues

### Week 1
- [ ] Monitor workflow performance
- [ ] Review test coverage trends
- [ ] Check AWS costs
- [ ] Gather team feedback
- [ ] Address any pain points

### Month 1
- [ ] Review workflow metrics
- [ ] Analyze deployment frequency
- [ ] Audit security scans
- [ ] Update documentation
- [ ] Plan optimizations

### Quarterly
- [ ] Rotate secrets
- [ ] Update dependencies
- [ ] Review and optimize workflows
- [ ] Team retrospective
- [ ] Update training materials

## Success Criteria

### Technical Success
- [ ] All 639+ tests passing consistently
- [ ] Code coverage maintained > 70%
- [ ] Zero critical vulnerabilities
- [ ] Deployment success rate > 99%
- [ ] Average deployment time < 45 minutes

### Business Success
- [ ] Reduced time-to-production
- [ ] Increased deployment frequency
- [ ] Improved code quality
- [ ] Reduced manual errors
- [ ] Enhanced team productivity

### Team Success
- [ ] Developers confident in CI/CD process
- [ ] Clear understanding of workflow
- [ ] Efficient troubleshooting
- [ ] Positive feedback from team
- [ ] Reduced deployment stress

## Sign-off

Once all items are checked, obtain sign-off from:

- [ ] **Tech Lead:** _____________________ Date: _________
- [ ] **DevOps Lead:** ___________________ Date: _________
- [ ] **Security Lead:** _________________ Date: _________
- [ ] **Product Owner:** _________________ Date: _________

## Support Contacts

**GitHub Actions Issues:**
- Primary: [DevOps Team Email]
- Secondary: [Tech Lead Email]
- Emergency: [On-call Phone]

**AWS Issues:**
- Primary: [AWS Administrator Email]
- Secondary: [DevOps Team Email]
- AWS Support: [Support Plan Details]

**Application Issues:**
- Primary: [Development Team Email]
- Secondary: [Tech Lead Email]
- On-call: [Rotation Schedule]

## Resources

- **Main Workflow:** `.github/workflows/ci-cd.yml`
- **Documentation:** `.github/workflows/README.md`
- **Setup Guide:** `documentation/GITHUB_ACTIONS_SETUP.md`
- **Quick Reference:** `.github/workflows/QUICK_REFERENCE.md`
- **Implementation Summary:** `CICD_IMPLEMENTATION_SUMMARY.md`

---

**Checklist Version:** 1.0.0
**Last Updated:** 2025-01-XX
**Next Review:** [Date 3 months from deployment]
