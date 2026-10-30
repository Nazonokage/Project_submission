import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js';

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
    ] }, { source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'no-store' }] }];
  },
  serverExternalPackages: [
    '@neondatabase/serverless',
    'drizzle-orm',
    'nodemailer',
    'bcryptjs',
  ],
};

// Development and production must not overwrite each other's generated chunks.
// Keep next build / next start on the standard output path for deployment tools.
export default (phase) => ({
  ...nextConfig,
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next',
});
