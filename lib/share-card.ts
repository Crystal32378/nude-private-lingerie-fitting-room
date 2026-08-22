"use client";

/**
 * Client-side share-card composition for Compare / Ask a Friend.
 *
 * The card is rendered entirely in the browser with <canvas> from looks the
 * user already saved on this device. The blob is handed straight to the
 * native share sheet (or downloaded) — it is never uploaded to or stored on
 * NUDE servers. What messaging apps do with it afterwards is outside our
 * control and we make no claims about that.
 *
 * The card asks a friend to help CHOOSE between pieces (reply A, B or C).
 * It deliberately carries no verdict stamps, no links, no referral or
 * unlock mechanics.
 */

export interface ShareLook {
  imageUrl: string;
  /** Slot letter shown on the card: "A" | "B" | "C". */
  label: string;
  nameEn: string;
  nameZh: string;
  priceLabel: string;
  categoryLabel: string;
}

export type ShareOutcome = "shared" | "downloaded" | "cancelled" | "failed";

export interface ShareResult {
  outcome: ShareOutcome;
  /**
   * Whether the message text actually reached the clipboard. True when the
   * native share sheet carried it; on the download fallback it reflects the
   * real copy attempt so the UI never claims a copy that didn't happen.
   */
  messageCopied: boolean;
}

const CARD_W = 1080;
const PAD_X = 64;
const GAP = 24;

const INK = "#1d1713";
const MUTED = "#69625b";
const CREAM = "#faf6f1";
const RULE = "#d4bca7";
const ACCENT_DEEP = "#bd9e86";

/** Slot letters shown to the friend, e.g. "A or B" (2 looks) / "A, B or C" (3 looks). */
export function slotList(count: number): string {
  const letters = ["A", "B", "C"].slice(0, Math.max(2, Math.min(3, count)));
  if (letters.length === 2) return `${letters[0]} or ${letters[1]}`;
  return `${letters[0]}, ${letters[1]} or ${letters[2]}`;
}

/** The message sent alongside the card. Friend replies with the slot letters in chat. */
export function buildShareMessage(count: number): string {
  return `Help me choose between these — which one suits me best? Reply ${slotList(count)}.`;
}

function displayFont(): string {
  let jost = "";
  try {
    for (const f of document.fonts) {
      if (/jost/i.test(f.family)) {
        jost = `"${f.family}"`;
        break;
      }
    }
  } catch {
    // document.fonts unavailable — fall through.
  }
  return `${jost}, "Jost", "Century Gothic", system-ui, sans-serif`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("share-card-image-load-failed"));
    img.src = src;
  });
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

interface TrackedTextOptions {
  size: number;
  weight?: number;
  tracking: number;
  color?: string;
  align?: "center" | "left";
}

function drawTracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: TrackedTextOptions
): void {
  const font = displayFont();
  ctx.font = `${opts.weight ?? 400} ${opts.size}px ${font}`;
  ctx.fillStyle = opts.color ?? INK;
  const chars = Array.from(text);
  let total = 0;
  for (const ch of chars) total += ctx.measureText(ch).width;
  total += opts.tracking * Math.max(0, chars.length - 1);
  let cursor = opts.align === "left" ? x : x - total / 2;
  for (const ch of chars) {
    ctx.fillText(ch, cursor, y);
    cursor += ctx.measureText(ch).width + opts.tracking;
  }
}

function measureTracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  size: number,
  tracking: number,
  weight = 400
): number {
  ctx.font = `${weight} ${size}px ${displayFont()}`;
  const chars = Array.from(text);
  let total = 0;
  for (const ch of chars) total += ctx.measureText(ch).width;
  return total + tracking * Math.max(0, chars.length - 1);
}

/**
 * Compose the A/B/C comparison card. Mirrors the editorial language of the
 * NUDE lookbook sheets: cream ground, tracked brand line, thin rule, a grid
 * of 3/4 images with slot badges, bilingual captions, footer note.
 */
