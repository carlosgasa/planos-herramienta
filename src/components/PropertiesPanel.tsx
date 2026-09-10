import type { ReactNode } from 'react'
import { useProjectStore } from '../store/useProjectStore'
import type { DrawObject, HidraulicaMaterial } from '../types'
import { doorWidth, flipDoorObject, resizeDoorObject, swapDoorHinge } from '../lib/wallEdit'

const COLOR_SWATCHES = [
  'var(--text-primary)', 'var(--layer-drenaje)', 'var(--pipe-fria)', 'var(--pipe-caliente)',
  'var(--layer-electrica)', 'var(--fitting-hl)', '#fbbf24', '#c084fc'
]

const KIND_LABEL: Record<DrawObject['kind'], string> = {
  wall: 'Muro', doorArc: 'Puerta', window: 'Ventana', dome: 'Domo',
  path: 'Línea / tubería / ducto', circle: 'Círculo', rect: 'Rectángulo',
  text: 'Etiqueta / texto', symbol: 'Símbolo'
}

const MATERIALES: { key: HidraulicaMaterial; label: string; title: string }[] = [
  { key: 'cobre', label: 'CU', title: 'Cobre' },
  { key: 'ppr', label: 'PPR', title: 'PPR' },
  { key: 'cpvc', label: 'CPVC', title: 'CPVC' },
  { key: 'manguera', label: 'MANG.', title: 'Manguera' }
]

const inputCls = 'w-full font-mono-ui text-[11px] px-1.5 py-1 rounded border bg-transparent outline-none'
const inputStyle = { borderColor: 'var(--hairline)', color: 'var(--text-primary)' }

/** Invierte el sentido de un tramo de 2 puntos ("M x1 y1 L x2 y2") — el
 *  origen del flujo animado es siempre el primer punto, así que esto es lo
 *  que hace falta para voltear la dirección sin tener que borrar y
 *  redibujar el tramo. */
function reversePathData(d: string): string {
  const pts = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? []
  if (pts.length !== 4) return d
  const [x1, y1, x2, y2] = pts
  return `M ${x2} ${y2} L ${x1} ${y1}`
}

function parseNum(raw: string): number | null {
  const n = Number(raw)
  return Number.isNaN(n) ? null : n
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono-ui text-[9px] tracking-[0.08em] text-[var(--text-tertiary)]">{label}</span>
      {children}
    </div>
  )
}

function ColorField({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {COLOR_SWATCHES.map((c) => (
        <button
          key={c} onClick={() => onChange(c)} title={c}
          className="w-[16px] h-[16px] rounded-full flex-none"
          style={{ background: c, boxShadow: value === c ? '0 0 0 2px var(--text-primary)' : '0 0 0 1px color-mix(in srgb, var(--text-tertiary) 40%, transparent)' }}
        />
      ))}
      <input
        type="text" value={value} onChange={(e) => onChange(e.target.value)}
        className="flex-1 min-w-[64px] font-mono-ui text-[10px] px-1.5 py-1 rounded border bg-transparent outline-none"
        style={inputStyle}
      />
    </div>
  )
}

