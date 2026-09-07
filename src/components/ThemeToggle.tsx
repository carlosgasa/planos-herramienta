import { useThemeStore } from '../store/useThemeStore'

const LABELS = { dark: 'Oscuro', intermedio: 'Intermedio', light: 'Claro' }
const NEXT_LABELS = { dark: 'Intermedio', intermedio: 'Claro', light: 'Oscuro' }

export function ThemeToggle() {
  const { theme, cycleTheme } = useThemeStore()

  return (
    <button
      onClick={cycleTheme}
      title={`Tema: ${LABELS[theme]} — clic para cambiar a ${NEXT_LABELS[theme]}`}
      className="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center text-[var(--text-secondary)] border border-[color:var(--hairline)] bg-[color:var(--glass-weak)]"
    >
      {theme === 'dark' && (
        <svg width={15} height={15} viewBox="0 0 24 24" fill="none"><path d="M21 12.5A9 9 0 1 1 11.5 3a7 7 0 0 0 9.5 9.5Z" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" /></svg>
      )}
      {theme === 'intermedio' && (
        <svg width={15} height={15} viewBox="0 0 24 24" fill="none"><path d="M12 3a9 9 0 0 0 0 18Z" fill="currentColor" /><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth={1.6} /></svg>
      )}
      {theme === 'light' && (
        <svg width={15} height={15} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth={1.6} /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" /></svg>
      )}
    </button>
  )
}
