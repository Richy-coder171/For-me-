import { existsSync } from 'node:fs'
import { mkdtemp, mkdir, rm, symlink, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { DatabaseService } from '../../src/main/services/databaseService'
import { boardFileSchema } from '../../src/shared/schemas/board'
import { createBoardFromTemplate } from '../../src/shared/templates'

describe('DatabaseService', () => {
  let root: string
  let service: DatabaseService

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'canvasnote-database-'))
    service = new DatabaseService()
  })

  afterEach(async () => {
    service.close()
    await rm(root, { recursive: true, force: true })
  })

  it('creates and migrates the workspace index with FTS5 search', () => {
    service.initialize(root)
    const databasePath = path.join(root, '.canvasnote', 'index.sqlite3')
    expect(existsSync(databasePath)).toBe(true)

    service.upsertBoard({
      id: 'board-one',
      path: 'boards/board-one.canvasnote',
      title: 'Video Research',
      createdAt: '2026-07-25T08:00:00.000Z',
      updatedAt: '2026-07-25T09:00:00.000Z',
      openedAt: '2026-07-25T10:00:00.000Z',
      itemCount: 3
    })
    const indexedBoard = createBoardFromTemplate(
      'board-one',
      'video-research',
      new Date('2026-07-25T08:00:00.000Z')
    )
    service.indexBoardContent(indexedBoard)

    const image = {
      id: 'image-one',
      type: 'image' as const,
      x: 0,
      y: 0,
      width: 320,
      height: 200,
      rotation: 0,
      locked: false,
      tags: ['reference'],
      mediaId: 'media-one',
      mediaPath: 'media/images/reference.png',
      caption: 'Reference',
      altText: '',
      fit: 'contain' as const,
      createdAt: '2026-07-25T08:00:00.000Z',
      updatedAt: '2026-07-25T08:00:00.000Z'
    }
    const duplicatedMediaBoard = boardFileSchema.parse({
      ...indexedBoard,
      nodes: [...indexedBoard.nodes, image, { ...image, id: 'image-copy' }]
    })
    expect(() => service.indexBoardContent(duplicatedMediaBoard)).not.toThrow()

    const database = new Database(databasePath, { readonly: true })
    expect(database.pragma('user_version', { simple: true })).toBe(1)
    expect(database.pragma('journal_mode', { simple: true })).toBe('wal')
    expect(
      database.prepare("SELECT title FROM search_index WHERE search_index MATCH 'research'").get()
    ).toEqual({ title: 'Video Research' })
    expect(service.searchBoardIds('strongest evidence')).toEqual(['board-one'])
    expect(service.searchTextByBoard().get('board-one')).toContain('What do I want to learn')
    expect(
      database.prepare('SELECT count(*) AS count FROM media WHERE board_id = ?').get('board-one')
    ).toEqual({ count: 1 })
    database.close()
  })

  it('lists, favorites, trashes, restores, and deletes board metadata', () => {
    service.initialize(root)
    const board = service.upsertBoard({
      id: 'board-one',
      path: 'boards/board-one.canvasnote',
      title: 'First board',
      createdAt: '2026-07-25T08:00:00.000Z',
      updatedAt: '2026-07-25T09:00:00.000Z',
      itemCount: 4
    })

    expect(board).toMatchObject({ favorite: false, deletedAt: null, itemCount: 4 })
    expect(service.setFavorite(board.id, true)).toBe(true)
    expect(service.listBoards({ favorite: true })).toHaveLength(1)

    expect(service.trashBoard(board.id, '2026-07-25T11:00:00.000Z')).toBe(true)
    expect(service.listBoards()).toEqual([])
    expect(service.listBoards({ trashed: true })[0]?.deletedAt).toBe('2026-07-25T11:00:00.000Z')

    expect(service.restoreBoard(board.id)).toBe(true)
    expect(service.getBoard(board.id)?.favorite).toBe(true)
    expect(service.deleteBoard(board.id)).toBe(true)
    expect(service.getBoard(board.id)).toBeNull()
  })

  it('rejects indexes created by a newer application version', async () => {
    const dataDirectory = path.join(root, '.canvasnote')
    await mkdir(dataDirectory)
    const database = new Database(path.join(dataDirectory, 'index.sqlite3'))
    database.pragma('user_version = 99')
    database.close()

    expect(() => service.initialize(root)).toThrow('newer than supported')
  })

  it('rejects a database directory symlink that escapes the workspace', async () => {
    const outside = await mkdtemp(path.join(tmpdir(), 'canvasnote-database-outside-'))
    const link = path.join(root, '.canvasnote')
    try {
      try {
        await symlink(outside, link, process.platform === 'win32' ? 'junction' : 'dir')
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EPERM') return
        throw error
      }

      expect(() => service.initialize(root)).toThrow(/Symbolic links/)
    } finally {
      await unlink(link).catch(() => undefined)
      await rm(outside, { recursive: true, force: true })
    }
  })

  it('rejects a dangling database-file symlink', async () => {
    const dataDirectory = path.join(root, '.canvasnote')
    const outside = await mkdtemp(path.join(tmpdir(), 'canvasnote-database-target-'))
    const missingTarget = path.join(outside, 'future.sqlite3')
    const link = path.join(dataDirectory, 'index.sqlite3')
    await mkdir(dataDirectory)
    try {
      try {
        await symlink(missingTarget, link, 'file')
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EPERM') return
        throw error
      }

      expect(() => service.initialize(root)).toThrow(/validate the workspace path/)
    } finally {
      await unlink(link).catch(() => undefined)
      await rm(outside, { recursive: true, force: true })
    }
  })
})
