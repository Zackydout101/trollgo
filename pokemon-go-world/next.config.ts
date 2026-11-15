import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  devIndicators: false,
  transpilePackages: ["three", "react-three-map"],
};

export default nextConfig;
