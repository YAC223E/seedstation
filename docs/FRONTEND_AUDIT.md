# SeedStation Frontend Audit

Mobile-first audit of `seedstation/frontend` (Vite + React + TypeScript, served by Django).
Primary target: iPhone Safari over the LAN. Desktop must keep working.

Status legend: **Fixed** = changed and verified in a production build; **Open** = still to do;
**Follow-up** = intentionally not changed in this pass.

## Environment used for reproduction

- iPhone 13 class viewport: 390 × 844, DPR 3, mobile UA, touch enabled (Chrome DevTools
  emulation via Puppeteer, because the browser tool cannot set a viewport).
- Short viewport: 390 × 664 to simulate Safari's toolbar / on-screen keyboard.
- Desktop: 1440 × 900.
- Additional widths checked: 360, 430, 768 (portrait), 844 × 390 (landscape).
- Synthetic fixture: `storage/downloads/qa-audit-sample.txt` (45 B, safe to delete).
  The existing user torrent was never modified.

## Phase 1 — Reproduction of the two known bugs

### Bug 1 — "Save" / download on a file appears to do nothing

**Observed at 390 × 844**

1. Open `/files`, tap `qa-audit-sample.txt` to preview it.
2. The preview dialog is rendered off-screen. Measured dialog rect:
   `x = -171`, `w = 366` (should be `x = 12`, `w = 366`).
3. The visible action labelled **Download** sits at `x = 452`, i.e. outside the 390 px
   viewport. The close button is at `x = 526`.
4. Tapping the visible left slice of the dialog therefore cannot reach the download action.
   Directly requesting the endpoint returns `200` with
   `Content-Disposition: attachment`, so the API is not the failure.

**Root cause (reproduced, not guessed)**

`DialogContent` combines Tailwind's `-translate-x-1/2 -translate-y-1/2` (which in Tailwind v4
sets the CSS `translate` property) with the `dialog-in` keyframes, whose final frame also sets
`transform: translate(-50%, -50%) scale(1)` and uses `animation-fill-mode: both`. Both
translations apply, so every dialog is shifted by −50 % twice:

`-50 % (translate property) + -50 % (transform) = -100 % of its own width/height`.

With `w = 366` the centre lands at `195 - 366 = -171`. Every dialog in the app is affected
(preview, delete confirmation, torrent removal).

The user calls the action "Save"; in this UI the label is **Download** (browser save sheet).
There is also no feedback after tapping it, which reinforces the "nothing happened" impression.

### Bug 2 — Delete confirmation is too large for mobile

**Observed at 390 × 844**

- Same double-translation: dialog rect `x = -171`, `w = 366`.
- Footer buttons overflow horizontally: measured `x = -150`, `w = 646`.
- Footer is part of the scrolling content, so the confirm/cancel buttons can scroll out of
  reach on a short viewport (390 × 664).
- Dialog can grow to 88 dvh with no safe-area awareness and no horizontal containment.

**Root causes**

1. Double translation (same as Bug 1) moves the whole dialog off-screen.
2. The dialog is a CSS grid whose grid items do not all have `min-width: 0`; the long
   unbroken path and the footer's flex children force a grid column wider than the dialog,
   producing horizontally overflowing buttons.
3. `DialogFooter` is a normal flow element inside the single scroll container, not sticky.
4. No `overflow-x` containment, no safe-area padding, and no maximum width guard on the
   footer's children.

## Issue log

Severity: **critical** blocks a workflow; **high** fails on mobile or loses data/feedback;
**medium** degrades usability/accessibility; **low** polish.

### Critical

| # | Issue | Location | Planned fix | Status |
|---|-------|----------|-------------|--------|
| C1 | Every dialog is translated twice and renders off-screen | `src/index.css` (`dialog-in`), `src/components/ui/dialog.tsx` | Animate only `opacity` + `scale`; centre with the CSS `translate` property once; remove conflicting Tailwind translate utilities | Fixed |
| C2 | Delete dialog footer overflows horizontally and is unreachable | `src/components/common/confirm-dialog.tsx`, `src/components/ui/dialog.tsx`, `src/pages/files-page.tsx` | `min-w-0` + `overflow-x-hidden`, sticky footer with safe-area padding, wrap long paths, 44 px buttons | Fixed |
| C3 | Download action unreachable because dialog is off-screen; no feedback at all | `src/components/files/file-preview-dialog.tsx`, `src/components/files/file-row.tsx` | Reachable sticky action bar, pressed/loading state, success toast, duplicate-tap guard | Fixed |

