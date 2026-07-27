/* slide-modify.js
   - 항상: .photo-slot__img 가 실제 로드되면 슬롯에 .has-img (사진 표시 / placeholder 숨김)
   - 업로드 활성 조건 (둘 중 하나):
       (a) modify-mode ( ?mode=modify 또는 #modify ) — 모든 photo-slot[data-img] 슬롯 활성
       (b) 관리자 로그인 시 우하단 '🖼 편집' 토글로 켜고 끔 (기본 OFF — 강의 중 비활성)
     이미지 매칭 실패 슬롯의 자동 활성도 편집모드가 켜져 있을 때만 동작.
     연결한 이미지 폴더 핸들은 IndexedDB에 저장해 다음부터 다시 묻지 않음.
     편집모드 ON이면 좌측에 슬라이드 인덱스 네비게이터 표시 — 클릭으로 바로 이동 (검토용).
     네비게이터: 항목별 '✓ 검수완료' 체크로 목록에서 숨김(새로고침에도 유지) +
     하단 입력창에서 현재 슬라이드로 바로 신고 전송 (Enter — 신고사항 빠르게 수집).
     활성 슬롯:
       · 드래그&드롭으로 교체
       · 클릭으로 활성화 → Ctrl+V 로 클립보드 이미지 붙여넣기
       · 연결한 이미지 폴더(slide/imgs)에 data-img 파일명으로 저장하고 즉시 표시
     File System Access API(크로미움) 사용. 미지원/거부 시 → 미리보기 + 같은 파일명으로 다운로드 폴백. */

