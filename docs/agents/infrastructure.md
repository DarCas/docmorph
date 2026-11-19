# Infrastructure and delivery

## Docker image

Two-stage build in `Dockerfile`:

1. `node:22.23.4-slim` build stage: `npm ci`, copy `tsconfig.json` + `src`, `npm run build`.
2. Runtime stage: same base, installs `libreoffice-core`, `libreoffice-writer`, `fonts-dejavu-core`, `fonts-liberation`, `dumb-init`, `ca-certificates`; disables LibreOffice crash reporting via `/etc/libreoffice/sofficerc`; `fc-cache -fv`; production-only `npm ci`; copies `dist`.
3. Runs as `USER 1000` with `dumb-init` as PID 1, `CMD ["node", "dist/index.js"]`, exposes `8080`, `LANG`/`LC_ALL=C.UTF-8`, `NODE_ENV=production`.

### Fonts are a build prerequisite

`COPY fonts/msttcorefonts /usr/share/fonts/truetype/msttcorefonts` requires that directory to exist in the build context. The directory and all its fonts are gitignored and no placeholder is tracked, so **a fresh clone cannot build the image until `fonts/msttcorefonts/` is populated**. Missing fonts are a hard `COPY` failure, not a cosmetic rendering issue.

## Compose files

- `docker-compose.dist.yml` — tracked template: image `ghcr.io/darcas/docmorph:latest`, port `3001:8080`, healthcheck via `node -e fetch(...)`, log rotation `10m`/`3` files, CPU/memory limits (2 CPU / 1G limit, 1 CPU / 512M reservation), `API_KEYS` commented out.
- `docker-compose.yml` — gitignored local deployment file; currently contains a live `API_KEYS` value. Never copy its contents into tracked files or documentation.
- `docker-builder.sh` — gitignored local release helper: reads `package.json` version, builds `ghcr.io/darcas/docmorph:<version>` and `:latest`, pushes both, prunes images/builders.

Release by hand is equivalent to:

```bash
docker build -t ghcr.io/darcas/docmorph:<version> -t ghcr.io/darcas/docmorph:latest .
docker push ghcr.io/darcas/docmorph:<version>
docker push ghcr.io/darcas/docmorph:latest
```

Version bumps happen only in `package.json`; the image tag is not derived automatically by CI.

## GitHub Actions

`.github/workflows/pages.yml` is the only workflow — website deployment only, no service build or test.

- Triggers: push to `master` touching `website/**` or the workflow file, plus `workflow_dispatch`.
- Node 22, `npm install --no-audit --no-fund` (not `npm ci`) in `website/`.
- `npm run build`, then copies `website/CNAME` into `website/dist`, uploads the directory as a Pages artifact, deploys with `actions/deploy-pages@v4`.
- `concurrency.group: pages`, `cancel-in-progress: true`.

Custom domain comes from `website/CNAME` (`docmorph.os.darcas.app`); `index.html` canonical/OG URLs point to the same origin.

## Build context and ignores

- `.dockerignore` excludes `node_modules`, `.git`, compose files, `Dockerfile`, `*.md`, `.env*`. Documentation and the website never enter the image.
- Root `.gitignore` excludes `dist/`, `node_modules/`, `fonts/msttcorefonts/*`, `.idea/`, `docker-builder.sh`, and `docker-compose*.yml` except `docker-compose.dist.yml`.
- `website/dist` and `website/node_modules` are ignored by `website/.gitignore`; `website/src/generated/snippets.json` is tracked and must be regenerated when snippets change.
