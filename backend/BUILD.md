# Building the backend as a single executable

Building the backend into a single `.exe` hides your Node.js source and **embeds** `.env` and the built frontend inside the executable. You distribute and run only `orthanc-backend.exe`; no separate `.env` or `frontend-dist` folder is required.

## Prerequisites

- **Node.js 18.x or 20.x** (pkg uses Node 18 runtime for the exe)
- `npm install` run once in `backend/` and `frontend/` so dependencies are available

## Build (Windows exe)

From the `backend/` directory:

1. **Build the frontend** (writes into `backend/frontend-dist`):

   ```bash
   npm run build:frontend
   ```

2. **Ensure** `backend/.env` exists and is configured (it will be embedded).

3. **Package the executable:**

   ```bash
   npm run build:exe
   ```

This uses [pkg](https://github.com/vercel/pkg) to produce:

- **Output:** `dist/orthanc-backend.exe` (only this file; no `.env` or `frontend-dist` are copied to `dist/`)

The executable **embeds**:

- Node runtime and your application code
- **`.env`** – config is read from inside the exe (snapshot); no external `.env` file is required
- **`frontend-dist`** – the built frontend is served from inside the exe on port 5829

**Database:** The app uses SQLite + SQLCipher. The database file is **not** embedded; it is created on disk at the path in `DB_PATH` (from embedded `.env`). Ensure the exe has write access to the directory of `DB_PATH`. Set `DB_KEY` in `.env` before building so the embedded config contains your encryption key.

**Native module (better-sqlite3-sqlcipher):** pkg bundles the `.node` native binding when building on the same OS/architecture. For the built exe to run, either (1) build on the target OS (e.g. Windows for `node18-win-x64`) so the binding is included, or (2) copy the `node_modules/better-sqlite3-sqlcipher` output next to the exe if pkg does not pack it. In practice, building with `npm run build:exe` on Windows produces an exe that runs with the embedded binding. If you see a load error for the native module, run the exe from a folder that contains the binding (e.g. from `backend/` after build) or document that the binding must be present.

## Running the executable

1. **Copy** only `orthanc-backend.exe` to your deployment folder (or run it from anywhere).
2. **Run** the exe (e.g. double‑click or `.\orthanc-backend.exe` from a terminal).

No Node.js, `.env` file, or `frontend-dist` folder need to be present. The app uses the embedded config and frontend. The SQLite database file is created at `DB_PATH` (relative to the exe’s working directory) if it does not exist.

## What gets protected

- **Application source** (routes, db repos, middleware, etc.) is bundled into the executable.
- **`.env`** is embedded and not written to disk at runtime.
- **Frontend** (`frontend-dist`) is embedded and served from inside the exe. Keep the built exe secure; it contains the config and frontend from build time.

## Alternative: Node.js Single Executable Applications (SEA)

If you prefer Node’s built-in [Single Executable Applications](https://nodejs.org/api/single-executable-applications.html) (Node 20+):

1. Bundle the app into one script (e.g. with `esbuild` or `webpack`).
2. Build the SEA blob: `node --experimental-sea-config sea-config.json` and then inject it into the Node binary.

This is more manual but uses only the official Node toolchain. The `pkg` approach above is quicker for a single Windows exe.
