// GET /api/stock/history?symbol=A&seconds=600 — 초 단위 시세·거래량 (최대 3600초, 포인트 자동 압축).
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../../auth-config.js';
export const config = { runtime: 'edge' };

export default async function handler(request) {
  const url = new URL(request.url);
  const symbol = (url.searchParams.get('symbol') || 'A').toUpperCase();
  const seconds = parseInt(url.searchParams.get('seconds') || '600', 10) || 600;
  if (!['A', 'B', 'C'].includes(symbol)) {
    return new Response(JSON.stringify({ error: 'symbol must be A/B/C' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  const r = await fetch(SUPABASE_URL + '/rest/v1/rpc/stock_history', {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_symbol: symbol, p_seconds: seconds }),
  });
  const data = await r.json();
  return new Response(JSON.stringify({ symbol, series: data }), {
    status: r.ok ? 200 : 502,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, s-maxage=1, stale-while-revalidate=2',
    },
  });
}
