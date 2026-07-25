import { describe, expect, it } from 'vitest'

import { searchBoard } from '../../src/renderer/canvas/boardSearch'
import { createBoardFromTemplate } from '../../src/shared/templates'

describe('board search', () => {
  it('searches editable object content and filters by type and tag', () => {
    const board = createBoardFromTemplate(
      'board-search',
      'video-research',
      new Date('2026-07-25T08:00:00.000Z')
    )
    const question = board.nodes.find(({ id }) => id === 'research-question')!
    question.tags = ['interview']

    expect(searchBoard(board, 'want to learn')).toMatchObject([
      { nodeId: 'research-question', type: 'note' }
    ])
    expect(searchBoard(board, '', 'note', 'inter')).toHaveLength(1)
    expect(searchBoard(board, 'watching', 'checklist')).toMatchObject([
      { nodeId: 'watch-list', type: 'checklist' }
    ])
    expect(searchBoard(board, 'watching', 'note')).toEqual([])
  })
})
