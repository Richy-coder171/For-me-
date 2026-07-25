import { useEffect, useMemo, useRef, type CSSProperties, type SyntheticEvent } from 'react'
import {
  BaseBoxShapeUtil,
  HTMLContainer,
  T,
  createShapeId,
  resizeBox,
  useEditor,
  useIsEditing,
  type RecordProps,
  type TLResizeInfo,
  type TLShape,
  type TLShapePartial
} from 'tldraw'

import { registerVideoController, requestTimestampNote } from './videoShapeEvents'

export const CN_EMBEDDED_VIDEO_TYPE = 'cn-embedded-video' as const
export const EMBEDDED_VIDEO_MIN_WIDTH = 320
export const EMBEDDED_VIDEO_MIN_HEIGHT = 240

export type EmbeddedVideoProvider = 'youtube' | 'vimeo'

export interface ParsedEmbeddedVideo {
  provider: EmbeddedVideoProvider
  url: string
  videoId: string
}

export interface CNEmbeddedVideoShapeProps {
  w: number
  h: number
  provider: EmbeddedVideoProvider
  url: string
  videoId: string
  caption: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

declare module '@tldraw/tlschema' {
  interface TLGlobalShapePropsMap {
    'cn-embedded-video': CNEmbeddedVideoShapeProps
  }
}

export type CNEmbeddedVideoShape = TLShape<typeof CN_EMBEDDED_VIDEO_TYPE>

export function isCNEmbeddedVideoShape(shape: TLShape): shape is CNEmbeddedVideoShape {
  return shape.type === CN_EMBEDDED_VIDEO_TYPE
}

const PROVIDER_ORIGINS: Record<EmbeddedVideoProvider, string> = {
  youtube: 'https://www.youtube-nocookie.com',
  vimeo: 'https://player.vimeo.com'
}

const PROVIDER_HOSTS: Record<EmbeddedVideoProvider, ReadonlySet<string>> = {
  youtube: new Set([
    'youtube.com',
    'www.youtube.com',
    'm.youtube.com',
    'youtu.be',
    'youtube-nocookie.com',
    'www.youtube-nocookie.com'
  ]),
  vimeo: new Set(['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'])
}

export function parseEmbeddedVideoUrl(value: string): ParsedEmbeddedVideo | null {
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'https:' || url.username || url.password) return null
    const host = url.hostname.toLowerCase()
    let provider: EmbeddedVideoProvider
    let videoId: string | null = null
    if (PROVIDER_HOSTS.youtube.has(host)) {
      provider = 'youtube'
      if (host === 'youtu.be') videoId = url.pathname.split('/').filter(Boolean)[0] ?? null
      else if (url.pathname === '/watch') videoId = url.searchParams.get('v')
      else {
        const parts = url.pathname.split('/').filter(Boolean)
        if (parts[0] === 'embed' || parts[0] === 'shorts') videoId = parts[1] ?? null
      }
    } else if (PROVIDER_HOSTS.vimeo.has(host)) {
      provider = 'vimeo'
      const parts = url.pathname.split('/').filter(Boolean)
      videoId = (parts[0] === 'video' ? parts[1] : parts[0]) ?? null
    } else {
      return null
    }
    if (!videoId || !normalizeEmbeddedVideoUrl(provider, url.href, videoId)) return null
    return { provider, url: url.href, videoId }
  } catch {
    return null
  }
}

export function normalizeEmbeddedVideoUrl(
  provider: EmbeddedVideoProvider,
  url: string,
  videoId: string,
  playerId = 'canvasnote-player'
): string | null {
  try {
    const parsed = new URL(url)
    if (
      parsed.protocol !== 'https:' ||
      parsed.username ||
      parsed.password ||
      !PROVIDER_HOSTS[provider].has(parsed.hostname.toLowerCase())
    ) {
      return null
    }
    if (provider === 'youtube') {
      if (!/^[A-Za-z0-9_-]{6,64}$/.test(videoId)) return null
      return `${PROVIDER_ORIGINS.youtube}/embed/${videoId}?enablejsapi=1`
    }
    if (!/^\d{1,20}$/.test(videoId)) return null
    return `${PROVIDER_ORIGINS.vimeo}/video/${videoId}?api=1&player_id=${encodeURIComponent(playerId)}`
  } catch {
    return null
  }
}

function nodeId(shape: CNEmbeddedVideoShape): string {
  return typeof shape.meta.canvasNoteId === 'string'
    ? shape.meta.canvasNoteId
    : shape.id.replace(/^shape:/, '')
}

