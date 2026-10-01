"""Measure local ASR on supplied PCM16/16kHz mono WAVs (never uploads audio)."""
import argparse
import json
import os
from pathlib import Path
import queue
import struct
import subprocess
import sys
import threading
import time
import wave


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("wav", nargs="+", type=Path)
    parser.add_argument("--model-dir", type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    model = args.model_dir or root / "output/models/sherpa-onnx-qwen3-asr-0.6B-int8-2026-03-25"
    started = time.perf_counter()
    process = subprocess.Popen(
        [sys.executable, "-u", str(root / "worker/local_stt.py"), "--model-dir", str(model)],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
        creationflags=(subprocess.CREATE_NO_WINDOW | subprocess.BELOW_NORMAL_PRIORITY_CLASS) if os.name == "nt" else 0,
    )
    events = queue.Queue()
    def read():
        for line in process.stdout:
            events.put(json.loads(line))
        events.put({"error": "Worker exited"})
    threading.Thread(target=read, daemon=True).start()
    try:
        ready = events.get(timeout=60)
        if ready != {"ready": True}:
            raise RuntimeError(ready)
        print(json.dumps({"load_seconds": round(time.perf_counter() - started, 3), "pid": process.pid}), flush=True)
        for path in args.wav:
            with wave.open(str(path), "rb") as audio:
                assert (audio.getnchannels(), audio.getsampwidth(), audio.getframerate()) == (1, 2, 16000)
                pcm = audio.readframes(audio.getnframes())
            started = time.perf_counter()
            process.stdin.write(struct.pack("<I", len(pcm) + 1) + b"\x00" + pcm)
            process.stdin.flush()
            result = events.get(timeout=30)
            if "error" in result:
                raise RuntimeError(result)
            elapsed = time.perf_counter() - started
            print(json.dumps({"file": path.name, "audio_seconds": len(pcm) / 32000, "asr_seconds": round(elapsed, 3), **result}, ensure_ascii=True), flush=True)
    finally:
        process.kill()
        process.wait(timeout=5)
        process.stdin.close()
        process.stdout.close()


if __name__ == "__main__":
    main()
