# CanvasNote UI/UX audit

Date: 2026-07-26  
Baseline: `5178ea0` plus the development-only CSP fix already on `main`  
Review sizes: 1024×700, 1440×900, and 1920×1080  
Evidence: [`docs/design/before`](docs/design/before)

## Executive summary

CanvasNote already has a coherent local-first workflow, a strong sandbox boundary, and useful
role-based labels. The main usability problems are concentrated in the application shell rather
than the canvas engine:

- The welcome screen reads like a marketing page instead of a desktop workspace launcher.
- The editor toolbar can be clipped at the supported minimum height, hiding Undo and Redo.
- The properties panel consumes canvas space even when nothing is selected and becomes obstructive
  at 1024×700.
- Save failures and external revision conflicts have no clear, data-preserving recovery path.
- Dialogs look related but do not consistently trap or restore focus.
- The existing Ctrl/Cmd+K surface searches objects but is not yet a command palette.
- Small, low-contrast metadata and inconsistent focus treatments weaken accessibility.
- Dashboard cards expose secondary actions instead of using a compact keyboard-accessible menu.
- Dark canvas cards mix semantic theme colours with hard-coded white, blue, and black values.

The redesign should preserve tldraw and all storage/IPC behavior. It should first establish semantic
tokens and source-owned primitives, then simplify the three main shells: Welcome, Dashboard, and
Board Editor.

## Priority definitions

- **P0 — unusable:** a supported workflow or recovery path is inaccessible or unsafe.
- **P1 — major:** a substantial usability, accessibility, or data-confidence problem.
- **P2 — important:** visible inconsistency or friction that reduces product quality.
- **P3 — optional:** polish that can wait without harming the workflow.

## Cross-application findings

| Priority | Finding                                                                                                                                 | Evidence                                                          | Proposed solution                                                                                                           |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| P0       | The 13-button vertical toolbar is taller than the canvas area at the 900×620 minimum window, so its bottom actions can be clipped.      | `BoardEditor.tsx`, `styles.css`; baseline narrow editor           | Move Undo/Redo into the header, keep primary creation tools visible, and place rare additions in one accessible Add menu.   |
| P0       | An external revision conflict can leave save, Back, and editable JSON export blocked with no Reload or recovery-copy action.            | `BoardEditor.tsx`, `boardService.ts`; baseline save-failure state | Keep the failure persistent and offer Retry plus a data-preserving recovery/export action before any discard/reload action. |
| P1       | Focus styling is implemented separately across utility classes and canvas CSS; several controls have no visible common focus treatment. | `styles.css`, shape CSS, Dashboard                                | Add one high-visibility `:focus-visible` system and common control primitives.                                              |
| P1       | Dialogs lack a consistent focus trap, initial focus, Escape behavior, and focus restoration.                                            | Settings, search, export, embed, and link dialogs                 | Use the native `<dialog>` top layer through one source-owned Dialog primitive.                                              |
| P1       | Text rendered with `--faint` is frequently 10–11 px and too low contrast, especially in dark mode.                                      | Welcome footer, dashboard metadata, properties labels             | Raise the desktop type floor and strengthen semantic muted/disabled colours.                                                |
| P1       | Errors can appear twice: locally and in the global toast.                                                                               | Welcome and global App feedback                                   | Use one feedback policy: inline validation, toast for completed background work, persistent banner for unresolved failures. |
| P1       | The application briefly shows Welcome while initialization/default-workspace loading is unresolved.                                     | `App.tsx`, `appStore.ts`                                          | Add an initialized state and a quiet application-shell loading view.                                                        |
| P2       | Radius, shadow, spacing, z-index, transition, and control-height values are repeated.                                                   | `styles.css` and Tailwind utilities                               | Introduce semantic tokens and keep old names as aliases during migration.                                                   |
| P2       | Three button styles and shape-local controls drift visually.                                                                            | App components and shape files                                    | Add small Button and IconButton primitives; do not install a second component library.                                      |
| P2       | Several generic containers carry ARIA labels without an appropriate landmark/group role.                                                | Brand mark, board view, zoom controls                             | Use semantic elements or add the correct role.                                                                              |

## Screen audit

### Welcome screen

**Purpose:** create, open, or resume a workspace and import a portable board.

**What works**

- Create, open, recent, import, Settings, and appearance actions are all present.
- Workspace creation supports Enter and has a clear busy state.
- Recent workspace paths are truncated instead of breaking the layout.

**Problems**

