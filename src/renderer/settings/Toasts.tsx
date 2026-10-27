import type { JSX } from 'react'
import { t } from '../i18n'
import type { ToastItem } from './useToasts'

export function ToastStack({
  toasts,
  onDismiss
}: {
  toasts: ToastItem[]
  onDismiss: (id: number) => void
}): JSX.Element | null {
  if (toasts.length === 0) {
    return null
  }

  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <div className={`toast toast-${toast.level}`} key={toast.id} role="status">
          <span>{toast.message}</span>
          <button
            type="button"
            className="toast-dismiss"
            aria-label={t('toast.dismiss')}
            onClick={() => onDismiss(toast.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
