"""Exercise actual PlayCanvas rendering and normal game UI, plus relay fallback.

Start `npm start` first. Uses the cloud machine's Chromium and Playwright.
Software rendering results are useful for comparison, not hardware guarantees.
"""
import json
import os
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "test-results"
OUT.mkdir(exist_ok=True)
BASE = os.environ.get("SMOKE_URL", "http://127.0.0.1:8001")
report = {"browser": "Chromium / SwiftShader", "viewport": "1280x720", "checks": [], "frames": [], "errors": []}

def check(name, condition, **details):
    report["checks"].append({"name": name, "passed": bool(condition), **details})
    print(name, "PASS" if condition else "FAIL", json.dumps(details, ensure_ascii=False), flush=True)
    assert condition, name

def observe(page):
    page.on("pageerror", lambda error: report["errors"].append(str(error)))
    def console(message):
        if message.text.startswith("FRAME_DIAGNOSTICS "):
            report["frames"].append(json.loads(message.text.split(" ", 1)[1]))
    page.on("console", console)

def ready(page):
    page.goto(BASE + "/?diagnostics", wait_until="domcontentloaded")
    page.wait_for_function("!document.getElementById('menu').classList.contains('hidden') || document.getElementById('loadtext').textContent.startsWith('Yükleme başarısız:')", timeout=90000)
    if not page.is_visible("#menu"):
        raise AssertionError(page.inner_text("#loadtext"))

def diagnostics(page):
    return page.evaluate("window.__SK_DIAGNOSTICS__")

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/usr/bin/chromium", headless=True, args=[
        "--no-sandbox", "--disable-dev-shm-usage", "--use-gl=angle",
        "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
    ])
    try:
        context = browser.new_context(viewport={"width": 1280, "height": 720})
        page = context.new_page()
        observe(page)
        ready(page)
        check("Actual PlayCanvas menu loaded", diagnostics(page)["engine"] == "PlayCanvas")
        page.click("#settingsButton")
        for quality in ["high", "medium", "low", "ultraLow"]:
            page.select_option("#quality", quality)
            page.wait_for_timeout(250)
            check("Graphics preset " + quality, diagnostics(page)["quality"] == quality)
        page.select_option("#fpsLimit", "60")
        page.click("#closeSettings")
        page.screenshot(path=str(OUT / "menu.png"))
        page.click("#solo")
        page.wait_for_selector("#hud:not(.hidden)", timeout=20000)
        page.wait_for_selector("#night-intro.hidden", timeout=20000, state="attached")
        check("Solo personal shopping list", page.inner_text("#progress").strip() == "0 / 6")
        check("Night 01", page.inner_text("#nightNo").strip() == "01")
        before = diagnostics(page)["position"]
        page.keyboard.down("w")
        page.wait_for_timeout(1500)
        page.keyboard.up("w")
        after = diagnostics(page)["position"]
        distance = ((after["x"] - before["x"]) ** 2 + (after["z"] - before["z"]) ** 2) ** .5
        check("Normal keyboard movement", distance > .5, meters=round(distance, 2))
        page.keyboard.down("c")
        page.wait_for_timeout(1300)
        crouch = diagnostics(page)
        check("C lowers camera through basket grid", crouch["crouch"] and crouch["cameraY"] < 1.2, cameraY=crouch["cameraY"])
        page.screenshot(path=str(OUT / "crouch.png"))
        page.keyboard.up("c")
        page.keyboard.press("m")
        check("Map keyboard toggle", "bigmap" in page.get_attribute("#hud", "class"))
        page.keyboard.press("m")
        page.wait_for_timeout(12000)
        report["solo"] = diagnostics(page)
        page.screenshot(path=str(OUT / "solo.png"))
        page.keyboard.press("Escape")
        page.wait_for_selector("#pause:not(.hidden)")
        check("Pause menu opens", page.is_visible("#resume"))
        page.locator("#pause .leave").click()
        page.wait_for_selector("#menu:not(.hidden)")
        page.reload(wait_until="domcontentloaded")
        page.wait_for_selector("#menu:not(.hidden)", timeout=60000)
        check("Graphics preference survives reload", page.input_value("#quality") == "ultraLow")
        context.close()

        # Two isolated browser contexts deliberately cannot use WebRTC. A relay
        # must carry the real game session when RTC is unsupported/blocked.
        host_ctx = browser.new_context(viewport={"width": 960, "height": 640})
        guest_ctx = browser.new_context(viewport={"width": 960, "height": 640})
        for ctx in (host_ctx, guest_ctx):
            ctx.add_init_script("localStorage.setItem('son-koridor-settings-v2', JSON.stringify({quality:'ultraLow',fps:30})); window.RTCPeerConnection = class { constructor() { throw new Error('RTC deliberately unavailable for relay smoke'); } };")
        host, guest = host_ctx.new_page(), guest_ctx.new_page()
        observe(host)
        observe(guest)
        ready(host)
        ready(guest)
        host.fill("#name", "Ev sahibi")
        host.select_option("#capacity", "2")
        host.click("#create")
        host.wait_for_selector("#lobby:not(.hidden)", timeout=20000)
        code = host.inner_text("#copyCode").strip()
        check("Five digit room created", len(code) == 5 and code.isdigit())
        guest.fill("#name", "Misafir")
        guest.fill("#roomcode", code)
        guest.click("#join")
        guest.wait_for_selector("#lobby:not(.hidden)", timeout=20000)
        host.wait_for_function("document.querySelectorAll('#roster .playerrow').length === 2", timeout=10000)
        check("Guest joins via relay with WebRTC blocked", len(diagnostics(guest)["state"]["players"]) == 2)
        host.click("#start")
        for tab in (host, guest):
            tab.wait_for_selector("#hud:not(.hidden)", timeout=20000)
        check("Two player authoritative night starts", diagnostics(host)["state"]["phase"] == "playing" and diagnostics(guest)["state"]["phase"] == "playing")
        report["relay"] = {"host": diagnostics(host)["network"], "guest": diagnostics(guest)["network"]}
        check("Separate personal lists", diagnostics(host)["state"]["items"][0]["ownerId"] != diagnostics(host)["state"]["items"][1]["ownerId"])
        guest.screenshot(path=str(OUT / "relay-guest.png"))
        host_ctx.close()
        guest_ctx.close()
        check("No uncaught browser errors", not report["errors"], errors=report["errors"])
    finally:
        (OUT / "browser-smoke.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
        browser.close()
print("Browser smoke completed.", flush=True)
