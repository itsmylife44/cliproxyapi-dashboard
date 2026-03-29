<!-- Generated: 2026-03-30 | Files scanned: 222 | Token estimate: ~620 -->
# Architecture

## Stack
Next.js 16 + React 19 + TypeScript 5.9 + Prisma 7 (PostgreSQL) + Tailwind CSS 4

## System Diagram
```
Browser ──► Next.js App Router (dashboard:3000)
              ├── /app/api/*         → Prisma DB (PostgreSQL)
              ├── /app/api/management/* → CLIProxyAPI backend (:8317)
              └── /app/dashboard/*   → SSR/CSR pages
```

## Service Boundaries
- **Dashboard** (this repo): UI + API routes + DB access
- **CLIProxyAPI** (external): AI proxy backend, proxied via `/api/management/[...path]`
- **PostgreSQL**: User data, providers, usage, config, audit logs

## Data Flow
```
User → Login → JWT session cookie → Protected API routes → Prisma → PostgreSQL
                                   → Management proxy → CLIProxyAPI (:8317)
```

## Key Directories
```
dashboard/src/
├── app/api/          59 route files (REST API)
├── app/dashboard/    13 dashboard page routes (+ root/login/setup)
├── components/       88 React component files
├── lib/              50 service/utility modules
├── hooks/            7 hook/test utility files
└── generated/        Prisma client
```

## Auth Model
JWT (jose) → httpOnly cookie → middleware validates → session helpers in lib/auth/
