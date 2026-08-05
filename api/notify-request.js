// 열람 신청 텔레그램 알림 — login.html에서 신청 성공 직후 호출.
// 봇 토큰·챗 ID는 Vercel 환경변수(TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID) — /api/contact와 동일 봇 사용.
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

  // 허니팟 — 봇이 채우는 필드가 있으면 조용히 무시
  if (body.company) return json({ ok: true });

  const name = String(body.name || '').trim().slice(0, 100);
  const email = String(body.email || '').trim().slice(0, 200);
  const referral = String(body.referral || '').trim().slice(0, 500);
  if (!email) return json({ ok: false, error: 'email required' }, 400);

  const tk = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!tk || !chat) return json({ ok: false, error: 'not configured' }, 200);

  const adminUrl = new URL(request.url).origin + '/admin.html';
  const text = '🚨 [중요] 새 열람 신청\n\n'
    + '이름: ' + (name || '(미기재)') + '\n'
    + '이메일: ' + email + '\n'
    + '유입 경로: ' + (referral || '(미기재)') + '\n\n'
    + '승인하기 → ' + adminUrl;

  try {
    const r = await fetch('https://api.telegram.org/bot' + tk + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text: text }),
    });
    return json({ ok: r.ok });
  } catch (e) {
    return json({ ok: false }, 502);
  }
}
