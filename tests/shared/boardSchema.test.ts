import { describe, expect, it } from 'vitest'

import {
  boardFileSchema,
  createEmptyBoard,
  findBrokenReferences,
  type BoardFile
} from '../../src/shared/schemas/board'

const now = '2026-07-25T00:00:00.000Z'

function baseNode(id: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    x: 0,
    y: 0,
    width: 280,
    height: 160,
    createdAt: now,
    updatedAt: now,
    ...overrides
  }
}

function note(id: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return baseNode(id, { type: 'note', title: '', content: '', ...overrides })
}

describe('boardFileSchema', () => {
  it('creates and validates a readable empty board', () => {
    const board = createEmptyBoard('board-research', 'Video research', new Date(now))

    expect(boardFileSchema.parse(board)).toEqual(board)
    expect(board.nodes).toEqual([])
  })

  it('rejects duplicate object IDs', () => {
    const board = {
      ...createEmptyBoard('board-1', 'Board', new Date(now)),
      nodes: [note('node-1'), note('node-1', { x: 20 })]
    }

    expect(() => boardFileSchema.parse(board)).toThrow(/Duplicate object ID/)
  })

  it.each([
    'C:/Users/example/video.mp4',
    '/home/example/video.mp4',
    '../video.mp4',
    'media/../video.mp4',
    'media\\video.mp4',
    'media/%2e%2e/video.mp4'
  ])('rejects unsafe media path %s', (mediaPath) => {
    const board = {
      ...createEmptyBoard('board-1', 'Board', new Date(now)),
      nodes: [
        {
          ...baseNode('video-1'),
          type: 'local-video',
          mediaId: 'media-1',
          mediaPath,
          caption: ''
        }
      ]
    }

    expect(() => boardFileSchema.parse(board)).toThrow(/workspace/)
  })

  it('rejects invalid dimensions and timestamps', () => {
    const board = {
      ...createEmptyBoard('board-1', 'Board', new Date(now)),
      nodes: [
        {
          ...baseNode('timestamp-1', { width: 0 }),
          type: 'timestamp-note',
          videoNodeId: 'video-1',
          timestampSeconds: -1,
          content: ''
        }
      ]
    }

    expect(() => boardFileSchema.parse(board)).toThrow()
  })

  it('accepts safe link cards and rejects executable URLs', () => {
    const board = createEmptyBoard('board-1', 'Board', new Date(now))
    const link = {
      ...baseNode('link-1'),
      type: 'link',
      url: 'https://example.com/guide',
      title: 'Guide',
      description: 'Reference',
      domain: 'example.com'
    }

    expect(boardFileSchema.parse({ ...board, nodes: [link] }).nodes[0]).toMatchObject({
      type: 'link',
      url: 'https://example.com/guide'
    })
    expect(() =>
      boardFileSchema.parse({ ...board, nodes: [{ ...link, url: 'javascript:alert(1)' }] })
    ).toThrow(/HTTP/)
  })

  it('preserves content while reporting broken semantic references', () => {
    const parsed = boardFileSchema.parse({
      ...createEmptyBoard('board-1', 'Board', new Date(now)),
      nodes: [
        {
          ...baseNode('timestamp-1'),
          type: 'timestamp-note',
          videoNodeId: 'missing-video',
          timestampSeconds: 155.4,
          content: 'Keep this insight'
        }
      ]
    }) as BoardFile

    expect(findBrokenReferences(parsed)).toEqual([
      {
        ownerId: 'timestamp-1',
        targetId: 'missing-video',
        kind: 'timestamp-video'
      }
    ])
  })
})
