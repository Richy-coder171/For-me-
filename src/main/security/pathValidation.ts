import { realpath, stat } from 'node:fs/promises'
import path from 'node:path'

import { relativeWorkspacePathSchema } from '../../shared/schemas/common'

function normalizedForComparison(value: string): string {
  const normalized = path.resolve(value)
  return process.platform === 'win32' ? normalized.toLocaleLowerCase('en-US') : normalized
}

export function isPathInside(root: string, candidate: string): boolean {
  const normalizedRoot = normalizedForComparison(root)
  const normalizedCandidate = normalizedForComparison(candidate)
  return (
    normalizedCandidate === normalizedRoot ||
    normalizedCandidate.startsWith(`${normalizedRoot}${path.sep}`)
  )
}

export function resolveWorkspacePath(root: string, relativePath: string): string {
  const safePath = relativeWorkspacePathSchema.parse(relativePath)
  const resolved = path.resolve(root, ...safePath.split('/'))
  if (!isPathInside(root, resolved) || resolved === path.resolve(root)) {
    throw new Error('The requested path is outside the active workspace.')
  }
  return resolved
}

export async function assertNoSymlinkEscape(root: string, candidate: string): Promise<void> {
  if (!isPathInside(root, candidate)) throw new Error('Path escaped the active workspace.')

  const realRoot = await realpath(root)
  let existingPath = candidate
  while (isPathInside(root, existingPath)) {
    try {
      await stat(existingPath)
      const realCandidate = await realpath(existingPath)
      if (!isPathInside(realRoot, realCandidate)) {
        throw new Error('Symbolic links cannot escape the active workspace.')
      }
      return
    } catch (error) {
      if (error instanceof Error && error.message.includes('Symbolic links')) throw error
      const parent = path.dirname(existingPath)
      if (parent === existingPath) break
      existingPath = parent
    }
  }

  throw new Error('Unable to validate the workspace path.')
}
