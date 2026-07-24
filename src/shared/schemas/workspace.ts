import { z } from 'zod'

import { isoDateSchema, stableIdSchema } from './common'

export const WORKSPACE_FORMAT = 'canvasnote-workspace'
export const WORKSPACE_VERSION = 1

export const workspaceManifestSchema = z
  .object({
    format: z.literal(WORKSPACE_FORMAT),
    version: z.literal(WORKSPACE_VERSION),
    id: stableIdSchema,
    name: z.string().trim().min(1).max(120),
    createdAt: isoDateSchema,
    updatedAt: isoDateSchema
  })
  .strict()

export const createWorkspaceRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(120)
  })
  .strict()

export const workspaceSummarySchema = z
  .object({
    id: stableIdSchema,
    name: z.string().min(1).max(120),
    displayPath: z.string().min(1),
    lastOpenedAt: isoDateSchema
  })
  .strict()

export type WorkspaceManifest = z.infer<typeof workspaceManifestSchema>
export type CreateWorkspaceRequest = z.infer<typeof createWorkspaceRequestSchema>
export type WorkspaceSummary = z.infer<typeof workspaceSummarySchema>
