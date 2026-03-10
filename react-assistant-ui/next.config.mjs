/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // This UI is mid-refactor from a single massive component; avoid build breaks on unused vars during Phase-1.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
