import {
  BaseBoxShapeUtil,
  HTMLContainer,
  T,
  resizeBox,
  useEditor,
  useIsEditing,
  useValue,
  type RecordProps,
  type TLResizeInfo
} from 'tldraw'
import { useEffect, useRef, type KeyboardEvent, type SyntheticEvent } from 'react'

import {
  CN_CHECKLIST_TYPE,
  createCNChecklistItem,
  getDefaultCNChecklistProps,
  type CNChecklistItem,
  type CNChecklistShape,
  type CNTextBackground
} from './types'

export const CHECKLIST_MIN_WIDTH = 240
export const CHECKLIST_MIN_HEIGHT = 170

const BACKGROUNDS: Record<CNTextBackground, string> = {
  paper: '#fffefa',
  amber: '#fff0be',
  rose: '#ffe5e8',
  mint: '#e4f5e9',
  sky: '#e3f1fa',
  slate: '#e7e9ed'
}

const checklistItemValidator = T.object<CNChecklistItem>({
  id: T.string,
  text: T.string,
  checked: T.boolean
})

export class CNChecklistShapeUtil extends BaseBoxShapeUtil<CNChecklistShape> {
  static override type = CN_CHECKLIST_TYPE
  static override props: RecordProps<CNChecklistShape> = {
    w: T.nonZeroNumber,
    h: T.nonZeroNumber,
    title: T.string,
    items: T.arrayOf(checklistItemValidator),
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

  override getDefaultProps(): CNChecklistShape['props'] {
    return getDefaultCNChecklistProps()
  }

  override onResize(shape: CNChecklistShape, info: TLResizeInfo<CNChecklistShape>) {
    return resizeBox(shape, info, {
      minWidth: CHECKLIST_MIN_WIDTH,
      minHeight: CHECKLIST_MIN_HEIGHT
    })
  }

  override onBeforeUpdate(previous: CNChecklistShape, next: CNChecklistShape) {
    if (previous.props.updatedAt !== next.props.updatedAt) return
    return { ...next, props: { ...next.props, updatedAt: new Date().toISOString() } }
  }

  override getText(shape: CNChecklistShape) {
    return [shape.props.title, ...shape.props.items.map((item) => item.text), ...shape.props.tags]
      .filter(Boolean)
      .join('\n')
  }

  component(shape: CNChecklistShape) {
    return <ChecklistShape shape={shape} />
  }

  override getIndicatorPath(shape: CNChecklistShape): Path2D {
    const path = new Path2D()
    path.roundRect(0, 0, shape.props.w, shape.props.h, 8)
    return path
  }
}

function ChecklistShape({ shape }: { shape: CNChecklistShape }) {
  const editor = useEditor()
  const isEditing = useIsEditing(shape.id)
  const isSelected = useValue(
    'checklist selected',
    () => editor.getSelectedShapeIds().includes(shape.id),
    [editor, shape.id]
  )
  const focusItemId = useRef<string | null>(null)
  const itemRefs = useRef(new Map<string, HTMLInputElement>())
  const interactive = isEditing || isSelected
  const completed = shape.props.items.filter((item) => item.checked).length

  useEffect(() => {
    if (!isEditing || !focusItemId.current) return
    itemRefs.current.get(focusItemId.current)?.focus()
    focusItemId.current = null
  }, [isEditing, shape.props.items])

  const keepInShape = (event: SyntheticEvent) => {
    editor.markEventAsHandled(event)
    event.stopPropagation()
  }

  const updateItems = (items: CNChecklistItem[]) => {
    editor.updateShape<CNChecklistShape>({
      id: shape.id,
      type: CN_CHECKLIST_TYPE,
      props: { items, updatedAt: new Date().toISOString() }
    })
  }

  const updateItem = (id: string, changes: Partial<CNChecklistItem>) => {
    updateItems(shape.props.items.map((item) => (item.id === id ? { ...item, ...changes } : item)))
  }

  const addItem = (afterId?: string) => {
    if (shape.props.items.length >= 500) return
    const item = createCNChecklistItem()
    const index = afterId
      ? shape.props.items.findIndex((candidate) => candidate.id === afterId) + 1
      : -1
    const items = [...shape.props.items]
    items.splice(index < 0 ? items.length : index, 0, item)
    updateItems(items)
    editor.setEditingShape(shape.id)
    focusItemId.current = item.id
  }

  const removeItem = (id: string) => {
    const index = shape.props.items.findIndex((item) => item.id === id)
    const nextFocus = shape.props.items[index - 1]?.id ?? shape.props.items[index + 1]?.id ?? null
    updateItems(shape.props.items.filter((item) => item.id !== id))
    focusItemId.current = nextFocus
  }

  const moveItem = (id: string, direction: -1 | 1) => {
    const from = shape.props.items.findIndex((item) => item.id === id)
    const to = from + direction
    if (from < 0 || to < 0 || to >= shape.props.items.length) return
    const items = [...shape.props.items]
    const [item] = items.splice(from, 1)
    if (!item) return
    items.splice(to, 0, item)
    updateItems(items)
  }

  const handleItemKeyDown = (event: KeyboardEvent<HTMLInputElement>, item: CNChecklistItem) => {
    keepInShape(event)
    if (event.key === 'Escape') {
      event.preventDefault()
      editor.complete()
    } else if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault()
      addItem(item.id)
    } else if (event.key === 'Backspace' && event.currentTarget.value === '') {
      event.preventDefault()
      removeItem(item.id)
    }
  }

