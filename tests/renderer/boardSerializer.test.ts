import { describe, expect, it } from 'vitest'
import { createTLSchema } from '@tldraw/tlschema'

import { boardFileSchema, createEmptyBoard, type BoardFile } from '../../src/shared/schemas/board'
import { boardToTldraw, tldrawToBoard } from '../../src/renderer/canvas/boardSerializer'

const now = '2026-07-25T12:00:00.000Z'

function testBoard(): BoardFile {
  return boardFileSchema.parse({
    ...createEmptyBoard('board-1', 'Serializer', new Date(now)),
    camera: { x: 120, y: -80, zoom: 1.5 },
    nodes: [
      {
        id: 'frame-1',
        type: 'frame',
        x: 10,
        y: 20,
        width: 900,
        height: 600,
        rotation: 0,
        locked: true,
        tags: ['section'],
        title: 'Research',
        background: '#f7f7f5',
        border: '#d7d8dc',
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'note-1',
        type: 'note',
        x: 40,
        y: 60,
        width: 300,
        height: 220,
        rotation: 90,
        locked: false,
        groupId: 'group-a',
        parentFrameId: 'frame-1',
        tags: ['important'],
        title: 'Opening',
        content: 'Start here',
        background: 'amber',
        textColor: '#202124',
        fontSize: 18,
        textAlign: 'left',
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'checklist-1',
        type: 'checklist',
        x: 380,
        y: 60,
        width: 320,
        height: 260,
        rotation: 0,
        locked: false,
        groupId: 'group-a',
        parentFrameId: 'frame-1',
        tags: [],
        title: 'Tasks',
        items: [{ id: 'item-1', text: 'Review clip', checked: true }],
        background: 'mint',
        textColor: '#202124',
        fontSize: 16,
        textAlign: 'left',
        createdAt: now,
        updatedAt: now
      }
    ],
    connections: [
      {
        id: 'connection-1',
        type: 'arrow',
        sourceNodeId: 'note-1',
        targetNodeId: 'checklist-1',
        label: 'next',
        style: 'dashed',
        createdAt: now,
        updatedAt: now
      }
    ]
  })
}

describe('board serializer', () => {
  it('maps readable nodes to stable tldraw records while keeping camera separate', () => {
    const board = testBoard()
    const result = boardToTldraw(board)

    expect(result.camera).toEqual(board.camera)
    expect(result.records.map((record) => record.typeName)).not.toContain('camera')
    expect(result.diagnostics).toEqual([])

    const frame = result.records.find((record) => record.id === 'shape:frame-1')
    const group = result.records.find((record) => record.id === 'shape:group:group-a')
    const note = result.records.find((record) => record.id === 'shape:note-1')
    const checklist = result.records.find((record) => record.id === 'shape:checklist-1')

    expect(frame).toMatchObject({
      typeName: 'shape',
      type: 'frame',
      isLocked: true,
      props: { w: 900, h: 600, name: 'Research' }
    })
    expect(group).toMatchObject({ type: 'group', parentId: 'shape:frame-1' })
    expect(note).toMatchObject({
      type: 'cn-note',
      parentId: 'shape:group:group-a',
      x: 40,
      y: 60,
      rotation: Math.PI / 2,
      props: { title: 'Opening', content: 'Start here', w: 300, h: 220 }
    })
    expect(checklist).toMatchObject({
      type: 'cn-checklist',
      props: { items: [{ id: 'item-1', text: 'Review clip', checked: true }] }
    })

    const schema = createTLSchema()
    for (const record of result.records.filter(
      (item) => item.typeName === 'binding' || !item.type.startsWith('cn-')
    )) {
      expect(() => schema.types[record.typeName].validator.validate(record)).not.toThrow()
    }
  })

  it('round-trips notes, checklists, frames, grouping, and arrow bindings', () => {
    const original = testBoard()
    const loaded = boardToTldraw(original)
    const saved = tldrawToBoard(original, loaded.records, loaded.camera, now)

    expect(saved.diagnostics).toEqual([])
    expect(saved.board).toEqual(original)
  })

  it('ignores unknown or malformed shapes and reports diagnostics', () => {
    const original = testBoard()
    const loaded = boardToTldraw(original)
    const unknown = {
      id: 'shape:unknown-1',
      typeName: 'shape',
      type: 'future-widget',
      x: 0,
      y: 0,
      rotation: 0,
      index: 'a9',
      parentId: 'page:canvasnote',
      isLocked: false,
      opacity: 1,
      props: {},
      meta: {}
    }

    const saved = tldrawToBoard(original, [...loaded.records, unknown, null], original.camera, now)

    expect(saved.board.nodes).toEqual(original.nodes)
    expect(saved.diagnostics).toContainEqual({
      code: 'unsupported-shape',
      id: 'shape:unknown-1',
      message: 'tldraw shape type future-widget is not supported and was ignored.'
    })
  })
})
