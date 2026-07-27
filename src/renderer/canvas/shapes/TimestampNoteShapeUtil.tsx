import { useEffect, useRef, type KeyboardEvent, type SyntheticEvent } from 'react'
import {
  BaseBoxShapeUtil,
  HTMLContainer,
  T,
  createShapeId,
  resizeBox,
  useEditor,
  useIsEditing,
  useValue,
  type RecordProps,
  type TLResizeInfo,
  type TLShape,
  type TLShapePartial
} from 'tldraw'

import { CN_EMBEDDED_VIDEO_TYPE } from './EmbeddedVideoShapeUtil'
import { CN_LOCAL_VIDEO_TYPE } from './LocalVideoShapeUtil'
import type { CNTextAlign, CNTextBackground } from './types'
import { requestVideoSeek } from './videoShapeEvents'

export const CN_TIMESTAMP_NOTE_TYPE = 'cn-timestamp-note' as const
export const TIMESTAMP_NOTE_MIN_WIDTH = 240
export const TIMESTAMP_NOTE_MIN_HEIGHT = 140

export interface CNTimestampNoteShapeProps {
  w: number
  h: number
  videoNodeId: string
  timestampSeconds: number
  content: string
  background: CNTextBackground
  textColor: string
  fontSize: number
  textAlign: CNTextAlign
  tags: string[]
  createdAt: string
  updatedAt: string
}

declare module '@tldraw/tlschema' {
  interface TLGlobalShapePropsMap {
    'cn-timestamp-note': CNTimestampNoteShapeProps
  }
}

export type CNTimestampNoteShape = TLShape<typeof CN_TIMESTAMP_NOTE_TYPE>

export function isCNTimestampNoteShape(shape: TLShape): shape is CNTimestampNoteShape {
  return shape.type === CN_TIMESTAMP_NOTE_TYPE
}

const BACKGROUNDS: Record<CNTextBackground, string> = {
  paper: '#fffefa',
  amber: '#fff0be',
  rose: '#ffe5e8',
  mint: '#e4f5e9',
  sky: '#e3f1fa',
  slate: '#e7e9ed'
}

function safeTimestamp(seconds: number): number {
  return Number.isFinite(seconds) ? Math.min(604_800, Math.max(0, seconds)) : 0
}

