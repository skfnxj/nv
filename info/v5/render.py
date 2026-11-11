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
    cut = info.get("cut") or min(info["parts"][1:], key=lambda y: abs(y - H / 2))
    # 크롬 한 장 캡처는 약 16000px까지라서, 나눌 지점별로 따로 찍는다
    for i, (a, z) in enumerate([(0, cut), (cut, H)], 1):
        png = os.path.join(OUT, f"_part{i}.png")
        pg.screenshot(path=png, full_page=True, clip={"x": 0, "y": a, "width": 900, "height": z - a})
        Image.open(png).convert("RGB").save(os.path.join(OUT, f"info-full-{i}.webp"), "WEBP", quality=90)
    b.close()
print("height", H, "cut", cut, "parts", info["parts"])
