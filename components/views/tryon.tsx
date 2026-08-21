"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowUpRight,
  Camera,
  Check,
  CircleAlert,
  ImageOff,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Logo } from "@/components/logo";
import { getProductById } from "@/lib/products";
import { useShowroomStore } from "@/lib/store";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

async function fileToDataUrl(
  file: File,
  maxDim = 1600,
  maxBytes = 1_500_000
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let quality = 0.84;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);
  while (dataUrl.length * 0.75 > maxBytes && quality > 0.62) {
    quality -= 0.06;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }
  return dataUrl;
}

export function TryOnView() {
  const selectedProductId = useShowroomStore((s) => s.selectedProductId);
  const backToProduct = useShowroomStore((s) => s.backToProduct);
  const openMyLooks = useShowroomStore((s) => s.openMyLooks);
  const looksCount = useShowroomStore((s) => s.looks.length);

  const product = selectedProductId ? getProductById(selectedProductId) : undefined;

  if (!product) return null;

  return (
    <div className="view-enter flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-5 sm:px-8 lg:px-12">
          <button
            onClick={backToProduct}
            className="label-editorial flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft size={14} strokeWidth={1.5} />
            <span className="max-w-[160px] truncate sm:max-w-none">{product.nameEn}</span>
          </button>
          <Logo height={18} />
          <button
            onClick={openMyLooks}
            className="label-editorial text-muted-foreground transition-colors hover:text-foreground"
          >
            My Looks{looksCount > 0 ? ` · ${looksCount}` : ""}
          </button>
        </div>
      </header>

      <TryOnFlow productId={product.id} />
    </div>
  );
}

function TryOnFlow({ productId }: { productId: string }) {
  const personImage = useShowroomStore((s) => s.personImage);
  const setPersonImage = useShowroomStore((s) => s.setPersonImage);
  const tryOnStatus = useShowroomStore((s) => s.tryOnStatus);
  const tryOnImage = useShowroomStore((s) => s.tryOnImage);
  const tryOnError = useShowroomStore((s) => s.tryOnError);
  const setTryOnLoading = useShowroomStore((s) => s.setTryOnLoading);
  const setTryOnSuccess = useShowroomStore((s) => s.setTryOnSuccess);
  const setTryOnError = useShowroomStore((s) => s.setTryOnError);
  const resetTryOn = useShowroomStore((s) => s.resetTryOn);
  const saveCurrentLook = useShowroomStore((s) => s.saveCurrentLook);
  const backToProduct = useShowroomStore((s) => s.backToProduct);
  const startTryOn = useShowroomStore((s) => s.startTryOn);

  const [processing, setProcessing] = useState(false);
  const ranOnce = useRef(false);
  const freshKey = useRef<string | null>(null);

  const runTryOn = useCallback(
    async (fresh: boolean) => {
      const product = getProductById(productId);
      const person = useShowroomStore.getState().personImage;
      if (!product || !person) return;

      const cacheKey = `${productId}:${fresh ? "fresh" : "auto"}:${person.slice(0, 32)}`;
      if (!fresh && freshKey.current === cacheKey && ranOnce.current) return;
      freshKey.current = cacheKey;
      ranOnce.current = true;

      setTryOnLoading();
      try {
        // Frontend-only build: the /api/tryon backend is not included.
        // The request fails gracefully and we render the side-by-side fallback.
        const personBlob = await (await fetch(person)).blob();
        const garmentBlob = await (
          await fetch(product.vtoImage, { mode: "cors" })
        ).blob();
        const form = new FormData();
        form.append("person", personBlob, "person.jpg");
        form.append("garment", garmentBlob, `${productId}.jpg`);
        form.append("garmentCategory", product.youcamCategory);
        form.append("garmentName", productId);

        let res: Response | null = null;
        for (let attempt = 0; attempt < 2; attempt++) {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 150_000);
          try {
            res = await fetch("/api/tryon", {
              method: "POST",
              body: form,
              signal: controller.signal,
            });
            break;
          } catch (err) {
            if (attempt === 1) {
              setTryOnError(
                err instanceof DOMException && err.name === "AbortError"
                  ? "Try-on timed out after 150 seconds."
                  : "Connection interrupted. Please check your network and try again."
              );
              return;
            }
          } finally {
            clearTimeout(timer);
          }
        }
        if (!res) return;
        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.ok || !data?.imageUrl) {
          const message =
            data?.youcamError ?? data?.error ?? "Network error during try-on";
          setTryOnError(message);
          return;
        }

        const isReal = !data.fallback && !data.demo;
        setTryOnSuccess(data.imageUrl, isReal);
        if (isReal) {
          useShowroomStore.setState({ tryOnStatus: "success" });
          await saveCurrentLook();
        }
      } catch {
        setTryOnError("Connection interrupted. Please try again.");
      }
    },
    [productId, saveCurrentLook, setTryOnError, setTryOnLoading, setTryOnSuccess]
  );

  useEffect(() => {
    if (personImage && tryOnStatus === "idle") {
      runTryOn(false);
    }
  }, [personImage, tryOnStatus, runTryOn]);

  const handleFile = async (file: File) => {
    setProcessing(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      await setPersonImage(dataUrl);
    } finally {
      setProcessing(false);
    }
  };

  if (!personImage) {
    return (
      <UploadStep
        processing={processing}
        onFile={handleFile}
        onBack={backToProduct}
      />
    );
  }

  if (tryOnStatus === "loading") {
    return <LoadingStep productId={productId} />;
  }

  if (tryOnStatus === "error") {
    return (
      <ErrorStep
        message={tryOnError}
        onRetry={() => {
          resetTryOn();
          runTryOn(true);
        }}
        onBack={backToProduct}
      />
    );
  }

  return (
    <ResultStep
      productId={productId}
      resultImage={tryOnImage}
      onRegenerate={() => {
        resetTryOn();
        runTryOn(true);
      }}
      onChangePhoto={() => {
        startTryOn(productId);
        useShowroomStore.setState({
          personImage: null,
          personSavedAt: null,
          tryOnStatus: "idle",
          tryOnImage: null,
          tryOnIsReal: false,
          tryOnError: null,
        });
      }}
      onBack={backToProduct}
      onMyLooks={() => useShowroomStore.getState().openMyLooks()}
    />
  );
}

