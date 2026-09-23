/// <reference types="next" />
/// <reference types="next/image-types/global" />

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'standalone',
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
