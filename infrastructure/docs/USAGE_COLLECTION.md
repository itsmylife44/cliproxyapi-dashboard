# Usage Collection Service

← [Back to Infrastructure Docs](../../README.md)

## Overview

CLIProxyAPI Dashboard includes an **automated usage collection system** that tracks API requests, token usage, and model statistics from CLIProxyAPI and stores them in PostgreSQL for historical analysis.

> **Key Point**: Usage data is collected every 5 minutes by a dedicated cron service and displayed in the Dashboard's Usage page.

> **Required CLIProxyAPI settings** (`infrastructure/config/config.yaml`):
> ```yaml
> usage-statistics-enabled: true               # otherwise nothing is queued
> redis-usage-queue-retention-seconds: 3600    # upstream default 60 drops records before the collector runs
> ```
> CLIProxyAPI discards queued records older than the retention (max 3600 s). The template sets only
> `usage-statistics-enabled`; the retention is set by the collector on every install: its first run
> after a dashboard start raises a lower or missing retention to 3600 with one `config.yaml` write
> through the management API (a higher value is never lowered; a failed write is logged and retried
> on the next run).

## Architecture

```
CLIProxyAPI (usage queue, kept for redis-usage-queue-retention-seconds)
    ↓ every 5 minutes
Usage Collector Service (cron)
    ↓ fetches via Management API
Dashboard (/api/usage/collect)
    ↓ processes & deduplicates  
PostgreSQL (UsageRecord table)
    ↓ reads for display
Dashboard Usage Page
```

## Services

The Docker Compose stack includes these services for usage collection:

### 1. Usage Collector Service

**Container**: `cliproxyapi-usage-collector`  
**Image**: `alpine:3.19` with curl and dcron  
**Purpose**: Runs cron job every 5 minutes to trigger data collection  

```yaml
usage-collector:
  image: alpine:3.19
  container_name: cliproxyapi-usage-collector
  restart: unless-stopped
  command: >
    sh -c "
      apk add --no-cache curl dcron &&
      echo '*/5 * * * * curl -sf -X POST http://dashboard:3000/api/usage/collect -H \"Authorization: Bearer $$COLLECTOR_API_KEY\" > /dev/null 2>&1' > /tmp/crontab &&
      crontab /tmp/crontab &&
      crond -f -d 8
    "
```

**What it does:**
- Installs curl and dcron (lightweight cron daemon)
- Creates crontab entry to call `/api/usage/collect` every 5 minutes
- Uses `COLLECTOR_API_KEY` for authentication
- Runs in foreground with debug logging

### 2. Dashboard Collection Endpoint

**Endpoint**: `POST /api/usage/collect`  
**Authentication**: Bearer token using `COLLECTOR_API_KEY`  
**Purpose**: Fetches usage data from CLIProxyAPI and stores in database

**Process:**
1. Authenticates request using `COLLECTOR_API_KEY`
2. Acquires singleton lock (prevents concurrent collections)
3. Once per dashboard process, raises CLIProxyAPI's usage-queue retention to 3600 s if it is lower
4. Drains the CLIProxyAPI usage queue (`GET /v0/management/usage-queue?count=500`), repeating until a batch returns fewer than 500 records (at most 20 batches per run; the rest waits for the next run)
5. Maps API keys to users in the dashboard
6. Deduplicates and batch-inserts into PostgreSQL
7. Updates collection status and timestamps

## Environment Variables

Add these to your `infrastructure/.env` file:

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `COLLECTOR_API_KEY` | Authentication key for cron service | `a1b2c3...` (64-char hex) |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `TZ` | `UTC` | Timezone for cron execution |

## Configuration

### Automatic Setup (Recommended)

The installer (`install.sh`) automatically:

1. **Generates COLLECTOR_API_KEY**: 64-character hex string
2. **Adds to .env**: Sets `COLLECTOR_API_KEY=...`
3. **Starts collector service**: Included in Docker Compose stack

### Manual Setup

If you're setting up manually or need to regenerate the key:

```bash
# Generate new API key
COLLECTOR_API_KEY=$(openssl rand -hex 32)

# Add to infrastructure/.env
echo "COLLECTOR_API_KEY=${COLLECTOR_API_KEY}" >> infrastructure/.env

# Restart the stack to pick up new key
cd infrastructure
docker compose down
docker compose up -d
```

