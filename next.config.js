/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  async rewrites() {
    return {
      // pre-rendered photos live in public/img; if one is missing, resize it on demand
      fallback: [
        {
          source: '/img/:name(hf_[0-9]{8}_[0-9]{6}_[a-f0-9-]{36})-:w(\\d+).webp',
          destination: '/api/lib-img?f=:name.png&w=:w',
        },
      ],
    };
  },
  async headers() {
    return [{ source: '/img/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] }];
  },
};
