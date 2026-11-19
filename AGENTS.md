# AGENTS.md

DocMorph is a stateless DOCX→PDF HTTP microservice (Express + headless LibreOffice, TypeScript, Node 22), a static React/Vite landing site, and a published npm client. The service is `src/`; the site is `website/`; the SDK is `sdk/`.

## Commands

Service (repository root):

- `npm install`
- `npm run dev` — `tsx watch src/index.ts` (routes only; no `soffice`)
- `npm run typecheck` — `tsc --noEmit` (only static check; no lint or test suite)
- `npm run build` — compile `src/` → `dist/`; `npm start` runs `node dist/index.js`
- `docker build -t ghcr.io/darcas/docmorph:latest .` then `docker compose up -d` — full E2E (the only place `soffice` exists). `docker compose up --build` rebuilds nothing: the compose file has no `build:` stanza.
- Release: `docker build` and `docker push` both `<version>` and `latest` (or the local, gitignored `docker-builder.sh`).

Website:

- `cd website && npm install`
- `npm run dev` — Vite dev server
- `npm run build` — highlight snippets, `tsc --noEmit`, `vite build`, prerender
- `npm run preview`

SDK (`cd sdk`; independent package, not an npm workspace):

- `npm install`
- `npm run typecheck` — `tsc --noEmit`
- `npm test` — build then `node --test` against `dist/`
- `npm run build` — dual ESM/CJS build plus declaration copy
- `npm pack --dry-run` — inspect published files
- Release: bump `sdk/package.json`, tag `sdk-v<version>`; CI publishes with provenance.

Node `>=22` for the service and website (`.nvmrc`: `22.23.4`); the SDK supports `>=20`. The service is ESM (`NodeNext`): relative imports keep the `.js` suffix (e.g. `./concurrency.js`).

## Working Rules (NON-NEGOTIABLE)
These rules apply to every task and override any other instruction, habit or default. No exceptions unless the user explicitly waives one for the current task.

1. **Keep it simple.** Solve the task with the smallest, simplest change that works. Do NOT add abstractions, layers, patterns, config options, dependencies or generality the task does not need today. Complexity requires an explicit request or a concrete, present need. If a simple solution exists, use it.
2. **Never assume.** Do NOT guess requirements, intent, behavior, APIs, names or file contents. If something is ambiguous or unknown and you cannot verify it from code, config or docs, STOP and ask the user before proceeding. A plausible guess is not an answer.
3. **Stay in scope.** Change only what the task requires. Do NOT refactor, rename, reformat, reorder, "clean up" or fix unrelated code, files, dependencies or config. If you notice something else worth changing, report it; do not touch it.
4. **Verify before done.** Before declaring a task complete: re-read your full diff, check it against every part of the request, run the relevant lint/typecheck/test commands, and confirm nothing out of scope changed. Report what you verified and what you could not. Never claim "done" on unverified work.

## Hard rules

- Conversion works only in the Docker image. Never claim a conversion fix verified on a local run.
- Never share or reuse a LibreOffice profile: one `-env:UserInstallation=file://<job>/profile` per conversion.
- Every `pool.acquire()` needs a matching `release()` in `finally`.
- Keep `.js` suffixes on relative imports in `src/`.
- Only `.docx` is accepted. Keep all three checks: extension, `PK\x03\x04` input magic, `%PDF` output magic.
- Never commit secrets. `docker-compose.yml` is gitignored and holds live API keys; only `docker-compose.dist.yml` is tracked.
- Request-path logging goes through `Logger`; direct `console.*` calls are limited to `Logger` internals and the startup banner.
- `website/src/generated/snippets.json` is build output — edit `website/scripts/snippets.mjs`.
- Never hand-edit injected versions (`softwareVersion`, `__SITE_VERSION__`, `__SOFTWARE_VERSION__`); they come from the two `package.json` files.
- SDK public types live only in `sdk/src/types.d.ts`; `sdk/dist/` is build output, never edit it by hand.
- Building the image requires `fonts/msttcorefonts/` to exist (gitignored; the repository does not provision it).

## External File Loading
CRITICAL: When you encounter a file reference (e.g. @docs/agents/architecture.md), use your Read tool to load it on a need-to-know basis, only if relevant to the SPECIFIC task at hand.
- Do NOT preemptively load all references.
- Once loaded, treat the content as mandatory instructions that override defaults.
- Follow references recursively when needed.

## Project knowledge

- Before touching routes, auth, rate limits, status codes or error bodies: @docs/agents/api.md
- Before changing modules, the request pipeline or the website build: @docs/agents/architecture.md
- Before writing code in `src/` or `website/`: @docs/agents/conventions.md
- Before verifying a change or claiming it works: @docs/agents/testing.md
- Before touching Dockerfile, compose, fonts, CI or releases: @docs/agents/infrastructure.md
- Before changing the SDK, its package layout, tests or npm release: @docs/agents/sdk.md
- Before revisiting a durable design choice: @docs/agents/decisions/ADR-001-per-job-libreoffice-profile.md, @docs/agents/decisions/ADR-002-in-process-conversion-semaphore.md, @docs/agents/decisions/ADR-003-public-probe-paths.md

## Map

```text
src/            Express service: routes, soffice wrapper, semaphore, logger
website/        React/Vite landing site (GitHub Pages)
sdk/            Published npm client for the API (ESM + CJS)
fonts/          msttcorefonts; gitignored, required to build the image
docs/agents/    Detailed AI-facing documentation
```
