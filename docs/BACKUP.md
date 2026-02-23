# Backup and Restore

← [Back to README](../README.md)

## Create Backup

```bash
./scripts/backup.sh
```

### What's Included

- PostgreSQL database dump
- CLIProxyAPIPlus configuration
- OAuth token storage
- Environment files
- TLS certificates

### Storage Location

Backups are stored in `backups/cliproxyapi_backup_YYYYMMDD_HHMMSS.tar.gz`

## Restore from Backup

```bash
./scripts/restore.sh backups/cliproxyapi_backup_20260206_020000.tar.gz
```

The restore script will:

1. Stop all services
2. Restore database from dump
3. Restore configuration files
4. Restore volumes
5. Restart services

## Automated Backups

Configured during installation via cron:

- **Daily**: 2 AM every day, keeps last 7 backups
- **Weekly**: 2 AM every Sunday, keeps last 4 backups

**View cron schedule:**

```bash
sudo crontab -l
```

**View backup logs:**

```bash
tail -f backups/backup.log
```