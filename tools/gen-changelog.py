# -*- coding: utf-8 -*-
"""git 커밋 이력 → slide/changelog.json (첫 페이지 '강의노트 업데이트' 카드 데이터)
사용: 저장소 루트에서  python tools/gen-changelog.py  — 배포(커밋) 전에 실행해 갱신."""
import json, pathlib, re, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
out = subprocess.run(
    ['git', 'log', 'HEAD', '--date=short', '--format=%ad\t%s'],
    cwd=ROOT, capture_output=True, text=True, encoding='utf-8',
)
entries = []
for line in out.stdout.splitlines():
    if '\t' not in line:
        continue
    d, s = line.split('\t', 1)
    s = s.strip()
    if not s or s.lower().startswith('merge'):
        continue
    s = re.sub(r'^(feat|fix|docs|refactor|chore|style|test|perf)(\([^)]*\))?:\s*', '', s)
    entries.append({'d': d, 'm': s})

dest = ROOT / 'slide' / 'changelog.json'
dest.write_text(json.dumps(entries, ensure_ascii=False, indent=0), encoding='utf-8')
print(f'{dest} — {len(entries)} entries')
