/** iOS Universal Links: shared vote links and app links open in the InkAge app when it is installed. */
export const dynamic = 'force-static';
export function GET() {
  const appID = `${process.env.APPLE_TEAM_ID || 'BVM9R6J6D3'}.${process.env.IOS_BUNDLE_ID || 'app.inkage'}`;
  return Response.json(
    { applinks: { details: [{ appIDs: [appID], components: [{ '/': '/v/*' }, { '/': '/app*' }] }] }, webcredentials: { apps: [appID] } },
    { headers: { 'content-type': 'application/json' } }
  );
}
