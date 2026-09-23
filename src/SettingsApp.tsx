import { useCallback, useEffect, useState } from "react";
import { History, KeyRound, LoaderCircle, Power, RefreshCw, Save, Settings2, SlidersHorizontal, TriangleAlert, Volume2 } from "lucide-react";
import { api, type WebCompanionInfo } from "./api";
import { ProcessPickerDialog } from "./ProcessPickerDialog";
import { ReadyRoom } from "./ReadyRoom";
import { UpdatePanel } from "./UpdatePanel";
import { type AdvancedSection, type SettingsTab } from "./router";
import { isPreviewMode, previewOutputDevices, previewNotification, previewListeningBusy } from "./preview";
import { useRunningApps } from "./useRunningApps";
import type { AudioOutputDevice, HotkeySettings, OverlaySettings, SubtitleItem } from "./types";
import { errorText, useSnapshot } from "./useSnapshot";

const button = "settings-button settings-button-secondary inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-40";
const primary = "settings-button settings-button-primary inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-40";
const input = "settings-input min-h-11 min-w-0 w-full rounded-xl px-3 text-sm outline-none";
const hotkeyLabels: Record<keyof HotkeySettings, string> = {
  toggleListening: "เริ่มหรือหยุดฟัง",
  pushToTalk: "กดพูดเพื่อแปลตอบ",
  copyLatest: "คัดลอกคำตอบล่าสุด",
  editOverlay: "จัดตำแหน่ง Overlay",
};
const isDesktop = () => "__TAURI_INTERNALS__" in window;
const isWeb = () => !isDesktop() && !isPreviewMode();
type Toast = { kind: "ok" | "error"; text: string };

