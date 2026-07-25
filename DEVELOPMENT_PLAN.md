# CanvasNote development plan

CanvasNote is a single-user, local-first Electron application. The renderer owns presentation and the live tldraw editor; all filesystem, SQLite, dialog, export, and external-open operations stay in the main process behind a typed preload bridge.

## Architecture

```text
Electron main (trusted)
  ├─ workspace-scoped filesystem and atomic saves
  ├─ better-sqlite3 metadata/search index
  └─ narrow, Zod-validated IPC handlers
          ↓ contextBridge
React renderer (untrusted)
  ├─ dashboard and settings
  ├─ tldraw board editor
  └─ Zustand session/UI state
```

Board files are the portable source of truth. SQLite is a rebuildable index and stores workspace metadata, recent/favourite state, tags, activity, and trash records. Electron Store is limited to small device preferences.

## Delivery phases

Phases 1-4 are complete. The next implementation milestone is discovery, portability, settings, and recovery.

1. **Foundation** — Electron/Vite/React/TypeScript, secure main/preload boundary, Tailwind, schemas, tests, application shell, documentation.
2. **Workspace and dashboard** — workspace creation/opening, SQLite migrations, board CRUD, atomic `.canvasnote` files, recents, favourites, trash.
3. **Visual editor** — tldraw, text/checklist shapes, frames/arrows, properties, undo/redo, keyboard shortcuts, debounced autosave.
4. **Media and timestamps** — safe imports, image/file/video shapes, approved embeds, video timestamp notes and seek behavior, missing-media states.
5. **Discovery and portability** — board/in-board search, templates, JSON/PNG/PDF import/export, settings, backups and recovery.
6. **Quality** — schema/service/renderer tests, Electron workflow, accessibility, performance fixture, packaging and manual verification.

Each phase ends with passing relevant checks and a pushed Git commit.

## Data model

- `Workspace`: version, ID, name, created/updated timestamps.
- `Board`: format marker, version, stable ID, title, camera, tldraw-compatible nodes/connections, timestamps.
- `Node`: discriminated union for note, checklist, image, local/embedded video, timestamp note, link, file, and frame.
- `Connection`: stable ID, source/target anchors, optional label and visual style.
- Media remains in workspace folders and is referenced with normalized relative POSIX-style paths.

## File format

`.canvasnote` version 1 is UTF-8 JSON validated before load and save. Unknown newer versions are rejected without mutation. IDs must be unique, dimensions and timestamps finite/non-negative, references resolvable where required, and media paths relative and traversal-free. Saves use a temporary sibling, flush, backup rotation, then atomic replacement.

## IPC design

The preload exposes domain methods rather than `ipcRenderer`:

- `app`: version and platform information.
- `workspace`: create, open, recent, close, storage usage.
- `boards`: list, create, read, save, trash, restore, favourite, import.
- `media`: import, locate, reveal, open, resolve a safe playback URL.
- `export`: JSON, PNG, and PDF operations.
- `settings`: read and update validated preferences.

Every payload and response crossing the boundary is parsed with Zod. Renderer-provided filesystem paths are never trusted as authorization.

## Security plan

- `contextIsolation: true`, `nodeIntegration: false`, sandboxed renderer, no remote module, webviews, `eval`, or raw IPC exposure.
- A main-process workspace registry is the authority for all paths.
- Canonical path checks reject absolute, encoded/mixed-separator traversal and symlink escapes where practical.
- Media imports validate extension, detected MIME/signature where practical, size, and safe generated names.
- Navigation, popups, embeds, and external URLs use explicit HTTPS/provider allowlists and a restrictive CSP.
- Attached files are never executed; reveal/open actions are separately validated and user initiated.

## Test plan

- Vitest: schemas, path security, workspace and board services, atomic saves, migrations, media copy, timestamp utilities, search and autosave.
- React Testing Library: welcome/dashboard, editor actions, shortcuts, error and missing-media states.
- Playwright Electron: create workspace and board, add/edit objects and media, create/seek timestamp note, save, reopen and restart.
- Final gate: typecheck, lint, unit/integration tests, Electron workflow, production build, and a manual primary-flow smoke test.

## Major risks

- **Native SQLite ABI** — rebuild `better-sqlite3` for the pinned Electron version during install/package.
- **Video codecs** — report unsupported formats/codecs without losing node metadata; tests use Chromium-supported fixtures.
- **Canvas/API churn** — pin tldraw and keep custom-shape integration in a small renderer module.
- **Large media/boards** — stream copies, debounce persistence/indexing, keep videos unloaded until active, and test generated large boards.
- **Portable path safety** — persist only workspace-relative media paths and centralize canonical containment checks.
- **Export limits** — cap unsafe dimensions and report recoverable errors for oversized canvases.
