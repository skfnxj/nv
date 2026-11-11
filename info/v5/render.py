# 인포 이미지 렌더: info-v5.html → info-full-1.webp, info-full-2.webp (+ 검토용 전체 png)
# 실행: C:\Crack\tts\Scripts\python render.py
import json, os, sys
from playwright.sync_api import sync_playwright
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, sys.argv[1] if len(sys.argv) > 1 else "info-v5.html")
OUT = os.path.join(HERE, sys.argv[2] if len(sys.argv) > 2 else ".")
os.makedirs(OUT, exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome")
    pg = b.new_page(viewport={"width": 900, "height": 1200}, device_scale_factor=1)
    pg.goto("file:///" + SRC.replace("\\", "/"))
    pg.wait_for_selector('meta[name="render-info"]', state="attached", timeout=60000)
    pg.wait_for_timeout(1500)
    info = json.loads(pg.get_attribute('meta[name="render-info"]', "content"))
    H = info["height"]
    # WebP 한 장 한도(16383px) 안에서, 섹션 경계로 최대한 길게 나눈다
    bounds = sorted(set(info["parts"][1:] + [H])); cuts = [0]
    while cuts[-1] < H:
        nxt = [y for y in bounds if cuts[-1] < y <= cuts[-1] + 16000]
        cuts.append(max(nxt) if nxt else min(cuts[-1] + 16000, H))
    for f in os.listdir(OUT):
        if f.startswith("info-full-") and f.endswith(".webp"): os.remove(os.path.join(OUT, f))
    for i, (a, z) in enumerate(zip(cuts, cuts[1:]), 1):
        png = os.path.join(OUT, f"_part{i}.png")
        pg.screenshot(path=png, full_page=True, clip={"x": 0, "y": a, "width": 900, "height": z - a})
        Image.open(png).convert("RGB").save(os.path.join(OUT, f"info-full-{i}.webp"), "WEBP", quality=90)
    b.close()
print("height", H, "cuts", cuts)