## Troubleshooting

### Usage Data Not Appearing

If your Usage page shows "No usage data" or "Last collected: Never", check these items:

#### 1. Check Collector Service Status

```bash
cd infrastructure
docker compose ps usage-collector
```

**Expected output:**
```
NAME                           IMAGE         STATUS
cliproxyapi-usage-collector    alpine:3.19   Up X minutes
```

If not running:
```bash
docker compose up -d usage-collector
docker compose logs usage-collector
```

#### 2. Verify Environment Variables

```bash
# Check if COLLECTOR_API_KEY is set
grep COLLECTOR_API_KEY infrastructure/.env

# If missing, generate and add it
COLLECTOR_API_KEY=$(openssl rand -hex 32)
echo "COLLECTOR_API_KEY=${COLLECTOR_API_KEY}" >> infrastructure/.env
docker compose up -d
```

#### 3. Check Collection Logs

```bash
# View collector service logs
docker compose logs -f usage-collector

# View dashboard logs for collection attempts
docker compose logs dashboard | grep "usage"
```

**Healthy logs look like:**
```
usage-collector | crond: USER root pid 15 cmd curl -sf -X POST http://dashboard:3000/api/usage/collect -H "Authorization: Bearer ..." > /dev/null 2>&1
dashboard | {"level":"info","message":"Usage collection completed","recordsStored":42,"durationMs":1234}
```

#### 4. Test Manual Collection

```bash
# Get the API key from .env
COLLECTOR_API_KEY=$(grep COLLECTOR_API_KEY infrastructure/.env | cut -d= -f2)

# Test collection manually
curl -X POST https://dashboard.yourdomain.com/api/usage/collect \
  -H "Authorization: Bearer $COLLECTOR_API_KEY" \
  -v
```

**Expected response:**
```json
{
  "success": true,
  "message": "Usage collection completed",
  "recordsStored": 42,
  "durationMs": 1234
}
```

#### 5. Check Database Connection

```bash
# Connect to database
cd infrastructure
docker compose exec postgres psql -U cliproxyapi -d cliproxyapi

# Check if usage records exist
SELECT COUNT(*) FROM usage_records;
SELECT * FROM collector_state ORDER BY "updatedAt" DESC LIMIT 1;

# Exit database
\q
```

### Common Issues

#### Issue: "COLLECTOR_API_KEY not set"

**Symptoms:**
- Collector service fails to start
- Manual collection returns 401 Unauthorized

**Solution:**
```bash
# Generate and set the key
COLLECTOR_API_KEY=$(openssl rand -hex 32)
echo "COLLECTOR_API_KEY=${COLLECTOR_API_KEY}" >> infrastructure/.env

# Restart services
docker compose down && docker compose up -d
```

#### Issue: "Collector already running"

**Symptoms:**
- Collection endpoint returns HTTP 202 with "Collector already running"
- Multiple simultaneous collection attempts

**Explanation:**
The collection endpoint uses a singleton lock to prevent concurrent runs. This is normal behavior.

**Solution:**
Wait 15+ minutes for the lock to expire, or restart the dashboard service:
```bash
docker compose restart dashboard
```

#### Issue: "CLIProxyAPI unreachable"

**Symptoms:**
- Collection endpoint returns errors about CLIProxyAPI connection
- Log shows "fetch failed" for management API

**Solution:**
```bash
# Check CLIProxyAPI health
docker compose ps cliproxyapi
docker compose logs cliproxyapi

# Verify management API is accessible
# (should print {"usage-statistics-enabled":true})
docker compose exec dashboard sh -c 'wget -qO- --header "Authorization: Bearer $MANAGEMENT_API_KEY" http://cliproxyapi:8317/v0/management/usage-statistics-enabled'
```

#### Issue: Usage not attributed to users

**Symptoms:**
- Usage data appears but shows as "Unattributed"
- User column shows blank or "Unknown"

**Explanation:**
The collector tries multiple strategies to match CLIProxyAPI usage to dashboard users:
1. API key matching (for keys created in dashboard)
2. Auth file lookup (for OAuth users)
3. Source email matching
4. Auth index prefix matching

