type EditModeListener = (enabled: boolean) => void

let enabled = false
const listeners = new Set<EditModeListener>()

export function getEditMode(): boolean {
  return enabled
}

export function setEditMode(next: boolean): boolean {
  if (enabled === next) {
    return enabled
  }
  enabled = next
  for (const listener of listeners) {
    listener(enabled)
  }
  return enabled
}

export function toggleEditMode(): boolean {
  return setEditMode(!enabled)
}

export function onEditModeChanged(listener: EditModeListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
