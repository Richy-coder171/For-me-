import path from 'node:path'

import { describe, expect, it, vi } from 'vitest'

const filesystem = vi.hoisted(() => ({
  realpath: vi.fn(),
  stat: vi.fn()
}))

vi.mock('node:fs/promises', () => ({ ...filesystem, default: filesystem }))

import { assertNoSymlinkEscape } from '../../src/main/security/pathValidation'

describe('workspace path validation errors', () => {
  const root = path.resolve('workspace')
  const candidate = path.join(root, 'media', 'missing.txt')

  it('climbs to an existing parent for ENOENT', async () => {
    const parent = path.dirname(candidate)
    filesystem.realpath.mockReset().mockResolvedValueOnce(root).mockResolvedValueOnce(parent)
    filesystem.stat
      .mockReset()
      .mockRejectedValueOnce(Object.assign(new Error('missing'), { code: 'ENOENT' }))
      .mockResolvedValueOnce({})

    await expect(assertNoSymlinkEscape(root, candidate)).resolves.toBeUndefined()
    expect(filesystem.stat).toHaveBeenCalledTimes(2)
  })

  it('fails closed without climbing on permission errors', async () => {
    filesystem.realpath.mockReset().mockResolvedValue(root)
    filesystem.stat
      .mockReset()
      .mockRejectedValue(Object.assign(new Error('denied'), { code: 'EACCES' }))

    await expect(assertNoSymlinkEscape(root, candidate)).rejects.toThrow(
      'Unable to validate the workspace path.'
    )
    expect(filesystem.stat).toHaveBeenCalledOnce()
  })
})
