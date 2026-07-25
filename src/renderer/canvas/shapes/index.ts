import './shapes.css'

import { CNChecklistShapeUtil } from './ChecklistShapeUtil'
import { CNEmbeddedVideoShapeUtil } from './EmbeddedVideoShapeUtil'
import { CNFileShapeUtil } from './FileShapeUtil'
import { CNImageShapeUtil } from './ImageShapeUtil'
import { CNLocalVideoShapeUtil } from './LocalVideoShapeUtil'
import { CNNoteShapeUtil } from './NoteShapeUtil'
import { CNTimestampNoteShapeUtil } from './TimestampNoteShapeUtil'

export * from './ChecklistShapeUtil'
export * from './EmbeddedVideoShapeUtil'
export * from './FileShapeUtil'
export * from './ImageShapeUtil'
export * from './LocalVideoShapeUtil'
export * from './MediaShapeTypes'
export * from './NoteShapeUtil'
export * from './TimestampNoteShapeUtil'
export * from './types'
export * from './videoShapeEvents'

export const canvasShapeUtils = [
  CNNoteShapeUtil,
  CNChecklistShapeUtil,
  CNImageShapeUtil,
  CNFileShapeUtil,
  CNLocalVideoShapeUtil,
  CNEmbeddedVideoShapeUtil,
  CNTimestampNoteShapeUtil
] as const
export const shapeUtils = canvasShapeUtils
