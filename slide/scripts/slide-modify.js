/* slide-modify.js
   - 항상: .photo-slot__img 가 실제 로드되면 슬롯에 .has-img (사진 표시 / placeholder 숨김)
   - modify-mode( ?mode=modify 또는 #modify ): 사진 빈칸을 드롭존으로.
     이미지를 드롭하면 연결한 이미지 폴더(slide/imgs)에 data-img 파일명으로 저장하고 즉시 표시.
     File System Access API(크로미움) 사용. 미지원/거부 시 → 미리보기 + 같은 파일명으로 다운로드 폴백. */

(function () {
  // ---- 1) 이미지 로드 상태 표시 (정상 모드 포함) ----
  function markLoaded(img) { var s = img.closest('.photo-slot'); if (s) s.classList.add('has-img'); }
  function markMissing(img) { var s = img.closest('.photo-slot'); if (s) s.classList.remove('has-img'); }
  Array.prototype.forEach.call(document.querySelectorAll('.photo-slot__img'), function (img) {
    if (img.complete && img.naturalWidth > 0) markLoaded(img);
    img.addEventListener('load', function () { if (img.naturalWidth > 0) markLoaded(img); });
    img.addEventListener('error', function () { markMissing(img); });
  });

  // ---- 2) modify-mode 여부 ----
  var isModify = /[?&]mode=modify\b/.test(location.search) || /modify/.test(location.hash);
  if (!isModify) return;
  document.body.classList.add('modify-mode');

  var dirHandle = null;
  var supportsFS = typeof window.showDirectoryPicker === 'function';

  // ---- 3) 상단 툴바 ----
  var bar = document.createElement('div');
  bar.className = 'modify-bar';
  bar.innerHTML =
    '<span class="modify-bar__tag">MODIFY</span>' +
    '<button type="button" class="modify-bar__btn" data-connect></button>' +
    '<span class="modify-bar__hint">사진 빈칸에 이미지를 드래그&드롭</span>';
  document.body.appendChild(bar);
  var connectBtn = bar.querySelector('[data-connect]');
  connectBtn.textContent = supportsFS ? '이미지 폴더 연결' : '폴더 저장 미지원 — 다운로드 폴백';
  if (!supportsFS) connectBtn.disabled = true;
  connectBtn.addEventListener('click', function () { connectDir(); });

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

  // ---- 4) 드롭존 ----
  Array.prototype.forEach.call(document.querySelectorAll('.photo-slot[data-img]'), function (slot) {
    slot.setAttribute('data-no-nav', '');  // 슬라이드 넘김 방지
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
      var name = slot.getAttribute('data-img');

      if (supportsFS) {
        (dirHandle ? Promise.resolve(dirHandle) : connectDir()).then(function (h) {
          if (!h) { showInSlot(slot, URL.createObjectURL(file)); downloadAs(file, name); toast(slot, '폴더 미연결 — 다운로드됨'); return; }
          saveToDir(file, name).then(function () {
            showInSlot(slot, '../imgs/' + name + '?t=' + Date.now());
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
    });
  });
})();
