import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static HTML export — the Go backend serves the bundle as a single binary.
  output: "export",
  // No Next.js image optimization server in a static export.
  images: { unoptimized: true },
};

export default nextConfig;
