"use client";

import { ArrowLeft, ArrowUpRight, ExternalLink } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { getProductById } from "@/lib/products";
import { useShowroomStore } from "@/lib/store";
import { SavedLook } from "@/lib/storage";

export function ProductDetailView() {
  const selectedProductId = useShowroomStore((s) => s.selectedProductId);
  const backToShowroom = useShowroomStore((s) => s.backToShowroom);
  const startTryOn = useShowroomStore((s) => s.startTryOn);
  const openMyLooks = useShowroomStore((s) => s.openMyLooks);
  const looksCount = useShowroomStore((s) => s.looks.length);
  const getCachedLook = useShowroomStore((s) => s.getCachedLook);

  const [cached, setCached] = useState<SavedLook | null>(null);

  const product = selectedProductId ? getProductById(selectedProductId) : undefined;

  useEffect(() => {
    let active = true;
    if (product) {
      getCachedLook(product.id).then((look) => {
        if (active) setCached(look);
      });
    }
    return () => {
      active = false;
    };
  }, [product, getCachedLook]);

  if (!product) return null;

  const construction: Array<[string, string]> = [
    ["Category", product.category],
    ["Wire", product.wire],
    ["Cup", product.cup],
    ["Padding", product.padding],
    ["Straps", product.straps],
    ["Closure", product.closure],
    ["Material", product.material],
  ];

  return (
    <div className="view-enter flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background sm:bg-background/85 sm:backdrop-blur-md">
        <div className="mx-auto flex h-[72px] max-w-[1500px] items-center justify-between px-5 sm:px-8 lg:px-12">
          <button
            onClick={backToShowroom}
            className="label-editorial flex min-w-0 items-center gap-2.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft size={13} strokeWidth={1.5} />
            Collection
          </button>
          <Logo height={16} />
          <button
            onClick={openMyLooks}
            className="label-editorial shrink-0 whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground"
          >
            My Looks{looksCount > 0 ? ` · ${looksCount}` : ""}
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1500px] flex-1 px-5 py-12 sm:px-8 sm:py-16 lg:px-12">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-20">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <div className="relative aspect-[4/5] overflow-hidden rounded-sm bg-secondary/50">
              <Image
                src={product.displayImage}
                alt={`${product.nameZh} ${product.nameEn}`}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority
                className="img-fade-in object-cover"
              />
            </div>
            {product.structureNotes && (
              <p className="mt-4 text-[13px] italic leading-[1.9] tracking-[0.02em] text-muted-foreground">
                {product.structureNotes}
              </p>
            )}
          </div>

          <div className="pb-20 lg:max-w-xl">
            <p className="label-editorial text-accent-deep">{product.category}</p>
            <h1 className="font-display mt-5 text-[1.625rem] font-normal leading-[1.35] sm:text-[2rem]">
              {product.nameEn}
            </h1>
            <p className="mt-3 text-sm tracking-[0.04em] text-muted-foreground">{product.nameZh}</p>
            <p className="mt-7 font-display text-xl tabular-nums">{product.priceLabel}</p>

            <p className="mt-9 text-[15px] leading-[2] tracking-[0.02em] text-foreground/75">
              {product.description}
            </p>

            <section className="mt-12 border-t border-border pt-10">
              <h2 className="label-editorial mb-8 text-muted-foreground">Construction</h2>
              <dl className="flex flex-col gap-5">
                {construction.map(([label, value]) => (
                  <div
                    key={label}
                    className="flex flex-col gap-1 border-b border-border/50 pb-4 sm:flex-row sm:items-baseline sm:gap-8"
                  >
                    <dt className="label-editorial w-28 shrink-0 !tracking-[0.22em] text-muted-foreground">
                      {label}
                    </dt>
                    <dd className="text-sm leading-[1.9] tracking-[0.03em]">{value || "—"}</dd>
                  </div>
                ))}
              </dl>
            </section>

            {/* Catalogue information, not controls. Boxed chips read as selectable
                and testers tried to click them; rendered as plain text alongside
                Construction, which is what this data is. */}
            <section className="mt-10">
              <h2 className="label-editorial mb-3 text-muted-foreground">Available colours</h2>
              <p className="text-sm leading-[1.9] tracking-[0.03em]">
                {product.colors.join(" · ") || "—"}
              </p>
            </section>

            <section className="mt-8">
              <h2 className="label-editorial mb-3 text-muted-foreground">Available sizes</h2>
              <p className="text-sm leading-[1.9] tracking-[0.03em] tabular-nums">
                {product.sizes.join(" · ") || "—"}
              </p>
            </section>

            <div className="mt-14 hidden flex-col items-start gap-5 sm:flex">
              <button
                onClick={() => startTryOn(product.id)}
                className="label-editorial rounded-none bg-foreground px-14 py-4 text-background transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                Try On Me{cached ? " · Cached" : ""}
              </button>
              <button
                onClick={backToShowroom}
                className="label-editorial border-b border-transparent pb-0.5 text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                Back to Collection
              </button>
            </div>

            <a
              href={product.productUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="label-editorial mt-10 inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
            >
              <ExternalLink size={12} strokeWidth={1.5} />
              View on nude4underwear.com
              <ArrowUpRight size={12} strokeWidth={1.5} />
            </a>
          </div>
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-background/95 backdrop-blur-md sm:hidden">
        <button
          onClick={backToShowroom}
          className="label-editorial flex-1 py-4 text-muted-foreground"
        >
          Back
        </button>
        <button
          onClick={() => startTryOn(product.id)}
          className="label-editorial flex-[2] bg-foreground py-4 text-background"
        >
          Try On Me
        </button>
      </div>
    </div>
  );
}
