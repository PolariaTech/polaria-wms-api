# syntax=docker/dockerfile:1

# Imagen del backend WMS para ECS Fargate ARM64 (POL-332).
# Build local: docker buildx build --platform linux/arm64 --load -t polaria-wms-api:local .
# Prueba de arranque: scripts/docker-smoke.sh (la misma que corre el CI).

ARG NODE_IMAGE=node:22-bookworm-slim

# ── Etapa 1: build ───────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS build
WORKDIR /app

# Primero solo los manifiestos: si no cambian, Docker reutiliza la capa de npm ci.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

# prisma.config.ts exige DATABASE_URL para `prisma generate`. Este valor es falso,
# solo vive durante este RUN y no llega a la imagen final.
# --omit=optional: el CLI `prisma` (y typescript, effect, studio...) queda marcado
# `devOptional` en el lockfile porque @prisma/client lo declara peer opcional, y
# `--omit=dev` solo no lo quita (~220 MB). En producción solo se pierde pg-cloudflare.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npm run build \
  && npm prune --omit=dev --omit=optional

# ── Etapa 2: runtime ─────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app

COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma
# CA raíz de Supabase para verificar el TLS del pooler (POL-367); ver certs/README.md.
COPY --chown=node:node certs/supabase-root-2021.crt ./certs/supabase-root-2021.crt

USER node
EXPOSE 3000

# La imagen slim no trae curl; Node 22 trae fetch.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Sin npm de por medio, para que SIGTERM llegue directo a Node.
CMD ["node", "dist/src/main.js"]