export function SettingsApp({ activeTab }: { activeTab: SettingsTab; advancedSection?: AdvancedSection }) {
  const { snapshot, refresh, loadingError } = useSnapshot();
  const [devices, setDevices] = useState<AudioOutputDevice[]>([]);
  const [picker, setPicker] = useState(false);
  const runningApps = useRunningApps(picker);
  const [busy, setBusy] = useState<string | undefined>(() => previewListeningBusy() ? "listen" : undefined);
  const [toast, setToast] = useState<Toast | undefined>(previewNotification);
  const [silenceSeconds, setSilenceSeconds] = useState("0.5");
  const [hotkeys, setHotkeys] = useState<HotkeySettings>();
  const [overlay, setOverlay] = useState<OverlaySettings>();
  const [webInfo, setWebInfo] = useState<WebCompanionInfo>();

  useEffect(() => {
    if (!snapshot) return;
    setSilenceSeconds((snapshot.settings.vad.silenceMs / 1000).toString());
    setHotkeys(snapshot.settings.hotkeys);
    setOverlay(snapshot.settings.overlay);
  }, [snapshot?.settings]);

  const loadDevices = useCallback(async () => {
    try { setDevices(isPreviewMode() ? previewOutputDevices : await api.listOutputDevices()); }
    catch (error) { setToast({ kind: "error", text: errorText(error) }); }
  }, []);
  useEffect(() => { void loadDevices(); }, [loadDevices]);
  useEffect(() => { if (isDesktop()) void api.getWebCompanionInfo().then(setWebInfo).catch(() => undefined); }, []);

  const run = async (key: string, task: () => Promise<unknown>, ok: string) => {
    setBusy(key); setToast(undefined);
    try { await task(); await refresh(); setToast({ kind: "ok", text: ok }); }
    catch (error) { setToast({ kind: "error", text: errorText(error) }); }
    finally { setBusy(undefined); }
  };

  if (!snapshot || !hotkeys || !overlay) return <main className="settings-app grid min-h-screen place-content-center gap-4 p-6">
    {loadingError ? <section className="w-full max-w-xl space-y-4 rounded-2xl border p-6">
      <p role="alert" className="font-bold">ยังเปิด WANGAI ไม่สำเร็จ</p>
      <p className="text-sm text-[#a9afb8]">ลองโหลดข้อมูลอีกครั้งได้ โดยไม่ต้องปิดโปรแกรมหรือลบการตั้งค่า</p>
      <button autoFocus className={primary} onClick={() => void refresh()}><RefreshCw />ลองใหม่</button>
      <details className="text-sm text-[#a9afb8]"><summary>รายละเอียดข้อผิดพลาด</summary><p className="mt-2 break-words">{loadingError}</p></details>
    </section> : <><LoaderCircle aria-hidden="true" className="animate-spin" /><p role="status">กำลังเปิด WANGAI</p></>}
  </main>;
  const { settings, runtime } = snapshot;
  const silenceValue = Number(silenceSeconds);
  const validSilence = silenceSeconds.trim() !== "" && Number.isFinite(silenceValue) && silenceValue >= 0.25 && silenceValue <= 2;
  const notice = runtime.lastError ? { kind: "error", text: runtime.lastError } : toast;
  const notification = notice && <div role={notice.kind === "error" ? "alert" : "status"} className={`settings-notification rounded-xl border px-4 py-3 text-sm ${notice.kind === "error" ? "border-red-400/30 bg-red-400/10 text-red-200" : "border-[#63c48b]/30 bg-[#63c48b]/10 text-[#8bf0b1]"}`}>{notice.text}</div>;

  const showView = (kind: "history" | "settings") => {
    window.location.hash = kind === "history" ? "#/settings/history" : "#/settings/advanced";
  };
  const utility = activeTab !== "overview";
  return <main className={`settings-app settings-one-page ${utility ? "settings-utility" : "settings-control"}`}>
    {!utility && <><header className="settings-toolbar"><div className="settings-top-brand"><span className="settings-brand-key">W</span><span>WANGAI<small>LIVE TRANSLATION</small></span></div><div className="settings-toolbar-actions"><button aria-label="ประวัติคำแปล" className="settings-top-action" onClick={() => showView("history")}><History />ประวัติ</button><button aria-label="ตั้งค่า" className="settings-top-action" onClick={() => showView("settings")}><Settings2 />ตั้งค่า</button></div></header><div className="settings-workspace"><div className="settings-content"><UpdatePanel compact /><ReadyRoom notification={notification} settings={settings} runtime={runtime} busy={busy} previewMode={isPreviewMode()} showSecondary={false} onToggleListening={() => void run("listen", runtime.listening ? api.toggleListening : api.startSession, runtime.listening ? "หยุดใช้งานแล้ว" : "เริ่มใช้งานแล้ว")} onOpenSourcePicker={() => setPicker(true)} webRuntime={isWeb()} /></div></div></>}
    {utility && <><header className="utility-header"><div><span className="settings-toolbar-eyebrow">WANGAI</span><h1>{activeTab === "history" ? "ประวัติคำแปล" : "ตั้งค่า"}</h1></div><div className="utility-header-actions">{runtime.listening && (isDesktop() || isPreviewMode()) && <button className="settings-toolbar-back" onClick={() => { if (isPreviewMode()) { window.location.hash = "#/overlay"; return; } void api.startSession().catch((error) => setToast({ kind: "error", text: errorText(error) })); }}>กลับไป Overlay</button>}<a className="settings-toolbar-back" href="#/settings/overview">กลับหน้าหลัก</a></div></header><div className="utility-content">{notification}
    {activeTab === "history" && <HistoryView history={snapshot.history} />}
    {activeTab === "advanced" && <div className="settings-direct-grid">
      <section className="settings-direct-card" aria-labelledby="settings-sound-title">
        <header><Volume2 aria-hidden="true" /><div><h2 id="settings-sound-title">เสียง</h2><p>กำหนดจังหวะการแปลและแหล่งเสียง</p></div></header>
        <label className="settings-direct-label" htmlFor="silence-seconds">จบประโยคเมื่อเงียบ</label>
        <div className="settings-duration-input"><input id="silence-seconds" type="number" inputMode="decimal" min="0.25" max="2" step="0.05" value={silenceSeconds} onChange={(event) => setSilenceSeconds(event.target.value)} /><span>วินาที</span></div>
        <p className="settings-direct-hint">0.25–2 วินาที · ค่ายิ่งสูงจะรอจบคำพูดนานขึ้นก่อนแปล</p>
        {!validSilence && <p className="settings-field-error" role="alert">ใส่ค่าระหว่าง 0.25 ถึง 2 วินาที</p>}
        <button className={button} disabled={!validSilence || busy === "vad"} onClick={() => void run("vad", () => api.updateVad({ ...settings.vad, silenceMs: Math.round(silenceValue * 1000) }), "บันทึกเวลาจบประโยคแล้ว")}><Save />บันทึกเวลา</button>
        <label className="settings-direct-label" htmlFor="capture-mode">รับเสียงจาก</label>
        <select className={input} id="capture-mode" value={settings.captureMode} onChange={(event) => void run("mode", () => api.updateCaptureMode(event.target.value as "process_tree" | "system_output"), "เปลี่ยนวิธีรับเสียงแล้ว")}><option value="process_tree">เฉพาะแอปที่เลือก</option><option value="system_output">เสียงทั้งเครื่อง (เมื่อเสียงจากแอปไม่เข้า)</option></select>
        {settings.captureMode === "system_output" && <label className="settings-direct-label" htmlFor="output-device">อุปกรณ์เสียงที่ฟัง<select className={`${input} mt-2`} id="output-device" value={settings.outputDeviceId ?? ""} onChange={(event) => void run("device", () => api.updateOutputDevice(event.target.value || undefined), "เปลี่ยนอุปกรณ์เสียงแล้ว")}><option value="">อุปกรณ์หลักของ Windows</option>{devices.map((device) => <option key={device.id} value={device.id}>{device.name}{device.isDefault ? " (หลัก)" : ""}</option>)}</select></label>}
        {runtime.captureWarning && <p className="settings-audio-help-warning"><TriangleAlert aria-hidden="true" />{runtime.captureWarning}</p>}
        {!runtime.workerReady && <button className={button} disabled={busy === "worker"} onClick={() => void run("worker", api.restartWorker, "เริ่มตัวตรวจคำพูดใหม่แล้ว")}><RefreshCw />เริ่มตัวตรวจคำพูดใหม่</button>}
      </section>
      <section className="settings-direct-card" aria-labelledby="settings-overlay-title">
        <header><SlidersHorizontal aria-hidden="true" /><div><h2 id="settings-overlay-title">Overlay</h2><p>ปรับการแสดงคำแปลขณะเล่น</p></div></header>
        <Slider label="ความทึบ" min={0.2} max={1} step={0.05} value={overlay.opacity} display={`${Math.round(overlay.opacity * 100)}%`} onChange={(value) => setOverlay({ ...overlay, opacity: value })} />
        <Slider label="จำนวนคำแปลที่แสดง" min={1} max={5} step={1} value={overlay.maxItems} display={`${overlay.maxItems} ข้อความ`} onChange={(value) => setOverlay({ ...overlay, maxItems: value })} />
        <button className={button} disabled={busy === "overlay"} onClick={() => void run("overlay", () => api.updateOverlay(overlay), "บันทึกการแสดงผลแล้ว")}><Save />บันทึก Overlay</button>
      </section>
      <section className="settings-direct-card settings-hotkey-card" aria-labelledby="settings-hotkey-title">
        <header><KeyRound aria-hidden="true" /><div><h2 id="settings-hotkey-title">ปุ่มลัด</h2><p>ใช้ควบคุมระหว่างเล่นเกม</p></div></header>
        <div className="settings-hotkey-grid">{Object.entries(hotkeys).map(([key, value]) => <label className="settings-hotkey-label" key={key}>{hotkeyLabels[key as keyof HotkeySettings]}<input className={input} value={value} onChange={(event) => setHotkeys({ ...hotkeys, [key]: event.target.value })} /></label>)}</div>
        <button className={button} disabled={busy === "hotkeys"} onClick={() => void run("hotkeys", () => api.updateHotkeys(hotkeys), "บันทึกปุ่มลัดแล้ว")}><Save />บันทึกปุ่มลัด</button>
      </section>
      <details className="settings-diagnostics settings-direct-footer"><summary>ข้อมูลโปรแกรมและความเป็นส่วนตัว</summary><p className="settings-privacy-copy">ส่งเฉพาะช่วงคำพูดและข้อความผ่านเซิร์ฟเวอร์ WANGAI ไปยัง AI provider ไม่บันทึกเนื้อหาบนเซิร์ฟเวอร์ เก็บสถิติการใช้งานด้วยรหัสติดตั้งแบบสุ่ม</p>{isDesktop() && <div className="settings-privacy-actions"><button className={button} title={webInfo?.origin} onClick={() => void run("web", api.openWebCompanion, "เปิด Web App แล้ว")}>เปิด Web Companion</button><button className={button} onClick={() => void api.quitApp().catch((error) => setToast({ kind: "error", text: errorText(error) }))}><Power className="size-4" />ออกจากโปรแกรม</button></div>}</details>
    </div>}
    </div></>}
    {picker && <ProcessPickerDialog apps={runningApps.apps} loading={runningApps.loading} error={runningApps.error} previewMode={isPreviewMode()} selected={settings.listeningSource} onClose={() => setPicker(false)} onRefresh={runningApps.refresh} onSelect={async (source) => { await api.selectListeningSource(source); await refresh(); setToast({ kind: "ok", text: `เลือก ${source.displayName} แล้ว` }); setPicker(false); }} onClear={async () => { await api.clearListeningSource(); await refresh(); setToast({ kind: "ok", text: "ล้างการเลือกแอปแล้ว" }); setPicker(false); }} />}
  </main>;
}

