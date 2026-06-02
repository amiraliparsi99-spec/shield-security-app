import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false, // Disabled to fix react-leaflet double initialization issue with React 19
  // Repo has many legacy ESLint issues; CI can lint separately. Unblocks Vercel builds.
  eslint: { ignoreDuringBuilds: true },
  // Type errors now fail the build (tsc is clean as of the type-safety cleanup).
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
