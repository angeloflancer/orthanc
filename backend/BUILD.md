# Building the backend as a single executable

Building the backend into a single `.exe` hides your Node.js source (no `.js` files shipped) and makes deployment simpler.

## Prerequisites

- **Node.js 18.x or 20.x** (pkg uses Node 18 runtime for the exe)
- `npm install` run once in `backend/` so dependencies are available for packaging

## Build (Windows exe)

From the `backend/` directory:

```bash
npm run build:exe
```

This uses [pkg](https://github.com/vercel/pkg) to produce:

- **Output:** `dist/orthanc-backend.exe`

The executable includes the Node runtime, your application code, and **your `backend/.env` file** (if it exists at build time). No separate `node` or `.js` files are required to run it.

**Embedded .env:** When you run `npm run build:exe`, the file `backend/.env` is bundled into the exe. The exe uses that embedded config at runtime, so you do not need to ship or create a `.env` file next to the exe unless you want to override values.

## Running the executable

1. **Copy** `orthanc-backend.exe` (and optionally `assets/` if you want to override embedded logos) to your deployment folder.
2. **Optional:** To override embedded config, create a `.env` file in the same folder as the exe (or in its parent folder). The exe loads in this order (later overrides earlier): current working directory → same folder as exe → parent folder of exe.
3. **Run** the exe (e.g. double‑click or `.\orthanc-backend.exe` from a terminal).

No Node.js or `node_modules` need to be installed on the target machine.

## What gets protected

- Your **application source** (routes, models, middleware, etc.) is bundled into the executable and is not present as separate `.js` files.
- **Config:** Your `backend/.env` is embedded at build time and used by default. Keep the built exe secure; it contains the values that were in `.env` when you built.

## Alternative: Node.js Single Executable Applications (SEA)

If you prefer Node’s built-in [Single Executable Applications](https://nodejs.org/api/single-executable-applications.html) (Node 20+):

1. Bundle the app into one script (e.g. with `esbuild` or `webpack`).
2. Build the SEA blob: `node --experimental-sea-config sea-config.json` and then inject it into the Node binary.

This is more manual but uses only the official Node toolchain. The `pkg` approach above is quicker for a single Windows exe.
