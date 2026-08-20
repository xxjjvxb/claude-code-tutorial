// GET /api/stock/price — 3종목 현재가·거래량. CDN 1초 캐시로 폴링 부하 흡수.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../../auth-config.js';
export const config = { runtime: 'edge' };

export default async function handler() {
  const r = await fetch(SUPABASE_URL + '/rest/v1/rpc/stock_quote', {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: '{}',
  });
  const data = await r.json();
  return new Response(JSON.stringify({ t: Math.floor(Date.now() / 1000), quotes: data }), {
    status: r.ok ? 200 : 502,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, s-maxage=2, stale-while-revalidate=4',
    },
  });
}
