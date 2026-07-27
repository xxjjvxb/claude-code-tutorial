/* slide-modify.js
   - 항상: .photo-slot__img 가 실제 로드되면 슬롯에 .has-img (사진 표시 / placeholder 숨김)
   - 업로드 활성 조건 (둘 중 하나):
       (a) modify-mode ( ?mode=modify 또는 #modify ) — 모든 photo-slot[data-img] 슬롯 활성
       (b) 관리자 로그인 시 우하단 '🖼 편집' 토글로 켜고 끔 (기본 OFF — 강의 중 비활성)
     이미지 매칭 실패 슬롯의 자동 활성도 편집모드가 켜져 있을 때만 동작.
     연결한 이미지 폴더 핸들은 IndexedDB에 저장해 다음부터 다시 묻지 않음.
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
})();
