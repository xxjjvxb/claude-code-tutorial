// GET /api/stock/trades?seconds=3600 — 시장 체결 히스토리 (익명, 최대 400건 최신순).
// 누가 거래했는지는 공개하지 않는다 — 이름은 응답에서 제거.
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
  const rows = Array.isArray(data) ? data.map(({ name, ...rest }) => rest) : data;
  return new Response(JSON.stringify({ rows }), {
    status: r.ok ? 200 : 502,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3, stale-while-revalidate=6',
    },
  });
}
