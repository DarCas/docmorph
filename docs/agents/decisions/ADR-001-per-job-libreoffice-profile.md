# ADR-001 — One LibreOffice user profile per conversion job

## Status
Accepted

## Context
Concurrent `soffice` invocations share the default user profile (`~/.config/libreoffice`) unless told otherwise. LibreOffice serialises access to a profile and leaves lock files behind, so shared profiles cause contention and corrupted output under parallel conversions.

## Decision
Each conversion gets an isolated directory `os.tmpdir()/lo-<uuid>/` containing its own `profile/`, passed as `-env:UserInstallation=file://<jobDir>/profile`. Profiles are never shared, reused or pooled. The whole job directory is removed after the conversion, success or failure.

## Consequences
- Concurrent conversions cannot see or lock each other's profile.
- Cold-start cost per job: LibreOffice initialises a fresh profile on every conversion.
- Cleanup is best-effort: `rm` runs in `finally` without `await`, and errors are swallowed. A crash can leave `lo-*` directories in the temp volume.
- Any future optimisation that reuses profiles would reintroduce the original contention bug.

## Evidence
- `src/convert.ts` — job directory/profile creation, `soffice` arguments, `finally` cleanup.
- `README.md` — "dedicated LibreOffice user profile per job".
