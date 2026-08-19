// POST /api/stock/order — 시장가 주문. 헤더 X-API-Key + 본문 {"symbol":"A","side":"buy","qty":10}
// 슬리피지: 체결가 = 현재가 × (1 ± 0.0005×qty, 최대 5%) · 키당 1초 1회.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../../auth-config.js';
export const config = { runtime: 'edge' };

function json(obj, status) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

export default async function handler(request) {
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
  const key = request.headers.get('x-api-key');
  if (!key) return json({ error: 'X-API-Key header required' }, 401);

  let body;
  try { body = await request.json(); } catch (e) { return json({ error: 'invalid json body' }, 400); }

  const r = await fetch(SUPABASE_URL + '/rest/v1/rpc/stock_order', {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      p_key: key,
      p_symbol: String(body.symbol || '').toUpperCase(),
      p_side: String(body.side || '').toLowerCase(),
      p_qty: parseInt(body.qty, 10) || 0,
    }),
  });
  const data = await r.json();
  if (!r.ok) {
    const msg = (data && (data.message || data.hint)) || 'order failed';
    const status = /rate limit/.test(msg) ? 429 : /invalid api key/.test(msg) ? 401 : 400;
    return json({ error: msg }, status);
  }
  return json(Array.isArray(data) ? data[0] : data);
}
