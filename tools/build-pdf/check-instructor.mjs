// 강사 소개 슬라이드(슬라이드 3)만 단독 캡처 — 6번째 항목이 영역에 들어가는지 확인
import { chromium } from 'playwright';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

const url = pathToFileURL(path.join(REPO_ROOT, 'slide/day-1/1-understand.html')).href + '#slide=3';
const outPng = path.join(REPO_ROOT, 'dist', 'check-instructor.png');

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 960 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(url, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts && document.fonts.ready);
await page.waitForTimeout(300);
await page.screenshot({ path: outPng });
await browser.close();
console.log(outPng);
