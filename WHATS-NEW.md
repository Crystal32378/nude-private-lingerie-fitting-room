# What's new — WebMCP agent layer

This repository contains a pre-existing project. This file separates the work
added for the WebMCP Challenge from what already existed, as the Official Rules
require.

## The dividing line

| | |
|---|---|
| WebMCP Challenge Submission Period opens | **25 Aug 2026, 11:00 PT** |
| Last commit before that date | **`adaad67`, 22 Aug 2026** |
| First WebMCP commit | see the table below |

There is no ambiguity to resolve: the repository was untouched between 22 Aug
and the opening of the Submission Period. Every commit dated on or after
27 Aug 2026 is Challenge work.

## Pre-existing work — NOT part of this submission

Built 21–22 Aug 2026, nine commits, `9a45634`…`adaad67`. This is the consumer
product the agent layer sits on top of, and it is **not** offered for judging:

- The nine-piece showroom, product detail and try-on views
- Perfect Corp `cloth-v4` virtual try-on via `app/api/tryon/route.ts`
- My Looks, on-device persistence in IndexedDB
- Compare (A/B/C side by side) and Ask a Friend
- Rate limiting and input caps on the try-on endpoint

## WebMCP work — this submission

| Commit | Date | What |
|---|---|---|
| `3c34b30` | 27 Aug 2026 | `refactor: lift runTryOn from TryOnFlow into the showroom store` — zero behaviour change, prerequisite for making try-on agent-callable |
| `b735da5` | 27 Aug 2026 | `feat(webmcp): fitting-room capabilities on document.modelContext` |
| `0dba601` | 27 Aug 2026 | `feat(webmcp): correctness-first tool surface, verified against real cloth-v4` |
| _this commit_ | 27 Aug 2026 | `feat(webmcp): renderable colourways, so a colour brief can be delivered not just disclosed` |

### Files added

```
lib/webmcp/capabilities.ts             the five capability handlers
components/webmcp/model-context-tools.tsx   registration on document.modelContext
components/preparation-note.tsx        renders the agent's handoff to the person
public/garments/*.jpg                  nude-colourway render references (cloth-v4 inputs)
LICENSE  WHATS-NEW.md  FUTURE-DIRECTION.md
```

### Files changed

```
lib/store.ts        + runTryOn action, + prepareFittingRoom action, + currentPreparation()
lib/storage.ts      + PreparedBy on SavedLook (no IndexedDB version change)
app/layout.tsx      mounts <ModelContextTools />, optional origin-trial meta
components/views/my-looks.tsx, compare.tsx    render <PreparationNote />
.env.example        documents WEBMCP_ORIGIN_TRIAL_TOKEN
README.md           WebMCP section
```

### Not changed

`app/api/tryon/route.ts` · `lib/products.ts` · `lib/share-card.ts` ·
`components/views/{showroom,product-detail,tryon}.tsx` — the try-on pipeline,
the catalogue and the existing consumer flows are untouched.
