# NUDE Virtual Showroom

A privacy-first virtual try-on storefront for NUDE intimate apparel, built on
Perfect Corp's YouCam VTO API (`cloth-v4`). Built for the DevNetwork × Perfect Corp
Challenge (API World 2026).

## Stack

Next.js 15 · React 19 · Tailwind 4 · Zustand · Framer Motion

## Setup

```bash
npm install
cp .env.example .env.local   # add your YOUCAM_API_KEY
npm run dev
```

Without `YOUCAM_API_KEY` the app still runs: `/api/tryon` returns a graceful
fallback and the client renders a side-by-side preview instead of a rendered VTO.

## Privacy & data flow

- Your photo is stored **only in this browser** (IndexedDB), downscaled client-side
  before use.
- A try-on request sends the photo to Perfect Corp's YouCam VTO API purely to render
  the result. The server processes requests in memory and **never persists photos or
  results**.
- Finished looks are saved back to this device only. "Clear Local Data" in My Looks
  wipes everything.

## API protection (`/api/tryon`)

- Per-IP rate limit: 10 requests / 5 minutes → `429` with `Retry-After`
- Body limit: 10 MB per request; 6 MB per image file → `413`
- Garment category whitelist; malformed requests rejected before any upstream call
- All guards fail closed

## Known vulnerabilities (assessed, intentionally not patched)

`npm audit` reports 3 high-severity findings, all inherited transitively via
`next@15`: `postcss <=8.5.22` (build-time CSS processing) and `sharp <0.35`
(libvips CVEs, used only to optimize first-party static assets — user photos travel
as data URLs marked `unoptimized` and never pass through sharp). Both attack vectors
require attacker-controlled input at build time or through the image optimizer,
which this app does not expose. The only fix path is the breaking `next@16` major
upgrade, deliberately deferred post-hackathon.

## Scripts

```bash
npm run build   # production build + typecheck
npm start       # serve production build
```
