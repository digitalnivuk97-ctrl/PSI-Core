FROM node:24-alpine AS dependencies
WORKDIR /app
ARG NEXT_PUBLIC_CONVEX_URL
ENV NEXT_PUBLIC_CONVEX_URL=$NEXT_PUBLIC_CONVEX_URL
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json pnpm-lock.yaml* package-lock.json* ./
RUN npm install --global pnpm@10.33.0 && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
FROM dependencies AS convex-deploy
WORKDIR /app
CMD ["sh", "-c", "export CONVEX_SELF_HOSTED_ADMIN_KEY=\"$(cat /secrets/convex-admin-key)\"; test -n \"$CONVEX_SELF_HOSTED_ADMIN_KEY\" && test -n \"$CONVEX_INTERNAL_KEY\" && test -n \"$PORTABLE_CORE_SETUP_TOKEN\" && pnpm exec convex env set PORTABLE_CORE_SETUP_TOKEN \"$PORTABLE_CORE_SETUP_TOKEN\" --force && pnpm exec convex env set CORE_INTERNAL_KEY \"$CONVEX_INTERNAL_KEY\" --force && pnpm exec convex deploy --typecheck enable --message \"self-hosted initial deployment\""]
FROM node:24-alpine AS runner
WORKDIR /app
ARG NEXT_PUBLIC_CONVEX_URL
ENV NODE_ENV=production
ENV NEXT_PUBLIC_CONVEX_URL=$NEXT_PUBLIC_CONVEX_URL
ENV PORTABLE_CORE_DATA_DIR=/data
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=dependencies /app/.next/standalone ./
COPY --from=dependencies /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