export function formatTimestamp(seconds: number): string {
  const wholeSeconds = Math.floor(safeTimestamp(seconds))
  const hours = Math.floor(wholeSeconds / 3600)
  const minutes = Math.floor((wholeSeconds % 3600) / 60)
  const remainingSeconds = wholeSeconds % 60
  return hours > 0
    ? [hours, minutes, remainingSeconds].map((part) => String(part).padStart(2, '0')).join(':')
    : `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
}

export function getDefaultCNTimestampNoteProps(
  now = new Date().toISOString()
): CNTimestampNoteShapeProps {
  return {
    w: 300,
    h: 180,
    videoNodeId: 'video:missing',
    timestampSeconds: 0,
    content: '',
    background: 'amber',
    textColor: '#202124',
    fontSize: 16,
    textAlign: 'left',
    tags: [],
    createdAt: now,
    updatedAt: now
  }
}

export function createCNTimestampNoteShape(
  x = 0,
  y = 0,
  props: Partial<CNTimestampNoteShapeProps> = {}
): TLShapePartial<CNTimestampNoteShape> {
  return {
    id: createShapeId(),
    type: CN_TIMESTAMP_NOTE_TYPE,
    x,
    y,
    props: { ...getDefaultCNTimestampNoteProps(), ...props }
  }
}

export class CNTimestampNoteShapeUtil extends BaseBoxShapeUtil<CNTimestampNoteShape> {
  static override type = CN_TIMESTAMP_NOTE_TYPE
  static override props: RecordProps<CNTimestampNoteShape> = {
    w: T.nonZeroNumber,
    h: T.nonZeroNumber,
    videoNodeId: T.string,
    timestampSeconds: T.number,
    content: T.string,
    background: T.literalEnum('paper', 'amber', 'rose', 'mint', 'sky', 'slate'),
    textColor: T.string,
    fontSize: T.nonZeroNumber,
    textAlign: T.literalEnum('left', 'center', 'right'),
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

  override getDefaultProps(): CNTimestampNoteShape['props'] {
    return getDefaultCNTimestampNoteProps()
  }

  override onResize(shape: CNTimestampNoteShape, info: TLResizeInfo<CNTimestampNoteShape>) {
    return resizeBox(shape, info, {
      minWidth: TIMESTAMP_NOTE_MIN_WIDTH,
      minHeight: TIMESTAMP_NOTE_MIN_HEIGHT
    })
  }

  override onBeforeUpdate(previous: CNTimestampNoteShape, next: CNTimestampNoteShape) {
    if (previous.props.updatedAt !== next.props.updatedAt) return
    return { ...next, props: { ...next.props, updatedAt: new Date().toISOString() } }
  }

  override getText(shape: CNTimestampNoteShape) {
    return [formatTimestamp(shape.props.timestampSeconds), shape.props.content, ...shape.props.tags]
      .filter(Boolean)
      .join('\n')
  }

  component(shape: CNTimestampNoteShape) {
    return <TimestampNoteShape shape={shape} />
  }

  override getIndicatorPath(shape: CNTimestampNoteShape): Path2D {
    const indicator = new Path2D()
    indicator.roundRect(0, 0, shape.props.w, shape.props.h, 8)
    return indicator
  }
}

function canvasNoteId(shape: TLShape): string {
  return typeof shape.meta.canvasNoteId === 'string'
    ? shape.meta.canvasNoteId
    : shape.id.replace(/^shape:/, '')
}

function TimestampNoteShape({ shape }: { shape: CNTimestampNoteShape }) {
  const editor = useEditor()
  const isEditing = useIsEditing(shape.id)
  const contentRef = useRef<HTMLTextAreaElement>(null)
  const linkedVideo = useValue(
    `timestamp video ${shape.id}`,
    () =>
      editor
        .getCurrentPageShapes()
        .find(
          (candidate) =>
            (candidate.type === CN_LOCAL_VIDEO_TYPE || candidate.type === CN_EMBEDDED_VIDEO_TYPE) &&
            canvasNoteId(candidate) === shape.props.videoNodeId
        ),
    [editor, shape.id, shape.props.videoNodeId]
  )

  useEffect(() => {
    if (isEditing) contentRef.current?.focus()
  }, [isEditing])

  const keepInShape = (event: SyntheticEvent) => {
    editor.markEventAsHandled(event)
    event.stopPropagation()
  }

  const update = (props: Partial<CNTimestampNoteShape['props']>) => {
    editor.updateShape<CNTimestampNoteShape>({
      id: shape.id,
      type: CN_TIMESTAMP_NOTE_TYPE,
      props: { ...props, updatedAt: new Date().toISOString() }
    })
  }

  const exitOnEscape = (event: KeyboardEvent) => {
    keepInShape(event)
    if (event.key === 'Escape') {
      event.preventDefault()
      editor.complete()
    }
  }

  const seek = (event: SyntheticEvent) => {
    keepInShape(event)
    if (!linkedVideo) return
    editor.select(linkedVideo.id).zoomToSelection({ animation: { duration: 200 } })
    requestVideoSeek(shape.props.videoNodeId, shape.props.timestampSeconds)
  }

  return (
    <HTMLContainer
      id={shape.id}
      className="cn-shape-container"
      style={{ width: shape.props.w, height: shape.props.h, pointerEvents: 'all' }}
    >
      <article
        className={`cn-timestamp-shape${linkedVideo ? '' : ' is-unlinked'}`}
        style={{
          background: BACKGROUNDS[shape.props.background],
          color: shape.props.textColor,
          fontSize: shape.props.fontSize,
          textAlign: shape.props.textAlign
        }}
      >
        <header className="cn-timestamp-header">
          <button
            type="button"
            aria-label={`Seek video to ${formatTimestamp(shape.props.timestampSeconds)}`}
            disabled={!linkedVideo}
            className="cn-timestamp-button"
            onPointerDown={keepInShape}
            onClick={seek}
            onKeyDown={keepInShape}
          >
            {formatTimestamp(shape.props.timestampSeconds)}
          </button>
          {isEditing && (
            <label className="cn-timestamp-seconds-label">
              <input
                type="number"
                aria-label="Timestamp seconds"
                min={0}
                max={604_800}
                step={0.1}
                value={shape.props.timestampSeconds}
                className="cn-timestamp-seconds-input"
                onChange={(event) =>
                  update({ timestampSeconds: safeTimestamp(event.currentTarget.valueAsNumber) })
                }
                onPointerDown={keepInShape}
                onKeyDown={exitOnEscape}
              />
              seconds
            </label>
          )}
          {!linkedVideo && (
            <span className="cn-timestamp-unlinked" role="status">
              Video link missing
            </span>
          )}
        </header>

        {isEditing ? (
          <textarea
            ref={contentRef}
            aria-label="Timestamp note content"
            defaultValue={shape.props.content}
            maxLength={100_000}
            placeholder="Add a note about this moment"
            className="cn-timestamp-content-input"
            onChange={(event) => update({ content: event.currentTarget.value })}
            onPointerDown={keepInShape}
            onDoubleClick={keepInShape}
            onKeyDown={exitOnEscape}
          />
        ) : (
          <p className="cn-timestamp-content">
            {shape.props.content || 'Double-click to add a note'}
          </p>
        )}

        {shape.props.tags.length > 0 && (
          <footer className="cn-timestamp-tags">
            {shape.props.tags.map((tag, index) => (
              <span key={`${tag}:${index}`}>#{tag}</span>
            ))}
          </footer>
        )}
      </article>
    </HTMLContainer>
  )
}