function UploadStep({
  processing,
  onFile,
  onBack,
}: {
  processing: boolean;
  onFile: (file: File) => void;
  onBack: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <main className="mx-auto w-full max-w-[1400px] flex-1 px-5 py-14 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-xl text-center">
        <p className="label-editorial text-accent-deep">Step 01</p>
        <h2 className="font-display mx-auto max-w-lg text-[1.375rem] font-normal leading-[1.5] sm:text-2xl">
          Upload a photo to try on
        </h2>
        <p className="mx-auto mt-6 max-w-lg text-[15px] leading-[1.9] tracking-[0.02em] text-muted-foreground">
          A clear, front-facing upper-body photo works best. Your photo is stored only in
          this browser — it is sent solely to power your virtual fitting, and NUDE never
          keeps a copy.
        </p>
      </div>

      <div className="mx-auto mt-12 max-w-xl">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={processing}
          className="group flex aspect-[4/3] w-full flex-col items-center justify-center gap-4 rounded-sm border border-dashed border-border bg-secondary/40 transition-colors hover:border-accent hover:bg-secondary/70 disabled:opacity-60"
        >
          {processing ? (
            <>
              <RefreshCw size={22} strokeWidth={1.25} className="animate-spin text-muted-foreground" />
              <span className="label-editorial text-muted-foreground">Processing photo…</span>
            </>
          ) : (
            <>
              <Camera size={22} strokeWidth={1.25} className="text-muted-foreground" />
              <span className="label-editorial group-hover:text-foreground">Choose a photo</span>
              <span className="text-xs text-muted-foreground">
                JPG or PNG · Front-facing · Good lighting
              </span>
            </>
          )}
        </button>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            ["Front-facing", "Stand facing the camera directly"],
            ["Fitted top", "Wear a fitted top for cleaner overlay"],
            ["Good light", "Even, natural lighting works best"],
          ].map(([title, desc]) => (
            <div key={title} className="rounded-sm border border-border/70 p-4">
              <p className="label-editorial">{title}</p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-[11px] leading-relaxed text-muted-foreground">
          By uploading, you confirm you have the right to use this photo. Your photo is
          kept only in this browser (IndexedDB). When you generate a try-on, it is sent to
          Perfect Corp&apos;s YouCam VTO API purely to render the result — NUDE&apos;s
          servers process the request in memory and never persist your photo. Finished
          looks are saved back to this device only.
        </p>

        <div className="mt-10 text-center">
          <button
            onClick={onBack}
            className="label-editorial rounded-sm border border-border px-8 py-3.5 text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
          >
            Back
          </button>
        </div>
      </div>
    </main>
  );
}

function LoadingStep({ productId }: { productId: string }) {
  const product = getProductById(productId)!;
  const personImage = useShowroomStore((s) => s.personImage);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setElapsed((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <main className="mx-auto w-full max-w-[1400px] flex-1 px-5 py-14 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-2xl text-center">
        <p className="label-editorial text-accent-deep">Fitting</p>
        <h2 className="font-display mt-4 text-3xl font-light sm:text-4xl">{product.nameEn}</h2>
      </div>

      <div className="mx-auto mt-10 grid max-w-2xl grid-cols-2 gap-4">
        {[["You", personImage], ["Garment", product.vtoImage]].map(([label, src]) => (
          <div key={label} className="relative aspect-[3/4] overflow-hidden rounded-sm bg-secondary/50">
            {src && (
              <Image src={src} alt={label as string} fill sizes="(max-width: 768px) 50vw, 320px" className="object-cover" unoptimized={typeof src === "string" && src.startsWith("data:")} />
            )}
            <span className="label-editorial absolute bottom-3 left-3 rounded-sm bg-background/85 px-2.5 py-1 backdrop-blur-sm">
              {label}
            </span>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-10 max-w-xs">
        <div className="relative h-px w-full overflow-hidden bg-border">
          <div className="scanline absolute inset-0" />
        </div>
        <p className="label-editorial mt-6 text-center">Generating virtual try-on</p>
        <p className="mt-3 text-center text-[13px] leading-[1.9] tracking-[0.02em] text-muted-foreground">
          YouCam V3 is rendering the garment onto your photo. This usually takes 10–30 seconds.
        </p>
        <p className="label-editorial mt-5 text-center text-muted-foreground tabular-nums">
          {String(Math.floor(elapsed / 60)).padStart(2, "0")}:{String(elapsed % 60).padStart(2, "0")}
        </p>
      </div>
    </main>
  );
}

function ErrorStep({
  message,
  onRetry,
  onBack,
}: {
  message: string | null;
  onRetry: () => void;
  onBack: () => void;
}) {
  return (
    <main className="mx-auto flex w-full max-w-[1400px] flex-1 items-center justify-center px-5 py-14 sm:px-8 lg:px-12">
      <div className="max-w-md text-center">
        <CircleAlert size={26} strokeWidth={1.25} className="mx-auto text-destructive" />
        <h2 className="font-display mt-6 text-xl font-normal sm:text-2xl">
          Try-on couldn&apos;t complete
        </h2>
        <p className="mt-4 text-[13px] leading-[1.9] tracking-[0.02em] text-muted-foreground">
          {message ? `Error: ${message}` : "Something went wrong while contacting YouCam V3."}
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <button
            onClick={onRetry}
            className="label-editorial rounded-sm bg-foreground px-8 py-3.5 text-background transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Try Again
          </button>
          <button
            onClick={onBack}
            className="label-editorial rounded-sm border border-border px-8 py-3.5 text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
          >
            Back to Product
          </button>
        </div>
      </div>
    </main>
  );
}

function ResultStep({
  productId,
  resultImage,
  onRegenerate,
  onChangePhoto,
  onBack,
  onMyLooks,
}: {
  productId: string;
  resultImage: string | null;
  onRegenerate: () => void;
  onChangePhoto: () => void;
  onBack: () => void;
  onMyLooks: () => void;
}) {
  const product = getProductById(productId)!;
  const status = useShowroomStore((s) => s.tryOnStatus);
  const personImage = useShowroomStore((s) => s.personImage);

  return (
    <motion.main
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: EASE }}
      className="mx-auto w-full max-w-[1400px] flex-1 px-5 py-14 sm:px-8 lg:px-12"
    >
      <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          {status === "success" ? (
            <span className="label-editorial !tracking-[0.22em] inline-flex items-center gap-2 rounded-sm bg-secondary px-3.5 py-2 text-foreground">
              <Check size={13} strokeWidth={1.5} />
              Virtual Try-On Result
            </span>
          ) : (
            <span className="label-editorial !tracking-[0.22em] inline-flex items-center gap-2 rounded-sm bg-secondary px-3.5 py-2 text-muted-foreground">
              <ImageOff size={13} strokeWidth={1.5} />
              Side-by-side Preview · VTO unavailable
            </span>
          )}
          <h2 className="font-display mt-4 text-xl font-normal sm:text-2xl">{product.nameEn}</h2>
          <p className="mt-2 text-[15px] tracking-[0.05em] text-muted-foreground">{product.nameZh}</p>
        </div>
        {status === "demo" && (
          <span className="label-editorial inline-flex items-center gap-2 text-accent-deep">
            <Sparkles size={13} strokeWidth={1.5} />
            Demo
          </span>
        )}
      </div>

      {status === "fallback" && (
        <p className="mb-8 max-w-xl rounded-sm border border-border/70 bg-secondary/40 p-4 text-xs leading-[1.9] tracking-[0.02em] text-muted-foreground">
          Real Virtual Try-On requires a YouCam V3 API key. This preview shows your photo
          alongside the garment for reference.
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:max-w-3xl">
        <div className="relative aspect-[3/4] overflow-hidden rounded-sm bg-secondary/50">
          {resultImage && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={resultImage}
              alt="Virtual try-on result"
              className="img-fade-in h-full w-full object-cover"
            />
          )}
          <span className="label-editorial absolute bottom-3 left-3 rounded-sm bg-background/85 px-2.5 py-1 backdrop-blur-sm">
            Try-On
          </span>
        </div>
        <div className="relative aspect-[3/4] overflow-hidden rounded-sm bg-secondary/50">
          {personImage && (
            <Image
              src={personImage}
              alt="Your photo"
              fill
              sizes="(max-width: 640px) 100vw, 380px"
              className="object-cover"
              unoptimized
            />
          )}
          <span className="label-editorial absolute bottom-3 left-3 rounded-sm bg-background/85 px-2.5 py-1 backdrop-blur-sm">
            You
          </span>
        </div>
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-4">
        <button
          onClick={onRegenerate}
          className="label-editorial inline-flex items-center gap-2 rounded-sm bg-foreground px-8 py-3.5 text-background transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <RefreshCw size={13} strokeWidth={1.5} />
          Regenerate
        </button>
        <button
          onClick={onChangePhoto}
          className="label-editorial rounded-sm border border-border px-8 py-3.5 text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
        >
          Try Another
        </button>
        <button
          onClick={onBack}
          className="label-editorial rounded-sm border border-border px-8 py-3.5 text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
        >
          Back to Product
        </button>
        <button
          onClick={onMyLooks}
          className="label-editorial inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
        >
          My Looks
          <ArrowUpRight size={13} strokeWidth={1.5} />
        </button>
      </div>

      <div className="mt-12 border-t border-border pt-6">
        <p className="text-xs text-muted-foreground">Want to try with a different photo?</p>
        <button
          onClick={onChangePhoto}
          className="label-editorial mt-3 text-foreground underline underline-offset-4 transition-colors hover:text-accent-deep"
        >
          Change Photo
        </button>
      </div>
    </motion.main>
  );
}
