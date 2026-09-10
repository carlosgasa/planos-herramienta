import { useRef, useState } from 'react'
import { useProjectStore } from '../store/useProjectStore'
import type { LayerKey, Project } from '../types'
import { exportPlanToPdf } from '../lib/exportPdf'
import { saveProject } from '../lib/projectRepo'

const LAYER_DEFS: { key: LayerKey; label: string; color: string }[] = [
  { key: 'base', label: 'Base / Arquitectónica', color: 'var(--layer-base)' },
  { key: 'drenaje', label: 'Drenaje', color: 'var(--layer-drenaje)' },
  { key: 'hidraulica', label: 'Hidráulica', color: 'var(--layer-hidraulica)' },
  { key: 'electrica', label: 'Eléctrica', color: 'var(--layer-electrica)' }
]

function isValidProject(v: unknown): v is Project {
  if (!v || typeof v !== 'object') return false
  const p = v as Record<string, unknown>
  return typeof p.id === 'string' && typeof p.name === 'string' && Array.isArray(p.levels)
}

export function ExportModal() {
  const { project, level, showExportModal, closeExport, exportChecks, toggleExportCheck, setProject, setSyncState, pushToast } = useProjectStore()
  const [exporting, setExporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  // Aparte de los checks por capa: si se incluye Eléctrica, esto decide si
  // se exporta también una segunda página de esa capa con los hilos de
  // color + nombre de cada circuito asignado (ver PlanCanvas.tsx,
  // store.showCircuitWiring) — la página "limpia" de Eléctrica siempre
  // sale primero, esta es adicional, no un reemplazo.
  const [includeCircuits, setIncludeCircuits] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!showExportModal || !project) return null

  const levelLabel = project.levels.find((l) => l.key === level)?.label ?? level

  const handleExportPdf = async () => {
    setExporting(true)
    try {
      await exportPlanToPdf({ project, level, levelLabel, checks: exportChecks, includeCircuitWiring: exportChecks.electrica && includeCircuits })
      pushToast('PDF exportado ✓')
    } finally {
      setExporting(false)
      closeExport()
    }
  }

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${project.name.replace(/\s+/g, '_')}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    pushToast('Respaldo JSON descargado ✓')
  }

  const handleImportClick = () => {
    setImportError(null)
    fileInputRef.current?.click()
  }

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      if (!isValidProject(parsed)) {
        setImportError('El archivo no tiene el formato de un proyecto válido.')
        return
      }
      // Restaura el contenido del respaldo pero conserva la identidad del
      // proyecto abierto, para no dejar huérfano el documento original.
      const merged: Project = { ...parsed, id: project.id, createdAt: project.createdAt, updatedAt: Date.now() }
      setProject(merged)
      setSyncState('saving')
      await saveProject(merged)
      setSyncState('synced')
      closeExport()
      pushToast('Respaldo restaurado ✓')
    } catch {
      setImportError('No se pudo leer el archivo JSON.')
    }
  }

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[color:var(--overlay-scrim)] backdrop-blur-sm">
      <div className="w-[460px] rounded-2xl border border-[color:var(--hairline)] bg-[color:var(--panel-bg-solid)] shadow-[0_0_60px_rgba(120,80,220,0.28)] p-6">
        <div className="text-[15px] font-semibold text-[var(--text-primary)] mb-1">Exportar PDF</div>
        <div className="text-[11.5px] text-[var(--text-secondary)] mb-4">{levelLabel} · {project.name}</div>

        {LAYER_DEFS.map((d) => (
          <div key={d.key}>
            <label className="flex items-center gap-2.5 py-2 border-b border-[color:var(--hairline)] cursor-pointer">
              <input type="checkbox" checked={exportChecks[d.key]} onChange={() => toggleExportCheck(d.key)} className="accent-cyan-400 w-[15px] h-[15px]" />
              <span className="text-[12.5px] flex-1">{d.label}</span>
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: d.color }} />
            </label>
            {d.key === 'electrica' && exportChecks.electrica && (
              <label className="flex items-center gap-2.5 py-2 pl-6 border-b border-[color:var(--hairline)] cursor-pointer">
                <input type="checkbox" checked={includeCircuits} onChange={() => setIncludeCircuits((v) => !v)} className="accent-cyan-400 w-[13px] h-[13px]" />
                <span className="text-[11.5px] text-[var(--text-secondary)] flex-1">Incluir cableado de circuitos (página extra)</span>
              </label>
            )}
          </div>
        ))}

        <div className="mt-4 border border-dashed border-[color:var(--hairline)] rounded-[10px] p-3 font-mono-ui text-[10px] text-[var(--text-secondary)]">
          <div className="flex justify-between py-0.5"><span>PROYECTO</span><b className="text-[var(--text-primary)]">{project.name}</b></div>
          <div className="flex justify-between py-0.5"><span>NIVEL</span><b className="text-[var(--text-primary)]">{levelLabel}</b></div>
          <div className="flex justify-between py-0.5"><span>FECHA</span><b className="text-[var(--text-primary)]">{new Date().toLocaleDateString('es-MX')}</b></div>
          <div className="flex justify-between py-0.5"><span>ESCALA</span><b className="text-[var(--text-primary)]">{project.scaleLabel}</b></div>
        </div>

        <div className="flex gap-2.5 mt-4">
          <button onClick={closeExport} className="flex-1 border border-[color:var(--hairline)] rounded-[9px] py-2.5 text-[12.5px] text-[var(--text-secondary)]">Cancelar</button>
          <button onClick={handleExportPdf} disabled={exporting} className="flex-1 rounded-[9px] py-2.5 text-[12.5px] font-semibold text-[#0a0a10] bg-gradient-to-br from-cyan-400 to-purple-500 shadow-[0_0_16px_rgba(168,85,247,0.4)] disabled:opacity-60">
            {exporting ? 'Generando…' : 'Exportar PDF'}
          </button>
        </div>

        <div className="flex justify-center gap-4 mt-3.5 text-[11px] text-[var(--text-secondary)]">
          <button onClick={handleExportJson} className="hover:text-[color:var(--link-hover-text)]">Exportar JSON de respaldo</button>
          <button onClick={handleImportClick} className="hover:text-[color:var(--link-hover-text)]">Restaurar respaldo aquí</button>
        </div>
        {importError && <div className="text-[11px] text-[color:var(--danger-text)] mt-2 text-center">{importError}</div>}
        <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleImportFile} />
      </div>
    </div>
  )
}
