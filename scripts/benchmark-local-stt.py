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


def peak_memory_mb(pid):
    if os.name != "nt":
        return None
    import ctypes
    from ctypes import wintypes
    class Counters(ctypes.Structure):
        _fields_ = [("cb", wintypes.DWORD), ("faults", wintypes.DWORD)] + [
            (name, ctypes.c_size_t) for name in ("peak", "working", "quota_peak_paged", "quota_paged", "quota_peak_nonpaged", "quota_nonpaged", "pagefile", "peak_pagefile")
        ]
    counters = Counters()
    counters.cb = ctypes.sizeof(counters)
    get_memory = ctypes.WinDLL("psapi").GetProcessMemoryInfo
    get_memory.argtypes = [wintypes.HANDLE, ctypes.POINTER(Counters), wintypes.DWORD]
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    kernel.OpenProcess.restype = wintypes.HANDLE
    kernel.CloseHandle.argtypes = [wintypes.HANDLE]
    handle = kernel.OpenProcess(0x1010, False, pid)
    if not handle:
        raise ctypes.WinError(ctypes.get_last_error())
    try:
        if not get_memory(handle, ctypes.byref(counters), counters.cb):
            raise ctypes.WinError()
    finally:
        kernel.CloseHandle(handle)
    return round(counters.peak / (1024 * 1024), 1)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("wav", nargs="+", type=Path)
    parser.add_argument("--model-dir", type=Path)
    parser.add_argument("--worker", type=Path, help="Native worker executable (default: Python Qwen)")
    parser.add_argument("--languages", nargs="+", choices=["en", "th"], help="One language per WAV")
    args = parser.parse_args()
    languages = args.languages or ["en"] * len(args.wav)
    if len(languages) != len(args.wav):
        parser.error("Pass one --languages value per WAV")
    root = Path(__file__).resolve().parents[1]
    model = args.model_dir or root / "output/models/sherpa-onnx-qwen3-asr-0.6B-int8-2026-03-25"
    started = time.perf_counter()
    command = [str(args.worker.resolve())] if args.worker else [sys.executable, "-u", str(root / "worker/local_stt.py")]
    process = subprocess.Popen(
        command + ["--model-dir", str(model)],
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
        if not ready.get("ready"):
            raise RuntimeError(ready)
        pid = ready["pid"]  # Windows venv python.exe may be only a launcher.
        print(json.dumps({"load_seconds": round(time.perf_counter() - started, 3), "pid": pid}), flush=True)
        for path, language in zip(args.wav, languages):
            with wave.open(str(path), "rb") as audio:
                assert (audio.getnchannels(), audio.getsampwidth(), audio.getframerate()) == (1, 2, 16000)
                pcm = audio.readframes(audio.getnframes())
            started = time.perf_counter()
            process.stdin.write(struct.pack("<I", len(pcm) + 1) + bytes([0 if language == "en" else 1]) + pcm)
            process.stdin.flush()
            result = events.get(timeout=30)
            if "error" in result:
                raise RuntimeError(result)
            elapsed = time.perf_counter() - started
            print(json.dumps({"file": path.name, "audio_seconds": len(pcm) / 32000, "asr_seconds": round(elapsed, 3), "peak_working_set_mb": peak_memory_mb(pid), **result}, ensure_ascii=True), flush=True)
    finally:
        process.kill()
        process.wait(timeout=5)
        process.stdin.close()
        process.stdout.close()


if __name__ == "__main__":
    main()
