# =============================================================================
# PrimărIA - Multi-stage Dockerfile
# =============================================================================
# Stage 1: Install dependencies only
# Stage 2: Build the application
# Stage 3: Production runtime (minimal image)
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: deps — install node_modules
# ---------------------------------------------------------------------------
FROM node:20-alpine AS deps

RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm ci --ignore-scripts

# ---------------------------------------------------------------------------
# Stage 2: build — compile Next.js standalone + Prisma client
# ---------------------------------------------------------------------------
FROM node:20-alpine AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client (schema must be present before generate)
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npx prisma generate

# Dummy DATABASE_URL for build-time static page generation (Prisma needs it to compile)
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
ENV NEXTAUTH_SECRET="build-time-secret"
ENV NEXTAUTH_URL="http://localhost:3000"

RUN npm run build

# ---------------------------------------------------------------------------
# Stage 3: runtime — minimal production image
# ---------------------------------------------------------------------------
FROM node:20-alpine AS runtime

RUN apk add --no-cache libc6-compat curl openssl

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Copy standalone build output
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/src/messages ./src/messages

# Copy Prisma schema + migrations for runtime migration commands
COPY --from=build /app/prisma ./prisma

# Copy generated Prisma client from node_modules
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma

# Install prisma CLI globally in runtime to support migrations
RUN npm install -g prisma@6.0.0 && \
    mkdir -p /usr/local/lib/node_modules/prisma/node_modules/@prisma/engines && \
    chown -R nextjs:nodejs /usr/local/lib/node_modules/prisma

USER nextjs

EXPOSE 8080

CMD ["node", "server.js"]