function Slider({ label, min, max, step, value, display, onChange }: { label: string; min: number; max: number; step: number; value: number; display: string; onChange: (value: number) => void }) { return <label className="text-sm"><span className="flex justify-between"><span>{label}</span><strong className="settings-value">{display}</strong></span><input className="mt-3 w-full" min={min} max={max} step={step} type="range" value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>; }
function HistoryView({ history }: { history: SubtitleItem[] }) { return <section className="settings-history"><div className="settings-history-heading"><div><p className="eyebrow">บทสนทนา</p><h2>คำแปลในรอบนี้</h2></div><span>{history.length} รายการ</span></div><div className="settings-history-list">{history.map((item) => <article className="settings-history-item" key={item.segmentId}><div className="settings-history-meta"><span>{item.stream === "microphone" ? "F9 ตอบกลับ" : item.sourceDisplayName ?? "เสียงขาเข้า"}</span><time>{new Date(item.createdAtMs).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}</time></div><div className="settings-history-copy"><p lang={item.originalLanguage}>{item.originalText}</p><strong>{item.translatedText ?? "กำลังแปล…"}</strong></div></article>)}{history.length === 0 && <p className="settings-history-empty">ยังไม่มีคำแปลในรอบนี้ · เริ่มใช้งานแล้วข้อความจะปรากฏที่นี่</p>}</div></section>; }
