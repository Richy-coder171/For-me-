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

import { CN_IMAGE_TYPE, getDefaultCNImageProps, type CNImageShape } from './MediaShapeTypes'
import { getCanvasNoteMedia, toMediaUrl } from './mediaRuntime'
import './media-shapes.css'

export const IMAGE_MIN_WIDTH = 160
export const IMAGE_MIN_HEIGHT = 120

export class CNImageShapeUtil extends BaseBoxShapeUtil<CNImageShape> {
  static override type = CN_IMAGE_TYPE
  static override props: RecordProps<CNImageShape> = {
    w: T.nonZeroNumber,
    h: T.nonZeroNumber,
    mediaId: T.string,
    mediaPath: T.string,
    caption: T.string,
    altText: T.string,
    fit: T.literalEnum('contain', 'cover'),
    tags: T.arrayOf(T.string),
    createdAt: T.string,
    updatedAt: T.string
  }

  override canResize() {
    return true
  }

  override isAspectRatioLocked() {
    return true
  }

  override getDefaultProps(): CNImageShape['props'] {
    return getDefaultCNImageProps()
  }

  override onResize(shape: CNImageShape, info: TLResizeInfo<CNImageShape>) {
    return resizeBox(shape, info, { minWidth: IMAGE_MIN_WIDTH, minHeight: IMAGE_MIN_HEIGHT })
  }

  override onBeforeUpdate(previous: CNImageShape, next: CNImageShape) {
    if (previous.props.updatedAt !== next.props.updatedAt) return
    return { ...next, props: { ...next.props, updatedAt: new Date().toISOString() } }
  }

  override getText(shape: CNImageShape) {
    return [shape.props.caption, shape.props.altText, ...shape.props.tags]
      .filter(Boolean)
      .join('\n')
  }

  component(shape: CNImageShape) {
    return <ImageShape shape={shape} />
  }

  override getIndicatorPath(shape: CNImageShape): Path2D {
    const path = new Path2D()
    path.roundRect(0, 0, shape.props.w, shape.props.h, 8)
    return path
  }
}

const ImageShape = memo(function ImageShape({ shape }: { shape: CNImageShape }) {
  const editor = useEditor()
  const mediaUrl = useMemo(() => toMediaUrl(shape.props.mediaPath), [shape.props.mediaPath])
  const [missing, setMissing] = useState(!mediaUrl)
  const [opening, setOpening] = useState(false)

  useEffect(() => setMissing(!mediaUrl), [mediaUrl])

  const keepInShape = (event: SyntheticEvent) => {
    editor.markEventAsHandled(event)
    event.stopPropagation()
  }

  const openOriginal = async (event: SyntheticEvent) => {
    keepInShape(event)
    setOpening(true)
    try {
      await getCanvasNoteMedia().open(shape.props.mediaPath)
      setMissing(false)
    } catch {
      setMissing(true)
    } finally {
      setOpening(false)
    }
  }

  return (
    <HTMLContainer
      id={shape.id}
      className="cn-media-container"
      style={{ width: shape.props.w, height: shape.props.h, pointerEvents: 'all' }}
    >
      <figure className="cn-image-shape">
        {!missing && mediaUrl ? (
          <img
            src={mediaUrl}
            alt={shape.props.altText || shape.props.caption}
            draggable={false}
            loading="lazy"
            decoding="async"
            style={{ objectFit: shape.props.fit }}
            onError={() => setMissing(true)}
          />
        ) : (
          <div className="cn-media-missing" role="status">
            <strong>Image unavailable</strong>
            <span>The original file may have moved or been deleted.</span>
          </div>
        )}

        <button
          type="button"
          className="cn-media-action cn-image-open"
          aria-label="Open original image"
          disabled={opening}
          onPointerDown={keepInShape}
          onClick={(event) => void openOriginal(event)}
          onKeyDown={keepInShape}
        >
          {opening ? 'Opening...' : 'Open original'}
        </button>

        {shape.props.caption && <figcaption>{shape.props.caption}</figcaption>}
      </figure>
    </HTMLContainer>
  )
})
