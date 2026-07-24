# Architecture

CanvasNote uses three runtime boundaries:

```text
Electron main process → secure preload bridge → React renderer
```

## Main process

The trusted main process owns native dialogs, workspace authorization, filesystem operations, atomic board saves, media imports, SQLite metadata/search, exports, preferences, and narrowly validated `shell` operations. It keeps one active workspace root as the authorization boundary.

## Preload bridge

The sandbox-compatible CommonJS preload is dependency-free and exposes domain methods through `contextBridge`. It does not expose `ipcRenderer`, generic channels, raw Node APIs, or arbitrary paths. Main-process handlers repeat Zod validation at the privileged boundary.

## Renderer

React renders welcome, dashboard, editor, and settings screens. Zustand stores only application/session UI state. The live tldraw store is the sole source of truth while a board is open; a serializer converts its document shapes, frames, arrows, and bindings into the readable CanvasNote board model for persistence. It is not mirrored into Zustand.

## Persistence

- Versioned `.canvasnote` JSON is authoritative board content.
- SQLite is a rebuildable metadata and full-text-search index.
- Electron Store contains only device preferences and approved recent workspace locations.
- Media remains on disk and is addressed by stable IDs plus portable relative paths.
- Saves are serialized, validated, flushed to a temporary sibling, backed up, and atomically renamed.

See [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) for delivery phases and [FILE_FORMAT.md](FILE_FORMAT.md) for persisted data.
