import type { NextConfig } from 'next';

/**
 * Next.js 15 configuration for the GST Reconciliation frontend.
 *
 * - reactStrictMode for better error detection
 * - rewrites proxy /api/* and /health to the FastAPI backend (port 3001)
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,

  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: '/health',
        destination: `${backendUrl}/health`,
      },
    ];
  },
};

export default nextConfig;
