export function getCanvasNoteMedia() {
  return window.canvasNote.media
}

export function toMediaUrl(relativePath: string): string | null {
  try {
    return getCanvasNoteMedia().toUrl(relativePath)
  } catch {
    return null
  }
}
