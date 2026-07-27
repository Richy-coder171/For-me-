import { describe, expect, it } from 'vitest'

import { describeSaveFailure } from '../../src/renderer/canvas/saveFailure'

describe('save failure messages', () => {
  it('separates conflicts, validation blocks, and storage failures without exposing board ids', () => {
    const conflict = describeSaveFailure(
      new Error(
        "Error invoking remote method 'board:save': Error: Board board-private-123 changed outside this session."
      )
    )
    const validation = describeSaveFailure(new Error('CanvasNote refused a lossy board save.'))
    const storage = describeSaveFailure(new Error('The workspace is temporarily unavailable.'))

    expect(conflict).toMatchObject({ kind: 'conflict', title: 'Externally modified' })
    expect(conflict.details).toBe('Board changed outside this session.')
    expect(conflict.details).not.toContain('board-private-123')
    expect(validation).toMatchObject({ kind: 'validation', title: 'Save blocked' })
    expect(storage).toMatchObject({ kind: 'storage', title: 'Save failed' })
  })
})
