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
      },
      {
        id: 'image-1',
        type: 'image',
        x: 40,
        y: 360,
        width: 360,
        height: 240,
        rotation: 0,
        locked: false,
        tags: ['reference'],
        mediaId: 'media:image-1',
        mediaPath: 'media/images/photo.webp',
        caption: 'Reference photo',
        altText: 'A reference photo',
        fit: 'cover',
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'file-1',
        type: 'file',
        x: 440,
        y: 360,
        width: 320,
        height: 148,
        rotation: 0,
        locked: false,
        tags: ['source'],
        mediaId: 'media:file-1',
        mediaPath: 'media/files/brief.pdf',
        filename: 'brief.pdf',
        extension: 'pdf',
        sizeBytes: 2048,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'video-1',
        type: 'local-video',
        x: 800,
        y: 60,
        width: 480,
        height: 360,
        rotation: 0,
        locked: false,
        tags: ['source'],
        mediaId: 'media:video-1',
        mediaPath: 'media/videos/interview.mp4',
        caption: 'Interview',
        durationSeconds: 180,
        playbackRate: 1.25,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'video-2',
        type: 'embedded-video',
        x: 1320,
        y: 60,
        width: 480,
        height: 360,
        rotation: 0,
        locked: false,
        tags: [],
        provider: 'vimeo',
        url: 'https://vimeo.com/123456',
        videoId: '123456',
        caption: 'External source',
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'timestamp-1',
        type: 'timestamp-note',
        x: 800,
        y: 450,
        width: 300,
        height: 180,
        rotation: 0,
        locked: false,
        tags: ['quote'],
        videoNodeId: 'video-1',
        timestampSeconds: 75.5,
        content: 'Important answer',
        background: 'amber',
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
    const image = result.records.find((record) => record.id === 'shape:image-1')
    const file = result.records.find((record) => record.id === 'shape:file-1')
    const localVideo = result.records.find((record) => record.id === 'shape:video-1')
    const embeddedVideo = result.records.find((record) => record.id === 'shape:video-2')
    const timestamp = result.records.find((record) => record.id === 'shape:timestamp-1')

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
    expect(image).toMatchObject({
      type: 'cn-image',
      props: {
        mediaId: 'media:image-1',
        mediaPath: 'media/images/photo.webp',
        caption: 'Reference photo',
        altText: 'A reference photo',
        fit: 'cover'
      }
    })
    expect(file).toMatchObject({
      type: 'cn-file',
      props: {
        mediaId: 'media:file-1',
        mediaPath: 'media/files/brief.pdf',
        filename: 'brief.pdf',
        sizeBytes: 2048
      }
    })
    expect(localVideo).toMatchObject({
      type: 'cn-local-video',
      props: { mediaPath: 'media/videos/interview.mp4', playbackRate: 1.25 }
    })
    expect(embeddedVideo).toMatchObject({
      type: 'cn-embedded-video',
      props: { provider: 'vimeo', videoId: '123456' }
    })
    expect(timestamp).toMatchObject({
      type: 'cn-timestamp-note',
      props: { videoNodeId: 'video-1', timestampSeconds: 75.5 }
    })

    const schema = createTLSchema()
    for (const record of result.records.filter(
      (item) => item.typeName === 'binding' || !item.type.startsWith('cn-')
    )) {
      expect(() => schema.types[record.typeName].validator.validate(record)).not.toThrow()
    }
  })

  it('round-trips text, media, frames, grouping, and arrow bindings', () => {
    const original = testBoard()
    const loaded = boardToTldraw(original)
    const saved = tldrawToBoard(original, loaded.records, loaded.camera, now)

    expect(saved.diagnostics).toEqual([])
    expect(saved.board).toEqual(original)
  })

  it('preserves schema-supported nodes and connections that this editor cannot render yet', () => {
    const base = testBoard()
    const original = boardFileSchema.parse({
      ...base,
      nodes: [
        ...base.nodes,
        {
          id: 'link-1',
          type: 'link',
          x: 800,
          y: 60,
          width: 320,
          height: 180,
          rotation: 0,
          locked: false,
          tags: ['source'],
          url: 'https://example.com/source',
          title: 'Source',
          description: 'External reference',
          domain: 'example.com',
          createdAt: now,
          updatedAt: now
        }
      ],
      connections: [
        ...base.connections,
        {
          id: 'connection-link',
          type: 'line',
          sourceNodeId: 'note-1',
          targetNodeId: 'link-1',
          label: 'source',
          style: 'solid',
          createdAt: now,
          updatedAt: now
        }
      ]
    })

    const loaded = boardToTldraw(original)
    const saved = tldrawToBoard(original, loaded.records, loaded.camera, now)

    expect(loaded.diagnostics.map(({ code }) => code)).toEqual(
      expect.arrayContaining(['unsupported-node', 'unsupported-connection'])
    )
    expect(saved.board.nodes).toContainEqual(
      expect.objectContaining({ id: 'link-1', type: 'link' })
    )
    expect(saved.board.connections).toContainEqual(
      expect.objectContaining({ id: 'connection-link', targetNodeId: 'link-1' })
    )
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
