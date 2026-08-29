/* session-bar.js — 전역 로그인·세션 상태 바
   덱 페이지는 deck-chrome 상단 바 안(스페이서 영역), 그 외 페이지는 우상단 고정 칩으로 표시.
   로그인 상태 + 세션 남은 시간 + [연장] 버튼. 비로그인 시 "로그인 안 됨 · 열람 불가" + [로그인].
   연장은 login.html(supabase-js)이 localStorage에 남긴 세션의 refresh_token으로
   access token을 재발급받아 sb-access-token 쿠키를 갱신한다 (login.html과 같은 쿠키 규약). */

(function () {
  'use strict';

  var CSS = [
    '.sbar{display:inline-flex;align-items:center;gap:0.45rem;flex:0 1 auto;min-width:0;font-family:"Pretendard","Malgun Gothic",system-ui,sans-serif;font-size:0.7rem;font-weight:700;line-height:1;padding:0.28rem 0.3rem 0.28rem 0.65rem;border-radius:999px;background:rgba(38,34,32,0.92);color:#fff;border:1px solid rgba(255,255,255,0.18);white-space:nowrap;word-break:keep-all}',
    '.sbar--warn{background:#b45309;border-color:rgba(255,255,255,0.28)}',
    '.sbar--bad{background:#991b1b;border-color:rgba(255,255,255,0.28)}',
    '.sbar-dot{width:0.5rem;height:0.5rem;border-radius:50%;background:#4ade80;flex:none}',
    '.sbar--warn .sbar-dot{background:#fbbf24}',
    '.sbar--bad .sbar-dot{background:#fca5a5}',
    '.sbar-txt{opacity:0.95;overflow:hidden;text-overflow:ellipsis;flex:0 1 auto;min-width:0;max-width:11rem}',
    '.sbar-dot,.sbar-btn{flex:none}',
    '.sbar-btn{appearance:none;cursor:pointer;border:none;border-radius:999px;background:rgba(255,255,255,0.16);color:#fff;font:inherit;font-size:0.66rem;font-weight:800;padding:0.3rem 0.6rem}',
    '.sbar-btn:hover{background:rgba(255,255,255,0.3)}',
    '.sbar-btn[disabled]{opacity:0.5;cursor:default}',
    '.sbar-btn--out{background:rgba(255,255,255,0.07);color:rgba(255,255,255,0.75)}',
    '.sbar-fix{position:fixed;top:0.6rem;right:0.7rem;z-index:920;box-shadow:0 6px 18px rgba(0,0,0,0.18)}',
    '@media print{.sbar{display:none}}'
  ].join('\n');

  function getCookieToken() {
    var m = /(?:^|;\s*)sb-access-token=([^;]+)/.exec(document.cookie || '');
    return m ? decodeURIComponent(m[1]) : null;
  }
  function jwtPayload(token) {
    try {
      var part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(decodeURIComponent(escape(atob(part))));
    } catch (e) { return null; }
  }

  if (location.pathname === '/login.html') return; // 로그인 페이지는 자체 UI가 있음

  import('/auth-config.js').then(function (cfg) {
    if (!cfg.GATE_ENABLED) return;

    var ref = (/^https:\/\/([^.]+)\./.exec(cfg.SUPABASE_URL) || [])[1];
    var LS_KEY = 'sb-' + ref + '-auth-token';

    function lsSession() {
      try {
        var raw = localStorage.getItem(LS_KEY);
        if (!raw) return null;
        var d = JSON.parse(raw);
        return d && d.currentSession ? d.currentSession : d; // 구버전 래핑 호환
      } catch (e) { return null; }
    }
    function setTokenCookie(session) {
      var maxAge = Math.max(60, (session.expires_at || 0) - Math.floor(Date.now() / 1000));
      document.cookie = 'sb-access-token=' + encodeURIComponent(session.access_token)
        + '; Path=/; Max-Age=' + maxAge + '; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : '');
    }
    function loginUrl() {
      return '/login.html?next=' + encodeURIComponent(location.pathname + location.hash);
    }

    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var bar = document.createElement('div');
    bar.className = 'sbar';
    bar.setAttribute('data-no-nav', '');
    bar.innerHTML = '<span class="sbar-dot"></span><span class="sbar-txt"></span><button type="button" class="sbar-btn"></button><button type="button" class="sbar-btn sbar-btn--out" hidden>로그아웃</button>';

    var spacer = document.querySelector('.deck-chrome__spacer');
    if (spacer) {
      spacer.style.display = 'flex';
      spacer.style.alignItems = 'center';
      spacer.style.justifyContent = 'flex-end';
      spacer.style.paddingRight = '0.9rem';
      spacer.style.minWidth = '0';       // 좁을 때 칩이 먼저 줄어들도록 — 브랜드·카운터 줄바꿈 방지
      spacer.style.overflow = 'hidden';
      spacer.appendChild(bar);
    } else {
      bar.classList.add('sbar-fix');
      document.body.appendChild(bar);
    }

    var txt = bar.querySelector('.sbar-txt');
    var btn = bar.querySelector('.sbar-btn');
    var btnOut = bar.querySelector('.sbar-btn--out');
    var mode = null; // 'extend' | 'login'

    function remainSec() {
      var tk = getCookieToken();
      var p = tk && jwtPayload(tk);
      if (!p || !p.exp) return -1;
      return p.exp - Math.floor(Date.now() / 1000);
    }

    function render() {
      var left = remainSec();
      bar.classList.remove('sbar--warn', 'sbar--bad');
      btnOut.hidden = !(left > 0 || (lsSession() && lsSession().refresh_token));
      if (left > 0) {
        var tk = getCookieToken();
        var p = jwtPayload(tk);
        var name = ((p && p.email) || '').split('@')[0] || '로그인됨';
        var min = Math.floor(left / 60);
        txt.textContent = name + ' · ' + (min >= 1 ? min + '분' : '곧 만료');
        btn.textContent = '연장';
        mode = 'extend';
        if (left < 600) bar.classList.add('sbar--warn');
      } else if (lsSession() && lsSession().refresh_token) {
        bar.classList.add('sbar--bad');
        txt.textContent = '세션 만료';
        btn.textContent = '연장';
        mode = 'extend';
      } else {
        bar.classList.add('sbar--bad');
        txt.textContent = '로그인 안 됨 · 강의자료 열람 불가';
        btn.textContent = '로그인';
        mode = 'login';
      }
    }

    function extend() {
      var sess = lsSession();
      var rt = sess && sess.refresh_token;
      if (!rt) { location.href = loginUrl(); return; }
      btn.disabled = true;
      fetch(cfg.SUPABASE_URL + '/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        headers: { apikey: cfg.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: rt })
      }).then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      }).then(function (d) {
        d.expires_at = d.expires_at || Math.floor(Date.now() / 1000) + (d.expires_in || 3600);
        try { localStorage.setItem(LS_KEY, JSON.stringify(d)); } catch (e) { /* 저장 실패해도 쿠키는 갱신 */ }
        setTokenCookie(d);
        btn.disabled = false;
        render();
        var keep = txt.textContent;
        txt.textContent = '✓ 연장됐습니다';
        setTimeout(function () { txt.textContent = keep; }, 1500);
      }).catch(function () {
        btn.disabled = false;
        location.href = loginUrl(); // 리프레시 토큰까지 만료 — 다시 로그인
      });
    }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (mode === 'login') location.href = loginUrl();
      else extend();
    });

    btnOut.addEventListener('click', function (e) {
      e.stopPropagation();
      var tk = getCookieToken();
      if (tk) {
        // 서버 세션 무효화 — 실패해도 로컬 정리는 그대로 진행
        fetch(cfg.SUPABASE_URL + '/auth/v1/logout', {
          method: 'POST',
          headers: { apikey: cfg.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + tk }
        }).catch(function () {});
      }
      document.cookie = 'sb-access-token=; Path=/; Max-Age=0; SameSite=Lax';
      try { localStorage.removeItem(LS_KEY); } catch (err) { /* 무시 */ }
      location.href = '/login.html';
    });

    render();
    setInterval(render, 20000);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') render();
    });
  }).catch(function () { /* 설정 없음 — 미표시 */ });
})();
