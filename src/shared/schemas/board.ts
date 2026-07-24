import { z } from 'zod'

import {
  dimensionSchema,
  finiteCoordinateSchema,
  isoDateSchema,
  relativeWorkspacePathSchema,
  safeHttpsUrlSchema,
  safeWebUrlSchema,
  stableIdSchema
} from './common'

export const BOARD_FORMAT = 'canvasnote-board'
export const BOARD_VERSION = 1

const baseNodeFields = {
  id: stableIdSchema,
  x: finiteCoordinateSchema,
  y: finiteCoordinateSchema,
  width: dimensionSchema,
  height: dimensionSchema,
  rotation: z.number().finite().min(-360).max(360).default(0),
  locked: z.boolean().default(false),
  groupId: stableIdSchema.optional(),
  parentFrameId: stableIdSchema.optional(),
  tags: z.array(z.string().trim().min(1).max(64)).max(50).default([]),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema
}

const textStyleFields = {
  background: z.enum(['paper', 'amber', 'rose', 'mint', 'sky', 'slate']).default('paper'),
  textColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default('#202124'),
  fontSize: z.number().int().min(10).max(96).default(16),
  textAlign: z.enum(['left', 'center', 'right']).default('left')
}

export const textNoteSchema = z
  .object({
    ...baseNodeFields,
    ...textStyleFields,
    type: z.literal('note'),
    title: z.string().max(240).default(''),
    content: z.string().max(100_000).default('')
  })
  .strict()

export const checklistItemSchema = z
  .object({
    id: stableIdSchema,
    text: z.string().max(10_000),
    checked: z.boolean()
  })
  .strict()

export const checklistSchema = z
  .object({
    ...baseNodeFields,
    ...textStyleFields,
    type: z.literal('checklist'),
    title: z.string().max(240).default('Checklist'),
    items: z.array(checklistItemSchema).max(500)
  })
  .strict()
  .superRefine((node, context) => {
    const ids = new Set<string>()
    node.items.forEach((item, index) => {
      if (ids.has(item.id)) {
        context.addIssue({
          code: 'custom',
          path: ['items', index, 'id'],
          message: `Duplicate checklist item ID: ${item.id}`
        })
      }
      ids.add(item.id)
    })
  })

export const imageNodeSchema = z
  .object({
    ...baseNodeFields,
    type: z.literal('image'),
    mediaId: stableIdSchema,
    mediaPath: relativeWorkspacePathSchema,
    caption: z.string().max(2_000).default(''),
    altText: z.string().max(2_000).default(''),
    fit: z.enum(['contain', 'cover']).default('contain')
  })
  .strict()

export const localVideoNodeSchema = z
  .object({
    ...baseNodeFields,
    type: z.literal('local-video'),
    mediaId: stableIdSchema,
    mediaPath: relativeWorkspacePathSchema,
    caption: z.string().max(2_000).default(''),
    posterPath: relativeWorkspacePathSchema.optional(),
    durationSeconds: z.number().finite().nonnegative().optional(),
    playbackRate: z.number().finite().min(0.25).max(4).default(1)
  })
  .strict()

export const embeddedVideoNodeSchema = z
  .object({
    ...baseNodeFields,
    type: z.literal('embedded-video'),
    provider: z.enum(['youtube', 'vimeo']),
    url: safeHttpsUrlSchema,
    videoId: z.string().min(1).max(128),
    caption: z.string().max(2_000).default('')
  })
  .strict()

export const timestampNoteSchema = z
  .object({
    ...baseNodeFields,
    ...textStyleFields,
    type: z.literal('timestamp-note'),
    videoNodeId: stableIdSchema,
    timestampSeconds: z.number().finite().nonnegative().max(604_800),
    content: z.string().max(100_000).default('')
  })
  .strict()

export const linkNodeSchema = z
  .object({
    ...baseNodeFields,
    type: z.literal('link'),
    url: safeWebUrlSchema,
    title: z.string().max(500).default(''),
    description: z.string().max(4_000).default(''),
    domain: z.string().max(255),
    previewImageUrl: safeHttpsUrlSchema.optional()
  })
  .strict()

export const fileNodeSchema = z
  .object({
    ...baseNodeFields,
    type: z.literal('file'),
    mediaId: stableIdSchema,
    mediaPath: relativeWorkspacePathSchema,
    filename: z.string().min(1).max(255),
    extension: z.string().max(32),
    sizeBytes: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
  })
  .strict()

