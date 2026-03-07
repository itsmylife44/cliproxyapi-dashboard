# Runbook

## Health Check

```
GET /api/health
```

Returns 200 if the dashboard is running. Does not check database connectivity.

## Deployment

### Docker (Production)

```bash
# Build and deploy via dashboard UI
# Navigate to Settings → Deploy section
# Or via API:
POST /api/admin/deploy
```

### Local Development

```powershell
cd dashboard
.\dev-local.ps1          # Start everything
.\dev-local.ps1 -Down    # Stop containers
.\dev-local.ps1 -Reset   # Delete all data and restart
```

## Database

### Run Migrations

```bash
cd dashboard
npx prisma migrate deploy
```

### Reset Database (development only)

```bash
.\dev-local.ps1 -Reset
```

### Connect to Database

```bash
# Dev: localhost:5433
docker exec -it cliproxyapi-dev-postgres psql -U cliproxyapi -d cliproxyapi
```

## Common Issues

### Dashboard won't start
1. Check Docker is running: `docker info`
2. Check containers: `docker ps`
3. Check logs: `docker logs cliproxyapi-dev-postgres`
4. Verify `.env.local` exists with correct `DATABASE_URL`

### Database connection errors
1. Verify PostgreSQL container is running: `docker ps | grep postgres`
2. Check port 5433 is available
3. Run `npx prisma migrate deploy` if schema is out of date

### CLIProxyAPI unreachable
1. Check API container: `docker logs cliproxyapi-dev-api`
2. Verify port 28317 is accessible: `curl http://localhost:28317/`
3. Wait for healthcheck (up to 60s on first start)

### Build errors after branch switch
```bash
cd dashboard
npx prisma generate    # Regenerate Prisma client
npm install            # Reinstall dependencies
```

## Updates

### Update Proxy
```
Settings → CLIProxyAPI Updates → Update
# Or: POST /api/update
```

### Update Dashboard
```
Settings → Dashboard Updates → Update
# Or: POST /api/update/dashboard
```

## Monitoring

- **Service status**: Dashboard → Monitoring page
- **Logs**: Dashboard → Monitoring → Live Logs
- **Usage**: Dashboard → Usage page
- **Quota**: Dashboard → Quota page
