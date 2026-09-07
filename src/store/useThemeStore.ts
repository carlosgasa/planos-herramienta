import { create } from 'zustand'

export type Theme = 'dark' | 'intermedio' | 'light'

const ORDER: Theme[] = ['dark', 'intermedio', 'light']
const KEY = 'planos:theme'

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
}

function initialTheme(): Theme {
  const saved = localStorage.getItem(KEY)
  if (saved === 'dark' || saved === 'intermedio' || saved === 'light') return saved
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

interface ThemeStoreState {
  theme: Theme
  cycleTheme: () => void
  setTheme: (t: Theme) => void
}

const startTheme = initialTheme()
applyTheme(startTheme)

export const useThemeStore = create<ThemeStoreState>((set) => ({
  theme: startTheme,
  setTheme: (theme) => { applyTheme(theme); localStorage.setItem(KEY, theme); set({ theme }) },
  cycleTheme: () => set((s) => {
    const next = ORDER[(ORDER.indexOf(s.theme) + 1) % ORDER.length]
    applyTheme(next)
    localStorage.setItem(KEY, next)
    return { theme: next }
  })
}))
