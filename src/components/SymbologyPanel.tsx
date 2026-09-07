import { useState } from 'react'
import { SymbolGlyph } from '../lib/symbols'
import { DISPOSITIVO_DEFS, EQUIPO_DEFS, PIEZA_DEFS, PIEZA_HIDRAULICA_DEFS, PRINCIPAL_DEFS } from '../lib/stamps'
import type { SymbolShape } from '../types'

interface LegendItem {
  shape: SymbolShape
  label: string
  color: string
}

interface LegendGroup {
  title: string
  color: string
  items: LegendItem[]
}

const GROUPS: LegendGroup[] = [
  {
    title: 'Base',
    color: 'var(--layer-base)',
    items: [{ shape: 'escalera', label: 'Escalera / acceso entre niveles', color: 'var(--stair-hl)' }]
  },
  {
    title: 'Drenaje — piezas',
    color: 'var(--layer-drenaje)',
    items: (Object.keys(PIEZA_DEFS) as (keyof typeof PIEZA_DEFS)[]).map((k) => ({ shape: k, label: PIEZA_DEFS[k].label, color: 'var(--fitting-hl)' }))
  },
  {
    title: 'Hidráulica — piezas',
    color: 'var(--layer-hidraulica)',
    items: (Object.keys(PIEZA_HIDRAULICA_DEFS) as (keyof typeof PIEZA_HIDRAULICA_DEFS)[]).map((k) => ({
      shape: k, label: PIEZA_HIDRAULICA_DEFS[k].label, color: k === 'toma' ? 'var(--pipe-fria)' : 'var(--layer-hidraulica)'
    }))
  },
  {
    title: 'Hidráulica — equipos',
    color: 'var(--layer-hidraulica)',
    items: (Object.keys(EQUIPO_DEFS) as (keyof typeof EQUIPO_DEFS)[]).map((k) => ({ shape: k, label: EQUIPO_DEFS[k].label, color: EQUIPO_DEFS[k].color }))
  },
  {
    title: 'Eléctrica — tablero',
    color: 'var(--layer-electrica)',
    items: (Object.keys(PRINCIPAL_DEFS) as (keyof typeof PRINCIPAL_DEFS)[]).map((k) => ({ shape: k, label: PRINCIPAL_DEFS[k].label, color: 'var(--layer-electrica)' }))
  },
  {
    title: 'Eléctrica — dispositivos',
    color: 'var(--layer-electrica)',
    items: (Object.keys(DISPOSITIVO_DEFS) as (keyof typeof DISPOSITIVO_DEFS)[]).map((k) => ({ shape: k, label: DISPOSITIVO_DEFS[k].label, color: DISPOSITIVO_DEFS[k].color }))
  }
]

export function SymbologyPanel() {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-xl border border-[color:var(--hairline)] bg-[color:var(--glass-weak)] p-2.5">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between">
        <div className="font-mono-ui text-[10px] tracking-[0.1em] text-[var(--text-tertiary)]">SIMBOLOGÍA</div>
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform .15s ease' }}>
          <path d="M6 9 L12 15 L18 9" stroke="var(--text-tertiary)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="mt-2 flex flex-col gap-3 max-h-[360px] overflow-y-auto pr-0.5">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-1.5 h-1.5 rounded-full flex-none" style={{ background: g.color, boxShadow: `0 0 6px ${g.color}` }} />
                <div className="text-[10px] font-semibold tracking-wide" style={{ color: g.color }}>{g.title}</div>
              </div>
              <div className="grid grid-cols-1 gap-y-1">
                {g.items.map((item) => (
                  <div key={item.shape} className="flex items-center gap-2">
                    <svg width={27} height={27} viewBox="-16 -16 32 32" className="flex-none">
                      <SymbolGlyph shape={item.shape} color={item.color} />
                    </svg>
                    <span className="text-[10.5px] text-[var(--text-secondary)] leading-tight">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
