import { useCallback, useEffect, useRef, useState } from "react";
import { AudioLines, Cpu, History, KeyRound, LoaderCircle, Power, RefreshCw, Save, Settings2, SlidersHorizontal, TriangleAlert, Volume2, X } from "lucide-react";
import { api, type WebCompanionInfo } from "./api";
import { ProcessPickerDialog } from "./ProcessPickerDialog";
import { ReadyRoom } from "./ReadyRoom";
import { UpdatePanel } from "./UpdatePanel";
import { type AdvancedSection, type SettingsTab } from "./router";
import { isPreviewMode, previewOutputDevices, previewNotification, previewListeningBusy } from "./preview";
import { useRunningApps } from "./useRunningApps";
import type { AudioOutputDevice, HotkeySettings, OverlaySettings, SubtitleItem, VadSettings } from "./types";
import { errorText, useSnapshot } from "./useSnapshot";

const button = "settings-button settings-button-secondary inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-40";
const primary = "settings-button settings-button-primary inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-40";
const input = "settings-input min-h-11 min-w-0 w-full rounded-xl px-3 text-sm outline-none";
const hotkeyLabels: Record<keyof HotkeySettings, string> = {
  toggleListening: "เริ่มหรือหยุดฟัง",
  pushToTalk: "กดพูดเพื่อแปลตอบ",
  copyLatest: "คัดลอกคำตอบล่าสุด",
  editOverlay: "ย้ายหรือปรับ Overlay",
};
const isDesktop = () => "__TAURI_INTERNALS__" in window;
const isWeb = () => !isDesktop() && !isPreviewMode();
type Toast = { kind: "ok" | "error"; text: string };