function playerId(shape: CNEmbeddedVideoShape): string {
  return `canvasnote-${shape.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`
}

export function getDefaultCNEmbeddedVideoProps(
  now = new Date().toISOString()
): CNEmbeddedVideoShapeProps {
  return {
    w: 480,
    h: 360,
    provider: 'youtube',
    url: 'https://www.youtube.com/watch?v=missing',
    videoId: 'missing',
    caption: '',
    tags: [],
    createdAt: now,
    updatedAt: now
  }
}

export function createCNEmbeddedVideoShape(
  x = 0,
  y = 0,
  props: Partial<CNEmbeddedVideoShapeProps> = {}
): TLShapePartial<CNEmbeddedVideoShape> {
  return {
    id: createShapeId(),
    type: CN_EMBEDDED_VIDEO_TYPE,
    x,
    y,
    props: { ...getDefaultCNEmbeddedVideoProps(), ...props }
  }
}

export class CNEmbeddedVideoShapeUtil extends BaseBoxShapeUtil<CNEmbeddedVideoShape> {
  static override type = CN_EMBEDDED_VIDEO_TYPE
  static override props: RecordProps<CNEmbeddedVideoShape> = {
    w: T.nonZeroNumber,
    h: T.nonZeroNumber,
    provider: T.literalEnum('youtube', 'vimeo'),
    url: T.string,
    videoId: T.string,
    caption: T.string,
    tags: T.arrayOf(T.string),
    createdAt: T.string,
    updatedAt: T.string
  }

  override canEdit() {
    return true
  }

  override canResize() {
    return true
  }

  override isAspectRatioLocked() {
    return false
  }

  override getDefaultProps(): CNEmbeddedVideoShape['props'] {
    return getDefaultCNEmbeddedVideoProps()
  }

  override onResize(shape: CNEmbeddedVideoShape, info: TLResizeInfo<CNEmbeddedVideoShape>) {
    return resizeBox(shape, info, {
      minWidth: EMBEDDED_VIDEO_MIN_WIDTH,
      minHeight: EMBEDDED_VIDEO_MIN_HEIGHT
    })
  }

  override onBeforeUpdate(previous: CNEmbeddedVideoShape, next: CNEmbeddedVideoShape) {
    if (previous.props.updatedAt !== next.props.updatedAt) return
    return { ...next, props: { ...next.props, updatedAt: new Date().toISOString() } }
  }

  override getText(shape: CNEmbeddedVideoShape) {
    return [shape.props.caption, shape.props.url, ...shape.props.tags].filter(Boolean).join('\n')
  }

  component(shape: CNEmbeddedVideoShape) {
    return <EmbeddedVideoShape shape={shape} />
  }

  override getIndicatorPath(shape: CNEmbeddedVideoShape): Path2D {
    const indicator = new Path2D()
    indicator.roundRect(0, 0, shape.props.w, shape.props.h, 8)
    return indicator
  }
}

