/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Disable static optimization for pages using Web3
  experimental: {
    outputFileTracingRoot: undefined,
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    // Exclude polkadot from server-side rendering
    config.externals.push({
      '@polkadot/util-crypto': '@polkadot/util-crypto',
    });
    return config;
  },
}

module.exports = nextConfig
