// GET /api/stock/leaderboard — 수익률 순위 (상위 50).
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../../auth-config.js';
export const config = { runtime: 'edge' };

export default async function handler() {
  const r = await fetch(SUPABASE_URL + '/rest/v1/rpc/stock_leaderboard', {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: '{}',
  });
  const data = await r.json();
  return new Response(JSON.stringify({ rows: data }), {
    status: r.ok ? 200 : 502,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3, stale-while-revalidate=3',
    },
  });
}
