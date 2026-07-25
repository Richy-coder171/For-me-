import { z } from 'zod'

export const exportCanvasRequestSchema = z
  .object({
    format: z.enum(['png', 'pdf']),
    title: z.string().trim().min(1).max(240),
    rect: z
      .object({
        x: z.number().int().min(0).max(16_384),
        y: z.number().int().min(0).max(16_384),
        width: z.number().int().positive().max(8_192),
        height: z.number().int().positive().max(8_192)
      })
      .strict()
  })
  .strict()

export type ExportCanvasRequest = z.infer<typeof exportCanvasRequestSchema>
