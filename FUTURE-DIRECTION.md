# Future direction

> **Not implemented in this submission.** Everything below is deliberately out
> of scope for the WebMCP Challenge. It is recorded so the direction is legible
> and so the next step does not have to be re-derived.

What ships today is a **single-brand reference implementation**: four
capabilities on one fitting room, complete and working end to end. The
direction below is the order in which we think it should grow, hardest
constraint first.

## 1. Single-brand reference implementation — *current submission*

Four capabilities on `document.modelContext`, one real generative try-on
pipeline, one privacy boundary. Deliberately narrow.

## 2. Close the loop to real commerce

NUDE is a real brand with a real storefront. Its catalogue, stock,
availability and checkout already exist on Shopline, with an existing customer
base and repeat buyers — **none of which is connected to this fitting room.**

The interesting property of that gap: the hardest part of buying intimate
apparel online is the *first* purchase, because of sizing. NUDE's returning
customers are already past it. What remains for them is which construction, and
whether it shows under a particular shirt — which is what virtual try-on
answers, and what an agent can prepare while they are at work.

So the next step is not new invention, it is connecting two systems that both
already exist: agent prepares the fitting room → the person returns and
decides → she continues into the existing Shopline inventory and checkout.

Deliberately not attempted in a seven-day window.

## 3. Generalise the four capabilities

The four tools here are not NUDE-specific in shape:

- list what the brand sells, with the construction detail the catalogue page hides
- read the fitting room, redacted
- render one piece onto a photo that never leaves the browser
- hand a prepared shortlist back to the person, with the task restated

That is a plausible **fitting-room capability interface** any apparel brand
could adopt. Worth extracting only after it has been proven on one brand.

## 4. A user-owned, multi-brand private fitting room

The end state, and the one that makes WebMCP more than a per-site convenience:
the person's agent visits several brands, each exposing its own tools, and
brings candidates back into **one private fitting room that belongs to her, not
to any brand**.

The privacy boundary is what makes this coherent rather than alarming: her
agent walks through three brands, none of them sees her, and neither does the
agent.

Three things must be true first, and none of them are today:

1. Other brands must expose fitting-room tools. Shopify auto-registers WebMCP
   catalogue tools on Liquid storefronts, so the search half is nearer than the
   try-on half.
2. Cross-origin tool access (`exposedTo` / `fromOrigins`) needs real client
   support. WebMCP tools are page-scoped and ephemeral today — they exist only
   while the page is open.
3. Rendering another brand's garment onto a person's body requires that
   brand's permission. This is a rights question before it is a technical one,
   and we are not going to skip it.

Attempting this now would trade a complete product for incomplete
infrastructure. Recorded as the destination, not the next commit.
