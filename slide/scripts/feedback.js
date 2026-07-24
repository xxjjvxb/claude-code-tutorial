/* feedback.js — 강의자료 우하단 질문·신고 위젯
   현재 덱 경로 + 슬라이드 번호(#slide=N)와 함께 Supabase feedback 테이블에 기록한다.
   인증은 열람 게이트의 sb-access-token 쿠키를 그대로 사용 (별도 SDK 불필요).
   auth-config.js가 미설정(GATE_ENABLED=false)이면 아무것도 렌더하지 않는다. */

(function () {
  'use strict';

  var CSS = [
    '.fb-root{position:fixed;right:1.1rem;bottom:1.3rem;z-index:900;display:flex;flex-direction:column;gap:0.5rem;align-items:flex-end;font-family:"Pretendard","Malgun Gothic",system-ui,sans-serif;word-break:keep-all}',
    '.fb-btn{appearance:none;cursor:pointer;display:inline-flex;align-items:center;gap:0.4rem;border:2px solid rgba(38,34,32,0.85);background:rgba(255,255,255,0.95);color:#262220;font-size:0.78rem;font-weight:700;padding:0.5rem 0.85rem;border-radius:999px;box-shadow:0 6px 18px rgba(0,0,0,0.14);transition:transform .12s}',
    '.fb-btn:hover{transform:translateY(-2px)}',
    '.fb-btn--report{border-color:#fe6e00;color:#cc5a14}',
    '.fb-panel{width:min(21rem,calc(100vw - 2.4rem));background:#fff;border:2px solid #262220;border-radius:14px;box-shadow:0 16px 40px rgba(0,0,0,0.22);padding:1rem;text-align:left}',
    '.fb-panel h3{margin:0 0 0.25rem;font-size:0.95rem}',
    '.fb-loc{font-size:0.72rem;color:#797067;margin-bottom:0.6rem}',
    '.fb-panel textarea{width:100%;min-height:6.5rem;resize:vertical;border:1.5px solid #e5ddd2;border-radius:8px;padding:0.6rem;font:inherit;font-size:0.84rem;line-height:1.5}',
    '.fb-panel textarea:focus{outline:2px solid #fe6e00;border-color:#fe6e00}',
    '.fb-row{display:flex;gap:0.45rem;justify-content:flex-end;margin-top:0.6rem}',
    '.fb-send{appearance:none;cursor:pointer;border:none;background:#fe6e00;color:#fff;font-weight:700;font-size:0.8rem;padding:0.5rem 1rem;border-radius:8px}',
    '.fb-send[disabled]{opacity:0.5;cursor:default}',
    '.fb-cancel{appearance:none;cursor:pointer;border:1.5px solid #e5ddd2;background:#fff;color:#797067;font-weight:600;font-size:0.8rem;padding:0.5rem 0.9rem;border-radius:8px}',
    '.fb-done{font-size:0.85rem;color:#166534;background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:8px;padding:0.7rem 0.8rem}',
    '.fb-err{font-size:0.78rem;color:#991b1b;margin-top:0.5rem}',
    '@media print{.fb-root{display:none}}'
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
  function slideNo() {
    var m = /slide=(\d+)/.exec(location.hash);
    return m ? parseInt(m[1], 10) : null;
  }

  import('/auth-config.js').then(function (cfg) {
    if (!cfg.GATE_ENABLED) return;

    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var root = document.createElement('div');
    root.className = 'fb-root';
    root.setAttribute('data-no-nav', '');
    root.innerHTML =
      '<div class="fb-panel" hidden></div>' +
      '<button type="button" class="fb-btn" data-type="question">💬 질문</button>' +
      '<button type="button" class="fb-btn fb-btn--report" data-type="report">🚨 신고</button>';
    document.body.appendChild(root);

    var panel = root.querySelector('.fb-panel');

    // 패널 안 키 입력이 deck.js 슬라이드 넘김(스페이스·화살표)으로 새지 않게
    ['keydown', 'keyup', 'keypress'].forEach(function (ev) {
      root.addEventListener(ev, function (e) { e.stopPropagation(); });
    });

    function openPanel(type) {
      var token = getCookieToken();
      if (!token) {
        location.href = '/login.html?next=' + encodeURIComponent(location.pathname + location.hash);
        return;
      }
      var isQ = type === 'question';
      var no = slideNo();
      panel.hidden = false;
      panel.innerHTML =
        '<h3>' + (isQ ? '💬 질문 보내기' : '🚨 잘못된 내용 신고') + '</h3>' +
        '<div class="fb-loc">' + document.title + (no ? ' · 슬라이드 ' + no : '') + ' — 위치가 함께 기록됩니다</div>' +
        '<textarea placeholder="' + (isQ ? '궁금한 점을 적어주세요.' : '어떤 내용이 잘못됐는지 적어주세요. (오타·낡은 정보·안 되는 명령 등)') + '"></textarea>' +
        '<div class="fb-err" hidden></div>' +
        '<div class="fb-row"><button type="button" class="fb-cancel">닫기</button><button type="button" class="fb-send">보내기</button></div>';

      var ta = panel.querySelector('textarea');
      var err = panel.querySelector('.fb-err');
      ta.focus();
      panel.querySelector('.fb-cancel').addEventListener('click', function () { panel.hidden = true; });
      panel.querySelector('.fb-send').addEventListener('click', function () {
        var content = ta.value.trim();
        if (!content) { ta.focus(); return; }
        var tk = getCookieToken();
        var p = tk && jwtPayload(tk);
        if (!p || !p.sub) {
          location.href = '/login.html?next=' + encodeURIComponent(location.pathname + location.hash);
          return;
        }
        var btn = panel.querySelector('.fb-send');
        btn.disabled = true;
        fetch(cfg.SUPABASE_URL + '/rest/v1/feedback', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: cfg.SUPABASE_ANON_KEY,
            Authorization: 'Bearer ' + tk,
            Prefer: 'return=minimal'
          },
          body: JSON.stringify({
            user_id: p.sub,
            email: p.email || '',
            type: type,
            deck_path: location.pathname,
            slide_no: slideNo(),
            page_title: document.title,
            content: content
          })
        }).then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          panel.innerHTML = '<div class="fb-done">접수됐습니다 — 확인 후 반영할게요. 감사합니다!</div>';
          setTimeout(function () { panel.hidden = true; }, 1800);
        }).catch(function (e2) {
          btn.disabled = false;
          err.hidden = false;
          err.textContent = '전송 실패 (' + e2.message + ') — 세션이 만료됐다면 페이지를 새로고침해 주세요.';
        });
      });
    }

    root.addEventListener('click', function (e) {
      var b = e.target.closest('.fb-btn');
      if (b) openPanel(b.getAttribute('data-type'));
    });
  }).catch(function () { /* 설정 파일 없음 — 위젯 미표시 */ });
})();
