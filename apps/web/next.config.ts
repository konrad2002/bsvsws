import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image (infrastructure/docker/web.Dockerfile).
  output: "standalone",
  // Workspace packages shipped as TypeScript source.
  transpilePackages: ["@bsv-sws/ui"],
  cacheComponents: true,
  experimental: {
    serverActions: {
      // Uploads go through server actions (default limit 1 MB). Largest: event files
      // 20 MB (EVENT_FILE_MAX_BYTES in apps/api) + multipart overhead. nginx: 25m.
      bodySizeLimit: "21mb",
    },
  },
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
