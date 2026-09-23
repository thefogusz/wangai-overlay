import { AudioLines, Check, ChevronRight, Cloud, Globe2, Headphones, History, LoaderCircle, MessageSquareText, Radio, Settings, ShieldCheck, TriangleAlert } from "lucide-react";
import { advancedHref, settingsHref } from "./router";
import type { AppSettings, RuntimeState, SubtitleItem } from "./types";
import { useEffect, type ReactNode } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";

type Props = {
  settings: AppSettings;
  runtime: RuntimeState;
  history: SubtitleItem[];
  busy?: string;
  previewMode: boolean;
  onToggleListening: () => void;
  onOpenSourcePicker: () => void;
  onOpenWebCompanion?: () => void;
  webCompanionOrigin?: string;
  webRuntime: boolean;
  notification?: ReactNode;
};
type Tone = "ready" | "waiting" | "warning" | "setup";
type Readiness = { label: string; detail: string; tone: Tone };

export function ReadyRoom({ settings, runtime, history, busy, previewMode, onToggleListening, onOpenSourcePicker, onOpenWebCompanion, webCompanionOrigin, webRuntime, notification }: Props) {
  useEffect(() => {
    if (webRuntime || previewMode || !isTauri()) return;
    const frame = requestAnimationFrame(() => { void invoke("portable_frontend_ready").catch(() => {}); });
    return () => cancelAnimationFrame(frame);
  }, [webRuntime, previewMode]);
  const incoming = incomingReadiness(settings, runtime);
  const ai = aiReadiness(runtime);
  const configured = Boolean(settings.listeningSource) && runtime.workerReady && ["connected", "ready"].includes(runtime.aiService.state);
  const recent = history.find((item) => item.status === "success") ?? history[0];
  return <div className="ready-room-grid">
    {notification && <div className="ready-notification-slot">{notification}</div>}
    <section className="ready-room-panel" aria-labelledby="ready-room-title">
      <div className="ready-room-intro"><div><p className="eyebrow">SESSION</p><h2 id="ready-room-title">การฟังปัจจุบัน</h2><p>เสียงจากแอปที่เลือกจะถูกแปลและแสดงบน Overlay</p></div><span className={`ready-summary ${configured ? "is-ready" : "is-warning"}`}>{configured ? <Check /> : <TriangleAlert />}{configured ? "พร้อมใช้งาน" : "ต้องตั้งค่า"}</span></div>
      <div className="ready-primary-action"><div className="ready-primary-context"><small>แอปที่เลือก</small><strong>{settings.listeningSource?.displayName ?? "ยังไม่ได้เลือกแอป"}</strong><span>{runtime.listening ? "กำลังรับเสียงจากแอป" : configured ? "พร้อมเริ่มแปลเสียง" : "เลือกแอปเพื่อเริ่มฟัง"}</span></div><button className={`ready-listen-button ${runtime.listening ? "is-listening" : ""}`} disabled={busy === "listen" || previewMode || (!runtime.listening && !configured)} onClick={onToggleListening}>{busy === "listen" ? <LoaderCircle className="animate-spin" /> : runtime.listening ? <AudioLines /> : <Headphones />}<span>{runtime.listening ? "หยุดฟัง · F8" : "เริ่มฟัง · F8"}</span><small title={settings.listeningSource?.displayName}>{runtime.listening ? "หยุดการแปลเสียง" : "เปิด Overlay"}</small></button>{!configured && <div className="ready-action-hint"><strong>{!settings.listeningSource ? "เลือกแอปเพื่อเริ่ม" : !runtime.workerReady ? "กำลังเตรียมระบบเสียง" : "กำลังเชื่อมต่อบริการแปล"}</strong><span>{!settings.listeningSource ? "เลือกเกม Discord หรือเบราว์เซอร์ที่ต้องการฟัง" : runtime.lastError ?? "สถานะจะอัปเดตอัตโนมัติเมื่อพร้อม"}</span>{!settings.listeningSource && <button onClick={onOpenSourcePicker}>เลือกแอป <ChevronRight /></button>}</div>}</div>
      <div className="ready-source-list">
        <Row action="เปลี่ยน" icon={<Radio />} index={1} meterLabel="ระดับเสียงขาเข้า" meterValue={runtime.audioPeakDbfs} name={settings.listeningSource?.displayName ?? "ยังไม่ได้เลือกแอป"} onAction={onOpenSourcePicker} readiness={incoming} title="แหล่งเสียงที่ฟัง" />
        <Row action="ข้อมูล" actionHref={advancedHref("ai")} icon={<Cloud />} index={2} meterLabel="บริการแปล" meterText="พร้อมแปลอัตโนมัติ" name="บริการ AI กลาง" readiness={ai} title="การแปล" />
      </div>
      <section className="ready-recent" aria-labelledby="recent-title"><div className="ready-section-heading"><div><p className="eyebrow">LIVE MEMORY</p><h2 id="recent-title">บทสนทนาล่าสุด</h2></div><a href={settingsHref("history")}>ดูทั้งหมด <ChevronRight /></a></div>{recent ? <Recent item={recent} /> : <div className="ready-empty"><MessageSquareText /><div><strong>ยังไม่มีบทสนทนา</strong><span>ข้อความแรกจะปรากฏที่นี่เมื่อเริ่มฟัง</span></div></div>}</section>
    </section>
    <details className="ready-privacy"><summary><ShieldCheck />ความเป็นส่วนตัวและการส่งข้อมูล <ChevronRight /></summary><p>ส่งเฉพาะช่วงคำพูดและข้อความผ่านเซิร์ฟเวอร์ WANGAI ไปยัง AI provider ไม่บันทึกเนื้อหาบนเซิร์ฟเวอร์ เก็บสถิติการใช้งานด้วยรหัสติดตั้งแบบสุ่ม</p></details>
    <div className="ready-footer-actions"><a href={settingsHref("history")}><History />ประวัติ</a><a href={advancedHref("audio")}><Settings />การตั้งค่าขั้นสูง</a>{!webRuntime && onOpenWebCompanion && <button title={webCompanionOrigin} onClick={onOpenWebCompanion}><Globe2 />เปิด Web App</button>}{webRuntime && <span><Globe2 />Web Companion · เชื่อมต่อ Desktop</span>}{previewMode && <span>ข้อมูลจำลองสำหรับ Browser Preview</span>}</div>
  </div>;
}

