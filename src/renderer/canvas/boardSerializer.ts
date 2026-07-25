import {
  createBindingId,
  createShapeId,
  toRichText,
  type TLArrowBinding,
  type TLArrowShape,
  type TLFrameShape,
  type TLGroupShape,
  type TLPageId,
  type TLShapeId
} from '@tldraw/tlschema'
import { ZERO_INDEX_KEY, getIndexAbove, type IndexKey, type JsonObject } from '@tldraw/utils'

import {
  boardFileSchema,
  canvasNodeSchema,
  connectionSchema,
  type BoardFile
} from '../../shared/schemas/board'
import type { CNChecklistShape, CNNoteShape } from './shapes/types'

const CN_NOTE_TYPE = 'cn-note' as const
const CN_CHECKLIST_TYPE = 'cn-checklist' as const

export const DEFAULT_TLDRAW_PAGE_ID = 'page:canvasnote' as TLPageId

export type BoardTldrawRecord =
  CNNoteShape | CNChecklistShape | TLFrameShape | TLGroupShape | TLArrowShape | TLArrowBinding

export type BoardSerializerDiagnosticCode =
  | 'unsupported-node'
  | 'unsupported-shape'
  | 'invalid-shape'
  | 'duplicate-id'
  | 'missing-parent'
  | 'mixed-group-parents'
  | 'broken-connection'
  | 'invalid-board'

export interface BoardSerializerDiagnostic {
  code: BoardSerializerDiagnosticCode
  id: string
  message: string
}

export interface BoardToTldrawResult {
  records: BoardTldrawRecord[]
  camera: BoardFile['camera']
  diagnostics: BoardSerializerDiagnostic[]
}

export interface TldrawToBoardResult {
  board: BoardFile
  diagnostics: BoardSerializerDiagnostic[]
}

interface ShapeRecord {
  id: string
  typeName: 'shape'
  type: string
  x: number
  y: number
  rotation: number
  parentId: string
  isLocked: boolean
  props: Record<string, unknown>
  meta: Record<string, unknown>
}

