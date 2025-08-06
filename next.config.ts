import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        // Exclude static assets from [...location] route
        {
          source: "/_next/:path*",
          destination: "/_next/:path*",
        },
        {
          source: "/favicon.ico",
          destination: "/favicon.ico",
        },
        {
          source: "/robots.txt",
          destination: "/robots.txt",
        },
        {
          source: "/sitemap.xml",
          destination: "/sitemap.xml",
        },
      ],
    };
  },
  
  // Force source maps in production
  productionBrowserSourceMaps: true,
  
  // Enhanced webpack config for better source maps
  webpack: (config, { dev, isServer }) => {
    if (!isServer) {
      config.devtool = dev ? 'eval-source-map' : 'source-map';
      
      // Force source map generation for ALL chunks
      config.output = {
        ...config.output,
        sourceMapFilename: '[file].map',
      };
      
      // TypeScript-safe way to handle TerserPlugin
      if (config.optimization?.minimizer) {
        config.optimization.minimizer.forEach((minimizer: any) => {
          if (minimizer.constructor.name === 'TerserPlugin') {
            minimizer.options = minimizer.options || {};
            minimizer.options.sourceMap = true;
          }
        });
      }
    }
    return config;
  },

  // Add headers for source maps
  async headers() {
    return [
      {
        source: '/_next/static/chunks/:path*.js.map',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/json',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/_next/static/:path*.map',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/json',
          },
        ],
      },
    ];
  },

  experimental: {
    staleTimes: {
      dynamic: 300, // 5 minutes - matches your revalidate = 300
      static: 300, // 5 minutes for consistency
    },
  },
};

export default nextConfig;