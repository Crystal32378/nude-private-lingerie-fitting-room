import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.shoplineapp.com",
      },
    ],
  },
};

export default nextConfig;
