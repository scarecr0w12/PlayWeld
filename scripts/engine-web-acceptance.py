#!/usr/bin/env python3
"""Accept a built Unity WebGL fixture in Chromium, with actual browser input."""
import argparse
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument("--url", default="http://127.0.0.1:3187")
parser.add_argument("--output", default=".artifacts/extended-engine-acceptance")
args = parser.parse_args()
output = Path(args.output).resolve()
output.mkdir(parents=True, exist_ok=True)
messages, errors, reports = [], [], []
phase = {"value": "starting"}
samples = []

def console(message):
    messages.append(message.text)
    marker = "GAMECRAFTER_ACCEPTANCE "
    if marker in message.text:
        reports.append(json.loads(message.text.split(marker, 1)[1]))
    if "GAMECRAFTER_AUDIO " in message.text:
        phase["value"] = message.text.split("GAMECRAFTER_AUDIO ", 1)[1].strip()

record = {"schemaVersion": 1, "scope": "Unity WebGL in headless Chromium", "passed": False}
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path="/usr/bin/google-chrome", headless=True,
            args=["--no-sandbox", "--enable-unsafe-swiftshader"],
        )
        try:
            record["browser"] = browser.version
            page = browser.new_page(viewport={"width": 1100, "height": 800})
            page.on("console", console)
            page.on("pageerror", lambda error: errors.append(str(error)))
            # Observe Unity's actual Web Audio output without changing audible gain.
            page.add_init_script("""
                globalThis.acceptanceAnalysers = [];
                const connect = AudioNode.prototype.connect;
                AudioNode.prototype.connect = function(destination, ...args) {
                    const result = connect.call(this, destination, ...args);
                    if (destination instanceof AudioDestinationNode) {
                        const analyser = this.context.createAnalyser(); analyser.fftSize = 2048;
                        const silence = this.context.createGain(); silence.gain.value = 0;
                        connect.call(this, analyser); connect.call(analyser, silence); connect.call(silence, destination);
                        globalThis.acceptanceAnalysers.push(analyser);
                    }
                    return result;
                };
            """)
            page.goto(args.url, wait_until="networkidle", timeout=120000)
            page.screenshot(path=str(output / "web-before-input.png"))
            page.wait_for_function("document.querySelector('#unity-loading-container').style.display === 'none'", timeout=120000)
            canvas = page.locator("#unity-canvas")
            canvas.click()
            page.keyboard.press("Space")
            for _ in range(300):
                if reports:
                    break
                peak = page.evaluate("""() => {
                    let peak=0;
                    for(const analyser of globalThis.acceptanceAnalysers) {
                        const values=new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(values);
                        for(const value of values) peak=Math.max(peak,Math.abs(value));
                    }
                    return peak;
                }""")
                samples.append({"phase": phase["value"], "peak": peak})
                page.wait_for_timeout(100)
            page.screenshot(path=str(output / "web-player.png"))
            playing = [x["peak"] for x in samples if x["phase"] == "playing"]
            paused = [x["peak"] for x in samples if x["phase"] == "paused"]
            resumed = [x["peak"] for x in samples if x["phase"] == "resumed"]
            record.update({"reports": reports, "pageErrors": errors, "audioSamples": samples})
            assert reports, "WebGL player did not produce its assertion report"
            assert reports[-1]["passed"], "WebGL renderer/audio assertions failed"
            assert reports[-1]["physicalInputEvents"] > 0, "Browser Space event did not reach Unity"
            assert playing and max(playing) > 0.01, "Unity produced no browser audio samples"
            assert sum(value < 0.001 for value in paused) >= 2, "Paused audio did not become silent"
            assert resumed and max(resumed) > 0.01, "Browser audio did not resume"
            assert not errors, "Browser reported JavaScript errors"
            record["passed"] = True
        finally:
            browser.close()
except Exception as error:
    record["error"] = str(error)
    raise
finally:
    (output / "web-console.log").write_text("\n".join(messages), encoding="utf-8")
    (output / "web-player.json").write_text(json.dumps(record, indent=2), encoding="utf-8")