### High

| # | Issue | Location | Planned fix | Status |
|---|-------|----------|-------------|--------|
| H1 | Inputs and textareas use 14 px (`text-sm`); iOS Safari zooms the page on focus | `ui/input.tsx`, `ui/textarea.tsx`, `ui/select.tsx`, `files-page.tsx`, `filter-bar.tsx`, `add-download-page.tsx`, `settings-page.tsx` | 16 px on mobile (`text-base`), 14 px from `sm` up; 44 px control height | Fixed |
| H2 | Many mobile tap targets are 28–36 px (row menus, preview close, search clear, filter chips, toolbar buttons) | `ui/button.tsx`, `file-row.tsx`, `torrent-row.tsx`, `filter-bar.tsx`, `files-page.tsx`, `dropdown-menu.tsx`, `select.tsx`, `sheet.tsx` | 44 px minimum on coarse/mobile viewports, original size on desktop | Fixed |
| H3 | Dropdown/menu items are 36 px high and menus can exceed the viewport | `ui/dropdown-menu.tsx`, `ui/select.tsx` | 44 px items on mobile, scrollable menu with viewport max-height | Fixed |
| H4 | Delete dialog auto-focuses its text input on open, raising the iOS keyboard and covering the footer | `common/confirm-dialog.tsx` | Suppress auto-focus for coarse pointers; focus the dialog instead; sticky footer stays visible | Fixed |
| H5 | Delete/preview dialog need scroll containment and safe-area padding | `ui/dialog.tsx`, `file-preview-dialog.tsx` | `overscroll-contain`, `overflow-x-hidden`, `env(safe-area-inset-*)`, sticky header/footer | Fixed |
| H6 | No skip link; keyboard users must tab through the whole sidebar/header | `layout/app-shell.tsx` | Add a skip-to-content link and `main id` | Fixed |
| H7 | Login page auto-focuses the username field, opening the keyboard immediately on mobile | `pages/login-page.tsx` | Remove unconditional auto-focus | Fixed |
| H8 | Add-download textarea is 12 px on mobile and auto-focuses | `pages/add-download-page.tsx` | 16 px on mobile; avoid automatic keyboard on touch | Fixed |
| H9 | Download actions give no visible acknowledgement; double taps can fire repeatedly | `file-preview-dialog.tsx`, `file-row.tsx` | Toast + transient pressed/loading state + duplicate-tap guard | Fixed |
| H10 | Add-download layout expanded past the viewport when the landing-folder path was long; switch, hints and panel edge were clipped | `add-download-page.tsx` | Explicit `grid-cols-[minmax(0,1fr)]` on the outer/inner grids and `min-w-0` on the form | Fixed |
| H11 | Settings “Unsaved changes” bar was not viewport-fixed; it appeared at `y = 2130` because the page-enter animation retained a transform and became the containing block | `src/index.css` (`page-enter`) | Drop the retained transform after the animation (`fill-mode: backwards`); verified `y = 640` at 390 × 844 | Fixed |

### Medium

