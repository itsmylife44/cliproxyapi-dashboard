# DOCS DOMAIN KNOWLEDGE BASE

**Scope:** `docs/`

## OVERVIEW
Operational and reference documentation for installation, configuration, security, troubleshooting, and generated architecture codemaps.

## WHERE TO LOOK
| Need | Location | Notes |
|---|---|---|
| First-time deployment | `INSTALLATION.md` | server + local pathways |
| Runtime/env config | `CONFIGURATION.md`, `ENV.md` | env vars and config surfaces |
| Security posture | `SECURITY.md`, `infrastructure/docs/ufw-setup.md` | secret handling + firewall ordering |
| Operational fixes | `TROUBLESHOOTING.md`, `RUNBOOK.md` | production issue playbooks |
| Backups/recovery | `BACKUP.md` | backup/restore procedures |
| Generated architecture maps | `CODEMAPS/*` and root generated reports | refresh when structure changes |

## CONVENTIONS
- Keep docs aligned with current scripts/compose commands and real service names.
- Explicitly call out dangerous ordering constraints (SSH before firewall enable, etc.).
- Treat generated codemap artifacts as snapshots requiring periodic regeneration.

## ANTI-PATTERNS
- Do not document commands that bypass safety controls already enforced in scripts.
- Do not claim endpoint availability for deprecated APIs (`/api/usage`).
