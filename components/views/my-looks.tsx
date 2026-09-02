"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Trash2 } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { Logo } from "@/components/logo";
import { PreparationNote } from "@/components/preparation-note";
import { getProductById } from "@/lib/products";
import { COMPARE_MAX, COMPARE_MIN, useShowroomStore } from "@/lib/store";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MyLooksView() {
  const backToShowroom = useShowroomStore((s) => s.backToShowroom);
  const openProduct = useShowroomStore((s) => s.openProduct);
  const removeLook = useShowroomStore((s) => s.removeLook);
  const looks = useShowroomStore((s) => s.looks);
  const personImage = useShowroomStore((s) => s.personImage);
  const personSavedAt = useShowroomStore((s) => s.personSavedAt);
  const clearLocalData = useShowroomStore((s) => s.clearLocalData);
  const compareIds = useShowroomStore((s) => s.compareIds);
  const toggleCompare = useShowroomStore((s) => s.toggleCompare);
  const clearCompare = useShowroomStore((s) => s.clearCompare);
  const enterCompare = useShowroomStore((s) => s.enterCompare);

  const [lightboxId, setLightboxId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const lightboxLook = looks.find((l) => l.id === lightboxId) ?? null;

  return (
    <div className="view-enter flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background sm:bg-background/85 sm:backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-5 sm:px-8 lg:px-12">
          <button
            onClick={backToShowroom}
            className="label-editorial flex min-w-0 items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft size={14} strokeWidth={1.5} />
            Collection
          </button>
          <Logo height={18} />
          <div className="w-[80px]" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-5 py-14 sm:px-8 lg:px-12">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <p className="label-editorial text-accent-deep">Saved On This Device</p>
            <h1 className="font-display mt-3 text-[1.625rem] font-normal sm:text-[2rem]">My Looks</h1>
            <p className="mt-5 max-w-lg text-[15px] leading-[1.9] tracking-[0.02em] text-muted-foreground">
              Virtual try-on results you&apos;ve kept. They live only in this browser&apos;s
              local storage — your photo is sent to the YouCam try-on service solely to
              generate each fitting, and NUDE never stores it.
            </p>
          </div>
          {(looks.length > 0 || personImage) && (
            <button
              onClick={() => setConfirming(true)}
              className="label-editorial inline-flex items-center gap-2 rounded-sm border border-border px-5 py-3 text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
            >
              <Trash2 size={13} strokeWidth={1.5} />
              Clear Local Data
            </button>
          )}
        </div>

        <PreparationNote />

        {looks.length === 0 ? (
          <div className="mt-20 flex flex-col items-center py-16 text-center">
            <p className="section-title text-muted-foreground">
              No looks yet
            </p>
            <p className="mt-5 max-w-sm text-[15px] leading-[1.9] tracking-[0.02em] text-muted-foreground">
              Try on a piece from the collection and your virtual results will appear here,
              stored only on this device.
            </p>
            <button
              onClick={backToShowroom}
              className="label-editorial mt-8 rounded-sm bg-foreground px-10 py-4 text-background transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Browse Collection
            </button>
          </div>
        ) : (
          <div className="mt-12 grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {looks.map((look) => {
              const product = getProductById(look.productId);
              const selectedForCompare = compareIds.includes(look.id);
              return (
                <motion.article
                  key={look.id}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, ease: EASE }}
                  onClick={() => setLightboxId(look.id)}
                  className="group cursor-pointer"
                >
                  <div
                    className={`relative aspect-[3/4] overflow-hidden rounded-sm bg-secondary/50 ${
                      selectedForCompare ? "outline outline-2 outline-offset-4 outline-accent-deep" : ""
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={look.imageUrl}
                      alt={`Try-on look for ${product?.nameEn ?? look.productId}`}
                      className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                    />
                    <span className="label-editorial absolute left-4 top-4 rounded-sm bg-background/85 px-2.5 py-1 backdrop-blur-sm">
                      {look.tryOnIsReal ? "VTO" : "Preview"}
                    </span>
                    {look.friendPick && (
                      <span className="label-editorial absolute bottom-4 left-4 rounded-sm bg-accent px-2.5 py-1 text-accent-foreground">
                        Friend&apos;s Pick
                      </span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeLook(look.id);
                      }}
                      aria-label="Delete look"
                      className="absolute right-4 top-4 rounded-sm bg-background/85 p-2 text-muted-foreground opacity-0 backdrop-blur-sm transition-all hover:text-destructive group-hover:opacity-100"
                    >
                      <Trash2 size={14} strokeWidth={1.5} />
                    </button>
                  </div>
                  <div className="mt-4 flex items-start justify-between gap-4">
                    <div>
                      <h3 className="product-name">
                        {product?.nameEn ?? look.productId}
                      </h3>
                      <p className="mt-2 text-xs tracking-[0.04em] text-muted-foreground">
                        {formatDate(look.updatedAt)}
                      </p>
                    </div>
                    <div className="mt-1 flex shrink-0 items-center gap-5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCompare(look.id);
                        }}
                        aria-pressed={selectedForCompare}
                        className={`label-editorial inline-flex items-center gap-1.5 transition-colors ${
                          selectedForCompare
                            ? "text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {selectedForCompare && <Check size={12} strokeWidth={1.5} />}
                        {selectedForCompare ? "Selected" : "Compare"}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (product) openProduct(product.id);
                        }}
                        className="label-editorial inline-flex shrink-0 items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
                      >
                        View Product
                        <ArrowRight size={12} strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}

        {personImage && (
          <section className="mt-16 border-t border-border pt-10">
            <h2 className="label-editorial mb-4 text-muted-foreground">Your Photo</h2>
            <div className="flex items-center gap-5">
              <div className="relative h-24 w-20 overflow-hidden rounded-sm bg-secondary/50">
                <Image
                  src={personImage}
                  alt="Your saved photo"
                  fill
                  sizes="80px"
                  className="object-cover"
                  unoptimized
                />
              </div>
              <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
                Saved on this device. It will be reused automatically the next time you try on a
                piece. Changing the photo clears all previously saved looks.
                {personSavedAt && ` Saved ${formatDate(personSavedAt)}.`}
              </p>
            </div>
          </section>
        )}
      </main>

      <AnimatePresence>
        {lightboxLook && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={() => setLightboxId(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-5 backdrop-blur-sm sm:p-10"
          >
            <motion.div
              initial={{ scale: 0.96, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 10 }}
              transition={{ duration: 0.3, ease: EASE }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-h-full w-full max-w-md overflow-y-auto no-scrollbar"
            >
              <button
                onClick={() => setLightboxId(null)}
                aria-label="Close"
                className="label-editorial absolute -top-2 right-0 z-10 translate-y-[-100%] text-2xl leading-none text-muted-foreground transition-colors hover:text-foreground"
              >
                ×
              </button>
              <div className="relative aspect-[3/4] overflow-hidden rounded-sm bg-secondary/50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={lightboxLook.imageUrl}
                  alt="Saved try-on look"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="mt-5 flex items-center justify-between gap-4">
                <div>
                  <span className="label-editorial text-muted-foreground">
                    {lightboxLook.tryOnIsReal ? "Virtual Try-On" : "Preview"}
                  </span>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Saved {formatDate(lightboxLook.updatedAt)}
                  </p>
                </div>
                <button
                  onClick={() => {
                    const product = getProductById(lightboxLook.productId);
                    if (product) {
                      setLightboxId(null);
                      openProduct(product.id);
                    }
                  }}
                  className="label-editorial inline-flex items-center gap-1.5 text-foreground underline underline-offset-4"
                >
                  View Product
                  <ArrowRight size={12} strokeWidth={1.5} />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {compareIds.length > 0 && (
          <motion.div
            initial={{ y: 90, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 90, opacity: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-5 pb-6"
          >
            <div className="pointer-events-auto flex items-center gap-7 rounded-sm border border-border bg-card/95 py-4 pl-7 pr-4 shadow-xl backdrop-blur-md">
              <span className="label-editorial text-muted-foreground">
                {compareIds.length} selected · pick {COMPARE_MIN}–{COMPARE_MAX}
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={clearCompare}
                  className="label-editorial rounded-sm px-5 py-3 text-muted-foreground transition-colors hover:text-foreground"
                >
                  Clear
                </button>
                <button
                  onClick={enterCompare}
                  disabled={compareIds.length < COMPARE_MIN}
                  className="label-editorial rounded-sm bg-foreground px-8 py-3.5 text-background transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Compare{compareIds.length >= COMPARE_MIN ? "" : ` (${COMPARE_MIN} needed)`}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirming && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-5 backdrop-blur-sm"
            onClick={() => setConfirming(false)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 8 }}
              transition={{ duration: 0.25, ease: EASE }}
              onClick={(e) => e.stopPropagation()}
              role="alertdialog"
              aria-modal="true"
              className="w-full max-w-sm rounded-sm border border-border bg-card p-7 shadow-xl"
            >
              <h2 className="font-display text-lg font-normal">Clear all local data?</h2>
              <p className="mt-3 text-[13px] leading-[1.9] tracking-[0.02em] text-muted-foreground">
                This permanently removes your saved photo and all saved looks from this browser.
                The action cannot be undone.
              </p>
              <div className="mt-7 flex justify-end gap-3">
                <button
                  onClick={() => setConfirming(false)}
                  className="label-editorial rounded-sm border border-border px-5 py-3 text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    await clearLocalData();
                    setConfirming(false);
                  }}
                  className="label-editorial rounded-sm bg-destructive px-5 py-3 text-white transition-opacity hover:opacity-90"
                >
                  Clear Everything
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
