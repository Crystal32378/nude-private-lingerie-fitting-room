# NUDE Virtual Showroom

A privacy-first virtual try-on storefront for NUDE intimate apparel, built on
Perfect Corp's YouCam VTO API (`cloth-v4`). Built for the DevNetwork × Perfect Corp
Challenge (API World 2026).

Licensed under the [MIT License](./LICENSE) — code only. NUDE product names,
copy and garment imagery are the property of NUDE and are not covered by that
licence; the garment photography referenced by this application is served from
NUDE's own storefront CDN. New work for the WebMCP Challenge is separated in
[WHATS-NEW.md](./WHATS-NEW.md).

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

NUDE registers five fitting-room capabilities on `document.modelContext`, so a
visitor's **own** agent can operate the fitting room. There is no NUDE chatbot
and no NUDE stylist; the agent belongs to the person, and NUDE only publishes
what it can do.

### The principle: correctness before speed

A fitting room is finished work, not a fast answer. Buying a bra in a shop
takes an hour, and most of that hour is somebody going into the stockroom to
find the right construction in the right colour. The tools here are shaped for
an agent doing that same work:

1. read the construction data for the whole range,
2. drill into the pieces that look plausible and see the **actual garment asset
   a render will use**,
3. render one piece at a time,
4. check the result against the original brief,
5. and only then hand the fitting room over — with a reason for each piece and
   an explicit note about anything it could not confirm.

An agent that takes twenty minutes and gets it right is behaving correctly. An
agent that renders something misleading in thirty seconds is not.
`prepare_fitting_room` enforces the shape of this rather than trusting it.

### Two rules about images, and they are different

> **1. No photo of the person and no try-on result is returned through these
> tools.**

That is a claim about this interface, and only about this interface. It is *not*
a claim about the try-on pipeline — rendering a fitting requires sending the
photo to Perfect Corp's YouCam service, which is what the Privacy section below
describes. Where such a field would sit, the result states explicitly that none
was returned, so the absence is visible rather than merely implied.

> **2. Garment imagery and product pages are exposed on purpose.**

They are NUDE's own public product photography, not anybody's private data, and
an agent needs them to know what it is about to render. Withholding them would
only make it guess — which is exactly the failure this layer is built to avoid.

### The five tools

| Tool | Read/write | What it does |
|---|---|---|
| `nude.list_pieces` | read-only | All nine pieces with the construction detail the catalogue grid hides — wire, cup, padding, straps, closure, material, structure notes — plus each product page URL. Explicitly labelled as a starting point, not an answer. |
| `nude.get_piece` | read-only | One piece in full, **including the garment image a try-on will actually send to `cloth-v4`**. This is the stockroom step: it is where an agent finds out that the colour it was about to promise is not the colour that will render. |
| `nude.get_fitting_room_state` | read-only | The redacted fitting room: whether a photo exists, which try-ons were generated and whether each is real, the current shortlist, any preparation already handed over. |
| `nude.try_on` | mutating | Renders one piece onto the stored photo via `cloth-v4`. 10–30s, serialised — parallel calls are refused rather than raced. Returns a `lookId` and whether the render was real. |
| `nude.prepare_fitting_room` | mutating | The handoff, and the last step. |

### What `prepare_fitting_room` refuses

It is the correctness gate, not a formatting step:

- **No render, no handoff.** Every named piece must *already* have a real
  generated try-on saved. It cannot announce "I picked three for you" while the
  renders are missing, incomplete, or attached to the wrong piece.
- **No blanket rationale.** Every piece needs its own `why`, citing the
  construction detail it relied on. Three plausible names and one sentence is
  rejected.
- **Somewhere to be honest.** An optional `caveat` carries anything the agent
  could not confirm — a colour the render cannot honour, a requirement only one
  piece truly meets, a piece included as the nearest available option. The field
  is generously sized on purpose: a tight limit would force an agent to truncate
  exactly the disclosure it exists for.

The `brief` is the task restated in the person's own words. She may be reading
it eight hours after she asked, and what carries her across that gap is her own
sentence coming back to her — not the agent's reasoning.

### Tools we deliberately did not build

- **`set_person_photo`** — no tool can supply, replace or clear the photo. Only
  the person can, in the browser. This is the point of the boundary, not an
  oversight. (It would also be destructive: changing the photo clears every
  saved look.)
- **Anything returning the try-on result image** — same reason.
- **A NUDE-side chat or stylist agent** — the agent is the visitor's. Shipping
  our own would compete with it and make the tools decorative.
- **Server-side semantic search or ranking** — `list_pieces` and `get_piece`
  return the attributes and the agent does the reasoning. Ranking on our side
  would take back the work that belongs to the agent.
- **Cart, checkout, stock, delivery estimates, gift notes** — NUDE's real
  storefront has these; this fitting room does not, and a tool that answered
  "can it arrive Saturday?" from nothing would be a fiction. See
  [FUTURE-DIRECTION.md](./FUTURE-DIRECTION.md).

### What we learned building it, including the part that went wrong

The tool layer was tested by using it, and the first pass got the shopping
wrong. It is worth recording, because it is the clearest evidence that this is
a piece of work rather than a single call:

1. For a brief of *nude-toned, plain, no visible line under a white shirt*, the
   first shortlist included `nude-09 Strapless Convertible` — chosen from the
   name. Its actual data says `兩段立體車縫` (a two-panel seam) and a 5/8 shallow
   cup: **the two things that produce a visible line under a shirt.** Reading
   the fields instead of the name replaced it with `nude-03`.
2. For a brief of *cannot reach behind my back*, the first shortlist included
   `nude-07 Lace Bandeau` — again from the name. Its `closure` field says
   `back (２排３段)`. Only two pieces in the nine are true front-closure.
3. Three renders came back **black** while the brief asked for nude tones,
   because each piece has exactly one reference garment image and for those
   pieces it is the black colourway. Nothing was broken; the delivery was simply
   wrong.

Three fixes followed, and they are why the interface looks the way it does:
`get_piece` exists so the render asset is visible *before* rendering;
`list_pieces` states plainly that `colors` is a purchase list and not something
a try-on can honour; and `caveat` exists so the honest version of point 3 has
somewhere to go.

No amount of validation catches a bad pick. What the interface can do is make
the deciding fields impossible to miss and make overclaiming awkward.

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
nude.list_pieces                     → read the construction fields
nude.get_piece { pieceId } × N       → look at what will actually render
nude.try_on { pieceId }              → one real render per call, ~10-30s
nude.prepare_fitting_room {          → refuses until those renders exist
  brief,
  pieces: [{ pieceId, why }],
  caveat
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
