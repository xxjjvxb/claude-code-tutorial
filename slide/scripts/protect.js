/* 저작권 보호 (가벼운 억제) — © 2026 이일규
   본 강의자료는 저작권법으로 보호되는 저작물입니다. 무단 복제·배포 금지.

   주의: 웹 콘텐츠는 이미 브라우저로 전송되므로 아래는 "잠금"이 아니라 심리적
   억제책입니다. 실제 보호는 화면 낙관 도장(deck.css)과 소스 메타·주석이 담당.
   clipboard(copy) 이벤트는 다루지 않음 — prompt-copy.js 등 의도적 복사 기능 보호. */
(function () {
  var NOTICE = "© 2026 이일규 · 본 강의자료는 저작권법으로 보호되는 저작물입니다. 무단 복제·배포를 금합니다.";

  // 우클릭 무반응 (경고창 없음)
  document.addEventListener("contextmenu", function (e) {
    e.preventDefault();
  });

  // 개발자도구/소스보기 단축키 가벼운 억제 (Ctrl+C 등 일반 복사는 막지 않음)
  document.addEventListener("keydown", function (e) {
    var k = (e.key || "").toLowerCase();
    if (e.key === "F12") { e.preventDefault(); return; }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (k === "i" || k === "j" || k === "c")) {
      e.preventDefault(); return;
    }
    if ((e.ctrlKey || e.metaKey) && k === "u") { e.preventDefault(); return; }
  });

  // 콘솔 저작권 고지 1회
  try {
    console.log("%c" + NOTICE, "color:#b83227;font-size:13px;font-weight:700;");
  } catch (_) {}
})();
