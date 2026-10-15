# Multi-stage build for Railway (also runs anywhere Docker does).
# Migrations are not run here; Railway's pre-deploy command runs them.

FROM node:22-alpine AS base
RUN apk add --no-cache openssl
WORKDIR /app

# Full install: the build needs dev dependencies (vite, react-router dev).
FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npx prisma generate && npm run build

# Production-only dependencies plus a generated Prisma client.
FROM base AS production-dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY prisma ./prisma
RUN npx prisma generate

FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3000
COPY package.json ./
COPY prisma ./prisma
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=build /app/build ./build
USER node
EXPOSE 3000
CMD ["npm", "run", "start"]
