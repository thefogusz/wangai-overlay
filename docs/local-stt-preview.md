# WANGAI Local STT + Grok preview

Based on upstream `HectorRussia/wangai-overlay` main, commit `67d93ac`.

เสียงเกม / F9 → Silero ตัดวลี → Qwen3-ASR 0.6B INT8 บนเครื่อง → ส่งข้อความไป Grok → Overlay เดิม

## เปิดใช้งานบนเครื่องนี้

1. ใส่คีย์ใน `server/.env` ตรง `TRANSLATION_API_KEY=`
2. ดับเบิลคลิก `Start-WANGAI-Local.cmd` ที่โฟลเดอร์ repo นี้
3. เลือกแอปเสียง กด F8 เริ่มฟัง และกด F9 ค้างเพื่อพูดไทย

ปิด WANGAI รุ่นเก่าก่อน เพื่อไม่ให้ปุ่มลัดชนกัน ตัวทดลองใช้ settings แยกใน
`%APPDATA%/dev.gamelingo.overlay.local-stt` และไม่แก้คีย์หรือโมเดลบน server เดิม
คีย์อยู่ใน `.env` ของ gateway บนเครื่อง ซึ่ง Git ไม่ติดตาม ไม่ต้องใส่คีย์ในหน้าเว็บ
Gateway ทดลอง bind เฉพาะ `127.0.0.1:18080` และ launcher ปิด gateway เมื่อแอปออก
ห้ามเปิด launcher ซ้ำหรือเปลี่ยน port ใน `.env` โดยไม่แก้ launcher ให้ตรงกัน

## เตรียมใหม่จาก source

ต้องมี Windows x64, Python 3.11/3.12, Node.js, pnpm, Rust MSVC และ C++ Build Tools

```powershell
pnpm install --frozen-lockfile
powershell -ExecutionPolicy Bypass -File scripts/setup-local-stt.ps1
Copy-Item server/local-stt.env.example server/.env
# ใส่ TRANSLATION_API_KEY ใน server/.env
powershell -ExecutionPolicy Bypass -File scripts/start-local-stt.ps1 -Build
```

Setup ดาวน์โหลดโมเดลครั้งเดียว 879 MB ตรวจ SHA-256 ก่อนแตกไฟล์ โมเดลอยู่ใน
`output/models/sherpa-onnx-qwen3-asr-0.6B-int8-2026-03-25` ไม่ดาวน์โหลดอัตโนมัติระหว่างเล่น
ต้องเก็บ repo, `.venv`, `output/models` และตัว build ไว้ด้วยกัน
นี่เป็น debug preview สำหรับลองบนเครื่อง ไม่ใช่ portable installer พร้อมแจก
Release build ที่เปิด `local-stt` ถูกป้องกันไว้จนกว่าจะเพิ่มและทดสอบ packaging
การ build แบบปกติไม่เปิด feature นี้ จึงยังใช้ cloud STT เดิม

## Grok และค่าใช้จ่าย

