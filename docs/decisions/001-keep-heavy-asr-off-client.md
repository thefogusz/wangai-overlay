# ADR-001: Keep heavy ASR inference off the user's gaming PC

Status: Accepted

Date: 2026-09-24

## Context

WANGAI runs alongside games. Running WhisperLiveKit, Qwen3-ASR, or another substantial speech model locally would compete with the game for CPU, GPU, VRAM, RAM, and startup time. Performance would vary by user hardware and game load.

## Decision

Do not propose or implement heavy on-device ASR as a WANGAI user-facing feature or fallback. Keep speech-model inference on the service side. Local capture and lightweight voice-activity detection remain in scope; they are not local speech-model inference.

If evaluating a new ASR model, run the comparison off the user's gaming PC and measure service cost, latency, and recognition quality before any integration. Do not silently transfer compute or hosting costs to users.

## Consequences

The existing desktop-to-gateway STT path remains the product direction. Offline heavy-model transcription is not a planned WANGAI feature. Any future change to this constraint needs an explicit product decision.
