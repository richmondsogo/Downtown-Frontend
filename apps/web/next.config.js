/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@downtown/types",
    "@downtown/validation",
    "@downtown/utils",
  ],
  async rewrites() {
    const apiBaseUrl = process.env.API_INTERNAL_URL || "http://localhost:3001";
    return [
      {
        source: "/api/:path*",
        destination: `${apiBaseUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