export function SettingsApp({ activeTab, advancedSection = "audio" }: { activeTab: SettingsTab; advancedSection?: AdvancedSection }) {
  const { snapshot, refresh, loadingError } = useSnapshot();
  const [panel, setPanel] = useState<"history" | "settings" | null>(() => activeTab === "overview" ? null : activeTab === "history" ? "history" : "settings");
  const [devices, setDevices] = useState<AudioOutputDevice[]>([]);
  const [picker, setPicker] = useState(false);
  const runningApps = useRunningApps(picker);
  const [busy, setBusy] = useState<string | undefined>(() => previewListeningBusy() ? "listen" : undefined);
  const [toast, setToast] = useState<Toast | undefined>(previewNotification);
  const [vad, setVad] = useState<VadSettings>();
  const [hotkeys, setHotkeys] = useState<HotkeySettings>();
  const [overlay, setOverlay] = useState<OverlaySettings>();
  const [webInfo, setWebInfo] = useState<WebCompanionInfo>();
  const sheetRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { setPanel(activeTab === "overview" ? null : activeTab === "history" ? "history" : "settings"); }, [activeTab, advancedSection]);
  useEffect(() => {
    if (!panel) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    return () => { if (previousFocus?.isConnected) previousFocus.focus(); };
  }, [panel]);
  useEffect(() => {
    if (!panel) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (picker) return;
      if (event.key === "Escape") { event.preventDefault(); setPanel(null); }
      if (event.key !== "Tab") return;
      const focusable = [...(sheetRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), summary') ?? [])].filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [panel, picker]);

  useEffect(() => {
    if (!snapshot) return;
    setVad(snapshot.settings.vad);
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

  if (!snapshot || !vad || !hotkeys || !overlay) return <main className="settings-app grid min-h-screen place-content-center gap-4 p-6">
    {loadingError ? <section className="w-full max-w-xl space-y-4 rounded-2xl border p-6">
      <p role="alert" className="font-bold">ยังเปิด WANGAI ไม่สำเร็จ</p>
      <p className="text-sm text-[#a9afb8]">ลองโหลดข้อมูลอีกครั้งได้ โดยไม่ต้องปิดโปรแกรมหรือลบการตั้งค่า</p>
      <button autoFocus className={primary} onClick={() => void refresh()}><RefreshCw />ลองใหม่</button>
      <details className="text-sm text-[#a9afb8]"><summary>รายละเอียดข้อผิดพลาด</summary><p className="mt-2 break-words">{loadingError}</p></details>
    </section> : <><LoaderCircle aria-hidden="true" className="animate-spin" /><p role="status">กำลังเปิด WANGAI</p></>}
  </main>;
  const { settings, runtime } = snapshot;
  const profileKey = settings.captureMode === "process_tree" ? "processTree" : "systemOutput";
  const profile = vad[profileKey];
  const notice = runtime.lastError ? { kind: "error", text: runtime.lastError } : toast;
  const notification = notice && <div role={notice.kind === "error" ? "alert" : "status"} className={`settings-notification rounded-xl border px-4 py-3 text-sm ${notice.kind === "error" ? "border-red-400/30 bg-red-400/10 text-red-200" : "border-[#63c48b]/30 bg-[#63c48b]/10 text-[#8bf0b1]"}`}>{notice.text}</div>;

  return <main className="settings-app settings-shell settings-one-page">
    <header className="settings-toolbar"><div className="settings-top-brand"><span className="settings-brand-key">W</span><span>WANGAI<small>LIVE TRANSLATION</small></span></div><div className="settings-toolbar-actions"><span className="settings-top-status"><span className={`settings-sidebar-dot ${runtime.lastError || runtime.captureWarning || !settings.listeningSource ? "is-warning" : ""}`} />{!settings.listeningSource ? "ยังไม่ได้เลือกแอป" : runtime.lastError || runtime.captureWarning ? "ต้องตรวจสอบ" : runtime.listening ? "กำลังฟัง" : "พร้อมเริ่มฟัง"}</span><button aria-label="ประวัติคำแปล" className="settings-top-action" onClick={() => setPanel("history")}><History />ประวัติ</button><button aria-label="ตั้งค่า" className="settings-top-action" onClick={() => setPanel("settings")}><Settings2 />ตั้งค่า</button>{isDesktop() && <button className="settings-quit" onClick={() => void api.quitApp().catch((error) => setToast({ kind: "error", text: errorText(error) }))}><Power className="size-4" />ออกจากโปรแกรม</button>}</div></header>
    <div className="settings-workspace"><div className="settings-content">
    {panel !== "settings" && <UpdatePanel compact />}
    <ReadyRoom notification={notification} settings={settings} runtime={runtime} busy={busy} previewMode={isPreviewMode()} showSecondary={false} onToggleListening={() => void run("listen", api.toggleListening, runtime.listening ? "หยุดฟังแล้ว" : "เริ่มฟังแล้ว")} onOpenSourcePicker={() => setPicker(true)} webRuntime={isWeb()} />
    {panel && <div className="settings-sheet-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !picker) setPanel(null); }}><section aria-label={panel === "history" ? "ประวัติคำแปล" : "ตั้งค่า"} aria-modal="true" className="settings-sheet" ref={sheetRef} role="dialog"><header className="settings-sheet-header"><div><span className="settings-toolbar-eyebrow">WANGAI / {panel === "history" ? "HISTORY" : "SETTINGS"}</span><h2>{panel === "history" ? "ประวัติคำแปล" : "ตั้งค่า"}</h2></div><button aria-label="ปิดแผง" className="settings-sheet-close" onClick={() => setPanel(null)} ref={closeRef}><X /></button></header><div className="settings-sheet-body">
    {panel === "history" && <HistoryView history={snapshot.history} />}
    {panel === "settings" && <div className="settings-sheet-sections">
      <section className="space-y-4">
        <Card title="แอปที่ฟัง" icon={<AudioLines />} subtitle="เลือกเกมหรือแอปหนึ่งตัวสำหรับแปลเสียง"><div className="settings-source-choice"><div><small>{settings.listeningSource ? "แอปที่เลือก" : "แหล่งเสียง"}</small><strong>{settings.listeningSource?.displayName ?? "ยังไม่ได้เลือกแอป"}</strong></div><div className="settings-source-actions"><button className={button} onClick={() => setPicker(true)}>{settings.listeningSource ? "เปลี่ยนแอป" : "เลือกแอป"}</button>{settings.listeningSource && <button className={button} disabled={busy === "clear-source" || isPreviewMode()} onClick={() => void run("clear-source", api.clearListeningSource, "ล้างแหล่งเสียงแล้ว")}>ล้างการเลือก</button>}</div></div></Card>
        <details className="settings-diagnostics"><summary><Volume2 />ตรวจสอบเสียงเมื่อมีปัญหา<span>ดูสถานะและเครื่องมือวินิจฉัย</span></summary><Card title="Incoming audio diagnostics" icon={<Volume2 />} subtitle="มี capture, ring, cursor, VAD และ AI queue เพียงชุดเดียว">
          <div className="grid gap-3 md:grid-cols-2"><Info label="แอปที่เลือก" value={settings.listeningSource?.displayName ?? "ยังไม่ได้เลือก"} /><Info label="สถานะ" value={runtime.statusMessage} /><Info label="PID ที่จับจริง" value={runtime.effectiveCapturePid?.toString() ?? "—"} /><Info label="Peak" value={runtime.audioPeakDbfs == null ? "ยังไม่มี audio frame" : `${runtime.audioPeakDbfs.toFixed(1)} dBFS`} /><Info label="VAD" value={runtime.vadActive ? "กำลังตรวจพบคำพูด" : "ยังไม่พบคำพูด"} /><Info label="Source badge" value={settings.captureMode === "system_output" ? "MIXED" : settings.listeningSource?.displayName?.toUpperCase() ?? "INCOMING"} /></div>
          {runtime.captureWarning && <p className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100"><TriangleAlert className="mr-2 inline size-4" />{runtime.captureWarning}</p>}
          <div className="mt-4 flex flex-wrap gap-2"><button className={button} onClick={() => setPicker(true)}>เปลี่ยนแอป</button><button className={button} disabled={busy === "probe"} onClick={() => void run("probe", api.probeRecentAudio, "ส่งเสียง 6 วินาทีล่าสุดไปตรวจแล้ว")}>ตรวจเสียง 6 วินาที</button><button className={button} onClick={() => void run("worker", api.restartWorker, "Restart worker แล้ว")}><RefreshCw />Restart worker</button></div>
        </Card></details>
        <details className="settings-diagnostics settings-tuning"><summary><Cpu />ตัวเลือกเสียงขั้นสูง<span>วิธีจับเสียงและความไวในการตรวจคำพูด</span></summary><div className="settings-tuning-content"><Card title="Capture mode" icon={<Cpu />} subtitle="Process Tree จับเฉพาะแอป; System Output เป็น fallback และแสดง MIXED">
          <div className="grid gap-3 md:grid-cols-2"><button className={settings.captureMode === "process_tree" ? primary : button} onClick={() => void run("mode", () => api.updateCaptureMode("process_tree"), "ใช้ Process Tree แล้ว")}>Process Tree</button><button className={settings.captureMode === "system_output" ? primary : button} onClick={() => void run("mode", () => api.updateCaptureMode("system_output"), "ใช้ System Output แล้ว")}>System Output fallback</button></div>
          {settings.captureMode === "system_output" && <label className="mt-4 block text-sm">Output endpoint<select className={`${input} mt-2`} value={settings.outputDeviceId ?? ""} onChange={(event) => void run("device", () => api.updateOutputDevice(event.target.value || undefined), "เปลี่ยน output endpoint แล้ว")}><option value="">Windows default</option>{devices.map((device) => <option key={device.id} value={device.id}>{device.name}{device.isDefault ? " (default)" : ""}</option>)}</select></label>}
          <label className="mt-4 flex items-center gap-3 text-sm"><input checked={settings.rescueScanEnabled} type="checkbox" onChange={(event) => void run("rescue", () => api.updateRescueScan(event.target.checked), event.target.checked ? "เปิด Rescue Scan แล้ว" : "ปิด Rescue Scan แล้ว")} />Rescue Scan (ปิดเป็นค่าเริ่มต้น)</label>
        </Card>
        <Card title="Local Silero VAD" icon={<Cpu />} subtitle={`โปรไฟล์ ${settings.captureMode === "process_tree" ? "Process Tree" : "System Output"} จำค่าแยกกัน`}>
          <div className="grid gap-5 md:grid-cols-2"><Slider label="VAD threshold" min={0.05} max={0.9} step={0.05} value={profile.vadThreshold} display={profile.vadThreshold.toFixed(2)} onChange={(value) => setVad({ ...vad, [profileKey]: { ...profile, vadThreshold: value } })} /><Slider label="VAD gain" min={0} max={18} step={1} value={profile.gainDb} display={`+${profile.gainDb} dB`} onChange={(value) => setVad({ ...vad, [profileKey]: { ...profile, gainDb: value } })} /><Slider label="จบเมื่อเงียบ" min={200} max={1500} step={100} value={vad.silenceMs} display={`${vad.silenceMs} ms`} onChange={(value) => setVad({ ...vad, silenceMs: value })} /><Slider label="Pre-roll" min={0} max={1000} step={50} value={vad.preRollMs} display={`${vad.preRollMs} ms`} onChange={(value) => setVad({ ...vad, preRollMs: value })} /></div><button className={`${primary} mt-5`} onClick={() => void run("vad", () => api.updateVad(vad), "บันทึก VAD แล้ว")}><Save />บันทึกและ Restart</button>
        </Card></div></details>
      </section>
      <details className="settings-diagnostics settings-controls" open={activeTab === "advanced" && advancedSection === "controls" ? true : undefined}><summary><KeyRound />ปุ่มลัดและ Overlay<span>ปรับเมื่อต้องการ</span></summary><div className="settings-tuning-content"><Card title="ปุ่มลัด" icon={<KeyRound />} subtitle="ควบคุมการฟังและ Overlay ระหว่างเล่นเกม"><div className="grid gap-3 md:grid-cols-2">{Object.entries(hotkeys).map(([key, value]) => <label className="settings-hotkey-label text-sm" key={key}>{hotkeyLabels[key as keyof HotkeySettings]}<input className={`${input} mt-1`} value={value} onChange={(event) => setHotkeys({ ...hotkeys, [key]: event.target.value })} /></label>)}</div><button className={`${primary} mt-4`} onClick={() => void run("hotkeys", () => api.updateHotkeys(hotkeys), "บันทึกปุ่มลัดแล้ว")}>บันทึกปุ่มลัด</button></Card><Card title="Overlay" icon={<SlidersHorizontal />} subtitle="ตั้งค่าหน้าต่างคำแปลในเกม"><div className="grid gap-5 md:grid-cols-2"><Slider label="ความทึบของ Overlay" min={0.2} max={1} step={0.05} value={overlay.opacity} display={`${Math.round(overlay.opacity * 100)}%`} onChange={(value) => setOverlay({ ...overlay, opacity: value })} /><Slider label="จำนวนข้อความ" min={1} max={5} step={1} value={overlay.maxItems} display={`${overlay.maxItems}`} onChange={(value) => setOverlay({ ...overlay, maxItems: value })} /></div><button className={`${primary} mt-4`} onClick={() => void run("overlay", () => api.updateOverlay(overlay), "บันทึก Overlay แล้ว")}>บันทึก Overlay</button></Card><UpdatePanel /></div></details>
      <details className="settings-diagnostics"><summary>ข้อมูลโปรแกรมและความเป็นส่วนตัว</summary><p className="settings-privacy-copy">ส่งเฉพาะช่วงคำพูดและข้อความผ่านเซิร์ฟเวอร์ WANGAI ไปยัง AI provider ไม่บันทึกเนื้อหาบนเซิร์ฟเวอร์ เก็บสถิติการใช้งานด้วยรหัสติดตั้งแบบสุ่ม</p>{isDesktop() && <div className="settings-privacy-actions"><button className={button} title={webInfo?.origin} onClick={() => void run("web", api.openWebCompanion, "เปิด Web App แล้ว")}>เปิด Web Companion</button></div>}</details>
    </div>}
    </div></section></div>}
    {picker && <ProcessPickerDialog apps={runningApps.apps} loading={runningApps.loading} error={runningApps.error} previewMode={isPreviewMode()} selected={settings.listeningSource} onClose={() => setPicker(false)} onRefresh={runningApps.refresh} onSelect={async (source) => { await api.selectListeningSource(source); await refresh(); setToast({ kind: "ok", text: `เลือก ${source.displayName} แล้ว` }); setPicker(false); }} />}
    </div></div>
  </main>;
}

function Card({ title, subtitle, icon, children }: { title: string; subtitle: string; icon: React.ReactNode; children: React.ReactNode }) { return <section className="settings-card p-5"><header className="mb-5 flex gap-3"><span className="settings-card-icon grid size-10 place-items-center rounded-xl">{icon}</span><div><h2 className="font-bold">{title}</h2><p className="text-xs">{subtitle}</p></div></header>{children}</section>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="settings-info min-w-0 rounded-xl p-3"><small>{label}</small><p className="mt-1 break-all text-sm font-semibold">{value}</p></div>; }
function Slider({ label, min, max, step, value, display, onChange }: { label: string; min: number; max: number; step: number; value: number; display: string; onChange: (value: number) => void }) { return <label className="text-sm"><span className="flex justify-between"><span>{label}</span><strong className="settings-value">{display}</strong></span><input className="mt-3 w-full" min={min} max={max} step={step} type="range" value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>; }
function HistoryView({ history }: { history: SubtitleItem[] }) { return <section className="settings-history"><div className="settings-history-heading"><div><p className="eyebrow">บทสนทนา</p><h2>คำแปลในรอบนี้</h2></div><span>{history.length} รายการ</span></div><div className="settings-history-list">{history.map((item) => <article className="settings-history-item" key={item.segmentId}><div className="settings-history-meta"><span>{item.stream === "microphone" ? "F9 ตอบกลับ" : item.sourceDisplayName ?? "เสียงขาเข้า"}</span><time>{new Date(item.createdAtMs).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}</time></div><div className="settings-history-copy"><p lang={item.originalLanguage}>{item.originalText}</p><strong>{item.translatedText ?? "กำลังแปล…"}</strong></div></article>)}{history.length === 0 && <p className="settings-history-empty">ยังไม่มีคำแปลในรอบนี้ · เริ่มฟังแล้วข้อความจะปรากฏที่นี่</p>}</div></section>; }
