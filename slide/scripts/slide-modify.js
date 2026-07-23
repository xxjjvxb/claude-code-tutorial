/* slide-modify.js
   - 항상: .photo-slot__img 가 실제 로드되면 슬롯에 .has-img (사진 표시 / placeholder 숨김)
   - 업로드 활성 조건 (둘 중 하나):
       (a) modify-mode ( ?mode=modify 또는 #modify ) — 모든 photo-slot[data-img] 슬롯 활성
       (b) 이미지 매칭 실패 — 해당 슬롯만 자동 활성 (강사 캡처 작업 편의)
     활성 슬롯:
       · 드래그&드롭으로 교체
       · 클릭으로 활성화 → Ctrl+V 로 클립보드 이미지 붙여넣기
       · 연결한 이미지 폴더(slide/imgs)에 data-img 파일명으로 저장하고 즉시 표시
     File System Access API(크로미움) 사용. 미지원/거부 시 → 미리보기 + 같은 파일명으로 다운로드 폴백. */

(function () {
  // ---- 0) 공통 상태 ----
  var isModify = /[?&]mode=modify\b/.test(location.search) || /modify/.test(location.hash);
  var dirHandle = null;
  var supportsFS = typeof window.showDirectoryPicker === 'function';
  var activeSlot = null;
  var bar = null;
  var connectBtn = null;

  // ---- 1) 이미지 로드 상태 표시 (정상 모드 포함) + 매칭 실패 시 슬롯 자동 활성 ----
  function markLoaded(img) { var s = img.closest('.photo-slot'); if (s) s.classList.add('has-img'); }
  function markMissing(img) {
    var s = img.closest('.photo-slot');
    if (!s) return;
    s.classList.remove('has-img');
    // 매칭 실패한 슬롯은 그 슬롯만 업로드 가능하게 활성화 (modify-mode 아니어도)
    if (s.hasAttribute('data-img')) registerSlot(s);
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

  // ---- 2) modify-mode면 toolbar + 모든 슬롯 등록 ----
  if (isModify) {
    document.body.classList.add('modify-mode');
    ensureToolbar();
    Array.prototype.forEach.call(document.querySelectorAll('.photo-slot[data-img]'), registerSlot);
  }

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

  function connectDir() {
    if (!supportsFS) return Promise.resolve(null);
    return window.showDirectoryPicker({ id: 'slide-imgs', mode: 'readwrite' }).then(function (h) {
      dirHandle = h;
      bar.classList.add('is-connected');
      connectBtn.textContent = '폴더 연결됨 ✓';
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
      (dirHandle ? Promise.resolve(dirHandle) : connectDir()).then(function (h) {
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
      e.preventDefault(); e.stopPropagation();
      var img = slot.querySelector('.photo-slot__img');
      if (img) { img.removeAttribute('src'); }
      slot.classList.remove('has-img');
      setActive(slot);
      toast(slot, '제거됨 — 곧장 Ctrl+V 로 새 이미지');
    });
    slot.appendChild(delBtn);

    ['dragenter', 'dragover'].forEach(function (ev) {
      slot.addEventListener(ev, function (e) { e.preventDefault(); e.stopPropagation(); slot.classList.add('is-drop'); });
    });
    ['dragleave', 'dragend', 'drop'].forEach(function (ev) {
      slot.addEventListener(ev, function () { slot.classList.remove('is-drop'); });
    });
    slot.addEventListener('drop', function (e) {
      e.preventDefault(); e.stopPropagation();
      var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!file) return;
      setActive(slot);
      handleFile(slot, file);
    });
  }

  // ---- 7) Ctrl+V 페이스트 핸들러 (활성 슬롯 대상) ----
  document.addEventListener('paste', function (e) {
    if (!activeSlot) return;
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
})();
