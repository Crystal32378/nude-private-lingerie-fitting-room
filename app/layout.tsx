import type { Metadata } from "next";
import { Jost } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const jost = Jost({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
  variable: "--font-jost",
});

export const metadata: Metadata = {
  title: "NUDE — Virtual Showroom",
  description:
    "A private digital lookbook and virtual fitting room for NUDE. Browse the collection, view product detail, and try on virtually.",
  authors: [{ name: "NUDE" }],
  keywords: ["NUDE", "Virtual Showroom", "Digital Lookbook", "Virtual Try-On", "Lingerie"],
  openGraph: {
    title: "NUDE — Virtual Showroom",
    description: "A private digital lookbook and virtual fitting room for NUDE.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "NUDE — Virtual Showroom",
    description: "A private digital lookbook and virtual fitting room for NUDE.",
  },
};

export const viewport = {
  themeColor: "#F8F4EF",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${jost.variable} font-body antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
