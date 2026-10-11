/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@downtown/types", "@downtown/validation", "@downtown/utils"],
};

module.exports = nextConfig;
