# CanvasNote design system

CanvasNote uses source-owned React primitives and semantic CSS variables. The system is intentionally
small: the application keeps native HTML behavior and does not depend on a generic component theme.

## Principles

- Content and canvas objects receive priority over application chrome.
- Neutral surfaces use one restrained accent for selection, focus, and primary actions.
- Meaning is never communicated by colour alone.
- Desktop controls are compact, with a 32 px minimum for secondary actions and 40 px for primary
  controls.
- Focus, hover, active, disabled, saving, failure, and selected states are visually distinct.
- Motion lasts 120–160 ms and is removed by `prefers-reduced-motion`.

## Semantic tokens

Tokens live in `src/renderer/styles.css` and provide light and dark values.

| Group     | Tokens                                                                                                          |
| --------- | --------------------------------------------------------------------------------------------------------------- |
| Surfaces  | `--background`, `--surface`, `--surface-elevated`, `--surface-hover`, `--surface-active`, `--canvas-background` |
| Text      | `--text-primary`, `--text-secondary`, `--text-muted`, `--text-disabled`                                         |
| Borders   | `--border-subtle`, `--border-default`, `--border-strong`                                                        |
| Accent    | `--accent`, `--accent-hover`, `--accent-active`, `--accent-foreground`, `--selection`, `--focus-ring`           |
| Status    | `--success`, `--warning`, `--danger`, `--info`                                                                  |
| Elevation | `--shadow-sm`, `--shadow-md`, `--shadow-overlay`                                                                |
| Shape     | `--radius-sm`, `--radius-md`, `--radius-lg`                                                                     |
| Spacing   | `--space-1`, `--space-2`, `--space-3`, `--space-4`, `--space-6`, `--space-8`                                    |
| Controls  | `--control-sm`, `--control-md`, `--control-lg`                                                                  |
| Motion    | `--motion-fast`, `--motion-normal`                                                                              |
| Layers    | `--layer-menu`, `--layer-dialog`, `--layer-toast`                                                               |

The legacy `--canvas`, `--board`, `--ink`, `--muted`, `--faint`, `--line`, and `--accent-soft`
variables remain aliases while existing components migrate. New code should use semantic names.

Accent variants may change the accent, interaction shades, selection, and focus ring. They must not
change success, warning, danger, or information meaning.

## Typography

CanvasNote uses the operating system UI font stack; it does not download or bundle a font.

| Class               | Use                                    |
| ------------------- | -------------------------------------- |
| `.cn-app-title`     | Application or workspace identity      |
| `.cn-screen-title`  | One title per main screen              |
| `.cn-section-title` | Panel and section headings             |
| `.cn-card-title`    | Board and object-card headings         |
| `.cn-body`          | Normal explanatory copy                |
| `.cn-body-sm`       | Compact descriptions                   |
| `.cn-label`         | Form and control labels                |
| `.cn-caption`       | Secondary metadata                     |
| `.cn-shortcut`      | Keyboard shortcut hints                |
| `.cn-metadata`      | Paths, revisions, and technical values |

Do not render essential instructions below 12 px. Use monospaced metadata only for paths, revisions,
times, and keyboard shortcuts.

## React primitives

Primitives are exported from `src/renderer/components/ui`.

### Button and IconButton

- `Button` variants: `primary`, `secondary`, `quiet`, and `danger`.
- Sizes: `small`, `medium`, and `large`.
- Use `loading` for a pending action; it disables the control and exposes `aria-busy`.
- `IconButton` requires an accessible `aria-label` and derives its tooltip from that label unless an
  alternative `tooltip` is supplied.

### Dialog

- Uses native `<dialog>.showModal()` for top-layer modality and browser focus containment.
- Focus starts in the first body control, not the Close button.
- Escape calls `onClose`; focus returns to the invoking element.
- Backdrop dismissal is enabled by default and can be disabled for data-sensitive operations.
- A dialog has one primary footer action. Cancel and other actions use secondary or quiet styling.

### Feedback

- `info` and `success` use polite status announcements.
- `warning` and `danger` use alert announcements.
- Use inline field messages for validation, a toast for completed user-triggered work, and persistent
  Feedback for unresolved saving or recovery problems.

### EmptyState

- Includes a clear title, one sentence of explanation, one primary action, and at most one secondary
  action.
- Avoid decorative illustrations and multiple equal-weight buttons.

## Icons

Use `lucide-react` only. Standard shell icons are 16–18 px with the library's default stroke. Every
icon-only control needs an accessible label and tooltip. Do not use emoji or text glyphs as icons.

## Focus and keyboard behavior

All native controls and positive `tabindex` targets receive the shared two-pixel focus ring. Dialogs,
menus, and listboxes must additionally define:

- initial focus;
- Tab containment where modal;
- Arrow-key behavior where expected;
- Escape behavior;
- focus restoration.

Selected states use background/border shape plus colour. Disabled states remain legible and cannot be
the only explanation for why an action is unavailable.

## Theme and motion

Light, dark, and system themes use the same semantic token names. New component CSS must not hard-code
white, black, or brand colours when a semantic token exists.

The global reduced-motion rule shortens animations and transitions to effectively zero. Do not add an
animation library for shell transitions.
