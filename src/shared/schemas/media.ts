import { z } from 'zod'

import { relativeWorkspacePathSchema, stableIdSchema } from './common'

export const MEDIA_SCHEME = 'canvasnote-media'

export const mediaKindSchema = z.enum(['image', 'video', 'file'])

export const mediaRelativePathSchema = relativeWorkspacePathSchema.refine(
  (value) => /^media\/(images|videos|files)\/[^/]+$/.test(value),
  'Media path must point to a supported workspace media folder'
)

export const mediaImportRequestSchema = z.object({ kind: mediaKindSchema }).strict()

export const mediaPathRequestSchema = z.object({ relativePath: mediaRelativePathSchema }).strict()

export function mediaUrlForPath(relativePath: string): string {
  const safePath = mediaRelativePathSchema.parse(relativePath)
  const encodedPath = safePath.split('/').map(encodeURIComponent).join('/')
  return `${MEDIA_SCHEME}://workspace/${encodedPath}`
}

export function mediaPathFromUrl(value: string): string {
  const url = new URL(value)
  if (
    url.protocol !== `${MEDIA_SCHEME}:` ||
    url.hostname !== 'workspace' ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !url.pathname.startsWith('/')
  ) {
    throw new Error('Invalid CanvasNote media URL.')
  }

  const relativePath = url.pathname
    .slice(1)
    .split('/')
    .map((segment) => decodeURIComponent(segment))
    .join('/')
  return mediaRelativePathSchema.parse(relativePath)
}

export const mediaUrlSchema = z
  .string()
  .max(2048)
  .refine((value) => {
    try {
      mediaPathFromUrl(value)
      return true
    } catch {
      return false
    }
  }, 'Invalid CanvasNote media URL')

export const importedMediaSchema = z
  .object({
    id: stableIdSchema,
    kind: mediaKindSchema,
    relativePath: mediaRelativePathSchema,
    filename: z.string().min(1).max(255),
    extension: z.string().regex(/^[a-z0-9]{1,32}$/),
    sizeBytes: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    mimeType: z
      .string()
      .max(128)
      .regex(/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i),
    url: mediaUrlSchema
  })
  .strict()
  .superRefine((media, context) => {
    if (mediaPathFromUrl(media.url) !== media.relativePath) {
      context.addIssue({
        code: 'custom',
        path: ['url'],
        message: 'Media URL does not match its relative path'
      })
    }
  })

export type MediaKind = z.infer<typeof mediaKindSchema>
export type ImportedMedia = z.infer<typeof importedMediaSchema>
