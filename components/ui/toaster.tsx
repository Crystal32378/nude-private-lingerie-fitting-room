"use client";

import { useEffect, useState } from "react";

export function Toaster() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <div
      role="region"
      aria-label="Notifications"
      tabIndex={-1}
      style={{ pointerEvents: "none" }}
      className="fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]"
    />
  );
}
