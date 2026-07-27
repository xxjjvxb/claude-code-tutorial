// 공개 문의 접수 — 로그인 불필요.
// 1) Supabase contact_messages 저장  2) 텔레그램 알림  3) 관리자 메일 전달(FormSubmit 릴레이)
// 텔레그램 봇 토큰·챗 ID는 Vercel 환경변수(TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID)로만 보관 — 클라이언트 노출 금지.
import { SUPABASE_URL, SUPABASE_ANON_KEY, ADMIN_EMAIL, GATE_ENABLED } from '../auth-config.js';

export const config = { runtime: 'edge' };

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export default async function handler(request) {
  if (request.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405);

  let body;
  try { body = await request.json(); } catch (e) { return json({ ok: false, error: '잘못된 요청입니다.' }, 400); }

  // 허니팟 — 사람 눈에 안 보이는 필드가 채워져 있으면 봇으로 보고 조용히 무시
  if (body.company) return json({ ok: true, results: {} });

  const name = String(body.name || '').trim().slice(0, 100);
  const email = String(body.email || '').trim().slice(0, 200);
  const message = String(body.message || '').trim().slice(0, 4000);
  if (!email || !message) return json({ ok: false, error: '이메일과 내용을 입력해 주세요.' }, 400);

  const results = { db: false, telegram: false, mail: false };

  // 1) Supabase 저장 (RLS: anon insert-only)
  if (GATE_ENABLED) {
    try {
      const r = await fetch(SUPABASE_URL + '/rest/v1/contact_messages', {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ name: name || null, email, message }),
      });
      results.db = r.ok;
    } catch (e) { /* 저장 실패해도 알림은 계속 */ }
  }

  // 2) 텔레그램 알림
  const tk = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (tk && chat) {
    try {
      const text = '📩 새 문의 도착\n이름: ' + (name || '(미기재)') + '\n이메일: ' + email + '\n\n' + message;
      const r = await fetch('https://api.telegram.org/bot' + tk + '/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chat, text: text }),
      });
      results.telegram = r.ok;
    } catch (e) { /* 계속 */ }
  }

  // 3) 관리자 메일 전달 — FormSubmit 릴레이 (최초 1회 수신함에서 활성화 링크 클릭 필요)
  try {
    const r = await fetch('https://formsubmit.co/ajax/' + ADMIN_EMAIL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        _subject: '[바이브코딩 강의] 새 문의 — ' + (name || email),
        _replyto: email,
        _template: 'table',
        이름: name || '(미기재)',
        이메일: email,
        내용: message,
      }),
    });
    results.mail = r.ok;
  } catch (e) { /* 계속 */ }

  const ok = results.db || results.telegram || results.mail;
  return json({ ok, results }, ok ? 200 : 502);
}