(function () {
  // ---- 0) 공통 상태 ----
  var isModify = /[?&]mode=modify\b/.test(location.search) || /modify/.test(location.hash);
  var editEnabled = false;   // 런타임 편집모드 (URL 플래그 또는 관리자 토글로 켜짐)
  var dirHandle = null;
  var supportsFS = typeof window.showDirectoryPicker === 'function';
  var activeSlot = null;
  var bar = null;
  var connectBtn = null;
  var toggleBtn = null;      // 관리자 우하단 '🖼 편집' 토글
  var navPanel = null;       // 좌측 슬라이드 네비게이터 (편집모드 ON 시)
  var navItems = [];
  var navRows = [];
  var navList = null;
  var authCfg = null;        // /auth-config.js 로드 결과 — 네비게이터 빠른 신고 전송에 사용

  // ---- 1) 이미지 로드 상태 표시 (정상 모드 포함) + 매칭 실패 시 슬롯 자동 활성 ----
  function markLoaded(img) { var s = img.closest('.photo-slot'); if (s) s.classList.add('has-img'); }
  function markMissing(img) {
    var s = img.closest('.photo-slot');
    if (!s) return;
    s.classList.remove('has-img');
    // 매칭 실패한 슬롯은 그 슬롯만 업로드 가능하게 활성화 — 단, 편집모드가 켜져 있을 때만
    // (강의 중 이미지가 깨져도 수강생 화면에 UPLOAD 바가 뜨지 않게)
    if (editEnabled && s.hasAttribute('data-img')) registerSlot(s);
  }
  Array.prototype.forEach.call(document.querySelectorAll('.photo-slot__img'), function (img) {
    // 저장 후 즉시 표시할 경로의 디렉터리를 원본 src에서 기억
    // (덱 위치에 따라 ../imgs/ 또는 ../../imgs/ — 하드코딩하면 vibe-coding 덱에서 깨짐)
    var slot = img.closest('.photo-slot');
    var src = img.getAttribute('src') || '';
    if (slot && src.indexOf('/') >= 0) slot.dataset.imgBase = src.slice(0, src.lastIndexOf('/') + 1);
    if (img.complete && img.naturalWidth > 0) { markLoaded(img); return; }
    img.addEventListener('load', function () { if (img.naturalWidth > 0) markLoaded(img); });
    img.addEventListener('error', function () { markMissing(img); });
    // src가 비어 있거나 즉시 실패한 경우(complete && naturalWidth===0) — 이미 broken
    if (img.complete && img.naturalWidth === 0) markMissing(img);
  });

  // ---- 2) 편집모드 켜기/끄기 ----
  function setEditMode(on) {
    editEnabled = on;
    document.body.classList.toggle('modify-mode', on);
    if (on) {
      ensureToolbar();
      bar.style.display = '';
      Array.prototype.forEach.call(document.querySelectorAll('.photo-slot[data-img]'), registerSlot);
      restoreDir(true); // 저장된 폴더 핸들 복원 (토글 클릭 제스처 안이면 권한 재요청까지)
    } else {
      if (bar) bar.style.display = 'none';
      setActive(null);
    }
    showNav(on);
    if (toggleBtn) {
      toggleBtn.classList.toggle('is-on', on);
      toggleBtn.textContent = on ? '🖼 편집 ON' : '🖼 편집 OFF';
    }
  }

  if (isModify) setEditMode(true);

  // ---- 3) 툴바 (modify-mode 또는 매칭 실패 슬롯이 생기는 시점에 자동 생성) ----
  function ensureToolbar() {
    if (bar) return;
    bar = document.createElement('div');
    bar.className = 'modify-bar';
    bar.innerHTML =
      '<span class="modify-bar__tag">UPLOAD</span>' +
      '<button type="button" class="modify-bar__btn" data-connect></button>' +
      '<span class="modify-bar__hint">드래그&드롭 또는 — 빈칸 클릭 후 <strong>Ctrl+V</strong></span>';
    document.body.appendChild(bar);
    connectBtn = bar.querySelector('[data-connect]');
    connectBtn.textContent = supportsFS ? '이미지 폴더 연결' : '폴더 저장 미지원 — 다운로드 폴백';
    if (!supportsFS) connectBtn.disabled = true;
    connectBtn.addEventListener('click', function () { connectDir(); });
  }

  function setConnectedUI() {
    if (!bar) return;
    bar.classList.add('is-connected');
    connectBtn.textContent = '폴더 연결됨 ✓';
  }

  function connectDir() {
    if (!supportsFS) return Promise.resolve(null);
    return window.showDirectoryPicker({ id: 'slide-imgs', mode: 'readwrite' }).then(function (h) {
      dirHandle = h;
      setConnectedUI();
      saveHandle(h); // 다음 방문부터 다시 묻지 않게 저장
      return h;
    }).catch(function () { return null; });
  }

  // ---- 3-1) 폴더 핸들 영속화 (IndexedDB) — 매번 폴더 선택창 띄우지 않기 ----
  function idbOpen() {
    return new Promise(function (res, rej) {
      var rq = indexedDB.open('slide-modify', 1);
      rq.onupgradeneeded = function () { rq.result.createObjectStore('fs'); };
      rq.onsuccess = function () { res(rq.result); };
      rq.onerror = function () { rej(rq.error); };
    });
  }
  function saveHandle(h) {
    idbOpen().then(function (db) {
      db.transaction('fs', 'readwrite').objectStore('fs').put(h, 'dir');
    }).catch(function () { /* 저장 실패 — 다음에 다시 선택 */ });
  }
  function loadHandle() {
    return idbOpen().then(function (db) {
      return new Promise(function (res) {
        var rq = db.transaction('fs').objectStore('fs').get('dir');
        rq.onsuccess = function () { res(rq.result || null); };
        rq.onerror = function () { res(null); };
      });
    }).catch(function () { return null; });
  }
  /* 저장된 핸들 복원. interactive=true면(사용자 클릭 안) 권한 재요청 프롬프트까지 시도 —
     크롬에서 "방문할 때마다 허용"을 고르면 이후 완전 무프롬프트. */
  function restoreDir(interactive) {
    if (dirHandle) return Promise.resolve(dirHandle);
    if (!supportsFS) return Promise.resolve(null);
    return loadHandle().then(function (h) {
      if (!h) return null;
      return h.queryPermission({ mode: 'readwrite' }).then(function (st) {
        if (st === 'granted') return h;
        if (st === 'prompt' && interactive) {
          return h.requestPermission({ mode: 'readwrite' }).then(function (st2) {
            return st2 === 'granted' ? h : null;
          });
        }
        return null;
      });
    }).then(function (h) {
      if (h) { dirHandle = h; setConnectedUI(); }
      return h;
    }).catch(function () { return null; });
  }

  function saveToDir(file, name) {
    return dirHandle.getFileHandle(name, { create: true })
      .then(function (fh) { return fh.createWritable(); })
      .then(function (w) { return Promise.resolve(w.write(file)).then(function () { return w.close(); }); });
  }

  function showInSlot(slot, url) {
    var img = slot.querySelector('.photo-slot__img');
    if (img) { img.src = url; slot.classList.add('has-img'); }
  }

  function downloadAs(file, name) {
    var url = URL.createObjectURL(file);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  function toast(slot, msg) {
    var t = document.createElement('div');
    t.className = 'photo-slot__toast';
    t.textContent = msg;
    slot.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2000);
  }

  // ---- 4) 파일 처리 (드롭·페이스트 공통) ----
  function handleFile(slot, file) {
    var name = slot.getAttribute('data-img');
    if (supportsFS) {
      (dirHandle ? Promise.resolve(dirHandle) : restoreDir(true).then(function (h) { return h || connectDir(); })).then(function (h) {
        if (!h) { showInSlot(slot, URL.createObjectURL(file)); downloadAs(file, name); toast(slot, '폴더 미연결 — 다운로드됨'); return; }
        saveToDir(file, name).then(function () {
          showInSlot(slot, (slot.dataset.imgBase || '../imgs/') + name + '?t=' + Date.now());
          toast(slot, '저장됨 ✓ ' + name);
        }).catch(function () {
          showInSlot(slot, URL.createObjectURL(file)); downloadAs(file, name); toast(slot, '저장 실패 — 다운로드됨');
        });
      });
    } else {
      showInSlot(slot, URL.createObjectURL(file));
      downloadAs(file, name);
      toast(slot, '다운로드됨 — imgs 폴더에 넣어주세요');
    }
  }

  // ---- 5) 활성 슬롯 토글 ----
  function setActive(slot) {
    if (activeSlot && activeSlot !== slot) activeSlot.classList.remove('is-active');
    activeSlot = slot;
    if (slot) slot.classList.add('is-active');
  }

  // 다른 데 클릭하면 활성 해제 (슬롯·툴바 외)
  document.addEventListener('click', function (e) {
    if (e.target.closest('.photo-slot[data-img]')) return;
    if (e.target.closest('.modify-bar')) return;
    if (activeSlot) { activeSlot.classList.remove('is-active'); activeSlot = null; }
  }, true);

  // ---- 6) 슬롯 등록 (멱등: 두 번 호출돼도 안전) ----
  function registerSlot(slot) {
    if (slot.dataset.uploadReady === '1') return;
    slot.dataset.uploadReady = '1';
    document.body.classList.add('modify-mode');   // CSS 훅 — 슬롯에 hover/active 효과가 보이게
    ensureToolbar();

    slot.setAttribute('data-no-nav', '');  // 슬라이드 넘김 방지
    slot.addEventListener('click', function (e) {
      if (!editEnabled) return;
      e.preventDefault(); e.stopPropagation();
      setActive(slot);
    });

    // 삭제 버튼 (hover·active 시 우상단 표시)
    var delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'photo-slot__delete';
    delBtn.title = '이미지 제거 (새로 붙여넣기 모드로)';
    delBtn.setAttribute('aria-label', '이미지 제거');
    delBtn.textContent = '✕';
    delBtn.addEventListener('click', function (e) {
      if (!editEnabled) return;
      e.preventDefault(); e.stopPropagation();
      var img = slot.querySelector('.photo-slot__img');
      if (img) { img.removeAttribute('src'); }
      slot.classList.remove('has-img');
      setActive(slot);
      toast(slot, '제거됨 — 곧장 Ctrl+V 로 새 이미지');
    });
    slot.appendChild(delBtn);

    ['dragenter', 'dragover'].forEach(function (ev) {
      slot.addEventListener(ev, function (e) { if (!editEnabled) return; e.preventDefault(); e.stopPropagation(); slot.classList.add('is-drop'); });
    });
    ['dragleave', 'dragend', 'drop'].forEach(function (ev) {
      slot.addEventListener(ev, function () { slot.classList.remove('is-drop'); });
    });
    slot.addEventListener('drop', function (e) {
      if (!editEnabled) return;
      e.preventDefault(); e.stopPropagation();
      var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!file) return;
      setActive(slot);
      handleFile(slot, file);
    });
  }

  // ---- 7) Ctrl+V 페이스트 핸들러 (활성 슬롯 대상) ----
  document.addEventListener('paste', function (e) {
    if (!editEnabled || !activeSlot) return;
    var items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (var i = 0; i < items.length; i++) {
      if (items[i].type && items[i].type.indexOf('image/') === 0) {
        e.preventDefault();
        var file = items[i].getAsFile();
        if (file) {
          // 클립보드 이미지는 보통 image/png · 이름 없음 — 슬롯의 data-img 사용
          // (확장자 mismatch 가능: data-img가 .png인데 클립보드가 .jpeg면 file 자체는 그대로 저장, 표시는 OK)
          handleFile(activeSlot, file);
        }
        return;
      }
    }
    // 이미지가 아닌 페이스트는 토스트로 안내
    toast(activeSlot, '이미지가 아님 — 캡처 후 다시 시도');
  });

  // ---- 8) 관리자 독 (우하단) — 이미지 편집모드 토글 + 관리 페이지 링크 ----
  // 열람 게이트의 sb-access-token 쿠키 JWT 이메일이 ADMIN_EMAIL과 일치할 때만 표시.
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

  import('/auth-config.js').then(function (cfg) {
    authCfg = cfg;   // 관리자 여부와 무관하게 보관 — 네비게이터 빠른 신고가 사용
    if (!cfg.GATE_ENABLED || !cfg.ADMIN_EMAIL) return;
    var tk = getCookieToken();
    var p = tk && jwtPayload(tk);
    if (!p || !p.email || p.email.toLowerCase() !== cfg.ADMIN_EMAIL.toLowerCase()) return;

    var st = document.createElement('style');
    st.textContent = [
      '.adm-dock{position:fixed;right:0.6rem;bottom:0.2rem;z-index:899;display:flex;gap:0.3rem;font-family:"Pretendard","Malgun Gothic",system-ui,sans-serif}',
      '.adm-dock a,.adm-dock button{appearance:none;cursor:pointer;display:inline-flex;align-items:center;gap:0.25rem;border:1.5px solid rgba(38,34,32,0.25);background:rgba(255,255,255,0.85);color:#797067;font-size:0.62rem;font-weight:700;padding:0.18rem 0.5rem;border-radius:999px;text-decoration:none;opacity:0.45;transition:opacity .15s}',
      '.adm-dock a:hover,.adm-dock button:hover{opacity:1}',
      '.adm-dock button.is-on{opacity:1;border-color:#fe6e00;background:#fff7ed;color:#cc5a14}',
      '@media print{.adm-dock{display:none}}'
    ].join('\n');
    document.head.appendChild(st);

    var dock = document.createElement('div');
    dock.className = 'adm-dock';
    dock.setAttribute('data-no-nav', '');

    toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.title = '이미지 편집모드 켜기/끄기 — 강의 중엔 OFF';
    toggleBtn.textContent = editEnabled ? '🖼 편집 ON' : '🖼 편집 OFF';
    if (editEnabled) toggleBtn.classList.add('is-on');
    toggleBtn.addEventListener('click', function () { setEditMode(!editEnabled); });

    var link = document.createElement('a');
    link.href = '/admin.html';
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = '⚙ 관리';
    link.title = '관리 페이지 (새 탭)';

    dock.appendChild(toggleBtn);
    dock.appendChild(link);
    document.body.appendChild(dock);
  }).catch(function () { /* auth-config 없음 — 관리자 독 미표시 */ });

  // ---- 9) 슬라이드 네비게이터 (편집모드 ON 시 좌측) — 인덱스 훑어보며 클릭으로 바로 이동 ----
  //          + 항목별 '✓ 검수완료' 숨김 (sessionStorage, 새로고침 유지) + 현재 슬라이드 빠른 신고
  function slideText(el) { return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; }

  var reviewedKey = 'slide-nav-reviewed:' + location.pathname;
  function loadReviewed() {
    try { return JSON.parse(sessionStorage.getItem(reviewedKey)) || {}; } catch (e) { return {}; }
  }
  function saveReviewed(m) {
    try { sessionStorage.setItem(reviewedKey, JSON.stringify(m)); } catch (e) { /* 저장 불가 — 이 페이지에서만 유지 */ }
  }

  function ensureNav() {
    if (navPanel) return navPanel;
    var slides = document.querySelectorAll('.slide');
    if (!slides.length) return null;   // 덱이 아닌 페이지면 미생성

    var st = document.createElement('style');
    st.textContent = [
      '.slide-nav{position:fixed;left:0.5rem;top:50%;transform:translateY(-50%);z-index:898;width:11.5rem;max-height:84vh;display:flex;flex-direction:column;overflow:hidden;background:rgba(255,255,255,0.94);border:1.5px solid rgba(38,34,32,0.18);border-radius:0.55rem;padding:0.32rem;box-shadow:0 8px 28px rgba(38,34,32,0.14);font-family:"Pretendard","Malgun Gothic",system-ui,sans-serif}',
      '.slide-nav__list{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:0.08rem}',
      '.slide-nav__row{display:flex;align-items:stretch}',
      '.slide-nav__row.is-reviewed{display:none}',
      '.slide-nav__item{appearance:none;border:0;background:none;cursor:pointer;display:flex;align-items:baseline;gap:0.32rem;flex:1;min-width:0;text-align:left;padding:0.22rem 0.36rem;border-radius:0.38rem;color:#57504a}',
      '.slide-nav__item:hover{background:rgba(254,110,0,0.08)}',
      '.slide-nav__item.is-current{background:#fff7ed;color:#cc5a14}',
      '.slide-nav__num{flex:none;font-size:0.5rem;font-weight:800;color:#b3a89e;font-variant-numeric:tabular-nums}',
      '.slide-nav__item.is-current .slide-nav__num{color:#fe6e00}',
      '.slide-nav__txt{display:flex;flex-direction:column;min-width:0}',
      '.slide-nav__eyebrow{font-size:0.42rem;font-weight:700;letter-spacing:0.04em;color:#b3a89e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.slide-nav__title{font-size:0.52rem;font-weight:600;line-height:1.3;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}',
      '.slide-nav__item.is-current .slide-nav__title{font-weight:800}',
      '.slide-nav__check{flex:none;appearance:none;border:0;background:none;cursor:pointer;font-size:0.5rem;font-weight:800;color:#d8cfc4;padding:0 0.32rem;border-radius:0.3rem;opacity:0;transition:opacity .12s}',
      '.slide-nav__row:hover .slide-nav__check{opacity:1}',
      '.slide-nav__check:hover{background:#f0fdf4;color:#166534}',
      '.slide-nav__foot{flex:none;display:flex;align-items:center;justify-content:space-between;gap:0.3rem;padding:0.22rem 0.36rem 0.1rem;border-top:1px solid #eee7dc;margin-top:0.24rem;font-size:0.46rem;color:#b3a89e}',
      '.slide-nav__foot button{appearance:none;border:0;background:none;cursor:pointer;font-size:0.46rem;font-weight:700;color:#797067;text-decoration:underline}',
      '.slide-nav__report{flex:none;border-top:1px solid #eee7dc;margin-top:0.24rem;padding:0.26rem 0.1rem 0.04rem}',
      '.slide-nav__report textarea{width:100%;resize:none;border:1.5px solid #e5ddd2;border-radius:0.35rem;padding:0.28rem 0.36rem;font:inherit;font-size:0.5rem;line-height:1.4;color:#57504a;background:#fff}',
      '.slide-nav__report textarea:focus{outline:2px solid #fe6e00;border-color:#fe6e00}',
      '.slide-nav__report-st{font-size:0.46rem;padding:0.12rem 0.08rem 0;color:#166534}',
      '.slide-nav__report-st.err{color:#991b1b}',
      '@media print{.slide-nav{display:none}}'
    ].join('\n');
    document.head.appendChild(st);

    navPanel = document.createElement('nav');
    navPanel.className = 'slide-nav';
    navPanel.setAttribute('data-no-nav', '');
    navPanel.setAttribute('aria-label', '슬라이드 인덱스');

    navList = document.createElement('div');
    navList.className = 'slide-nav__list';
    navPanel.appendChild(navList);

    var reviewed = loadReviewed();

    Array.prototype.forEach.call(slides, function (s, i) {
      var no = i + 1;
      var eyebrow = slideText(s.querySelector('.slide__eyebrow'));
      var title = slideText(s.querySelector('.slide__title, .feature-head__title, .cover-card__title, h1, h2')) || eyebrow || '슬라이드 ' + no;

      var row = document.createElement('div');
      row.className = 'slide-nav__row' + (reviewed[no] ? ' is-reviewed' : '');

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'slide-nav__item';
      btn.title = title;

      var num = document.createElement('span');
      num.className = 'slide-nav__num';
      num.textContent = (no < 10 ? '0' : '') + no;

      var txt = document.createElement('span');
      txt.className = 'slide-nav__txt';
      if (eyebrow && eyebrow !== title) {
        var ey = document.createElement('span');
        ey.className = 'slide-nav__eyebrow';
        ey.textContent = eyebrow;
        txt.appendChild(ey);
      }
      var ti = document.createElement('span');
      ti.className = 'slide-nav__title';
      ti.textContent = title;
      txt.appendChild(ti);

      btn.appendChild(num);
      btn.appendChild(txt);
      btn.addEventListener('click', function () {
        location.hash = '#slide=' + no;   // deck.js의 hashchange 라우팅으로 이동
        btn.blur();                       // 이후 스페이스(다음 슬라이드)가 버튼을 재클릭하지 않게
      });

      // ✓ 검수완료 — 행 hover 시 표시, 클릭하면 목록에서 숨김
      var chk = document.createElement('button');
      chk.type = 'button';
      chk.className = 'slide-nav__check';
      chk.title = '검수완료 — 목록에서 숨김';
      chk.setAttribute('aria-label', '슬라이드 ' + no + ' 검수완료');
      chk.textContent = '✓';
      chk.addEventListener('click', function () {
        reviewed[no] = true;
        saveReviewed(reviewed);
        row.classList.add('is-reviewed');
        updateFoot();
        chk.blur();
      });

      row.appendChild(btn);
      row.appendChild(chk);
      navItems.push(btn);
      navRows.push(row);
      navList.appendChild(row);
    });

    // 하단 1: 검수완료 카운트 + 초기화
    var foot = document.createElement('div');
    foot.className = 'slide-nav__foot';
    var footTxt = document.createElement('span');
    var footReset = document.createElement('button');
    footReset.type = 'button';
    footReset.textContent = '초기화';
    footReset.title = '검수완료 숨김 전부 되살리기';
    footReset.addEventListener('click', function () {
      reviewed = {};
      saveReviewed(reviewed);
      navRows.forEach(function (r) { r.classList.remove('is-reviewed'); });
      updateFoot();
    });
    foot.appendChild(footTxt);
    foot.appendChild(footReset);
    navPanel.appendChild(foot);

    function updateFoot() {
      var n = Object.keys(reviewed).length;
      foot.style.display = n ? '' : 'none';
      footTxt.textContent = '검수완료 ' + n + '/' + slides.length + ' 숨김';
    }
    updateFoot();

    // 하단 2: 현재 슬라이드 빠른 신고 — Enter 전송, Shift+Enter 줄바꿈
    var rep = document.createElement('div');
    rep.className = 'slide-nav__report';
    var ta = document.createElement('textarea');
    ta.rows = 2;
    ta.placeholder = '🚨 현재 슬라이드 신고 — Enter 전송';
    var repSt = document.createElement('div');
    repSt.className = 'slide-nav__report-st';
    repSt.style.display = 'none';
    rep.appendChild(ta);
    rep.appendChild(repSt);
    navPanel.appendChild(rep);

    var stTimer = null;
    function setSt(msg, isErr) {
      repSt.textContent = msg;
      repSt.classList.toggle('err', !!isErr);
      repSt.style.display = '';
      if (stTimer) clearTimeout(stTimer);
      stTimer = setTimeout(function () { repSt.style.display = 'none'; }, isErr ? 5000 : 2500);
    }

    // 입력 중 스페이스·화살표가 deck.js 슬라이드 넘김으로 새지 않게
    ['keydown', 'keyup', 'keypress'].forEach(function (ev) {
      ta.addEventListener(ev, function (e) { e.stopPropagation(); });
    });
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendQuickReport(); }
    });

    function currentSlideNo() {
      var n = null;
      Array.prototype.forEach.call(document.querySelectorAll('.slide'), function (s, i) {
        if (s.classList.contains('active')) n = i + 1;
      });
      return n;
    }

    function sendQuickReport() {
      var text = ta.value.trim();
      if (!text) return;
      var tk = getCookieToken();
      var p = tk && jwtPayload(tk);
      if (!authCfg || !authCfg.SUPABASE_URL || !p || !p.sub) {
        setSt('로그인·설정 없음 — 우측 🚨 신고 위젯을 이용하세요', true);
        return;
      }
      var no = currentSlideNo();
      ta.disabled = true;
      fetch(authCfg.SUPABASE_URL + '/rest/v1/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: authCfg.SUPABASE_ANON_KEY,
          Authorization: 'Bearer ' + tk,
          Prefer: 'return=minimal'
        },
        body: JSON.stringify({
          user_id: p.sub,
          email: p.email || '',
          type: 'report',
          deck_path: location.pathname,
          slide_no: no,
          page_title: document.title,
          content: text
        })
      }).then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        ta.disabled = false;
        ta.value = '';
        ta.focus();
        setSt('✓ 슬라이드 ' + no + ' 신고 접수');
      }).catch(function (e2) {
        ta.disabled = false;
        setSt('전송 실패 (' + e2.message + ') — 새로고침 후 재시도', true);
      });
    }

    document.body.appendChild(navPanel);

    // 현재 슬라이드 하이라이트 — deck.js가 토글하는 .active 를 관찰
    var mo = new MutationObserver(updateNavCurrent);
    Array.prototype.forEach.call(slides, function (s) {
      mo.observe(s, { attributes: true, attributeFilter: ['class'] });
    });
    updateNavCurrent();
    return navPanel;
  }

  function updateNavCurrent() {
    if (!navPanel) return;
    Array.prototype.forEach.call(document.querySelectorAll('.slide'), function (s, i) {
      if (!navItems[i]) return;
      var cur = s.classList.contains('active');
      navItems[i].classList.toggle('is-current', cur);
      if (cur && navPanel.style.display !== 'none') navItems[i].scrollIntoView({ block: 'nearest' });
    });
  }

  function showNav(on) {
    if (on) {
      if (ensureNav()) { navPanel.style.display = ''; updateNavCurrent(); }
    } else if (navPanel) {
      navPanel.style.display = 'none';
    }
  }
})();
