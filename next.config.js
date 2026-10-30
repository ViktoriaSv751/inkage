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
  async redirects() {
    // e-mails already sent keep showing their pictures
    return [
      { source: '/email/welcome/aging.gif', destination: '/email/welcome/aging-v2.gif', permanent: true },
      { source: '/email/signup-hero.jpg', destination: '/email/signup-hero-v2.jpg', permanent: true },
      { source: '/email/reminder.jpg', destination: '/email/reminder-v2.jpg', permanent: true },
    ];
  },
  async headers() {
    const forever = [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }];
    // e-mail pictures: mail apps fetch them through their own proxies, so they must be cacheable (a changed picture gets a new name)
    return [{ source: '/img/:path*', headers: forever }, { source: '/email/:path*', headers: forever }, { source: '/brand/:path*', headers: forever }];
  },
};
