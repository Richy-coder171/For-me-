import { memo, useState, type SyntheticEvent } from 'react'
import {
  BaseBoxShapeUtil,
  HTMLContainer,
  T,
  createShapeId,
  resizeBox,
  useEditor,
  type RecordProps,
  type TLResizeInfo,
  type TLShape,
  type TLShapePartial
} from 'tldraw'

export const CN_LINK_TYPE = 'cn-link' as const
export const LINK_MIN_WIDTH = 240
export const LINK_MIN_HEIGHT = 140

export interface CNLinkShapeProps {
  w: number
  h: number
  url: string
  title: string
  description: string
  domain: string
  previewImageUrl?: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

declare module '@tldraw/tlschema' {
  interface TLGlobalShapePropsMap {
    'cn-link': CNLinkShapeProps
  }
}

export type CNLinkShape = TLShape<typeof CN_LINK_TYPE>

export function isCNLinkShape(shape: TLShape): shape is CNLinkShape {
  return shape.type === CN_LINK_TYPE
}

export function getDefaultCNLinkProps(now = new Date().toISOString()): CNLinkShapeProps {
  return {
    w: 340,
    h: 190,
    url: 'https://example.com/',
    title: '',
    description: '',
    domain: 'example.com',
    tags: [],
    createdAt: now,
    updatedAt: now
  }
}

export function createCNLinkShape(
  x = 0,
  y = 0,
  props: Partial<CNLinkShapeProps> = {}
): TLShapePartial<CNLinkShape> {
  return {
    id: createShapeId(),
    type: CN_LINK_TYPE,
    x,
    y,
    props: { ...getDefaultCNLinkProps(), ...props }
  }
}

export class CNLinkShapeUtil extends BaseBoxShapeUtil<CNLinkShape> {
  static override type = CN_LINK_TYPE
  static override props: RecordProps<CNLinkShape> = {
    w: T.nonZeroNumber,
    h: T.nonZeroNumber,
    url: T.string,
    title: T.string,
    description: T.string,
    domain: T.string,
    previewImageUrl: T.optional(T.string),
    tags: T.arrayOf(T.string),
    createdAt: T.string,
    updatedAt: T.string
  }

  override canResize() {
    return true
  }

  override getDefaultProps(): CNLinkShape['props'] {
    return getDefaultCNLinkProps()
  }

  override onResize(shape: CNLinkShape, info: TLResizeInfo<CNLinkShape>) {
    return resizeBox(shape, info, { minWidth: LINK_MIN_WIDTH, minHeight: LINK_MIN_HEIGHT })
  }

  override onBeforeUpdate(previous: CNLinkShape, next: CNLinkShape) {
    if (previous.props.updatedAt !== next.props.updatedAt) return
    return { ...next, props: { ...next.props, updatedAt: new Date().toISOString() } }
  }

  override getText(shape: CNLinkShape) {
    return [
      shape.props.title,
      shape.props.description,
      shape.props.domain,
      shape.props.url,
      ...shape.props.tags
    ]
      .filter(Boolean)
      .join('\n')
  }

  component(shape: CNLinkShape) {
    return <LinkShape shape={shape} />
  }

  override getIndicatorPath(shape: CNLinkShape): Path2D {
    const path = new Path2D()
    path.roundRect(0, 0, shape.props.w, shape.props.h, 8)
    return path
  }
}

const LinkShape = memo(function LinkShape({ shape }: { shape: CNLinkShape }) {
  const editor = useEditor()
  const [failed, setFailed] = useState(false)

  const openLink = async (event: SyntheticEvent): Promise<void> => {
    editor.markEventAsHandled(event)
    event.stopPropagation()
    try {
      await window.canvasNote.app.openExternal(shape.props.url)
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }

  return (
    <HTMLContainer
      id={shape.id}
      className="cn-link-container"
      style={{ width: shape.props.w, height: shape.props.h, pointerEvents: 'all' }}
    >
      <article className="cn-link-shape">
        <div className="cn-link-domain">{shape.props.domain}</div>
        <h3>{shape.props.title || shape.props.domain}</h3>
        <p>{shape.props.description || shape.props.url}</p>
        <div className="cn-link-footer">
          <span>{failed ? 'Could not open link' : shape.props.url}</span>
          <button
            type="button"
            onPointerDown={(event) => {
              editor.markEventAsHandled(event)
              event.stopPropagation()
            }}
            onClick={(event) => void openLink(event)}
            aria-label={`Open ${shape.props.domain} in browser`}
          >
            Open link
          </button>
        </div>
      </article>
    </HTMLContainer>
  )
})
