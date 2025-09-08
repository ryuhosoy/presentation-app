/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@swc/core': '@swc/wasm',
    };
    return config;
  },
};

module.exports = nextConfig;
