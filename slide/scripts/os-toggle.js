/* os-toggle.js
   슬라이드 전역 OS 토글 — Windows ↔ macOS.
   - localStorage('claude-slide-os')로 모든 슬라이드·탭 동기화
   - html[data-os]·body.OS-* 클래스로 .os-win/.os-mac 표시 제어
   - 슬라이드 헤더(.deck-chrome) 우측에 segmented chip 주입
   - chrome 없는 페이지(index)는 조용히 스킵 */

(function () {
  var STORAGE_KEY = 'claude-slide-os';
  var DEFAULT_OS = 'win';
  var VALID = { win: 1, mac: 1 };

  function getOS() {
    try {
      var v = localStorage.getItem(STORAGE_KEY);
      return VALID[v] ? v : DEFAULT_OS;
    } catch (e) { return DEFAULT_OS; }
  }

  function applyOS(os) {
    var prev = document.documentElement.getAttribute('data-os');
    document.documentElement.setAttribute('data-os', os);
    if (document.body) {
      if (prev) document.body.classList.remove('OS-' + prev);
      document.body.classList.add('OS-' + os);
    }
    // chip 상태 갱신
    var btns = document.querySelectorAll('.deck-chrome__os-btn');
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      var pressed = b.getAttribute('data-os') === os;
      b.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    }
  }

  function setOS(os) {
    if (!VALID[os]) return;
    try { localStorage.setItem(STORAGE_KEY, os); } catch (e) {}
    applyOS(os);
  }

  // 1) 즉시 html[data-os] 박기 (CSS가 first paint부터 정확)
  applyOS(getOS());

  // 2) chrome 주입
  function injectChip() {
    var chrome = document.querySelector('.deck-chrome');
    if (!chrome || chrome.querySelector('.deck-chrome__os')) return;
    var spacer = chrome.querySelector('.deck-chrome__spacer');

    var wrap = document.createElement('div');
    wrap.className = 'deck-chrome__os';
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', '명령어 표시 OS');

    var winBtn = document.createElement('button');
    winBtn.type = 'button';
    winBtn.className = 'deck-chrome__os-btn';
    winBtn.setAttribute('data-os', 'win');
    winBtn.setAttribute('title', 'Windows 명령어 표시');
    winBtn.textContent = 'Win';

    var macBtn = document.createElement('button');
    macBtn.type = 'button';
    macBtn.className = 'deck-chrome__os-btn';
    macBtn.setAttribute('data-os', 'mac');
    macBtn.setAttribute('title', 'macOS 명령어 표시');
    macBtn.textContent = 'Mac';

    wrap.appendChild(winBtn);
    wrap.appendChild(macBtn);

    function onClick(e) {
      e.preventDefault();
      e.stopPropagation();   // 슬라이드 클릭 네비로 전파되지 않게
      var os = this.getAttribute('data-os');
      setOS(os);
    }
    winBtn.addEventListener('click', onClick);
    macBtn.addEventListener('click', onClick);
    // 버블링까지 차단 (deck.js 키/클릭 핸들러 보호)
    wrap.addEventListener('click', function (e) { e.stopPropagation(); });

    // spacer 직후, nav 직전에 삽입
    if (spacer && spacer.parentNode === chrome) {
      chrome.insertBefore(wrap, spacer.nextSibling);
    } else {
      chrome.appendChild(wrap);
    }
    applyOS(getOS());
  }

  // 3) DOM 준비되면 chip 주입
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectChip);
  } else {
    injectChip();
  }

  // 4) 다른 탭에서 토글하면 이 탭도 동기화
  window.addEventListener('storage', function (e) {
    if (e.key === STORAGE_KEY && VALID[e.newValue]) applyOS(e.newValue);
  });

  // 5) 외부 디버그용 API
  window.slideOS = {
    get: getOS,
    set: setOS,
    toggle: function () { setOS(getOS() === 'win' ? 'mac' : 'win'); }
  };
})();
