# Euralis Gaveurs System - Backup & Restore Guide

Complete backup and restore solution for the Euralis Gaveurs production system.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Usage](#usage)
- [Scheduling](#scheduling)
- [Restore Procedures](#restore-procedures)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

---

## Overview

This backup solution provides comprehensive protection for:

- **TimescaleDB Database**: Full PostgreSQL database with TimescaleDB hypertables and continuous aggregates
- **Uploaded Files**: Photos, documents, and static assets
- **Blockchain Data**: Traceability records and QR codes
- **Application Logs**: System and application logs

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    BACKUP COMPONENTS                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Database   │  │    Files     │  │  Blockchain  │      │
│  │  pg_dump +   │  │   Uploads    │  │   Tables     │      │
│  │ Hypertables  │  │   Static     │  │  QR Codes    │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                            │                                 │
│                   ┌────────▼────────┐                        │
│                   │  Compression    │                        │
│                   │   (tar.gz/7z)   │                        │
│                   └────────┬────────┘                        │
│                            │                                 │
│                   ┌────────▼────────┐                        │
│                   │   Encryption    │                        │
│                   │   (AES-256)     │                        │
│                   └────────┬────────┘                        │
│                            │                                 │
│         ┌──────────────────┼──────────────────┐             │
│         │                  │                  │             │
│   ┌─────▼─────┐    ┌──────▼──────┐   ┌──────▼──────┐      │
│   │   Local   │    │     S3      │   │    Azure    │      │
│   │  Storage  │    │   Bucket    │   │    Blob     │      │
│   └───────────┘    └─────────────┘   └─────────────┘      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Features

### Core Features

- **Full System Backup**: Database, files, blockchain, and logs
- **Compression**: Efficient tar.gz (Linux) or 7z (Windows) compression
- **Encryption**: AES-256 encryption for sensitive data
- **Cloud Upload**: S3, Azure Blob Storage, and Google Cloud Storage support
- **Retention Policy**: Configurable retention (daily, weekly, monthly)
- **Verification**: Automated backup integrity checks
- **Point-in-Time Recovery**: Support for PITR with WAL archiving
- **Notifications**: Email, Slack, Discord, and Microsoft Teams alerts
- **Dry Run Mode**: Test backups without making changes
- **Logging**: Comprehensive logging with timestamps

### Safety Features

- **Idempotent**: Safe to run multiple times
- **Error Handling**: Graceful failure handling
- **Confirmation Prompts**: Interactive confirmations for destructive operations
- **Dependency Checking**: Verifies required tools before execution
- **Lock Files**: Prevents overlapping backups (when using flock)

---

## Installation

### Prerequisites

#### Linux/Mac

```bash
# PostgreSQL client tools
sudo apt-get install postgresql-client-15  # Ubuntu/Debian
brew install postgresql@15                  # macOS

# Compression tools
sudo apt-get install tar gzip              # Usually pre-installed

# Encryption (optional)
sudo apt-get install gnupg

# AWS CLI (optional)
sudo apt-get install awscli

# Azure CLI (optional)
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
```

#### Windows

1. **PostgreSQL Client Tools**: Install from https://www.postgresql.org/download/windows/
2. **7-Zip**: Download from https://www.7-zip.org/
3. **GPG (optional)**: Install Gpg4win from https://gpg4win.org/
4. **AWS CLI (optional)**: Install from https://aws.amazon.com/cli/
5. **Azure CLI (optional)**: Install from https://docs.microsoft.com/cli/azure/install-azure-cli-windows

### Setup

1. **Copy configuration template**:

```bash
# Linux/Mac
cp scripts/backup-config.example.env scripts/backup-config.env
chmod 600 scripts/backup-config.env  # Secure permissions

# Windows
copy scripts\backup-config.example.env scripts\backup-config.env
```

2. **Edit configuration**:

```bash
# Linux/Mac
nano scripts/backup-config.env

# Windows
notepad scripts\backup-config.env
```

3. **Configure essential settings**:

- Database credentials
- Backup directory
- Encryption password
- Cloud storage (optional)
- Notifications (optional)

4. **Create backup directory**:

```bash
# Linux/Mac
mkdir -p /opt/euralis-gaveurs/backups
mkdir -p /var/log/euralis-gaveurs

# Windows
mkdir C:\EuralisGaveurs\backups
mkdir C:\EuralisGaveurs\logs
```

5. **Make scripts executable** (Linux/Mac only):

```bash
chmod +x scripts/backup.sh scripts/restore.sh
```

---

## Quick Start

### First Backup

```bash
# Linux/Mac - Test with dry run
./scripts/backup.sh --dry-run

# Linux/Mac - Run actual backup
./scripts/backup.sh

# Windows - Test with dry run
scripts\backup.bat /DRY-RUN

# Windows - Run actual backup
scripts\backup.bat
```

### List Available Backups

```bash
# Linux/Mac
./scripts/restore.sh --list

# Windows
scripts\restore.bat /LIST
```

### Restore from Backup

```bash
# Linux/Mac - Interactive restore
./scripts/restore.sh

# Linux/Mac - Restore specific backup
./scripts/restore.sh --backup backups/gaveurs_backup_20240101_020000.tar.gz

# Windows - Interactive restore
scripts\restore.bat

# Windows - Restore specific backup
scripts\restore.bat /BACKUP backups\gaveurs_backup_20240101_020000.7z
```

---

## Configuration

### Essential Configuration

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=gaveurs_db
DB_USER=gaveurs_admin
DB_PASSWORD=your-secure-password

# Backup location
BACKUP_DIR=/opt/euralis-gaveurs/backups

# Encryption (recommended)
ENABLE_ENCRYPTION=true
ENCRYPTION_PASSWORD=your-strong-encryption-password
```

### Cloud Storage Configuration

#### AWS S3

```env
ENABLE_S3_UPLOAD=true
S3_BUCKET=euralis-gaveurs-backups
S3_REGION=eu-west-1
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

**Create S3 bucket**:

```bash
aws s3 mb s3://euralis-gaveurs-backups --region eu-west-1
aws s3api put-bucket-versioning \
  --bucket euralis-gaveurs-backups \
  --versioning-configuration Status=Enabled
```

#### Azure Blob Storage

```env
ENABLE_AZURE_UPLOAD=true
AZURE_STORAGE_ACCOUNT=euralisgaveurs
AZURE_STORAGE_KEY=your-storage-key
AZURE_CONTAINER=gaveurs-backups
```

**Create Azure container**:

```bash
az storage container create \
  --name gaveurs-backups \
  --account-name euralisgaveurs
```

### Notification Configuration

#### Email

```env
ENABLE_EMAIL=true
EMAIL_TO=admin@euralis-gaveurs.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=backup@euralis-gaveurs.com
SMTP_PASSWORD=your-app-password
```

#### Slack

```env
ENABLE_SLACK=true
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

Create webhook: https://api.slack.com/messaging/webhooks

### Retention Policy

```env
RETAIN_DAILY=7      # Keep last 7 daily backups
RETAIN_WEEKLY=4     # Keep last 4 weekly backups
RETAIN_MONTHLY=12   # Keep last 12 monthly backups
```

---

## Usage

### Backup Commands

#### Basic Backup

```bash
# Linux/Mac
./scripts/backup.sh

# Windows
scripts\backup.bat
```

#### Advanced Options

```bash
# Dry run (test without changes)
./scripts/backup.sh --dry-run

# Backup without cloud upload
./scripts/backup.sh --no-upload

# Backup without encryption
./scripts/backup.sh --no-encrypt

# Show help
./scripts/backup.sh --help
```

#### Windows Options

```batch
REM Dry run
scripts\backup.bat /DRY-RUN

REM No cloud upload
scripts\backup.bat /NO-UPLOAD

REM No encryption
scripts\backup.bat /NO-ENCRYPT

REM Show help
scripts\backup.bat /?
```

### Restore Commands

#### List Backups

```bash
# Linux/Mac
./scripts/restore.sh --list

# Windows
scripts\restore.bat /LIST
```

#### Interactive Restore

```bash
# Linux/Mac
./scripts/restore.sh

# Windows
scripts\restore.bat
```

#### Restore Specific Backup

```bash
# Linux/Mac
./scripts/restore.sh --backup backups/gaveurs_backup_20240101_020000.tar.gz

# Windows
scripts\restore.bat /BACKUP backups\gaveurs_backup_20240101_020000.7z
```

#### Advanced Restore Options

```bash
# Dry run (test without changes)
./scripts/restore.sh --dry-run

# Restore database only
./scripts/restore.sh --database-only

# Verify current database
./scripts/restore.sh --verify
```

---

## Scheduling

### Linux/Mac - Cron

Edit crontab:

```bash
crontab -e
```

Add schedule:

```cron
# Daily backup at 2:00 AM
0 2 * * * /opt/euralis-gaveurs/scripts/backup.sh >> /var/log/euralis-gaveurs/backup-cron.log 2>&1

# Verify backup at 6:00 AM
0 6 * * * /opt/euralis-gaveurs/scripts/restore.sh --verify >> /var/log/euralis-gaveurs/verify.log 2>&1
```

### Windows - Task Scheduler

#### Using GUI

1. Open Task Scheduler
2. Create Basic Task
3. Name: "Euralis Gaveurs Backup"
4. Trigger: Daily at 2:00 AM
5. Action: Start a program
6. Program: `C:\EuralisGaveurs\scripts\backup.bat`
7. Finish

#### Using PowerShell

```powershell
$action = New-ScheduledTaskAction -Execute "C:\EuralisGaveurs\scripts\backup.bat"
$trigger = New-ScheduledTaskTrigger -Daily -At 2am
Register-ScheduledTask -Action $action -Trigger $trigger -TaskName "EuralisGaveursBackup" -Description "Daily backup at 2 AM"
```

### Docker/Kubernetes

Create CronJob:

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: euralis-gaveurs-backup
spec:
  schedule: "0 2 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: euralis-gaveurs-backup:latest
            command: ["/scripts/backup.sh"]
            env:
            - name: DB_HOST
              value: "timescaledb"
            volumeMounts:
            - name: backups
              mountPath: /backups
          volumes:
          - name: backups
            persistentVolumeClaim:
              claimName: backup-pvc
          restartPolicy: OnFailure
```

---

## Restore Procedures

### Full System Restore

#### Prerequisites

1. **Stop all services**:

```bash
# Docker
docker-compose down

# Systemd
sudo systemctl stop euralis-gaveurs-backend
sudo systemctl stop euralis-gaveurs-frontend-*
```

2. **Ensure database is accessible**:

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql
```

#### Step-by-Step Restoration

1. **List available backups**:

```bash
./scripts/restore.sh --list
```

2. **Select backup** (interactive):

```bash
./scripts/restore.sh
```

Or specify backup file:

```bash
./scripts/restore.sh --backup backups/gaveurs_backup_20240101_020000.tar.gz
```

3. **Confirm restoration**:

The script will prompt:

```
WARNING: This will DROP and recreate the database 'gaveurs_db'. All existing data will be lost!
Are you sure you want to continue? [y/N]
```

Type `y` to proceed.

4. **Wait for completion**:

The script will:
- Decrypt backup (if encrypted)
- Extract archive
- Drop and restore database
- Restore files
- Restore blockchain data
- Verify restoration
- Clean up temporary files

5. **Verify restoration**:

```bash
./scripts/restore.sh --verify
```

6. **Restart services**:

```bash
# Docker
docker-compose up -d

# Systemd
sudo systemctl start euralis-gaveurs-backend
sudo systemctl start euralis-gaveurs-frontend-*
```

### Partial Restore

#### Database Only

```bash
./scripts/restore.sh --database-only --backup backups/gaveurs_backup_20240101_020000.tar.gz
```

#### Specific Tables

Use psql to restore specific tables:

```bash
# Extract backup
tar -xzf backups/gaveurs_backup_20240101_020000.tar.gz

# Restore specific table
psql -h localhost -U gaveurs_admin -d gaveurs_db -c "DROP TABLE IF EXISTS canards CASCADE;"
pg_restore -h localhost -U gaveurs_admin -d gaveurs_db --table=canards extracted_backup/database/gaveurs_db_*.sql
```

### Point-in-Time Recovery (PITR)

If WAL archiving is enabled:

```bash
# Stop PostgreSQL
sudo systemctl stop postgresql

# Restore base backup
tar -xzf backups/gaveurs_backup_20240101_020000.tar.gz -C /var/lib/postgresql/15/main

# Create recovery.conf
cat > /var/lib/postgresql/15/main/recovery.conf <<EOF
restore_command = 'cp /var/lib/postgresql/wal_archive/%f %p'
recovery_target_time = '2024-01-01 14:30:00'
EOF

# Start PostgreSQL
sudo systemctl start postgresql
```

### Disaster Recovery

In case of complete system failure:

1. **Provision new server** with same OS and architecture
2. **Install dependencies** (PostgreSQL, TimescaleDB, etc.)
3. **Download backup** from cloud storage:

```bash
# S3
aws s3 cp s3://euralis-gaveurs-backups/backups/gaveurs_backup_20240101_020000.tar.gz.gpg .

# Azure
az storage blob download \
  --account-name euralisgaveurs \
  --container-name gaveurs-backups \
  --name backups/gaveurs_backup_20240101_020000.tar.gz.gpg \
  --file gaveurs_backup_20240101_020000.tar.gz.gpg
```

4. **Restore using restore script**:

```bash
./scripts/restore.sh --backup gaveurs_backup_20240101_020000.tar.gz.gpg
```

---

## Troubleshooting

### Common Issues

#### 1. Permission Denied

**Error**: `Permission denied: /opt/euralis-gaveurs/backups`

**Solution**:

```bash
# Linux/Mac
sudo chown -R $USER:$USER /opt/euralis-gaveurs/backups
chmod 755 /opt/euralis-gaveurs/backups

# Windows
# Right-click folder > Properties > Security > Edit permissions
```

#### 2. pg_dump Not Found

**Error**: `pg_dump: command not found`

**Solution**:

```bash
# Ubuntu/Debian
sudo apt-get install postgresql-client-15

# macOS
brew install postgresql@15

# Windows
# Add PostgreSQL bin to PATH
setx PATH "%PATH%;C:\Program Files\PostgreSQL\15\bin"
```

#### 3. Database Connection Failed

**Error**: `psql: could not connect to server`

**Solution**:

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check connection parameters
psql -h localhost -U gaveurs_admin -d gaveurs_db

# Verify pg_hba.conf allows connection
sudo nano /etc/postgresql/15/main/pg_hba.conf
# Add: host all all 127.0.0.1/32 md5
```

#### 4. Insufficient Disk Space

**Error**: `No space left on device`

**Solution**:

```bash
# Check disk space
df -h

# Clean old backups
find /opt/euralis-gaveurs/backups -name "*.tar.gz*" -mtime +30 -delete

# Move backups to larger disk
mv /opt/euralis-gaveurs/backups /mnt/large-disk/backups
ln -s /mnt/large-disk/backups /opt/euralis-gaveurs/backups
```

#### 5. Encryption/Decryption Failed

**Error**: `gpg: decryption failed: Bad session key`

**Solution**:

- Verify encryption password is correct
- Check GPG is installed
- Ensure backup file is not corrupted (check file size)

#### 6. Cloud Upload Failed

**Error**: `aws: error: Unable to locate credentials`

**Solution**:

```bash
# Configure AWS CLI
aws configure

# Or use environment variables
export AWS_ACCESS_KEY_ID=your-key
export AWS_SECRET_ACCESS_KEY=your-secret
```

### Debugging

#### Enable Debug Mode

```bash
# Linux/Mac
bash -x scripts/backup.sh

# Windows
# Edit backup.bat and add: @echo on
```

#### Check Logs

```bash
# View latest backup log
tail -f logs/backup_*.log

# Search for errors
grep -i error logs/backup_*.log

# View cron execution
grep CRON /var/log/syslog
```

#### Test Individual Components

```bash
# Test database connection
psql -h localhost -U gaveurs_admin -d gaveurs_db -c "SELECT 1"

# Test pg_dump
pg_dump -h localhost -U gaveurs_admin -d gaveurs_db --schema-only

# Test S3 upload
aws s3 ls s3://euralis-gaveurs-backups/

# Test compression
tar -czf test.tar.gz /tmp/test-file
```

---

## Best Practices

### 1. Regular Testing

- **Test restores monthly**: Verify backups are restorable
- **Document procedures**: Keep restore documentation up-to-date
- **Disaster recovery drills**: Practice full system recovery annually

### 2. Security

- **Encrypt backups**: Always enable encryption for production
- **Secure credentials**: Use environment variables or secrets management
- **Restrict access**: Limit backup file permissions (chmod 600)
- **Rotate passwords**: Change encryption passwords periodically

### 3. Storage

- **3-2-1 Rule**:
  - **3** copies of data
  - **2** different storage media
  - **1** offsite backup

- **Cloud redundancy**: Use multiple cloud providers or regions
- **Monitor storage**: Alert when storage is 80% full
- **Lifecycle policies**: Move old backups to cheaper storage (Glacier, Cool tier)

### 4. Monitoring

- **Backup alerts**: Get notified when backups fail
- **Size monitoring**: Track backup size trends
- **Duration monitoring**: Alert on unusually long backups
- **Verification**: Automate backup integrity checks

### 5. Retention

- **Keep more recent**: More frequent recent backups, sparse older backups
- **Compliance**: Meet regulatory retention requirements
- **Archive important**: Archive backups before major changes

### 6. Performance

- **Schedule off-hours**: Run backups during low-usage periods
- **Incremental backups**: Use incremental for frequent backups
- **Parallel dumps**: Use pg_dump --jobs for faster backups
- **Compression**: Balance between compression ratio and speed

### 7. Documentation

- **Backup schedule**: Document what, when, where
- **Restore procedures**: Step-by-step instructions
- **Contact information**: Who to call during recovery
- **Change log**: Track backup configuration changes

---

## Appendix

### Backup File Naming Convention

```
gaveurs_backup_YYYYMMDD_HHMMSS.tar.gz[.gpg]

Examples:
- gaveurs_backup_20240101_020000.tar.gz
- gaveurs_backup_20240101_020000.tar.gz.gpg (encrypted)
- gaveurs_backup_20240101_020000.7z (Windows)
```

### Backup Contents Structure

```
gaveurs_backup_YYYYMMDD_HHMMSS/
├── database/
│   ├── gaveurs_db_YYYYMMDD_HHMMSS.sql         # Full database dump
│   ├── schema_YYYYMMDD_HHMMSS.sql             # Schema only
│   ├── hypertables_info_YYYYMMDD_HHMMSS.txt   # Hypertable metadata
│   └── continuous_aggregates_YYYYMMDD_HHMMSS.txt
├── files/
│   └── uploaded_files_YYYYMMDD_HHMMSS.tar.gz  # Uploaded files
├── blockchain/
│   └── blockchain_YYYYMMDD_HHMMSS.sql         # Blockchain tables
└── logs/
    └── logs_YYYYMMDD_HHMMSS.tar.gz            # Application logs
```

### Estimated Backup Sizes

| Component | Typical Size | Notes |
|-----------|--------------|-------|
| Database (empty) | 50 MB | Initial schema |
| Database (1 year) | 5 GB | With full data |
| Uploaded files | 2 GB | Photos, documents |
| Blockchain data | 500 MB | QR codes, feedback |
| Logs | 200 MB | 30 days retention |
| **Compressed total** | **~3 GB** | With compression |

### Recovery Time Objectives (RTO)

| Scenario | Target RTO | Steps |
|----------|------------|-------|
| Single table restore | 15 minutes | Restore specific table |
| Database restore | 30 minutes | Full database restore |
| Full system restore | 2 hours | Database + files + verification |
| Disaster recovery | 4 hours | New server + restore + testing |

### Support

For issues or questions:

- **Documentation**: See main project README.md
- **Logs**: Check `logs/backup_*.log` and `logs/restore_*.log`
- **GitHub Issues**: Open issue with log excerpts
- **Email**: support@euralis-gaveurs.com

---

**Last Updated**: 2024-12-25
**Version**: 1.0.0
**Author**: Euralis Gaveurs Team
