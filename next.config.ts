import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  // Для GitHub Pages (проектный репозиторий "core")
  basePath: isProd ? "/core" : undefined,
  assetPrefix: isProd ? "/core/" : undefined,
};

export default nextConfig;
