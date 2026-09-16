FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Prisma needs openssl to pick a query engine instead of guessing openssl-1.1.x.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate --schema src/prisma/schema.prisma
RUN npm run build

FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

# calibre provides the `ebook-convert` binary used for MOBI export; openssl keeps
# Prisma from falling back to the wrong engine.
RUN apt-get update \
  && apt-get install -y --no-install-recommends calibre openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/prisma ./src/prisma
COPY --from=builder /app/ecosystem.config.cjs ./ecosystem.config.cjs
RUN npx prisma generate --schema src/prisma/schema.prisma

EXPOSE 4000

CMD ["node", "dist/index.js"]