**Solution:**
This is usually normal for OAuth users. The data is still collected and counted in totals.

### Manual Collection Triggers

You can trigger collection manually from the Dashboard UI:

1. **Login as admin** to the Dashboard
2. **Navigate to Usage page**
3. **Click "Refresh"** button (only visible to admins)

This calls the collection endpoint directly and shows immediate results.

### Health Monitoring

#### Collection Status Indicators

The Usage page shows collection health:

- 🟢 **Green**: Last collected < 10 minutes ago
- 🟡 **Yellow**: Last collected 10-30 minutes ago  
- 🔴 **Red**: Last collected > 30 minutes ago or never

#### Collection State

Check the collector state table:

```sql
SELECT 
  "lastCollectedAt",
  "lastStatus",
  "recordsStored",
  "errorMessage"
FROM collector_state 
ORDER BY "updatedAt" DESC 
LIMIT 1;
```

**Possible statuses:**
- `idle`: No collection in progress
- `running`: Collection currently active
- `success`: Last collection completed successfully
- `error`: Last collection failed (check errorMessage)

## Performance Notes

### Resource Usage

The usage collector service is very lightweight:

- **CPU**: ~0.1 cores (mostly idle)
- **Memory**: ~64MB (Alpine + curl + cron)
- **Network**: Minimal (one queue read per 500 queued records, every 5 minutes)

### Data Storage

Usage records accumulate over time:

- **Per request**: ~1KB per database row
- **Typical volume**: 1,000-10,000 requests/day = 1-10MB/day
- **Retention**: No automatic cleanup (stores forever)

### Collection Frequency

The default 5-minute interval balances:

- **Data freshness**: Recent activity visible quickly
- **Resource efficiency**: Not overwhelming CLIProxyAPI
- **Deduplication**: Sufficient time for request completion

Keep the interval well below `redis-usage-queue-retention-seconds` (max 3600 s): records older than the retention are dropped before they are collected.

To change frequency, modify the cron schedule in docker-compose.yml:

```yaml
# Change from */5 * * * * to */1 * * * * for 1-minute collection
echo '*/1 * * * * curl -sf -X POST http://dashboard:3000/api/usage/collect ...' > /tmp/crontab
```

## Data Privacy

### What is Collected

The usage collector stores:

- **Request metadata**: timestamp, model used, token counts
- **Performance metrics**: latency, success/failure status  
- **User attribution**: linked to dashboard users when possible
- **API source information**: which API key was used

### What is NOT Collected

- **Request content**: No prompts, responses, or actual messages
- **Sensitive data**: No API keys, passwords, or personal information
- **External data**: Only data from your CLIProxyAPI instance

### Data Access

- **Admins**: See all usage data across all users
- **Regular users**: See only their own API key usage
- **API keys**: Collection uses management API key (not user keys)

## Advanced Configuration

### Custom Collection Intervals

Modify the collector service cron schedule:

```bash
# Edit docker-compose.yml, line ~210:
echo '*/1 * * * *' # Every minute
echo '*/10 * * * *' # Every 10 minutes
```

Intervals of an hour or more lose data: the queue keeps records for at most 3600 s.

### Collection Timeout

The collection endpoint has built-in timeouts:

- **Singleton lock**: 15 minutes maximum
- **CLIProxyAPI fetch**: 30 seconds per request
- **Database operations**: No explicit timeout (relies on Prisma)

### Batch Processing

Large usage datasets are processed in batches:

- **Batch size**: 500 records per database insert
- **Deduplication**: Handled by unique constraints
- **Memory management**: Streamed processing, not loaded entirely

## Migration from Legacy System

If you're upgrading from an older version that used host machine cron, re-running `install.sh` removes the old entry. To remove it by hand:

### Remove Old Cron Job

```bash
# Check for existing cron job
crontab -l | grep "usage/collect"

# Remove old cron job
crontab -l | grep -v "usage/collect" | crontab -
```

### Verify New Service

```bash
# Ensure new usage-collector service is running
docker compose ps usage-collector

# Check logs for successful collection
docker compose logs usage-collector
```

The new containerized approach is more reliable and doesn't require host-level cron configuration.