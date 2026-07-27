import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  Object.defineProperty(globalThis.CSS, 'supports', {
    configurable: true,
    value: () => false
  })
})

import { BoardAddMenu, boardPaletteCommands } from '../../src/renderer/canvas/BoardEditor'

afterEach(cleanup)

describe('Board editor add menu', () => {
  it('supports menu keyboard navigation and restores focus on Escape', () => {
    render(
      <BoardAddMenu
        importing={null}
        onAttachFile={vi.fn()}
        onAddLink={vi.fn()}
        onEmbedVideo={vi.fn()}
      />
    )

    const trigger = screen.getByRole('button', { name: 'Add' })
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    const menu = screen.getByRole('menu', { name: 'Add to board' })
    const attach = within(menu).getByRole('menuitem', { name: 'Attach file' })
    const link = within(menu).getByRole('menuitem', { name: 'Add link card' })
    const video = within(menu).getByRole('menuitem', {
      name: 'Embed YouTube or Vimeo video'
    })
    expect(attach).toHaveFocus()

    fireEvent.keyDown(attach, { key: 'ArrowDown' })
    expect(link).toHaveFocus()
    fireEvent.keyDown(link, { key: 'End' })
    expect(video).toHaveFocus()
    fireEvent.keyDown(video, { key: 'Home' })
    expect(attach).toHaveFocus()

    fireEvent.keyDown(attach, { key: 'Escape' })
    expect(screen.queryByRole('menu', { name: 'Add to board' })).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()

    fireEvent.keyDown(trigger, { key: 'ArrowUp' })
    expect(screen.getByRole('menuitem', { name: 'Embed YouTube or Vimeo video' })).toHaveFocus()
  })

  it('runs labelled actions, skips disabled imports, and closes on outside pointer input', () => {
    const onAttachFile = vi.fn()
    const onAddLink = vi.fn()
    const onEmbedVideo = vi.fn()
    const { rerender } = render(
      <BoardAddMenu
        importing={null}
        onAttachFile={onAttachFile}
        onAddLink={onAddLink}
        onEmbedVideo={onEmbedVideo}
      />
    )

    const trigger = screen.getByRole('button', { name: 'Add' })
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Add link card' }))
    expect(onAddLink).toHaveBeenCalledOnce()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    fireEvent.click(trigger)
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    rerender(
      <BoardAddMenu
        importing="image"
        onAttachFile={onAttachFile}
        onAddLink={onAddLink}
        onEmbedVideo={onEmbedVideo}
      />
    )
    fireEvent.click(trigger)
    expect(screen.getByRole('menuitem', { name: 'Attach file' })).toBeDisabled()
    expect(screen.getByRole('menuitem', { name: 'Add link card' })).toHaveFocus()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Embed YouTube or Vimeo video' }))
    expect(onEmbedVideo).toHaveBeenCalledOnce()
    expect(onAttachFile).not.toHaveBeenCalled()
  })
})

describe('Board editor command palette', () => {
  it('finds the board and commands, then promotes recent commands without duplicates', () => {
    expect(boardPaletteCommands('Research board', 'research')).toMatchObject([
      { id: 'board-title', category: 'Current board' }
    ])
    expect(boardPaletteCommands('Research board', 'import').map(({ id }) => id)).toEqual([
      'import-image',
      'import-video'
    ])

    const commands = boardPaletteCommands('Research board', '', ['toggle-theme', 'create-note'])
    expect(commands.slice(0, 2)).toMatchObject([
      { id: 'toggle-theme', category: 'Recent' },
      { id: 'create-note', category: 'Recent' }
    ])
    expect(commands.filter(({ id }) => id === 'toggle-theme')).toHaveLength(1)
  })
})
