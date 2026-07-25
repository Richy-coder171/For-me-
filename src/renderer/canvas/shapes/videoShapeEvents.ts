import type { TLShapeId } from 'tldraw'

const MAX_TIMESTAMP_SECONDS = 604_800

export interface VideoController {
  getCurrentTime: () => number
  pause: () => void
  seek: (seconds: number) => void
}

export type VideoShapeEvent =
  | {
      type: 'timestamp-note-request'
      videoNodeId: string
      videoShapeId: TLShapeId
      timestampSeconds: number
    }
  | {
      type: 'video-seek-request'
      videoNodeId: string
      timestampSeconds: number
    }

type VideoShapeEventListener = (event: VideoShapeEvent) => void

const controllers = new Map<string, VideoController>()
const listeners = new Set<VideoShapeEventListener>()

function safeTimestamp(seconds: number): number {
  return Number.isFinite(seconds) ? Math.min(MAX_TIMESTAMP_SECONDS, Math.max(0, seconds)) : 0
}

export function registerVideoController(
  videoNodeId: string,
  controller: VideoController
): () => void {
  controllers.set(videoNodeId, controller)
  return () => {
    if (controllers.get(videoNodeId) === controller) controllers.delete(videoNodeId)
  }
}

export function getVideoCurrentTime(videoNodeId: string): number | null {
  const controller = controllers.get(videoNodeId)
  return controller ? safeTimestamp(controller.getCurrentTime()) : null
}

export function onVideoShapeEvent(listener: VideoShapeEventListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function requestTimestampNote(videoNodeId: string, videoShapeId: TLShapeId): void {
  const event: VideoShapeEvent = {
    type: 'timestamp-note-request',
    videoNodeId,
    videoShapeId,
    timestampSeconds: getVideoCurrentTime(videoNodeId) ?? 0
  }
  listeners.forEach((listener) => listener(event))
}

export function requestVideoSeek(videoNodeId: string, timestampSeconds: number): boolean {
  const seconds = safeTimestamp(timestampSeconds)
  const controller = controllers.get(videoNodeId)
  if (controller) {
    controller.pause()
    controller.seek(seconds)
  }
  const event: VideoShapeEvent = {
    type: 'video-seek-request',
    videoNodeId,
    timestampSeconds: seconds
  }
  listeners.forEach((listener) => listener(event))
  return Boolean(controller)
}
