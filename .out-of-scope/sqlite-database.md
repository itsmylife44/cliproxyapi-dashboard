# SQLite database

The dashboard runs on PostgreSQL only. It does not support SQLite or any other database as an alternative backend.

## Why this is out of scope

The request behind this is usually "a lighter deployment". The heavy part, running the whole stack when you already have CLIProxyAPI, is already solved by dashboard-only mode:

```bash
./install.sh --dashboard-only
```

That mode starts only the dashboard and its PostgreSQL container and connects to an existing CLIProxyAPI (see `docs/INSTALLATION.md` and `docs/CONFIGURATION.md`). Swapping that one PostgreSQL container for a SQLite file saves little.

The cost is high and permanent. Prisma ties a schema and its migration history to a single provider, so SQLite support means:

- a second `schema.prisma` (provider `sqlite`) kept in sync with the PostgreSQL one on every model change;
- a second migration history, generated and tested for every schema change;
- re-checking the PostgreSQL-specific parts (JSON fields, raw queries such as the health check) on both backends;
- a second CI matrix, plus backup/restore tested on both backends.

Every future feature would pay that tax, for a deployment that dashboard-only mode already makes small.

## Prior requests

- #188: "Request for a more lightweight deployment method"
