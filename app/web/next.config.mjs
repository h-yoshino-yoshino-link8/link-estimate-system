/** @type {import('next').NextConfig} */
const internalApiBaseRaw = (process.env.INTERNAL_API_BASE ?? "").trim();
const internalApiBase =
  internalApiBaseRaw.length === 0
    ? ""
    : internalApiBaseRaw.startsWith("http://") || internalApiBaseRaw.startsWith("https://")
      ? internalApiBaseRaw
      : `http://${internalApiBaseRaw}`;

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    if (!internalApiBase) return [];
    return [
      {
        source: "/api/:path*",
        destination: `${internalApiBase}/api/:path*`,
      },
      {
        source: "/health",
        destination: `${internalApiBase}/health`,
      },
    ];
  },
};

export default nextConfig;
