# Direct ONNX VAD (2026-10-01)

Silero now runs via NumPy and ONNX Runtime, using the same model, 512-sample
frames, recurrent state, 64-sample context and unchanged speech boundary rules.
`silero-vad` is installed **with --no-deps for its model asset only**. Do not
import the package: its public Python wrapper imports torch. Setup installs
`requirements.txt` plus `requirements-model.txt` separately. Packaging uses
`requirements.lock` plus the hash-pinned `model.lock`; the frozen worker excludes
torch/torchaudio and includes only the ONNX asset from Silero.

## Validation

On the development machine (Python 3.11, Silero 6.2.3), eight synthetic Thai/English
clips with leading/trailing silence produced identical speech boundary events
before/after. Comparing probabilities at original and 0.1 volume across 3,100
frames gave maximum absolute difference **0**. This is fixture equivalence, not
an end-to-end live gaming accuracy test.

Separate worker processes, measured after model warmup:

| Memory (MiB) | Old wrapper | Direct ONNX |
| --- | ---: | ---: |
| Working set (including shared pages) | 234.5 | 69.9 |
| Private working set | 183.8 | 44.8 |

These are VAD process-tree measurements, not whole-app memory or installer
measurements. Existing running workers must restart to use the new source.
Previously installed torch files may remain on disk in old development venvs;
the new worker does not load them, and fresh setup/packaging does not install them.

Run `python -m unittest discover -s worker -v` in the configured environment.
The new subprocess test explicitly rejects imports of torch and torchaudio,
loads the real model, and exercises inference and state reset.

Validation also passed all 18 worker tests in a fresh Python 3.12 packaging
environment with no torch installed (Silero asset 6.2.1). The frozen worker
passed real-model offline startup, Unicode/spaced path, reset and binary-frame
smoke tests. This packages the worker only, not a full local-STT installer.
