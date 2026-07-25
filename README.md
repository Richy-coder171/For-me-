# CanvasNote

CanvasNote is a local-first Electron desktop application for visual notes, media boards, and timestamped video research. It combines an infinite tldraw canvas with portable `.canvasnote` files and workspace-scoped local storage.

> Current status: secure workspaces, the SQLite-backed dashboard, board lifecycle, and atomic `.canvasnote` persistence are working. The infinite editor is the next milestone; see [CHANGELOG.md](CHANGELOG.md).

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

`npm run check` runs type checking, linting, unit tests, and the production bundle. Electron workflow tests use the built application.

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
