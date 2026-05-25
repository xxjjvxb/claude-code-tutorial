// Build a single course.pdf by rendering each slide deck HTML through Playwright.
//
// - 4:3 페이지 (13.33in x 10in) — 슬라이드 stage 비율과 일치
// - 각 deck HTML 내 .slide 섹션을 모두 펼쳐서 한 페이지에 하나씩 인쇄
// - .deck-chrome (상단바)와 deck.js 내비게이션은 인쇄에서 숨김
// - index.html(전체/Day 인덱스)은 단일 페이지로 인쇄
// - 챕터별 PDF를 메모리에서 합쳐 dist/course.pdf 로 저장
//
// 실행: cd tools/build-pdf && npm install && node build.mjs

import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(REPO_ROOT, 'dist');

// 출력 순서 — 전체 인덱스 → Day 인덱스 → 챕터 파일
const DECKS = [
  { rel: 'slide/index.html',                   kind: 'index' },

  { rel: 'slide/day-1/index.html',             kind: 'index' },
  { rel: 'slide/day-1/1-understand.html',      kind: 'deck'  },
  { rel: 'slide/day-1/2-setup.html',           kind: 'deck'  },
  { rel: 'slide/day-1/3-terminal.html',        kind: 'deck'  },
  { rel: 'slide/day-1/4-intro-page.html',      kind: 'deck'  },
  { rel: 'slide/day-1/5-git-grammar.html',     kind: 'deck'  },
  { rel: 'slide/day-1/6-ops-mission.html',     kind: 'deck'  },
  { rel: 'slide/day-1/7-deploy.html',          kind: 'deck'  },

  { rel: 'slide/day-2/index.html',             kind: 'index' },
  { rel: 'slide/day-2/1-warmup.html',          kind: 'deck'  },
  { rel: 'slide/day-2/2-hooks-telegram.html',  kind: 'deck'  },
  { rel: 'slide/day-2/3-claude-md.html',       kind: 'deck'  },
  { rel: 'slide/day-2/4-data-ai.html',         kind: 'deck'  },
  { rel: 'slide/day-2/5-prototype-game.html',  kind: 'deck'  },
  { rel: 'slide/day-2/6-google-login.html',    kind: 'deck'  },

  { rel: 'slide/day-3/index.html',             kind: 'index' },
  { rel: 'slide/day-3/1-headless-slash.html',  kind: 'deck'  },
  { rel: 'slide/day-3/2-database-subagent.html', kind: 'deck'  },
  { rel: 'slide/day-3/3-mcp.html',             kind: 'deck'  },
  { rel: 'slide/day-3/4-skills.html',          kind: 'deck'  },

  { rel: 'slide/day-4/index.html',             kind: 'index' },
  { rel: 'slide/day-4/1-windows-program.html', kind: 'deck'  },
];

// 4:3 stage — 1280x960 px @ 96 DPI = 13.333in x 10in
const PAGE_WIDTH_IN  = 1280 / 96;
const PAGE_HEIGHT_IN = 960  / 96;

// 인쇄용 CSS 주입 — 모든 슬라이드 펼치기, chrome 숨김, 페이지 분리
const PRINT_CSS = `
  /* Playwright print viewport */
  html, body { width: auto !important; height: auto !important; overflow: visible !important; background: var(--color-background) !important; }
  body { display: block !important; align-items: initial !important; justify-content: initial !important; }

  /* deck stage — 페이지 단위 stack */
  .deck { width: 1280px !important; height: 960px !important; overflow: visible !important; }
  .deck { display: block !important; }

  /* 모든 슬라이드 펼치고 페이지마다 break */
  .slide {
    position: relative !important;
    inset: auto !important;
    display: flex !important;
    width: 1280px !important;
    height: 960px !important;
    page-break-after: always !important;
    break-after: page !important;
    overflow: hidden !important;
  }
  .slide:last-child { page-break-after: auto !important; break-after: auto !important; }

  /* chrome/progress/navigation 숨김 */
  .deck-chrome, .deck-progress, .deck-chrome__nav { display: none !important; }
  body.deck-no-chrome .deck-chrome { display: none !important; }

  /* index 페이지(.index-stage) — 한 페이지 */
  .index-stage {
    width: 1280px !important;
    height: 960px !important;
    page-break-after: auto !important;
    break-after: auto !important;
  }

  /* 인쇄용 페이지 박스 */
  @page {
    size: ${PAGE_WIDTH_IN}in ${PAGE_HEIGHT_IN}in;
    margin: 0;
  }
`;

// 모든 슬라이드 active 표시 (deck.js가 첫 슬라이드만 활성화하므로 강제)
const REVEAL_ALL_JS = `
  document.querySelectorAll('.slide').forEach(s => s.classList.add('active'));
  document.body.classList.remove('deck-no-chrome');
`;

async function renderDeck(browser, deck) {
  const absPath = path.join(REPO_ROOT, deck.rel);
  const fileUrl = pathToFileURL(absPath).href;

  const context = await browser.newContext({
    viewport: { width: 1280, height: 960 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  await page.goto(fileUrl, { waitUntil: 'networkidle' });

  // Pretendard 폰트 로드 대기 (CDN @import)
  await page.evaluate(() => document.fonts ? document.fonts.ready : null);

  // 인쇄용 스타일 + 슬라이드 모두 펼치기
  await page.addStyleTag({ content: PRINT_CSS });
  await page.evaluate(REVEAL_ALL_JS);

  // 레이아웃 안정화 대기
  await page.waitForTimeout(200);

  const pdfBuffer = await page.pdf({
    printBackground: true,
    preferCSSPageSize: true,
    width:  `${PAGE_WIDTH_IN}in`,
    height: `${PAGE_HEIGHT_IN}in`,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  await context.close();
  return pdfBuffer;
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  console.log(`[1/3] Chromium 시작...`);
  const browser = await chromium.launch();

  const merged = await PDFDocument.create();

  console.log(`[2/3] ${DECKS.length}개 파일 렌더링...`);
  for (let i = 0; i < DECKS.length; i++) {
    const d = DECKS[i];
    process.stdout.write(`  (${i + 1}/${DECKS.length}) ${d.rel} ... `);
    const t0 = Date.now();
    try {
      const pdfBytes = await renderDeck(browser, d);
      const src = await PDFDocument.load(pdfBytes);
      const pages = await merged.copyPages(src, src.getPageIndices());
      pages.forEach(p => merged.addPage(p));
      console.log(`OK (${src.getPageCount()}p, ${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    } catch (err) {
      console.log(`FAIL`);
      console.error(`    ${err.message}`);
      throw err;
    }
  }

  await browser.close();

  const outPath = path.join(OUT_DIR, 'course.pdf');
  const finalBytes = await merged.save();
  await fs.writeFile(outPath, finalBytes);

  console.log(`[3/3] ${outPath}`);
  console.log(`  총 ${merged.getPageCount()} 페이지 · ${(finalBytes.length / 1024 / 1024).toFixed(2)} MB`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
