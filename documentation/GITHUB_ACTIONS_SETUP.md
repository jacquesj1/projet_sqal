# GitHub Actions Setup Guide

## Quick Start

This guide will help you set up GitHub Actions for the Euralis Gaveurs V3.0 project from scratch.

## Prerequisites

- GitHub repository (public or private)
- Admin access to repository settings
- AWS account (for deployment)
- Docker Hub or GitHub Container Registry account

## Step-by-Step Setup

### 1. Repository Setup

#### A. Enable GitHub Actions

1. Go to **Settings** → **Actions** → **General**
2. Under **Actions permissions**, select:
   - ✅ **Allow all actions and reusable workflows**
3. Under **Workflow permissions**, select:
   - ✅ **Read and write permissions**
   - ✅ **Allow GitHub Actions to create and approve pull requests**
4. Click **Save**

#### B. Enable GitHub Container Registry

1. Go to **Settings** → **Packages**
2. Enable **Package creation**
3. Set visibility to **Public** or **Private** as needed

### 2. Configure Secrets

#### Navigate to Secrets

**Settings** → **Secrets and variables** → **Actions** → **New repository secret**

#### Required Secrets

| Secret Name | Description | Example Value |
|-------------|-------------|---------------|
| `AWS_ACCESS_KEY_ID` | AWS IAM access key | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM secret key | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `AWS_REGION` | AWS deployment region | `eu-west-1` |

#### Optional Secrets

| Secret Name | Description | Example Value |
|-------------|-------------|---------------|
| `SLACK_WEBHOOK_URL` | Slack notification webhook | `https://hooks.slack.com/services/XXX/YYY/ZZZ` |
| `DISCORD_WEBHOOK_URL` | Discord notification webhook | `https://discord.com/api/webhooks/XXX/YYY` |
| `SNYK_TOKEN` | Snyk security scanning API token | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `API_URL` | Production API URL | `https://api.euralis-gaveurs.com` |

### 3. Create Environments

#### A. Staging Environment

1. Go to **Settings** → **Environments** → **New environment**
2. Name: `staging`
3. Click **Configure environment**
4. Configure protection rules:
   - ☐ Required reviewers (optional for staging)
   - ☐ Wait timer: 0 minutes
5. Add environment secrets:
   - `AWS_ACCESS_KEY_ID` (staging credentials)
   - `AWS_SECRET_ACCESS_KEY` (staging credentials)
   - `AWS_REGION`
6. Click **Save protection rules**

#### B. Production Environment

1. Go to **Settings** → **Environments** → **New environment**
2. Name: `production`
3. Click **Configure environment**
4. Configure protection rules:
   - ✅ **Required reviewers** → Select 2 team members
   - ✅ **Wait timer** → 5 minutes
   - ✅ **Deployment branches** → Selected branches only → `main`
5. Add environment secrets:
   - `AWS_ACCESS_KEY_ID` (production credentials)
   - `AWS_SECRET_ACCESS_KEY` (production credentials)
   - `AWS_REGION`
6. Click **Save protection rules**

### 4. AWS Infrastructure Setup

#### A. Create IAM User for GitHub Actions

```bash
# Create IAM user
aws iam create-user --user-name github-actions-deploy

# Attach policies
aws iam attach-user-policy \
  --user-name github-actions-deploy \
  --policy-arn arn:aws:iam::aws:policy/AmazonECS_FullAccess

aws iam attach-user-policy \
  --user-name github-actions-deploy \
  --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryFullAccess

aws iam attach-user-policy \
  --user-name github-actions-deploy \
  --policy-arn arn:aws:iam::aws:policy/AmazonRDSFullAccess

# Create access key
aws iam create-access-key --user-name github-actions-deploy
```

**Save the output:**
- `AccessKeyId` → Add as `AWS_ACCESS_KEY_ID` secret
- `SecretAccessKey` → Add as `AWS_SECRET_ACCESS_KEY` secret

#### B. Create ECS Cluster (If not exists)

```bash
# Staging cluster
aws ecs create-cluster --cluster-name euralis-gaveurs-staging

# Production cluster
aws ecs create-cluster --cluster-name euralis-gaveurs-production
```

#### C. Create RDS Instance (If not exists)

```bash
# Production database
aws rds create-db-instance \
  --db-instance-identifier euralis-gaveurs-prod \
  --db-instance-class db.t3.medium \
  --engine postgres \
  --master-username gaveurs_admin \
  --master-user-password CHANGE_ME \
  --allocated-storage 20 \
  --publicly-accessible false \
  --vpc-security-group-ids sg-XXXXXXXX

# Staging database
aws rds create-db-instance \
  --db-instance-identifier euralis-gaveurs-staging \
  --db-instance-class db.t3.small \
  --engine postgres \
  --master-username gaveurs_admin \
  --master-user-password CHANGE_ME \
  --allocated-storage 20 \
  --publicly-accessible false \
  --vpc-security-group-ids sg-XXXXXXXX
```

