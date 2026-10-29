FROM node:22.23.4-alpine
WORKDIR /app
RUN apk add --no-cache curl
COPY __REPO_FOLDER__/services/__SERVICE_FOLDER__/ ./services/__SERVICE_FOLDER__/
# Segreto di build e non ARG: il valore di un ARG finisce nella stringa del
# comando ed e esportato con la cache di build. Il compose deve dichiarare
#   build: { secrets: [npm_token] }
# e definire  npm_token: { environment: NODE_AUTH_TOKEN }.
RUN --mount=type=secret,id=npm_token \
    token="$(cat /run/secrets/npm_token 2>/dev/null || true)" \
 && { test -n "$token" || { echo "npm_token mancante: serve per @vinovalab/backbone-shared" >&2; exit 1; }; } \
 && export NODE_AUTH_TOKEN="$token" \
 && printf '@vinovalab:registry=https://npm.pkg.github.com\n//npm.pkg.github.com/:_authToken=%s\n' "$token" > /root/.npmrc \
 && cd /app/services/__SERVICE_FOLDER__ \
 && npm install --omit=dev \
 && ln -s /app/services/__SERVICE_FOLDER__/node_modules /app/node_modules \
 && rm -f /root/.npmrc
EXPOSE __PORT__
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:__PORT__/status/health || exit 1
CMD ["node", "services/__SERVICE_FOLDER__/server.js"]
