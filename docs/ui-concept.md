# WANGAI desktop UI: dark utility

## Job and structure

WANGAI should let a player choose one app, check whether audio and translation are ready, then start or stop listening. The main window uses a left navigation rail, a compact toolbar, and a work area. The active session and F8 action are visible first. History, diagnostics, and detailed tuning stay one click away.

The dark theme is the default. Surfaces are charcoal and muted forest green, with restrained green for selected navigation, ready state, and the primary action. Status also uses words and icons, so colour is not the only signal. The retro W key remains the brand mark; the layout follows desktop tools rather than a promotional page.

## Screens

| Screen | Primary task | Supporting detail |
| --- | --- | --- |
| Home | Select an app and start or stop listening | Audio and AI readiness, recent translation |
| App picker | Find a running game or app | PID and executable path under Details |
| Audio and app | Change source | Diagnostics and capture tuning in disclosures |
| AI and glossary | Inspect service and edit terms | Model details |
| Hotkeys and Overlay | Configure in-game controls | Update status |
| Portable preparation | Choose a folder and prepare WANGAI | Data migration guidance |

## Typography

Bundle Noto Sans Thai for UI copy and Kanit Bold for main headings and brand. Web fonts are self-hosted; the native portable screen registers the TTFs privately in its process. Both use their respective SIL Open Font Licenses in `assets/fonts`. The web font payload is about 159 KB WOFF2 combined before compression by the app package.

## Research and interpretation

- [PoE Overlay II](https://www.poeoverlay.com/) and its [in-game panel](https://www.poeoverlay.com/images/feature/evaluate-ingame-profile-quick-price.webp): observed compact, contextual panel with dense actions. WANGAI uses this as a cue to prioritize session controls and status.
- [Awakened PoE Trade quick start](https://github.com/SnosMe/awakened-poe-trade/blob/master/docs/quick-start.md) and [Exiled Exchange 2](https://kvan7.github.io/Exiled-Exchange-2/): observed hotkey-first overlay workflows. WANGAI keeps F8 on the main action.
- [OBS Studio quick start](https://obsproject.com/kb/quick-start-guide): observed workspace with sources, meters, controls and secondary settings. WANGAI maps this to source, readiness and session control.
- [Microsoft NavigationView](https://learn.microsoft.com/en-us/windows/apps/design/controls/navigationview) and [app settings guidance](https://learn.microsoft.com/en-us/windows/apps/design/app-settings/guidelines-for-app-settings): persistent navigation and predictable settings.
- [Apple toolbar guidance](https://developer.apple.com/design/human-interface-guidelines/toolbars): title and current-view actions in a compact toolbar.
- [Mat reference](https://onepagelove.com/mat): retained only the restrained retro mood in the W key and natural accent. Its page composition is not the app layout.

These are design references, not claims that WANGAI duplicates their features or native frameworks.

## Skills used

The local `ui-ux-pro-max` skill informs typography, contrast, target size and navigation review. `frontend-skill` and `frontend-ui-engineering` guide the utility workspace implementation. `browser-testing-with-devtools` guides real viewport checks. `performance-optimization` keeps the font and UI cost visible. `code-review-and-quality` guides the final pass.

## Verification boundary

Browser Preview checks routes and layout using simulated runtime state. Production build and portable Windows compilation check packaging. Native DPI, installed app flow, screen reader behavior and real capture still need hands-on release QA.
