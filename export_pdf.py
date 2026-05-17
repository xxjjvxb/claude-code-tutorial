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

DAYS = [1, 2, 3, 4, 5]
BLOCKS = ['1-am-theory', '2-am-practice', '3-pm-theory', '4-pm-practice']

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
        for day in DAYS:
            for block in BLOCKS:
                html = ROOT / 'slide' / f'day-{day}' / f'{block}.html'
                if not html.exists():
                    print(f'  skip: {html.relative_to(ROOT)}')
                    continue
                base = html.as_uri()
                await page.goto(base)
                await page.wait_for_load_state('networkidle')
                n = await page.evaluate("document.querySelectorAll('.slide').length")
                for i in range(1, n + 1):
                    await page.goto(f'{base}#slide={i}')
                    await page.wait_for_load_state('networkidle')
                    await page.wait_for_timeout(250)
                    out = PNG_DIR / f'd{day}-{block}-{i:02d}.png'
                    await page.screenshot(path=str(out), full_page=False)
                    images.append(out)
                    print(f'  day{day} {block} [{i:02d}/{n}]')
        await browser.close()
    return images


def build_pdf(images):
    with open(PDF_PATH, 'wb') as f:
        f.write(img2pdf.convert([str(p) for p in images]))
    print(f'\nsaved: {PDF_PATH}  ({len(images)} pages)')


def build_pdf_from_dir():
    images = sorted(PNG_DIR.glob('*.png'))
    day_order = {'1-am-theory': 0, '2-am-practice': 1, '3-pm-theory': 2, '4-pm-practice': 3}

    def key(p):
        stem = p.stem
        d = int(stem[1])
        block = stem[3:-3]
        idx = int(stem[-2:])
        return (d, day_order.get(block, 99), idx)

    images = sorted(images, key=key)
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