function messageObject(value: unknown): Record<string, unknown> | null {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

function timeFromMessage(provider: EmbeddedVideoProvider, value: unknown): number | null {
  const message = messageObject(value)
  if (!message) return null
  if (provider === 'youtube') {
    const info = messageObject(message.info)
    return typeof info?.currentTime === 'number' && Number.isFinite(info.currentTime)
      ? info.currentTime
      : null
  }
  const data = messageObject(message.data)
  const seconds = data?.seconds ?? message.value
  return typeof seconds === 'number' && Number.isFinite(seconds) ? seconds : null
}

function postToPlayer(
  frame: HTMLIFrameElement | null,
  provider: EmbeddedVideoProvider,
  message: Record<string, unknown>
): void {
  frame?.contentWindow?.postMessage(
    provider === 'youtube' ? JSON.stringify(message) : message,
    PROVIDER_ORIGINS[provider]
  )
}

const cardStyle: CSSProperties = {
  display: 'flex',
  width: '100%',
  height: '100%',
  flexDirection: 'column',
  gap: 8,
  overflow: 'hidden',
  border: '1px solid rgba(255,255,255,.16)',
  borderRadius: 8,
  background: '#17191f',
  padding: 10,
  color: '#f7f7f8',
  boxShadow: '0 6px 18px rgba(15,23,42,.16)',
  fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif'
}

const controlStyle: CSSProperties = {
  border: '1px solid rgba(255,255,255,.2)',
  borderRadius: 5,
  background: '#282c35',
  padding: '5px 8px',
  color: 'inherit',
  font: 'inherit'
}

function EmbeddedVideoShape({ shape }: { shape: CNEmbeddedVideoShape }) {
  const editor = useEditor()
  const isEditing = useIsEditing(shape.id)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const currentTime = useRef(0)
  const videoNodeId = nodeId(shape)
  const frameId = playerId(shape)
  const source = useMemo(
    () =>
      normalizeEmbeddedVideoUrl(
        shape.props.provider,
        shape.props.url,
        shape.props.videoId,
        frameId
      ),
    [frameId, shape.props.provider, shape.props.url, shape.props.videoId]
  )

  useEffect(() => {
    if (!source) return
    const provider = shape.props.provider
    return registerVideoController(videoNodeId, {
      getCurrentTime: () => currentTime.current,
      pause: () =>
        postToPlayer(
          frameRef.current,
          provider,
          provider === 'youtube'
            ? { event: 'command', func: 'pauseVideo', args: [] }
            : { method: 'pause' }
        ),
      seek: (seconds) =>
        postToPlayer(
          frameRef.current,
          provider,
          provider === 'youtube'
            ? { event: 'command', func: 'seekTo', args: [seconds, true] }
            : { method: 'setCurrentTime', value: seconds }
        )
    })
  }, [shape.props.provider, source, videoNodeId])

  useEffect(() => {
    if (!source) return
    const provider = shape.props.provider
    const receiveTime = (event: MessageEvent) => {
      if (
        event.origin !== PROVIDER_ORIGINS[provider] ||
        event.source !== frameRef.current?.contentWindow
      ) {
        return
      }
      const seconds = timeFromMessage(provider, event.data)
      if (seconds !== null) currentTime.current = seconds
    }
    window.addEventListener('message', receiveTime)
    return () => window.removeEventListener('message', receiveTime)
  }, [shape.props.provider, source])

  const keepInShape = (event: SyntheticEvent) => {
    editor.markEventAsHandled(event)
    event.stopPropagation()
  }

  const update = (props: Partial<CNEmbeddedVideoShape['props']>) => {
    editor.updateShape<CNEmbeddedVideoShape>({
      id: shape.id,
      type: CN_EMBEDDED_VIDEO_TYPE,
      props: { ...props, updatedAt: new Date().toISOString() }
    })
  }

  const pausePlayer = () => {
    postToPlayer(
      frameRef.current,
      shape.props.provider,
      shape.props.provider === 'youtube'
        ? { event: 'command', func: 'pauseVideo', args: [] }
        : { method: 'pause' }
    )
  }

  return (
    <HTMLContainer
      id={shape.id}
      style={{ width: shape.props.w, height: shape.props.h, pointerEvents: 'all' }}
    >
      <article style={cardStyle}>
        {source ? (
          <iframe
            ref={frameRef}
            id={frameId}
            title={shape.props.caption || `${shape.props.provider} video`}
            src={source}
            allow="encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-presentation"
            style={{ width: '100%', minHeight: 0, flex: 1, border: 0, background: '#050506' }}
            onLoad={() => {
              postToPlayer(
                frameRef.current,
                shape.props.provider,
                shape.props.provider === 'youtube'
                  ? { event: 'listening', id: frameId }
                  : { method: 'addEventListener', value: 'timeupdate' }
              )
            }}
            onPointerDown={keepInShape}
          />
        ) : (
          <div
            role="alert"
            style={{ display: 'grid', minHeight: 0, flex: 1, placeItems: 'center' }}
          >
            This video URL is not an approved {shape.props.provider} link.
          </div>
        )}

        {isEditing ? (
          <input
            aria-label="Video caption"
            defaultValue={shape.props.caption}
            maxLength={2_000}
            placeholder="Add a caption"
            style={{ ...controlStyle, width: '100%' }}
            onChange={(event) => update({ caption: event.currentTarget.value })}
            onPointerDown={keepInShape}
            onDoubleClick={keepInShape}
            onKeyDown={keepInShape}
          />
        ) : (
          <div style={{ overflow: 'hidden', fontSize: 13, textOverflow: 'ellipsis' }}>
            {shape.props.caption || `${shape.props.provider} video`}
          </div>
        )}

        <button
          type="button"
          style={controlStyle}
          disabled={!source}
          onPointerDown={keepInShape}
          onClick={(event) => {
            keepInShape(event)
            pausePlayer()
            requestTimestampNote(videoNodeId, shape.id)
          }}
          onKeyDown={keepInShape}
        >
          Add note at current time
        </button>
      </article>
    </HTMLContainer>
  )
}
