"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { NUDE_PRODUCTS, PRODUCT_COUNT, Product } from "@/lib/products";
import { useShowroomStore } from "@/lib/store";
import { Logo } from "@/components/logo";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

export function ShowroomView() {
  const openProduct = useShowroomStore((s) => s.openProduct);
  const startTryOn = useShowroomStore((s) => s.startTryOn);
  const openMyLooks = useShowroomStore((s) => s.openMyLooks);
  const looksCount = useShowroomStore((s) => s.looks.length);

  return (
    <div className="view-enter min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-[72px] max-w-[1500px] items-center justify-between px-5 sm:px-8 lg:px-12">
          <button
            onClick={() => useShowroomStore.getState().backToShowroom()}
            aria-label="NUDE home"
            className="transition-opacity hover:opacity-60"
          >
            <Logo height={18} />
          </button>
          <div className="flex items-center gap-8 lg:gap-12">
            <span className="label-editorial hidden text-muted-foreground md:inline">
              Virtual Showroom
            </span>
            <button
              onClick={openMyLooks}
              className="label-editorial text-muted-foreground transition-colors hover:text-foreground"
            >
              My Looks{looksCount > 0 ? ` · ${looksCount}` : ""}
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-[1500px] px-5 pb-24 pt-24 text-center sm:px-8 sm:pb-32 sm:pt-32 lg:px-12">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE }}
          >
            <div className="mb-10 flex items-center justify-center gap-4">
              <span className="h-px w-8 bg-accent" />
              <p className="label-editorial text-muted-foreground">
                The Collection · {PRODUCT_COUNT} Pieces
              </p>
              <span className="h-px w-8 bg-accent" />
            </div>
            <h1 className="font-display mx-auto max-w-4xl text-[1.875rem] font-normal leading-[1.3] sm:text-[2.5rem] lg:text-[3.25rem] lg:leading-[1.2]">
              A private digital showroom
              <br />
              <span className="text-accent-deep">for the NUDE body.</span>
            </h1>
            <p className="mx-auto mt-10 max-w-xl text-[15px] leading-[1.9] tracking-[0.02em] text-muted-foreground">
              Nine pieces, chosen for their structure — from seamless molded cups to sheer lace,
              wireless bralettes to front-closure racerbacks. Browse, study the construction, and
              when you wish, see one on you.
            </p>
            <p className="label-editorial mt-12 text-muted-foreground">
              Virtual Try-On is optional — your photo is used solely to render your fitting,
              and NUDE never stores it.
            </p>
          </motion.div>
        </section>

        <section className="mx-auto max-w-[1500px] px-5 pb-28 sm:px-8 sm:pb-36 lg:px-12">
          <div className="mb-12 flex items-baseline justify-between border-t border-border pt-10 sm:mb-14">
            <h2 className="section-title">The Edit</h2>
            <span className="label-editorial text-muted-foreground">
              01 — {String(PRODUCT_COUNT).padStart(2, "0")}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-10 sm:gap-x-5 sm:gap-y-14 lg:grid-cols-3 lg:gap-x-6">
            {NUDE_PRODUCTS.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                index={index}
                onOpen={() => openProduct(product.id)}
                onTryOn={() => startTryOn(product.id)}
              />
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-[1500px] flex-col items-center gap-7 px-5 py-14 text-center sm:flex-row sm:justify-between sm:text-left lg:px-12">
          <Logo height={16} />
          <p className="max-w-md text-xs leading-[1.9] text-muted-foreground">
            Curated {PRODUCT_COUNT}-piece edit · Photos &amp; VTO results stay on this device · A
            private digital showroom for invited partners.
          </p>
          <p className="label-editorial text-muted-foreground">
            nude4underwear.com
          </p>
        </div>
      </footer>
    </div>
  );
}

function ProductCard({
  product,
  index,
  onOpen,
  onTryOn,
}: {
  product: Product;
  index: number;
  onOpen: () => void;
  onTryOn: () => void;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.6, ease: EASE, delay: 0.06 * Math.min(index, 6) }}
      onClick={onOpen}
      className="group cursor-pointer"
    >
      <div className="relative aspect-[3/4] overflow-hidden rounded-sm bg-secondary/50">
        <Image
          src={product.displayImage}
          alt={`${product.nameZh} ${product.nameEn}`}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 33vw"
          priority={index < 3}
          className="object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.03]"
        />
        <span className="label-editorial absolute left-3.5 top-3.5 !text-xs text-foreground/55">
          {String(index + 1).padStart(2, "0")}
        </span>
        {/* FLEUR-style quick-action bar sliding up from the bottom */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onTryOn();
          }}
          className="label-editorial absolute inset-x-0 bottom-0 translate-y-full bg-background/90 py-3.5 text-foreground backdrop-blur-sm transition-transform duration-500 ease-out group-hover:translate-y-0 hover:bg-foreground hover:!text-background"
        >
          Try On
        </button>
      </div>
      <div className="mt-4 text-center">
        <h3 className="product-name">{product.nameEn}</h3>
        <p className="mt-1.5 text-[15px] tracking-[0.05em] text-foreground/75">{product.nameZh}</p>
        <p className="mt-1 text-[13px] tracking-[0.04em] text-muted-foreground">
          {product.priceLabel}
        </p>
      </div>
    </motion.article>
  );
}