export function PropertiesPanel() {
  const project = useProjectStore((s) => s.project)
  const level = useProjectStore((s) => s.level)
  const selection = useProjectStore((s) => s.selection)
  const multiSelection = useProjectStore((s) => s.multiSelection)
  const applyEdit = useProjectStore((s) => s.applyEdit)
  const deleteSelected = useProjectStore((s) => s.deleteSelected)
  const deleteMultiSelection = useProjectStore((s) => s.deleteMultiSelection)
  const duplicateMultiSelection = useProjectStore((s) => s.duplicateMultiSelection)
  const duplicateSelected = useProjectStore((s) => s.duplicateSelected)

  // Con más de un objeto seleccionado no tiene sentido editar propiedades
  // (podrían ser de tipos distintos) — se muestra una barra compacta para
  // duplicarlos/borrarlos juntos en su lugar; moverlos ya funciona
  // arrastrando cualquiera de ellos o con las flechas, sin este panel.
  if (multiSelection && multiSelection.ids.length > 1) {
    return (
      <div className="rounded-xl border border-[color:var(--hairline)] bg-[color:var(--glass-weak)] p-3 flex items-center justify-between">
        <span className="text-[11.5px] text-[var(--text-secondary)]">{multiSelection.ids.length} objetos seleccionados</span>
        <div className="flex items-center gap-2">
          <button onClick={duplicateMultiSelection} title="Duplicar todos (Ctrl+D)" className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none"><rect x="8" y="8" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth={1.6} /><path d="M4 16 V5 a1 1 0 0 1 1 -1 H16" stroke="currentColor" strokeWidth={1.6} /></svg>
          </button>
          <button onClick={deleteMultiSelection} title="Borrar todos (Supr)" className="text-[var(--text-tertiary)] hover:text-[var(--fitting-hl)]">
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none"><path d="M5 7 H19 M9 7 V4 H15 V7 M7 7 L8 20 H16 L17 7" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" /></svg>
          </button>
        </div>
      </div>
    )
  }

  if (!selection) return null
  const current = project?.levels.find((l) => l.key === level)
  const obj = current?.layers[selection.layer].find((o) => o.id === selection.id)
  if (!obj) return null
  const objId = obj.id
  const layer = selection.layer

  const patch = (fn: (o: DrawObject) => DrawObject) => {
    applyEdit(layer, (objs) => objs.map((o) => (o.id === objId ? fn(o) : o)))
  }

  return (
    <div className="rounded-xl border border-[color:var(--hairline)] bg-[color:var(--glass-weak)] p-3 flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <div className="font-mono-ui text-[10px] tracking-[0.1em] text-[var(--text-tertiary)]">PROPIEDADES · {KIND_LABEL[obj.kind]}</div>
        <div className="flex items-center gap-2">
          {obj.kind !== 'doorArc' && (
            <button onClick={duplicateSelected} title="Duplicar (Ctrl+D)" className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none"><rect x="8" y="8" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth={1.6} /><path d="M4 16 V5 a1 1 0 0 1 1 -1 H16" stroke="currentColor" strokeWidth={1.6} /></svg>
            </button>
          )}
          <button onClick={deleteSelected} title="Borrar (Supr)" className="text-[var(--text-tertiary)] hover:text-[var(--fitting-hl)]">
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none"><path d="M5 7 H19 M9 7 V4 H15 V7 M7 7 L8 20 H16 L17 7" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" /></svg>
          </button>
        </div>
      </div>

      {obj.kind === 'text' && (
        <>
          <Field label="TEXTO">
            <input className={inputCls} style={inputStyle} value={obj.text} onChange={(e) => patch((o) => (o.kind === 'text' ? { ...o, text: e.target.value } : o))} />
          </Field>
          <Field label="COLOR">
            <ColorField value={obj.color} onChange={(c) => patch((o) => (o.kind === 'text' ? { ...o, color: c } : o))} />
          </Field>
          <Field label="TAMAÑO">
            <input
              type="number" min={6} max={40} className={inputCls} style={inputStyle} value={obj.size ?? 11}
              onChange={(e) => { const n = parseNum(e.target.value); if (n !== null) patch((o) => (o.kind === 'text' ? { ...o, size: n } : o)) }}
            />
          </Field>
        </>
      )}

      {obj.kind === 'symbol' && (
        <>
          <Field label="ETIQUETA">
            <input
              className={inputCls} style={inputStyle} value={obj.label ?? ''} placeholder="(sin etiqueta)"
              onChange={(e) => patch((o) => (o.kind === 'symbol' ? { ...o, label: e.target.value } : o))}
            />
          </Field>
          <Field label="COLOR">
            <ColorField value={obj.color} onChange={(c) => patch((o) => (o.kind === 'symbol' ? { ...o, color: c } : o))} />
          </Field>
          <Field label="ROTACIÓN">
            <div className="flex items-center gap-1.5">
              <input
                type="number" step={5} className={inputCls} style={inputStyle} value={obj.rotation}
                onChange={(e) => { const n = parseNum(e.target.value); if (n !== null) patch((o) => (o.kind === 'symbol' ? { ...o, rotation: ((n % 360) + 360) % 360 } : o)) }}
              />
              <span className="text-[10px] text-[var(--text-tertiary)]">°</span>
            </div>
          </Field>
          <Field label="TAMAÑO">
            <div className="flex items-center gap-1.5">
              <input
                type="number" min={25} max={400} step={5} className={inputCls} style={inputStyle} value={Math.round((obj.scale ?? 1) * 100)}
                onChange={(e) => { const n = parseNum(e.target.value); if (n !== null && n > 0) patch((o) => (o.kind === 'symbol' ? { ...o, scale: n / 100 } : o)) }}
              />
              <span className="text-[10px] text-[var(--text-tertiary)]">%</span>
            </div>
          </Field>
          {obj.shape === 'tablero' && (
            <Field label={`CIRCUITOS (${current?.circuits.length ?? 0})`}>
              {current && current.circuits.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {current.circuits.map((c) => (
                    <div key={c.id} className="flex items-center gap-1.5 text-[10.5px] text-[var(--text-secondary)]">
                      <div className="w-1.5 h-1.5 rounded-full flex-none" style={{ background: c.color }} />
                      <span className="truncate">{c.name}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[10.5px] text-[var(--text-tertiary)] italic">Sin circuitos — créalos en la etapa "Cableado".</div>
              )}
            </Field>
          )}
        </>
      )}

      {obj.kind === 'path' && (
        <>
          <Field label="COLOR">
            <ColorField value={obj.stroke} onChange={(c) => patch((o) => (o.kind === 'path' ? { ...o, stroke: c } : o))} />
          </Field>
          <Field label="GROSOR">
            <input
              type="number" min={0.5} max={12} step={0.1} className={inputCls} style={inputStyle} value={obj.strokeWidth}
              onChange={(e) => { const n = parseNum(e.target.value); if (n !== null) patch((o) => (o.kind === 'path' ? { ...o, strokeWidth: n } : o)) }}
            />
          </Field>
          {(layer === 'drenaje' || layer === 'hidraulica' || layer === 'electrica') && (
            <>
              <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
                <input type="checkbox" checked={!!obj.animated} onChange={(e) => patch((o) => (o.kind === 'path' ? { ...o, animated: e.target.checked } : o))} />
                Flujo animado
              </label>
              <button
                onClick={() => patch((o) => (o.kind === 'path' ? { ...o, d: reversePathData(o.d) } : o))}
                title="Voltear cuál extremo es el origen del flujo"
                className="w-full font-mono-ui text-[10px] px-1.5 py-1 rounded border"
                style={{ color: 'var(--text-secondary)', borderColor: 'var(--hairline)' }}
              >
                ⇄ Invertir dirección
              </button>
            </>
          )}
          {layer === 'hidraulica' && (
            <Field label="MATERIAL">
              <div className="flex items-center gap-1 flex-wrap">
                {MATERIALES.map((m) => (
                  <button
                    key={m.key} title={m.title} onClick={() => patch((o) => (o.kind === 'path' ? { ...o, material: m.key } : o))}
                    className="px-1.5 h-[18px] rounded-[6px] font-mono-ui text-[8px] border leading-none"
                    style={obj.material === m.key
                      ? { color: '#0a0a10', background: 'var(--layer-hidraulica)', borderColor: 'transparent', fontWeight: 600 }
                      : { color: 'var(--layer-hidraulica)', background: 'transparent', borderColor: 'color-mix(in srgb, var(--layer-hidraulica) 30%, transparent)' }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </Field>
          )}
          <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
            <input type="checkbox" checked={!!obj.dashed} onChange={(e) => patch((o) => (o.kind === 'path' ? { ...o, dashed: e.target.checked } : o))} />
            Punteado
          </label>
        </>
      )}

      {obj.kind === 'dome' && (
        <>
          <Field label="ETIQUETA">
            <input
              className={inputCls} style={inputStyle} value={obj.label ?? ''} placeholder="(sin etiqueta)"
              onChange={(e) => patch((o) => (o.kind === 'dome' ? { ...o, label: e.target.value } : o))}
            />
          </Field>
          <div className="flex gap-2">
            <Field label="ANCHO">
              <input
                type="number" min={10} className={inputCls} style={inputStyle} value={Math.round(obj.w)}
                onChange={(e) => { const n = parseNum(e.target.value); if (n !== null && n >= 10) patch((o) => (o.kind === 'dome' ? { ...o, w: n } : o)) }}
              />
            </Field>
            <Field label="ALTO">
              <input
                type="number" min={10} className={inputCls} style={inputStyle} value={Math.round(obj.h)}
                onChange={(e) => { const n = parseNum(e.target.value); if (n !== null && n >= 10) patch((o) => (o.kind === 'dome' ? { ...o, h: n } : o)) }}
              />
            </Field>
          </div>
        </>
      )}

      {obj.kind === 'window' && (
        <Field label="ANCHO">
          <input
            type="number" min={20} max={300} className={inputCls} style={inputStyle} value={Math.round(obj.w)}
            onChange={(e) => {
              const n = parseNum(e.target.value)
              if (n === null || n < 20) return
              // El ancho crece/encoge centrado en el punto medio actual, para
              // no desplazar la ventana sobre el muro al redimensionar.
              patch((o) => {
                if (o.kind !== 'window') return o
                const cx = o.x + o.w / 2
                return { ...o, x: cx - n / 2, w: n }
              })
            }}
          />
        </Field>
      )}

      {obj.kind === 'wall' && (
        <Field label="ESPESOR">
          <input
            type="number" min={4} max={40} className={inputCls} style={inputStyle} value={obj.thickness}
            onChange={(e) => { const n = parseNum(e.target.value); if (n !== null) patch((o) => (o.kind === 'wall' ? { ...o, thickness: n } : o)) }}
          />
        </Field>
      )}

      {obj.kind === 'circle' && (
        <>
          <Field label="COLOR (BORDE)">
            <ColorField value={obj.stroke} onChange={(c) => patch((o) => (o.kind === 'circle' ? { ...o, stroke: c } : o))} />
          </Field>
          <Field label="RADIO">
            <input
              type="number" min={2} className={inputCls} style={inputStyle} value={Math.round(obj.r)}
              onChange={(e) => { const n = parseNum(e.target.value); if (n !== null && n >= 2) patch((o) => (o.kind === 'circle' ? { ...o, r: n } : o)) }}
            />
          </Field>
        </>
      )}

      {obj.kind === 'rect' && (
        <>
          <Field label="COLOR (BORDE)">
            <ColorField value={obj.stroke} onChange={(c) => patch((o) => (o.kind === 'rect' ? { ...o, stroke: c } : o))} />
          </Field>
          <div className="flex gap-2">
            <Field label="ANCHO">
              <input
                type="number" min={5} className={inputCls} style={inputStyle} value={Math.round(obj.w)}
                onChange={(e) => { const n = parseNum(e.target.value); if (n !== null && n >= 5) patch((o) => (o.kind === 'rect' ? { ...o, w: n } : o)) }}
              />
            </Field>
            <Field label="ALTO">
              <input
                type="number" min={5} className={inputCls} style={inputStyle} value={Math.round(obj.h)}
                onChange={(e) => { const n = parseNum(e.target.value); if (n !== null && n >= 5) patch((o) => (o.kind === 'rect' ? { ...o, h: n } : o)) }}
              />
            </Field>
          </div>
        </>
      )}

      {obj.kind === 'doorArc' && (
        <>
          <Field label="ANCHO">
            <input
              type="number" min={40} max={300} className={inputCls} style={inputStyle} value={Math.round(doorWidth(obj))}
              onChange={(e) => {
                const n = parseNum(e.target.value)
                if (n === null || n < 40) return
                patch((o) => (o.kind === 'doorArc' ? resizeDoorObject(o, n) : o))
              }}
            />
          </Field>
          <div className="flex gap-2">
            <button
              onClick={() => patch((o) => (o.kind === 'doorArc' ? flipDoorObject(o) : o))}
              title="Voltear hacia qué lado del muro se abre la hoja"
              className="flex-1 font-mono-ui text-[10px] px-1.5 py-1 rounded border"
              style={{ color: 'var(--text-secondary)', borderColor: 'var(--hairline)' }}
            >
              ⇄ Invertir apertura
            </button>
            <button
              onClick={() => patch((o) => (o.kind === 'doorArc' ? swapDoorHinge(o) : o))}
              title="Cambiar de lado la bisagra — invierte el sentido hacia el que cierra"
              className="flex-1 font-mono-ui text-[10px] px-1.5 py-1 rounded border"
              style={{ color: 'var(--text-secondary)', borderColor: 'var(--hairline)' }}
            >
              ⇄ Invertir bisagra
            </button>
          </div>
        </>
      )}
    </div>
  )
}
