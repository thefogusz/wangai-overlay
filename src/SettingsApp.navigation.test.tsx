import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { SettingsApp } from "./SettingsApp";
import { snapshotFixture } from "./test/fixtures";
import { useSnapshot } from "./useSnapshot";
import { api } from "./api";

vi.mock("./useSnapshot", () => ({
  useSnapshot: vi.fn(),
  errorText: (error: unknown) => String(error),
}));
vi.mock("./api", () => ({
  api: {
    listRunningApps: vi.fn().mockResolvedValue([]),
    listOutputDevices: vi.fn().mockResolvedValue([]),
    startSession: vi.fn().mockResolvedValue(true),
    toggleListening: vi.fn().mockResolvedValue(false),
    clearListeningSource: vi.fn().mockResolvedValue(undefined),
    restartWorker: vi.fn().mockResolvedValue(undefined),
    updateVad: vi.fn().mockResolvedValue(undefined),
    updateOverlay: vi.fn().mockResolvedValue(undefined),
    updateHotkeys: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("settings with nullable desktop audio diagnostics", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/#/settings/overview");
    const snapshot = snapshotFixture();
    // Rust serializes Option::None as JSON null, rather than omitting these fields.
    Object.assign(snapshot.runtime, {
      audioPeakDbfs: null,
      audioRmsDbfs: null,
      audioLastSeenAtMs: null,
      effectiveCapturePid: null,
    });
    vi.mocked(useSnapshot).mockReturnValue({ snapshot, setSnapshot: vi.fn(), refresh: vi.fn(), loadingError: undefined });
  });
  afterEach(() => {
    cleanup();
    window.history.replaceState(null, "", "/");
  });

  it("replaces the control view with settings in the same window", async () => {
    render(<App />);
    expect(screen.getByRole("meter", { name: "ระดับเสียงขาเข้า" })).toHaveAttribute("aria-valuenow", "0");
    expect(screen.getByText("รอเสียงจากแอป")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "ตั้งค่า" }));
    expect(window.location.hash).toBe("#/settings/advanced");
    expect(screen.queryByRole("dialog", { name: "ตั้งค่า" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "กำลังแปลเสียง" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "ตั้งค่า" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "เสียง" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Overlay" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "ปุ่มลัด" })).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "จบประโยคเมื่อเงียบ" })).toHaveValue(0.5);
    expect(screen.queryByText("แก้ปัญหาเสียง")).not.toBeInTheDocument();
    expect(screen.queryByText("ตัวเลือกเสียงขั้นสูง")).not.toBeInTheDocument();
    expect(screen.queryByText("VAD threshold")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "กำลังแปลเสียง" })).not.toBeInTheDocument();
  });

  it("starts the desktop session from the single-line primary action", async () => {
    const snapshot = vi.mocked(useSnapshot)().snapshot!;
    snapshot.runtime.listening = false;
    render(<SettingsApp activeTab="overview" />);
    fireEvent.click(screen.getByRole("button", { name: "เริ่มใช้งาน" }));
    expect(api.startSession).toHaveBeenCalledOnce();
    expect(await screen.findByText("เริ่มใช้งานแล้ว")).toBeInTheDocument();
  });

  it("shows history in the same window without a covering dialog", async () => {
    render(<App />);
    const history = screen.getByRole("button", { name: "ประวัติคำแปล" });
    history.focus();
    fireEvent.click(history);
    expect(window.location.hash).toBe("#/settings/history");
    expect(screen.queryByRole("dialog", { name: "ประวัติคำแปล" })).not.toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "คำแปลในรอบนี้" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "กำลังแปลเสียง" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "กลับหน้าหลัก" }));
    expect(await screen.findByRole("region", { name: "กำลังแปลเสียง" })).toBeInTheDocument();
  });

  it("accepts seconds directly and keeps values outside the safe range unsaved", async () => {
    render(<SettingsApp activeTab="advanced" />);
    const seconds = screen.getByRole("spinbutton", { name: "จบประโยคเมื่อเงียบ" });
    fireEvent.change(seconds, { target: { value: "10" } });
    expect(screen.getByRole("button", { name: "บันทึกเวลา" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("0.25 ถึง 2 วินาที");
    fireEvent.change(seconds, { target: { value: "1.2" } });
    fireEvent.click(screen.getByRole("button", { name: "บันทึกเวลา" }));
    expect(api.updateVad).toHaveBeenCalledWith(expect.objectContaining({ silenceMs: 1200 }));
  });

  it("returns from settings to the overlay without another settings section", () => {
    window.history.replaceState(null, "", "/?preview=1#/settings/advanced");
    render(<SettingsApp activeTab="advanced" />);
    fireEvent.click(screen.getByRole("button", { name: "กลับไป Overlay" }));
    expect(window.location.hash).toBe("#/overlay");
  });

  it("keeps app selection on the main view and clearing inside its picker", () => {
    const snapshot = vi.mocked(useSnapshot)().snapshot!;
    const view = render(<SettingsApp activeTab="advanced" advancedSection="audio" />);
    expect(screen.queryByRole("button", { name: "เปลี่ยนแอป" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ล้างการเลือก" })).not.toBeInTheDocument();
    view.rerender(<SettingsApp activeTab="overview" />);
    fireEvent.click(screen.getByRole("button", { name: "เปลี่ยน" }));
    expect(screen.getByRole("button", { name: "ล้างการเลือก" })).toBeInTheDocument();
    snapshot.settings.listeningSource = undefined;
    view.rerender(<SettingsApp activeTab="overview" />);
    expect(screen.queryByRole("button", { name: "ล้างการเลือก" })).not.toBeInTheDocument();
  });

  it("offers a worker restart only when speech detection is unavailable", () => {
    const snapshot = vi.mocked(useSnapshot)().snapshot!;
    const view = render(<SettingsApp activeTab="advanced" />);
    expect(screen.queryByRole("button", { name: "เริ่มตัวตรวจคำพูดใหม่" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ตรวจเสียง 6 วินาที" })).not.toBeInTheDocument();
    snapshot.runtime.workerReady = false;
    view.rerender(<SettingsApp activeTab="advanced" />);
    fireEvent.click(screen.getByRole("button", { name: "เริ่มตัวตรวจคำพูดใหม่" }));
    expect(api.restartWorker).toHaveBeenCalledOnce();
  });

  it("shows a worker protocol failure on Ready Room and Advanced instead of only a success notice", async () => {
    const snapshot = vi.mocked(useSnapshot)().snapshot!;
    const message = "ข้อมูลจากตัวตรวจคำพูดไม่ตรงกับแอป กรุณาเปิด WANGAI จากชุด Portable เดียวกัน";
    Object.assign(snapshot.runtime, { workerReady: false, lastError: message });
    const view = render(<SettingsApp activeTab="overview" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByText("ตัวตรวจคำพูดยังไม่พร้อม")).toBeInTheDocument();
    expect(screen.queryByText("ต้องตรวจสอบ")).not.toBeInTheDocument();
    view.rerender(<SettingsApp activeTab="advanced" advancedSection="audio" />);
    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(screen.queryByRole("region", { name: "กำลังแปลเสียง" })).not.toBeInTheDocument();
    Object.assign(snapshot.runtime, { workerReady: true, lastError: undefined });
    view.rerender(<SettingsApp activeTab="overview" />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText("ตัวตรวจคำพูดยังไม่พร้อม")).not.toBeInTheDocument();
  });

  it("names an offline translation service in the session status", () => {
    const snapshot = vi.mocked(useSnapshot)().snapshot!;
    snapshot.runtime.aiService.state = "offline";
    snapshot.runtime.aiService.message = "เชื่อมต่อบริการ AI ไม่สำเร็จ";
    snapshot.runtime.listening = false;
    render(<SettingsApp activeTab="overview" />);
    expect(screen.getByText("เชื่อมต่อไม่ได้")).toBeInTheDocument();
    expect(screen.getByText("กำลังลองเชื่อมต่อใหม่")).toBeVisible();
    expect(screen.getByRole("button", { name: "เริ่มใช้งาน" })).toHaveAttribute("aria-describedby", "ready-ai-status");
    expect(screen.getByRole("heading", { name: "แปลเสียงสด" })).toBeInTheDocument();
  });

  it("keeps success feedback and F8 separate while opening settings", async () => {
    window.history.replaceState(null, "", "/?preview=1&ui=success#/settings/overview");
    render(<SettingsApp activeTab="overview" />);
    expect(await screen.findByRole("status")).toHaveTextContent("เริ่มใช้งานแล้ว");
    const stop = screen.getByRole("button", { name: /หยุดใช้งาน/ });
    expect(stop).not.toContainElement(screen.getByRole("status"));
    fireEvent.click(screen.getByRole("button", { name: "ตั้งค่า" }));
    expect(screen.getByText("เริ่มใช้งานแล้ว")).toBeInTheDocument();
    expect(window.location.hash).toBe("#/settings/advanced");
    cleanup();
    render(<SettingsApp activeTab="advanced" />);
    expect(screen.getByRole("heading", { name: "ปุ่มลัด" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "AI และคำศัพท์" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "ตั้งค่า" })).not.toBeInTheDocument();
  });
});
