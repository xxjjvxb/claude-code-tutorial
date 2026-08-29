/* feedback.js — 질문·신고·제출 드로어 (우측 가장자리, hover/탭으로 슬라이드아웃)
   현재 덱 경로 + 슬라이드 번호(#slide=N)와 함께 Supabase feedback 테이블에 기록한다.
   인증은 열람 게이트의 sb-access-token 쿠키를 그대로 사용 (별도 SDK 불필요).
   미설정(GATE_ENABLED=false)이거나 로그인 토큰이 없으면 렌더하지 않는다. */

(function () {
  'use strict';

  var CSS = [
    '.fb-root{position:fixed;right:0;bottom:1.6rem;z-index:900;display:flex;align-items:flex-end;font-family:"Pretendard","Malgun Gothic",system-ui,sans-serif;word-break:keep-all;transform:translateX(calc(100% - 1.4rem));transition:transform .28s ease}',
    '.fb-root:hover,.fb-root.open{transform:translateX(0)}',
    '.fb-handle{cursor:pointer;align-self:stretch;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.35rem;width:1.4rem;background:#fe6e00;color:#fff;border-radius:10px 0 0 10px;box-shadow:-4px 4px 14px rgba(0,0,0,0.18);font-size:0.82rem;font-weight:800;user-select:none}',
    '.fb-handle .ch{transition:transform .28s ease}',
    '.fb-root:hover .fb-handle .ch,.fb-root.open .fb-handle .ch{transform:rotate(180deg)}',
    '.fb-stack{display:flex;flex-direction:column;gap:0.5rem;align-items:flex-end;padding:0 1rem 0 0.6rem;background:transparent}',
    '.fb-btn{appearance:none;cursor:pointer;display:inline-flex;align-items:center;gap:0.4rem;border:2px solid rgba(38,34,32,0.85);background:rgba(255,255,255,0.97);color:#262220;font-size:0.78rem;font-weight:700;padding:0.5rem 0.85rem;border-radius:999px;box-shadow:0 6px 18px rgba(0,0,0,0.14);transition:transform .12s;white-space:nowrap}',
    '.fb-btn:hover{transform:translateY(-2px)}',
    '.fb-btn--report{border-color:#fe6e00;color:#cc5a14}',
    '.fb-btn--submit{border-color:#166534;color:#166534}',
    '.fb-panel input[type=url]{width:100%;border:1.5px solid #e5ddd2;border-radius:8px;padding:0.55rem;font:inherit;font-size:0.84rem;margin-bottom:0.45rem}',
    '.fb-panel input[type=url]:focus{outline:2px solid #166534;border-color:#166534}',
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
    '.fbq-panel[hidden],.fbq-tab[hidden]{display:none !important}',
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
    '.fbq-ty-submission{background:#f0fdf4;color:#166534}',
    '.fbq-content{font-size:0.82rem;line-height:1.5;white-space:pre-wrap;margin-bottom:0.45rem}',
    '.fbq-row{display:flex;gap:0.35rem;justify-content:flex-end}',
    '.fbq-go{appearance:none;cursor:pointer;border:1.5px solid #e5ddd2;background:#fff;border-radius:6px;font-size:0.7rem;font-weight:700;padding:0.28rem 0.6rem;color:#cc5a14;text-decoration:none}',
    '.fbq-done{appearance:none;cursor:pointer;border:none;background:#fe6e00;color:#fff;border-radius:6px;font-size:0.7rem;font-weight:700;padding:0.3rem 0.65rem}',
    '.fbq-sec{font-size:0.7rem;font-weight:800;color:#797067;margin:0.6rem 0 0.4rem;padding-top:0.55rem;border-top:1.5px dashed #e5ddd2}',
    '.fbq-ty-fixed{background:#fff7ed;color:#cc5a14}',
    '.fbq-fix{font-size:0.72rem;line-height:1.45;color:#166534;background:#f0fdf4;border-radius:6px;padding:0.35rem 0.5rem;margin-bottom:0.45rem;white-space:pre-wrap}',
    '.fbq-re{appearance:none;cursor:pointer;border:1.5px solid #fca5a5;background:#fff;color:#b91c1c;border-radius:6px;font-size:0.7rem;font-weight:700;padding:0.28rem 0.6rem}',
    '.fbq-ok{appearance:none;cursor:pointer;border:none;background:#166534;color:#fff;border-radius:6px;font-size:0.7rem;font-weight:700;padding:0.3rem 0.65rem}',
    '.fbq-share{appearance:none;cursor:pointer;border:1.5px solid #bbf7d0;background:#f0fdf4;color:#166534;border-radius:6px;font-size:0.7rem;font-weight:700;padding:0.28rem 0.6rem}',
    '.fbq-unshare{appearance:none;cursor:pointer;border:1.5px solid #e5ddd2;background:#fff;color:#797067;border-radius:6px;font-size:0.7rem;font-weight:700;padding:0.28rem 0.6rem}',
    '.fbq-sec--shared{display:flex;align-items:center;gap:0.3rem}',
    '.fbq-sec--shared .sp{flex:1}',
    '.fbq-alloff{appearance:none;cursor:pointer;border:1.5px solid #fecaca;background:#fff;color:#991b1b;border-radius:6px;font-size:0.66rem;font-weight:700;padding:0.22rem 0.5rem}',
    '.fbq-worklink{display:inline-block;font-size:0.76rem;font-weight:700;color:#1d4ed8;text-decoration:underline;margin-bottom:0.35rem;word-break:break-all}',
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
    if (!getCookieToken()) return; // 로그인 전에는 표시하지 않음

    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var root = document.createElement('div');
    root.className = 'fb-root';
    root.setAttribute('data-no-nav', '');
    root.innerHTML =
      '<div class="fb-handle" title="질문 · 신고 · 제출"><span class="ch">‹</span></div>' +
      '<div class="fb-stack">' +
      '<div class="fb-panel" hidden></div>' +
      '<button type="button" class="fb-btn" data-type="question">💬 질문</button>' +
      '<button type="button" class="fb-btn fb-btn--report" data-type="report">🚨 신고</button>' +
      '<button type="button" class="fb-btn fb-btn--submit" data-type="submission">📤 제출</button>' +
      '</div>';
    document.body.appendChild(root);

    var panel = root.querySelector('.fb-panel');
    // 터치 기기 대응 — 핸들 탭으로 열고 닫기
    root.querySelector('.fb-handle').addEventListener('click', function () {
      root.classList.toggle('open');
    });

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
      var isSub = type === 'submission';
      var no = slideNo();
      root.classList.add('open');
      panel.hidden = false;
      panel.innerHTML =
        '<h3>' + (isSub ? '📤 내 작품 제출' : (isQ ? '💬 질문 보내기' : '🚨 잘못된 내용 신고')) + '</h3>' +
        (isSub
          ? '<div class="fb-loc">배포한 작품 링크를 제출하세요 — 발표 대신/발표와 함께, 부담 없이!</div>' +
            '<input type="url" placeholder="https://내작품주소.vercel.app">' +
            '<textarea placeholder="한 줄 소개 — 무엇을 만들었나요? (선택)"></textarea>'
          : '<div class="fb-loc">' + document.title + (no ? ' · 슬라이드 ' + no : '') + ' — 위치가 함께 기록됩니다</div>' +
            '<textarea placeholder="' + (isQ ? '궁금한 점을 적어주세요.' : '어떤 내용이 잘못됐는지 적어주세요. (오타·낡은 정보·안 되는 명령 등)') + '"></textarea>') +
        '<div class="fb-err" hidden></div>' +
        '<div class="fb-row"><button type="button" class="fb-cancel">닫기</button><button type="button" class="fb-send">' + (isSub ? '제출하기' : '보내기') + '</button></div>';

      var ta = panel.querySelector('textarea');
      var err = panel.querySelector('.fb-err');
      ta.focus();
      panel.querySelector('.fb-cancel').addEventListener('click', function () { panel.hidden = true; root.classList.remove('open'); });
      var urlInput = panel.querySelector('input[type=url]');
      if (urlInput) urlInput.focus();
      panel.querySelector('.fb-send').addEventListener('click', function () {
        var content = ta.value.trim();
        if (isSub) {
          var u = (urlInput.value || '').trim();
          if (!u) { urlInput.focus(); return; }
          content = '링크: ' + u + (content ? '\n' + content : '');
        } else if (!content) { ta.focus(); return; }
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
          panel.innerHTML = '<div class="fb-done">' + (type === 'submission'
            ? '제출 완료! 멋진 작품 잘 받았습니다 👏'
            : (type === 'question'
              ? '질문이 전달됐습니다 — 강의 중이라면 바로 확인하고 답변드려요!'
              : '신고 접수됐습니다 — 확인 후 바로잡을게요. 감사합니다!')) + '</div>';
          setTimeout(function () { panel.hidden = true; root.classList.remove('open'); }, 1800);
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
      var items = [];       // 현재 미처리 질문·제출
      var reviews = [];     // 대응 완료(fixed) — 검수 대기 신고
      var shared = [];      // 공유 중 제출물 (submission-share-update.sql 실행 전엔 빈 목록)
      var sharedOk = false; // shared 컬럼 마이그레이션 여부
      var open = false;
      var firstLoad = true;
      function total() { return items.length + reviews.length; }
      function allCount() { return total() + shared.length; }

      var tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'fbq-tab';
      tab.setAttribute('data-no-nav', '');
      tab.innerHTML = '질문·검수 <span class="n">0</span>';
      tab.hidden = true;
      document.body.appendChild(tab);

      var qp = document.createElement('div');
      qp.className = 'fbq-panel';
      qp.setAttribute('data-no-nav', '');
      qp.hidden = true;
      qp.innerHTML =
        '<div class="fbq-head">🔔 질문·제출 · 검수<span class="sp"></span>' +
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
        tab.hidden = v || allCount() === 0;
      }
      tab.addEventListener('click', function () { setOpen(true); render(); });
      qp.querySelector('.fbq-close').addEventListener('click', function () { setOpen(false); });

      function render() {
        var list = qp.querySelector('.fbq-list');
        tab.querySelector('.n').textContent = total();
        list.innerHTML = '';
        if (!allCount()) {
          list.innerHTML = '<div class="fbq-empty">미처리 질문·제출·검수가 없습니다 🎉</div>';
          return;
        }
        items.forEach(function (r) {
          var el = document.createElement('div');
          el.className = 'fbq-item' + (r._new ? ' new' : '');
          var when = new Date(r.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
          var here = r.deck_path === location.pathname;
          var loc = (r.page_title || r.deck_path) + (r.slide_no ? ' · ' + r.slide_no : '');
          el.innerHTML =
            '<div class="fbq-meta"><span class="fbq-ty fbq-ty-' + r.type + '">' + (r.type === 'report' ? '🚨 신고' : (r.type === 'submission' ? '📤 제출' : '💬 질문')) + '</span>' +
            '<span>' + esc(r.email) + '</span><span>' + when + '</span></div>' +
            '<div class="fbq-content">' + esc(r.content) + '</div>' +
            '<div class="fbq-row">' +
            (r.slide_no
              ? (here
                ? '<button type="button" class="fbq-go" data-go="' + r.slide_no + '">슬라이드 ' + r.slide_no + '로</button>'
                : '<a class="fbq-go" target="_blank" rel="noopener" href="' + esc(r.deck_path + '#slide=' + r.slide_no) + '">' + esc(loc) + ' ↗</a>')
              : '') +
            (r.type === 'submission' && sharedOk ? '<button type="button" class="fbq-share" data-share="' + r.id + '">📤 공유</button>' : '') +
            '<button type="button" class="fbq-done" data-done="' + r.id + '">✓ 해소</button></div>';
          list.appendChild(el);
        });
        // ---- 검수 대기 (대응 완료된 신고 — 재신고 / 검수완료) ----
        if (reviews.length) {
          var sec = document.createElement('div');
          sec.className = 'fbq-sec';
          sec.textContent = '🔍 검수 대기 ' + reviews.length + '건 — 확인 후 재신고 / 검수완료';
          list.appendChild(sec);
          reviews.forEach(function (r) {
            var el = document.createElement('div');
            el.className = 'fbq-item';
            var when = new Date(r.created_at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
            var here = r.deck_path === location.pathname;
            var loc = (r.page_title || r.deck_path) + (r.slide_no ? ' · ' + r.slide_no : '');
            el.innerHTML =
              '<div class="fbq-meta"><span class="fbq-ty fbq-ty-fixed">🛠 대응됨 #' + r.id + '</span><span>' + when + ' 신고</span></div>' +
              '<div class="fbq-content">' + esc(r.content) + '</div>' +
              (r.fix_note ? '<div class="fbq-fix">↳ 대응: ' + esc(r.fix_note) + '</div>' : '') +
              '<div class="fbq-row">' +
              (here
                ? (r.slide_no ? '<button type="button" class="fbq-go" data-go="' + r.slide_no + '">슬라이드 ' + r.slide_no + '로</button>' : '')
                : '<a class="fbq-go" target="_blank" rel="noopener" href="' + esc(r.deck_path + (r.slide_no ? '#slide=' + r.slide_no : '')) + '">' + esc(loc) + ' ↗</a>') +
              '<button type="button" class="fbq-re" data-re="' + r.id + '">🔁 재신고</button>' +
              '<button type="button" class="fbq-ok" data-ok="' + r.id + '">✅ 검수완료</button></div>';
            list.appendChild(el);
          });
        }
        // ---- 공유 중 제출물 (가장 뒤 — 신규 제출이 위에 오도록) ----
        if (shared.length) {
          var sec2 = document.createElement('div');
          sec2.className = 'fbq-sec fbq-sec--shared';
          sec2.innerHTML = '<span>📤 공유 중 ' + shared.length + '건 — 수강생에게 보임</span><span class="sp"></span>' +
            '<button type="button" class="fbq-alloff">모두 내리기</button>';
          list.appendChild(sec2);
          shared.forEach(function (r) {
            var el = document.createElement('div');
            el.className = 'fbq-item';
            var when = new Date(r.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
            el.innerHTML =
              '<div class="fbq-meta"><span class="fbq-ty fbq-ty-submission">📤 공유중</span>' +
              '<span>' + esc(r.email) + '</span><span>' + when + '</span></div>' +
              '<div class="fbq-content">' + esc(r.content) + '</div>' +
              '<div class="fbq-row"><button type="button" class="fbq-unshare" data-unshare="' + r.id + '">내리기</button></div>';
            list.appendChild(el);
          });
        }
      }

      qp.addEventListener('click', function (e) {
        var g = e.target.closest('[data-go]');
        if (g) { location.hash = '#slide=' + g.getAttribute('data-go'); return; }
        var d = e.target.closest('[data-done]');
        if (d) { resolve(parseInt(d.getAttribute('data-done'), 10)); return; }
        var ok = e.target.closest('[data-ok]');
        if (ok) { reviewDone(parseInt(ok.getAttribute('data-ok'), 10)); return; }
        var re = e.target.closest('[data-re]');
        if (re) { reReport(parseInt(re.getAttribute('data-re'), 10)); return; }
        var sh = e.target.closest('[data-share]');
        if (sh) { patchShare('id=eq.' + parseInt(sh.getAttribute('data-share'), 10), { shared: true, status: 'resolved', resolved_at: new Date().toISOString() }); return; }
        var un = e.target.closest('[data-unshare]');
        if (un) { patchShare('id=eq.' + parseInt(un.getAttribute('data-unshare'), 10), { shared: false }); return; }
        if (e.target.closest('.fbq-alloff')) {
          if (window.confirm('공유 중인 제출물 ' + shared.length + '건을 모두 내릴까요?'))
            patchShare('type=eq.submission&shared=eq.true', { shared: false });
        }
      });

      /* ---- 제출물 공유: shared 켜면 수강생에게 보이고, 내리면 사라짐 ---- */
      function patchShare(qs, body) {
        var tk = getCookieToken();
        if (!tk) return;
        fetch(cfg.SUPABASE_URL + '/rest/v1/feedback?' + qs, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            apikey: cfg.SUPABASE_ANON_KEY,
            Authorization: 'Bearer ' + tk,
            Prefer: 'return=minimal'
          },
          body: JSON.stringify(body)
        }).then(function (res) {
          if (!res.ok) { alert('처리 실패 (HTTP ' + res.status + ') — supabase/submission-share-update.sql 실행 여부를 확인하세요.'); return; }
          poll();
        });
      }

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
          if (!allCount() && open) setTimeout(function () { setOpen(false); }, 600);
          tab.hidden = open || allCount() === 0;
        });
      }

      /* ---- 검수 파이프라인: fixed → 검수완료(resolved) 또는 재신고(open) ---- */
      function patchReview(id, body) {
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
          body: JSON.stringify(body)
        }).then(function (res) {
          if (!res.ok) { alert('처리 실패 (HTTP ' + res.status + ') — supabase/feedback-review-update.sql 실행 여부를 확인하세요.'); return; }
          reviews = reviews.filter(function (r) { return r.id !== id; });
          render();
          if (!allCount() && open) setTimeout(function () { setOpen(false); }, 600);
          tab.hidden = open || allCount() === 0;
        });
      }
      function reviewDone(id) {
        patchReview(id, { status: 'resolved', resolved_at: new Date().toISOString() });
      }
      function reReport(id) {
        var reason = window.prompt('재신고 사유 (선택 — 빈칸 가능, 취소하면 중단)');
        if (reason === null) return;
        patchReview(id, { status: 'open', review_note: reason || null });
      }

      function poll() {
        if (document.visibilityState === 'hidden') return;
        var tk = getCookieToken();
        if (!tk) return;
        var H = { apikey: cfg.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + tk };
        var q1 = fetch(cfg.SUPABASE_URL + '/rest/v1/feedback?status=eq.open&type=in.(question,submission)&select=id,email,type,deck_path,slide_no,page_title,content,created_at&order=created_at.desc&limit=30', { headers: H })
          .then(function (res) { return res.ok ? res.json() : null; });
        // 검수 대기(fixed) — 마이그레이션 전엔 fix_note 컬럼이 없어 실패 → 조용히 빈 목록
        var q2 = fetch(cfg.SUPABASE_URL + '/rest/v1/feedback?status=eq.fixed&select=id,deck_path,slide_no,page_title,content,fix_note,created_at&order=created_at.asc&limit=50', { headers: H })
          .then(function (res) { return res.ok ? res.json() : null; }).catch(function () { return null; });
        // 공유 중 제출물 — 마이그레이션 전엔 shared 컬럼이 없어 실패 → 공유 UI 숨김
        var q3 = fetch(cfg.SUPABASE_URL + '/rest/v1/feedback?type=eq.submission&shared=eq.true&select=id,email,content,deck_path,page_title,created_at&order=created_at.desc&limit=50', { headers: H })
          .then(function (res) { return res.ok ? res.json() : null; }).catch(function () { return null; });
        Promise.all([q1, q2, q3]).then(function (rs) {
          var rows = rs[0];
          reviews = rs[1] || [];
          sharedOk = rs[2] !== null;
          shared = rs[2] || [];
          if (rows) {
            var hasNew = false;
            rows.forEach(function (r) {
              r._new = !seen[r.id] && !firstLoad;
              if (r._new) hasNew = true;
              seen[r.id] = true;
            });
            items = rows;
            firstLoad = false;
            if (hasNew) {
              if (!open) setOpen(true);
              tab.classList.remove('pulse'); void tab.offsetWidth; tab.classList.add('pulse');
            }
          }
          tab.hidden = open || allCount() === 0;
          tab.querySelector('.n').textContent = total();
          if (open) render();
        }).catch(function () { /* 네트워크 오류 — 다음 폴링에서 재시도 */ });
      }

      poll();
      setInterval(poll, POLL_MS);
    })();

    /* ================= 수강생 · 공유된 작품 =================
       관리자가 공유(shared)로 켠 제출물을 우측 탭으로 보여준다.
       30초 폴링 — 공유된 작품이 없으면 탭 자체가 보이지 않는다. */
    (function () {
      var tk0 = getCookieToken();
      var p0 = tk0 && jwtPayload(tk0);
      if (!p0 || !p0.sub) return;
      if (p0.email && p0.email.toLowerCase() === cfg.ADMIN_EMAIL.toLowerCase()) return; // 관리자는 자체 패널에서 봄

      var POLL_MS = 30000;
      var works = [];
      var open = false;
      var lastCount = 0;

      var tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'fbq-tab';
      tab.setAttribute('data-no-nav', '');
      tab.innerHTML = '작품 <span class="n">0</span>';
      tab.hidden = true;
      document.body.appendChild(tab);

      var wp = document.createElement('div');
      wp.className = 'fbq-panel';
      wp.setAttribute('data-no-nav', '');
      wp.hidden = true;
      wp.innerHTML =
        '<div class="fbq-head">📤 공유된 작품<span class="sp"></span>' +
        '<button type="button" class="fbq-close">접기</button></div>' +
        '<div class="fbq-list"></div>';
      document.body.appendChild(wp);
      ['keydown', 'keyup', 'keypress'].forEach(function (ev) {
        wp.addEventListener(ev, function (e) { e.stopPropagation(); });
      });

      var esc = function (s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;'); };

      function setOpen(v) {
        open = v;
        wp.hidden = !v;
        tab.hidden = v || works.length === 0;
      }
      tab.addEventListener('click', function () { setOpen(true); render(); });
      wp.querySelector('.fbq-close').addEventListener('click', function () { setOpen(false); });

      function render() {
        var list = wp.querySelector('.fbq-list');
        tab.querySelector('.n').textContent = works.length;
        list.innerHTML = '';
        if (!works.length) {
          list.innerHTML = '<div class="fbq-empty">아직 공유된 작품이 없습니다.</div>';
          return;
        }
        works.forEach(function (r) {
          var el = document.createElement('div');
          el.className = 'fbq-item';
          var when = new Date(r.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
          var m = /^링크:\s*(\S+)\s*\n?([\s\S]*)$/.exec(r.content || '');
          var url = m && /^https?:\/\//.test(m[1]) ? m[1] : null;
          var intro = m ? m[2].trim() : (r.content || '');
          el.innerHTML =
            '<div class="fbq-meta"><span class="fbq-ty fbq-ty-submission">📤 작품</span><span>' + when + '</span></div>' +
            (url ? '<a class="fbq-worklink" href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(url) + ' ↗</a>' : '') +
            (intro ? '<div class="fbq-content">' + esc(intro) + '</div>' : '');
          list.appendChild(el);
        });
      }

      function poll() {
        if (document.visibilityState === 'hidden') return;
        var tk = getCookieToken();
        if (!tk) return;
        fetch(cfg.SUPABASE_URL + '/rest/v1/feedback?type=eq.submission&shared=eq.true&select=id,content,created_at&order=created_at.desc&limit=50', {
          headers: { apikey: cfg.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + tk }
        }).then(function (res) { return res.ok ? res.json() : null; })
          .then(function (rows) {
            if (!rows) return; // 마이그레이션 전이거나 권한 없음 — 표시하지 않음
            works = rows;
            if (works.length > lastCount && !open && lastCount > 0) {
              tab.classList.remove('pulse'); void tab.offsetWidth; tab.classList.add('pulse');
            }
            lastCount = works.length;
            tab.hidden = open || works.length === 0;
            tab.querySelector('.n').textContent = works.length;
            if (open) render();
            if (open && !works.length) setTimeout(function () { setOpen(false); }, 600); // 모두 내리기 반영
          }).catch(function () { /* 다음 폴링에서 재시도 */ });
      }

      poll();
      setInterval(poll, POLL_MS);
    })();
  }).catch(function () { /* 설정 파일 없음 — 위젯 미표시 */ });
})();