Preset ใช้ `grok-4.20-0309-non-reasoning` ผ่าน `https://api.x.ai/v1` จำกัดคำตอบ 256 tokens
เลือกจากกลุ่มโมเดลทั่วไปแบบไม่ reasoning ใน [ราคา xAI](https://docs.x.ai/developers/pricing)
ที่ตรวจ 2026-10-01: input $1.25 / output $2.50 ต่อหนึ่งล้าน tokens
โมเดล coding `grok-build-0.1` ราคาต่ำกว่า แต่ไม่ได้เลือกเป็นค่าเริ่มต้นสำหรับแปลภาษา
ไม่ได้ยืนยันว่าโมเดลนี้ latency ต่ำที่สุด ต้องทดสอบ API จริงด้วยบัญชีผู้ใช้
เปลี่ยน `TRANSLATION_MODEL` และ restart launcher ได้ โดยไม่ build desktop ใหม่

Local STT ไม่เรียก Groq, ไม่อัปโหลดเสียง, ไม่มี cloud fallback และไม่บันทึกเสียงใช้งาน
ยังเสียค่า Grok ต่อข้อความ ดังนั้น **ไม่ได้รับประกันงบ $30 สำหรับ 500 คน**
Gateway ในโหมด `STT_MODE=local` ไม่ต้องมี STT key และปฏิเสธ endpoint ถอดเสียง

## ผลทดลองบนเครื่องนี้

CPU i5-13400F, RAM 16 GB, CPU inference 2 threads, below-normal process priority
ใช้เสียงสังเคราะห์ Windows SAPI ที่บันทึกเป็นไฟล์เฉพาะการทดสอบ ไม่ใช่เสียงผู้ใช้

| รายการ | ผลรอบที่บันทึก |
| --- | --- |
| โหลดโมเดลครั้งแรก | 3.55 วินาที |
| อังกฤษ 5.10 วินาที | ถอด 1.28 วินาที, ข้อความตรงตัวอย่าง |
| ไทย 4.13 วินาที | ถอด 1.94 วินาที, มีคำเพี้ยน |
| Peak working set เฉพาะ ASR worker | ประมาณ 1.38 GiB |

ไทยต้นฉบับ: `ศัตรูอยู่ทางซ้าย ช่วยยิงคุ้มกันด้วย ฉันกำลังเติมกระสุน`
ผล: `สตรูอยู่ทางซ้ายชั่วหญิงคุ้มกันด้วยฉันกำลังเติมกระสุน`

เป็น smoke test สองประโยค ยังใช้สรุปความแม่นยำรวมไม่ได้
อีกรอบระหว่างเครื่องมีงานอื่น ใช้ 2.59 / 3.64 วินาทีตามลำดับ
เวลานี้ไม่รวม VAD รอจบวลี, Grok, UI และไม่ได้วัด FPS ขณะเล่นเกม
RAM ข้างต้นไม่รวม Silero, Desktop, WebView2 หรือเกม
ควรลองกับคำสั่งเกมจริง/ศัพท์เฉพาะ/เสียงรบกวนก่อนเลือกใช้แทน Whisper Turbo

## พฤติกรรมและข้อจำกัด

- ใช้ recognizer เดียวร่วมกันทั้ง incoming/F9 ประมวลผลทีละวลี จำกัด 2 threads
- คงคิวเดิม: แต่ละ stream มีงานกำลังทำหนึ่งชิ้นและรอหนึ่งชิ้น ไม่สะสมเสียงไม่จำกัด
- หลังโหลดโมเดล จำกัดหนึ่งงาน 20 วินาที รวมการเขียน pipe; หากค้างจะฆ่า worker และรายงานข้อผิดพลาด
- งานถัดไปเริ่ม worker ใหม่ ไม่ retry เสียงกับ cloud
- Qwen interface นี้ตรวจภาษาอัตโนมัติ และไม่มี confidence แบบ Whisper จึงไม่ได้สร้างคะแนนปลอม
- VAD และ near-silence gate ยังทำงาน แต่ไม่รับประกันว่าจะกรอง SFX/เสียงหลอนได้เท่า Whisper
- ชื่อโมเดลในหน้า Advanced Settings แสดง local CPU ส่วน Translation แสดงรุ่นจริงจาก gateway
- พื้นที่ทำงานเดิม `D:/WANGAI` ไม่ถูก restore หรือแก้ไข

## ตรวจซ้ำ

```powershell
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml --lib --features local-stt
cargo test --manifest-path src-tauri/Cargo.toml --lib --no-default-features
cargo test --manifest-path server/Cargo.toml
$env:PYTHONPATH='worker'
.venv/Scripts/python.exe -m unittest worker/test_worker.py worker/test_integration.py worker/test_local_stt.py
.venv/Scripts/python.exe scripts/benchmark-local-stt.py path/to/english.wav path/to/thai.wav
```

Benchmark ต้องใช้ WAV mono PCM16 16 kHz, วลีละไม่เกิน 30 วินาที และไม่อัปโหลดไฟล์
ทดสอบ protocol, silence, crash recovery, shutdown ระหว่าง inference และ cloud legacy path แล้ว
การใช้คีย์ Grok จริงและ capture เสียงในเกมยังต้องตรวจหลังตั้งค่า credentials
สร้าง Windows executable สำเร็จแล้ว แต่คำสั่ง smoke test เปิด/ปิดหน้าต่างถูก automatic
approval review ปฏิเสธด้วย `blocked by policy` จึงยังไม่ได้ยืนยันการเปิดหน้าต่างจริง

แหล่งโมเดล: [Qwen3-ASR](https://github.com/QwenLM/Qwen3-ASR),
[sherpa-onnx Qwen3](https://k2-fsa.github.io/sherpa/onnx/qwen3-asr/pretrained.html)
(Apache-2.0; export/community attribution อยู่ใน README ของ archive)
