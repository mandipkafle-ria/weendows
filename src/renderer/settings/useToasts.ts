import { useCallback, useRef, useState } from 'react'

export type ToastLevel = 'info' | 'success' | 'error'

export interface ToastItem {
  id: number
  level: ToastLevel
  message: string
}

export function useToasts(): {
  toasts: ToastItem[]
  pushToast: (message: string, level?: ToastLevel) => void
  dismissToast: (id: number) => void
} {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const dismissToast = useCallback((id: number): void => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const pushToast = useCallback((message: string, level: ToastLevel = 'info'): void => {
    const id = ++nextId.current
    setToasts((current) => [...current.slice(-3), { id, level, message }])
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id))
    }, 5000)
  }, [])

  return { toasts, pushToast, dismissToast }
}
