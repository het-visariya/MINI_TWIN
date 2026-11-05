import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  /* The floating dev badge sat on top of the sidebar footer. */
  devIndicators: false,
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
