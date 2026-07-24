/// <reference types="vite/client" />

import type { CanvasNoteApi } from '../shared/ipc'

declare global {
  interface Window {
    canvasNote: CanvasNoteApi
  }
}

export {}
