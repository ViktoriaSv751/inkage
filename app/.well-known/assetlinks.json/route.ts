/** Android App Links. ANDROID_CERT_SHA256 = comma-separated SHA-256 fingerprints
    (Play Console > Test and release > App integrity > App signing key, plus the upload key). */
// Public certificate fingerprints (not secrets): Play app signing key, then our upload key.
const DEFAULT_PRINTS =
  '45:D9:BB:F1:00:5E:BF:B2:A9:2E:6A:B4:AB:75:1D:22:17:77:DB:B7:6E:1F:E1:48:ED:F6:A8:1C:64:93:59:EB,E5:A8:E6:DF:A7:7D:5E:B7:89:5F:53:C4:8D:74:73:B5:63:94:4E:81:45:5C:76:4C:86:11:47:24:46:AB:36:C9';

export const dynamic = 'force-dynamic';
export function GET() {
  const prints = (process.env.ANDROID_CERT_SHA256 || DEFAULT_PRINTS).split(',').map((s) => s.trim()).filter(Boolean);
  return Response.json(
    prints.length
      ? [{ relation: ['delegate_permission/common.handle_all_urls'], target: { namespace: 'android_app', package_name: 'app.inkage', sha256_cert_fingerprints: prints } }]
      : []
  );
}
