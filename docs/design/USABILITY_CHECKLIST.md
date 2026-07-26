# CanvasNote usability checklist

Use an isolated test workspace containing no personal board data or media. Record the application
version, operating system, window size, theme, result, and any remaining friction for each run.

## New-user workflow

- [ ] Launch CanvasNote and identify Create workspace and Open workspace without scrolling.
- [ ] Create a workspace using only the keyboard.
- [ ] Create a blank board.
- [ ] Add and edit a note.
- [ ] Add and complete a checklist item.
- [ ] Import an image and provide alternative text.
- [ ] Import a local video.
- [ ] Pause the video and add a timestamp note.
- [ ] Save the board and return to the dashboard.
- [ ] Reopen the board and confirm every object is unchanged.

## Existing-user workflow

- [ ] Open a recent workspace and understand its path and last-opened state.
- [ ] Find a board using dashboard search.
- [ ] Open Ctrl/Cmd+K and find an object without seeing an internal ID.
- [ ] Edit object content and understand Unsaved, Saving, Saved, and Save failed states.
- [ ] Export valid JSON, PNG, and PDF output.
- [ ] Identify missing media and complete the available recovery action.

## Keyboard-user workflow

- [ ] Tab through Welcome actions in visual order.
- [ ] Navigate recent workspaces and board cards without a pointer.
- [ ] Open and close Settings; focus returns to the invoking control.
- [ ] Open Ctrl/Cmd+K; use Up/Down, Enter, and Escape.
- [ ] Select canvas tools using keyboard focus and verify the active state is not colour-only.
- [ ] Edit Properties fields without triggering global delete or tool shortcuts.
- [ ] Open a card/context menu with the keyboard and navigate it with Arrow keys.
- [ ] Close every dialog with Escape and verify background content was not focusable while open.

## Data-safety and recovery workflow

- [ ] Simulate an ordinary save failure and confirm the message remains visible.
- [ ] Retry the save successfully.
- [ ] Simulate an external revision conflict and preserve the unsaved board as a recovery copy.
- [ ] Close during a pending edit and confirm the renderer flushes before exit.
- [ ] Restart CanvasNote and verify the pending edit was recovered.
- [ ] Confirm rotating backups remain present and openable.

## Window and theme matrix

- [ ] 1024×700, light
- [ ] 1024×700, dark
- [ ] 1280×720, light
- [ ] 1440×900, light
- [ ] 1440×900, dark
- [ ] 1920×1080, light

At each size verify:

- [ ] No shell-level horizontal scrollbar.
- [ ] Toolbar actions remain reachable.
- [ ] Board title truncates without covering save status or actions.
- [ ] Properties can be opened and closed.
- [ ] Dialogs stay inside the viewport.
- [ ] Canvas, native video controls, zoom, and minimap remain usable.

## Manual accessibility review

- [ ] Visible focus is present on every interactive control.
- [ ] Tab order follows the visual hierarchy.
- [ ] Icon-only actions have accessible names and useful tooltips.
- [ ] Status and error changes are announced through an appropriate live region.
- [ ] Text and controls remain understandable without colour.
- [ ] Light and dark text contrast is readable at normal zoom.
- [ ] Reduced-motion preference removes nonessential transitions.
- [ ] Destructive confirmations name the exact consequence.

## Baseline friction observed on 2026-07-26

- Welcome requires vertical scrolling at 1024×700 and prioritizes decorative content over recent
  workspaces.
- The vertical editor toolbar can be clipped at the minimum supported window height.
- Properties opens without a selection and removes significant canvas width.
- Dialog focus is not trapped or restored consistently.
- Ctrl/Cmd+K searches objects but does not expose application commands.
- Save failure remains visible but has no Retry or recovery-copy action.
- Missing and unsupported video states are not distinguished.
- The tldraw watermark remains until a valid licence is configured.