### 5. Configure Slack Notifications (Optional)

#### A. Create Slack App

1. Go to https://api.slack.com/apps
2. Click **Create New App** → **From scratch**
3. Name: `GitHub Actions - Euralis Gaveurs`
4. Select workspace

#### B. Enable Incoming Webhooks

1. In app settings, go to **Incoming Webhooks**
2. Toggle **Activate Incoming Webhooks** to **On**
3. Click **Add New Webhook to Workspace**
4. Select channel (e.g., `#deployments`)
5. Click **Allow**
6. Copy webhook URL
7. Add to GitHub Secrets as `SLACK_WEBHOOK_URL`

### 6. Configure Discord Notifications (Optional)

#### A. Create Discord Webhook

1. Go to Discord server
2. Right-click channel → **Edit Channel**
3. Go to **Integrations** → **Webhooks**
4. Click **New Webhook**
5. Name: `GitHub Actions`
6. Copy webhook URL
7. Add to GitHub Secrets as `DISCORD_WEBHOOK_URL`

### 7. Configure Codecov (Optional)

#### A. Add Repository to Codecov

1. Go to https://codecov.io
2. Sign in with GitHub
3. Click **Add new repository**
4. Select `projet-euralis-gaveurs`

#### B. Get Upload Token

1. Go to repository settings on Codecov
2. Copy upload token
3. Add to GitHub Secrets as `CODECOV_TOKEN` (optional, not required for public repos)

### 8. Configure Snyk Security Scanning (Optional)

#### A. Create Snyk Account

1. Go to https://snyk.io
2. Sign up with GitHub
3. Authorize Snyk

#### B. Get API Token

1. Go to **Account Settings** → **API Token**
2. Click **Show** and copy token
3. Add to GitHub Secrets as `SNYK_TOKEN`

### 9. Test Workflow

#### A. Push Test Commit

```bash
# Create test branch
git checkout -b test/github-actions

# Make small change
echo "# Test" >> README.md

# Commit and push
git add README.md
git commit -m "test: GitHub Actions setup"
git push -u origin test/github-actions
```

#### B. Monitor Workflow

1. Go to **Actions** tab in GitHub
2. You should see workflow running
3. Click on workflow run to see details
4. Verify all jobs complete successfully

#### C. Check Logs

1. Click on any job to see logs
2. Verify no errors
3. Check artifacts uploaded successfully

### 10. Branch Protection Rules

#### A. Protect Main Branch

1. Go to **Settings** → **Branches** → **Branch protection rules**
2. Click **Add rule**
3. Branch name pattern: `main`
4. Configure:
   - ✅ **Require a pull request before merging**
     - ✅ Require approvals: 2
   - ✅ **Require status checks to pass before merging**
     - ✅ Require branches to be up to date before merging
     - Add status checks:
       - `lint-and-typecheck`
       - `test-backend`
       - `test-frontends (SQAL)`
       - `test-frontends (Euralis)`
       - `test-frontends (Gaveurs)`
       - `test-e2e`
       - `build-backend`
       - `build-frontends (euralis)`
       - `build-frontends (gaveurs)`
       - `build-frontends (sqal)`
       - `security-scan`
   - ✅ **Require conversation resolution before merging**
   - ✅ **Do not allow bypassing the above settings**
5. Click **Create**

#### B. Protect Develop Branch

1. Click **Add rule**
2. Branch name pattern: `develop`
3. Configure:
   - ✅ **Require a pull request before merging**
     - ✅ Require approvals: 1
   - ✅ **Require status checks to pass before merging**
     - Add same status checks as main
   - ✅ **Require conversation resolution before merging**
5. Click **Create**

### 11. Verify Complete Setup

#### Checklist

- [ ] GitHub Actions enabled
- [ ] Container Registry enabled
- [ ] All required secrets configured
- [ ] Staging environment created with protection rules
- [ ] Production environment created with protection rules
- [ ] AWS IAM user created with correct permissions
- [ ] ECS clusters created
- [ ] RDS instances created
- [ ] Slack/Discord webhooks configured (optional)
- [ ] Codecov repository added (optional)
- [ ] Snyk API token configured (optional)
- [ ] Branch protection rules configured
- [ ] Test workflow completed successfully

## Troubleshooting

### Common Setup Issues

#### 1. Workflow Not Running

**Symptom:** No workflow appears after push