| # | Issue | Location | Planned fix | Status |
|---|-----|----------|-------------|--------|
| M1 | Preview header/footer scroll away with long content, hiding the download action | `file-preview-dialog.tsx` | Sticky header/footer with surface background | Fixed |
| M2 | Textarea/PDF preview uses fixed `72dvh`, which can exceed the dialog on short screens | `file-preview-dialog.tsx` | Use a `dvh`/`svh`-aware max-height that accounts for dialog chrome | Fixed |
| M3 | File/torrent action menu triggers and close buttons use 32 px hit areas | `file-row.tsx`, `torrent-row.tsx`, `dialog.tsx`, `sheet.tsx` | 44 px on mobile | Fixed |
| M4 | File row path chips can force horizontal overflow | `files-page.tsx`, `file-preview-dialog.tsx` | `min-w-0` and `max-w-full` on truncating children | Fixed |
| M5 | Some buttons lack `touch-action: manipulation`, so iOS can apply a 300 ms delay | `index.css` / button primitives | Global `button, a, [role="button"] { touch-action: manipulation; }` | Fixed |
| M6 | Muted/faint text may fall below WCAG AA on the light surface | `index.css` tokens | Darken `--faint` slightly while preserving the style | Fixed |
| M7 | Sheet/detail panel has no safe-area padding at top/bottom | `ui/sheet.tsx`, `torrent-detail-sheet.tsx` | Safe-area insets on header/footer | Fixed |
| M8 | Toasts can sit under Safari's toolbar; mobile offset is fixed at 88 px | `main.tsx` | Include `env(safe-area-inset-bottom)` in the mobile offset | Fixed |
| M9 | Long torrent/file names can push row actions off-screen | `torrent-row.tsx`, `file-row.tsx` | Ensure `min-w-0` all the way down; keep action column fixed | Fixed |
| M10 | Delete success does not close an open preview / clear text-preview cache | `files-page.tsx` | Close preview if it targets the deleted path; invalidate `file-text` | Fixed |
| M11 | Settings and add-download forms have small mode toggles | `add-download-page.tsx`, `settings-page.tsx` | 44 px tap targets on mobile | Fixed |
| M12 | `autoFocus` in the magnet field can fight the iOS keyboard and sticky elements | `add-download-page.tsx` | Disable auto-focus for coarse pointers | Fixed |
| M13 | Login legal copy and footer were 3.61:1 / 4.24:1, and the input placeholder was 3.28:1 | `pages/login-page.tsx` | Raise secondary text and placeholder contrast to ≥ 4.5:1 | Fixed |
| M14 | Sort trigger and file/torrent row buttons had accessible names that omitted their visible text (axe: serious) | `filter-bar.tsx`, `file-row.tsx`, `torrent-row.tsx` | Include the visible label in the name; use `sr-only` action prefixes instead of overriding row labels | Fixed |
| M15 | Active root chip’s “GB free” text was 4.22:1 on the tinted background | `files/roots-list.tsx` | Use the muted token for secondary chip text | Fixed |

### Low

| # | Issue | Location | Planned fix | Status |
|---|-----|----------|-------------|--------|
| L1 | No `aria-busy` / inline spinner on the delete confirm button | `confirm-dialog.tsx` | Spinner + `aria-busy` while pending | Fixed |
| L2 | Preview download link has no `aria-label` beyond its text | `file-preview-dialog.tsx` | Keep visible text; add descriptive label including file name | Fixed |
| L3 | Breadcrumb buttons have 4 px vertical padding | `files-page.tsx` | Larger hit area on mobile | Fixed |
| L4 | Search inputs override the component font size with `text-xs` | `files-page.tsx`, `filter-bar.tsx` | Remove override / make it responsive | Fixed |
| L5 | `scroll-behavior`/instant scroll may be unsupported in older Safari | `app-shell.tsx` | Keep behaviour but fall back to `auto` | Fixed |
| L6 | Static assets are served with `max-age=0` | `backend/config/settings.py` | Deferred: backend change, only a load-time win; documented as follow-up | Follow-up |
| L7 | Main JS chunk is ~1.01 MB (~301 kB gzip); Vite warns above 500 kB | `frontend` build | Follow-up: route-level `import()` splitting; no functional impact | Follow-up |
| L8 | Desktop sidebar controls are 28–40 px high | `layout/app-shell.tsx` | Intentional: `pointer-fine` keeps mouse targets compact; touch stays ≥ 44 px | Won't fix |

## Out of scope / confirmed healthy

- API contract, CSRF flow, auth provider, live WebSocket provider: inspected, no contract
  changes required for these bug fixes.
- `downloadUrl()` includes the encoded path and the download endpoint returns
  `Content-Disposition: attachment`; the endpoint itself works.
- Query invalidation after delete uses the same `["files"]` key as `useFileListing`, so the
  list does refresh.
- `min-h-dvh` / `100dvh` are already used; no `100vh` regressions found.
- Viewport meta already includes `viewport-fit=cover`.
- Reduced-motion handling exists.

## Verification results (2026-11-05)

Build: `npm run build` (`tsc -b && vite build`) passes; served assets
`assets/index-2_bbpUkZ.js` and `assets/index-783Uy4hO.css` returned `200` after restarting Daphne.
Backend: `pytest -q` → **63 passed** (only the Django `EMAIL_BACKEND` deprecation warning).

