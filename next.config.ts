import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        // Exclude static assets from [...location] route
        {
          source: '/_next/:path*',
          destination: '/_next/:path*',
        },
        {
          source: '/favicon.ico',
          destination: '/favicon.ico',
        },
        {
          source: '/robots.txt', 
          destination: '/robots.txt',
        },
        {
          source: '/sitemap.xml',
          destination: '/sitemap.xml',
        }
      ]
    }
  }
};

export default nextConfig;