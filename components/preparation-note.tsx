"use client";

import { Sparkles } from "lucide-react";
import { getProductById } from "@/lib/products";
import { currentPreparation, useShowroomStore } from "@/lib/store";

/**
 * What an agent left behind when it prepared this fitting room: the task in the
 * person's own words, what each piece does for it, and anything the agent could
 * not confirm. This is the far side of the handoff — she may be reading it
 * hours after she asked.
 *
 * Visual treatment is deliberately plain; restyle freely. The data contract is
 * `currentPreparation()` in lib/store.ts.
 */
export function PreparationNote() {
  const looks = useShowroomStore((s) => s.looks);
  const preparation = currentPreparation(looks);
  if (!preparation) return null;

  return (
    <section className="mt-10 rounded-sm border border-border bg-secondary/30 p-6 sm:p-7">
      <p className="label-editorial flex items-center gap-2 text-accent-deep">
        <Sparkles size={13} strokeWidth={1.5} />
        Prepared by your agent
      </p>
      <p className="font-display mt-3 text-[1.0625rem] leading-[1.6] sm:text-[1.125rem]">
        {preparation.brief}
      </p>

      {/* A tester read the reasons below and concluded the agent had seen her
          photo. It had not — but the correction has to stay inside what the
          contract guarantees. `prepare_fitting_room` stores whatever `why` the
          agent supplies; it does not verify where the agent derived it from. So
          this attributes the reasons to the agent, and claims nothing about
          their source. The second sentence is the approved capability claim, not
          a verbatim quote of PERSONAL_IMAGE. */}
      <p className="mt-4 max-w-2xl text-[13px] leading-[1.8] tracking-[0.02em] text-muted-foreground">
        <span className="label-editorial text-accent-deep">Why these picks — </span>
        Your agent provided the reasons below. No photo of the person and no try-on
        result is returned through WebMCP tools.
      </p>

      <ul className="mt-5 space-y-3">
        {preparation.pieces.map(({ lookId, pieceId, why }) => (
          <li key={lookId} className="max-w-2xl">
            <p className="label-editorial text-foreground/80">
              {getProductById(pieceId)?.nameEn ?? pieceId}
            </p>
            <p className="mt-1 text-[15px] leading-[1.8] tracking-[0.02em] text-muted-foreground">
              {why}
            </p>
          </li>
        ))}
      </ul>

      {preparation.caveat && (
        <p className="mt-5 max-w-2xl border-t border-border/70 pt-4 text-[14px] leading-[1.8] tracking-[0.02em] text-muted-foreground">
          <span className="label-editorial text-accent-deep">Not confirmed — </span>
          {preparation.caveat}
        </p>
      )}
    </section>
  );
}
