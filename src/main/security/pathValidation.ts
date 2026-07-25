import { lstatSync, realpathSync } from 'node:fs'
import { lstat, realpath } from 'node:fs/promises'
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
      await lstat(existingPath)
    } catch (error) {
      if (
        error === null ||
        typeof error !== 'object' ||
        !('code' in error) ||
        !['ENOENT', 'ENOTDIR'].includes(String(error.code))
      ) {
        throw new Error('Unable to validate the workspace path.', { cause: error })
      }
      const parent = path.dirname(existingPath)
      if (parent === existingPath) break
      existingPath = parent
      continue
    }
    let realCandidate: string
    try {
      realCandidate = await realpath(existingPath)
    } catch (error) {
      throw new Error('Unable to validate the workspace path.', { cause: error })
    }
    if (!isPathInside(realRoot, realCandidate)) {
      throw new Error('Symbolic links cannot escape the active workspace.')
    }
    return
  }

  throw new Error('Unable to validate the workspace path.')
}

export function assertNoSymlinkEscapeSync(root: string, candidate: string): void {
  if (!isPathInside(root, candidate)) throw new Error('Path escaped the active workspace.')

  const realRoot = realpathSync(root)
  let existingPath = candidate
  while (isPathInside(root, existingPath)) {
    try {
      lstatSync(existingPath)
    } catch (error) {
      if (
        error === null ||
        typeof error !== 'object' ||
        !('code' in error) ||
        !['ENOENT', 'ENOTDIR'].includes(String(error.code))
      ) {
        throw new Error('Unable to validate the workspace path.', { cause: error })
      }
      const parent = path.dirname(existingPath)
      if (parent === existingPath) break
      existingPath = parent
      continue
    }
    let realCandidate: string
    try {
      realCandidate = realpathSync(existingPath)
    } catch (error) {
      throw new Error('Unable to validate the workspace path.', { cause: error })
    }
    if (!isPathInside(realRoot, realCandidate)) {
      throw new Error('Symbolic links cannot escape the active workspace.')
    }
    return
  }

  throw new Error('Unable to validate the workspace path.')
}
