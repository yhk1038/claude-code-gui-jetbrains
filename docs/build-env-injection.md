# Build-time Environment Injection

How build-time configuration (e.g. the telemetry API key) is baked into the
backend and webview bundles from a single `.env` source, without committing it as
a source constant.

## Core principle

Every injected value flows through **one channel — `process.env`** — from **one
source — the repo-root `.env`**. Neither the backend nor the webview parses env
files on its own or keeps a separate allowlist; both receive what the root `.env`
defines, through `process.env`.

## Source: a single root `.env`

- `.env` / `.env.<BUILD_ENV>` at the repo root is the **only** source.
- Backend values (no prefix) and webview values (`VITE_` / `CCG_PUBLIC_` prefix)
  live in the **same file**.
- There is no `webview/.env`.

## Channel: `build.sh` loads the root `.env` into `process.env`

`scripts/build.sh` (`load_build_env`) reads the root `.env` and exports its keys
into `process.env`, so every build command sees the same environment.

It loads the environment-specific file first, then plain `.env` as a fallback,
never clobbering a value already set:

```
.env.<BUILD_ENV>   →   .env   (fallback)
```

> ⚠️ Because `.env` is the fallback for every environment, a key you forget to set
> in `.env.production` falls back to its `.env` value (typically your dev value)
> and gets baked into the production artifact. Set every key explicitly in the
> environment-specific file when the value must differ.

## How each target receives

| Target | Mechanism | Filter |
|--------|-----------|--------|
| **Node backend** | esbuild `define` | **none** — every key defined in the root `.env` is injected |
| **WebView** | vite `loadEnv` reads `process.env` | only keys matching `VITE_` / `CCG_PUBLIC_` |
| **Kotlin plugin** | not injected — Node is the sole backend; add later if a Kotlin-side value is ever needed | — |

- **The backend has no allowlist.** Presence in the root `.env` is what makes a
  key a backend injection target — the file itself defines the scope.
- A webview `VITE_` key also lands in the backend bundle; that is harmless because
  it is a public value. The model is simply: **backend gets all of `.env`, webview
  gets the prefixed subset.**

esbuild replaces each `process.env.KEY` expression with its literal value at build
time, so the identifier disappears from the bundle. WebView code reads its values
as `import.meta.env.VITE_KEY`.

## Secret boundary

**Prefix presence = browser exposure.** A backend secret has no prefix, so vite's
`loadEnv` never picks it up and it can never reach the browser bundle. Add a
prefix to a value *only* when you intend it to ship to the browser, and treat
every prefixed value as public.

## Build environments

`scripts/build.sh` resolves one `BUILD_ENV` per invocation (also used as vite's
`mode`) and selects which environment file is layered on:

| `BUILD_ENV` | Commands | File |
|-------------|----------|------|
| `production` | `dist`, `build-plugin` | `.env.production` |
| `staging` | `run-ide`, `run-ide-installed` | `.env.staging` |
| `development` | everything else | `.env.development` |

An explicit `BUILD_ENV` in the caller's environment always wins:

```bash
BUILD_ENV=production bash ./scripts/build.sh be-build
```

## File tracking

`.gitignore` ignores every real env file and tracks only the template:

```
.env       .env.*       (ignored)
.env.example            (tracked)
```

## Adding a new injected value

### Backend value

1. Add the key (empty) to `.env.example` so the template documents it.
2. Read it in code as `process.env.YOUR_KEY`.
3. Put the real value in your local `.env` (and `.env.production` / `.env.staging`
   as needed). Never commit it.

### WebView value

1. Name it with a `VITE_` or `CCG_PUBLIC_` prefix.
2. Document it in `.env.example`.
3. Read it in client code as `import.meta.env.VITE_YOUR_FLAG`.
4. Remember: prefixed values are **public** — never a secret.

## Verifying injection

An injected value is replaced inline by the bundler, so the original
`process.env.KEY` identifier disappears from the output. Confirm by searching for
the value (not the identifier) in the built bundle:

```bash
# Do not print secret values to shared logs.
bash ./scripts/build.sh be-build
grep -cF "$(grep '^CCG_RYBBIT_API_KEY=' .env | cut -d= -f2-)" backend/dist/backend.mjs
# → 1 means the value was injected
```
