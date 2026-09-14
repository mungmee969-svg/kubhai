import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  images: {
    localPatterns: [
      { pathname: "/brand/**" },
      { pathname: "/fleet/**" },
      { pathname: "/discovery/**" },
      { pathname: "/store/**" },
      { pathname: "/uploads/**" },
    ],
  },
};

export default nextConfig;
