import type { Metadata } from "next";
import { Jost } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import { ModelContextTools } from "@/components/webmcp/model-context-tools";
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
  // Lets WebMCP run on stable Chrome for visitors who have not enabled the
  // testing flag themselves. Absent, the API is simply undefined and the
  // storefront behaves exactly as before.
  const webmcpOriginTrialToken = process.env.WEBMCP_ORIGIN_TRIAL_TOKEN;

  return (
    <html lang="en">
      <head>
        {webmcpOriginTrialToken ? (
          <meta httpEquiv="origin-trial" content={webmcpOriginTrialToken} />
        ) : null}
      </head>
      <body
        className={`${jost.variable} font-body antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
        <ModelContextTools />
      </body>
    </html>
  );
}
