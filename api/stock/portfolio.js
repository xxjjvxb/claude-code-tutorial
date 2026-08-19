// GET /api/stock/portfolio — 내 현금·보유·평가액·수익률·최근 체결. 헤더 X-API-Key.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../../auth-config.js';
export const config = { runtime: 'edge' };

function json(obj, status) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

export default async function handler(request) {
  const key = request.headers.get('x-api-key');
  if (!key) return json({ error: 'X-API-Key header required' }, 401);

  const r = await fetch(SUPABASE_URL + '/rest/v1/rpc/stock_portfolio', {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_key: key }),
  });
  const data = await r.json();
  if (!r.ok) return json({ error: (data && data.message) || 'failed' }, 400);
  if (!Array.isArray(data) || !data[0]) return json({ error: 'invalid api key' }, 401);
  return json(data[0]);
}
