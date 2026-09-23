# WANGAI UI concept: Calm retro utility

## Design direction

Use the warm paper, deep green, rounded shapes, and generous space seen in [Mat](https://onepagelove.com/mat). WANGAI remains a desktop utility, so the reference informs the palette and tone; its long scrolling marketing layout does not carry over.

The visual priority is **choose an app → see readiness → start listening**. One prominent action serves that flow. History, privacy details, and technical settings stay available without competing with the start button.

## Screen map

| Screen | Main task | Secondary information |
| --- | --- | --- |
| Home | Select one app, see readiness, start or stop listening | Latest translation, history, privacy |
| App picker | Find a running game or app and select it | Executable path and PID under Details |
| Settings | Change the source app, glossary, shortcuts, and overlay | Audio diagnostics, capture mode, VAD, server model IDs under disclosures |
| Portable preparation | Choose a folder and prepare WANGAI | Existing-setting import and data migration guidance |

## Visual system

- Background: warm cream `#f6f3eb`; surface: paper `#fffdf8`.
- Text and primary action: dark forest `#173a2d` and `#244d3a`.
- Dividers: soft beige `#e4e1d6`; status colors are reserved for meaning.
- The WANGAI mark uses a raised retro **W key** motif, matching the desktop app and native portable preparation screen.
- Thai UI text uses the installed Windows font stack. Model names and diagnostic values remain readable in the details sections.
- Interactive controls target at least 44 CSS pixels where practical. Keyboard focus is visible; disclosures and dialogs keep semantic controls.

## Research basis

- [Mat on One Page Love](https://onepagelove.com/mat): palette and visual mood.
- [Microsoft Windows navigation guidance](https://learn.microsoft.com/en-us/windows/apps/design/basics/navigation-basics): consistent routes and primary task access.
- [Microsoft app settings guidance](https://learn.microsoft.com/en-us/windows/apps/design/app-settings/guidelines-for-app-settings): keep settings clear and predictable.
- [Nielsen Norman Group usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/): visible state, familiar language, and progressive detail.
- [WCAG 2.2 target size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum): usable pointer targets.

## Verification boundary

Browser Preview verifies layout and navigation with simulated application data. The native portable UI compiles, but it still needs hands-on checks on Windows for DPI scaling, keyboard and screen reader behavior, cancel and recovery, and actual package flow before release.
