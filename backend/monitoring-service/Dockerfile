FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN corepack enable && pnpm install --frozen-lockfile=false
COPY tsconfig.json ./
COPY src ./src
RUN pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV SERVICE_NAME=monitoring-service
ENV PORT=8085
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/dist ./dist
EXPOSE 8085
CMD ["node", "dist/index.js"]
