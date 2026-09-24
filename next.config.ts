/// <reference types="next" />
/// <reference types="next/image-types/global" />

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'standalone',
  outputFileTracingRoot: process.cwd(),
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
};

export default nextConfig;
