/** @type {import('next').NextConfig} */
const internalApiBaseRaw = process.env.INTERNAL_API_BASE ?? "http://localhost:8000";
const internalApiBase =
  internalApiBaseRaw.startsWith("http://") || internalApiBaseRaw.startsWith("https://")
    ? internalApiBaseRaw
    : `http://${internalApiBaseRaw}`;

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
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
