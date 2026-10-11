# Blackbox — production image (Next.js standalone output).
#
#   docker build -t blackbox ./frontend
#   docker run -p 3000:3000 --env-file frontend/.env.production blackbox
#
# Migrations and the knowledge-base sync run on start (see the CMD below), so a
# fresh database is ready on first boot. NEXT_PUBLIC_* values are baked in at
# build time: pass them as build args.

# Debian (glibc) rather than Alpine: onnxruntime-node, used by the local
# cross-encoder reranker, ships glibc binaries only.
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
# postinstall runs `prisma generate`, which needs the schema copied above.
RUN npm ci

FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 BUILD_STANDALONE=1
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_SUPPORT_EMAIL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npx next build

FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    TRANSFORMERS_CACHE=/tmp/bbx-transformers
RUN groupadd --system app && useradd --system --gid app --create-home app

# App server
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
# Migration + seed tooling (prisma CLI, tsx, schema, seed data, RAG sources)
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/prisma ./prisma
COPY --from=build --chown=app:app /app/prisma.config.ts ./prisma.config.ts
COPY --from=build --chown=app:app /app/lib ./lib
COPY --from=build --chown=app:app /app/scripts ./scripts
COPY --from=build --chown=app:app /app/package.json ./package.json
COPY --from=build --chown=app:app /app/tsconfig.json ./tsconfig.json

USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && node server.js"]
