import { useEffect, useRef, useState, type CSSProperties, type SyntheticEvent } from 'react'
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

import { getCanvasNoteMedia, toMediaUrl } from './mediaRuntime'
import { registerVideoController, requestTimestampNote } from './videoShapeEvents'

export const CN_LOCAL_VIDEO_TYPE = 'cn-local-video' as const
export const LOCAL_VIDEO_MIN_WIDTH = 320
export const LOCAL_VIDEO_MIN_HEIGHT = 240

export interface CNLocalVideoShapeProps {
  w: number
  h: number
  mediaId: string
  mediaPath: string
  caption: string
  posterPath?: string
  durationSeconds?: number
  playbackRate: number
  tags: string[]
  createdAt: string
  updatedAt: string
}

declare module '@tldraw/tlschema' {
  interface TLGlobalShapePropsMap {
    'cn-local-video': CNLocalVideoShapeProps
  }
}

export type CNLocalVideoShape = TLShape<typeof CN_LOCAL_VIDEO_TYPE>

export function isCNLocalVideoShape(shape: TLShape): shape is CNLocalVideoShape {
  return shape.type === CN_LOCAL_VIDEO_TYPE
}

function nodeId(shape: CNLocalVideoShape): string {
  return typeof shape.meta.canvasNoteId === 'string'
    ? shape.meta.canvasNoteId
    : shape.id.replace(/^shape:/, '')
}

export function getDefaultCNLocalVideoProps(
  now = new Date().toISOString()
): CNLocalVideoShapeProps {
  return {
    w: 480,
    h: 360,
    mediaId: 'media:missing',
    mediaPath: 'media/videos/missing',
    caption: '',
    playbackRate: 1,
    tags: [],
    createdAt: now,
    updatedAt: now
  }
}

export function createCNLocalVideoShape(
  x = 0,
  y = 0,
  props: Partial<CNLocalVideoShapeProps> = {}
): TLShapePartial<CNLocalVideoShape> {
  return {
    id: createShapeId(),
    type: CN_LOCAL_VIDEO_TYPE,
    x,
    y,
    props: { ...getDefaultCNLocalVideoProps(), ...props }
  }
}

export class CNLocalVideoShapeUtil extends BaseBoxShapeUtil<CNLocalVideoShape> {
  static override type = CN_LOCAL_VIDEO_TYPE
  static override props: RecordProps<CNLocalVideoShape> = {
    w: T.nonZeroNumber,
    h: T.nonZeroNumber,
    mediaId: T.string,
    mediaPath: T.string,
    caption: T.string,
    posterPath: T.optional(T.string),
    durationSeconds: T.optional(T.number),
    playbackRate: T.number,
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

  override getDefaultProps(): CNLocalVideoShape['props'] {
    return getDefaultCNLocalVideoProps()
  }

  override onResize(shape: CNLocalVideoShape, info: TLResizeInfo<CNLocalVideoShape>) {
    return resizeBox(shape, info, {
      minWidth: LOCAL_VIDEO_MIN_WIDTH,
      minHeight: LOCAL_VIDEO_MIN_HEIGHT
    })
  }

  override onBeforeUpdate(previous: CNLocalVideoShape, next: CNLocalVideoShape) {
    if (previous.props.updatedAt !== next.props.updatedAt) return
    return { ...next, props: { ...next.props, updatedAt: new Date().toISOString() } }
  }

  override getText(shape: CNLocalVideoShape) {
    return [shape.props.caption, ...shape.props.tags].filter(Boolean).join('\n')
  }

  component(shape: CNLocalVideoShape) {
    return <LocalVideoShape shape={shape} />
  }

  override getIndicatorPath(shape: CNLocalVideoShape): Path2D {
    const indicator = new Path2D()
    indicator.roundRect(0, 0, shape.props.w, shape.props.h, 8)
    return indicator
  }
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

function LocalVideoShape({ shape }: { shape: CNLocalVideoShape }) {
  const editor = useEditor()
  const isEditing = useIsEditing(shape.id)
  const videoRef = useRef<HTMLVideoElement>(null)
  const videoNodeId = nodeId(shape)
  const source = toMediaUrl(shape.props.mediaPath) ?? undefined
  const poster = shape.props.posterPath
    ? (toMediaUrl(shape.props.posterPath) ?? undefined)
    : undefined
  const [missing, setMissing] = useState(!source)

  useEffect(() => {
    if (!source) return
    let active = true
    void getCanvasNoteMedia()
      .exists(shape.props.mediaPath)
      .then((exists) => {
        if (active) setMissing(!exists)
      })
      .catch(() => {
        if (active) setMissing(true)
      })
    return () => {
      active = false
    }
  }, [shape.props.mediaPath, source])

  useEffect(() => {
    return registerVideoController(videoNodeId, {
      getCurrentTime: () => videoRef.current?.currentTime ?? 0,
      pause: () => videoRef.current?.pause(),
      seek: (seconds) => {
        const video = videoRef.current
        if (!video) return
        try {
          video.currentTime = Number.isFinite(video.duration)
            ? Math.min(seconds, video.duration)
            : seconds
        } catch {
          // Metadata may not be loaded yet; the seek event remains available to the editor.
        }
      }
    })
  }, [videoNodeId])

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = shape.props.playbackRate
  }, [shape.props.playbackRate])

