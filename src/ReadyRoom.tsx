import { AudioLines, Check, ChevronRight, Cloud, Globe2, Headphones, LoaderCircle, Radio, ShieldCheck, TriangleAlert } from "lucide-react";
import type { AppSettings, RuntimeState } from "./types";
import { useEffect, type ReactNode } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";

type Props = {
  settings: AppSettings;
  runtime: RuntimeState;
  busy?: string;
  previewMode: boolean;
  onToggleListening: () => void;
  onOpenSourcePicker: () => void;
  onOpenWebCompanion?: () => void;
  webCompanionOrigin?: string;
  webRuntime: boolean;
  notification?: ReactNode;
  showSecondary?: boolean;
};
type Tone = "ready" | "waiting" | "warning" | "setup";
type Readiness = { label: string; detail: string; tone: Tone };

export function ReadyRoom({ settings, runtime, busy, previewMode, onToggleListening, onOpenSourcePicker, onOpenWebCompanion, webCompanionOrigin, webRuntime, notification, showSecondary = true }: Props) {
  useEffect(() => {
    if (webRuntime || previewMode || !isTauri()) return;
    const frame = requestAnimationFrame(() => { void invoke("portable_frontend_ready").catch(() => {}); });
    return () => cancelAnimationFrame(frame);
  }, [webRuntime, previewMode]);
  const incoming = incomingReadiness(settings, runtime);
  const ai = aiReadiness(runtime);
  const configured = Boolean(settings.listeningSource) && runtime.workerReady && ["connected", "ready"].includes(runtime.aiService.state);
  const needsSource = !settings.listeningSource;
  return <div className="ready-room-grid">
    {notification && <div className="ready-notification-slot">{notification}</div>}
    <section className="ready-room-panel" aria-labelledby="ready-room-title">
      <div className="ready-room-intro"><div><p className="eyebrow">WANGAI LIVE</p><h2 id="ready-room-title">{needsSource ? "เลือกแอปเพื่อเริ่ม" : runtime.listening ? "กำลังแปลเสียง" : "แปลเสียงสด"}</h2><p>{needsSource ? "เลือกแอปที่ต้องการฟังก่อนเริ่มแปลเสียง" : "คำแปลภาษาไทยจะแสดงบน Overlay ระหว่างเล่นเกม"}</p></div></div>
      <div className={`ready-primary-action ${needsSource ? "is-empty" : ""}`}><span className="ready-game-mark" aria-hidden="true"><Headphones /></span><div className="ready-primary-context"><small>{needsSource ? "แหล่งเสียง" : runtime.listening ? "แอปที่กำลังฟัง" : "แอปที่เลือก"}</small><strong>{settings.listeningSource?.displayName ?? "ยังไม่ได้เลือกแอป"}</strong><span>{runtime.listening ? "ฟังเสียงอยู่ · แปลเป็นไทยแบบสด" : configured ? "กด F8 เพื่อเชื่อมต่อเสียงจากแอป" : needsSource ? "เลือกเกมหรือแอปที่ต้องการฟัง" : "รอระบบเสียงหรือบริการ AI พร้อม"}</span></div>{needsSource ? <button aria-label="เลือกแอปที่จะฟัง" className="ready-listen-button is-select" onClick={onOpenSourcePicker}><Headphones /><span>เลือกแอป</span><small>ขั้นตอนแรก</small></button> : <button aria-describedby={!runtime.listening && !configured ? runtime.workerReady ? "ready-ai-status" : "ready-source-status" : undefined} className={`ready-listen-button ${runtime.listening ? "is-listening" : ""}`} disabled={busy === "listen" || previewMode || (!runtime.listening && !configured)} onClick={onToggleListening}>{busy === "listen" ? <LoaderCircle className="animate-spin" /> : runtime.listening ? <AudioLines /> : <Headphones />}<span>{runtime.listening ? "หยุดใช้งาน" : "เริ่มใช้งาน"}</span></button>}</div>
      {!needsSource && <div className="ready-source-list">
        <Row action="เปลี่ยน" icon={<Radio />} index={1} meterLabel="ระดับเสียงขาเข้า" meterValue={runtime.audioPeakDbfs} name={settings.listeningSource?.displayName ?? "แอปที่เลือก"} onAction={onOpenSourcePicker} readiness={incoming} title="แหล่งเสียงที่ฟัง" />
        <Row icon={<Cloud />} index={2} name="อังกฤษ → ไทย" readiness={ai} title="การแปล" />
      </div>}
    </section>
    {showSecondary && <><details className="ready-privacy"><summary><ShieldCheck />ความเป็นส่วนตัวและการส่งข้อมูล <ChevronRight /></summary><p>ส่งเฉพาะช่วงคำพูดและข้อความผ่านเซิร์ฟเวอร์ WANGAI ไปยัง AI provider ไม่บันทึกเนื้อหาบนเซิร์ฟเวอร์ เก็บสถิติการใช้งานด้วยรหัสติดตั้งแบบสุ่ม</p></details><div className="ready-footer-actions">{!webRuntime && onOpenWebCompanion && <button title={webCompanionOrigin} onClick={onOpenWebCompanion}><Globe2 />เปิด Web App</button>}{webRuntime && <span><Globe2 />Web Companion · เชื่อมต่อ Desktop</span>}{previewMode && <span>ข้อมูลจำลองสำหรับ Browser Preview</span>}</div></>}
  </div>;
}

