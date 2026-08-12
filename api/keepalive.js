// Supabase 일시정지(무료 플랜 7일 미사용) 방지용 keep-alive.
// vercel.json 크론이 매일 한 번 호출 — 가벼운 쿼리로 API 활동을 남긴다.
import { SUPABASE_URL, SUPABASE_ANON_KEY, GATE_ENABLED } from '../auth-config.js';

export const config = { runtime: 'edge' };

export default async function handler() {
  if (!GATE_ENABLED) {
    return new Response(JSON.stringify({ ok: false, error: 'gate disabled' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  }
  let ok = false;
  try {
    const r = await fetch(SUPABASE_URL + '/rest/v1/feedback?select=id&limit=1', {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY },
    });
    ok = r.ok;
  } catch (e) { /* 실패해도 다음 크론에서 재시도 */ }
  return new Response(JSON.stringify({ ok, at: new Date().toISOString() }), {
    status: ok ? 200 : 502, headers: { 'Content-Type': 'application/json' },
  });
}
