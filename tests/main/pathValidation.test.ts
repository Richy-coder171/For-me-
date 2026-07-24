import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { isPathInside, resolveWorkspacePath } from '../../src/main/security/pathValidation'

describe('workspace path validation', () => {
  const root = path.resolve('D:/workspaces/research')

  it('resolves portable paths beneath the workspace', () => {
    expect(resolveWorkspacePath(root, 'media/videos/clip.mp4')).toBe(
      path.resolve(root, 'media/videos/clip.mp4')
    )
  })

  it('rejects absolute and traversal paths', () => {
    expect(() => resolveWorkspacePath(root, '../outside.txt')).toThrow()
    expect(() => resolveWorkspacePath(root, 'C:/outside.txt')).toThrow()
    expect(() => resolveWorkspacePath(root, 'media\\..\\outside.txt')).toThrow()
  })

  it('does not confuse sibling prefixes with containment', () => {
    expect(isPathInside(root, `${root}-backup/file.txt`)).toBe(false)
    expect(isPathInside(root, path.join(root, 'boards', 'one.canvasnote'))).toBe(true)
  })
})
