/** @type {import('next').NextConfig} */
function resolveApiBaseUrl() {
  if (process.env.PREVIEW_API_URL) {
    return process.env.PREVIEW_API_URL;
  }

  const vercelEnv = process.env.VERCEL_ENV || process.env.NEXT_PUBLIC_VERCEL_ENV;
  const branch = process.env.VERCEL_GIT_COMMIT_REF;

  if (vercelEnv === "preview" && branch && branch !== "master" && branch !== "main") {
    const sanitizedBranch = branch
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 63);

    return `https://downtown-api-git-${sanitizedBranch}-richmondsogo.vercel.app`;
  }

  return process.env.API_INTERNAL_URL || "http://localhost:3001";
}

const nextConfig = {
  transpilePackages: [
    "@downtown/types",
    "@downtown/validation",
    "@downtown/utils",
  ],
  async rewrites() {
    const apiBaseUrl = resolveApiBaseUrl();
    return [
      {
        source: "/api/:path*",
        destination: `${apiBaseUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
