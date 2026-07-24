// Vercel Edge Middleware — /slide/* 열람 게이트
// 로그인(sb-access-token 쿠키) + Supabase access_requests 승인 상태를 서버단에서 검증한다.
// auth-config.js 값이 채워지기 전(GATE_ENABLED=false)에는 전부 통과(전체 공개 유지).
import { SUPABASE_URL, SUPABASE_ANON_KEY, ADMIN_EMAIL, GATE_ENABLED } from './auth-config.js';

export const config = { matcher: '/slide/:path*' };

export default async function middleware(request) {
  if (!GATE_ENABLED) return;

  const url = new URL(request.url);
  const cookie = request.headers.get('cookie') || '';
  const m = /(?:^|;\s*)sb-access-token=([^;]+)/.exec(cookie);
  const token = m ? decodeURIComponent(m[1]) : null;
  const isDoc = (request.headers.get('accept') || '').includes('text/html');

  const deny = () =>
    isDoc
      ? Response.redirect(new URL('/login.html?next=' + encodeURIComponent(url.pathname), url), 302)
      : new Response('Unauthorized', { status: 401 });

  if (!token) return deny();

  // 이미지·CSS 등 자산은 토큰 존재만 확인(속도) — 문서(HTML)는 아래에서 전체 검증
  if (!isDoc) return;

  // 1) 토큰 유효성 + 사용자 확인
  const ures = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!ures.ok) return deny();
  const user = await ures.json();
  if (!user || !user.id) return deny();
  if (user.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) return; // 관리자는 통과

  // 2) 승인 상태 확인 (RLS: 본인 행만 조회 가능)
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/access_requests?user_id=eq.${user.id}&select=status&limit=1`,
    { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } },
  );
  if (!r.ok) return deny();
  const rows = await r.json();
  if (Array.isArray(rows) && rows[0] && rows[0].status === 'approved') return;

  return deny();
}