**Solution:**
- Verify `.github/workflows/ci-cd.yml` exists in repository
- Check file is on correct branch
- Verify GitHub Actions enabled in settings
- Check workflow file syntax with YAML linter

#### 2. Secrets Not Found

**Symptom:** Error: "Secret AWS_ACCESS_KEY_ID not found"

**Solution:**
- Verify secret name matches exactly (case-sensitive)
- Check secret added to correct repository
- For environment secrets, verify environment name matches workflow

#### 3. Permission Denied

**Symptom:** Docker push fails with "permission denied"

**Solution:**
- Verify Container Registry enabled
- Check workflow permissions set to "Read and write"
- Verify `GITHUB_TOKEN` has package write permissions

#### 4. AWS Deployment Fails

**Symptom:** ECS update service fails

**Solution:**
- Verify AWS credentials correct
- Check IAM permissions include ECS access
- Verify cluster and service names match
- Check security groups allow access

#### 5. Database Connection Fails

**Symptom:** Tests fail with "Connection refused"

**Solution:**
- Verify service containers healthy
- Check `DATABASE_URL` format
- Wait for service readiness (use healthcheck)

### Getting Help

If you encounter issues:

1. **Check Workflow Logs:**
   - Go to Actions → Select failed run → Click job → View logs

2. **Enable Debug Logging:**
   - Add secrets: `ACTIONS_RUNNER_DEBUG=true`, `ACTIONS_STEP_DEBUG=true`

3. **Test Locally:**
   - Use `act` to run workflows locally: https://github.com/nektos/act

4. **Community Support:**
   - GitHub Actions Community: https://github.community/
   - Stack Overflow: Tag `github-actions`

## Next Steps

After successful setup:

1. **Create First Feature:**
   ```bash
   git checkout -b feature/my-feature
   # Make changes
   git commit -m "feat: Add new feature"
   git push -u origin feature/my-feature
   # Create PR
   ```

2. **Monitor Test Results:**
   - Check Actions tab for test results
   - Review coverage reports
   - Fix any failing tests

3. **Deploy to Staging:**
   ```bash
   # Merge feature to develop
   git checkout develop
   git merge feature/my-feature
   git push origin develop
   # Workflow automatically deploys to staging
   ```

4. **Deploy to Production:**
   ```bash
   # Create PR from develop to main
   # After approval, merge
   # Workflow automatically deploys to production with manual approval
   ```

## Advanced Configuration

### Custom Runners

For faster builds, configure self-hosted runners:

1. Go to **Settings** → **Actions** → **Runners** → **New self-hosted runner**
2. Follow setup instructions
3. Update workflow to use self-hosted runner:

```yaml
jobs:
  test-backend:
    runs-on: self-hosted  # Instead of ubuntu-latest
```

### Workflow Dispatch Inputs

Add manual workflow inputs:

```yaml
on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to deploy to'
        required: true
        type: choice
        options:
          - staging
          - production
      skip_tests:
        description: 'Skip tests (not recommended)'
        required: false
        type: boolean
        default: false
```

### Matrix Strategy Expansion

Add more test combinations:

```yaml
strategy:
  matrix:
    python-version: ['3.10', '3.11', '3.12']
    node-version: ['18.x', '20.x']
```

### Concurrent Deployments

Prevent concurrent deployments:

```yaml
concurrency:
  group: production-deploy
  cancel-in-progress: false
```

## Best Practices

1. **Secret Rotation:** Rotate secrets every 90 days
2. **Environment Approval:** Always require manual approval for production
3. **Test Before Deploy:** Never skip tests in CI/CD
4. **Monitor Costs:** Track GitHub Actions minutes usage
5. **Cache Aggressively:** Use caching for faster builds
6. **Fail Fast:** Set appropriate timeouts
7. **Notifications:** Configure alerts for failures
8. **Documentation:** Keep this guide updated

## Resources

### Official Documentation
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Workflow Syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [Environment Secrets](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment)

### Useful Actions
- [checkout](https://github.com/actions/checkout)
- [setup-python](https://github.com/actions/setup-python)
- [setup-node](https://github.com/actions/setup-node)
- [docker/build-push-action](https://github.com/docker/build-push-action)
- [codecov-action](https://github.com/codecov/codecov-action)

### Tools
- [act](https://github.com/nektos/act) - Run workflows locally
- [actionlint](https://github.com/rhysd/actionlint) - Lint workflow files
- [GitHub CLI](https://cli.github.com/) - Manage workflows from terminal

## Support

For questions or issues with this setup guide:

1. Check existing GitHub Issues
2. Create new issue with label `ci/cd`
3. Contact DevOps team
4. Review `.github/workflows/README.md` for detailed workflow documentation