- **P1 visual/usability:** the large headline, marketing copy, and decorative board dominate the
  primary desktop decisions.
- **P1 responsive:** at 1024×700 the illustration moves below the actions and creates a long page
  scrollbar; recent workspaces fall below the fold.
- **P1 feedback:** initialization has no explicit loading or empty state and errors are duplicated by
  the global toast.
- **P2 information:** recent entries omit the available last-opened time; truncated paths lack a
  full-path tooltip.
- **P2 accessibility:** the brand name is attached to a generic `div`; the two secondary text actions
  are less prominent than their importance warrants.

**Proposed solution:** replace the hero with a compact two-column workspace launcher. Present Create
and Open as equal primary decisions, Import as secondary, and a scrollable recent list with name,
path, last-opened time, missing-location state, and clear keyboard focus.

### Dashboard

**Purpose:** navigate workspace views, search boards, create/import boards, and manage lifecycle.

**What works**

- Sidebar hierarchy, grid/list modes, search, templates, favourites, and Trash already exist.
- Empty states state the consequence and usually provide one useful action.
- Cards show title, updated time, item count, and a deterministic local thumbnail.

**Problems**

- **P1 interaction:** favourite and trash actions are repeated on every card instead of living in an
  accessible context menu; destructive actions have no product-styled confirmation.
- **P1 loading:** dashboard refresh replaces content without a skeleton or row-level pending state.
- **P1 keyboard:** board-grid roving navigation and a keyboard-accessible card menu are missing.
- **P2 visual:** the header, sidebar, cards, counters, controls, and storage footer use several
  slightly different radii and weights.
- **P2 continuity:** returning from a board does not deliberately preserve scroll position.

**Proposed solution:** retain the information architecture, standardize the shell, add skeleton rows,
and place secondary card actions in one menu with Arrow/Escape behavior and consequence-specific
confirmation for permanent deletion.

### Templates and Trash

**Purpose:** create from known layouts and recover or permanently delete boards.

**What works**

- Both are first-class sidebar destinations with clear headings and counts.
- Template descriptions are concise; empty Trash explains that restoration is possible.

**Problems**

- **P1 destructive safety:** permanent deletion currently relies on native `window.confirm`, which is
  visually inconsistent and cannot explain board-specific consequences well.
- **P2 visual:** template number tiles are decorative and consume attention without conveying type or
  preview.
- **P2 feedback:** template creation and restore/delete operations have no localized pending state.

**Proposed solution:** use template preview thumbnails or restrained icons, standard feedback, and a
single ConfirmationDialog for permanent deletion only.

### Empty board

**Purpose:** provide an infinite canvas ready for the first object.

**What works**

- The canvas is immediately interactive and primary creation tools are visible.
- Save state, zoom, minimap, and Back are available.

**Problems**

- **P1 onboarding:** the canvas is completely blank; a new user gets no short explanation of note,
  paste, or drop workflows.
- **P1 layout:** an empty 280 px properties panel is open by default and removes useful canvas width.
- **P0 responsive:** the full vertical toolbar can exceed the minimum-height canvas.
- **P2 visual:** the tldraw licensing watermark remains visible. It must not be hidden without a valid
  licence; repository claims and screenshots must acknowledge it.

**Proposed solution:** default properties closed until selection, add a small dismissible canvas hint,
and compact the toolbar without changing tldraw interactions.

### Populated board and toolbar

**Purpose:** create, arrange, connect, edit, save, search, and export mixed canvas objects.

**What works**

- All requested object types are reachable in one level.
- Active Select/Pan treatment, separators, shortcuts in native tooltips, and disabled Undo/Redo states
  already exist.
- Zoom-to-fit and the minimap help recover orientation.

**Problems**

- **P0 clipping:** rare actions and history controls share one tall vertical rail.
- **P1 hierarchy:** import, embed, link, file, frame, connection, and history controls all receive the
  same visual weight.
- **P1 keyboard:** unfamiliar icon-only buttons rely on `title`, whose timing and accessibility are
  inconsistent; the minimap is mouse-only despite being interactive.
- **P2 focus:** selected tools rely heavily on accent colour with only a subtle background change.

**Proposed solution:** keep Select, Pan, Note, Checklist, Image, Video, Frame, and Connection visible;
move history to the top bar; group Link/File/Embed under an Add menu; add consistent tooltips and
shape plus colour active indication.

### Properties panel

**Purpose:** edit only the selected object's relevant content, appearance, media, and lifecycle data.

**What works**

