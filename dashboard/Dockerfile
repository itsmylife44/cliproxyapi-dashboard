# syntax=docker/dockerfile:1.4

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN NODE_OPTIONS=--max-old-space-size=384 npm ci --legacy-peer-deps --no-audit --no-fund && npm cache clean --force

FROM node:20-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY next.config.ts tsconfig.json prisma.config.ts postcss.config.mjs ./
COPY public ./public
COPY src ./src
COPY prisma ./prisma

# ARG is not persisted in image layers — safe for build-time placeholders
ARG DATABASE_URL="postgresql://build:build@localhost:5432/build"
ARG JWT_SECRET="build-time-placeholder-at-least-32-chars"
ARG MANAGEMENT_API_KEY="build-time-placeholder-16ch"
ARG CLIPROXYAPI_MANAGEMENT_URL="http://127.0.0.1:8317/v0/management"
ENV CLIPROXYAPI_MANAGEMENT_URL=${CLIPROXYAPI_MANAGEMENT_URL}

RUN npx prisma generate
RUN NODE_OPTIONS=--max-old-space-size=512 npm run build

FROM node:20-alpine AS runner
WORKDIR /app

# Create non-root user with specific UID/GID
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 -G nodejs

# Install tini for proper PID 1 signal handling + docker-cli for container management
# docker-cli required: dashboard executes docker commands via child_process.execFile
# to manage stack containers. Access restricted via docker-socket-proxy.
RUN apk add --no-cache tini docker-cli

ARG DASHBOARD_VERSION=dev
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV COMPOSE_DIR=/opt/cliproxyapi/infrastructure
ENV DASHBOARD_VERSION=${DASHBOARD_VERSION}
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/src/generated ./src/generated
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/engines ./node_modules/@prisma/engines
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/adapter-pg ./node_modules/@prisma/adapter-pg
COPY --chown=nextjs:nodejs entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh

# Create logs directory with correct ownership before switching to non-root user
RUN mkdir -p /app/logs && chown nextjs:nodejs /app/logs

USER nextjs

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=40s \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["./entrypoint.sh"]
