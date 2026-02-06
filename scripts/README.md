# CLIProxyAPI Stack Maintenance Scripts

This directory contains maintenance scripts for backup, restore, and rotation operations.

## Scripts

### backup.sh
Creates a complete backup of the CLIProxyAPI stack including:
- Postgres database (pg_dump)
- config.yaml configuration file
- Auth directory (OAuth tokens and state)

**Usage:**
```bash
./scripts/backup.sh
```

Backups are stored in `backups/` with timestamp: `cliproxyapi_backup_YYYYMMDD_HHMMSS.tar.gz`

### restore.sh
Restores the stack from a backup file.

**Usage:**
```bash
./scripts/restore.sh <backup_file.tar.gz>

./scripts/restore.sh backups/cliproxyapi_backup_20260205_020000.tar.gz
```

**Warning:** This will overwrite current data. The script will prompt for confirmation.

### rotate-backups.sh
Removes old backups, keeping only the most recent N backups.

**Usage:**
```bash
./scripts/rotate-backups.sh [keep_count]

./scripts/rotate-backups.sh 4
```

Default: Keep 4 most recent backups

## Automated Backups

If you selected automated backups during installation, a cron job runs:
- **Daily backups**: 2 AM every day (keeps last 7)
- **Weekly backups**: 2 AM every Sunday (keeps last 4)

View backup logs:
```bash
tail -f backups/backup.log
```

## Manual Backup Workflow

1. Create backup:
   ```bash
   ./scripts/backup.sh
   ```

2. List backups:
   ```bash
   ls -lh backups/
   ```

3. Test restore (optional):
   ```bash
   ./scripts/restore.sh backups/cliproxyapi_backup_YYYYMMDD_HHMMSS.tar.gz
   ```

## Backup Storage

All backups are stored in the `backups/` directory at the project root. This directory is excluded from git.

For production deployments, consider:
- Copying backups to remote storage (S3, rsync, etc.)
- Encrypting backup files before remote transfer
- Testing restore procedures regularly