export async function composeCompareCard(looks: ShareLook[]): Promise<Blob> {
  if (!looks.length) throw new Error("share-card-no-looks");

  try {
    await document.fonts.ready;
  } catch {
    // Non-fatal: canvas falls back to system fonts.
  }

  const n = Math.min(looks.length, 3);
  const colW = (CARD_W - PAD_X * 2 - GAP * (n - 1)) / n;
  const imgH = colW * (4 / 3);

  // Measure vertical flow first so the canvas height fits the content.
  const probe = document.createElement("canvas").getContext("2d");
  if (!probe) throw new Error("no-canvas-context");
  const titleH = 40;
  const subH = 22;
  const captionBlockH = 30 + 26 + 24;
  const cardTop = 96 + 20 + 18 + 36 + 52 + titleH + 16 + subH + 56;
  const cardBottom = cardTop + imgH + 26 + captionBlockH;
  const H = Math.round(cardBottom + 56 + 44 + 26 + 60);

  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no-canvas-context");

  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, CARD_W, H);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  // Brand block.
  let y = 108;
  drawTracked(ctx, "NUDE", CARD_W / 2, y, { size: 34, tracking: 17 });
  y += 42;
  drawTracked(ctx, "VIRTUAL SHOWROOM", CARD_W / 2, y, {
    size: 15,
    tracking: 7.5,
    color: MUTED,
  });
  y += 34;
  ctx.fillStyle = RULE;
  ctx.fillRect(CARD_W / 2 - 44, y, 88, 2);
  y += 58;

  drawTracked(ctx, "HELP ME CHOOSE", CARD_W / 2, y + titleH, {
    size: 38,
    tracking: 11,
  });
  y += titleH + 16 + subH;
  drawTracked(
    ctx,
    `Same photo, different pieces — reply ${slotList(looks.length)}.`,
    CARD_W / 2,
    y,
    { size: 21, tracking: 2, color: MUTED }
  );
  y += 56;

  const images = await Promise.all(
    looks.slice(0, n).map((look) => loadImage(look.imageUrl))
  );

  const imgTop = y;
  for (let i = 0; i < n; i++) {
    const x = PAD_X + i * (colW + GAP);
    const look = looks[i];

    roundRectPath(ctx, x, imgTop, colW, imgH, 4);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = "#f1eae3";
    ctx.fillRect(x, imgTop, colW, imgH);
    drawCover(ctx, images[i], x, imgTop, colW, imgH);
    ctx.restore();

    // Slot badge — how the friend replies.
    const badgeSize = 15;
    const padXb = 13;
    const padYb = 10;
    const bw = measureTracked(ctx, look.label, badgeSize, 3) + padXb * 2;
    const bh = badgeSize + padYb * 2;
    ctx.fillStyle = "rgba(250,246,241,0.92)";
    roundRectPath(ctx, x + 14, imgTop + 14, bw, bh, 3);
    ctx.fill();
    drawTracked(ctx, look.label, x + 14 + padXb, imgTop + 14 + padYb + badgeSize * 0.78, {
      size: badgeSize,
      tracking: 3,
    });

    // Caption block.
    const cx = x + colW / 2;
    let cy = imgTop + imgH + 26 + 20;
    const nameEn = look.nameEn.toUpperCase().slice(0, 28);
    let nameSize = 19;
    while (
      nameSize > 14 &&
      measureTracked(ctx, nameEn, nameSize, 2.5) > colW - 8
    ) {
      nameSize -= 1;
    }
    drawTracked(ctx, nameEn, cx, cy, { size: nameSize, tracking: 2.5 });
    cy += 26;
    drawTracked(ctx, look.nameZh.slice(0, 16), cx, cy, {
      size: 18,
      tracking: 1.5,
      color: "#27201c",
    });
    cy += 24;
    drawTracked(
      ctx,
      `${look.priceLabel} · ${look.categoryLabel}`.slice(0, 40),
      cx,
      cy,
      { size: 15, tracking: 1, color: MUTED }
    );
  }

  // Footer note.
  y = imgTop + imgH + 26 + captionBlockH + 56;
  ctx.fillStyle = "#e2ddd7";
  ctx.fillRect(PAD_X, y, CARD_W - PAD_X * 2, 1);
  y += 40;
  drawTracked(ctx, "NUDE · PRIVATE FITTING ROOM", PAD_X, y, {
    size: 15,
    tracking: 4,
    color: ACCENT_DEEP,
    align: "left",
  });
  const privacy = "Composed on this device — never uploaded to NUDE.";
  const pw = measureTracked(ctx, privacy, 15, 1.5);
  drawTracked(ctx, privacy, CARD_W - PAD_X - pw, y, {
    size: 15,
    tracking: 1.5,
    color: MUTED,
    align: "left",
  });

  return await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92)
  ).then((blob) => {
    if (!blob) throw new Error("share-card-encode-failed");
    return blob;
  });
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5_000);
}

/**
 * Hand the finished card to the OS share sheet (image + message together).
 * Call from a user gesture with an already-composed blob so transient
 * activation doesn't expire. Fallback without Web Share (mostly desktop):
 * download the card and put the message on the clipboard — reporting
 * honestly whether that copy succeeded.
 */
export async function shareCompareCard(
  blob: Blob,
  message: string
): Promise<ShareResult> {
  if (typeof navigator.share === "function") {
    const file = new File([blob], "nude-compare.jpg", { type: "image/jpeg" });
    const withFiles =
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] });
    try {
      if (withFiles) {
        await navigator.share({ files: [file], text: message });
      } else {
        await navigator.share({ text: message });
      }
      return { outcome: "shared", messageCopied: true };
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return { outcome: "cancelled", messageCopied: false };
      }
      // Real failure — fall through to download path.
    }
  }
  downloadBlob(blob, "nude-compare.jpg");
  const copied = await copyText(message);
  return { outcome: "downloaded", messageCopied: copied };
}
