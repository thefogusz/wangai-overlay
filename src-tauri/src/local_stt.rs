//! One persistent, CPU-only recognizer shared by incoming audio and F9.
//! A timeout kills the worker; audio is never retried against the cloud.
use anyhow::{anyhow, bail, Context, Result};
use std::{
    io::{BufRead, BufReader, Read, Write},
    path::PathBuf,
    process::{Child, ChildStdin, Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc, Arc, Mutex,
    },
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter, Manager};

/// Startup and the existing recovery button use the same readiness/error path.
pub fn warm_up_in_background(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let state = app.state::<crate::state::AppState>();
        let message = match state.local_stt.warm_up(&app).await {
            Ok(()) => "Local STT พร้อม: ถอดเสียงบนเครื่อง / แปลผ่านบริการ AI".to_string(),
            Err(error) => {
                state.update_runtime(|runtime| runtime.last_error = Some(error.to_string()));
                format!("Local STT ยังไม่พร้อม: {error}")
            }
        };
        let _ = app.emit("pipeline-status", message);
        let _ = app.emit("runtime-state", state.update_runtime(|_| {}));
    });
}

#[derive(Clone, Copy, Debug, PartialEq)]
enum Preset {
    Base,
    Small,
    Qwen,
}

impl Preset {
    fn parse(value: &str) -> Result<Self> {
        match value {
            "base" => Ok(Self::Base),
            "small" => Ok(Self::Small),
            "qwen" => Ok(Self::Qwen),
            _ => bail!("Unknown local STT preset; choose base, small or qwen"),
        }
    }
    fn label(self) -> &'static str {
        match self {
            Self::Base => "Whisper base Q5_1 (local CPU)",
            Self::Small => "Whisper small Q5_1 (local CPU)",
            Self::Qwen => "Qwen3-ASR-0.6B INT8 (local CPU)",
        }
    }
    fn file(self) -> &'static str {
        match self {
            Self::Base => "ggml-base-q5_1.bin",
            Self::Small => "ggml-small-q5_1.bin",
            Self::Qwen => "sherpa-onnx-qwen3-asr-0.6B-int8-2026-03-25",
        }
    }
}

fn preset() -> Result<Preset> {
    Preset::parse(&std::env::var("WANGAI_LOCAL_STT_PRESET").unwrap_or_else(|_| "base".into()))
}

pub fn model_name() -> &'static str {
    preset()
        .map(Preset::label)
        .unwrap_or("Invalid local STT preset")
}
const RESPONSE_TIMEOUT: Duration = Duration::from_secs(20);

#[derive(Clone, Default)]
pub struct LocalStt(Arc<Inner>);

#[derive(Default)]
struct Inner {
    session: Mutex<Option<Session>>,
    child: Mutex<Option<Child>>,
    closing: AtomicBool,
    ready: AtomicBool,
}

struct Session {
    stdin: ChildStdin,
    responses: mpsc::Receiver<String>,
}

fn write_request(writer: &mut impl Write, samples: &[i16], language: &str) -> Result<()> {
    let code = match language {
        "en" => 0_u8,
        "th" => 1_u8,
        _ => bail!("Unsupported local STT language"),
    };
    anyhow::ensure!(
        !samples.is_empty() && samples.len() <= 16_000 * 30,
        "Invalid local audio length"
    );
    writer.write_all(&(1 + samples.len() as u32 * 2).to_le_bytes())?;
    writer.write_all(&[code])?;
    let pcm: Vec<u8> = samples
        .iter()
        .flat_map(|sample| sample.to_le_bytes())
        .collect();
    writer.write_all(&pcm)?;
    writer.flush()?;
    Ok(())
}

fn response(session: &Session, timeout: Duration) -> Result<serde_json::Value> {
    let line = session
        .responses
        .recv_timeout(timeout)
        .context("Local STT ไม่ตอบภายในเวลา กรุณาลองวลีสั้นลงหรือตรวจโมเดล")?;
    let result: serde_json::Value =
        serde_json::from_str(&line).context("Invalid local STT response")?;
    if let Some(error) = result.get("error").and_then(|v| v.as_str()) {
        bail!("{error}");
    }
    Ok(result)
}