function Row({ index, icon, title, name, readiness, meterLabel, meterValue, meterPercent, meterText, action, actionHref, onAction }: { index: number; icon: React.ReactNode; title: string; name: string; readiness: Readiness; meterLabel: string; meterValue?: number | null; meterPercent?: number; meterText?: string; action: string; actionHref?: string; onAction?: () => void }) {
  const percent = meterPercent ?? levelPercent(meterValue);
  return <article className={`ready-source-row tone-${readiness.tone}`}><span className="ready-step">{index}</span><span className="ready-source-icon">{icon}</span><div className="ready-source-name"><strong>{title}</strong><span title={name}>{name}</span></div><div className="ready-source-status"><span className="ready-status-icon">{readiness.tone === "ready" || readiness.tone === "waiting" ? <Check /> : <TriangleAlert />}</span><span><strong>{readiness.label}</strong><small>{readiness.detail}</small></span></div><div className="ready-meter-wrap"><span>{meterLabel}</span>{meterText ? <strong className="text-sm text-[#76dda0]">{meterText}</strong> : <div aria-label={meterLabel} aria-valuemax={100} aria-valuemin={0} aria-valuenow={Math.round(percent)} className="ready-meter" role="meter">{Array.from({ length: 18 }, (_, i) => <span className={i < Math.round((percent / 100) * 18) ? "is-active" : ""} key={i} />)}</div>}</div>{actionHref ? <a className="ready-change-button" href={actionHref}>{action}</a> : <button className="ready-change-button" onClick={onAction}>{action}</button>}</article>;
}

function Recent({ item }: { item: SubtitleItem }) {
  const source = item.stream === "microphone" ? "F9 REPLY" : item.sourceDisplayName ?? "INCOMING";
  return <article className="ready-conversation-row"><span className="ready-conversation-icon"><MessageSquareText /></span><time>{new Date(item.createdAtMs).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}</time><div><strong>{source}</strong><span>{item.originalText}</span></div><ChevronRight /><p>{item.translatedText ?? (item.status === "pending" ? "กำลังแปล…" : "แปลไม่สำเร็จ")}</p></article>;
}

function incomingReadiness(settings: AppSettings, runtime: RuntimeState): Readiness {
  if (!settings.listeningSource) return { label: "ต้องตั้งค่า", detail: "เลือกเกม Discord หรือ browser", tone: "setup" };
  if (!runtime.workerReady) return { label: "ตัวตรวจคำพูดยังไม่พร้อม", detail: runtime.lastError ? "พบข้อผิดพลาด กรุณาตรวจข้อความแจ้งเตือน" : "กำลังเตรียม Silero VAD", tone: runtime.lastError ? "warning" : "waiting" };
  if (!runtime.listening) return { label: "พร้อม", detail: "รอเริ่มฟัง", tone: "ready" };
  if (runtime.captureWarning) return { label: "ไม่ได้ยินเสียง", detail: "เปิดวิธีแก้ปัญหาเสียง", tone: "warning" };
  if (!runtime.attachedSource) return { label: "หาแอปไม่พบ", detail: `ตรวจว่า ${settings.listeningSource.displayName} ยังเปิดอยู่`, tone: "warning" };
  if (runtime.audioLastSeenAtMs == null) return { label: "รอเสียงจากแอป", detail: "กำลังเชื่อมต่อแหล่งเสียง", tone: "waiting" };
  if ((runtime.audioPeakDbfs ?? -96) <= -90) return { label: "ยังไม่ได้ยินเสียง", detail: "ตรวจว่าแอปกำลังเล่นเสียง", tone: "warning" };
  if (!runtime.vadActive) return { label: "กำลังฟัง", detail: settings.captureMode === "system_output" ? "รอคำพูดจากเสียงรวม" : "รอคำพูดจากแอป", tone: "waiting" };
  return { label: "กำลังตรวจพบคำพูด", detail: settings.captureMode === "system_output" ? "แหล่งข้อความจะแสดง MIXED" : `รับเสียงจาก ${settings.listeningSource.displayName}`, tone: "ready" };
}
function aiReadiness(runtime: RuntimeState): Readiness {
  const service = runtime.aiService;
  if (service.state === "offline") return { label: "เชื่อมต่อไม่ได้", detail: service.message, tone: "warning" };
  if (service.state === "degraded") return { label: service.retryAfterMs ? "กำลังพัก" : "บริการขัดข้อง", detail: service.message, tone: "warning" };
  if (service.state === "connecting") return { label: "กำลังเชื่อมต่อ", detail: service.message, tone: "waiting" };
  if (runtime.aiSttBusy) return { label: "กำลังแปล", detail: "กำลังประมวลผลวลีล่าสุด", tone: "ready" };
  return { label: service.state === "ready" ? "พร้อม" : "เชื่อมต่อแล้ว", detail: service.message, tone: "ready" };
}
function levelPercent(dbfs?: number | null): number { return dbfs == null ? 0 : Math.max(0, Math.min(100, ((dbfs + 60) / 60) * 100)); }
