import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false, // Disabled to fix react-leaflet double initialization issue with React 19
};

export default nextConfig;
