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
        {
          source: '/img/:name(hf_[0-9]{8}_[0-9]{6}_[a-f0-9-]{36})-:w(\\d+).avif',
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
    // security headers (Lighthouse best practices): HTTPS only incl. subdomains, own browsing-context group but sign-in /
    // payment popups keep working, nobody may frame the site except /embed/* (the pain map other sites embed)
    const safe = [
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    ];
    const noFrame = [
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'Content-Security-Policy', value: "object-src 'none'; base-uri 'self'; frame-ancestors 'self'" },
    ];
    return [
      { source: '/:path*', headers: safe },
      { source: '/((?!embed/).*)', headers: noFrame },
      { source: '/embed/:path*', headers: [{ key: 'Content-Security-Policy', value: "object-src 'none'; base-uri 'self'" }] },
      { source: '/img/:path*', headers: forever }, { source: '/email/:path*', headers: forever }, { source: '/brand/:path*', headers: forever }];
  },
};
