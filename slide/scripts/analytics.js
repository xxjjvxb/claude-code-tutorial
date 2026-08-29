/* analytics.js — Google Analytics 4 (gtag)
   auth-config.js의 GA_MEASUREMENT_ID가 비어 있으면 아무것도 하지 않는다.
   슬라이드 이동(#slide=N 해시 변경)도 page_view로 집계. */
(function () {
  'use strict';
  // 전역 세션 상태 바 — 모든 페이지가 analytics.js를 로드하므로 여기서 함께 주입
  var sbar = document.createElement('script');
  sbar.defer = true;
  sbar.src = '/slide/scripts/session-bar.js';
  document.head.appendChild(sbar);

  import('/auth-config.js').then(function (cfg) {
    var id = cfg.GA_MEASUREMENT_ID;
    if (!id) return;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', id, { page_path: location.pathname + location.hash });
    window.addEventListener('hashchange', function () {
      gtag('event', 'page_view', {
        page_path: location.pathname + location.hash,
        page_title: document.title
      });
    });
  }).catch(function () { /* 설정 없음 — 비활성 */ });
})();
