export type ThemeEnvId = 'sky' | 'forest' | 'glass' | 'midnight' | 'sakura' | 'mono' | 'ember'

export interface ThemeOption {
  id: ThemeEnvId
  label: string
  color: string
}

export const THEME_OPTIONS: ThemeOption[] = [
  { id: 'sky', label: 'Sky', color: '#aec8ef' },
  { id: 'forest', label: 'Forest', color: '#1e3a28' },
  { id: 'glass', label: 'Glass', color: 'rgba(180, 200, 240, 0.65)' },
  { id: 'midnight', label: 'Midnight', color: '#0c1228' },
  { id: 'sakura', label: 'Sakura', color: '#2a1220' },
  { id: 'mono', label: 'Monochrome', color: '#0e0e0e' },
  { id: 'ember', label: 'Ember', color: '#1c0e04' }
]
