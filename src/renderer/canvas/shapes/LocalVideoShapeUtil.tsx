import { useEffect, useRef, useState, type SyntheticEvent } from 'react'
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

type LocalVideoStatus = 'checking' | 'ready' | 'missing' | 'playback-error'

function LocalVideoShape({ shape }: { shape: CNLocalVideoShape }) {
  const editor = useEditor()
  const isEditing = useIsEditing(shape.id)
  const videoRef = useRef<HTMLVideoElement>(null)
  const videoNodeId = nodeId(shape)
  const source = toMediaUrl(shape.props.mediaPath) ?? undefined
  const poster = shape.props.posterPath
    ? (toMediaUrl(shape.props.posterPath) ?? undefined)
    : undefined
  const availabilityKey = `${shape.props.mediaPath}\0${source ?? ''}`
  const [availability, setAvailability] = useState<{
    key: string
    status: LocalVideoStatus
  }>({ key: availabilityKey, status: source ? 'checking' : 'missing' })
  const [locating, setLocating] = useState(false)
  const [locateFailureKey, setLocateFailureKey] = useState<string | null>(null)
  const status =
    availability.key === availabilityKey ? availability.status : source ? 'checking' : 'missing'
  const locateFailed = locateFailureKey === availabilityKey

  useEffect(() => {
    if (!source) return
    let active = true
    void getCanvasNoteMedia()
      .exists(shape.props.mediaPath)
      .then((exists) => {
        if (active) {
          setAvailability({ key: availabilityKey, status: exists ? 'ready' : 'missing' })
        }
      })
      .catch(() => {
        if (active) setAvailability({ key: availabilityKey, status: 'missing' })
      })
    return () => {
      active = false
    }
  }, [availabilityKey, shape.props.mediaPath, source])

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

  const locate = async (event: SyntheticEvent): Promise<void> => {
    keepInShape(event)
    setLocating(true)
    setLocateFailureKey(null)
    try {
      await getCanvasNoteMedia().reveal(shape.props.mediaPath)
    } catch {
      setLocateFailureKey(availabilityKey)
    } finally {
      setLocating(false)
    }
  }

  const handlePlaybackError = (): void => {
    void getCanvasNoteMedia()
      .exists(shape.props.mediaPath)
      .then((exists) =>
        setAvailability({
          key: availabilityKey,
          status: exists ? 'playback-error' : 'missing'
        })
      )
      .catch(() => setAvailability({ key: availabilityKey, status: 'playback-error' }))
  }

  return (
    <HTMLContainer
      id={shape.id}
      className="cn-video-container"
      style={{ width: shape.props.w, height: shape.props.h, pointerEvents: 'all' }}
    >
      <article className="cn-video-shape">
        {source && status === 'ready' ? (
          <video
            ref={videoRef}
            aria-label={shape.props.caption || 'Local video'}
            controls
            playsInline
            preload="metadata"
            src={source}
            poster={poster}
            className="cn-video-player"
            onPointerDown={keepInShape}
            onClick={keepInShape}
            onDoubleClick={keepInShape}
            onKeyDown={keepInShape}
            onLoadedMetadata={(event) => {
              setAvailability({ key: availabilityKey, status: 'ready' })
              event.currentTarget.playbackRate = shape.props.playbackRate
              const durationSeconds = event.currentTarget.duration
              if (
                Number.isFinite(durationSeconds) &&
                durationSeconds !== shape.props.durationSeconds
              ) {
                update({ durationSeconds })
              }
            }}
            onError={handlePlaybackError}
          />
        ) : (
          <div
            className={`cn-video-status${status === 'playback-error' ? ' is-danger' : ''}`}
            role={status === 'playback-error' || locateFailed ? 'alert' : 'status'}
          >
            <strong>
              {status === 'checking'
                ? 'Checking video file...'
                : status === 'missing'
                  ? 'Video file is missing'
                  : 'Video cannot be played'}
            </strong>
            {status !== 'checking' && (
              <span>
                {status === 'missing'
                  ? 'Select this video, then use Replace video file in Properties.'
                  : 'The file exists, but its format or codec may not be supported.'}
              </span>
            )}
            {locateFailed && <span>CanvasNote could not open the file location.</span>}
            {status === 'playback-error' && (
              <button
                type="button"
                className="cn-video-control"
                aria-label="Locate video file"
                disabled={locating}
                onPointerDown={keepInShape}
                onClick={(event) => void locate(event)}
                onKeyDown={keepInShape}
              >
                {locating ? 'Locating...' : 'Locate file'}
              </button>
            )}
          </div>
        )}

        {isEditing ? (
          <input
            aria-label="Video caption"
            defaultValue={shape.props.caption}
            maxLength={2_000}
            placeholder="Add a caption"
            className="cn-video-control cn-video-caption-input"
            onChange={(event) => update({ caption: event.currentTarget.value })}
            onPointerDown={keepInShape}
            onDoubleClick={keepInShape}
            onKeyDown={keepInShape}
          />
        ) : (
          <div className="cn-video-caption">{shape.props.caption || 'Local video'}</div>
        )}

        <div className="cn-video-footer">
          <button
            type="button"
            className="cn-video-control cn-video-note-button"
            disabled={status !== 'ready'}
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
          <label className="cn-video-speed-label">
            <span className="cn-shape-sr-only">Playback speed</span>
            <select
              aria-label="Playback speed"
              value={shape.props.playbackRate}
              className="cn-video-control"
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
