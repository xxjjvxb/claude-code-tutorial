/* prompt-copy.js — .prompt-card 의 "복사" 버튼.
   [data-copy] 클릭 시 형제 .prompt-card__body 텍스트를 클립보드에 복사하고
   버튼을 "복사됨"으로 1.5초간 토글. 이벤트 위임이라 동적 추가에도 동작. */

(function () {
  var RESET_MS = 1500;

  function feedback(btn) {
    if (!btn.dataset.origLabel) btn.dataset.origLabel = btn.textContent.trim();
    btn.textContent = '복사됨';
    btn.classList.add('is-copied');
    clearTimeout(btn._copyTimer);
    btn._copyTimer = setTimeout(function () {
      btn.textContent = btn.dataset.origLabel;
      btn.classList.remove('is-copied');
    }, RESET_MS);
  }

  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-copy]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();

    var card = btn.closest('.prompt-card');
    var body = card && card.querySelector('.prompt-card__body');
    if (!body) return;

    // innerText는 줄바꿈을 보존. 비분리공백( )은 일반 공백으로, 끝 공백은 제거.
    var text = body.innerText.replace(/ /g, ' ').replace(/[ \t]+$/gm, '').replace(/\s+$/, '');

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { feedback(btn); },
        function () { legacyCopy(text); feedback(btn); }
      );
    } else {
      legacyCopy(text);
      feedback(btn);
    }
  }, false);
})();
