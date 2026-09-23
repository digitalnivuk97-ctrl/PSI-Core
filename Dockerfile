FROM node:24-alpine AS dependencies
WORKDIR /app
COPY package.json pnpm-lock.yaml* package-lock.json* ./
RUN corepack enable && (pnpm install --frozen-lockfile || npm install)
COPY . .
RUN pnpm build
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORTABLE_CORE_DATA_DIR=/data
COPY --from=dependencies /app/.next/standalone ./
COPY --from=dependencies /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
