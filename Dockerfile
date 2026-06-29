# syntax=docker/dockerfile:1

# Immagine "piena" (sorgente + node_modules + build Next + client Prisma): la
# STESSA immagine fa girare i tre comandi del compose di produzione cambiando
# solo il `command` — web (`npm run start`), worker (`npm run worker`) e migrate
# (`db:deploy` + `db:seed`). Il worker gira su sorgente TS via `tsx`, quindi
# servono node_modules completo e i sorgenti: per questo non si usa l'output
# `standalone` di Next. Vedi docs/deploy-docker.md.

FROM node:24-slim AS base
ENV NODE_ENV=production
WORKDIR /app
# openssl/ca-certificates: utili a Prisma e alla connessione TLS in uscita (SMTP).
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# --- Dipendenze (incluse le dev: servono per la build, per il worker via `tsx`
#     e per la CLI di Prisma usata da migrate) ---
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --include=dev

# --- Build: genera il client Prisma (lib/generated/prisma) e compila Next ---
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Valori PLACEHOLDER solo per soddisfare la validazione delle variabili
# d'ambiente all'import (lib/env.ts) durante `next build`. NON vengono usati a
# runtime: i valori reali arrivano via env_file (.env.production).
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
ENV BETTER_AUTH_SECRET="build-time-placeholder-non-usato-a-runtime"
RUN npx prisma generate && npm run build

# --- Runtime: immagine usata da web, worker e migrate ---
FROM base AS runner
COPY --from=build /app ./
EXPOSE 3000
# Comando di default (sovrascritto dai singoli servizi nel compose).
CMD ["npm", "run", "start"]
