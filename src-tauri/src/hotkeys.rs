use anyhow::{anyhow, Context, Result};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutEvent, ShortcutState};

use crate::{commands, models::HotkeySettings, pipeline, state::AppState};

pub fn handle_shortcut(app: &AppHandle, shortcut: &Shortcut, event: ShortcutEvent) {
    let app_handle = app.clone();
    let state = app.state::<AppState>();
    if state
        .hotkey_capture_active
        .load(std::sync::atomic::Ordering::Relaxed)
    {
        return;
    }
    let hotkeys = state.settings.snapshot().hotkeys;
    let pressed = event.state == ShortcutState::Pressed;
    let released = event.state == ShortcutState::Released;

    if shortcut_matches(shortcut, &hotkeys.push_to_talk) {
        if pressed {
            if let Err(error) = pipeline::start_push_to_talk(&app_handle) {
                emit_shortcut_error(&app_handle, error.to_string());
            }
        } else if released {
            pipeline::stop_push_to_talk(&app_handle);
        }
        return;
    }
    if !pressed {
        return;
    }
    if shortcut_matches(shortcut, &hotkeys.toggle_listening) {
        toggle_listening(&app_handle);
    } else if shortcut_matches(shortcut, &hotkeys.copy_latest) {
        let _ = copy_latest(&app_handle);
    } else if shortcut_matches(shortcut, &hotkeys.edit_overlay) {
        toggle_overlay_edit_mode(&app_handle);
    }
}

fn emit_shortcut_error(app: &AppHandle, message: String) {
    let state = app.state::<AppState>();
    let runtime = state.update_runtime(|runtime| runtime.last_error = Some(message.clone()));
    let _ = app.emit("pipeline-error", message);
    let _ = app.emit("runtime-state", runtime);
}

pub fn register_hotkeys(app: &AppHandle, hotkeys: &HotkeySettings) -> Result<()> {
    let keyboard: Vec<&str> = [
        hotkeys.toggle_listening.as_str(),
        hotkeys.push_to_talk.as_str(),
        hotkeys.copy_latest.as_str(),
        hotkeys.edit_overlay.as_str(),
    ]
    .into_iter()
    .filter(|value| !value.trim().is_empty() && !is_mouse_shortcut(value))
    .collect();
    for value in &keyboard {
        value
            .parse::<Shortcut>()
            .map_err(|error| anyhow!("ปุ่มลัด {value} ไม่ถูกต้อง: {error}"))?;
    }
    let manager = app.global_shortcut();
    manager.unregister_all()?;
    if !keyboard.is_empty() {
        manager
            .register_multiple(keyboard)
            .context("ลงทะเบียน global hotkeys ไม่สำเร็จ")?;
    }
    Ok(())
}

fn is_mouse_shortcut(value: &str) -> bool {
    value.eq_ignore_ascii_case("Mouse4") || value.eq_ignore_ascii_case("Mouse5")
}

fn toggle_listening(app: &AppHandle) {
    let state = app.state::<AppState>();
    let listening = !state
        .runtime
        .read()
        .expect("runtime lock poisoned")
        .listening;
    match pipeline::set_listening(app, listening) {
        Ok(true) => {
            if let Err(error) = commands::hide_main_for_session(app, true) {
                let _ = pipeline::set_listening(app, false);
                emit_shortcut_error(app, error);
            }
        }
        Ok(false) => {}
        Err(error) => emit_shortcut_error(app, error.to_string()),
    }
}

fn toggle_overlay_edit_mode(app: &AppHandle) {
    let state = app.state::<AppState>();
    let enabled = !state
        .runtime
        .read()
        .expect("runtime lock poisoned")
        .overlay_edit_mode;
    let _ = set_overlay_edit_mode(app, enabled);
}

#[cfg(windows)]
pub fn start_mouse_shortcuts(app: AppHandle) -> Result<()> {
    std::thread::Builder::new()
        .name("wangai-mouse-shortcuts".into())
        .spawn(move || {
            use windows::Win32::UI::Input::KeyboardAndMouse::{
                GetAsyncKeyState, VK_XBUTTON1, VK_XBUTTON2,
            };
            let down = |key: i32| unsafe { GetAsyncKeyState(key) < 0 };
            let keys = [
                ("Mouse4", VK_XBUTTON1.0 as i32),
                ("Mouse5", VK_XBUTTON2.0 as i32),
            ];
            let mut previous = [down(keys[0].1), down(keys[1].1)];
            loop {
                if app.state::<AppState>().lifecycle.is_closing() {
                    break;
                }
                for (index, (button, key)) in keys.iter().enumerate() {
                    let pressed = down(*key);
                    if pressed != previous[index] {
                        previous[index] = pressed;
                        handle_mouse_button(&app, button, pressed);
                    }
                }
                std::thread::sleep(std::time::Duration::from_millis(20));
            }
        })?;
    Ok(())
}

