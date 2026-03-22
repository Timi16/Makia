FROM node:20-bookworm-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/prisma ./src/prisma
COPY --from=builder /app/ecosystem.config.cjs ./ecosystem.config.cjs

EXPOSE 4000

CMD ["node", "dist/index.js"]