interface BindingRecord {
  id: string
  typeName: 'binding'
  type: string
  fromId: string
  toId: string
  props: Record<string, unknown>
  meta: Record<string, unknown>
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

function isShapeRecord(value: unknown): value is ShapeRecord {
  return (
    isObject(value) &&
    value.typeName === 'shape' &&
    typeof value.id === 'string' &&
    typeof value.type === 'string' &&
    typeof value.x === 'number' &&
    typeof value.y === 'number' &&
    typeof value.rotation === 'number' &&
    typeof value.parentId === 'string' &&
    typeof value.isLocked === 'boolean' &&
    isObject(value.props) &&
    isObject(value.meta)
  )
}

function isBindingRecord(value: unknown): value is BindingRecord {
  return (
    isObject(value) &&
    value.typeName === 'binding' &&
    typeof value.id === 'string' &&
    typeof value.type === 'string' &&
    typeof value.fromId === 'string' &&
    typeof value.toId === 'string' &&
    isObject(value.props) &&
    isObject(value.meta)
  )
}

const shapeId = (id: string): TLShapeId => createShapeId(id)

function domainId(record: Pick<ShapeRecord, 'id' | 'meta'>): string {
  return typeof record.meta.canvasNoteId === 'string'
    ? record.meta.canvasNoteId
    : record.id.replace(/^shape:/, '')
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

function radiansToDegrees(radians: number): number {
  return Number(((radians * 180) / Math.PI).toFixed(6))
}

function metaForNode(node: BoardFile['nodes'][number]): JsonObject {
  return {
    canvasNoteId: node.id,
    canvasNoteTags: node.tags,
    canvasNoteCreatedAt: node.createdAt,
    canvasNoteUpdatedAt: node.updatedAt
  }
}

function centerOf(node: BoardFile['nodes'][number]): { x: number; y: number } {
  return { x: node.x + node.width / 2, y: node.y + node.height / 2 }
}

function plainText(value: unknown): string {
  if (!isObject(value)) return ''
  if (typeof value.text === 'string') return value.text
  if (!Array.isArray(value.content)) return value.type === 'hardBreak' ? '\n' : ''
  const separator = value.type === 'doc' ? '\n' : ''
  return value.content.map(plainText).join(separator)
}

function nextIndexFactory(): () => IndexKey {
  let index = ZERO_INDEX_KEY
  return () => {
    const current = index
    index = getIndexAbove(index)
    return current
  }
}

/** Convert persisted CanvasNote data into document-scoped tldraw records. */
export function boardToTldraw(
  board: BoardFile,
  pageId: TLPageId = DEFAULT_TLDRAW_PAGE_ID
): BoardToTldrawResult {
  const records: BoardTldrawRecord[] = []
  const diagnostics: BoardSerializerDiagnostic[] = []
  const nextIndex = nextIndexFactory()
  const nodeIds = new Set(board.nodes.map(({ id }) => id))
  const frameIds = new Set(board.nodes.filter(({ type }) => type === 'frame').map(({ id }) => id))
  const groups = new Map<string, BoardFile['nodes']>()

  for (const node of board.nodes) {
    if (!node.groupId) continue
    const members = groups.get(node.groupId) ?? []
    members.push(node)
    groups.set(node.groupId, members)
  }

  for (const [groupId, members] of groups) {
    const parents = new Set(members.map(({ parentFrameId }) => parentFrameId))
    let parentId: TLPageId | TLShapeId = pageId
    if (parents.size === 1) {
      const parentFrameId = [...parents][0]
      if (parentFrameId) {
        if (frameIds.has(parentFrameId)) parentId = shapeId(parentFrameId)
        else {
          diagnostics.push({
            code: 'missing-parent',
            id: groupId,
            message: `Group ${groupId} refers to missing frame ${parentFrameId}.`
          })
        }
      }
    } else if (parents.size > 1) {
      diagnostics.push({
        code: 'mixed-group-parents',
        id: groupId,
        message: `Group ${groupId} contains nodes from multiple frames; it was placed on the page.`
      })
    }

    records.push({
      id: shapeId(`group:${groupId}`),
      typeName: 'shape',
      type: 'group',
      x: 0,
      y: 0,
      rotation: 0,
      index: nextIndex(),
      parentId,
      isLocked: false,
      opacity: 1,
      props: {},
      meta: { canvasNoteGroupId: groupId }
    })
  }

  for (const node of board.nodes) {
    let parentId: TLPageId | TLShapeId = pageId
    if (node.groupId) {
      parentId = shapeId(`group:${node.groupId}`)
    } else if (node.parentFrameId) {
      if (frameIds.has(node.parentFrameId)) parentId = shapeId(node.parentFrameId)
      else {
        diagnostics.push({
          code: 'missing-parent',
          id: node.id,
          message: `Node ${node.id} refers to missing frame ${node.parentFrameId}.`
        })
      }
    }

    const base = {
      id: shapeId(node.id),
      typeName: 'shape' as const,
      x: node.x,
      y: node.y,
      rotation: degreesToRadians(node.rotation),
      index: nextIndex(),
      parentId,
      isLocked: node.locked,
      opacity: 1 as const,
      meta: metaForNode(node)
    }

    switch (node.type) {
      case 'note':
        records.push({
          ...base,
          type: CN_NOTE_TYPE,
          props: {
            w: node.width,
            h: node.height,
            title: node.title,
            content: node.content,
            background: node.background,
            textColor: node.textColor,
            fontSize: node.fontSize,
            textAlign: node.textAlign,
            tags: node.tags,
            createdAt: node.createdAt,
            updatedAt: node.updatedAt
          }
        })
        break
      case 'checklist':
        records.push({
          ...base,
          type: CN_CHECKLIST_TYPE,
          props: {
            w: node.width,
            h: node.height,
            title: node.title,
            items: node.items,
            background: node.background,
            textColor: node.textColor,
            fontSize: node.fontSize,
            textAlign: node.textAlign,
            tags: node.tags,
            createdAt: node.createdAt,
            updatedAt: node.updatedAt
          }
        })
        break
      case 'frame':
        records.push({
          ...base,
          type: 'frame',
          props: { w: node.width, h: node.height, name: node.title, color: 'black' },
          meta: {
            ...base.meta,
            canvasNoteFrameBackground: node.background,
            canvasNoteFrameBorder: node.border
          }
        })
        break
      default:
        diagnostics.push({
          code: 'unsupported-node',
          id: node.id,
          message: `CanvasNote node type ${node.type} is not supported by the Phase 3 canvas.`
        })
    }
  }

  for (const connection of board.connections) {
    const source = board.nodes.find(({ id }) => id === connection.sourceNodeId)
    const target = board.nodes.find(({ id }) => id === connection.targetNodeId)
    if (!source || !target || !nodeIds.has(source.id) || !nodeIds.has(target.id)) {
      diagnostics.push({
        code: 'broken-connection',
        id: connection.id,
        message: `Connection ${connection.id} has a missing endpoint and was not loaded.`
      })
      continue
    }

    const start = centerOf(source)
    const end = centerOf(target)
    const arrowId = shapeId(connection.id)
    records.push({
      id: arrowId,
      typeName: 'shape',
      type: 'arrow',
      x: start.x,
      y: start.y,
      rotation: 0,
      index: nextIndex(),
      parentId: pageId,
      isLocked: false,
      opacity: 1,
      props: {
        kind: 'arc',
        elbowMidPoint: 0.5,
        dash: connection.style,
        size: 'm',
        fill: 'none',
        color: 'black',
        labelColor: 'black',
        bend: 0,
        start: { x: 0, y: 0 },
        end: { x: end.x - start.x, y: end.y - start.y },
        arrowheadStart: 'none',
        arrowheadEnd: connection.type === 'arrow' ? 'arrow' : 'none',
        richText: toRichText(connection.label),
        labelPosition: 0.5,
        font: 'draw',
        scale: 1
      },
      meta: {
        canvasNoteId: connection.id,
        canvasNoteConnectionType: connection.type,
        canvasNoteConnectionStyle: connection.style,
        canvasNoteCreatedAt: connection.createdAt,
        canvasNoteUpdatedAt: connection.updatedAt
      }
    })

    for (const [terminal, toId] of [
      ['start', source.id],
      ['end', target.id]
    ] as const) {
      records.push({
        id: createBindingId(`${connection.id}:${terminal}`),
        typeName: 'binding',
        type: 'arrow',
        fromId: arrowId,
        toId: shapeId(toId),
        props: {
          terminal,
          normalizedAnchor: { x: 0.5, y: 0.5 },
          isExact: false,
          isPrecise: false,
          snap: 'edge'
        },
        meta: { canvasNoteConnectionId: connection.id }
      })
    }
  }

  return { records, camera: { ...board.camera }, diagnostics }
}

function relationFields(shape: ShapeRecord, shapes: Map<string, ShapeRecord>): object {
  const parent = shapes.get(shape.parentId)
  if (!parent) return {}
  if (parent.type === 'frame') return { parentFrameId: domainId(parent) }
  if (parent.type !== 'group') return {}

  const groupId =
    typeof parent.meta.canvasNoteGroupId === 'string'
      ? parent.meta.canvasNoteGroupId
      : domainId(parent).replace(/^group:/, '')
  const groupParent = shapes.get(parent.parentId)
  return groupParent?.type === 'frame'
    ? { groupId, parentFrameId: domainId(groupParent) }
    : { groupId }
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

/** Convert document-scoped tldraw records back into the readable board domain. */
export function tldrawToBoard(
  source: BoardFile,
  records: readonly unknown[],
  camera: BoardFile['camera'] = source.camera,
  now: Date | string = new Date()
): TldrawToBoardResult {
  const diagnostics: BoardSerializerDiagnostic[] = []
  const timestamp = typeof now === 'string' ? now : now.toISOString()
  const shapes = new Map(records.filter(isShapeRecord).map((shape) => [shape.id, shape] as const))
  const nodes: BoardFile['nodes'] = []
  const connections: BoardFile['connections'] = []
  const ids = new Set<string>()

  for (const shape of shapes.values()) {
    if (shape.type === 'group' || shape.type === 'arrow') continue
    if (shape.type !== CN_NOTE_TYPE && shape.type !== CN_CHECKLIST_TYPE && shape.type !== 'frame') {
      diagnostics.push({
        code: 'unsupported-shape',
        id: shape.id,
        message: `tldraw shape type ${shape.type} is not supported and was ignored.`
      })
      continue
    }

    const id = domainId(shape)
    if (ids.has(id)) {
      diagnostics.push({
        code: 'duplicate-id',
        id,
        message: `Duplicate object ID ${id} was ignored.`
      })
      continue
    }

    const props = shape.props
    const common = {
      id,
      x: shape.x,
      y: shape.y,
      width: props.w,
      height: props.h,
      rotation: radiansToDegrees(shape.rotation),
      locked: shape.isLocked,
      ...relationFields(shape, shapes),
      tags: stringArray(props.tags ?? shape.meta.canvasNoteTags),
      createdAt:
        typeof props.createdAt === 'string'
          ? props.createdAt
          : typeof shape.meta.canvasNoteCreatedAt === 'string'
            ? shape.meta.canvasNoteCreatedAt
            : timestamp,
      updatedAt:
        typeof props.updatedAt === 'string'
          ? props.updatedAt
          : typeof shape.meta.canvasNoteUpdatedAt === 'string'
            ? shape.meta.canvasNoteUpdatedAt
            : timestamp
    }
    const candidate =
      shape.type === CN_NOTE_TYPE
        ? {
            ...common,
            type: 'note',
            title: props.title,
            content: props.content,
            background: props.background,
            textColor: props.textColor,
            fontSize: props.fontSize,
            textAlign: props.textAlign
          }
        : shape.type === CN_CHECKLIST_TYPE
          ? {
              ...common,
              type: 'checklist',
              title: props.title,
              items: props.items,
              background: props.background,
              textColor: props.textColor,
              fontSize: props.fontSize,
              textAlign: props.textAlign
            }
          : {
              ...common,
              type: 'frame',
              title: props.name,
              background:
                typeof shape.meta.canvasNoteFrameBackground === 'string'
                  ? shape.meta.canvasNoteFrameBackground
                  : '#f7f7f5',
              border:
                typeof shape.meta.canvasNoteFrameBorder === 'string'
                  ? shape.meta.canvasNoteFrameBorder
                  : '#d7d8dc'
            }
    const parsed = canvasNodeSchema.safeParse(candidate)
    if (!parsed.success) {
      diagnostics.push({
        code: 'invalid-shape',
        id,
        message: `Shape ${id} was ignored because its CanvasNote properties are invalid.`
      })
      continue
    }
    ids.add(id)
    nodes.push(parsed.data)
  }

  const bindings = records.filter(isBindingRecord)
  for (const shape of shapes.values()) {
    if (shape.type !== 'arrow') continue
    const arrowBindings = bindings.filter(
      ({ type, fromId }) => type === 'arrow' && fromId === shape.id
    )
    const start = arrowBindings.find(({ props }) => props.terminal === 'start')
    const end = arrowBindings.find(({ props }) => props.terminal === 'end')
    if (!start || !end) {
      diagnostics.push({
        code: 'broken-connection',
        id: shape.id,
        message: `Arrow ${shape.id} is missing a start or end binding and was ignored.`
      })
      continue
    }

    const id = domainId(shape)
    if (ids.has(id)) {
      diagnostics.push({
        code: 'duplicate-id',
        id,
        message: `Duplicate object ID ${id} was ignored.`
      })
      continue
    }
    const dash = shape.props.dash
    const candidate = {
      id,
      type:
        shape.meta.canvasNoteConnectionType === 'line' || shape.props.arrowheadEnd === 'none'
          ? 'line'
          : 'arrow',
      sourceNodeId: domainId(shapes.get(start.toId) ?? { id: start.toId, meta: {} }),
      targetNodeId: domainId(shapes.get(end.toId) ?? { id: end.toId, meta: {} }),
      label: plainText(shape.props.richText),
      style: dash === 'dashed' || dash === 'dotted' ? dash : 'solid',
      createdAt:
        typeof shape.meta.canvasNoteCreatedAt === 'string'
          ? shape.meta.canvasNoteCreatedAt
          : timestamp,
      updatedAt:
        typeof shape.meta.canvasNoteUpdatedAt === 'string'
          ? shape.meta.canvasNoteUpdatedAt
          : timestamp
    }
    const parsed = connectionSchema.safeParse(candidate)
    if (!parsed.success) {
      diagnostics.push({
        code: 'broken-connection',
        id,
        message: `Arrow ${id} could not be converted into a CanvasNote connection.`
      })
      continue
    }
    ids.add(id)
    connections.push(parsed.data)
  }

  const candidate = {
    ...source,
    camera: { ...camera },
    nodes,
    connections,
    updatedAt: timestamp
  }
  const parsed = boardFileSchema.safeParse(candidate)
  if (!parsed.success) {
    diagnostics.push({
      code: 'invalid-board',
      id: source.id,
      message: 'The tldraw records produced an invalid CanvasNote board.'
    })
    return { board: candidate as BoardFile, diagnostics }
  }

  return { board: parsed.data, diagnostics }
}
