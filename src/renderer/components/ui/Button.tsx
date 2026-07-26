import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { LoaderCircle } from 'lucide-react'

type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger'
type ButtonSize = 'small' | 'medium' | 'large'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  leadingIcon?: ReactNode
}

function classes(...values: Array<string | false | undefined>): string {
  return values.filter(Boolean).join(' ')
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'medium',
    loading = false,
    leadingIcon,
    className,
    children,
    disabled,
    type = 'button',
    ...props
  },
  ref
) {
  return (
    <button
      {...props}
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={classes(
        'cn-button',
        `is-${variant}`,
        size !== 'medium' && `is-${size}`,
        className
      )}
    >
      {loading ? (
        <LoaderCircle className="cn-button-spinner" size={15} aria-hidden="true" />
      ) : (
        leadingIcon
      )}
      {children}
    </button>
  )
})

interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'aria-label' | 'children'
> {
  'aria-label': string
  icon: ReactNode
  tooltip?: string
  bordered?: boolean
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, tooltip, bordered = false, className, type = 'button', 'aria-label': label, ...props },
  ref
) {
  return (
    <button
      {...props}
      ref={ref}
      type={type}
      aria-label={label}
      title={tooltip ?? label}
      className={classes('cn-icon-button', bordered && 'is-bordered', className)}
    >
      {icon}
    </button>
  )
})
