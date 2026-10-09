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
    return [
      { source: "/go/:path*", headers: [
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "Cache-Control", value: "private, no-store" },
        { key: "X-Robots-Tag", value: "noindex, nofollow" },
      ] },
      // Everything behind a sign-in, and the founder's pages. app/robots.ts also
      // keeps crawlers away; this covers a link to one of them found elsewhere.
      { source: "/:section(dashboard|admin|preview|onboarding|search|reading-level|course|mastery|book-club|join|qr|offline|auth)/:path*", headers: [
        { key: "X-Robots-Tag", value: "noindex, nofollow" },
      ] },
    ];
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