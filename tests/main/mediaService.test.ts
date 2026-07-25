import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MediaService, mediaMimeType } from '../../src/main/services/mediaService'

const MEDIA_HEADERS = [
  ['png', 'image', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
  ['jpg', 'image', Buffer.from([0xff, 0xd8, 0xff, 0xe0])],
  ['jpeg', 'image', Buffer.from([0xff, 0xd8, 0xff, 0xe1])],
  ['gif', 'image', Buffer.from('GIF89a', 'ascii')],
  [
    'webp',
    'image',
    Buffer.concat([Buffer.from('RIFF', 'ascii'), Buffer.alloc(4), Buffer.from('WEBP', 'ascii')])
  ],
  ['mp4', 'video', Buffer.concat([Buffer.from([0, 0, 0, 12]), Buffer.from('ftypisom', 'ascii')])],
  ['mov', 'video', Buffer.concat([Buffer.from([0, 0, 0, 12]), Buffer.from('ftypqt  ', 'ascii')])],
  [
    'webm',
    'video',
    Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x87, 0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d])
  ]
] as const

const electron = vi.hoisted(() => ({
  openPath: vi.fn(async () => ''),
  showItemInFolder: vi.fn()
}))

vi.mock('electron', () => ({ shell: electron }))

describe('MediaService', () => {
  let workspaceRoot: string
  let sourceRoot: string
  let service: MediaService

  beforeEach(async () => {
    vi.clearAllMocks()
    workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'canvasnote-media-workspace-'))
    sourceRoot = await mkdtemp(path.join(os.tmpdir(), 'canvasnote-media-source-'))
    service = new MediaService(() => workspaceRoot)
  })

  afterEach(async () => {
    await Promise.all([
      rm(workspaceRoot, { recursive: true, force: true }),
      rm(sourceRoot, { recursive: true, force: true })
    ])
  })

  it('streams a supported file into the matching workspace media folder', async () => {
    const sourcePath = path.join(sourceRoot, 'reference image.PNG')
    const pngHeader = MEDIA_HEADERS[0][2]
    await writeFile(sourcePath, pngHeader)

    const imported = await service.importFromPath(sourcePath, 'image')
    const resolved = await service.resolve(imported.relativePath)

    expect(imported).toMatchObject({
      kind: 'image',
      filename: 'reference image.PNG',
      extension: 'png',
      sizeBytes: pngHeader.length,
      mimeType: 'image/png'
    })
    expect(imported.relativePath).toMatch(/^media\/images\/media-[\w-]+\.png$/)
    expect(imported.url).toBe(`canvasnote-media://workspace/${imported.relativePath}`)
    expect(await readFile(resolved)).toEqual(pngHeader)
  })

  it.each(MEDIA_HEADERS)(
    'accepts a valid minimal .%s %s header',
    async (extension, kind, header) => {
      const sourcePath = path.join(sourceRoot, `valid.${extension}`)
      await writeFile(sourcePath, header)

      await expect(service.importFromPath(sourcePath, kind)).resolves.toMatchObject({
        extension,
        kind
      })
    }
  )

  it('rejects renamed and unrecognized image or video payloads before copy', async () => {
    const renamedImage = path.join(sourceRoot, 'renamed.png')
    const renamedVideo = path.join(sourceRoot, 'renamed.mp4')
    const unknownVideo = path.join(sourceRoot, 'unknown.webm')
    await Promise.all([
      writeFile(renamedImage, Buffer.from([0xff, 0xd8, 0xff, 0xe0])),
      writeFile(
        renamedVideo,
        Buffer.concat([Buffer.from([0, 0, 0, 12]), Buffer.from('ftypqt  ', 'ascii')])
      ),
      writeFile(unknownVideo, Buffer.from('not a video', 'ascii'))
    ])

    await expect(service.importFromPath(renamedImage, 'image')).rejects.toThrow(/do not match/)
    await expect(service.importFromPath(renamedVideo, 'video')).rejects.toThrow(/do not match/)
    await expect(service.importFromPath(unknownVideo, 'video')).rejects.toThrow(/do not match/)
  })

  it('keeps duplicate source names as separate uniquely named attachments', async () => {
    const sourcePath = path.join(sourceRoot, 'notes.txt')
    await writeFile(sourcePath, 'same source', 'utf8')

    const first = await service.importFromPath(sourcePath, 'file')
    const second = await service.importFromPath(sourcePath, 'file')

    expect(first.filename).toBe('notes.txt')
    expect(second.filename).toBe('notes.txt')
    expect(second.id).not.toBe(first.id)
    expect(second.relativePath).not.toBe(first.relativePath)
    expect((await readdir(path.join(workspaceRoot, 'media', 'files'))).sort()).toHaveLength(2)
  })

  it('rejects unsafe paths, mismatched formats, and executable attachments', async () => {
    const scriptPath = path.join(sourceRoot, 'setup.cmd')
    const fakeImagePath = path.join(sourceRoot, 'photo.txt')
    await Promise.all([
      writeFile(scriptPath, '@echo off', 'utf8'),
      writeFile(fakeImagePath, 'not an image', 'utf8')
    ])

    await expect(service.resolve('../outside.txt')).rejects.toThrow()
    await expect(service.resolve('boards/board.canvasnote')).rejects.toThrow()
    await expect(service.importFromPath(fakeImagePath, 'image')).rejects.toThrow(/does not support/)
    await expect(service.importFromPath(scriptPath, 'file')).rejects.toThrow(/executable/)
  })

  it('requires an active workspace', async () => {
    const sourcePath = path.join(sourceRoot, 'notes.txt')
    await writeFile(sourcePath, 'notes', 'utf8')
    service = new MediaService(() => null)

    await expect(service.importFromPath(sourcePath, 'file')).rejects.toThrow(
      'Open a workspace first.'
    )
  })

  it('maps validated media extensions to protocol-safe content types', () => {
    expect(mediaMimeType('media/images/photo.JPEG')).toBe('image/jpeg')
    expect(mediaMimeType('media/videos/clip.webm')).toBe('video/webm')
    expect(mediaMimeType('media/files/data.unknown')).toBe('application/octet-stream')
  })

  it('opens only allowlisted documents and leaves unsupported attachments revealable', async () => {
    const notePath = path.join(sourceRoot, 'note.txt')
    const unsupportedPath = path.join(sourceRoot, 'diagram.drawio')
    await Promise.all([
      writeFile(notePath, 'safe note', 'utf8'),
      writeFile(unsupportedPath, 'diagram', 'utf8')
    ])
    const note = await service.importFromPath(notePath, 'file')
    const unsupported = await service.importFromPath(unsupportedPath, 'file')

    await service.open(note.relativePath)
    await expect(service.open(unsupported.relativePath)).rejects.toThrow(
      /supported document or media/
    )
    await service.reveal(unsupported.relativePath)

    expect(electron.openPath).toHaveBeenCalledOnce()
    expect(electron.showItemInFolder).toHaveBeenCalledWith(
      await service.resolve(unsupported.relativePath)
    )
  })

  it('reports only regular readable media files as existing', async () => {
    const notePath = path.join(sourceRoot, 'note.txt')
    await writeFile(notePath, 'note', 'utf8')
    const note = await service.importFromPath(notePath, 'file')
    await mkdir(path.join(workspaceRoot, 'media', 'files', 'folder'))

    await expect(service.exists(note.relativePath)).resolves.toBe(true)
    await expect(service.exists('media/files/missing.txt')).resolves.toBe(false)
    await expect(service.exists('../outside.txt')).rejects.toThrow()
    await expect(service.exists('media/files/folder')).rejects.toThrow(/regular file/)
  })

  it('reports an ENOTDIR media path as missing', async () => {
    await mkdir(path.join(workspaceRoot, 'media'))
    await writeFile(path.join(workspaceRoot, 'media', 'files'), 'not a directory', 'utf8')

    await expect(service.exists('media/files/missing.txt')).resolves.toBe(false)
  })

  it('rejects a workspace media symlink that escapes the workspace', async () => {
    const mediaDirectory = path.join(workspaceRoot, 'media', 'files')
    const linkPath = path.join(mediaDirectory, 'escape.txt')
    await mkdir(mediaDirectory, { recursive: true })
    try {
      await symlink(sourceRoot, linkPath, process.platform === 'win32' ? 'junction' : 'dir')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EPERM') return
      throw error
    }

    await expect(service.exists('media/files/escape.txt')).rejects.toThrow(/Symbolic links/)
  })
})
