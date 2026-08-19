// GET /api/stock/trades?seconds=3600 — 최근 체결 내역 (대시보드 피드·마커용, 최대 400건).
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../../auth-config.js';
export const config = { runtime: 'edge' };

export default async function handler(request) {
  const url = new URL(request.url);
  const seconds = parseInt(url.searchParams.get('seconds') || '3600', 10) || 3600;
  const r = await fetch(SUPABASE_URL + '/rest/v1/rpc/stock_trades_feed', {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_seconds: seconds }),
  });
  const data = await r.json();
  return new Response(JSON.stringify({ rows: data }), {
    status: r.ok ? 200 : 502,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, s-maxage=2, stale-while-revalidate=3',
    },
  });
}
