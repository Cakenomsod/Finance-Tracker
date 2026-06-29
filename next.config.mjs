/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
  async redirects() {
    return [
      {
        source: '/analytics',
        destination: '/dashboard',
        permanent: true,
      },
      {
        source: '/transactions',
        destination: '/',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