export const frameNodeSchema = z
  .object({
    ...baseNodeFields,
    type: z.literal('frame'),
    title: z.string().max(240).default('Frame'),
    background: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .default('#f7f7f5'),
    border: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .default('#d7d8dc')
  })
  .strict()

export const canvasNodeSchema = z.discriminatedUnion('type', [
  textNoteSchema,
  checklistSchema,
  imageNodeSchema,
  localVideoNodeSchema,
  embeddedVideoNodeSchema,
  timestampNoteSchema,
  linkNodeSchema,
  fileNodeSchema,
  frameNodeSchema
])

export const connectionSchema = z
  .object({
    id: stableIdSchema,
    type: z.enum(['arrow', 'line']),
    sourceNodeId: stableIdSchema,
    targetNodeId: stableIdSchema,
    label: z.string().max(500).default(''),
    style: z.enum(['solid', 'dashed', 'dotted']).default('solid'),
    createdAt: isoDateSchema,
    updatedAt: isoDateSchema
  })
  .strict()

export const boardFileSchema = z
  .object({
    format: z.literal(BOARD_FORMAT),
    version: z.literal(BOARD_VERSION),
    id: stableIdSchema,
    title: z.string().trim().min(1).max(240),
    camera: z
      .object({
        x: finiteCoordinateSchema,
        y: finiteCoordinateSchema,
        zoom: z.number().finite().min(0.1).max(4)
      })
      .strict(),
    nodes: z.array(canvasNodeSchema).max(20_000),
    connections: z.array(connectionSchema).max(20_000),
    createdAt: isoDateSchema,
    updatedAt: isoDateSchema
  })
  .strict()
  .superRefine((board, context) => {
    const ids = new Set<string>()
    board.nodes.forEach((node, index) => {
      if (ids.has(node.id)) {
        context.addIssue({
          code: 'custom',
          path: ['nodes', index, 'id'],
          message: `Duplicate object ID: ${node.id}`
        })
      }
      ids.add(node.id)
    })
    board.connections.forEach((connection, index) => {
      if (ids.has(connection.id)) {
        context.addIssue({
          code: 'custom',
          path: ['connections', index, 'id'],
          message: `Duplicate object ID: ${connection.id}`
        })
      }
      ids.add(connection.id)
    })
  })

export type CanvasNode = z.infer<typeof canvasNodeSchema>
export type BoardFile = z.infer<typeof boardFileSchema>
export type BoardConnection = z.infer<typeof connectionSchema>

export interface BrokenReference {
  ownerId: string
  targetId: string
  kind: 'timestamp-video' | 'connection-source' | 'connection-target' | 'frame-parent'
}

export function findBrokenReferences(board: BoardFile): BrokenReference[] {
  const ids = new Set(board.nodes.map((node) => node.id))
  const broken: BrokenReference[] = []

  for (const node of board.nodes) {
    if (node.type === 'timestamp-note' && !ids.has(node.videoNodeId)) {
      broken.push({
        ownerId: node.id,
        targetId: node.videoNodeId,
        kind: 'timestamp-video'
      })
    }
    if (node.parentFrameId && !ids.has(node.parentFrameId)) {
      broken.push({ ownerId: node.id, targetId: node.parentFrameId, kind: 'frame-parent' })
    }
  }

  for (const connection of board.connections) {
    if (!ids.has(connection.sourceNodeId)) {
      broken.push({
        ownerId: connection.id,
        targetId: connection.sourceNodeId,
        kind: 'connection-source'
      })
    }
    if (!ids.has(connection.targetNodeId)) {
      broken.push({
        ownerId: connection.id,
        targetId: connection.targetNodeId,
        kind: 'connection-target'
      })
    }
  }

  return broken
}

export function createEmptyBoard(id: string, title: string, now = new Date()): BoardFile {
  const timestamp = now.toISOString()
  return boardFileSchema.parse({
    format: BOARD_FORMAT,
    version: BOARD_VERSION,
    id,
    title,
    camera: { x: 0, y: 0, zoom: 1 },
    nodes: [],
    connections: [],
    createdAt: timestamp,
    updatedAt: timestamp
  })
}
