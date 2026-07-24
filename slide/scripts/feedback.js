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
    /* ---- 관리자 라이브 패널 (우측) ---- */
    '.fbq-tab{position:fixed;right:0;top:38%;z-index:910;writing-mode:vertical-rl;cursor:pointer;appearance:none;border:2px solid #fe6e00;border-right:none;background:#fff;color:#cc5a14;font-weight:800;font-size:0.8rem;letter-spacing:0.08em;padding:0.8rem 0.45rem;border-radius:10px 0 0 10px;box-shadow:0 6px 18px rgba(0,0,0,0.15)}',
    '.fbq-tab .n{display:inline-block;background:#fe6e00;color:#fff;border-radius:999px;padding:0.35rem 0.15rem;margin-top:0.4rem;font-size:0.72rem}',
    '.fbq-tab.pulse{animation:fbqPulse 1s ease 3}',
    '@keyframes fbqPulse{0%,100%{transform:none}50%{transform:translateX(-4px);background:#fff7ed}}',
    '.fbq-panel{position:fixed;right:0.9rem;top:3.4rem;bottom:3.2rem;z-index:905;width:min(21rem,calc(100vw - 2rem));display:flex;flex-direction:column;background:#fff;border:2px solid #262220;border-radius:14px;box-shadow:0 16px 40px rgba(0,0,0,0.22);overflow:hidden;font-family:"Pretendard","Malgun Gothic",system-ui,sans-serif;word-break:keep-all}',
    '.fbq-head{display:flex;align-items:center;gap:0.5rem;padding:0.6rem 0.8rem;background:#f6f1e9;border-bottom:1.5px solid #e5ddd2;font-size:0.82rem;font-weight:800}',
    '.fbq-head .sp{flex:1}',
    '.fbq-close{appearance:none;cursor:pointer;border:1.5px solid #e5ddd2;background:#fff;border-radius:6px;font-size:0.72rem;font-weight:700;padding:0.25rem 0.55rem;color:#797067}',
    '.fbq-list{flex:1;overflow-y:auto;padding:0.55rem}',
    '.fbq-empty{font-size:0.78rem;color:#b0a79c;text-align:center;padding:1.2rem 0.5rem}',
    '.fbq-item{border:1.5px solid #e5ddd2;border-radius:10px;padding:0.6rem 0.7rem;margin-bottom:0.5rem;background:#fff}',
    '.fbq-item.new{border-color:#fe6e00;background:#fff7ed}',
    '.fbq-meta{display:flex;align-items:center;gap:0.4rem;font-size:0.68rem;color:#797067;margin-bottom:0.3rem;flex-wrap:wrap}',
    '.fbq-ty{font-weight:800;border-radius:999px;padding:0.1rem 0.45rem;font-size:0.66rem}',
    '.fbq-ty-question{background:#eff6ff;color:#1d4ed8}',
    '.fbq-ty-report{background:#fef2f2;color:#991b1b}',
    '.fbq-content{font-size:0.82rem;line-height:1.5;white-space:pre-wrap;margin-bottom:0.45rem}',
    '.fbq-row{display:flex;gap:0.35rem;justify-content:flex-end}',
    '.fbq-go{appearance:none;cursor:pointer;border:1.5px solid #e5ddd2;background:#fff;border-radius:6px;font-size:0.7rem;font-weight:700;padding:0.28rem 0.6rem;color:#cc5a14;text-decoration:none}',
    '.fbq-done{appearance:none;cursor:pointer;border:none;background:#fe6e00;color:#fff;border-radius:6px;font-size:0.7rem;font-weight:700;padding:0.3rem 0.65rem}',
    '@media print{.fb-root,.fbq-tab,.fbq-panel{display:none}}',
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
          panel.innerHTML = '<div class="fb-done">' + (type === 'question'
            ? '질문이 전달됐습니다 — 강의 중이라면 바로 확인하고 답변드려요!'
            : '신고 접수됐습니다 — 확인 후 바로잡을게요. 감사합니다!') + '</div>';
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

    /* ================= 관리자 라이브 패널 =================
       관리자 계정으로 접속 중이면 5초마다 미처리 질문·신고를 폴링해
       우측 패널에 표시. 새 항목 도착 시 자동으로 펼침.
       각 항목의 체크(✓)를 누르면 해소(resolved) 처리되어 목록에서 사라짐. */
    (function () {
      var tk0 = getCookieToken();
      var p0 = tk0 && jwtPayload(tk0);
      if (!p0 || !p0.email || p0.email.toLowerCase() !== cfg.ADMIN_EMAIL.toLowerCase()) return;

      var POLL_MS = 5000;
      var seen = {};        // id → true (한 번이라도 표시한 항목)
      var items = [];       // 현재 미처리 항목
      var open = false;
      var firstLoad = true;

      var tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'fbq-tab';
      tab.setAttribute('data-no-nav', '');
      tab.innerHTML = '질문·신고 <span class="n">0</span>';
      tab.hidden = true;
      document.body.appendChild(tab);

      var qp = document.createElement('div');
      qp.className = 'fbq-panel';
      qp.setAttribute('data-no-nav', '');
      qp.hidden = true;
      qp.innerHTML =
        '<div class="fbq-head">🔔 실시간 질문·신고<span class="sp"></span>' +
        '<button type="button" class="fbq-close">접기</button></div>' +
        '<div class="fbq-list"></div>';
      document.body.appendChild(qp);
      ['keydown', 'keyup', 'keypress'].forEach(function (ev) {
        qp.addEventListener(ev, function (e) { e.stopPropagation(); });
      });

      var esc = function (s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;'); };

      function setOpen(v) {
        open = v;
        qp.hidden = !v;
        tab.hidden = v || items.length === 0;
      }
      tab.addEventListener('click', function () { setOpen(true); render(); });
      qp.querySelector('.fbq-close').addEventListener('click', function () { setOpen(false); });

      function render() {
        var list = qp.querySelector('.fbq-list');
        tab.querySelector('.n').textContent = items.length;
        if (!items.length) {
          list.innerHTML = '<div class="fbq-empty">미처리 질문·신고가 없습니다 🎉</div>';
          return;
        }
        list.innerHTML = '';
        items.forEach(function (r) {
          var el = document.createElement('div');
          el.className = 'fbq-item' + (r._new ? ' new' : '');
          var when = new Date(r.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
          var here = r.deck_path === location.pathname;
          var loc = (r.page_title || r.deck_path) + (r.slide_no ? ' · ' + r.slide_no : '');
          el.innerHTML =
            '<div class="fbq-meta"><span class="fbq-ty fbq-ty-' + r.type + '">' + (r.type === 'report' ? '🚨 신고' : '💬 질문') + '</span>' +
            '<span>' + esc(r.email) + '</span><span>' + when + '</span></div>' +
            '<div class="fbq-content">' + esc(r.content) + '</div>' +
            '<div class="fbq-row">' +
            (r.slide_no
              ? (here
                ? '<button type="button" class="fbq-go" data-go="' + r.slide_no + '">슬라이드 ' + r.slide_no + '로</button>'
                : '<a class="fbq-go" target="_blank" rel="noopener" href="' + esc(r.deck_path + '#slide=' + r.slide_no) + '">' + esc(loc) + ' ↗</a>')
              : '') +
            '<button type="button" class="fbq-done" data-done="' + r.id + '">✓ 해소</button></div>';
          list.appendChild(el);
        });
      }

      qp.addEventListener('click', function (e) {
        var g = e.target.closest('[data-go]');
        if (g) { location.hash = '#slide=' + g.getAttribute('data-go'); return; }
        var d = e.target.closest('[data-done]');
        if (d) resolve(parseInt(d.getAttribute('data-done'), 10));
      });

      function resolve(id) {
        var tk = getCookieToken();
        if (!tk) return;
        fetch(cfg.SUPABASE_URL + '/rest/v1/feedback?id=eq.' + id, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            apikey: cfg.SUPABASE_ANON_KEY,
            Authorization: 'Bearer ' + tk,
            Prefer: 'return=minimal'
          },
          body: JSON.stringify({ status: 'resolved', resolved_at: new Date().toISOString() })
        }).then(function (res) {
          if (!res.ok) return;
          items = items.filter(function (r) { return r.id !== id; });
          render();
          if (!items.length && open) setTimeout(function () { setOpen(false); }, 600);
          tab.hidden = open || items.length === 0;
        });
      }

      function poll() {
        if (document.visibilityState === 'hidden') return;
        var tk = getCookieToken();
        if (!tk) return;
        fetch(cfg.SUPABASE_URL + '/rest/v1/feedback?status=eq.open&select=id,email,type,deck_path,slide_no,page_title,content,created_at&order=created_at.desc&limit=30', {
          headers: { apikey: cfg.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + tk }
        }).then(function (res) { return res.ok ? res.json() : null; }).then(function (rows) {
          if (!rows) return;
          var hasNew = false;
          rows.forEach(function (r) {
            r._new = !seen[r.id] && !firstLoad;
            if (r._new) hasNew = true;
            seen[r.id] = true;
          });
          items = rows;
          firstLoad = false;
          tab.hidden = open || items.length === 0;
          tab.querySelector('.n').textContent = items.length;
          if (hasNew) {
            if (!open) setOpen(true);
            tab.classList.remove('pulse'); void tab.offsetWidth; tab.classList.add('pulse');
          }
          if (open) render();
        }).catch(function () { /* 네트워크 오류 — 다음 폴링에서 재시도 */ });
      }

      poll();
      setInterval(poll, POLL_MS);
    })();
  }).catch(function () { /* 설정 파일 없음 — 위젯 미표시 */ });
})();
