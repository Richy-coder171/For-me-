import { randomUUID } from 'node:crypto'
import { lstat, mkdir, open, rm, stat, type FileHandle } from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'

import type { BrowserWindow, FileFilter } from 'electron'

import {
  importedMediaSchema,
  mediaKindSchema,
  mediaRelativePathSchema,
  mediaUrlForPath,
  type ImportedMedia,
  type MediaKind
} from '../../shared/schemas/media'
import { assertNoSymlinkEscape, resolveWorkspacePath } from '../security/pathValidation'

const FOLDERS: Record<MediaKind, string> = {
  image: 'images',
  video: 'videos',
  file: 'files'
}

const MAX_BYTES: Record<MediaKind, number> = {
  image: 100 * 1024 * 1024,
  video: 20 * 1024 * 1024 * 1024,
  file: 1024 * 1024 * 1024
}

const KIND_EXTENSIONS: Partial<Record<MediaKind, ReadonlySet<string>>> = {
  image: new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']),
  video: new Set(['mp4', 'webm', 'mov'])
}

const MIME_TYPES: Record<string, string> = {
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  mov: 'video/quicktime',
  mp4: 'video/mp4',
  png: 'image/png',
  webm: 'video/webm',
  webp: 'image/webp',
  csv: 'text/csv',
  json: 'application/json',
  md: 'text/markdown',
  pdf: 'application/pdf',
  rtf: 'application/rtf',
  txt: 'text/plain',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  zip: 'application/zip'
}

const EXECUTABLE_EXTENSIONS = new Set([
  'app',
  'appimage',
  'appref-ms',
  'apk',
  'bash',
  'bat',
  'bin',
  'cmd',
  'com',
  'command',
  'cpl',
  'deb',
  'desktop',
  'dmg',
  'exe',
  'fish',
  'hta',
  'iso',
  'jar',
  'js',
  'jse',
  'lnk',
  'msi',
  'msp',
  'msix',
  'pif',
  'pkg',
  'ps1',
  'psd1',
  'psm1',
  'py',
  'pyw',
  'reg',
  'rpm',
  'run',
  'scr',
  'sh',
  'url',
  'vbe',
  'vbs',
  'wsf',
  'wsh',
  'zsh'
])

const OPENABLE_EXTENSIONS = new Set([
  'csv',
  'docx',
  'gif',
  'jpeg',
  'jpg',
  'json',
  'md',
  'mov',
  'mp4',
  'odp',
  'ods',
  'odt',
  'pdf',
  'png',
  'pptx',
  'rtf',
  'txt',
  'webm',
  'webp',
  'xlsx'
])

const MP4_BRANDS = new Set([
  'M4A ',
  'M4V ',
  'MSNV',
  'avc1',
  'dash',
  'iso2',
  'iso3',
  'iso4',
  'iso5',
  'iso6',
  'isom',
  'mp41',
  'mp42'
])

const WEBM_DOCTYPE = Buffer.from([0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d])

function hasCode(error: unknown, ...codes: string[]): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    codes.includes(String(error.code))
  )
}

function extensionOf(filePath: string): string {
  const extension = path.extname(filePath).slice(1).toLocaleLowerCase('en-US')
  if (!/^[a-z0-9]{1,32}$/.test(extension)) {
    throw new Error('The selected file must have a supported extension.')
  }
  return extension
}

export function mediaMimeType(filePath: string): string {
  const extension = path.extname(filePath).slice(1).toLocaleLowerCase('en-US')
  return MIME_TYPES[extension] ?? 'application/octet-stream'
}

function isExecutableExtension(extension: string): boolean {
  if (EXECUTABLE_EXTENSIONS.has(extension)) return true
  return (process.env.PATHEXT ?? '').toLocaleLowerCase('en-US').split(';').includes(`.${extension}`)
}

function pickerFilter(kind: MediaKind): FileFilter[] | undefined {
  if (kind === 'image') {
    return [{ name: 'Images', extensions: [...(KIND_EXTENSIONS.image ?? [])] }]
  }
  if (kind === 'video') {
    return [{ name: 'Videos', extensions: [...(KIND_EXTENSIONS.video ?? [])] }]
  }
  return undefined
}

function hasPrefix(data: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((value, index) => data[index] === value)
}