impl Inner {
    fn connect(&self, mut command: Command) -> Result<Session> {
        let mut child_slot = self.child.lock().unwrap();
        anyhow::ensure!(
            !self.closing.load(Ordering::Acquire),
            "Local STT is shutting down"
        );
        command
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null());
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            // Hide console and give the game priority over CPU inference.
            command.creation_flags(0x0800_0000 | 0x0000_4000);
        }
        let mut child = command
            .spawn()
            .context("เปิด Local STT ไม่ได้: รัน scripts/setup-local-stt.ps1 ก่อน")?;
        let stdin = child.stdin.take().context("Missing local STT stdin")?;
        let stdout = child.stdout.take().context("Missing local STT stdout")?;
        *child_slot = Some(child);
        drop(child_slot);
        let (tx, responses) = mpsc::sync_channel(2);
        std::thread::spawn(move || {
            let mut reader = BufReader::new(stdout);
            loop {
                let mut line = String::new();
                match reader.by_ref().take(65_537).read_line(&mut line) {
                    Ok(0) | Err(_) => break,
                    Ok(_) if line.len() > 65_536 => break,
                    Ok(_) => {
                        if tx.send(line).is_err() {
                            break;
                        }
                    }
                }
            }
        });
        let session = Session { stdin, responses };
        let ready = response(&session, Duration::from_secs(60))?;
        anyhow::ensure!(
            ready.get("ready").and_then(|v| v.as_bool()) == Some(true),
            "Local STT failed to initialize"
        );
        self.ready.store(true, Ordering::Release);
        Ok(session)
    }

    fn kill(&self) -> Result<()> {
        self.ready.store(false, Ordering::Release);
        let mut slot = self.child.lock().unwrap();
        if let Some(child) = slot.as_mut() {
            if child.try_wait()?.is_none() {
                child.kill()?;
                let deadline = Instant::now() + Duration::from_secs(3);
                while child.try_wait()?.is_none() {
                    anyhow::ensure!(Instant::now() < deadline, "Local STT ยังไม่หยุด");
                    std::thread::sleep(Duration::from_millis(10));
                }
            }
        }
        *slot = None;
        Ok(())
    }

    fn run(self: &Arc<Self>, command: Command, audio: Option<(&[i16], &str)>) -> Result<String> {
        let mut slot = self.session.lock().unwrap();
        anyhow::ensure!(
            !self.closing.load(Ordering::Acquire),
            "Local STT is shutting down"
        );
        let result = (|| {
            if slot.is_none() {
                *slot = Some(self.connect(command)?);
            }
            let Some((samples, language)) = audio else {
                return Ok(String::new());
            };
            let session = slot.as_mut().unwrap();
            // Include pipe writes in the deadline: a wedged child may stop
            // reading stdin before the response timeout has even started.
            let (cancel, deadline) = mpsc::channel::<()>();
            let inner = self.clone();
            let watchdog = std::thread::spawn(move || {
                if matches!(
                    deadline.recv_timeout(RESPONSE_TIMEOUT),
                    Err(mpsc::RecvTimeoutError::Timeout)
                ) {
                    let _ = inner.kill();
                    true
                } else {
                    false
                }
            });
            let result = (|| {
                write_request(&mut session.stdin, samples, language)?;
                let value = response(session, RESPONSE_TIMEOUT)?;
                value
                    .get("text")
                    .and_then(|v| v.as_str())
                    .map(str::to_owned)
                    .ok_or_else(|| anyhow!("Local STT response has no text"))
            })();
            drop(cancel);
            if watchdog.join().unwrap_or(true) {
                bail!("Local STT เกินเวลา 20 วินาที");
            }
            result
        })();
        if result.is_err() {
            *slot = None;
            self.kill()?;
        }
        result
    }
}

impl Drop for Inner {
    fn drop(&mut self) {
        let _ = self.kill();
    }
}

impl LocalStt {
    pub fn is_ready(&self) -> bool {
        self.0.ready.load(Ordering::Acquire) && !self.0.closing.load(Ordering::Acquire)
    }

    pub async fn warm_up(&self, app: &AppHandle) -> Result<()> {
        let command = command(app)?;
        let inner = self.0.clone();
        tokio::task::spawn_blocking(move || inner.run(command, None)).await??;
        Ok(())
    }

    pub async fn transcribe(
        &self,
        app: &AppHandle,
        samples: Vec<i16>,
        language: &'static str,
    ) -> Result<String> {
        let command = command(app)?;
        let inner = self.0.clone();
        tokio::task::spawn_blocking(move || inner.run(command, Some((&samples, language)))).await?
    }

    pub fn stop(&self) -> Result<()> {
        self.0.closing.store(true, Ordering::Release);
        self.0.kill()
    }
}

