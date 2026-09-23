# WANGAI desktop UI: game companion

## Job and structure

WANGAI should let a player choose one app, check whether audio and translation are ready, then start or stop listening. The desktop window is a compact control surface. The active session and F8 action are visible first. Settings and history replace the content in the same window, with a clear return command. They do not open another window or cover the control surface with a side panel. The main view does not repeat transcript history or expose server model configuration.

The dark theme is the default. Charcoal and blue slate carry the workspace, warm cream makes Thai copy legible, cyan identifies a live connection, and amber highlights the selected app and the primary action. Status uses words and icons as well as colour. The retro W key and warm accent borrow the character of the Mat reference; dense navigation and compact status rows follow desktop tools.

The earlier gray-green version gave all surfaces, statuses, and actions similar weight. In the revised hierarchy the selected app and session control form one command strip, with source and translation readiness below it. A new install and the default browser preview start with no source, a clear warning, and one prominent Choose App action. A source chosen by the user is saved between launches; settings offer Clear Selection. An idle saved source says “เลือกแล้ว” until listening starts, without claiming audio capture is ready. Errors use explicit status words. History owns the transcript list; the translation status row has no link to a separate AI page.

## Screens

| Screen | Primary task | Supporting detail |
| --- | --- | --- |
| Desktop control surface | Select an app and start or stop listening | Audio and translation readiness |
| App picker | Find a running game or app | PID and executable path under Details |
| Settings view | Change or clear source | Compact diagnostics, capture tuning, hotkeys, Overlay and updates in disclosures |
| History view | Inspect translations from this session | Replaces the main view in the same window; list scrolls when long |
| Portable preparation | Choose a folder and prepare WANGAI | Data migration guidance |

## Typography

Bundle Noto Sans Thai for UI copy and Kanit Bold for main headings and brand. Web fonts are self-hosted; the native portable screen registers the TTFs privately in its process. Both use their respective SIL Open Font Licenses in `assets/fonts`. The web font payload is about 159 KB WOFF2 combined before compression by the app package.

## Research and interpretation

- [PoE Overlay II](https://www.poeoverlay.com/) and its [in-game panel](https://www.poeoverlay.com/images/feature/evaluate-ingame-profile-quick-price.webp): observed compact, contextual panel with dense actions. WANGAI uses this as a cue to prioritize session controls and status.
- [Awakened PoE Trade quick start](https://github.com/SnosMe/awakened-poe-trade/blob/master/docs/quick-start.md) and [Exiled Exchange 2](https://kvan7.github.io/Exiled-Exchange-2/): observed hotkey-first overlay workflows. WANGAI keeps F8 on the main action.
- [OBS Studio quick start](https://obsproject.com/kb/quick-start-guide): observed workspace with sources, meters, controls and secondary settings. WANGAI maps this to source, readiness and session control.
- [Windows commanding basics](https://learn.microsoft.com/en-us/windows/apps/design/basics/commanding-basics) and [navigation basics](https://learn.microsoft.com/en-us/windows/apps/design/basics/navigation-basics): frequent commands belong on the canvas; less-used commands can move to a flyout or panel. A single page is a documented navigation option when it fits the task.
- [PowerToys Awake](https://learn.microsoft.com/en-us/windows/powertoys/awake) and its [settings screenshot](https://learn.microsoft.com/en-us/windows/powertoys/images/awake/awake-settings-menu.png): observed a native window with a prominent enable control and compact, related setting rows.
- [Apple popovers](https://developer.apple.com/design/human-interface-guidelines/popovers/): use transient UI for a few related tasks. WANGAI keeps its longer settings form as a full view in the existing window.
- [NVIDIA app overlay](https://www.nvidia.com/en-ph/geforce/news/nvidia-app-download-and-features/): official documentation puts direct actions and hotkeys in the overlay and more detailed options behind its Settings cog. WANGAI applies only that action hierarchy.
- [SteelSeries GG Sonar mixer release notes](https://techblog.steelseries.com/2023/07/25/GG-notes-43.0.0.html): the mixer gained contextual master settings and direct shortcut access. WANGAI keeps source and listening controls on its main view, with adjustments one view away in the same window.
- [Apple toolbar guidance](https://developer.apple.com/design/human-interface-guidelines/toolbars): title and current-view actions in a compact toolbar.
- [SteelSeries GG app guide](https://support.steelseries.com/hc/en-us/articles/25015904433677-Getting-to-know-the-GG-app) and [GameReady in GG](https://steelseries.com/gg/home/headsets): observed dark slate workspace, vivid selected states, and core controls before deeper settings. WANGAI interprets this with cyan live status and a prominent session control.
- [Mat reference](https://onepagelove.com/mat): observed cream, deep green, large expressive type, and retro objects. WANGAI uses the warm contrast and keyboard identity, without copying its web page structure.

These are design references, not claims that WANGAI duplicates their features or native frameworks.

## Skills used

The local `ui-ux-pro-max` skill informs typography, contrast, target size and navigation review. `frontend-ui-engineering` guides the utility workspace implementation. `browser-testing-with-devtools` guides real viewport checks. `performance-optimization` keeps the font and UI cost visible. The Overlay uses no blur or repeating decorative animation during live play.

## Verification boundary

Browser Preview checks routes and layout using simulated runtime state. Production build, automated UI tests, and portable Windows compilation check packaging. Native DPI, installed app flow, screen reader behavior and real capture still need hands-on release QA.