function detectedMediaFamily(header: Buffer): string | null {
  if (hasPrefix(header, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png'
  if (hasPrefix(header, [0xff, 0xd8, 0xff])) return 'jpeg'
  if (header.subarray(0, 6).toString('ascii') === 'GIF87a') return 'gif'
  if (header.subarray(0, 6).toString('ascii') === 'GIF89a') return 'gif'
  if (
    header.subarray(0, 4).toString('ascii') === 'RIFF' &&
    header.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp'
  }
  if (hasPrefix(header, [0x1a, 0x45, 0xdf, 0xa3]) && header.indexOf(WEBM_DOCTYPE) >= 4) {
    return 'webm'
  }
  if (header.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = header.subarray(8, 12).toString('ascii')
    if (brand === 'qt  ') return 'mov'
    if (MP4_BRANDS.has(brand)) return 'mp4'
  }
  return null
}

async function assertMediaSignature(
  source: FileHandle,
  sourceSize: number,
  kind: MediaKind,
  extension: string
): Promise<void> {
  if (kind === 'file') return
  const header = Buffer.alloc(Math.min(sourceSize, 4096))
  const { bytesRead } = await source.read(header, 0, header.length, 0)
  const detected = detectedMediaFamily(header.subarray(0, bytesRead))
  const expected = extension === 'jpg' ? 'jpeg' : extension
  if (detected !== expected) {
    throw new Error(`The selected ${kind} contents do not match its extension.`)
  }
}

export class MediaService {
  constructor(private readonly workspaceRoot: () => string | null) {}

  async importFile(window: BrowserWindow, kind: MediaKind): Promise<ImportedMedia | null> {
    const safeKind = mediaKindSchema.parse(kind)
    const { dialog } = await import('electron')
    const selection = await dialog.showOpenDialog(window, {
      title: `Import ${safeKind}`,
      buttonLabel: 'Copy into workspace',
      properties: ['openFile'],
      filters: pickerFilter(safeKind)
    })
    if (selection.canceled || !selection.filePaths[0]) return null
    return this.importFromPath(selection.filePaths[0], safeKind)
  }

  async importFromPath(sourcePath: string, kind: MediaKind): Promise<ImportedMedia> {
    const safeKind = mediaKindSchema.parse(kind)
    if (!path.isAbsolute(sourcePath)) throw new Error('The selected file path is invalid.')

    const extension = extensionOf(sourcePath)
    if (KIND_EXTENSIONS[safeKind] && !KIND_EXTENSIONS[safeKind]?.has(extension)) {
      throw new Error(`CanvasNote does not support this ${safeKind} format.`)
    }
    if (safeKind === 'file' && isExecutableExtension(extension)) {
      throw new Error('CanvasNote will not attach executable files or scripts.')
    }

    const root = this.#requireWorkspaceRoot()
    const directory = resolveWorkspacePath(root, `media/${FOLDERS[safeKind]}`)
    await assertNoSymlinkEscape(root, directory)
    await mkdir(directory, { recursive: true })
    await assertNoSymlinkEscape(root, directory)

    const source = await open(sourcePath, 'r')
    try {
      const sourceDetails = await source.stat()
      if (!sourceDetails.isFile()) throw new Error('The selected path is not a regular file.')
      if (sourceDetails.size > MAX_BYTES[safeKind]) {
        throw new Error(`The selected ${safeKind} is too large.`)
      }
      if (safeKind !== 'file' && sourceDetails.size === 0) {
        throw new Error(`The selected ${safeKind} is empty.`)
      }
      if (safeKind === 'file' && process.platform !== 'win32' && sourceDetails.mode & 0o111) {
        throw new Error('CanvasNote will not attach executable files or scripts.')
      }
      await assertMediaSignature(source, sourceDetails.size, safeKind, extension)

      for (let attempt = 0; attempt < 8; attempt += 1) {
        const id = `media-${randomUUID()}`
        const relativePath = mediaRelativePathSchema.parse(
          `media/${FOLDERS[safeKind]}/${id}.${extension}`
        )
        const destinationPath = resolveWorkspacePath(root, relativePath)
        await assertNoSymlinkEscape(root, destinationPath)

        let destination
        try {
          destination = await open(destinationPath, 'wx', 0o600)
        } catch (error) {
          if (hasCode(error, 'EEXIST')) continue
          throw error
        }

        try {
          if (sourceDetails.size > 0) {
            await pipeline(
              source.createReadStream({ autoClose: true, start: 0, end: sourceDetails.size - 1 }),
              destination.createWriteStream({ autoClose: true })
            )
          } else {
            await Promise.all([source.close(), destination.close()])
          }
          const destinationDetails = await stat(destinationPath)
          if (destinationDetails.size !== sourceDetails.size) {
            throw new Error('The selected file changed while it was being copied.')
          }
          const copiedFile = await open(destinationPath, 'r+')
          try {
            await copiedFile.sync()
          } finally {
            await copiedFile.close()
          }
        } catch (error) {
          await destination.close().catch(() => undefined)
          await rm(destinationPath, { force: true }).catch(() => undefined)
          throw error
        }
        await destination.close().catch(() => undefined)

        const filename = path
          .basename(sourcePath)
          .replace(/[\u0000-\u001f\u007f]/g, '')
          .slice(0, 255)
        return importedMediaSchema.parse({
          id,
          kind: safeKind,
          relativePath,
          filename: filename || `attachment.${extension}`,
          extension,
          sizeBytes: sourceDetails.size,
          mimeType: mediaMimeType(relativePath),
          url: mediaUrlForPath(relativePath)
        })
      }
      throw new Error('CanvasNote could not generate a unique media filename.')
    } finally {
      await source.close().catch(() => undefined)
    }
  }

  async resolve(relativePath: string): Promise<string> {
    const safePath = mediaRelativePathSchema.parse(relativePath)
    const root = this.#requireWorkspaceRoot()
    const filePath = resolveWorkspacePath(root, safePath)
    await assertNoSymlinkEscape(root, filePath)
    const details = await open(filePath, 'r')
    try {
      if (!(await details.stat()).isFile()) throw new Error('Media path is not a regular file.')
    } finally {
      await details.close()
    }
    return filePath
  }

  async exists(relativePath: string): Promise<boolean> {
    const safePath = mediaRelativePathSchema.parse(relativePath)
    const root = this.#requireWorkspaceRoot()
    const filePath = resolveWorkspacePath(root, safePath)
    await assertNoSymlinkEscape(root, filePath)

    let pathDetails
    try {
      pathDetails = await lstat(filePath)
    } catch (error) {
      if (hasCode(error, 'ENOENT', 'ENOTDIR')) return false
      throw error
    }
    if (pathDetails.isSymbolicLink()) throw new Error('Media paths cannot be symbolic links.')
    if (!pathDetails.isFile()) throw new Error('Media path is not a regular file.')

    let file
    try {
      file = await open(filePath, 'r')
    } catch (error) {
      if (hasCode(error, 'ENOENT', 'ENOTDIR')) return false
      throw error
    }
    try {
      const openedDetails = await file.stat()
      if (
        !openedDetails.isFile() ||
        openedDetails.dev !== pathDetails.dev ||
        openedDetails.ino !== pathDetails.ino
      ) {
        throw new Error('Media file changed while its availability was checked.')
      }
      return true
    } finally {
      await file.close()
    }
  }

  async open(relativePath: string): Promise<void> {
    const filePath = await this.resolve(relativePath)
    const extension = extensionOf(filePath)
    if (!OPENABLE_EXTENSIONS.has(extension) || isExecutableExtension(extension)) {
      throw new Error('CanvasNote can only open supported document or media attachments.')
    }

    const file = await open(filePath, 'r')
    try {
      const details = await file.stat()
      if (process.platform !== 'win32' && details.mode & 0o111) {
        throw new Error('CanvasNote will not execute attached files or scripts.')
      }
    } finally {
      await file.close()
    }

    const { shell } = await import('electron')
    const error = await shell.openPath(filePath)
    if (error) throw new Error(`CanvasNote could not open this attachment: ${error}`)
  }

  async reveal(relativePath: string): Promise<void> {
    const filePath = await this.resolve(relativePath)
    const { shell } = await import('electron')
    shell.showItemInFolder(filePath)
  }

  #requireWorkspaceRoot(): string {
    const root = this.workspaceRoot()
    if (!root) throw new Error('Open a workspace first.')
    return path.resolve(root)
  }
}
