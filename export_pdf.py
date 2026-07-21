"""전 강의 슬라이드 → 단일 PDF (lecture.pdf).
- deck-chrome / deck-progress 숨김
- 4:3 1920x1440 캡처 → PIL로 PDF 묶음
"""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright
import img2pdf

ROOT = Path(__file__).resolve().parent
DIST = ROOT / 'dist'
PNG_DIR = DIST / 'pdf-png'
PDF_PATH = DIST / 'lecture.pdf'

# 결과물 기준 11챕터 + 부록 (slide/ 기준 상대경로, 출력 순서)
DECKS = [
    'vibe-coding/ch01-setup/1-understand.html',
    'vibe-coding/ch01-setup/2-setup.html',
    'vibe-coding/ch01-setup/3-terminal.html',
    'vibe-coding/ch02-homepage/1-intro-page.html',
    'vibe-coding/ch02-homepage/2-grammar.html',
    'vibe-coding/ch02-homepage/3-ops-mission.html',
    'vibe-coding/ch03-deploy/1-git-basics.html',
    'vibe-coding/ch03-deploy/2-deploy.html',
    'vibe-coding/ch04-taming/1-claude-md.html',
    'vibe-coding/ch04-taming/2-custom-slash.html',
    'vibe-coding/ch05-api/1-open-api.html',
    'vibe-coding/ch06-database/1-database.html',
    'vibe-coding/ch07-interactive/1-google-login.html',
    'vibe-coding/ch07-interactive/2-subagent-memo.html',
    'vibe-coding/ch08-automation/1-hooks-telegram.html',
    'vibe-coding/ch08-automation/2-mcp.html',
    'vibe-coding/ch09-docs-design/1-skills.html',
    'vibe-coding/ch09-docs-design/2-design-prototype.html',
    'vibe-coding/ch10-desktop/1-desktop-program.html',
    'vibe-coding/ch11-mini-project/1-project-theory.html',
    'vibe-coding/ch11-mini-project/2-project-build.html',
    'vibe-coding/ch11-mini-project/3-workflow-faq.html',
    'vibe-coding/ch11-mini-project/4-demo-retro.html',
    'vibe-coding/appendix/1-headless.html',
    'vibe-coding/appendix/2-data-ai.html',
]

VIEW_W, VIEW_H = 1920, 1440

HIDE_CHROME_CSS = '.deck-chrome, .deck-progress { display: none !important; }'


async def capture():
    DIST.mkdir(exist_ok=True)
    PNG_DIR.mkdir(exist_ok=True)
    images = []
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(
            viewport={'width': VIEW_W, 'height': VIEW_H},
            device_scale_factor=1,
        )
        await context.add_init_script(
            f"const s=document.createElement('style');s.textContent=`{HIDE_CHROME_CSS}`;"
            "document.documentElement.appendChild(s);"
        )
        page = await context.new_page()
        seq = 0
        for rel in DECKS:
            html = ROOT / 'slide' / Path(rel)
            if not html.exists():
                print(f'  skip: {rel}')
                continue
            base = html.as_uri()
            await page.goto(base)
            await page.wait_for_load_state('networkidle')
            n = await page.evaluate("document.querySelectorAll('.slide').length")
            for i in range(1, n + 1):
                await page.goto(f'{base}#slide={i}')
                await page.wait_for_load_state('networkidle')
                await page.wait_for_timeout(250)
                seq += 1
                out = PNG_DIR / f'{seq:04d}.png'
                await page.screenshot(path=str(out), full_page=False)
                images.append(out)
                print(f'  {rel} [{i:02d}/{n}]')
        await browser.close()
    return images


def build_pdf(images):
    with open(PDF_PATH, 'wb') as f:
        f.write(img2pdf.convert([str(p) for p in images]))
    print(f'\nsaved: {PDF_PATH}  ({len(images)} pages)')


def build_pdf_from_dir():
    # 파일명이 캡처 순서(0001.png ...)라 알파벳 정렬 = 슬라이드 순서
    images = sorted(PNG_DIR.glob('*.png'))
    build_pdf(images)


if __name__ == '__main__':
    import sys
    if '--pdf-only' in sys.argv:
        print('building pdf from cached PNGs...')
        build_pdf_from_dir()
    else:
        print(f'capturing - viewport {VIEW_W}x{VIEW_H}, chrome hidden')
        imgs = asyncio.run(capture())
        print('\nbuilding pdf...')
        build_pdf(imgs)
