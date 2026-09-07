import { useState } from 'react'
import { useProjectStore } from '../store/useProjectStore'
import { ThemeToggle } from './ThemeToggle'

const SYNC_LABEL: Record<string, string> = {
  local: 'Local (sin Firebase)',
  loading: 'Cargando…',
  saving: 'Guardando…',
  synced: 'Guardado en la nube',
  error: 'Error al guardar (ver consola)'
}

export function TopBar() {
  const { project, level, setLevel, addLevel, renameLevel, removeLevel, showGhost, toggleGhost, showRoomAreas, toggleRoomAreas, gridSnap, toggleGridSnap, openExport, syncState, closeProject, undo, redo, past, future } = useProjectStore()
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null)
  if (!project) return null

  const levelIndex = project.levels.findIndex((l) => l.key === level)
  const hasPreviousLevel = levelIndex > 0

  const commitRename = () => {
    if (editingKey) renameLevel(editingKey, editingValue)
    setEditingKey(null)
  }

  return (
    <header className="relative z-10 h-14 flex-none flex items-center gap-5 px-4 border-b border-[color:var(--hairline)] bg-[color:var(--panel-bg)] backdrop-blur-xl">
      <button onClick={closeProject} className="flex items-center gap-2.5" title="Volver a proyectos">
        <div className="w-7 h-7 rounded-lg border border-white/20 shadow-[0_0_16px_rgba(122,163,255,0.35)] flex items-center justify-center bg-gradient-to-br from-cyan-400 to-purple-500">
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none"><path d="M3 12 L12 4 L21 12 M6 10 V20 H18 V10" stroke="#0a0a10" strokeWidth={1.8} strokeLinejoin="round" /></svg>
        </div>
        <span className="text-sm font-semibold tracking-wide">PLANOS</span>
        <div className="w-px h-5 bg-[color:var(--hairline)]" />
        <span className="text-[12.5px] text-[var(--text-secondary)]">{project.name}</span>
      </button>

      <div className="flex items-center gap-1">
        <button
          onClick={undo} disabled={past.length === 0} title="Deshacer (Ctrl+Z)"
          className="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center border border-[color:var(--hairline)] bg-[color:var(--glass-weak)] text-[var(--text-secondary)] disabled:opacity-30"
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none"><path d="M9 7 L4 12 L9 17 M4 12 H14 A6 6 0 1 1 14 24 H12" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <button
          onClick={redo} disabled={future.length === 0} title="Rehacer (Ctrl+Shift+Z)"
          className="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center border border-[color:var(--hairline)] bg-[color:var(--glass-weak)] text-[var(--text-secondary)] disabled:opacity-30"
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none"><path d="M15 7 L20 12 L15 17 M20 12 H10 A6 6 0 1 0 10 24 H12" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center gap-2.5">
        <div className="flex bg-[color:var(--glass-weak)] border border-[color:var(--hairline)] rounded-[10px] p-[3px] gap-0.5">
          {project.levels.map((lv) => {
            const active = level === lv.key
            if (confirmDeleteKey === lv.key) {
              return (
                <div key={lv.key} className="flex items-center gap-1 px-2 font-mono-ui text-[10px] whitespace-nowrap">
                  <span className="text-[var(--text-tertiary)]">¿Borrar "{lv.label}"?</span>
                  <button onClick={() => { removeLevel(lv.key); setConfirmDeleteKey(null) }} className="text-[color:var(--danger-text)] font-semibold">Sí</button>
                  <button onClick={() => setConfirmDeleteKey(null)} className="text-[var(--text-secondary)]">No</button>
                </div>
              )
            }
            if (editingKey === lv.key) {
              return (
                <input
                  key={lv.key} autoFocus value={editingValue} onChange={(e) => setEditingValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditingKey(null) }}
                  className="font-mono-ui text-[10.5px] tracking-wide px-2 py-1.5 rounded-[7px] w-24 bg-[color:var(--glass-strong)] border border-cyan-400/50 outline-none text-[var(--text-primary)]"
                />
              )
            }
            return (
              <div key={lv.key} className="group relative">
                <button
                  onClick={() => setLevel(lv.key)}
                  onDoubleClick={() => { setEditingKey(lv.key); setEditingValue(lv.label) }}
                  title="Clic para ir a este piso · doble clic para renombrarlo"
                  className={`font-mono-ui text-[10.5px] tracking-wide px-3.5 py-1.5 rounded-[7px] whitespace-nowrap ${
                    active
                      ? 'bg-gradient-to-br from-cyan-400 to-indigo-500 text-[#0a0a10] font-semibold shadow-[0_0_14px_rgba(56,189,248,0.55)]'
                      : 'text-[var(--text-secondary)]'
                  }`}
                >
                  {lv.label}
                </button>
                {project.levels.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteKey(lv.key) }}
                    title="Borrar este piso"
                    className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] leading-none opacity-0 group-hover:opacity-100 bg-[color:var(--panel-bg-solid)] border border-[color:var(--hairline)] text-[var(--text-tertiary)] hover:text-[color:var(--danger-text)]"
                  >
                    ✕
                  </button>
                )}
              </div>
            )
          })}
          <button
            onClick={() => addLevel()}
            title="Agregar piso"
            className="w-[26px] h-[26px] rounded-[7px] flex items-center justify-center text-[var(--text-secondary)]"
          >
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none"><path d="M12 4 V20 M4 12 H20" stroke="currentColor" strokeWidth={2} strokeLinecap="round" /></svg>
          </button>
        </div>
        <button
          onClick={toggleGhost}
          disabled={!hasPreviousLevel}
          className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-[9px] border ${
            !hasPreviousLevel ? 'opacity-35 pointer-events-none border-[color:var(--hairline)] text-[var(--text-secondary)]' :
            showGhost ? 'text-[color:var(--accent-purple-text)] border-purple-400/55 shadow-[0_0_12px_rgba(196,132,252,0.35)] bg-purple-400/10' :
            'border-[color:var(--hairline)] bg-[color:var(--glass-weak)] text-[var(--text-secondary)]'
          }`}
        >
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke="currentColor" strokeWidth={1.6} /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth={1.6} /></svg>
          Ref. inferior
        </button>
        <button
          onClick={toggleRoomAreas}
          title="Mostrar/ocultar el área calculada de cada cuarto (m²)"
          className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-[9px] border ${
            showRoomAreas ? 'text-[color:var(--accent-purple-text)] border-purple-400/55 shadow-[0_0_12px_rgba(196,132,252,0.35)] bg-purple-400/10' :
            'border-[color:var(--hairline)] bg-[color:var(--glass-weak)] text-[var(--text-secondary)]'
          }`}
        >
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none"><rect x="4" y="5" width="16" height="14" rx="1.5" stroke="currentColor" strokeWidth={1.6} /><path d="M8 9 H16 M8 13 H13" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" /></svg>
          Área
        </button>
        <button
          onClick={toggleGridSnap}
          title={gridSnap === 1 ? 'Trazo fino: cada clic cae al centímetro exacto — clic para volver a 10 cm' : 'Trazo normal: cada clic cae en la cuadrícula de 10 cm — clic para afinar a 1 cm'}
          className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-[9px] border font-mono-ui ${
            gridSnap === 1 ? 'text-[color:var(--warn-text)] border-amber-400/55 shadow-[0_0_12px_rgba(251,191,36,0.35)] bg-amber-400/10' :
            'border-[color:var(--hairline)] bg-[color:var(--glass-weak)] text-[var(--text-secondary)]'
          }`}
        >
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none"><path d="M4 15 L4 9 L20 9 L20 15" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" /><path d="M7 9 V12 M10.3 9 V12 M13.6 9 V12 M16.9 9 V12" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" /></svg>
          {gridSnap} cm
        </button>
      </div>

      <div className="flex items-center gap-3.5">
        <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
          <span className={`w-1.5 h-1.5 rounded-full ${
            syncState === 'synced' ? 'bg-green-400 shadow-[0_0_6px_#4ade80]' :
            syncState === 'local' ? 'bg-sky-400 shadow-[0_0_6px_#38bdf8]' :
            syncState === 'error' ? 'bg-red-400 shadow-[0_0_6px_#f87171]' :
            'bg-amber-400 shadow-[0_0_6px_#fbbf24]'
          } ${syncState === 'loading' || syncState === 'saving' ? 'animate-pulse' : ''}`} />
          {SYNC_LABEL[syncState] ?? syncState}
        </div>
        <button onClick={openExport} className="rounded-[9px] px-4 py-2 text-[12.5px] font-semibold text-[#0a0a10] bg-gradient-to-br from-cyan-400 to-purple-500 shadow-[0_0_18px_rgba(168,85,247,0.45)]">
          Exportar
        </button>
        <ThemeToggle />
        <div className="w-7 h-7 rounded-full border border-white/15 bg-gradient-to-br from-indigo-900 to-purple-900 flex items-center justify-center text-[11px] font-semibold text-[#e9e8f5]">CG</div>
      </div>
    </header>
  )
}
