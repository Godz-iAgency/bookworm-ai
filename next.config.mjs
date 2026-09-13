import path from "node:path"

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.resolve(import.meta.dirname),
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  async headers() {
    return [{ source: "/go/:path*", headers: [
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "Cache-Control", value: "private, no-store" },
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
    ] }];
  },
  async redirects() {
    return [
      { source: "/library", destination: "/dashboard", permanent: false },
      { source: "/course/generate", destination: "/search", permanent: false },
      { source: "/settings", destination: "/dashboard", permanent: false },
    ];
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig