/** @type {import('next').NextConfig} */

// Derive backend origin from API URL for CSP connect-src
const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:5001/api');
const apiProxyTarget = (process.env.API_PROXY_TARGET || '')
  .replace(/\/api\/?$/, '')
  .replace(/\/+$/, '');
const resolveOrigin = (url, fallback) => {
  if (!url || url.startsWith('/')) return fallback;
  return new URL(url).origin;
};
const backendOrigin = resolveOrigin(apiProxyTarget || apiUrl, 'http://localhost:5001');
const wsOrigin = backendOrigin.replace(/^http/, 'ws'); // e.g. ws://localhost:5001

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // Skip type checking and linting during build for faster deploys
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  env: {
    NEXT_PUBLIC_API_URL: apiUrl,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
      { protocol: 'https', hostname: 'storage.googleapis.com' },
      { protocol: 'https', hostname: '*.googleusercontent.com' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
  // Output mode: use default for Render Web Service (next start)
  // 'standalone' is only needed for Docker deployments
  // Removing it reduces build memory from ~1GB to ~200MB
  // Suppress hydration warnings from browser extensions
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  // Disable the development error overlay indicator
  devIndicators: {
    buildActivity: true,
    buildActivityPosition: 'bottom-right',
  },
  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://firebasestorage.googleapis.com https://storage.googleapis.com https://*.googleusercontent.com",
              `connect-src 'self' ${backendOrigin} ${wsOrigin} https://*.googleapis.com`,
              "media-src 'self' blob:",
              "frame-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
  async rewrites() {
    if (!apiProxyTarget) {
      return [];
    }

    return [
      {
        source: '/api/:path*',
        destination: `${apiProxyTarget}/api/:path*`,
      },
    ];
  },
  // Prevent source maps in production
  productionBrowserSourceMaps: false,
  webpack: (config) => {
    // pdfjs-dist optionally requires 'canvas' (Node.js only) — not needed in browser
    config.resolve.alias.canvas = false;
    return config;
  },
};

module.exports = nextConfig;
