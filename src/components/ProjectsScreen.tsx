import { useEffect, useRef, useState } from 'react'
import { useProjectStore } from '../store/useProjectStore'
import { createProject, deleteProject, listProjects, saveProject } from '../lib/projectRepo'
import { makeSeedProject } from '../data/seedProject'
import { firebaseEnabled } from '../lib/firebase'
import { ThemeToggle } from './ThemeToggle'
import type { Project } from '../types'

function isValidProject(v: unknown): v is Project {
  if (!v || typeof v !== 'object') return false
  const p = v as Record<string, unknown>
  return typeof p.id === 'string' && typeof p.name === 'string' && Array.isArray(p.levels)
}

function relativeDate(ts: number): string {
  const diffMs = Date.now() - ts
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'justo ahora'
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.round(hours / 24)
  if (days < 30) return `hace ${days} d`
  return new Date(ts).toLocaleDateString('es-MX')
}

export function ProjectsScreen() {
  const openProject = useProjectStore((s) => s.openProject)
  const [projects, setProjects] = useState<Project[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const refresh = () => {
    setError(null)
    listProjects().then(setProjects).catch((err) => {
      console.error('[proyectos] no se pudo leer de Firestore/localStorage:', err)
      setError('No se pudieron cargar los proyectos.')
    })
  }

  useEffect(refresh, [])

  const handleCreate = async () => {
    const name = newName.trim() || 'Proyecto sin nombre'
    setCreating(false)
    setNewName('')
    const project = await createProject(name)
    openProject(project)
  }

  const handleOpen = (p: Project) => openProject(p)

  const handleDelete = async (id: string) => {
    setBusyId(id)
    await deleteProject(id)
    setBusyId(null)
    setConfirmDeleteId(null)
    refresh()
  }

  const handleExample = async () => {
    const project = makeSeedProject()
    await saveProject(project)
    openProject(project)
  }

  const handleImportClick = () => fileInputRef.current?.click()

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      if (!isValidProject(parsed)) {
        setError('El archivo no tiene el formato de un proyecto válido.')
        return
      }
      // Se importa como proyecto nuevo (id fresco) para nunca pisar uno existente por accidente.
      const now = Date.now()
      const project: Project = { ...parsed, id: `import-${now}-${Math.random().toString(36).slice(2, 8)}`, createdAt: now, updatedAt: now }
      await saveProject(project)
      openProject(project)
    } catch {
      setError('No se pudo leer el archivo JSON.')
    }
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-[var(--bg-app)]">
      <div className="absolute w-[640px] h-[640px] rounded-full blur-[70px] -left-[160px] -top-[220px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.32), transparent 70%)' }} />
      <div className="absolute w-[700px] h-[700px] rounded-full blur-[70px] -right-[200px] -top-[260px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.24), transparent 70%)' }} />

      <div className="relative z-10 h-full overflow-y-auto px-10 py-10 max-w-[1100px] mx-auto">
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-8 h-8 rounded-lg border border-white/20 shadow-[0_0_16px_rgba(122,163,255,0.35)] flex items-center justify-center bg-gradient-to-br from-cyan-400 to-purple-500">
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none"><path d="M3 12 L12 4 L21 12 M6 10 V20 H18 V10" stroke="#0a0a10" strokeWidth={1.8} strokeLinejoin="round" /></svg>
          </div>
          <span className="text-base font-semibold tracking-wide">PLANOS RESIDENCIALES</span>
          <div className="ml-auto"><ThemeToggle /></div>
        </div>

        <div className="flex items-center justify-between mb-5">
          <div className="text-[18px] font-semibold">Proyectos recientes</div>
          <div className="flex items-center gap-2.5">
            <button onClick={handleImportClick} className="text-[12px] px-3.5 py-2 rounded-[9px] border border-[color:var(--hairline)] text-[var(--text-secondary)]">Importar JSON</button>
            <button onClick={() => setCreating(true)} className="text-[12.5px] font-semibold px-4 py-2 rounded-[9px] text-[#0a0a10] bg-gradient-to-br from-cyan-400 to-purple-500 shadow-[0_0_16px_rgba(168,85,247,0.4)]">+ Nuevo proyecto</button>
          </div>
        </div>

        {!firebaseEnabled && (
          <div className="mb-5 rounded-lg border border-amber-400/30 bg-amber-400/10 text-[color:var(--warn-text)] text-[11px] px-3 py-2">
            Firebase no está configurado — tus proyectos se guardan solo en este navegador (localStorage).
          </div>
        )}
        {error && <div className="mb-5 rounded-lg border border-red-400/30 bg-red-400/10 text-[color:var(--danger-text)] text-[11px] px-3 py-2">{error}</div>}

        {creating && (
          <div className="mb-6 rounded-xl border border-[color:var(--hairline)] bg-[color:var(--glass-weak)] p-4 flex items-center gap-3">
            <input
              autoFocus
              placeholder="Nombre del proyecto"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreating(false) }}
              className="flex-1 bg-transparent border border-[color:var(--hairline)] rounded-[9px] px-3 py-2 text-[13px] outline-none focus:border-cyan-400/60"
            />
            <button onClick={handleCreate} className="text-[12.5px] font-semibold px-4 py-2 rounded-[9px] text-[#0a0a10] bg-gradient-to-br from-cyan-400 to-purple-500">Crear</button>
            <button onClick={() => setCreating(false)} className="text-[12px] px-3 py-2 text-[var(--text-secondary)]">Cancelar</button>
          </div>
        )}

        {projects === null && <div className="text-[13px] text-[var(--text-tertiary)]">Cargando…</div>}

        {projects !== null && projects.length === 0 && !creating && (
          <div className="rounded-2xl border border-dashed border-[color:var(--hairline)] p-10 text-center">
            <svg width={96} height={96} viewBox="0 0 96 96" fill="none" className="mx-auto mb-4">
              <rect x="14" y="18" width="68" height="52" rx="2" stroke="url(#emptyGrad)" strokeWidth="2" />
              <path d="M48 18 V70 M14 44 H48" stroke="url(#emptyGrad)" strokeWidth="1.6" strokeDasharray="4 3" />
              <path d="M20 44 V60 A6 6 0 0 0 26 66" stroke="url(#emptyGrad)" strokeWidth="1.4" opacity={0.7} />
              <circle cx="66" cy="30" r="3.5" fill="url(#emptyGrad)" opacity={0.85} />
              <path d="M30 78 H66" stroke="var(--text-tertiary)" strokeWidth="1.4" strokeLinecap="round" opacity={0.5} />
              <defs>
                <linearGradient id="emptyGrad" x1="14" y1="18" x2="82" y2="70" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#22d3ee" />
                  <stop offset="1" stopColor="#a855f7" />
                </linearGradient>
              </defs>
            </svg>
            <div className="text-[14px] text-[var(--text-secondary)] mb-4">Aún no tienes proyectos.</div>
            <div className="flex items-center justify-center gap-3">
              <button onClick={() => setCreating(true)} className="text-[12.5px] font-semibold px-4 py-2 rounded-[9px] text-[#0a0a10] bg-gradient-to-br from-cyan-400 to-purple-500">Crear el primero</button>
              <button onClick={handleExample} className="text-[12.5px] px-4 py-2 rounded-[9px] border border-[color:var(--hairline)] text-[var(--text-secondary)]">Ver proyecto de ejemplo</button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          {projects?.map((p) => (
            <div key={p.id} className="rounded-xl border border-[color:var(--hairline)] bg-[color:var(--glass-weak)] p-4 hover:border-cyan-400/40 transition-colors cursor-pointer group">
              <button onClick={() => handleOpen(p)} className="w-full text-left">
                <div className="h-20 rounded-lg mb-3 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(34,211,238,0.08), rgba(168,85,247,0.08))' }}>
                  <svg width={30} height={30} viewBox="0 0 24 24" fill="none"><path d="M3 12 L12 4 L21 12 M6 10 V20 H18 V10" stroke="var(--text-tertiary)" strokeWidth={1.3} strokeLinejoin="round" /></svg>
                </div>
                <div className="text-[13.5px] font-medium mb-1 truncate">{p.name}</div>
                <div className="text-[10.5px] text-[var(--text-tertiary)] font-mono-ui">{p.levels.length} niveles · {relativeDate(p.updatedAt)}</div>
              </button>
              <div className="mt-3 flex justify-end">
                {confirmDeleteId === p.id ? (
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-[var(--text-tertiary)]">¿Borrar?</span>
                    <button onClick={() => handleDelete(p.id)} disabled={busyId === p.id} className="text-[color:var(--danger-text)]">Sí</button>
                    <button onClick={() => setConfirmDeleteId(null)} className="text-[var(--text-secondary)]">No</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDeleteId(p.id)} className="text-[10.5px] text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 hover:text-[color:var(--danger-text)]">Eliminar</button>
                )}
              </div>
            </div>
          ))}
        </div>

        <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleImportFile} />
      </div>
    </div>
  )
}
