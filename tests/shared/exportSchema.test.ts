import { describe, expect, it } from 'vitest'

import { exportCanvasRequestSchema } from '../../src/shared/schemas/export'

describe('export request schema', () => {
  it('accepts bounded PNG and PDF capture requests', () => {
    expect(
      exportCanvasRequestSchema.parse({
        format: 'png',
        title: 'Research board',
        rect: { x: 0, y: 72, width: 1200, height: 748 }
      })
    ).toMatchObject({ format: 'png', title: 'Research board' })
  })

  it('rejects oversized and out-of-bounds capture payloads', () => {
    expect(() =>
      exportCanvasRequestSchema.parse({
        format: 'pdf',
        title: 'Board',
        rect: { x: -1, y: 0, width: 20_000, height: 1 }
      })
    ).toThrow()
  })
})
