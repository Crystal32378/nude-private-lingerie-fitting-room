# NUDE Virtual Showroom

A privacy-first virtual try-on storefront for NUDE intimate apparel, built on
Perfect Corp's YouCam VTO API (`cloth-v4`). Built for the DevNetwork × Perfect Corp
Challenge (API World 2026).

Licensed under the [MIT License](./LICENSE). New work for the WebMCP
Challenge is separated in [WHATS-NEW.md](./WHATS-NEW.md).

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

## Agent tools (WebMCP)

NUDE registers four fitting-room capabilities on `document.modelContext`, so a
visitor's **own** agent can operate the fitting room. There is no NUDE chatbot
and no NUDE stylist; the agent belongs to the person, and NUDE only publishes
what it can do.

One rule governs every return value: **no pixels leave.** An agent can decide
what to try, trigger a real Perfect Corp `cloth-v4` render against the photo
already in this browser, learn that it finished, and hand a prepared shortlist
back — without the photo or any try-on image entering its context. Where an
image field would be, the result carries an explicit statement that it was not
returned, so the absence is visible rather than merely implied.

| Tool | Read/write | What it does |
|---|---|---|
| `nude.list_pieces` | read-only | All nine pieces with the full construction detail — wire, cup, padding, straps, closure, material, structure notes. The catalogue grid on screen shows only name and price; this is what lets an agent answer "smooth under a white shirt" in one call instead of nine navigations. |
| `nude.get_fitting_room_state` | read-only | The redacted fitting room: whether a photo exists, which try-ons were generated and whether each is real, the current shortlist, any preparation already handed over. |
| `nude.try_on` | mutating | Renders one piece onto the stored photo via `cloth-v4`. 10–30s, serialised, one at a time. Returns a `lookId` and whether the render was real. |
| `nude.prepare_fitting_room` | mutating | The final handoff. Hands one to three pieces back with a `brief` (the task in the person's own words) and a `rationale` (why these). **Refuses unless every named piece already has a real generated try-on**, so a prepared fitting room always contains the actual results — it cannot be used to announce a selection that was never rendered. |

### Tools we deliberately did not build

- **`set_person_photo`** — no tool can supply, replace or clear the photo. Only
  the person can, in the browser. This is the point of the boundary, not an
  oversight. (It would also be destructive: changing the photo clears every
  saved look.)
- **`get_look_image`**, or anything returning image bytes — same reason.
- **A NUDE-side chat or stylist agent** — the agent is the visitor's. Shipping
  our own would compete with it and would make the tools decorative.
- **Server-side semantic search** — `list_pieces` returns the attributes and the
  agent does the reasoning. Ranking on our side would take back the work that
  belongs to the agent.
- **Cart, checkout, stock, delivery estimates, gift notes** — NUDE's real
  storefront has these on Shopline; this fitting room does not, and a tool that
  answered "can it arrive Saturday?" from nothing would be a fiction. See
  [FUTURE-DIRECTION.md](./FUTURE-DIRECTION.md).

### Testing the tools

WebMCP is a proposed standard (W3C Web Machine Learning CG). The imperative API
moved from `navigator.modelContext` to `document.modelContext` in May 2026, and
there is no `unregisterTool` — aborting the signal passed to `registerTool` is
how tools are withdrawn. Unsupported browsers no-op and the storefront is
unchanged.

- **ChatGPT desktop** — the in-app browser supports WebMCP by default.
- **Chrome 149+** — enable `chrome://flags/#enable-webmcp-testing` and restart.
  Registered tools appear under DevTools → Application → WebMCP.
- Set `WEBMCP_ORIGIN_TRIAL_TOKEN` to run on stable Chrome without the flag.

A worked sequence:

```
nude.list_pieces                 → pick candidates from the construction detail
nude.try_on { pieceId }          → one real render per call
nude.prepare_fitting_room {      → refuses until the renders above exist
  pieceIds, brief, rationale
}
```

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
