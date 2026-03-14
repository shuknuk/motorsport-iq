# Railway Local Access

This repo is configured to use a project-local Railway CLI setup.

## Install state

- The Railway CLI is installed as a root dev dependency.
- Commands should run through `./scripts/railway.sh` or `npm run railway -- ...`.
- Do not use `railway login` for this repo flow.

## One-time setup

1. Copy `.env.railway.local.example` to `.env.railway.local`.
2. Fill in:
   - `RAILWAY_TOKEN`
   - `RAILWAY_PROJECT_ID`
   - `RAILWAY_SERVICE_ID`

These values stay local because `.env.railway.local` is gitignored.

## Usage

```bash
./scripts/railway.sh status
./scripts/railway.sh logs
./scripts/railway.sh variables
./scripts/railway.sh up
```

Or:

```bash
npm run railway -- status
```

If you use `npm run railway -- ...`, load `.env.railway.local` in your shell first. The wrapper script loads it automatically.
