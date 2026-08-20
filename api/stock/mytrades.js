// GET /api/stock/mytrades?limit=100 — 내 체결 내역 (최신순, 최대 400). 헤더 X-API-Key.
// 개인 데이터라 CDN 캐시 없음.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../../auth-config.js';
export const config = { runtime: 'edge' };

function json(obj, status) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

export default async function handler(request) {
  const key = request.headers.get('x-api-key');
  if (!key) return json({ error: 'X-API-Key header required' }, 401);

  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '100', 10) || 100;

  const r = await fetch(SUPABASE_URL + '/rest/v1/rpc/stock_my_trades', {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_key: key, p_limit: limit }),
  });
  const data = await r.json();
  if (!r.ok) return json({ error: (data && data.message) || 'failed' }, 400);
  return json({ rows: data });
}
