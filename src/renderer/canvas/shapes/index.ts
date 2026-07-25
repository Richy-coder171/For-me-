import './shapes.css'

import { CNChecklistShapeUtil } from './ChecklistShapeUtil'
import { CNNoteShapeUtil } from './NoteShapeUtil'

export * from './ChecklistShapeUtil'
export * from './NoteShapeUtil'
export * from './types'

export const canvasShapeUtils = [CNNoteShapeUtil, CNChecklistShapeUtil] as const
export const shapeUtils = canvasShapeUtils
