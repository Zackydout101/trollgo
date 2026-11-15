import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  devIndicators: false,
  transpilePackages: ["three", "react-three-map"],
  // reel videos are read from disk at runtime, so file tracing can't discover them
  outputFileTracingIncludes: {
    "/api/training/**": ["./brainrotlink/**/*.mp4"],
  },
};

export default nextConfig;