function Row({ index, icon, title, name, readiness, meterLabel, meterValue, action, onAction }: { index: number; icon: React.ReactNode; title: string; name: string; readiness: Readiness; meterLabel?: string; meterValue?: number | null; action?: string; onAction?: () => void }) {
  const percent = levelPercent(meterValue);
  return <article className={`ready-source-row tone-${readiness.tone} ${action ? "" : "no-action"} ${meterLabel ? "" : "no-meter"}`}><span className="ready-step">{index}</span><span className="ready-source-icon">{icon}</span><div className="ready-source-name"><strong>{title}</strong><span title={name}>{name}</span></div><div className="ready-source-status" id={index === 1 ? "ready-source-status" : "ready-ai-status"}><span className="ready-status-icon">{readiness.tone === "ready" || readiness.tone === "waiting" ? <Check /> : <TriangleAlert />}</span><span><strong>{readiness.label}</strong><small title={readiness.detail}>{readiness.detail}</small></span></div>{meterLabel && <div className="ready-meter-wrap"><span>{meterLabel}</span><div aria-label={meterLabel} aria-valuemax={100} aria-valuemin={0} aria-valuenow={Math.round(percent)} className="ready-meter" role="meter">{Array.from({ length: 18 }, (_, i) => <span className={i < Math.round((percent / 100) * 18) ? "is-active" : ""} key={i} />)}</div></div>}{action && <button className="ready-change-button" onClick={onAction}>{action}</button>}</article>;
}

function incomingReadiness(settings: AppSettings, runtime: RuntimeState): Readiness {
  if (!settings.listeningSource) return { label: "ยังไม่ได้เลือกแอป", detail: "กดเลือกแอปเพื่อเริ่มใช้งาน", tone: "setup" };
  if (!runtime.workerReady) return { label: "ตัวตรวจคำพูดยังไม่พร้อม", detail: runtime.lastError ? "พบข้อผิดพลาด กรุณาตรวจข้อความแจ้งเตือน" : "กำลังเตรียม Silero VAD", tone: runtime.lastError ? "warning" : "waiting" };
  if (!runtime.listening) return { label: "เลือกแล้ว", detail: "กด F8 เพื่อเริ่มใช้งาน", tone: "waiting" };
  if (runtime.captureWarning) return { label: "ไม่ได้ยินเสียง", detail: "เปิดวิธีแก้ปัญหาเสียง", tone: "warning" };
  if (!runtime.attachedSource) return { label: "หาแอปไม่พบ", detail: `ตรวจว่า ${settings.listeningSource.displayName} ยังเปิดอยู่`, tone: "warning" };
  if (runtime.audioLastSeenAtMs == null) return { label: "รอเสียงจากแอป", detail: "กำลังเชื่อมต่อแหล่งเสียง", tone: "waiting" };
  if ((runtime.audioPeakDbfs ?? -96) <= -90) return { label: "ยังไม่ได้ยินเสียง", detail: "ตรวจว่าแอปกำลังเล่นเสียง", tone: "warning" };
  if (!runtime.vadActive) return { label: "กำลังฟัง", detail: settings.captureMode === "system_output" ? "รอคำพูดจากเสียงรวม" : "รอคำพูดจากแอป", tone: "waiting" };
  return { label: "กำลังตรวจพบคำพูด", detail: settings.captureMode === "system_output" ? "แหล่งข้อความจะแสดง MIXED" : `รับเสียงจาก ${settings.listeningSource.displayName}`, tone: "ready" };
}
function aiReadiness(runtime: RuntimeState): Readiness {
  const service = runtime.aiService;
  if (service.state === "offline") return { label: "เชื่อมต่อไม่ได้", detail: service.message === "เชื่อมต่อบริการ AI ไม่สำเร็จ" ? "กำลังลองเชื่อมต่อใหม่" : service.message, tone: "warning" };
  if (service.state === "degraded") return { label: service.retryAfterMs ? "กำลังพัก" : "บริการขัดข้อง", detail: service.message, tone: "warning" };
  if (service.state === "connecting") return { label: "กำลังเชื่อมต่อ", detail: service.message, tone: "waiting" };
  if (runtime.aiSttBusy) return { label: "กำลังแปล", detail: "กำลังประมวลผลวลีล่าสุด", tone: "ready" };
  return { label: "พร้อม", detail: "แปลเสียงจากแอปได้", tone: "ready" };
}
function levelPercent(dbfs?: number | null): number { return dbfs == null ? 0 : Math.max(0, Math.min(100, ((dbfs + 60) / 60) * 100)); }
