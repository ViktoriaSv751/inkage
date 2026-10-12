import { json, serverConfig } from '@/lib/server';
export const dynamic = 'force-dynamic';
export async function GET() {
  return json(serverConfig());
}
