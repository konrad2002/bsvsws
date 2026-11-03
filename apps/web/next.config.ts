import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image (infrastructure/docker/web.Dockerfile).
  output: "standalone",
  // Workspace packages shipped as TypeScript source.
  transpilePackages: ["@bsv-sws/ui"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
