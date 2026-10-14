#!/usr/bin/env python3
"""音声案内を Gemini の音声合成で作り、app/src/main/res/raw/ に WAV で置く。

使い方（android/ で）:
  GEMINI_API_KEY は ~/.zshrc などで設定しておく（このスクリプトはキーを表示しない）
  python3 tools/voice/generate.py              # lines.tsv の全部
  python3 tools/voice/generate.py v_date       # 1つだけ作り直す
  VOICE=Kore MODEL=gemini-2.5-flash-preview-tts python3 tools/voice/generate.py
"""
import base64
import json
import os
import sys
import time
import urllib.error
import urllib.request
import wave
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE.parent.parent / "app" / "src" / "main" / "res" / "raw"
MODEL = os.environ.get("MODEL", "gemini-2.5-flash-preview-tts")
VOICE = os.environ.get("VOICE", "Kore")
STYLE = os.environ.get(
    "STYLE",
    "駅の自動券売機の案内音声のように、落ち着いた丁寧な声で、はっきり、少しゆっくり読み上げてください。"
    "「係員」は「かかりいん」、「予約券」は「よやくけん」と読みます。次の文だけを読んでください: ",
)


def lines():
    for raw in (HERE / "lines.tsv").read_text(encoding="utf-8").splitlines():
        if raw.strip() and not raw.startswith("#"):
            name, text = raw.split("\t", 1)
            yield name.strip(), text.strip()


def synthesize(key: str, text: str) -> bytes:
    body = {
        "contents": [{"parts": [{"text": STYLE + text}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": VOICE}}},
        },
    }
    req = urllib.request.Request(
        f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "x-goog-api-key": key},
    )
    with urllib.request.urlopen(req, timeout=120) as res:
        data = json.load(res)
    part = data["candidates"][0]["content"]["parts"][0]["inlineData"]
    return base64.b64decode(part["data"])  # 16bit・24kHz・モノラルの PCM


def main():
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        sys.exit("GEMINI_API_KEY が設定されていません")
    only = set(sys.argv[1:])
    OUT.mkdir(parents=True, exist_ok=True)
    for name, text in lines():
        if only and name not in only:
            continue
        for attempt in range(3):
            try:
                pcm = synthesize(key, text)
                break
            except urllib.error.HTTPError as e:
                msg = e.read().decode(errors="replace")[:300]
                if e.code == 429 and attempt < 2:
                    time.sleep(20)
                    continue
                sys.exit(f"{name}: HTTP {e.code} {msg}")
        with wave.open(str(OUT / f"{name}.wav"), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(24000)
            w.writeframes(pcm)
        print(f"{name}.wav  {len(pcm) / 48000:.1f}秒  {text}")
        time.sleep(1)


if __name__ == "__main__":
    main()