- The panel changes by shape type and supports exact inputs, tags, duplicate, lock, and delete.
- Image/video replacement and timestamp creation are exposed for the relevant shapes.

**Problems**

- **P1 responsive:** fixed width consumes more than a quarter of a 1024 px window and the existing
  sheet breakpoint is below Electron's practical minimum width.
- **P1 hierarchy:** fields are one uninterrupted list without Content, Appearance, Media, Timestamp,
  or Advanced sections.
- **P1 video workflow:** a selected video has no compact list of its linked timestamp notes.
- **P2 validation:** number and text updates have no shared inline validation/message space.
- **P2 discoverability:** close, duplicate, lock, and delete placement varies in visual emphasis.

**Proposed solution:** collapse automatically below roughly 1080 px, use native `<details>` groups,
keep destructive actions last, and show linked timestamp items for a selected video.

### Notes, checklists, images, links, files, frames, and connections

**Purpose:** present readable, distinguishable objects on one related visual system.

**What works**

- Notes and checklists prioritize editable content.
- Timestamp notes expose time as a strong identifier.
- Link cards expose a safe external-open action and domain.
- Missing file cards explain that the attachment is unavailable.

**Problems**

- **P1 theme:** media cards and controls combine semantic variables with hard-coded white, black,
  and blue values, producing inconsistent dark mode.
- **P1 accessibility:** checklist controls can be smaller than a comfortable desktop target; locked
  state and selection still depend heavily on colour.
- **P2 consistency:** note palettes and card shadows are duplicated across several files.
- **P2 canvas order:** newly created frames can visually cover existing content until manually sent
  behind, which is surprising for a framing tool.

**Proposed solution:** centralize shape-card variables and palettes, enlarge interactive controls,
add non-colour state cues, and ensure new frames remain behind content.

### Video and timestamp workflow

**Purpose:** review video, pause at a moment, create a linked note, and seek back to that moment.

**What works**

- Native controls do not drag the canvas, autoplay is disabled, seeking pauses the video, and the
  timestamp action is available both on-card and in Properties.
- The timestamp note selects and focuses its linked video.

**Problems**

- **P1 recovery:** missing files and unsupported codecs both become “Video is unavailable”; Replace
  is separated in Properties rather than shown beside the failure.
- **P1 hierarchy:** the card and Properties repeat competing timestamp controls.
- **P1 keyboard:** global shortcuts must continue to ignore focused native video controls.
- **P2 information:** current time and duration are left entirely to browser controls and linked
  timestamps have no selected-video list.

**Proposed solution:** keep one strong “Add timestamp” action, distinguish missing versus playback
failure, colocate Replace/Locate/Repair where supported, and list linked timestamps in Properties.

### Search / command surface

**Purpose:** find and focus board objects without exposing internal IDs.

**What works**

- Ctrl/Cmd+K opens quickly; text, type, and tag filters work; Up/Down, Enter, and Escape are handled.
- Matched text is highlighted and raw IDs stay hidden.

**Problems**

- **P1 scope:** this is only object search, not the requested command palette; board/app commands are
  absent.
- **P1 accessibility:** visual active state is not announced through `aria-activedescendant`.
- **P1 modality:** focus is not trapped/restored and Ctrl/Cmd+K can be handled before all modal/editable
  guards.
- **P2 feedback:** no recent-command category or actionable no-results suggestions.

**Proposed solution:** extend the same surface with categorized Commands and Objects, deterministic
keyboard selection, recent commands, and correct combobox/listbox relationships. Do not add `cmdk`.

### Settings

**Purpose:** configure appearance, saving, media defaults, backups, shortcuts, privacy, and paths.

**What works**

- Changes persist immediately and data-safety explanations are present.
- App-data, workspace, and backup locations are visible or openable.

**Problems**

- **P1 organization:** one long modal combines unrelated settings and hides lower sections below an
  internal scrollbar.
- **P1 modality:** no focus trap/restoration or explicit save status.
- **P1 missing control:** appearance cannot be reset to defaults.
- **P2 information:** diagnostics/about are incomplete; no supported logs-folder action exists.
- **P2 responsive:** two-column fields become dense before the modal reaches its narrow layout.

**Proposed solution:** use compact navigation for Appearance, Canvas, Saving, Media, Backups,
Shortcuts, Privacy & security, Diagnostics, and About; show immediate-save status and Reset
appearance; do not invent a logs action until the main process actually exposes one.

### Feedback, loading, and recovery

**Purpose:** communicate pending, successful, failed, conflicting, and recoverable persistence work.

