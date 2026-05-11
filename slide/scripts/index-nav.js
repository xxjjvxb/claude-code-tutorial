/* Index page nav — ESC to parent, optional up button in chrome */

(function () {
  const chrome = document.querySelector('.deck-chrome');
  const spacer = document.querySelector('.deck-chrome__spacer');
  const isRoot = document.body.dataset.indexRoot === 'true';

  // ESC → 상위 인덱스 (root이면 무시)
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Escape' && !isRoot) {
      e.preventDefault();
      window.location.href = '../index.html';
    }
  });

  // 헤더에 ↑ 버튼 주입 (root 제외)
  if (chrome && spacer && !isRoot) {
    const nav = document.createElement('span');
    nav.className = 'deck-chrome__nav';

    const btnUp = document.createElement('button');
    btnUp.type = 'button';
    btnUp.className = 'deck-chrome__btn deck-chrome__btn--up';
    btnUp.title = '전체 강의 인덱스 (ESC)';
    btnUp.setAttribute('aria-label', '전체 강의 인덱스로 이동');
    btnUp.textContent = '↑';
    btnUp.addEventListener('click', () => { window.location.href = '../index.html'; });

    nav.appendChild(btnUp);
    spacer.parentNode.insertBefore(nav, spacer.nextSibling);
  }
})();
