# WANGAI native Whisper comparison — 2026-10-01

Audio → existing Silero VAD → one persistent local recognizer → text to the
existing Grok gateway → overlay. Grok configuration and credentials are unchanged.

## Launchers

Close the previous WANGAI instance before switching presets; they share preview
settings and hotkeys. Choose game audio, F8 to listen, hold F9 for Thai microphone.

| Launcher | Recognizer | Purpose |
| --- | --- | --- |
| `Start-WANGAI-Whisper.cmd` | Whisper base multilingual Q5_1 | Low-memory experiment; Thai accuracy has not passed |
| `Start-WANGAI-Small.cmd` | Whisper small multilingual Q5_1 | Slower comparison; Thai still imperfect |
| `Start-WANGAI-Local.cmd` | Qwen3-ASR 0.6B INT8 | Previous preset retained because base loses Thai meaning |

Advanced Settings reports the selected model. Each launcher uses the newly built
`output/local-stt-preview/WANGAI-Whisper.exe`. It owns a gateway on localhost port
18080 and stops it on exit. Audio stays local; only text goes to the existing
Grok model. No automatic cloud STT fallback or recording of live audio.

## Measurements

i5-13400F, 16 GB RAM, 2 CPU threads, below-normal worker priority. Eight synthetic
Windows speech clips (four English, four Thai), 3.365–5.305 seconds each.

| Model | Observed ASR peak working set | Time per clip | Finding |
| --- | --- | --- | --- |
| Qwen INT8 | 1,414–1,460 MiB | 1.28–3.09 s | Better Thai on these clips; still errors |
| Whisper base Q5_1 | 168–169 MiB | 1.26–1.50 s | English meaning retained; several Thai meanings wrong |
| Whisper small Q5_1 | 362–363 MiB | 4.84–5.46 s | Thai clearer in places; slow for rapid exchanges |

Base reduced ASR RAM by about 88% in these runs. Numbers are **not total app RAM**;
Silero/Python, WebView2 and desktop remain. This does not establish a whole-app
budget below 500 MB. Native Whisper itself does not use Python. Timings exclude
VAD wait, queue delay, Grok and UI; no game/FPS measurement.
Raw timings and transcripts: [saved comparison](qa/whisper-comparison.json).

Thai reference: `รอฉันก่อน อย่าเข้าไปคนเดียว กระสุนหมดแล้ว`

- Qwen: `รอฉันก่อนอย่าเข้าไปคนเดียวกระสุนหมดแล้ว`
- Base: `เราฉันก่อนอยากเข้าไปคนเดียวกันสุดหมดแล้ว`
- Small: `รอชั้นก่อนอยากเข้าไปคนเดียวกระสูนหมดแล้ว`

The negation error changes the instruction. Base is not a validated Thai
replacement; do not assume Grok will repair it. Real voices, accents, game noise
and slang need testing. No general accuracy percentage is claimed. The original
launcher therefore retains Qwen; native Whisper is opt-in.

## Reproduce

Windows x64 with AVX2, Python 3.11/3.12, Node, pnpm, Rust MSVC and Visual Studio
2022 C++ Build Tools including CMake. Keep the repository, `.venv`, models and
build outputs together. This is a source-tree debug preview, not a portable
installer. Production local-STT release builds remain blocked pending packaging.

```powershell
pnpm install --frozen-lockfile
powershell -ExecutionPolicy Bypass -File scripts/setup-local-stt.ps1 -Preset base
powershell -ExecutionPolicy Bypass -File scripts/setup-whisper.ps1 -Model small
# Keep the existing server/.env. Set TRANSLATION_API_KEY privately for a fresh setup.
powershell -ExecutionPolicy Bypass -File scripts/start-local-stt.ps1 -Preset base -Build
```

Setup builds a static native worker against whisper.cpp v1.9.4, pinned to
`927cfce34f31707e17f2bff35c349632fb9e2c3a`. Models are multilingual (never `.en`),
downloaded from revision `5359861c739e955e79d9a303bcbc70fb988958b1`, checked with
SHA-256 before replacing existing files. Base is 59,707,625 bytes; small is
190,085,487 bytes. No model download occurs during gameplay.

One model is shared by incoming/F9. Each request forces its language and clears
previous text context. CPU-only greedy decoding, 2 threads, max 128 tokens,
no repeated temperature fallback. Bounded queues, 30-second audio cap, 20-second
watchdog, silence gate and crash recovery remain. Local output is text only;
the cloud Whisper confidence filter does not apply. VAD may still accept SFX.

```powershell
$env:PYTHONPATH='worker'
.venv/Scripts/python.exe -m unittest worker/test_worker.py worker/test_integration.py worker/test_local_stt.py worker/test_whisper_worker.py
cargo test --manifest-path src-tauri/Cargo.toml --lib --features local-stt
cargo test --manifest-path src-tauri/Cargo.toml --lib --no-default-features
# Requires PowerShell 7 with David/Zira/Pattara voices installed:
pwsh -File scripts/make-stt-fixtures.ps1
.venv/Scripts/python.exe scripts/benchmark-local-stt.py output/stt-fixtures/1-en.wav output/stt-fixtures/4-th.wav --languages en th --worker output/whisper-build/Release/wangai-whisper.exe --model-dir output/models/ggml-base-q5_1.bin
```

Verification passed: 17 Python tests, 98 local-mode Rust tests and 92 legacy-mode
Rust tests (3 environment-dependent tests ignored per Rust run), plus the Tauri
desktop build and frontend type check/build.

Native tests cover real process framing, language codes, silence, invalid and
truncated input. Rust tests cover persistent sessions, crash recovery and shutdown.
Benchmarks transcribe PCM fixtures. Live game capture and the newly built GUI were
not tested in this comparison. Grok was verified before this change; no new paid
Grok calls were needed.

Sources: [whisper.cpp v1.9.4](https://github.com/ggml-org/whisper.cpp/releases/tag/v1.9.4),
[GGML Whisper models](https://huggingface.co/ggerganov/whisper.cpp).
