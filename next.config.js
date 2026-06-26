/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 's4.anilist.co' },
      { protocol: 'https', hostname: 'img.anili.st' },
      { protocol: 'https', hostname: 'artworks.thetvdb.com' },
    ],
  },
  webpack: (config) => {
    // WebTorrent expects some Node core modules that don't exist in the browser.
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      dgram: false,
    };
    return config;
  },
};

module.exports = nextConfig;
