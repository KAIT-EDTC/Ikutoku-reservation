#!/usr/bin/env python3
"""音声案内を Gemini の音声合成で作り、app/src/main/res/raw/ に WAV で置く。

使い方（android/ で）:
  GEMINI_API_KEY は ~/.zshrc などで設定しておく（このスクリプトはキーを表示しない）
  python3 tools/voice/generate.py              # lines.tsv の全部
  python3 tools/voice/generate.py v_date       # 1つだけ作り直す
  VOICE=Kore MODEL=gemini-2.5-flash-preview-tts python3 tools/voice/generate.py
  python3 tools/voice/generate.py --try Erinome,Autonoe v_date   # 声の聞き比べ（res/raw には置かず tools/voice/try/ に出す）

  GEMINI_API_KEY の代わりに GEMINI_API_KEY_FILE（キーだけを書いたファイル）でもよい
"""
import base64
import json
import os
import sys
import time
import urllib.error
import urllib.request
import array
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
RATE = 24000


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


def tidy(pcm: bytes) -> bytes:
    """前後の無音を 0.05 秒まで詰め、最大音量を -1dB にそろえる（声ごとの音量差をなくす）"""
    a = array.array("h", pcm)
    if sys.byteorder == "big":
        a.byteswap()
    level = 500
    loud = [i for i, v in enumerate(a) if abs(v) > level]
    if not loud:
        return pcm
    pad = int(RATE * 0.05)
    a = a[max(0, loud[0] - pad): min(len(a), loud[-1] + pad)]
    peak = max(abs(v) for v in a) or 1
    g = 32767 * 0.89 / peak
    a = array.array("h", (max(-32768, min(32767, int(v * g))) for v in a))
    if sys.byteorder == "big":
        a.byteswap()
    return a.tobytes()


def write(path: Path, pcm: bytes):
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(pcm)


def call(key: str, name: str, text: str) -> bytes:
    for attempt in range(3):
        try:
            return tidy(synthesize(key, text))
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors="replace")[:300]
            if e.code == 429 and "PerDay" not in msg and attempt < 2:
                time.sleep(20)
                continue
            sys.exit(f"{name}: HTTP {e.code} {msg}")
    raise RuntimeError


def main():
    global VOICE
    key = os.environ.get("GEMINI_API_KEY")
    if not key and os.environ.get("GEMINI_API_KEY_FILE"):
        key = Path(os.environ["GEMINI_API_KEY_FILE"]).read_text().strip()
    if not key:
        sys.exit("GEMINI_API_KEY が設定されていません")
    args = sys.argv[1:]
    voices = None
    if args[:1] == ["--try"]:
        voices, args = args[1].split(","), args[2:]
    only = set(args)
    for name, text in lines():
        if only and name not in only:
            continue
        for v in voices or [VOICE]:
            VOICE = v
            pcm = call(key, name, text)
            path = HERE / "try" / f"{name}_{v}.wav" if voices else OUT / f"{name}.wav"
            write(path, pcm)
            print(f"{path.name}  {len(pcm) / (RATE * 2):.1f}秒  {text}")
            time.sleep(1)


if __name__ == "__main__":
    main()
