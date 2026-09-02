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

export default nextConfig;
