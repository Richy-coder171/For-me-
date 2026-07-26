import type { ReactNode } from 'react'
import { CircleCheck, CircleX, Info, TriangleAlert, X } from 'lucide-react'

import { IconButton } from './Button'

type FeedbackTone = 'success' | 'warning' | 'danger' | 'info'

interface FeedbackProps {
  tone?: FeedbackTone
  title: string
  message?: string
  actions?: ReactNode
  onDismiss?: () => void
  className?: string
}

const icons: Record<FeedbackTone, ReactNode> = {
  success: <CircleCheck size={17} aria-hidden="true" />,
  warning: <TriangleAlert size={17} aria-hidden="true" />,
  danger: <CircleX size={17} aria-hidden="true" />,
  info: <Info size={17} aria-hidden="true" />
}

export function Feedback({
  tone = 'info',
  title,
  message,
  actions,
  onDismiss,
  className
}: FeedbackProps): React.JSX.Element {
  const urgent = tone === 'danger' || tone === 'warning'
  return (
    <div
      className={`cn-feedback is-${tone}${className ? ` ${className}` : ''}`}
      role={urgent ? 'alert' : 'status'}
      aria-live={urgent ? 'assertive' : 'polite'}
    >
      <span className="cn-feedback-icon">{icons[tone]}</span>
      <div className="cn-feedback-content">
        <strong>{title}</strong>
        {message && <p>{message}</p>}
        {actions && <div className="cn-feedback-actions">{actions}</div>}
      </div>
      {onDismiss && (
        <IconButton aria-label="Dismiss message" icon={<X size={15} />} onClick={onDismiss} />
      )}
    </div>
  )
}
