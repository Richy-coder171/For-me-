import {
  useEffect,
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type SyntheticEvent
} from 'react'
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

const timestampButtonStyle: CSSProperties = {
  border: 0,
  borderRadius: 5,
  background: 'rgba(37,99,235,.12)',
  padding: '5px 8px',
  color: '#1d4ed8',
  font: 'inherit',
  fontWeight: 700,
  fontVariantNumeric: 'tabular-nums'
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
      style={{ width: shape.props.w, height: shape.props.h, pointerEvents: 'all' }}
    >
      <article
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          flexDirection: 'column',
          gap: 10,
          overflow: 'hidden',
          border: `1px solid ${linkedVideo ? 'rgba(17,24,39,.12)' : '#dc2626'}`,
          borderRadius: 8,
          background: BACKGROUNDS[shape.props.background],
          padding: 14,
          color: shape.props.textColor,
          boxShadow: '0 6px 18px rgba(15,23,42,.1)',
          fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
          fontSize: shape.props.fontSize,
          lineHeight: 1.45,
          textAlign: shape.props.textAlign
        }}
      >
        <header style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            aria-label={`Seek video to ${formatTimestamp(shape.props.timestampSeconds)}`}
            disabled={!linkedVideo}
            style={{ ...timestampButtonStyle, opacity: linkedVideo ? 1 : 0.55 }}
            onPointerDown={keepInShape}
            onClick={seek}
            onKeyDown={keepInShape}
          >
            {formatTimestamp(shape.props.timestampSeconds)}
          </button>
          {isEditing && (
            <label
              style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 4, fontSize: 11 }}
            >
              <input
                type="number"
                aria-label="Timestamp seconds"
                min={0}
                max={604_800}
                step={0.1}
                value={shape.props.timestampSeconds}
                style={{ width: 80, border: '1px solid #c8cbd2', borderRadius: 4, padding: 3 }}
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
            <span role="status" style={{ marginLeft: 'auto', color: '#b91c1c', fontSize: 11 }}>
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
            style={{
              width: '100%',
              minHeight: 0,
              flex: 1,
              resize: 'none',
              border: 0,
              outline: '2px solid #2563eb',
              outlineOffset: 2,
              background: 'transparent',
              color: 'inherit',
              font: 'inherit',
              lineHeight: 'inherit',
              textAlign: 'inherit'
            }}
            onChange={(event) => update({ content: event.currentTarget.value })}
            onPointerDown={keepInShape}
            onDoubleClick={keepInShape}
            onKeyDown={exitOnEscape}
          />
        ) : (
          <p style={{ minHeight: 0, flex: 1, overflow: 'auto', margin: 0, whiteSpace: 'pre-wrap' }}>
            {shape.props.content || 'Double-click to add a note'}
          </p>
        )}

        {shape.props.tags.length > 0 && (
          <footer
            style={{ display: 'flex', flexWrap: 'wrap', gap: 5, fontSize: 11, opacity: 0.65 }}
          >
            {shape.props.tags.map((tag, index) => (
              <span key={`${tag}:${index}`}>#{tag}</span>
            ))}
          </footer>
        )}
      </article>
    </HTMLContainer>
  )
}
