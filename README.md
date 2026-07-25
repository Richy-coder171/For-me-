# CanvasNote

CanvasNote is a local-first Electron desktop application for visual notes, media boards, and timestamped video research. It combines an infinite tldraw canvas with portable `.canvasnote` files and workspace-scoped local storage.

> Current status: secure workspaces, atomic `.canvasnote` persistence, the infinite canvas, portable media and video, timestamp seeking, link cards, local full-text search, editable templates, board import/export, settings, rotating backups, media repair, and save-before-close recovery are working. See [CHANGELOG.md](CHANGELOG.md).

The editor supports notes, checklists, images, file and link cards, local video, approved YouTube/Vimeo embeds, timestamp notes, native frames and connections, grouping, properties, undo/redo, a minimap, context actions, OS copy/cut/paste, image drag/drop and clipboard paste, camera persistence, and configurable debounced autosave. Press `N` for a note, `C` for a checklist, `I` to import an image, `Shift+V` to import a video, `F` for a frame, `L` for a connection, `Ctrl/Cmd+K` to search and focus an object, and `Ctrl/Cmd+S` to save immediately.

Use the header export control to save validated `.canvasnote` JSON or a rendered PNG/PDF of the whole board or current selection. Valid `.canvasnote` files can be imported from the welcome screen or dashboard; imports always receive a fresh board ID.

## Requirements

- Node.js 22.12 or newer (Node 24 LTS recommended)
- npm 11 or newer
- Windows, macOS, or Linux supported by Electron

No Python or C++ compiler is needed for the bundled `better-sqlite3` N-API binary. Dependency lifecycle scripts are disabled in `.npmrc`; the explicit setup command downloads Electron and verifies SQLite.

## Development

```bash
npm install
npm run setup
npm run dev
```

Quality commands:

```bash
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
```

`npm run check` runs type checking, linting, unit tests, and the production bundle. Electron workflow tests rebuild and then exercise the isolated desktop application.

Development works without a tldraw key. Set `VITE_TLDRAW_LICENSE_KEY` in `.env` before distributing a production build under an appropriate [tldraw license](https://tldraw.dev/community/license).

## Storage

CanvasNote creates all user-owned data inside a selected workspace:

```text
Workspace/
├── workspace.json
├── .canvasnote/index.sqlite3
├── boards/
├── trash/boards/
├── media/{images,videos,audio,files}/
├── thumbnails/
├── exports/
└── backups/
```

Board files are readable, versioned JSON with the `.canvasnote` extension. Media is stored as regular files and referenced with portable workspace-relative paths; large blobs are never embedded in JSON or SQLite.

## Security

The renderer is sandboxed with context isolation enabled and Node integration disabled. A small preload bridge exposes validated domain operations; all filesystem authority remains in the Electron main process. See [SECURITY.md](SECURITY.md).

## Documentation

- [Architecture](ARCHITECTURE.md)
- [File format](FILE_FORMAT.md)
- [Security](SECURITY.md)
- [Development plan](DEVELOPMENT_PLAN.md)
- [Changelog](CHANGELOG.md)
