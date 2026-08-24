# syntax=docker/dockerfile:1.4

# ---------------------------------------------------------
# Stage 1: Base image with essential runtime libraries
# ---------------------------------------------------------
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat wget

# ---------------------------------------------------------
# Stage 2: Cached Dependencies Installation
# ---------------------------------------------------------
FROM base AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma/

# Use BuildKit cache mount to eliminate repeat npm download time
RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline --no-audit

# ---------------------------------------------------------
# Stage 3: Builder with Next.js Compiler Cache
# ---------------------------------------------------------
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Generate Prisma client
RUN npx prisma generate

# Compile Next.js with BuildKit compiler cache
RUN --mount=type=cache,target=/app/.next/cache \
    npm run build

# ---------------------------------------------------------
# Stage 4: Lean Production Runner Image (<180MB)
# ---------------------------------------------------------
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root system user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy Prisma schema and standalone assets
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

# Zero-downtime healthcheck: Prevents 502 Bad Gateway by ensuring traffic is only routed when healthy
HEALTHCHECK --interval=4s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
