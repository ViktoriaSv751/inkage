/** Android App Links. ANDROID_CERT_SHA256 = comma-separated SHA-256 fingerprints
    (Play Console > Test and release > App integrity > App signing key, plus the upload key). */
export const dynamic = 'force-dynamic';
export function GET() {
  const prints = (process.env.ANDROID_CERT_SHA256 || '').split(',').map((s) => s.trim()).filter(Boolean);
  return Response.json(
    prints.length
      ? [{ relation: ['delegate_permission/common.handle_all_urls'], target: { namespace: 'android_app', package_name: 'app.inkage', sha256_cert_fingerprints: prints } }]
      : []
  );
}
