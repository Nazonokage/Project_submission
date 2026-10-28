import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js';

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      '@neondatabase/serverless',
      'drizzle-orm',
      'nodemailer',
      'bcryptjs',
    ],
  },
};

// Development and production must not overwrite each other's generated chunks.
// Keep next build / next start on the standard output path for deployment tools.
export default (phase) => ({
  ...nextConfig,
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next',
});
