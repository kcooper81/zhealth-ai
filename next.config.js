/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "zhealtheducation.com",
      },
    ],
  },
};

module.exports = nextConfig;
