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
- Infinite tldraw editor with native pan/select, zoom, frames, connections, grouping, locking, duplication, deletion, and undo/redo.
- Editable text-note and checklist shapes with lightweight Markdown-style display, progress, tags, color, font, and alignment properties.
- Readable board-to-tldraw serialization for notes, checklists, frames, groups, arrows, bindings, and camera state.
- Serialized 750 ms autosave with manual save, failure state, SHA-256 revision checks, and flush-before-navigation behavior.
- Keyboard-first canvas commands and an offline core editor that does not fetch tldraw UI assets from a CDN.
- Unit coverage for custom shapes, serialization, and autosave plus an Electron workflow that verifies note/checklist content after restart.
- Workspace-scoped image and file imports with streamed copies, generated filenames, explicit size/type limits, and no absolute paths in board data.
- Secure `canvasnote-media:` delivery with containment checks, enforced MIME types, byte-range support, and a narrow preload API for open/reveal actions.
- Resizable image shapes with contain/cover, captions, alternative text, tags, missing-media handling, and open-original actions.
- Portable file cards with filename/type/size metadata, tags, open/reveal actions, and explicit missing-file feedback.
- Serializer preservation for valid node types that an older editor cannot render, preventing camera/title autosaves from silently dropping future content.
- Accessible checklist item reordering and Electron coverage for imported media persistence and protocol range requests.
