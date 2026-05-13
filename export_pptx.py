"""Day 1 오전 슬라이드(1-am-theory.html) → PPTX 변환.
- Chromium headless로 4:3 viewport 캡처 (1920x1440)
- 각 #slide=N 마다 PNG
- python-pptx로 4:3 PPTX에 풀-블리드 삽입
"""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright
from pptx import Presentation
from pptx.util import Inches

ROOT = Path(__file__).resolve().parent
HTML_PATH = ROOT / 'slide' / 'day-1' / '1-am-theory.html'
DIST = ROOT / 'dist'
PNG_DIR = DIST / 'day1-am-png'
PPTX_PATH = DIST / 'day1-am.pptx'

VIEW_W, VIEW_H = 1920, 1440
N_SLIDES = 23


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
        page = await context.new_page()
        base_url = HTML_PATH.as_uri()
        for i in range(1, N_SLIDES + 1):
            await page.goto(f'{base_url}#slide={i}')
            await page.wait_for_load_state('networkidle')
            await page.wait_for_timeout(400)
            out = PNG_DIR / f'slide-{i:02d}.png'
            await page.screenshot(path=str(out), full_page=False)
            images.append(out)
            print(f'  [{i:02d}/{N_SLIDES}] captured')
        await browser.close()
    return images


def build_pptx(images):
    prs = Presentation()
    prs.slide_width = Inches(10)      # 4:3
    prs.slide_height = Inches(7.5)
    blank = prs.slide_layouts[6]
    for img in images:
        slide = prs.slides.add_slide(blank)
        slide.shapes.add_picture(str(img), 0, 0, width=prs.slide_width, height=prs.slide_height)
    prs.save(PPTX_PATH)
    print(f'\nsaved: {PPTX_PATH}')


if __name__ == '__main__':
    print(f'capturing {N_SLIDES} slides from {HTML_PATH.name}')
    imgs = asyncio.run(capture())
    print('\nbuilding pptx...')
    build_pptx(imgs)