Puppeteer (Chrome, iPhone-class emulation, touch enabled) was run against the production build:

| Check | Result |
|-------|--------|
| Preview dialog at 390×844 | `x=12 y=208 w=366 h=428`; close `44×44`; Download `102×44`; request `200` + attachment; toast “Download started.” |
| Preview at 844×390 / 360×640 / 430×932 | centred, fully on-screen, sticky chrome, no horizontal overflow |
| Delete dialog at 390×844 / 844×390 / 360×640 / 430×932 | fully on-screen, footer visible, Cancel/Delete `44×44`, no horizontal overflow; Delete disabled until `DELETE` typed |
| Double-tap Delete | exactly **1** `POST /api/files/delete/`, one toast, list updated to “2 entries” |
| Add-download at 390×844 / 844×390 | textarea `16px`; switch inside the viewport (`x=300` at 390); long path truncates (`w=306`); tabs and paste control `44px` |
| Invalid magnet submit | inline error “Magnet links start with magnet:?.”; **0** add requests |
| Settings dirty bar | viewport-fixed at `y=640` (390×844) and `y=230` (844×390); Discard/Save `44px`; Discard restores the original value |
| Layout sweep (360, 390, 430, 768, 844 landscape, 1440) | no document-level horizontal scroll on any page |
| Touch target sweep | every visible control ≥ 44 px except the `sr-only` skip link and the `44×24` switch, whose 48 px wrapping label is the actual target |
| aXe WCAG 2.1 AA (login, dashboard, downloads, files, add, settings) | **0 violations**; only `color-contrast` incomplete where a background image/gradient prevents automated measurement |
| Console | no app errors or unhandled rejections during the runs |
| Engine | qBittorrent was started for the populated-list checks; the existing user torrent was not modified |
| Fixture | `qa-audit-sample.txt` was recreated for the tests and removed afterwards |

## Root causes and fixes

1. **Dialog double translation.** Tailwind v4 writes `-translate-*` to the CSS
   `translate` property, while `dialog-in` also animated `transform: translate(-50%, -50%)`
   with `fill-mode: both`. Both applied. The keyframes now animate only `opacity`/`scale`,
   and `.dialog-content` owns the single `translate: -50% -50%`.
2. **Grid tracks wider than the dialog.** A CSS grid’s implicit column sizes to the longest
   unbreakable child (a long path). `DialogContent` now declares
   `grid-cols-[minmax(0,1fr)]`, `min-w-0` and `overflow-x-hidden`; the footer is sticky and
   safe-area padded. The same bug pattern was found and fixed on the add-download grid.
3. **No download feedback / reachable action.** On mobile the header Download action was
   hidden and the footer action was off-screen. The dialog now has a sticky footer action,
   a pressed/“Starting…” state, a toast and a re-entry guard; the file-row menu uses the same
   guard.
4. **Settings bar position.** `page-enter` used `fill-mode: both`, so the final
   `transform: translateY(0)` remained and made `.page-shell` the containing block for
   `position: fixed`. Changing the fill mode to `backwards` removes the transform after the
   animation without changing the visual result.
5. **Accessible names.** Row buttons used `aria-label` values that omitted visible
   metadata; the sort trigger omitted the selected sort label. The labels now include the
   visible text (with `sr-only` action prefixes for rows).

## Risks and follow-ups

- Testing used Chrome DevTools iPhone emulation, not a physical iPhone. Safe-area insets and
  the on-screen keyboard cannot be fully reproduced headlessly; an on-device pass on Safari
  is still recommended, especially for the portrait keyboard and landscape bottom nav.
- `pointer-fine`/`pointer-coarse` require a current browser (Safari 16.4+). The fallback is
  the touch-first 44 px layout, so older browsers stay usable.
- The main JS bundle is ~1.01 MB minified (~301 kB gzip); route-level code splitting is the
  next performance win (L7).
- Static hashed assets are still served with `max-age=0` (L6); this is a backend/WhiteNoise
  header change and was intentionally left out of this frontend pass.
- The add-torrent happy path was validated through the backend integration suite, not by
  adding a live transfer in this pass. Only invalid-input behaviour and engine-offline/online
  states were exercised in the browser.
- `.env`, the database, storage files and credentials were not changed or committed. The
  synthetic QA fixture was deleted.
