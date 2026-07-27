import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description: string
  primaryAction?: ReactNode
  secondaryAction?: ReactNode
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  className
}: EmptyStateProps): React.JSX.Element {
  return (
    <div className={`cn-empty-state${className ? ` ${className}` : ''}`}>
      <div>
        {icon && <span className="cn-empty-state-icon">{icon}</span>}
        <h2 className="cn-section-title">{title}</h2>
        <p>{description}</p>
        {(primaryAction || secondaryAction) && (
          <div className="cn-empty-state-actions">
            {primaryAction}
            {secondaryAction}
          </div>
        )}
      </div>
    </div>
  )
}
