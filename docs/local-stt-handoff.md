# Local STT developer handoff

## Scope and review baseline

Compare this branch with upstream `HectorRussia/wangai-overlay` commit
`67d93ac8f084bb7240a048772303cd17b9963544` (the revision used to start this work).
This is not a claim of compatibility with future upstream changes.

```powershell
git diff --stat 67d93ac HEAD
git diff 67d93ac HEAD -- src-tauri server worker scripts
```

The original React UI, settings schema, audio capture, VAD implementation and
translation pipeline have not been rewritten. Local recognition is opt-in via
the Cargo feature `local-stt`. Default builds retain the original cloud path.
No npm or Cargo dependency was added. Native Whisper adds a separate C++/CMake
build; Qwen adds sherpa-onnx to the optional Python environment.

## Start here

| Area | Responsibility |
| --- | --- |
| `src-tauri/src/local_stt.rs` | Preset selection, persistent child, framed PCM, readiness, timeout and shutdown |
| `src-tauri/src/cloud_stt.rs` | Existing queues; feature-gated choice of local vs cloud recognition |
| `worker/local_stt.py` | Qwen CPU backend; imports sherpa only when loading the recognizer |
| `worker/whisper/main.cpp` | Native multilingual Whisper CPU backend using the same pipe contract |
| `server/src/config.rs`, `server/src/lib.rs` | `STT_MODE=local` requires only translation credentials and rejects cloud audio requests |
| `scripts/setup-local-stt.ps1`, `scripts/setup-whisper.ps1` | Explicit setup/download/build steps |
| `scripts/start-local-stt.ps1` | Starts the local gateway and desktop; normal exit cleans up its gateway |

Protocol: little-endian u32 byte count, one language byte (`0=en`, `1=th`), then
mono PCM16 at 16 kHz, maximum 30 seconds. Output is one JSON object per line:
`ready`, `text`, or `error`. Audio is kept in memory. One recognizer serializes
both streams; do not start a second model per stream. The native `--model-dir`
argument names a GGML **file**, while Qwen expects a directory, for compatibility
with the existing worker command. Each inference has a 20-second watchdog.

## Fresh Windows checkout

Requires Windows x64/AVX2 for the current native build, Node/pnpm, Python 3.11 or
3.12, Rust MSVC and Visual Studio 2022 C++ Build Tools with CMake.

```powershell
pnpm install --frozen-lockfile
powershell -ExecutionPolicy Bypass -File scripts/setup-local-stt.ps1 -Preset base
# Only for a new checkout without server/.env:
Copy-Item server/local-stt.env.example server/.env
# Set TRANSLATION_API_KEY privately, then:
powershell -ExecutionPolicy Bypass -File scripts/start-local-stt.ps1 -Preset base -Build
```

The friend supplies their own credentials. Never send an entire working folder:
it may contain `server/.env`, databases, logs and downloaded models. The source ZIP
created with `git archive` includes committed files only; setup recreates ignored
dependencies, models and build outputs. No absolute user path is required by the
setup scripts, but a compiled debug desktop embeds its build checkout path and
must be rebuilt on the recipient's machine.

Presets must match setup and launch:

| Preset | Setup | Launcher |
| --- | --- | --- |
| base | `setup-local-stt.ps1 -Preset base` | `Start-WANGAI-Whisper.cmd` |
| small | `setup-local-stt.ps1 -Preset small` | `Start-WANGAI-Small.cmd` |
| qwen | `setup-local-stt.ps1 -Preset qwen` | `Start-WANGAI-Local.cmd` |

The Qwen launcher was retained intentionally, not left as dead code: the lighter
Whisper presets have not passed Thai accuracy testing. All three use the same
desktop executable/settings. Close the running preview before switching presets.
Translation is still Grok from server configuration; Qwen translation was only
a cost simulation, not implemented.

## Verification

```powershell
npm test
npm run build
cargo test --manifest-path server/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml --lib --features local-stt
cargo test --manifest-path src-tauri/Cargo.toml --lib --no-default-features
.venv/Scripts/python.exe -m unittest discover -s worker -v
```

Whisper process integration tests require the native binary and base weights.
They report explicit skips on a fresh checkout/default CI; after base setup,
verify both native tests actually run. The original CI does not build/test the
local-STT Cargo feature or package the native backend yet.

## Review findings / remaining work

Review verification on 2026-10-01: frontend 120 tests + 4 build-tool tests passed;
server 15 passed; desktop local feature 98 passed and default feature 92 passed
(3 environment-specific tests ignored in each run); Python 17 passed, including
both native Whisper tests. Simulating absent Whisper assets produced 2 explicit
skips. Frontend type check/build and diff whitespace check passed. No new live
GUI/game test was performed for this documentation/test-only handoff change.

- Fixed during handoff review: native tests previously failed ordinary Python
  discovery on clean CI because ignored local binaries/models were absent.
- Source is ready for developer experimentation, **not production distribution**.
  `build.rs` intentionally rejects release builds with `local-stt`; packaging,
  model licenses in the installer and clean-machine testing remain.
- Local recognition returns text only, bypassing the cloud confidence filter.
  Whisper base makes meaningful Thai errors; small is slower. See the measured
  [comparison](whisper-preview.md). This is a release blocker for a quality claim.
- Launcher cleanup is best-effort: forcibly closing its PowerShell host can leave
  the gateway on port 18080. It refuses occupied ports rather than killing unknown
  processes. Process ownership/job-object cleanup is future lifecycle work.
- Dependencies and setup tools must be installed separately; there is no lock for
  every optional Python runtime dependency. Whisper source/model revisions are pinned.
- Silero still loads PyTorch, and both WebViews stay resident by original design.
  No RAM optimization or UI lifecycle change was made in this review.

This review inspected the complete feature diff and its integration points,
not every unchanged upstream line or a full security/production audit.
