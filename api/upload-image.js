// 관리자 원격 이미지 업로드 — 배포 사이트에서 붙여넣은 캡처를 GitHub 저장소에 커밋한다.
// 흐름: 관리자 JWT 검증 → slide/imgs/<name> 을 GitHub Contents API로 커밋 → Vercel 재배포로 전체 반영.
// GitHub 토큰은 Vercel 환경변수(GITHUB_TOKEN)로만 보관 — 클라이언트 노출 금지.
import { SUPABASE_URL, SUPABASE_ANON_KEY, ADMIN_EMAIL, GATE_ENABLED } from '../auth-config.js';

export const config = { runtime: 'edge' };

const GITHUB_REPO = 'xxjjvxb/claude-code-tutorial';
const MAX_BASE64 = 4 * 1024 * 1024; // 약 3MB 실파일 — Edge 요청 바디 한도 내

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export default async function handler(request) {
  if (request.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405);
  if (!GATE_ENABLED) return json({ ok: false, error: '게이트 미설정 — 원격 업로드 비활성.' }, 501);

  const gh = process.env.GITHUB_TOKEN;
  if (!gh) return json({ ok: false, error: 'GITHUB_TOKEN 미설정 — Vercel 환경변수에 등록 후 재배포하세요.' }, 501);

  // 1) 관리자 인증 — Authorization 헤더의 Supabase 토큰 검증 (middleware.js와 같은 방식)
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return json({ ok: false, error: '로그인이 필요합니다.' }, 401);

  const ures = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!ures.ok) return json({ ok: false, error: '세션이 만료됐습니다 — 새로고침 후 다시.' }, 401);
  const user = await ures.json();
  if (!user || !user.email || user.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return json({ ok: false, error: '관리자만 업로드할 수 있습니다.' }, 403);
  }

  // 2) 입력 검증
  let body;
  try { body = await request.json(); } catch (e) { return json({ ok: false, error: '잘못된 요청입니다.' }, 400); }
  const name = String(body.name || '').trim();
  const data = String(body.data || '');
  if (!/^[\w.\-가-힣]+\.(png|jpe?g|webp|gif)$/i.test(name)) {
    return json({ ok: false, error: '파일명이 올바르지 않습니다: ' + name }, 400);
  }
  if (!data || !/^[A-Za-z0-9+/=]+$/.test(data)) return json({ ok: false, error: '이미지 데이터가 비어 있거나 잘못됐습니다.' }, 400);
  if (data.length > MAX_BASE64) return json({ ok: false, error: '이미지가 너무 큽니다 (3MB 이하로 캡처해 주세요).' }, 413);

  // 3) GitHub 커밋 — 기존 파일이면 sha를 얻어 교체, 없으면 신규
  const apiUrl = 'https://api.github.com/repos/' + GITHUB_REPO + '/contents/slide/imgs/' + encodeURIComponent(name);
  const ghHeaders = {
    Authorization: 'Bearer ' + gh,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'slide-image-upload',
    'Content-Type': 'application/json',
  };

  let sha = null;
  try {
    const cur = await fetch(apiUrl + '?ref=main', { headers: ghHeaders });
    if (cur.ok) { const j = await cur.json(); sha = j.sha || null; }
  } catch (e) { /* 조회 실패 → 신규로 시도 */ }

  const put = await fetch(apiUrl, {
    method: 'PUT',
    headers: ghHeaders,
    body: JSON.stringify({
      message: 'chore: 이미지 업로드 — ' + name + ' (관리자 원격 편집)',
      content: data,
      branch: 'main',
      ...(sha ? { sha } : {}),
    }),
  });
  if (!put.ok) {
    let detail = '';
    try { detail = (await put.json()).message || ''; } catch (e) { /* 무시 */ }
    return json({ ok: false, error: 'GitHub 커밋 실패 (' + put.status + (detail ? ': ' + detail : '') + ')' }, 502);
  }
  const out = await put.json();
  return json({ ok: true, commit: out.commit && out.commit.sha, replaced: !!sha });
}
