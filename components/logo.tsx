"use client";

import Image from "next/image";

interface LogoProps {
  height?: number;
  variant?: "light" | "dark";
  className?: string;
}

export function Logo({ height = 20, variant = "light", className }: LogoProps) {
  const src = variant === "dark" ? "/nude-logo-dark.png" : "/nude-logo-light.png";
  return (
    <Image
      src={src}
      alt="NUDE"
      width={Math.round(4.48 * height)}
      height={height}
      priority
      className={className}
    />
  );
}
