/**
 * Resolves the appropriate API base URL for server-side vs client-side fetches.
 */
export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    // Client-side requests route through Next.js rewrites (/api/...)
    return "";
  }

  if (process.env.API_INTERNAL_URL) {
    return process.env.API_INTERNAL_URL;
  }

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

  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
}
