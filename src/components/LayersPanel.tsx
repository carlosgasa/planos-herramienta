import { useProjectStore } from '../store/useProjectStore'
import { quantifyLevel } from '../lib/quantify'
import { downloadQuantitiesCSV } from '../lib/exportQuantities'
import { PropertiesPanel } from './PropertiesPanel'
import { SymbologyPanel } from './SymbologyPanel'
import type { LayerKey } from '../types'

const LAYER_DEFS: { key: LayerKey; label: string; color: string; order: number }[] = [
  { key: 'base', label: 'Base / Arquitectónica', color: 'var(--layer-base)', order: 1 },
  { key: 'drenaje', label: 'Drenaje', color: 'var(--layer-drenaje)', order: 2 },
  { key: 'hidraulica', label: 'Hidráulica', color: 'var(--layer-hidraulica)', order: 3 },
  { key: 'electrica', label: 'Eléctrica', color: 'var(--layer-electrica)', order: 4 }
]

export function LayersPanel() {
  const { project, level, layerState, toggleLayerVisible, toggleLayerLock, setLayerOpacity, layersPanelCollapsed, toggleLayersPanelCollapsed, pushToast } = useProjectStore()
  const current = project?.levels.find((l) => l.key === level)
  const q = current ? quantifyLevel(current) : null

  if (layersPanelCollapsed) {
    return (
      <div className="w-6 flex-none flex flex-col items-center pt-3 border-l border-[color:var(--hairline)] bg-[color:var(--panel-bg)] backdrop-blur-xl">
        <button onClick={toggleLayersPanelCollapsed} title="Mostrar panel de capas" className="w-5 h-8 rounded-md flex items-center justify-center text-[var(--text-secondary)]">
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none"><path d="M15 5 L8 12 L15 19" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
    )
  }

  return (
    <aside className="w-[296px] flex-none flex flex-col gap-5 p-4 overflow-y-auto border-l border-[color:var(--hairline)] bg-[color:var(--panel-bg)] backdrop-blur-xl">
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="font-mono-ui text-[10.5px] tracking-[0.12em] text-[var(--text-tertiary)]">CAPAS</div>
          <button onClick={toggleLayersPanelCollapsed} title="Ocultar panel (más espacio para el lienzo)" className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--text-secondary)]">
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none"><path d="M9 5 L16 12 L9 19" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>

        {LAYER_DEFS.map((d) => {
          const st = layerState[d.key]
          return (
            <div key={d.key} className="rounded-xl border border-[color:var(--hairline)] bg-[color:var(--glass-weak)] p-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded bg-[color:var(--glass-strong)] text-[9px] flex items-center justify-center text-[var(--text-tertiary)] font-mono-ui flex-none">{d.order}</div>
                <div className="w-2.5 h-2.5 rounded-sm flex-none" style={{ background: d.color, boxShadow: `0 0 8px ${d.color}` }} />
                <div className="flex-1 text-[12.5px]">{d.label}</div>
                <button onClick={() => toggleLayerVisible(d.key)} className="w-[26px] h-[26px] rounded-md flex items-center justify-center" style={{ color: st.visible ? d.color : '#4b4a5c' }}>
                  <svg width={15} height={15} viewBox="0 0 24 24" fill="none"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke="currentColor" strokeWidth={1.6} /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth={1.6} /></svg>
                </button>
                <button onClick={() => toggleLayerLock(d.key)} className="w-[26px] h-[26px] rounded-md flex items-center justify-center" style={{ color: st.locked ? 'var(--fitting-hl)' : '#4b4a5c' }}>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth={1.6} /><path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth={1.6} /></svg>
                </button>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="range" min={0} max={100} value={st.opacity}
                  onChange={(e) => setLayerOpacity(d.key, Number(e.target.value))}
                  className="flex-1 accent-purple-500 h-[3px]"
                />
                <span className="font-mono-ui text-[10px] text-[var(--text-tertiary)] w-[30px] text-right">{st.opacity}%</span>
              </div>
            </div>
          )
        })}
      </div>

      <PropertiesPanel />

      <SymbologyPanel />

      {q && (
        <div className="rounded-xl border border-[color:var(--hairline)] bg-[color:var(--glass-weak)] p-3 mt-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="font-mono-ui text-[10px] tracking-[0.1em] text-[var(--text-tertiary)]">CUANTIFICACIÓN — {current?.label}</div>
            <button
              onClick={() => { if (project) { downloadQuantitiesCSV(project); pushToast('Cuantificación descargada ✓') } }}
              title="Descargar lista de materiales de todo el proyecto (CSV)"
              className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            >
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none"><path d="M12 3 V15 M7 10 L12 15 L17 10 M5 19 H19" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
          {[
            ['Muros', `${q.wallLengthM.toFixed(1)} m`],
            ['Tubería drenaje', `${q.drenajeLengthM.toFixed(1)} m`],
            ['Tubería hidráulica', `${q.hidraulicaLengthM.toFixed(1)} m`],
            ['Ductos eléctricos', `${q.electricaLengthM.toFixed(1)} m`],
            ['Piezas / conexiones', `${q.fittingsCount} pza`],
            ['Salidas eléctricas', `${q.outletsCount} pza`]
          ].map(([label, val]) => (
            <div key={label} className="flex justify-between text-[11.5px] text-[var(--text-secondary)] py-0.5">
              <span>{label}</span>
              <b className="font-mono-ui text-[var(--text-primary)] font-semibold">{val}</b>
            </div>
          ))}
        </div>
      )}
    </aside>
  )
}