  return (
    <HTMLContainer
      id={shape.id}
      className="cn-shape-container"
      style={{ width: shape.props.w, height: shape.props.h, pointerEvents: 'all' }}
    >
      <article
        className="cn-shape cn-checklist-shape"
        style={{
          background: BACKGROUNDS[shape.props.background],
          color: shape.props.textColor,
          fontSize: shape.props.fontSize,
          textAlign: shape.props.textAlign
        }}
      >
        {isEditing ? (
          <input
            className="cn-shape-title-input"
            aria-label="Checklist title"
            autoFocus
            defaultValue={shape.props.title}
            maxLength={240}
            placeholder="Checklist"
            draggable={false}
            onChange={(event) =>
              editor.updateShape<CNChecklistShape>({
                id: shape.id,
                type: CN_CHECKLIST_TYPE,
                props: { title: event.currentTarget.value, updatedAt: new Date().toISOString() }
              })
            }
            onPointerDown={keepInShape}
            onDoubleClick={keepInShape}
            onKeyDown={(event) => {
              keepInShape(event)
              if (event.key === 'Enter') {
                event.preventDefault()
                if (shape.props.items[0]) {
                  itemRefs.current.get(shape.props.items[0].id)?.focus()
                } else {
                  addItem()
                }
              } else if (event.key === 'Escape') {
                editor.complete()
              }
            }}
          />
        ) : (
          <h3 className="cn-shape-title">{shape.props.title || 'Checklist'}</h3>
        )}

        <div className="cn-checklist-progress">
          <progress
            aria-label={`${completed} of ${shape.props.items.length} completed`}
            max={Math.max(1, shape.props.items.length)}
            value={completed}
          />
          <span>
            {completed}/{shape.props.items.length}
          </span>
        </div>

        <div className="cn-checklist-items">
          {shape.props.items.length === 0 && !interactive ? (
            <p className="cn-shape-empty">Select to add an item</p>
          ) : (
            shape.props.items.map((item) => (
              <div className="cn-checklist-item" key={item.id}>
                <input
                  type="checkbox"
                  aria-label={`Mark ${item.text || 'item'} complete`}
                  checked={item.checked}
                  disabled={!interactive}
                  onChange={(event) =>
                    updateItem(item.id, { checked: event.currentTarget.checked })
                  }
                  onPointerDown={keepInShape}
                  onClick={keepInShape}
                  onKeyDown={keepInShape}
                />
                {isEditing ? (
                  <input
                    ref={(input) => {
                      if (input) itemRefs.current.set(item.id, input)
                      else itemRefs.current.delete(item.id)
                    }}
                    className={
                      item.checked ? 'cn-checklist-item-text is-checked' : 'cn-checklist-item-text'
                    }
                    aria-label="Checklist item"
                    defaultValue={item.text}
                    maxLength={10_000}
                    placeholder="New item"
                    draggable={false}
                    onChange={(event) => updateItem(item.id, { text: event.currentTarget.value })}
                    onPointerDown={keepInShape}
                    onDoubleClick={keepInShape}
                    onKeyDown={(event) => handleItemKeyDown(event, item)}
                  />
                ) : (
                  <span className={item.checked ? 'cn-checklist-item-text is-checked' : ''}>
                    {item.text || 'Untitled item'}
                  </span>
                )}
                {interactive && (
                  <span className="cn-checklist-item-actions">
                    <button
                      type="button"
                      aria-label={`Move ${item.text || 'item'} up`}
                      title="Move up"
                      disabled={shape.props.items[0]?.id === item.id}
                      onPointerDown={keepInShape}
                      onClick={(event) => {
                        keepInShape(event)
                        moveItem(item.id, -1)
                      }}
                      onKeyDown={keepInShape}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${item.text || 'item'} down`}
                      title="Move down"
                      disabled={shape.props.items.at(-1)?.id === item.id}
                      onPointerDown={keepInShape}
                      onClick={(event) => {
                        keepInShape(event)
                        moveItem(item.id, 1)
                      }}
                      onKeyDown={keepInShape}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${item.text || 'item'}`}
                      title="Remove item"
                      onPointerDown={keepInShape}
                      onClick={(event) => {
                        keepInShape(event)
                        removeItem(item.id)
                      }}
                      onKeyDown={keepInShape}
                    >
                      ×
                    </button>
                  </span>
                )}
              </div>
            ))
          )}
        </div>

        {interactive && (
          <button
            type="button"
            className="cn-checklist-add"
            disabled={shape.props.items.length >= 500}
            onPointerDown={keepInShape}
            onClick={(event) => {
              keepInShape(event)
              addItem()
            }}
            onKeyDown={keepInShape}
          >
            + Add item
          </button>
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