#[cfg(not(windows))]
pub fn start_mouse_shortcuts(_app: AppHandle) -> Result<()> {
    Ok(())
}

fn handle_mouse_button(app: &AppHandle, button: &str, pressed: bool) {
    let state = app.state::<AppState>();
    if state
        .hotkey_capture_active
        .load(std::sync::atomic::Ordering::Relaxed)
    {
        if !pressed {
            let _ = app.emit("mouse-shortcut-captured", button);
        }
        return;
    }
    let hotkeys = state.settings.snapshot().hotkeys;
    if hotkeys.push_to_talk.eq_ignore_ascii_case(button) {
        if pressed {
            if let Err(error) = pipeline::start_push_to_talk(app) {
                emit_shortcut_error(app, error.to_string());
            }
        } else {
            pipeline::stop_push_to_talk(app);
        }
    } else if pressed {
        if hotkeys.toggle_listening.eq_ignore_ascii_case(button) {
            toggle_listening(app);
        } else if hotkeys.copy_latest.eq_ignore_ascii_case(button) {
            let _ = copy_latest(app);
        } else if hotkeys.edit_overlay.eq_ignore_ascii_case(button) {
            toggle_overlay_edit_mode(app);
        }
    }
}

pub fn set_capture_mode(app: &AppHandle, state: &AppState, enabled: bool) -> Result<()> {
    use std::sync::atomic::Ordering;
    if enabled {
        state.hotkey_capture_active.store(true, Ordering::Relaxed);
        if let Err(error) = app.global_shortcut().unregister_all() {
            state.hotkey_capture_active.store(false, Ordering::Relaxed);
            return Err(error.into());
        }
    } else {
        register_hotkeys(app, &state.settings.snapshot().hotkeys)?;
        state.hotkey_capture_active.store(false, Ordering::Relaxed);
    }
    Ok(())
}

pub fn set_overlay_edit_mode(app: &AppHandle, enabled: bool) -> Result<bool> {
    let state = app.state::<AppState>();
    let overlay = app
        .get_webview_window("overlay")
        .context("ไม่พบ overlay window")?;
    if !enabled {
        let position = overlay.outer_position()?;
        let size = overlay.outer_size()?;
        let scale_factor = overlay.scale_factor()?;
        state.settings.update(|settings| {
            settings.overlay.x = Some(position.x);
            settings.overlay.y = Some(position.y);
            settings.overlay.width = (size.width as f64 / scale_factor).round().max(1.0) as u32;
            settings.overlay.height = (size.height as f64 / scale_factor).round().max(1.0) as u32;
            Ok(())
        })?;
    }
    overlay.set_ignore_cursor_events(!enabled)?;
    overlay.set_resizable(enabled)?;
    if enabled {
        let _ = overlay.set_focus();
    }
    let runtime = state.update_runtime(|runtime| runtime.overlay_edit_mode = enabled);
    let _ = app.emit("runtime-state", runtime);
    Ok(enabled)
}

pub fn copy_latest(app: &AppHandle) -> Result<bool> {
    let state = app.state::<AppState>();
    let Some(text) = state.latest_reply() else {
        return Ok(false);
    };
    app.clipboard().write_text(text)?;
    Ok(true)
}

fn shortcut_matches(shortcut: &Shortcut, configured: &str) -> bool {
    configured
        .parse::<Shortcut>()
        .is_ok_and(|expected| expected == *shortcut)
}

#[cfg(test)]
mod tests {
    use super::is_mouse_shortcut;

    #[test]
    fn only_the_two_supported_side_buttons_skip_keyboard_registration() {
        assert!(is_mouse_shortcut("Mouse4"));
        assert!(is_mouse_shortcut("mouse5"));
        assert!(!is_mouse_shortcut("Mouse6"));
        assert!(!is_mouse_shortcut("F8"));
    }
}
