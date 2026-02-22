# Service Management

← [Back to README](../README.md)

## Systemd Commands

```bash
# Start the stack
sudo systemctl start cliproxyapi-stack

# Stop the stack
sudo systemctl stop cliproxyapi-stack

# Restart the stack
sudo systemctl restart cliproxyapi-stack

# View status
sudo systemctl status cliproxyapi-stack

# Enable auto-start on boot
sudo systemctl enable cliproxyapi-stack

# Disable auto-start
sudo systemctl disable cliproxyapi-stack
```

## Docker Compose Commands

```bash
cd infrastructure

# Start services
docker compose up -d

# Stop services
docker compose down

# Restart services
docker compose restart

# View running containers
docker compose ps

# View logs (all services)
docker compose logs -f

# View logs (specific service)
docker compose logs -f caddy
docker compose logs -f cliproxyapi
docker compose logs -f dashboard
docker compose logs -f postgres

# Execute command in container
docker compose exec cliproxyapi sh
docker compose exec dashboard sh
docker compose exec postgres psql -U cliproxyapi -d cliproxyapi

# Pull latest images
docker compose pull

# Update services
docker compose up -d --pull always
```

![Docker Commands](code-snippets/docker-commands.png)