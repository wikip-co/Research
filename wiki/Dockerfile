# syntax=docker/dockerfile:1
FROM node:24-alpine AS build
# Optional corporate TLS root, supplied from the host as a BuildKit secret.
RUN --mount=type=secret,id=build_ca \
    if [ -s /run/secrets/build_ca ]; then \
      cat /run/secrets/build_ca >> /etc/ssl/certs/ca-certificates.crt; \
    fi && apk add --no-cache git
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt
WORKDIR /app
COPY source/package.json source/package-lock.json ./source/
RUN npm ci --prefix source
COPY source/ ./source/

# Git is read from a temporary build-context mount, never copied into a layer.
# A full local clone supplies dates/revisions; archives fall back to file times.
RUN --mount=type=bind,target=/context \
    if [ -d /context/.git ]; then \
      export GIT_DIR=/context/.git GIT_WORK_TREE=/app GIT_OPTIONAL_LOCKS=0; \
      git config --global --add safe.directory /app; \
    fi; \
    npm --prefix source test && \
    node source/bin/wiki.js lint --all --strict && \
    npm --prefix source run build && \
    npm --prefix source run verify

# Preserve the configured mount path, including /wiki/ behind a reverse proxy.
RUN node -e 'const fs = require("node:fs"); const root = new URL(require("./docs/api/articles.json").site.url).pathname; fs.mkdirSync("/site" + root, {recursive: true}); fs.cpSync("docs", "/site" + root, {recursive: true}); fs.writeFileSync("/health-path", root);'

FROM nginx:stable-alpine AS runtime
RUN rm -rf /usr/share/nginx/html/*
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /site/ /usr/share/nginx/html/
COPY --from=build /health-path /etc/wiki-path
USER nginx
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:8080$(cat /etc/wiki-path)api/articles.json" || exit 1
ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]
