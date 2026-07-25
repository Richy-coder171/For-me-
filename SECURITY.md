# Security

CanvasNote treats the React renderer and imported workspace content as untrusted.

## Electron boundary

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- `webSecurity: true`
- webviews, popup creation, arbitrary navigation, and insecure mixed content disabled
- restrictive Content Security Policy with exact approved video-frame origins
- clipboard permission limited to CanvasNote's own main frame and read/write operations
- dependency-free preload exposing fixed domain methods only

The renderer never receives `ipcRenderer`, `fs`, unrestricted `shell`, process access, or generic read/write methods.

## IPC validation

Every privileged handler parses renderer input with a strict Zod schema. IDs, field sizes, URLs, paths, dimensions, timestamps, and board versions are bounded. Errors returned to the renderer are user-safe and do not needlessly disclose machine paths.

## Workspace path protection

The main process obtains workspace roots only from a native folder dialog or its own recent-workspace registry. Renderer input cannot authorize a filesystem root.

Portable paths must:

- be relative and use `/` separators;
- contain no empty, `.` or `..` segments;
- contain no drive letter, UNC/device prefix, NUL, encoded traversal, or mixed separators;
- resolve beneath the canonical active root.

Existing read targets, new-write parents, and the SQLite index path are realpath/lstat-checked to reject symbolic-link and junction escapes, including dangling links. Board JSON never stores absolute media paths. The active workspace root plus a validated relative path is the media authority; SQLite remains a rebuildable search index rather than an access-control boundary.

## Content and media

- Only HTTPS YouTube/Vimeo provider URLs become embeds; arbitrary iframe HTML is rejected.
- Link cards accept only HTTP(S) URLs and never run a remote metadata service in the first release.
- Files are streamed into kind-specific folders with generated names, bounded sizes, and validated extensions.
- Only an explicit set of common document/media formats can be opened; other regular attachments can be revealed but never launched by CanvasNote.
- Local media is served through a workspace-scoped custom protocol with fixed MIME types, byte ranges, and `nosniff` rather than exposed `file://` paths.

Security issues should be reported privately to the repository owner rather than posted with sensitive workspace data.
