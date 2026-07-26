# Security

CanvasNote treats the React renderer and imported workspace content as untrusted.

## Supported versions

CanvasNote is currently pre-release. Security fixes are considered for the latest code on the default branch on a best-effort basis; there is no long-term support or response-time guarantee yet.

| Version                             | Security support |
| ----------------------------------- | ---------------- |
| Latest default-branch code          | Best effort      |
| Older commits and unofficial builds | Not supported    |

## Reporting a vulnerability

Do not open a public issue, pull request, or discussion for a suspected active vulnerability.

This repository does not currently document a verified private security contact, and this policy does not claim that GitHub private vulnerability reporting is enabled.

- If the repository's Security tab displays a **Report a vulnerability** button, use that private form.
- If that button is absent, share details only through a private contact method that the repository owner has independently verified and published.
- Until a private channel is configured, do not post exploit details publicly or send sensitive workspace contents through an unverified account.

> **Owner configuration required:** Enable GitHub private vulnerability reporting or add a verified private contact before announcing security-reporting availability.

Include, when safe and relevant:

- CanvasNote version or commit hash and operating system;
- affected workflow and security impact;
- prerequisites and the smallest reproducible sequence;
- a minimal proof of concept using disposable, non-private data;
- whether workspace data was exposed, changed, or lost;
- suggested mitigations, if known.

Redact usernames, absolute paths, credentials, tokens, private board contents, and personal media. If data loss or corruption may be involved, stop editing the affected workspace and preserve a copy before further testing.

## Expected response process

After a monitored private channel is configured, maintainers will aim to:

1. acknowledge receipt without promising a fixed response time;
2. reproduce and assess severity and affected versions;
3. coordinate a fix and validation with the reporter when practical;
4. publish remediation guidance or an advisory after affected users have a reasonable update path.

CanvasNote does not currently operate a bug-bounty programme.

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
