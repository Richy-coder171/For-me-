# Contributing to CanvasNote

Thank you for improving CanvasNote. Keep changes focused, preserve local-first data safety, and never use personal workspace data as a fixture.

## Requirements

- Node.js 22.12 or newer; Node.js 24 LTS is recommended.
- npm 11 or newer.
- Git.

CanvasNote disables dependency lifecycle scripts in `.npmrc`. Run the explicit setup command after every clean install so Electron is downloaded and the bundled SQLite binary is verified.

## Setup

```bash
git clone https://github.com/Richy-coder171/For-me-.git
cd For-me-
npm ci
npm run setup
npm run dev
```

Use `npm install` instead of `npm ci` only when intentionally changing dependencies. Commit the resulting `package-lock.json` change with `package.json`.

## Architecture and security boundaries

Read [ARCHITECTURE.md](ARCHITECTURE.md), [FILE_FORMAT.md](FILE_FORMAT.md), and [SECURITY.md](SECURITY.md) before changing persistence or privileged operations.

- Electron main owns filesystem, SQLite, dialogs, exports, and external-open operations.
- The sandboxed renderer must not receive Node.js APIs, raw IPC, arbitrary paths, or unrestricted shell access.
- Preload exposes narrow domain methods; privileged handlers validate inputs again.
- Versioned `.canvasnote` JSON is the portable board source of truth. SQLite is a rebuildable index.
- Media paths remain workspace-relative and must pass containment and symlink checks.

Do not weaken these boundaries to simplify a UI feature or test.

## Branches and commits

Create a focused branch such as:

```text
feature/compact-toolbar
fix/save-recovery
docs/contribution-guide
test/dashboard-accessibility
```

Use concise imperative commits with a conventional prefix:

```text
feat: add keyboard board navigation
fix: preserve recovery state on close
docs: clarify workspace storage
test: cover missing media repair
chore: update development tooling
```

Keep generated output, installers, logs, local environment files, and unrelated formatting out of the commit.

## Quality checks

Run the checks relevant to the change. Before opening a pull request, the normal gate is:

```bash
npm run format:check
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

Do not weaken assertions or update screenshot baselines only to make a failure disappear. Review changed baselines manually in the real application.

## UI and accessibility changes

- Reuse CanvasNote's semantic tokens and source-owned UI primitives.
- Preserve visible keyboard focus, logical Tab order, Escape behavior, and focus restoration.
- Give icon-only controls accessible names and useful tooltips.
- Check light, dark, reduced-motion, and narrow-window states.
- Include sanitized before/after screenshots for visible changes.
- Manually verify the primary workflow with keyboard-only input.

Do not introduce a second component or icon system when the existing system can handle the change.

## Data-integrity changes

Changes to board schemas, migrations, autosave, backups, media, import/export, or recovery require focused tests and a manual save/reopen/restart check. Preserve unknown or unsupported content safely; never silently discard user data.

## Pull requests

1. Keep the pull request scoped to one coherent change.
2. Explain motivation, behavior, tests, accessibility, data-integrity impact, and security impact.
3. Include screenshots for visible changes using repository-local test data.
4. Confirm CI passes and disclose any check that could not be run.
5. Address review feedback with additional focused commits; maintainers may squash when merging.

Never commit personal `.canvasnote` workspaces, private board contents, user media, absolute machine paths, credentials, licence keys, logs, build output, or installer binaries.

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
