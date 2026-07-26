# `.canvasnote` file format

CanvasNote board files are UTF-8 JSON. The root format and version are mandatory so incompatible future files fail safely instead of being silently rewritten.

## Version 1

```json
{
  "format": "canvasnote-board",
  "version": 1,
  "id": "board-generated-id",
  "title": "Video Editing Research",
  "camera": { "x": 0, "y": 0, "zoom": 1 },
  "nodes": [],
  "connections": [],
  "createdAt": "2026-07-25T00:00:00.000Z",
  "updatedAt": "2026-07-25T00:00:00.000Z"
}
```

`nodes` is a discriminated union of `note`, `checklist`, `image`, `local-video`, `embedded-video`, `timestamp-note`, `link`, `file`, and `frame`. Connections store semantic endpoints separately from their visual route. Stable IDs let the renderer reconstruct tldraw shapes, native arrow bindings, groups, and frame parenting without persisting selection or other ephemeral session state.

Timestamp notes store a source video ID and non-negative seconds:

```json
{
  "id": "timestamp-01",
  "type": "timestamp-note",
  "videoNodeId": "video-01",
  "timestampSeconds": 155.4,
  "content": "Use this transition technique.",
  "x": 900,
  "y": 300,
  "width": 280,
  "height": 120,
  "rotation": 0,
  "locked": false,
  "tags": [],
  "createdAt": "2026-07-25T00:00:00.000Z",
  "updatedAt": "2026-07-25T00:00:00.000Z"
}
```

Missing timestamp/video and connection endpoints remain recoverable diagnostics so notes are not discarded when media is moved.

## Media references

Imported media is copied into the workspace and uses a relative path such as `media/videos/clip-id.webm`. Absolute paths, traversal, backslashes, blob URLs, data URLs, and base64 media are invalid. Version 1 does not define an external-file linking mode.

## Versioning

- Readers validate the complete envelope before editing.
- Version `1` changes remain backward-compatible and default missing optional values during migration.
- A structural breaking change increments `version` and requires an explicit migration.
- Unknown newer versions are rejected without mutation and are never downgraded or overwritten.
- Imports are size-limited before `JSON.parse`.

Board saves use a temporary sibling file, flush, rotating backup, and atomic replacement. A trailing newline is canonical but not required for import.
