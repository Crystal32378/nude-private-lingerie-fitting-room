"use client";

import { useEffect } from "react";
import { MyLooksView } from "@/components/views/my-looks";
import { ProductDetailView } from "@/components/views/product-detail";
import { ShowroomView } from "@/components/views/showroom";
import { TryOnView } from "@/components/views/tryon";
import { useShowroomStore } from "@/lib/store";

export default function Home() {
  const view = useShowroomStore((s) => s.view);
  const hydrated = useShowroomStore((s) => s.hydrated);
  const hydrate = useShowroomStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <span className="font-display tracking-[0.32em] text-foreground" style={{ fontSize: "1.05rem" }}>
            NUDE
          </span>
          <div className="relative h-px w-32 overflow-hidden bg-border">
            <div className="scanline absolute inset-0" />
          </div>
          <p className="label-editorial text-muted-foreground">Loading</p>
        </div>
      </div>
    );
  }

  switch (view) {
    case "product":
      return <ProductDetailView />;
    case "tryon":
      return <TryOnView />;
    case "my-looks":
      return <MyLooksView />;
    default:
      return <ShowroomView />;
  }
}
