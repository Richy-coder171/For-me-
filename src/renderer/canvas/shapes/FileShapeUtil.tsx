import { memo, useEffect, useMemo, useState, type SyntheticEvent } from 'react'
import {
  BaseBoxShapeUtil,
  HTMLContainer,
  T,
  resizeBox,
  useEditor,
  type RecordProps,
  type TLResizeInfo
} from 'tldraw'

import { CN_FILE_TYPE, getDefaultCNFileProps, type CNFileShape } from './MediaShapeTypes'
import { getCanvasNoteMedia, toMediaUrl } from './mediaRuntime'
import './media-shapes.css'

export const FILE_MIN_WIDTH = 240
export const FILE_MIN_HEIGHT = 120

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const

export function formatFileSize(sizeBytes: number): string {
  if (sizeBytes <= 0) return '0 B'
  const unit = Math.min(Math.floor(Math.log(sizeBytes) / Math.log(1024)), BYTE_UNITS.length - 1)
  const value = sizeBytes / 1024 ** unit
  return `${Number(value.toFixed(unit > 0 && value < 10 ? 1 : 0))} ${BYTE_UNITS[unit]}`
}

export class CNFileShapeUtil extends BaseBoxShapeUtil<CNFileShape> {
  static override type = CN_FILE_TYPE
  static override props: RecordProps<CNFileShape> = {
    w: T.nonZeroNumber,
    h: T.nonZeroNumber,
    mediaId: T.string,
    mediaPath: T.string,
    filename: T.string,
    extension: T.string,
    sizeBytes: T.positiveInteger,
    tags: T.arrayOf(T.string),
    createdAt: T.string,
    updatedAt: T.string
  }

  override canResize() {
    return true
  }

  override isAspectRatioLocked() {
    return false
  }

  override getDefaultProps(): CNFileShape['props'] {
    return getDefaultCNFileProps()
  }

  override onResize(shape: CNFileShape, info: TLResizeInfo<CNFileShape>) {
    return resizeBox(shape, info, { minWidth: FILE_MIN_WIDTH, minHeight: FILE_MIN_HEIGHT })
  }

  override onBeforeUpdate(previous: CNFileShape, next: CNFileShape) {
    if (previous.props.updatedAt !== next.props.updatedAt) return
    return { ...next, props: { ...next.props, updatedAt: new Date().toISOString() } }
  }

  override getText(shape: CNFileShape) {
    return [shape.props.filename, shape.props.extension, shape.props.mediaPath, ...shape.props.tags]
      .filter(Boolean)
      .join('\n')
  }

  component(shape: CNFileShape) {
    return <FileShape shape={shape} />
  }

  override getIndicatorPath(shape: CNFileShape): Path2D {
    const path = new Path2D()
    path.roundRect(0, 0, shape.props.w, shape.props.h, 8)
    return path
  }
}

const FileShape = memo(function FileShape({ shape }: { shape: CNFileShape }) {
  const editor = useEditor()
  const hasMediaUrl = useMemo(
    () => Boolean(toMediaUrl(shape.props.mediaPath)),
    [shape.props.mediaPath]
  )
  const [missing, setMissing] = useState(!hasMediaUrl)
  const [busyAction, setBusyAction] = useState<'open' | 'reveal' | null>(null)
  const extension = shape.props.extension.replace(/^\./, '').toUpperCase() || 'FILE'

  useEffect(() => {
    if (!hasMediaUrl) {
      setMissing(true)
      return
    }
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
  }, [hasMediaUrl, shape.props.mediaPath])

  const keepInShape = (event: SyntheticEvent) => {
    editor.markEventAsHandled(event)
    event.stopPropagation()
  }

  const runAction = async (action: 'open' | 'reveal', event: SyntheticEvent) => {
    keepInShape(event)
    setBusyAction(action)
    try {
      await getCanvasNoteMedia()[action](shape.props.mediaPath)
      setMissing(false)
    } catch {
      setMissing(true)
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <HTMLContainer
      id={shape.id}
      className="cn-media-container"
      style={{ width: shape.props.w, height: shape.props.h, pointerEvents: 'all' }}
    >
      <article className={missing ? 'cn-file-shape is-missing' : 'cn-file-shape'}>
        <span className="cn-file-extension" aria-hidden="true">
          {extension}
        </span>
        <div className="cn-file-details">
          <h3 title={shape.props.filename}>{shape.props.filename}</h3>
          <p>
            {extension} - {formatFileSize(shape.props.sizeBytes)}
          </p>
          {missing && (
            <p className="cn-file-missing" role="status">
              File unavailable
            </p>
          )}
        </div>
        <div className="cn-file-actions">
          <button
            type="button"
            className="cn-media-action"
            aria-label={`Open ${shape.props.filename}`}
            disabled={busyAction !== null}
            onPointerDown={keepInShape}
            onClick={(event) => void runAction('open', event)}
            onKeyDown={keepInShape}
          >
            {busyAction === 'open' ? 'Opening...' : 'Open'}
          </button>
          <button
            type="button"
            className="cn-media-action"
            aria-label={`Reveal ${shape.props.filename} in folder`}
            disabled={busyAction !== null}
            onPointerDown={keepInShape}
            onClick={(event) => void runAction('reveal', event)}
            onKeyDown={keepInShape}
          >
            {busyAction === 'reveal' ? 'Revealing...' : 'Reveal'}
          </button>
        </div>
      </article>
    </HTMLContainer>
  )
})
