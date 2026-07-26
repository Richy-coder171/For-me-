import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Button, Dialog, EmptyState, Feedback, IconButton } from '../../src/renderer/components/ui'

beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.setAttribute('open', '')
    }
  })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.removeAttribute('open')
    }
  })
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0)
    return 0
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('CanvasNote UI primitives', () => {
  it('exposes accessible button, feedback, and empty states', () => {
    render(
      <>
        <Button loading>Save</Button>
        <IconButton aria-label="Open options" icon={<span aria-hidden="true">+</span>} />
        <Feedback tone="danger" title="Save failed" message="Try again." />
        <EmptyState
          title="No boards"
          description="Create a board to begin."
          primaryAction={<Button variant="primary">Create board</Button>}
        />
      </>
    )

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: 'Open options' })).toHaveAttribute(
      'title',
      'Open options'
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Save failedTry again.')
    expect(screen.getByRole('heading', { name: 'No boards' })).toBeVisible()
  })

  it('opens modally, focuses content, closes with Escape, and restores focus', () => {
    function Harness(): React.JSX.Element {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open dialog
          </button>
          <Dialog open={open} title="Rename board" onClose={() => setOpen(false)}>
            <label>
              Board name
              <input />
            </label>
          </Dialog>
        </>
      )
    }

    render(<Harness />)
    const opener = screen.getByRole('button', { name: 'Open dialog' })
    opener.focus()
    fireEvent.click(opener)

    const dialog = screen.getByRole('dialog', { name: 'Rename board' })
    expect(dialog).toHaveAttribute('open')
    expect(screen.getByRole('textbox', { name: 'Board name' })).toHaveFocus()

    fireEvent(dialog, new Event('cancel', { bubbles: false, cancelable: true }))
    expect(dialog).not.toHaveAttribute('open')
    expect(opener).toHaveFocus()
  })
})
