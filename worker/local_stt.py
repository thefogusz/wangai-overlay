"""Persistent CPU ASR sidecar. Private stdin carries PCM; stdout carries JSONL.

No HTTP listener, audio files, credentials, automatic downloads or cloud fallback.
The two streams share one recognizer and execute serially.
"""
import argparse
import json
import os
import struct
import sys
from pathlib import Path

import numpy as np

SAMPLE_RATE = 16000
MAX_SAMPLES = SAMPLE_RATE * 30


def read_exact(source, count):
    parts = bytearray()
    while len(parts) < count:
        data = source.read(count - len(parts))
        if not data:
            raise ValueError("Truncated local STT frame")
        parts.extend(data)
    return bytes(parts)


def read_request(source):
    first = source.read(1)
    if not first:
        return None
    size = struct.unpack("<I", first + read_exact(source, 3))[0]
    if size < 3 or size > 1 + MAX_SAMPLES * 2 or size % 2 != 1:
        raise ValueError("Invalid local STT frame length")
    payload = read_exact(source, size)
    if payload[0] not in (0, 1):
        raise ValueError("Invalid local STT language")
    return ("en" if payload[0] == 0 else "th", np.frombuffer(payload[1:], dtype="<i2"))


class QwenRecognizer:
    def __init__(self, directory, threads):
        import sherpa_onnx

        root = Path(directory)
        required = ["conv_frontend.onnx", "encoder.int8.onnx", "decoder.int8.onnx", "tokenizer/vocab.json", "tokenizer/merges.txt", "tokenizer/tokenizer_config.json"]
        if not all((root / name).is_file() for name in required):
            raise ValueError("Local model is missing. Run scripts/setup-local-stt.ps1 first.")
        self.recognizer = sherpa_onnx.OfflineRecognizer.from_qwen3_asr(
            conv_frontend=str(root / required[0]),
            encoder=str(root / required[1]),
            decoder=str(root / required[2]),
            tokenizer=str(root / "tokenizer"),
            num_threads=threads,
            provider="cpu",
            max_new_tokens=128,
        )

    def transcribe(self, samples, language):
        # Qwen's sherpa interface auto-detects language. Never translate here;
        # the desktop retains the stream's en/th direction for Grok.
        stream = self.recognizer.create_stream()
        stream.accept_waveform(SAMPLE_RATE, samples.astype(np.float32) / 32768.0)
        self.recognizer.decode_stream(stream)
        return stream.result.text.strip()


def serve(recognizer, source, output):
    def emit(event):
        output.write(json.dumps(event, ensure_ascii=True) + "\n")
        output.flush()

    emit({"ready": True, "pid": os.getpid()})
    while True:
        request = read_request(source)
        if request is None:
            return
        language, samples = request
        # VAD boundaries arrive from the separate Silero worker. Also reject
        # near-silence from F9/probes to avoid hallucinations and wasted work.
        rms = np.sqrt(np.mean(np.square(samples.astype(np.float32) / 32768.0)))
        if len(samples) < SAMPLE_RATE // 5 or rms < 0.001:
            emit({"text": ""})
            continue
        try:
            emit({"text": recognizer.transcribe(samples, language)})
        except Exception:
            emit({"error": "Local speech recognition failed"})


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-dir", required=True)
    parser.add_argument("--threads", type=int, choices=range(1, 5), default=2)
    args = parser.parse_args()
    try:
        recognizer = QwenRecognizer(args.model_dir, args.threads)
        serve(recognizer, sys.stdin.buffer, sys.stdout)
        return 0
    except Exception as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=True), flush=True)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
