import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { SettingsApp } from "./SettingsApp";
import { snapshotFixture } from "./test/fixtures";
import { useSnapshot } from "./useSnapshot";

vi.mock("./useSnapshot", () => ({
  useSnapshot: vi.fn(),
  errorText: (error: unknown) => String(error),
}));
vi.mock("./api", () => ({
  api: {
    listRunningApps: vi.fn().mockResolvedValue([]),
    listOutputDevices: vi.fn().mockResolvedValue([]),
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

  it("opens Advanced from Ready Room before any audio frames arrive", async () => {
    render(<App />);
    expect(screen.getByRole("meter", { name: "ระดับเสียงขาเข้า" })).toHaveAttribute("aria-valuenow", "0");
    expect(screen.getByText("รอเสียงจากแอป")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "เสียงและแอป" });
    fireEvent.click(link);
    await act(async () => {
      window.location.hash = link.getAttribute("href")!;
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(screen.getByText("ยังไม่มี audio frame")).not.toBeVisible();
    fireEvent.click(screen.getByText("ตรวจสอบเสียงเมื่อมีปัญหา"));
    expect(await screen.findByRole("heading", { name: "Incoming audio diagnostics" })).toBeInTheDocument();
    expect(screen.getByText("ยังไม่มี audio frame")).toBeVisible();
    fireEvent.click(screen.getByText("ตัวเลือกเสียงขั้นสูง"));
    expect(screen.getByRole("slider", { name: /VAD threshold/ })).toHaveValue("0.5");
    expect(screen.getByRole("link", { name: "กลับหน้าหลัก" })).toBeInTheDocument();
  });

  it.each([null, undefined, -31.25, 0])("renders Advanced with peak %s", async (peak) => {
    const snapshot = vi.mocked(useSnapshot)().snapshot!;
    Object.assign(snapshot.runtime, { audioPeakDbfs: peak });
    render(<SettingsApp activeTab="advanced" />);
    expect(await screen.findByText(peak == null ? "ยังไม่มี audio frame" : `${peak.toFixed(1)} dBFS`)).toBeInTheDocument();
  });

  it("shows a worker protocol failure on Ready Room and Advanced instead of only a success notice", async () => {
    const snapshot = vi.mocked(useSnapshot)().snapshot!;
    const message = "ข้อมูลจากตัวตรวจคำพูดไม่ตรงกับแอป กรุณาเปิด WANGAI จากชุด Portable เดียวกัน";
    Object.assign(snapshot.runtime, { workerReady: false, lastError: message });
    const view = render(<SettingsApp activeTab="overview" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByText("ตัวตรวจคำพูดยังไม่พร้อม")).toBeInTheDocument();
    expect(screen.getAllByText("ต้องตรวจสอบ")).toHaveLength(2);
    expect(document.querySelector(".settings-sidebar-dot")).toHaveClass("is-warning");
    view.rerender(<SettingsApp activeTab="advanced" advancedSection="audio" />);
    expect(screen.getByRole("alert")).toHaveTextContent(message);
    Object.assign(snapshot.runtime, { workerReady: true, lastError: undefined });
    view.rerender(<SettingsApp activeTab="overview" />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText("ตัวตรวจคำพูดยังไม่พร้อม")).not.toBeInTheDocument();
  });

  it("keeps success feedback and F8 separate and preserves feedback through navigation", async () => {
    window.history.replaceState(null, "", "/?preview=1&ui=success#/settings/overview");
    const view = render(<SettingsApp activeTab="overview" />);
    expect(await screen.findByRole("status")).toHaveTextContent("เริ่มฟังแล้ว");
    const stop = screen.getByRole("button", { name: /หยุดฟัง · F8/ });
    expect(stop).not.toContainElement(screen.getByRole("status"));
    view.rerender(<SettingsApp activeTab="advanced" advancedSection="controls" />);
    expect(screen.getByText("เริ่มฟังแล้ว")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "ปุ่มลัด" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "AI และคำศัพท์" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ปุ่มลัดและ Overlay" })).toHaveAttribute("aria-current", "page");
  });
});
