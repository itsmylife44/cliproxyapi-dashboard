# INFRASTRUCTURE KNOWLEDGE BASE

**Scope:** `infrastructure/`

## OVERVIEW
Production deployment stack: Docker Compose services, Caddy TLS reverse proxy, environment-driven operations, and host hardening documentation.

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| Service topology/networking | `docker-compose.yml` | frontend/public + backend/internal network model |
| Reverse proxy/TLS | `config/Caddyfile` | HTTPS termination + upstream routing |
| Env expectations | `.env.example`, install docs | required vars for startup |
| Firewall/hardening | `docs/ufw-setup.md` | strict order constraints for SSH/UFW |
| Ops procedures | `docs/*` | backup, service management, troubleshooting |

## CONVENTIONS
- Production compose uses named volumes and health checks for all core services.
- Backend network is internal-only; expose only required ports publicly.
- Caddy manages certificates and HTTP/3 config.

## ANTI-PATTERNS
- Never enable UFW before allowing SSH.
- Never run stack with missing/empty `.env`.
- Do not grant broad Docker socket access where docker-proxy restrictions are expected.
