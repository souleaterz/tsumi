const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // With Root Directory = tv on Vercel, the build otherwise picks up the repo's
  // root .eslintrc (which extends a config not installed in tv/). We lint
  // separately; don't fail the production build on it.
  eslint: {
    ignoreDuringBuilds: true,
  },
  // The TV app lives in tv/ but imports shared server code (AniList client,
  // stream types) from the repo's ../lib via the @shared alias. externalDir
  // lets Next compile those TypeScript files from outside this app's root.
  experimental: {
    externalDir: true,
  },
  webpack: (config) => {
    // A shared file in ../lib that imports a bare package resolves node_modules
    // relative to ITS location — the repo root, which Vercel doesn't install
    // when the Root Directory is tv/. Prefer this app's own node_modules.
    config.resolve.modules = [
      path.join(__dirname, 'node_modules'),
      'node_modules',
      ...(config.resolve.modules || []),
    ];
    // The TV app never uses the HiAnime provider (RD/torrents only), so stub out
    // `aniwatch` and keep its heavy cheerio/parse5/entities tree out of the
    // bundle. provider.ts only references HiAnime inside gated code that never
    // runs here.
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      aniwatch: path.join(__dirname, 'stubs/aniwatch.js'),
    };
    return config;
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 's4.anilist.co' },
      { protocol: 'https', hostname: 'img.anili.st' },
      { protocol: 'https', hostname: 'artworks.thetvdb.com' },
    ],
  },
};

module.exports = nextConfig;
