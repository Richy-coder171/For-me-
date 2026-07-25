import './shapes.css'

import { CNChecklistShapeUtil } from './ChecklistShapeUtil'
import { CNFileShapeUtil } from './FileShapeUtil'
import { CNImageShapeUtil } from './ImageShapeUtil'
import { CNNoteShapeUtil } from './NoteShapeUtil'

export * from './ChecklistShapeUtil'
export * from './FileShapeUtil'
export * from './ImageShapeUtil'
export * from './MediaShapeTypes'
export * from './NoteShapeUtil'
export * from './types'

export const canvasShapeUtils = [
  CNNoteShapeUtil,
  CNChecklistShapeUtil,
  CNImageShapeUtil,
  CNFileShapeUtil
] as const
export const shapeUtils = canvasShapeUtils
