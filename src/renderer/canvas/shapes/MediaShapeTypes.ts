import { createShapeId, type TLShape, type TLShapePartial } from '@tldraw/tlschema'

export const CN_IMAGE_TYPE = 'cn-image' as const
export const CN_FILE_TYPE = 'cn-file' as const

interface CNMediaShapeProps {
  w: number
  h: number
  mediaId: string
  mediaPath: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface CNImageShapeProps extends CNMediaShapeProps {
  caption: string
  altText: string
  fit: 'contain' | 'cover'
}

export interface CNFileShapeProps extends CNMediaShapeProps {
  filename: string
  extension: string
  sizeBytes: number
}

declare module '@tldraw/tlschema' {
  interface TLGlobalShapePropsMap {
    'cn-image': CNImageShapeProps
    'cn-file': CNFileShapeProps
  }
}

export type CNImageShape = TLShape<typeof CN_IMAGE_TYPE>
export type CNFileShape = TLShape<typeof CN_FILE_TYPE>

export function isCNImageShape(shape: TLShape): shape is CNImageShape {
  return shape.type === CN_IMAGE_TYPE
}

export function isCNFileShape(shape: TLShape): shape is CNFileShape {
  return shape.type === CN_FILE_TYPE
}

export function getDefaultCNImageProps(now = new Date().toISOString()): CNImageShapeProps {
  return {
    w: 360,
    h: 240,
    mediaId: 'media:pending',
    mediaPath: 'media/images/pending',
    caption: '',
    altText: '',
    fit: 'contain',
    tags: [],
    createdAt: now,
    updatedAt: now
  }
}

export function getDefaultCNFileProps(now = new Date().toISOString()): CNFileShapeProps {
  return {
    w: 320,
    h: 148,
    mediaId: 'media:pending',
    mediaPath: 'media/files/pending',
    filename: 'Attached file',
    extension: '',
    sizeBytes: 0,
    tags: [],
    createdAt: now,
    updatedAt: now
  }
}

type ImageSource = Pick<CNImageShapeProps, 'mediaId' | 'mediaPath'> &
  Partial<Omit<CNImageShapeProps, 'mediaId' | 'mediaPath'>>

type FileSource = Pick<
  CNFileShapeProps,
  'mediaId' | 'mediaPath' | 'filename' | 'extension' | 'sizeBytes'
> &
  Partial<Omit<CNFileShapeProps, 'mediaId' | 'mediaPath' | 'filename' | 'extension' | 'sizeBytes'>>

export function createCNImageShape(
  x: number,
  y: number,
  props: ImageSource
): TLShapePartial<CNImageShape> {
  return {
    id: createShapeId(),
    type: CN_IMAGE_TYPE,
    x,
    y,
    props: { ...getDefaultCNImageProps(), ...props }
  }
}

export function createCNFileShape(
  x: number,
  y: number,
  props: FileSource
): TLShapePartial<CNFileShape> {
  return {
    id: createShapeId(),
    type: CN_FILE_TYPE,
    x,
    y,
    props: { ...getDefaultCNFileProps(), ...props }
  }
}
