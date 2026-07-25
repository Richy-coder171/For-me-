import { createShapeId, type Editor, type TLShape, type TLShapePartial } from 'tldraw'

export const CN_NOTE_TYPE = 'cn-note' as const
export const CN_CHECKLIST_TYPE = 'cn-checklist' as const

export type CNTextBackground = 'paper' | 'amber' | 'rose' | 'mint' | 'sky' | 'slate'
export type CNTextAlign = 'left' | 'center' | 'right'

export interface CNTextStyleProps {
  background: CNTextBackground
  textColor: string
  fontSize: number
  textAlign: CNTextAlign
}

export interface CNNoteShapeProps extends CNTextStyleProps {
  w: number
  h: number
  title: string
  content: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface CNChecklistItem {
  id: string
  text: string
  checked: boolean
}

export interface CNChecklistShapeProps extends CNTextStyleProps {
  w: number
  h: number
  title: string
  items: CNChecklistItem[]
  tags: string[]
  createdAt: string
  updatedAt: string
}

declare module '@tldraw/tlschema' {
  interface TLGlobalShapePropsMap {
    'cn-note': CNNoteShapeProps
    'cn-checklist': CNChecklistShapeProps
  }
}

export type CNNoteShape = TLShape<typeof CN_NOTE_TYPE>
export type CNChecklistShape = TLShape<typeof CN_CHECKLIST_TYPE>

export function isCNNoteShape(shape: TLShape): shape is CNNoteShape {
  return shape.type === CN_NOTE_TYPE
}

export function isCNChecklistShape(shape: TLShape): shape is CNChecklistShape {
  return shape.type === CN_CHECKLIST_TYPE
}

const textStyleDefaults: CNTextStyleProps = {
  background: 'paper',
  textColor: '#202124',
  fontSize: 16,
  textAlign: 'left'
}

export function getDefaultCNNoteProps(now = new Date().toISOString()): CNNoteShapeProps {
  return {
    w: 300,
    h: 220,
    title: '',
    content: '',
    ...textStyleDefaults,
    tags: [],
    createdAt: now,
    updatedAt: now
  }
}

export function getDefaultCNChecklistProps(now = new Date().toISOString()): CNChecklistShapeProps {
  return {
    w: 320,
    h: 260,
    title: 'Checklist',
    items: [],
    ...textStyleDefaults,
    tags: [],
    createdAt: now,
    updatedAt: now
  }
}

export function createCNChecklistItem(text = ''): CNChecklistItem {
  return { id: `item:${crypto.randomUUID()}`, text, checked: false }
}

export function createCNNoteShape(
  x = 0,
  y = 0,
  props: Partial<CNNoteShapeProps> = {}
): TLShapePartial<CNNoteShape> {
  return {
    id: createShapeId(),
    type: CN_NOTE_TYPE,
    x,
    y,
    props: { ...getDefaultCNNoteProps(), ...props }
  }
}

export function createCNChecklistShape(
  x = 0,
  y = 0,
  props: Partial<CNChecklistShapeProps> = {}
): TLShapePartial<CNChecklistShape> {
  return {
    id: createShapeId(),
    type: CN_CHECKLIST_TYPE,
    x,
    y,
    props: { ...getDefaultCNChecklistProps(), ...props }
  }
}

function nextShapePosition(
  editor: Editor,
  width: number,
  height: number
): { x: number; y: number } {
  const selected = editor.getOnlySelectedShape()
  const selectedBounds = selected ? editor.getShapePageBounds(selected) : undefined
  if (selectedBounds) return { x: selectedBounds.maxX + 32, y: selectedBounds.y }

  const center = editor.getViewportPageBounds().center
  return { x: center.x - width / 2, y: center.y - height / 2 }
}

export function createNoteShape(editor: Editor) {
  const position = nextShapePosition(editor, 300, 220)
  const shape = createCNNoteShape(position.x, position.y)
  editor.createShape(shape).select(shape.id).setEditingShape(shape.id)
  return shape.id
}

export function createChecklistShape(editor: Editor) {
  const position = nextShapePosition(editor, 320, 260)
  const shape = createCNChecklistShape(position.x, position.y)
  editor.createShape(shape).select(shape.id).setEditingShape(shape.id)
  return shape.id
}
