import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Evita il bundling di librerie native/pdf nelle route server
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
  // Imposta la root di Turbopack per evitare selezione root errata
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
