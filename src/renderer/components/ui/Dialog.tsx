import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react'
import { X } from 'lucide-react'

import { IconButton } from './Button'

interface DialogProps {
  open: boolean
  title: string
  eyebrow?: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
  dismissOnBackdrop?: boolean
  closeLabel?: string
  initialFocusRef?: RefObject<HTMLElement | null>
  onClose: () => void
}

const focusableSelector = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',')
const bodyFocusableSelector = focusableSelector
  .split(',')
  .map((selector) => `.cn-dialog-body ${selector}`)
  .join(',')

export function Dialog({
  open,
  title,
  eyebrow,
  description,
  children,
  footer,
  wide = false,
  dismissOnBackdrop = true,
  closeLabel,
  initialFocusRef,
  onClose
}: DialogProps): React.JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open) {
      returnFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null
      if (!dialog.open) {
        if (typeof dialog.showModal === 'function') dialog.showModal()
        else dialog.setAttribute('open', '')
      }
      requestAnimationFrame(() => {
        const initial =
          initialFocusRef?.current ??
          dialog.querySelector<HTMLElement>(bodyFocusableSelector) ??
          dialog.querySelector<HTMLElement>(focusableSelector)
        initial?.focus()
      })
    } else if (dialog.open) {
      if (typeof dialog.close === 'function') dialog.close()
      else dialog.removeAttribute('open')
    }

    return () => {
      if (dialog.open) {
        if (typeof dialog.close === 'function') dialog.close()
        else dialog.removeAttribute('open')
      }
      returnFocusRef.current?.focus()
    }
  }, [initialFocusRef, open])

  return (
    <dialog
      ref={dialogRef}
      className="cn-dialog-backdrop"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      aria-modal="true"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onMouseDown={(event) => {
        if (dismissOnBackdrop && event.target === event.currentTarget) onClose()
      }}
    >
      <div className="cn-dialog-positioner">
        <section className={`cn-dialog-panel ${wide ? 'is-wide' : ''}`}>
          <header className="cn-dialog-header">
            <div>
              {eyebrow && <p className="cn-dialog-eyebrow">{eyebrow}</p>}
              <h2 id={titleId} className="cn-section-title">
                {title}
              </h2>
              {description && (
                <p id={descriptionId} className="cn-dialog-description">
                  {description}
                </p>
              )}
            </div>
            <IconButton
              aria-label={closeLabel ?? `Close ${title}`}
              icon={<X size={17} />}
              onClick={onClose}
            />
          </header>
          <div className="cn-dialog-body">{children}</div>
          {footer && <footer className="cn-dialog-footer">{footer}</footer>}
        </section>
      </div>
    </dialog>
  )
}
