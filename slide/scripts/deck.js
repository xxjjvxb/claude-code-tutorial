/* Slide deck — keyboard / touch / hash routing
   Lightweight, no dependencies. */

(function () {
  const slides = Array.from(document.querySelectorAll('.slide'));
  const counter = document.querySelector('.deck-chrome__counter');
  const progressBar = document.querySelector('.deck-progress__bar');
  const chrome = document.querySelector('.deck-chrome');
  const total = slides.length;
  let current = 0;

  // ---- Inject header navigation (↑ prev / up / next) ----
  let btnPrev, btnUp, btnNext;
  if (chrome && counter) {
    const nav = document.createElement('span');
    nav.className = 'deck-chrome__nav';

    btnUp = document.createElement('button');
    btnUp.type = 'button';
    btnUp.className = 'deck-chrome__btn deck-chrome__btn--up';
    btnUp.title = '상위 인덱스 (ESC)';
    btnUp.setAttribute('aria-label', '상위 인덱스로 이동');
    btnUp.textContent = '↑';

    btnPrev = document.createElement('button');
    btnPrev.type = 'button';
    btnPrev.className = 'deck-chrome__btn';
    btnPrev.title = '이전 (←)';
    btnPrev.setAttribute('aria-label', '이전 슬라이드');
    btnPrev.textContent = '‹';

    btnNext = document.createElement('button');
    btnNext.type = 'button';
    btnNext.className = 'deck-chrome__btn';
    btnNext.title = '다음 (→)';
    btnNext.setAttribute('aria-label', '다음 슬라이드');
    btnNext.textContent = '›';

    btnUp.addEventListener('click', () => { window.location.href = './index.html'; });
    btnPrev.addEventListener('click', () => show(current - 1));
    btnNext.addEventListener('click', () => show(current + 1));

    nav.appendChild(btnUp);
    nav.appendChild(btnPrev);
    nav.appendChild(btnNext);
    counter.parentNode.insertBefore(nav, counter.nextSibling);
  }

  function getInitialIndex() {
    const m = window.location.hash.match(/slide=(\d+)/);
    if (m) {
      const i = parseInt(m[1], 10) - 1;
      return Math.max(0, Math.min(total - 1, i));
    }
    return 0;
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function show(i) {
    if (i < 0 || i >= total) return;
    current = i;

    slides.forEach((s, idx) => s.classList.toggle('active', idx === i));

    const isCover = slides[i].classList.contains('is-cover');
    document.body.classList.toggle('deck-no-chrome', isCover);

    if (counter) counter.textContent = pad(i + 1) + ' / ' + pad(total);
    if (progressBar) progressBar.style.width = ((i + 1) / total * 100) + '%';
    if (btnPrev) btnPrev.disabled = (i === 0);
    if (btnNext) btnNext.disabled = (i === total - 1);

    history.replaceState(null, '', '#slide=' + (i + 1));
  }

  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
      case 'PageDown':
      case ' ':
        e.preventDefault();
        show(current + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
      case 'PageUp':
        e.preventDefault();
        show(current - 1);
        break;
      case 'Home':
        e.preventDefault();
        show(0);
        break;
      case 'End':
        e.preventDefault();
        show(total - 1);
        break;
      case 'Escape':
        e.preventDefault();
        window.location.href = './index.html';
        break;
    }
  });

  // Touch swipe
  let touchStartX = null;
  document.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (touchStartX === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50) {
      show(dx < 0 ? current + 1 : current - 1);
    }
    touchStartX = null;
  });

  // 화면 클릭 넘김은 제거 — 넘기기는 상단 바 ‹ › 버튼 · 키보드 · 터치 스와이프로.
  // (본문 클릭·드래그가 슬라이드를 넘겨버리는 불편 때문에 삭제)

  // Hash navigation (e.g. browser back/forward)
  window.addEventListener('hashchange', () => {
    show(getInitialIndex());
  });

  show(getInitialIndex());
})();
