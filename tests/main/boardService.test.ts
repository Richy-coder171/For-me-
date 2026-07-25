import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  BoardConflictError,
  BoardService,
  type StoredBoard
} from '../../src/main/services/boardService'

describe('BoardService', () => {
  let workspaceRoot: string
  let service: BoardService

  beforeEach(async () => {
    workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'canvasnote-board-service-'))
    service = new BoardService(workspaceRoot)
  })

  afterEach(async () => {
    await rm(workspaceRoot, { recursive: true, force: true })
  })

  it('creates, lists, reads, and saves validated board files', async () => {
    const created = await service.create('Video research')

    expect(created.board.id).toMatch(/^board-/)
    expect(created.revision).toMatch(/^[a-f0-9]{64}$/)
    expect(await service.read(created.board.id)).toEqual(created)
    expect(await service.list()).toEqual([created])

    const saved = await service.save(
      {
        ...created.board,
        title: 'Edited research',
        updatedAt: '2026-07-25T12:00:00.000Z'
      },
      created.revision
    )

    expect(saved.board.title).toBe('Edited research')
    expect(saved.revision).not.toBe(created.revision)
    expect(JSON.parse(await readFile(boardPath(saved), 'utf8'))).toEqual(saved.board)
  })

  it.each(['../outside', 'nested/board', 'board\\name', 'C:', 'CON'])(
    'rejects unsafe board ID %s',
    async (id) => {
      await expect(service.read(id)).rejects.toThrow()
    }
  )

  it('detects an externally modified board before overwriting it', async () => {
    const created = await service.create('Original')
    const filePath = boardPath(created)
    const externalBoard = { ...created.board, title: 'External edit' }
    await writeFile(filePath, `${JSON.stringify(externalBoard, null, 2)}\n`, 'utf8')

    await expect(
      service.save({ ...created.board, title: 'Session edit' }, created.revision)
    ).rejects.toBeInstanceOf(BoardConflictError)
    expect(JSON.parse(await readFile(filePath, 'utf8')).title).toBe('External edit')
  })

  it('requires a revision before replacing an existing board', async () => {
    const created = await service.create('Original')

    await expect(
      service.save({ ...created.board, title: 'Unversioned edit' })
    ).rejects.toBeInstanceOf(BoardConflictError)
    expect((await service.read(created.board.id)).board.title).toBe('Original')
  })

  it('lists healthy boards when another board file is corrupt', async () => {
    const created = await service.create('Healthy')
    await writeFile(path.join(workspaceRoot, 'boards', 'corrupt.canvasnote'), '{broken', 'utf8')

    expect(await service.list()).toEqual([created])
  })

  it('imports a validated board with a collision-safe fresh ID', async () => {
    const original = await service.create('Portable board')
    const sourcePath = path.join(workspaceRoot, 'portable.canvasnote')
    await writeFile(sourcePath, `${JSON.stringify(original.board, null, 2)}\n`, 'utf8')

    const imported = await service.importFile(sourcePath)

    expect(imported.board.id).not.toBe(original.board.id)
    expect(imported.board.title).toBe('Portable board')
    expect(await service.list()).toHaveLength(2)
    expect(JSON.parse(await readFile(boardPath(imported), 'utf8')).id).toBe(imported.board.id)
  })

  it('rejects invalid and future board imports without writing a board', async () => {
    const sourcePath = path.join(workspaceRoot, 'unsupported.canvasnote')
    await writeFile(sourcePath, JSON.stringify({ format: 'canvasnote-board', version: 2 }), 'utf8')

    await expect(service.importFile(sourcePath)).rejects.toThrow('not a supported CanvasNote board')
    expect(await service.list()).toEqual([])
  })

  it('keeps only the five most recent pre-save backups', async () => {
    let stored = await service.create('Initial')
    for (let version = 1; version <= 6; version += 1) {
      stored = await service.save(
        {
          ...stored.board,
          title: `Version ${version}`,
          updatedAt: new Date(Date.UTC(2026, 6, 25, 0, version)).toISOString()
        },
        stored.revision
      )
    }

    const backupDirectory = path.join(workspaceRoot, 'backups', stored.board.id)
    expect((await readdir(backupDirectory)).sort()).toEqual([
      '1.canvasnote',
      '2.canvasnote',
      '3.canvasnote',
      '4.canvasnote',
      '5.canvasnote'
    ])
    expect(
      JSON.parse(await readFile(path.join(backupDirectory, '1.canvasnote'), 'utf8')).title
    ).toBe('Version 5')
  })

  it('moves boards to trash, restores them, and deletes them permanently', async () => {
    let stored = await service.create('Disposable')
    stored = await service.save({ ...stored.board, title: 'Disposable edit' }, stored.revision)
    const activePath = boardPath(stored)
    const trashPath = path.join(workspaceRoot, 'trash', 'boards', path.basename(activePath))

    await service.moveToTrash(stored.board.id)
    await expect(readFile(activePath)).rejects.toMatchObject({ code: 'ENOENT' })
    expect(JSON.parse(await readFile(trashPath, 'utf8')).id).toBe(stored.board.id)

    expect(await service.restore(stored.board.id)).toEqual(stored)
    expect(JSON.parse(await readFile(activePath, 'utf8')).id).toBe(stored.board.id)

    await service.moveToTrash(stored.board.id)
    await service.deletePermanently(stored.board.id)
    await expect(readFile(trashPath)).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(
      readdir(path.join(workspaceRoot, 'backups', stored.board.id))
    ).rejects.toMatchObject({ code: 'ENOENT' })
  })

  function boardPath(stored: StoredBoard): string {
    return path.join(workspaceRoot, 'boards', `${stored.board.id}.canvasnote`)
  }
})
