import {
  BaseBoxShapeUtil,
  HTMLContainer,
  T,
  resizeBox,
  useEditor,
  useIsEditing,
  type RecordProps,
  type TLResizeInfo
} from 'tldraw'
import { useEffect, useRef, type KeyboardEvent, type SyntheticEvent } from 'react'

import {
  CN_NOTE_TYPE,
  getDefaultCNNoteProps,
  type CNNoteShape,
  type CNTextBackground
} from './types'

export const NOTE_MIN_WIDTH = 220
export const NOTE_MIN_HEIGHT = 140

const BACKGROUNDS: Record<CNTextBackground, string> = {
  paper: '#fffefa',
  amber: '#fff0be',
  rose: '#ffe5e8',
  mint: '#e4f5e9',
  sky: '#e3f1fa',
  slate: '#e7e9ed'
}

export class CNNoteShapeUtil extends BaseBoxShapeUtil<CNNoteShape> {
  static override type = CN_NOTE_TYPE
  static override props: RecordProps<CNNoteShape> = {
    w: T.nonZeroNumber,
    h: T.nonZeroNumber,
    title: T.string,
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

  override getDefaultProps(): CNNoteShape['props'] {
    return getDefaultCNNoteProps()
  }

  override onResize(shape: CNNoteShape, info: TLResizeInfo<CNNoteShape>) {
    return resizeBox(shape, info, { minWidth: NOTE_MIN_WIDTH, minHeight: NOTE_MIN_HEIGHT })
  }

  override onBeforeUpdate(previous: CNNoteShape, next: CNNoteShape) {
    if (previous.props.updatedAt !== next.props.updatedAt) return
    return { ...next, props: { ...next.props, updatedAt: new Date().toISOString() } }
  }

  override getText(shape: CNNoteShape) {
    return [shape.props.title, shape.props.content, ...shape.props.tags].filter(Boolean).join('\n')
  }

  component(shape: CNNoteShape) {
    return <NoteShape shape={shape} />
  }

  override getIndicatorPath(shape: CNNoteShape): Path2D {
    const path = new Path2D()
    path.roundRect(0, 0, shape.props.w, shape.props.h, 8)
    return path
  }
}

function NoteShape({ shape }: { shape: CNNoteShape }) {
  const editor = useEditor()
  const isEditing = useIsEditing(shape.id)
  const contentRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isEditing) contentRef.current?.focus()
  }, [isEditing])

  const keepInShape = (event: SyntheticEvent) => {
    editor.markEventAsHandled(event)
    event.stopPropagation()
  }

  const exitOnEscape = (event: KeyboardEvent) => {
    keepInShape(event)
    if (event.key === 'Escape') {
      event.preventDefault()
      editor.complete()
    }
  }

  const update = (props: Partial<CNNoteShape['props']>) => {
    editor.updateShape<CNNoteShape>({
      id: shape.id,
      type: CN_NOTE_TYPE,
      props: { ...props, updatedAt: new Date().toISOString() }
    })
  }

  return (
    <HTMLContainer
      id={shape.id}
      className="cn-shape-container"
      style={{ width: shape.props.w, height: shape.props.h, pointerEvents: 'all' }}
    >
      <article
        className="cn-shape cn-note-shape"
        style={{
          background: BACKGROUNDS[shape.props.background],
          color: shape.props.textColor,
          fontSize: shape.props.fontSize,
          textAlign: shape.props.textAlign
        }}
      >
        {isEditing ? (
          <>
            <input
              className="cn-shape-title-input"
              aria-label="Note title"
              defaultValue={shape.props.title}
              maxLength={240}
              placeholder="Note title"
              draggable={false}
              onChange={(event) => update({ title: event.currentTarget.value })}
              onPointerDown={keepInShape}
              onDoubleClick={keepInShape}
              onKeyDown={exitOnEscape}
            />
            <textarea
              ref={contentRef}
              className="cn-note-content-input"
              aria-label="Note content"
              defaultValue={shape.props.content}
              maxLength={100_000}
              placeholder="Write a note…"
              draggable={false}
              onChange={(event) => update({ content: event.currentTarget.value })}
              onPointerDown={keepInShape}
              onDoubleClick={keepInShape}
              onKeyDown={exitOnEscape}
            />
          </>
        ) : (
          <>
            <h3 className="cn-shape-title">{shape.props.title || 'Untitled note'}</h3>
            <MarkdownishText text={shape.props.content} />
          </>
        )}
        {shape.props.tags.length > 0 && (
          <footer className="cn-shape-tags" aria-label="Tags">
            {shape.props.tags.map((tag, index) => (
              <span key={`${tag}:${index}`}>#{tag}</span>
            ))}
          </footer>
        )}
      </article>
    </HTMLContainer>
  )
}

function MarkdownishText({ text }: { text: string }) {
  if (!text) return <p className="cn-shape-empty">Double-click to write</p>

  return (
    <div className="cn-note-content">
      {text.split('\n').map((line, index) => {
        const heading = /^(#{1,3})\s+(.*)$/.exec(line)
        const bullet = /^\s*[-*]\s+(.*)$/.exec(line)
        return (
          <div
            className={
              heading ? `cn-markdown-heading cn-markdown-heading-${heading[1]?.length ?? 1}` : ''
            }
            key={`${index}:${line}`}
          >
            {bullet ? `• ${bullet[1]}` : heading ? heading[2] : line || '\u00a0'}
          </div>
        )
      })}
    </div>
  )
}
