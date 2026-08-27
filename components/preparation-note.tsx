"use client";

import { Sparkles } from "lucide-react";
import { getProductById } from "@/lib/products";
import { currentPreparation, useShowroomStore } from "@/lib/store";

/**
 * What an agent left behind when it prepared this fitting room: the task in the
 * person's own words, why these pieces, and the pieces themselves. This is the
 * far side of the handoff — she may be reading it hours after she asked.
 *
 * Visual treatment is deliberately plain; restyle freely. The data contract is
 * `currentPreparation()` in lib/store.ts.
 */
export function PreparationNote() {
  const looks = useShowroomStore((s) => s.looks);
  const preparation = currentPreparation(looks);
  if (!preparation) return null;

  const names = preparation.pieceIds
    .map((id) => getProductById(id)?.nameEn)
    .filter(Boolean)
    .join("  ·  ");

  return (
    <section className="mt-10 rounded-sm border border-border bg-secondary/30 p-6 sm:p-7">
      <p className="label-editorial flex items-center gap-2 text-accent-deep">
        <Sparkles size={13} strokeWidth={1.5} />
        Prepared by your agent
      </p>
      <p className="font-display mt-3 text-[1.0625rem] leading-[1.6] sm:text-[1.125rem]">
        {preparation.brief}
      </p>
      <p className="mt-3 max-w-2xl text-[15px] leading-[1.9] tracking-[0.02em] text-muted-foreground">
        {preparation.rationale}
      </p>
      {names && <p className="label-editorial mt-5 text-muted-foreground">{names}</p>}
    </section>
  );
}
