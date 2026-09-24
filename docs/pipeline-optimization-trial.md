# Pipeline optimization trial

This trial changes only the desktop-to-gateway speech path. Incoming audio may pass up to 20 short English game terms from the user's existing glossary to the STT provider as a prompt. The gateway validates the terms and selects the provider model and credential as before. Microphone STT does not receive a prompt.

STT remains serialized per stream. After STT finishes, translation may continue while the next utterance is transcribed. Up to four utterances per stream may occupy the bounded translation stage; the existing STT queue still accepts one running and one waiting job. Translation results remain matched to their segment IDs, and generation checks reject results from a previous source/session.

## Measure the trial

Set `WANGAI_PIPELINE_TIMING=1` before starting the Desktop app. For example, in PowerShell:

```powershell
$env:WANGAI_PIPELINE_TIMING = "1"
pnpm tauri dev
```

Each completed or skipped utterance writes one `pipeline_timing` line to stderr with a random segment ID and no speech text. `queue_ms` starts when the utterance is accepted for processing and ends when STT starts; it includes waiting for a translation slot. `stt_ms` covers the STT request and local validation. `translation_stage_ms` covers translation and emission of the result event; `-` means there was no transcript to translate. `total_ms` ends after the translation stage. These values do **not** include VAD's silence wait or WebView paint time.

Compare the same callout recordings under idle and continuous speech. Capture p50/p95 total and queue time, rejected STT jobs, recognized game terms, mistranscriptions, and estimated billable STT duration. Keep the incoming and F9 directions separate. Check both accurate recognition and whether the vocabulary prompt causes terms to appear in unrelated or silent clips.

The unit tests use a mock provider. Real provider latency, prompt acceptance, and on-screen timing still require a controlled speech trial.