**What works**

- Board state distinguishes Unsaved, Saving, Saved, and Save failed.
- Autosave does not create noisy success toasts.

**Problems**

- **P0 recovery:** save conflict/failure has no Retry or recovery-copy affordance.
- **P1 persistence:** the error toast can be dismissed while the unresolved failure remains.
- **P1 language:** raw IPC/service errors can reach the interface.
- **P1 loading:** initialization and board-list loading have no stable skeleton/status.

**Proposed solution:** add `SaveStatus`, a persistent `SaveFailureBanner`, readable error mapping, Retry,
and a recovery export path. Use toast only for completed user-triggered background actions.

## Window-size review

| Size      | Current result                                                                                                       | Priority | Required change                                                                 |
| --------- | -------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------- |
| 1024×700  | Welcome scrolls like a web landing page; Properties removes substantial canvas width; minimap overlaps useful space. | P1       | Compact welcome, auto-collapse Properties, keep search/dialogs inside viewport. |
| 1280×720  | Editor is usable but the vertical toolbar approaches the available height.                                           | P0       | Shorten toolbar and relocate history actions.                                   |
| 1440×900  | Primary workflows are usable; visual hierarchy and modal behavior remain inconsistent.                               | P1/P2    | Apply design system and shared primitives.                                      |
| 1920×1080 | Large empty regions make content grouping feel weak; fixed Properties width is acceptable.                           | P2       | Keep content widths intentional without adding decorative cards.                |

## Dependency decision table

| Option                   | Status     | Decision and reason                                                                                               | Licence                                        | Bundle impact              | Security impact                                               |
| ------------------------ | ---------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | -------------------------- | ------------------------------------------------------------- |
| `lucide-react`           | Installed  | Keep as the only application icon family.                                                                         | ISC                                            | Existing, tree-shaken      | Renderer-only SVG components; no new privilege.               |
| Playwright               | Installed  | Use its native screenshot assertions and Electron driver.                                                         | Apache-2.0                                     | Test-only                  | No packaged application impact.                               |
| `@axe-core/playwright`   | Needed     | Add dev-only for automated WCAG A/AA checks on critical screens.                                                  | MPL-2.0                                        | Test-only                  | Runs in test pages; no runtime permission.                    |
| shadcn/ui                | Not needed | Existing source can provide the few primitives required; avoid a second theme/Radix stack.                        | Generated components vary; verify individually | Potentially medium         | More renderer dependencies and focus abstractions to audit.   |
| `react-resizable-panels` | Deferred   | Native fixed/collapsible panel behavior is sufficient initially; add only if measured resizing remains necessary. | MIT                                            | Small runtime dependency   | No privilege, but added pointer/keyboard interaction surface. |
| `cmdk`                   | Not needed | Extend the existing Ctrl/Cmd+K search instead of creating a competing system.                                     | MIT                                            | Runtime dependency avoided | Avoids another focus-management layer.                        |
| `@floating-ui/react`     | Not needed | Existing menus already clamp to the viewport; add only after a reproduced collision defect.                       | MIT                                            | Runtime dependency avoided | Avoids portal/positioning complexity.                         |
| Storybook + addon-a11y   | Deferred   | Real Electron Playwright coverage gives more value for this integrated desktop UI.                                | MIT                                            | Large dev dependency       | No runtime impact, but substantial maintenance surface.       |

## Baseline capture review

Twenty-one deterministic application screenshots were captured with an isolated workspace and no
personal media. Native operating-system file pickers are intentionally absent because renderer
Playwright cannot capture them deterministically. The recovery baseline is represented by the real
persistent save-failure state. Remote embeds were excluded to avoid network-dependent pixels.

Known baseline limitations:

- Settings screenshots contain only a repository-local temporary path, not personal workspace data.
- The deterministic Chromium video is intentionally synthetic.
- The tldraw licensing watermark is visible. CanvasNote must use a valid tldraw licence before it can
  remove that watermark or present release screenshots without it.

## Implementation order

1. Semantic tokens, type/focus foundations, and small source-owned primitives.
2. Initialization and shared feedback behavior.
3. Welcome and Dashboard redesign.
4. Compact editor shell, toolbar, and responsive Properties behavior.
5. Properties grouping, media/timestamp recovery, and command palette extension.
6. Keyboard/modal accessibility and automated Axe checks.
7. Reviewed after screenshots and Playwright visual baselines.
8. Repository documentation, contribution workflows, Dependabot, and CI.
