/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The TV app lives in tv/ but imports shared server code (AniList client,
  // stream types) from the repo's ../lib via the @shared alias. externalDir
  // lets Next compile those TypeScript files from outside this app's root.
  experimental: {
    externalDir: true,
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
