"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Download, Share, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Logo } from "@/components/logo";
import { getProductById, type Product } from "@/lib/products";
import {
  buildShareMessage,
  composeCompareCard,
  downloadBlob,
  shareCompareCard,
  slotList,
} from "@/lib/share-card";
import { COMPARE_MIN, useShowroomStore } from "@/lib/store";
import type { SavedLook } from "@/lib/storage";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const SLOT_LETTERS = ["A", "B", "C"];

function formatCategory(category: string): string {
  const short = category
    .replace(/^bra\s*\(/i, "")
    .replace(/\)$/, "")
    .trim();
  if (!short || short === "bra") return "Bra";
  return short
    .split(" ")
    .map((word) =>
      word
        .split("/")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join("/")
    )
    .join(" ");
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type CardState =
  | { status: "working" }
  | { status: "ready"; blob: Blob; url: string }
  | { status: "error" };

export function CompareView() {
  const exitCompare = useShowroomStore((s) => s.exitCompare);
  const toggleCompare = useShowroomStore((s) => s.toggleCompare);
  const recordFriendPick = useShowroomStore((s) => s.recordFriendPick);
  const openProduct = useShowroomStore((s) => s.openProduct);
  const looks = useShowroomStore((s) => s.looks);
  const compareIds = useShowroomStore((s) => s.compareIds);

  const selected = compareIds
    .map((id) => looks.find((l) => l.id === id))
    .filter((l): l is SavedLook => Boolean(l));

  const cardKey = selected.map((l) => `${l.id}:${l.updatedAt}`).join("|");
  const [card, setCard] = useState<CardState>({ status: "working" });
  const [note, setNote] = useState<string | null>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashNote = useCallback((message: string) => {
    setNote(message);
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => setNote(null), 6_000);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    setCard({ status: "working" });
    const inputs = selected.map((look, i) => ({
      imageUrl: look.imageUrl,
      label: SLOT_LETTERS[i],
      nameEn: getProductById(look.productId)?.nameEn ?? look.productId,
      nameZh: getProductById(look.productId)?.nameZh ?? "",
      priceLabel: getProductById(look.productId)?.priceLabel ?? "",
      categoryLabel: formatCategory(getProductById(look.productId)?.category ?? ""),
    }));
    composeCompareCard(inputs)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setCard({ status: "ready", blob, url });
      })
      .catch(() => {
        if (!cancelled) setCard({ status: "error" });
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardKey]);

  useEffect(() => {
    return () => {
      if (noteTimer.current) clearTimeout(noteTimer.current);
    };
  }, []);

  if (selected.length < COMPARE_MIN) {
    return (
      <div className="view-enter flex min-h-screen flex-col">
        <CompareHeader />
        <main className="mx-auto flex w-full max-w-[1400px] flex-1 items-center justify-center px-5 py-14 sm:px-8 lg:px-12">
          <div className="max-w-md text-center">
            <p className="section-title text-muted-foreground">Nothing to compare yet</p>
            <p className="mt-5 text-[15px] leading-[1.9] tracking-[0.02em] text-muted-foreground">
              Select two or three saved looks in My Looks to see them side by side.
            </p>
            <button
              onClick={exitCompare}
              className="label-editorial mt-8 rounded-sm bg-foreground px-10 py-4 text-background transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Back to My Looks
            </button>
          </div>
        </main>
      </div>
    );
  }

  const handleRemove = (id: string) => {
    toggleCompare(id);
    if (selected.length - 1 < COMPARE_MIN) exitCompare();
  };

  const handleShare = async () => {
    if (card.status !== "ready") return;
    try {
      const message = buildShareMessage(selected.length);
      const result = await shareCompareCard(card.blob, message);
      if (result.outcome === "shared") {
        flashNote("Sent — the conversation continues in your chat.");
      } else if (result.outcome === "downloaded") {
        flashNote(
          result.messageCopied
            ? "Card downloaded and message copied — paste both into your chat."
            : `Card downloaded, but the message couldn't be copied on this browser — paste the card into your chat and ask your friend to reply ${slotList(selected.length)}.`
        );
      }
    } catch {
      flashNote("Sharing didn't go through here — try downloading the card instead.");
    }
  };

  const handleDownload = () => {
    if (card.status !== "ready") return;
    downloadBlob(card.blob, "nude-compare.jpg");
    flashNote("Card downloaded — it lives only on this device.");
  };

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(buildShareMessage(selected.length));
      flashNote("Message copied to clipboard.");
    } catch {
      flashNote("Couldn't reach the clipboard on this browser.");
    }
  };

  const pickedLook = selected.find((l) => l.friendPick) ?? null;

  return (
    <div className="view-enter flex min-h-screen flex-col">
      <CompareHeader />

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-5 py-14 sm:px-8 lg:px-12">
        <div>
          <p className="label-editorial text-accent-deep">Saved On This Device</p>
          <h1 className="font-display mt-3 text-[1.625rem] font-normal sm:text-[2rem]">
            Compare
          </h1>
          <p className="mt-5 max-w-lg text-[15px] leading-[1.9] tracking-[0.02em] text-muted-foreground">
            Your shortlist, side by side — silhouette, construction and price in one
            view, so the differences can speak for themselves.
          </p>
        </div>

        <div
          className={`mt-12 grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 ${
            selected.length >= 3 ? "lg:grid-cols-3" : ""
          }`}
        >
          {selected.map((look, i) => (
            <CompareColumn
              key={look.id}
              letter={SLOT_LETTERS[i]}
              look={look}
              onRemove={() => handleRemove(look.id)}
              onViewProduct={() => {
                const product = getProductById(look.productId);
                if (product) openProduct(product.id);
              }}
            />
          ))}
        </div>

        {/* Ask a Friend */}
        <section className="mt-24 border-t border-border pt-14">
          <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-[380px_minmax(0,1fr)]">
            <div className="mx-auto w-full max-w-sm rounded-sm border border-border bg-secondary/30 p-4">
              {card.status === "ready" ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={card.url}
                  alt="Comparison card preview"
                  className="img-fade-in w-full rounded-sm"
                />
              ) : (
                <div className="flex aspect-[3/4] w-full items-center justify-center rounded-sm bg-secondary/50">
                  <span className="label-editorial text-muted-foreground">
                    {card.status === "working" ? "Composing…" : "Preview unavailable"}
                  </span>
                </div>
              )}
            </div>

            <div className="max-w-xl">
              <p className="label-editorial text-muted-foreground">Ask a Friend</p>
              <h2 className="font-display mt-3 text-xl font-normal sm:text-2xl">
                A second opinion, right in your chat
              </h2>
              <p className="mt-5 text-[15px] leading-[1.9] tracking-[0.02em] text-muted-foreground">
                Send the card to someone whose taste you trust. They see your looks at a
                glance and can simply reply A, B or C — the conversation happens where you
                already talk.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <button
                  onClick={handleShare}
                  disabled={card.status !== "ready"}
                  className="label-editorial inline-flex items-center gap-2 rounded-sm bg-foreground px-8 py-3.5 text-background transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Share size={13} strokeWidth={1.5} />
                  Share…
                </button>
                <button
                  onClick={handleDownload}
                  disabled={card.status !== "ready"}
                  className="label-editorial inline-flex items-center gap-2 rounded-sm border border-border px-8 py-3.5 text-muted-foreground transition-colors hover:border-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Download size={13} strokeWidth={1.5} />
                  Download Card
                </button>
                <button
                  onClick={handleCopyMessage}
                  className="label-editorial inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  Copy Message
                  <ArrowRight size={12} strokeWidth={1.5} />
                </button>
              </div>

              <AnimatePresence>
                {note && (
                  <motion.p
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="mt-6 text-[13px] leading-relaxed text-foreground"
                  >
                    {note}
                  </motion.p>
                )}
              </AnimatePresence>

              <p className="mt-8 border-t border-border/70 pt-5 text-xs leading-[1.9] tracking-[0.02em] text-muted-foreground">
                The card is composed entirely on your device — it is never uploaded to or
                stored on NUDE servers. What happens after you send it is up to you and
                your messaging app.
              </p>
            </div>
          </div>
        </section>

        {/* Friend's Pick */}
        <section className="mt-20 border-t border-border pt-14 pb-10">
          <div className="max-w-xl">
            <p className="label-editorial text-muted-foreground">Friend&apos;s Pick</p>
            <h2 className="font-display mt-3 text-xl font-normal sm:text-2xl">
              Which piece did they lean toward?
            </h2>
            <p className="mt-5 text-[15px] leading-[1.9] tracking-[0.02em] text-muted-foreground">
              Once your friend has weighed in, note their answer here for yourself. It
              stays on this device and marks the look wherever it appears.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              {selected.map((look, i) => {
                const picked = Boolean(look.friendPick);
                return (
                  <button
                    key={look.id}
                    onClick={() => recordFriendPick(look.id)}
                    aria-pressed={picked}
                    className={`label-editorial inline-flex items-center gap-2.5 rounded-sm border px-6 py-3.5 transition-colors ${
                      picked
                        ? "border-foreground bg-foreground text-background"
                        : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                    }`}
                  >
                    <span className="font-display">{SLOT_LETTERS[i]}</span>
                    {getProductById(look.productId)?.nameEn ?? look.productId}
                    {picked && <Check size={13} strokeWidth={1.5} />}
                  </button>
                );
              })}
            </div>

            {pickedLook && (
              <p className="mt-6 text-[13px] tracking-[0.02em] text-muted-foreground">
                Recorded: {getProductById(pickedLook.productId)?.nameEn ?? pickedLook.productId}
                {" · "}
                {formatDate(pickedLook.friendPick!)}. Tap another piece to update it.
              </p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function CompareHeader() {
  const exitCompare = useShowroomStore((s) => s.exitCompare);
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-5 sm:px-8 lg:px-12">
        <button
          onClick={exitCompare}
          className="label-editorial flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={14} strokeWidth={1.5} />
          My Looks
        </button>
        <Logo height={18} />
        <div className="w-[80px]" />
      </div>
    </header>
  );
}

function CompareColumn({
  letter,
  look,
  onRemove,
  onViewProduct,
}: {
  letter: string;
  look: SavedLook;
  onRemove: () => void;
  onViewProduct: () => void;
}) {
  const product: Product | undefined = getProductById(look.productId);
  const specs: Array<[string, string]> = product
    ? [
        ["Wire", product.wire],
        ["Cup", product.cup],
        ["Padding", product.padding],
        ["Straps", product.straps],
        ["Closure", product.closure],
        ["Material", product.material],
      ]
    : [];

  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: EASE }}
    >
      <div className="group relative aspect-[3/4] overflow-hidden rounded-sm bg-secondary/50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={look.imageUrl}
          alt={`Try-on look ${letter}: ${product?.nameEn ?? look.productId}`}
          className="h-full w-full object-cover"
        />
        <span className="label-editorial absolute left-4 top-4 rounded-sm bg-background/85 px-2.5 py-1 backdrop-blur-sm">
          {letter}
        </span>
        {look.friendPick && (
          <span className="label-editorial absolute bottom-4 left-4 rounded-sm bg-accent px-2.5 py-1 text-accent-foreground">
            Friend&apos;s Pick
          </span>
        )}
        <button
          onClick={onRemove}
          aria-label={`Remove ${product?.nameEn ?? "look"} from comparison`}
          className="absolute right-4 top-4 rounded-sm bg-background/85 p-2 text-muted-foreground opacity-0 backdrop-blur-sm transition-all hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
        >
          <X size={14} strokeWidth={1.5} />
        </button>
      </div>

      <div className="mt-5 text-center">
        <h3 className="product-name">{product?.nameEn ?? look.productId}</h3>
        <p className="mt-2 text-sm tracking-[0.05em] text-muted-foreground">
          {product?.nameZh}
        </p>
        <p className="mt-2 text-xs tracking-[0.04em] text-muted-foreground">
          {product ? `${product.priceLabel} · ${formatCategory(product.category)}` : ""}
        </p>
      </div>

      {specs.length > 0 && (
        <dl className="mt-7 border-t border-border">
          {specs.map(([term, value]) => (
            <div
              key={term}
              className="grid grid-cols-[92px_minmax(0,1fr)] gap-4 border-b border-border/70 py-3"
            >
              <dt className="label-editorial pt-0.5 text-muted-foreground">{term}</dt>
              <dd className="text-xs leading-relaxed tracking-[0.02em] text-foreground">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-5 text-center">
        <button
          onClick={onViewProduct}
          className="label-editorial inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
        >
          View Product
          <ArrowRight size={12} strokeWidth={1.5} />
        </button>
      </div>
    </motion.article>
  );
}
