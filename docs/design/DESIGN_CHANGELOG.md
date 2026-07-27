# CanvasNote design changelog

Status: reviewed redesign complete for the 0.1.0 development scope  
Baseline: `5178ea0`  
Review date: 2026-07-27

This document records implemented design changes separately from the proposed work in [UI_UX_AUDIT.md](../../UI_UX_AUDIT.md). Baseline evidence is stored under [`docs/design/before`](before), reviewed results under [`docs/design/after`](after), and curated repository images under [`docs/screenshots`](../screenshots). The application was launched and exercised in real Electron before the after images and Playwright baselines were accepted.

## Design system and application shell

**Previous problem:** Colours, spacing, radii, shadows, control heights, focus rings, and feedback styles were repeated across the renderer. Related controls looked slightly different and several essential labels used very small, faint text.

**Change made:** Added centralized semantic light/dark tokens, an operating-system font hierarchy, consistent focus and reduced-motion rules, and source-owned Button, IconButton, Dialog, EmptyState, and Feedback primitives. Existing token names remain temporary aliases while components migrate.

**Reason:** A small shared vocabulary makes the application feel intentional without introducing another component framework or generic dashboard theme.

**Accessibility impact:** Common controls now expose a stronger `:focus-visible` treatment, icon buttons require accessible labels, status feedback uses live-region semantics, and the native Dialog primitive contains and restores focus.

**Remaining limitation:** Compatibility aliases remain for older token names, and tldraw-owned chrome retains its upstream styling. These were kept to avoid unnecessary canvas risk.

## Welcome screen

**Previous problem:** The welcome view resembled a web landing page, pushed recent workspaces below decorative content, and became a long page at 1024 x 700. Recent entries omitted their last-opened time.

**Change made:** Replaced the hero layout with a compact workspace launcher. Create and Open workspace are the primary actions, Import board remains secondary, and recent workspaces show name, path, and last-opened metadata. The application now holds a quiet startup state until initialization resolves.

**Reason:** Launching a desktop application should present the next workspace decision immediately rather than marketing content.

**Accessibility impact:** Primary actions follow a clearer Tab order, recent workspace rows are keyboard-operable, paths retain full-value tooltips, and startup loading is announced without briefly exposing the wrong screen.

**Remaining limitation:** A recent path cannot be verified as missing until the user tries to open it. Drag-and-drop board import is not exposed on this screen.

## Dashboard, templates, and Trash

**Previous problem:** Every board card displayed favourite and Trash controls, loading could look like an empty workspace, and permanent deletion used the operating system's generic confirmation prompt.

**Change made:** Kept the existing sidebar, board search, section counts, grid/list modes, templates, and storage summary while consolidating card actions into a single menu. Added deterministic loading skeletons, shared empty states, favourite indicators, and a board-specific permanent-delete Dialog.

**Reason:** Board titles and previews should receive more attention than lifecycle controls, while destructive consequences should be explicit and visually consistent.

**Accessibility impact:** The action menu supports Arrow keys, Home, End, Escape, outside dismissal, and focus restoration. Loading exposes an `aria-busy` board region, and the view selector has group semantics.

**Remaining limitation:** Board-card focus still uses normal Tab order rather than roving grid navigation. Returning from an editor does not deliberately restore dashboard scroll position, and template cards use static previews rather than board-generated thumbnails.

## Board editor shell and toolbar

**Previous problem:** A tall vertical toolbar gave primary tools, rare additions, and history actions equal weight. At the minimum window height, lower controls could be clipped and the canvas lost prominence.

**Change made:** Moved Undo and Redo into the compact top bar, kept common creation tools in the rail, and grouped file, link, and embedded-video actions under one Add menu. Added a concise empty-board hint and explicit zoom-control grouping.

**Reason:** The canvas should remain the dominant surface, with frequent tools visible and lower-frequency actions one predictable step away.

**Accessibility impact:** The Add menu supports trigger and item keyboard navigation, Escape, outside dismissal, and focus restoration. Active state uses shape/background as well as colour, and the empty-board hint is exposed as status text.

**Remaining limitation:** Some unfamiliar canvas controls still rely on native `title` tooltips. The Properties panel collapses at narrow widths but does not add pointer-driven resizing.

## Properties panel

**Previous problem:** Properties opened at a fixed width even without a useful selection and consumed substantial canvas area at 1024 x 700.

**Change made:** Changed the panel to preserve the user's open/closed preference at wider sizes and collapse automatically below 1080 px. Added contextual native disclosure sections, exact X/Y/width/height fields, object-specific content and appearance controls, video timestamp lists, and one consistent close control.

**Reason:** Narrow windows should surrender secondary chrome before the canvas becomes unusable.

**Accessibility impact:** The toggle communicates state with `aria-pressed`; native disclosure and form controls remain keyboard-operable; locked objects disable transform inputs; and timestamp entries are real buttons that focus and seek their linked video.

**Remaining limitation:** Position and size values do not display unit suffixes, and appearance controls do not yet offer per-section reset actions.

## Search

**Previous problem:** Object search worked but used dialog and selection patterns that differed from the emerging design system.

**Change made:** Extended the existing `Ctrl/Cmd+K` surface into one command palette. It keeps object search, filters, highlighted matches, and select-and-focus behavior while adding categorized commands for notes, media import, Settings, Templates, export, theme, shortcuts, and the current board.

