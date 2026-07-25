# Changelog

All notable CanvasNote changes are documented here.

## 0.1.0 — in development

### Added

- Secure Electron, React, TypeScript, Vite, and Tailwind foundation.
- Sandboxed preload bridge with validated application and workspace operations.
- Local workspace creation, opening, recent-workspace tracking, and portable folder layout.
- Strict versioned workspace/board schemas and traversal-resistant relative path validation.
- Professional light/dark welcome experience.
- Vitest schema/security checks and a built-Electron Playwright isolation smoke test.
- Architecture, security, file-format, and phased development documentation.
- SQLite workspace index with versioned migrations, WAL, full-text search foundation, and rebuildable board metadata.
- Responsive board dashboard with search, grid/list views, favourites, storage usage, and accessible empty states.
- Board creation, opening, title editing, recent ordering, trash, restore, and permanent deletion.
- Bounded UTF-8 board reads, SHA-256 revision conflicts, serialized atomic saves, fsync, and five rotating backups.
- Corrupt-board isolation and an Electron workflow covering workspace/board creation, save, trash, restore, close, and reopen.
