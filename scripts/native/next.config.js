/** @type {import('next').NextConfig} */
// Store-app build (scripts/native-build.mjs): a static copy of the app screens, no server.
module.exports = {
  reactStrictMode: true,
  output: 'export',
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_NATIVE_BUNDLE: '1' },
};