**Reason:** Existing search is useful and should be extended rather than replaced by a competing dependency or second search system.

**Accessibility impact:** Up/Down, Enter, and Escape behavior remains available; focus is trapped and restored by the shared Dialog; results expose option state and continue to hide internal IDs.

**Remaining limitation:** Workspace-wide board-title search is still handled by the Dashboard rather than mixed into the open-board palette.

## Settings

**Previous problem:** One long modal mixed unrelated preferences, lower settings were hidden behind scrolling, save progress was unclear, and appearance could not be reset.

**Change made:** Reorganized Settings into Appearance, Canvas, Media, Shortcuts, Privacy, Diagnostics, and About sections. Added immediate Saving/Saved feedback, Reset appearance, clearer technical paths, version/platform information, and the shared native Dialog.

**Reason:** Compact navigation makes settings easier to scan without adding a search field that the current number of options does not justify.

**Accessibility impact:** Section navigation exposes the active destination, status changes are announced politely, field labels remain native, Escape closes the modal, and focus returns to the invoking Settings button.

**Remaining limitation:** CanvasNote has no supported logs-folder API, so no nonfunctional action was added. Backup-location display is limited to the workspace information exposed by the existing preload contract.

## Media, video, and timestamp notes

**Previous problem:** Media cards mix semantic and hard-coded colours, missing files and unsupported playback can look alike, and timestamp actions compete between the card and Properties.

**Change made:** Restyled local and embedded video cards with semantic theme tokens, distinguished missing files from unsupported playback, kept native controls isolated from canvas dragging, and consolidated timestamp creation around **Add note at current time**. Selected local videos now list linked timestamp notes; clicking one focuses the correct video and seeks while remaining paused. Missing local files can be replaced, while Locate guidance appears only where the current API can support it.

**Reason:** The redesign must not destabilize the working timestamp workflow while visual and recovery changes are developed separately.

**Accessibility impact:** Native media controls continue to stop canvas dragging, global shortcuts ignore focused controls, media actions have accessible names, and timestamp notes retain visible formatted time rather than relying on colour alone.

**Remaining limitation:** Codec availability still depends on Electron and the host operating system. The application does not yet suspend every off-screen video, and embedded providers do not expose local-file repair actions.

## Feedback, loading, and save recovery

**Previous problem:** Initialization could flash the Welcome screen, board refreshes had no stable loading state, local and global errors could duplicate, and save failure offered no data-preserving recovery action.

**Change made:** Added a startup shell, dashboard loading skeletons, shared Feedback presentation, readable error normalization, and Retry for initialization failures. Save failures now remain in a persistent banner with Retry, sanitized technical details, and an editable recovery-copy export. External revision conflicts require an explicit reload decision, and direct disk reload preserves tldraw document/page records while replacing board shapes and bindings.

**Reason:** Background state should be understandable without noisy success toasts or sudden layout changes, and unresolved failures must not disappear silently.

**Accessibility impact:** Loading and error changes use status or alert semantics, with text and icons rather than colour alone. Recovery controls remain keyboard reachable and unresolved failure text is not dismissed automatically.

**Remaining limitation:** CanvasNote does not attempt an automatic three-way merge for two externally edited board files; the user must keep the in-memory version or reload the disk version.

## Themes and window sizes

**Previous problem:** Light/dark surfaces drifted between screens, muted text could be too faint, motion values were inconsistent, and the desktop shell degraded at 1024 x 700.

**Change made:** Centralized semantic light/dark/system theme values, strengthened text and focus tokens, added reduced-motion behavior, compacted Welcome and the editor toolbar, and made Properties collapse before the canvas becomes too narrow.

**Reason:** Theme and window-size behavior should be systematic rather than fixed independently in each component.

**Accessibility impact:** Focus remains visible in both themes, status meaning is not colour-only, and reduced-motion preferences suppress nonessential transitions.

**Remaining limitation:** The Properties panel uses a fixed desktop width rather than a persisted drag handle. This keeps the canvas behavior predictable and avoids a new layout dependency.

## Testing and evidence

The real application was compared at 1024 x 700, 1280 x 720, 1440 x 900, and 1920 x 1080. The capture fixture masks only test-owned workspace paths, storage size, fixed review date, and revision hashes. It disables incidental motion and uses repository-local media. Twenty-three reviewed after images cover the requested screens, and thirteen Windows Playwright baselines protect the critical surfaces.

Native open/save pickers remain operating-system-owned and are not treated as renderer visual baselines. CanvasNote-owned export, confirmation, command, Settings, missing-media, and save-recovery surfaces are covered.

Automated Axe checks cover Welcome, Settings, the empty Dashboard, and the empty editor at WCAG A/AA tags with no tldraw exclusions. Manual checks also covered Tab order, Escape, focus restoration, menu Arrow keys, paused timestamp seeking, visible non-colour save states, dark-theme contrast, and narrow-window panel collapse.

Storybook was not added. The reusable primitives are small and source-owned, while real Electron Playwright coverage exercises the actual focus, preload, tldraw, media, and theme boundaries with substantially less maintenance. The dependency decision table is recorded in [UI_UX_AUDIT.md](../../UI_UX_AUDIT.md#dependency-decision-table).

The tldraw licensing watermark must remain visible in development captures until the publisher configures a valid production tldraw licence. It must not be hidden through CSS, cropping, or documentation edits.