  const keepInShape = (event: SyntheticEvent) => {
    editor.markEventAsHandled(event)
    event.stopPropagation()
  }

  const update = (props: Partial<CNLocalVideoShape['props']>) => {
    editor.updateShape<CNLocalVideoShape>({
      id: shape.id,
      type: CN_LOCAL_VIDEO_TYPE,
      props: { ...props, updatedAt: new Date().toISOString() }
    })
  }

  return (
    <HTMLContainer
      id={shape.id}
      style={{ width: shape.props.w, height: shape.props.h, pointerEvents: 'all' }}
    >
      <article style={cardStyle}>
        {source && !missing ? (
          <video
            ref={videoRef}
            aria-label={shape.props.caption || 'Local video'}
            controls
            playsInline
            preload="metadata"
            src={source}
            poster={poster}
            style={{ width: '100%', minHeight: 0, flex: 1, background: '#050506' }}
            onPointerDown={keepInShape}
            onClick={keepInShape}
            onDoubleClick={keepInShape}
            onKeyDown={keepInShape}
            onLoadedMetadata={(event) => {
              setMissing(false)
              event.currentTarget.playbackRate = shape.props.playbackRate
              const durationSeconds = event.currentTarget.duration
              if (
                Number.isFinite(durationSeconds) &&
                durationSeconds !== shape.props.durationSeconds
              ) {
                update({ durationSeconds })
              }
            }}
            onError={() => setMissing(true)}
          />
        ) : (
          <div
            role="status"
            style={{ display: 'grid', minHeight: 0, flex: 1, placeItems: 'center' }}
          >
            Video is unavailable
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
            {shape.props.caption || 'Local video'}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <button
            type="button"
            style={{ ...controlStyle, flex: 1 }}
            onPointerDown={keepInShape}
            onClick={(event) => {
              keepInShape(event)
              videoRef.current?.pause()
              requestTimestampNote(videoNodeId, shape.id)
            }}
            onKeyDown={keepInShape}
          >
            Add note at current time
          </button>
          <label style={{ fontSize: 12 }}>
            <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>
              Playback speed
            </span>
            <select
              aria-label="Playback speed"
              value={shape.props.playbackRate}
              style={controlStyle}
              onChange={(event) => update({ playbackRate: Number(event.currentTarget.value) })}
              onPointerDown={keepInShape}
              onClick={keepInShape}
              onKeyDown={keepInShape}
            >
              {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                <option key={rate} value={rate}>
                  {rate}×
                </option>
              ))}
            </select>
          </label>
        </div>
      </article>
    </HTMLContainer>
  )
}