fn command(app: &AppHandle) -> Result<Command> {
    let preset = preset()?;
    #[cfg(debug_assertions)]
    let (mut command, default_models) = {
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..");
        let command = if preset == Preset::Qwen {
            let path = crate::worker::resolve_worker_path(app)?;
            let mut command = Command::new(crate::worker::resolve_python(&path));
            command.arg("-u").arg(path.with_file_name("local_stt.py"));
            command
        } else {
            let executable = root.join("output/whisper-build/Release/wangai-whisper.exe");
            anyhow::ensure!(executable.is_file(), "Run scripts/setup-whisper.ps1 first");
            Command::new(executable)
        };
        (
            command,
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../output/models"),
        )
    };
    #[cfg(not(debug_assertions))]
    let (mut command, default_models) = {
        let resources = app.path().resource_dir()?;
        let executable = resources.join("worker/local-stt/wangai-local-stt.exe");
        anyhow::ensure!(
            executable.is_file(),
            "Local STT worker missing from this build"
        );
        (Command::new(executable), resources.join("models"))
    };
    let model_dir = default_models.join(preset.file());
    command
        .arg("--model-dir")
        .arg(model_dir)
        .arg("--threads")
        .arg("2");
    command
        .env("OMP_NUM_THREADS", "2")
        .env("PYTHONDONTWRITEBYTECODE", "1");
    Ok(command)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn presets_keep_display_names_and_multilingual_model_files_consistent() {
        for (value, file, label) in [
            ("base", "ggml-base-q5_1.bin", "Whisper base"),
            ("small", "ggml-small-q5_1.bin", "Whisper small"),
            (
                "qwen",
                "sherpa-onnx-qwen3-asr-0.6B-int8-2026-03-25",
                "Qwen3-ASR",
            ),
        ] {
            let preset = Preset::parse(value).unwrap();
            assert_eq!(preset.file(), file);
            assert!(preset.label().starts_with(label));
        }
        assert!(Preset::parse("base.en").is_err());
    }

    #[test]
    fn pcm_protocol_preserves_both_directions_without_audio_files() {
        for (language, code) in [("en", 0), ("th", 1)] {
            let mut bytes = Vec::new();
            write_request(&mut bytes, &[100, -200], language).unwrap();
            assert_eq!(bytes, vec![5, 0, 0, 0, code, 100, 0, 56, 255]);
        }
    }

    #[test]
    fn invalid_audio_is_rejected_before_writing() {
        for (samples, language) in [(vec![], "en"), (vec![0; 480001], "en"), (vec![1], "xx")] {
            let mut bytes = Vec::new();
            assert!(write_request(&mut bytes, &samples, language).is_err());
            assert!(bytes.is_empty());
        }
    }

    #[test]
    fn shutdown_rejects_work_before_spawning_a_child() {
        let worker = Arc::new(Inner::default());
        worker.closing.store(true, Ordering::Release);
        assert!(worker.run(Command::new("missing-worker"), None).is_err());
    }

    #[test]
    fn failed_initialization_can_be_retried_without_restarting_desktop() {
        let temp = tempfile::tempdir().unwrap();
        let script = temp.path().join("worker.py");
        std::fs::write(&script, "print('{\"error\":\"model missing\"}', flush=True)\n").unwrap();
        let inner = Arc::new(Inner::default());
        assert!(inner.run(fake_command(&script), None).is_err());
        assert!(!inner.ready.load(Ordering::Acquire));
        assert!(inner.child.lock().unwrap().is_none());
        std::fs::write(&script, "import sys\nprint('{\"ready\":true}', flush=True)\nsys.stdin.buffer.read()\n").unwrap();
        inner.run(fake_command(&script), None).unwrap();
        assert!(inner.ready.load(Ordering::Acquire));
        inner.kill().unwrap();
    }

    fn fake_command(path: &std::path::Path) -> Command {
        let worker = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../worker/main.py");
        let mut command = Command::new(crate::worker::resolve_python(&worker));
        command.arg("-u").arg(path);
        command
    }

    #[test]
    fn persistent_process_handles_both_streams_and_restarts_after_crash() {
        let temp = tempfile::tempdir().unwrap();
        let script = temp.path().join("worker.py");
        std::fs::write(
            &script,
            r#"
import json,struct,sys
print('{"ready":true}', flush=True)
while True:
    header=sys.stdin.buffer.read(4)
    if not header: break
    data=sys.stdin.buffer.read(struct.unpack('<I',header)[0])
    print(json.dumps({'text': str(data[0])+':'+str(struct.unpack('<h', data[1:3])[0])}), flush=True)
"#,
        )
        .unwrap();
        let inner = Arc::new(Inner::default());
        assert_eq!(
            inner
                .run(fake_command(&script), Some((&[-200], "en")))
                .unwrap(),
            "0:-200"
        );
        let pid = inner.child.lock().unwrap().as_ref().unwrap().id();
        assert_eq!(
            inner
                .run(fake_command(&script), Some((&[100], "th")))
                .unwrap(),
            "1:100"
        );
        assert_eq!(inner.child.lock().unwrap().as_ref().unwrap().id(), pid);
        inner.kill().unwrap();
        assert!(inner
            .run(fake_command(&script), Some((&[100], "en")))
            .is_err());
        assert_eq!(
            inner
                .run(fake_command(&script), Some((&[100], "en")))
                .unwrap(),
            "0:100"
        );
        inner.kill().unwrap();
    }

    #[test]
    fn stop_interrupts_in_flight_inference_and_reaps_the_child() {
        let temp = tempfile::tempdir().unwrap();
        let script = temp.path().join("worker.py");
        std::fs::write(
            &script,
            "import time\nprint('{\"ready\":true}', flush=True)\ntime.sleep(60)\n",
        )
        .unwrap();
        let worker = LocalStt::default();
        worker.0.run(fake_command(&script), None).unwrap();
        let other = worker.0.clone();
        let command = fake_command(&script);
        let pending =
            std::thread::spawn(move || other.run(command, Some((&vec![1; 480000], "en"))));
        std::thread::sleep(Duration::from_millis(100));
        let started = Instant::now();
        worker.stop().unwrap();
        assert!(pending.join().unwrap().is_err());
        assert!(started.elapsed() < Duration::from_secs(5));
        assert!(worker.0.child.lock().unwrap().is_none());
    }
}
