import { describe, expect, it } from 'vitest'

import { boardFileSchema } from '../../src/shared/schemas/board'
import { BOARD_TEMPLATES, createBoardFromTemplate } from '../../src/shared/templates'

describe('board templates', () => {
  it('creates six valid boards with real editable objects', () => {
    expect(BOARD_TEMPLATES).toHaveLength(6)
    for (const template of BOARD_TEMPLATES) {
      const board = createBoardFromTemplate(
        `board-${template.id}`,
        template.id,
        new Date('2026-07-25T08:00:00.000Z')
      )
      expect(boardFileSchema.safeParse(board).success).toBe(true)
      expect(board.nodes.length).toBeGreaterThan(0)
      expect(board.nodes.every(({ type }) => type !== 'image' && type !== 'local-video')).toBe(true)
    }
  })
})
