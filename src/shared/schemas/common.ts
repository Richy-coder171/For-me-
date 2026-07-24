import { z } from 'zod'

export const stableIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9:_-]+$/, 'ID contains unsupported characters')

export const isoDateSchema = z.string().datetime({ offset: true })

export const finiteCoordinateSchema = z.number().finite().min(-1_000_000).max(1_000_000)
export const dimensionSchema = z.number().finite().positive().max(100_000)

export function isSafeRelativePath(value: string): boolean {
  if (!value || value.length > 1024 || value.includes('\0') || value.includes('\\')) return false
  if (value.startsWith('/') || /^[a-zA-Z]:/.test(value) || value.startsWith('//')) return false

  let decoded = value
  try {
    for (let pass = 0; pass < 2; pass += 1) {
      const next = decodeURIComponent(decoded)
      if (next === decoded) break
      decoded = next
    }
  } catch {
    return false
  }

  if (decoded.includes('\\') || decoded.startsWith('/') || /^[a-zA-Z]:/.test(decoded)) return false
  const segments = decoded.split('/')
  return segments.every((segment) => segment !== '' && segment !== '.' && segment !== '..')
}

export const relativeWorkspacePathSchema = z
  .string()
  .min(1)
  .max(1024)
  .refine(isSafeRelativePath, 'Path must stay inside the workspace')

export function isSafeWebUrl(value: string, httpsOnly = false): boolean {
  try {
    const url = new URL(value)
    if (url.username || url.password) return false
    return httpsOnly
      ? url.protocol === 'https:'
      : url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

export const safeWebUrlSchema = z
  .string()
  .max(2048)
  .refine((value) => isSafeWebUrl(value), 'Only HTTP(S) URLs are supported')

export const safeHttpsUrlSchema = z
  .string()
  .max(2048)
  .refine((value) => isSafeWebUrl(value, true), 'Only HTTPS URLs are supported')
