import { useState } from 'react'
import { useProjectStore } from '../store/useProjectStore'
import type { Circuit, CircuitType } from '../types'
import { CIRCUIT_PALETTE, circuitContourShadow, nextCircuitColor } from '../lib/circuitColors'

const TYPE_DEFS: { key: CircuitType; label: string; color: string }[] = [
  { key: 'contactos', label: 'Contactos', color: 'var(--circuit-contactos)' },
  { key: 'iluminacion', label: 'Iluminación', color: 'var(--circuit-iluminacion)' },
  { key: 'fuerza', label: 'Fuerza', color: 'var(--circuit-fuerza)' },
  { key: 'retorno', label: 'Retorno', color: 'var(--circuit-retorno)' }
]

/** Fila de un circuito en cualquiera de las dos listas (Circuitos
 *  derivados / Retornos) — el nombre se edita con doble clic (mismo
 *  patrón que renombrar un nivel en TopBar.tsx): un input reemplaza el
 *  texto, Enter o perder el foco confirma, Escape cancela sin guardar. El
 *  punto de color es un botón: un clic despliega la misma paleta de
 *  `CIRCUIT_PALETTE` justo debajo, para poder cambiarle el color a un
 *  circuito ya creado (antes solo se elegía una vez, al crearlo). */
function CircuitRow({
  circuit, editingId, editingValue, onStartEdit, onChangeEdit, onCommitEdit, onCancelEdit, onRemove,
  colorPickerId, onToggleColorPicker, onSetColor
}: {
  circuit: Circuit
  editingId: string | null
  editingValue: string
  onStartEdit: (c: Circuit) => void
  onChangeEdit: (v: string) => void
  onCommitEdit: () => void
  onCancelEdit: () => void
  onRemove: (id: string) => void
  colorPickerId: string | null
  onToggleColorPicker: (id: string) => void
  onSetColor: (id: string, color: string) => void
}) {
  const isEditing = editingId === circuit.id
  const pickerOpen = colorPickerId === circuit.id
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 text-[11.5px]">
        <button
          onClick={() => onToggleColorPicker(circuit.id)} title="Cambiar color"
          className="w-2.5 h-2.5 rounded-full flex-none"
          style={{ background: circuit.color, boxShadow: circuitContourShadow(circuit.color, pickerOpen ? '0 0 0 2px var(--text-primary)' : undefined) }}
        />
        {isEditing ? (
          <input
            autoFocus value={editingValue} onChange={(e) => onChangeEdit(e.target.value)}
            onBlur={onCommitEdit}
            onKeyDown={(e) => { if (e.key === 'Enter') onCommitEdit(); if (e.key === 'Escape') onCancelEdit() }}
            className="flex-1 min-w-0 bg-[color:var(--glass-strong)] border border-cyan-400/50 rounded px-1 py-0.5 text-[11.5px] outline-none text-[var(--text-primary)]"
          />
        ) : (
          <span onDoubleClick={() => onStartEdit(circuit)} title="Doble clic para renombrar" className="flex-1 truncate cursor-text">{circuit.name}</span>
        )}
        <button onClick={() => onRemove(circuit.id)} className="text-[var(--text-tertiary)] hover:text-[color:var(--danger-text)] text-[10px]">✕</button>
      </div>
      {pickerOpen && (
        <div className="flex items-center gap-1 flex-wrap pl-4">
          {CIRCUIT_PALETTE.map((c) => (
            <button
              key={c} onClick={() => onSetColor(circuit.id, c)} title={c}
              className="w-[15px] h-[15px] rounded-full flex-none"
              style={{ background: c, boxShadow: circuitContourShadow(c, circuit.color === c ? '0 0 0 2px var(--text-primary)' : '0 0 0 1px color-mix(in srgb, var(--text-tertiary) 40%, transparent)') }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function CircuitsPanel() {
  const { project, level, selection, electricaStage, addCircuit, renameCircuit, setCircuitColor, removeCircuit, toggleCircuitOnDuct } = useProjectStore()
  const [name, setName] = useState('')
  const [type, setType] = useState<CircuitType>('contactos')
  const [color, setColor] = useState<string>(CIRCUIT_PALETTE[0])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [colorPickerId, setColorPickerId] = useState<string | null>(null)

  if (electricaStage !== 'cableado') return null
  const lvl = project?.levels.find((l) => l.key === level)
  if (!lvl) return null

  const selectedDuct = selection?.layer === 'electrica'
    ? lvl.layers.electrica.find((o) => o.id === selection.id && o.kind === 'path')
    : null

  const derivados = lvl.circuits.filter((c) => c.type !== 'retorno')
  const retornos = lvl.circuits.filter((c) => c.type === 'retorno')

  const handleAdd = () => {
    if (!name.trim()) return
    addCircuit(name.trim(), type, color)
    setName('')
    setColor(nextCircuitColor(lvl.circuits.length + 1))
  }

  const startEdit = (c: Circuit) => { setColorPickerId(null); setEditingId(c.id); setEditingValue(c.name) }
  const commitEdit = () => {
    if (editingId) renameCircuit(editingId, editingValue)
    setEditingId(null)
  }
  const cancelEdit = () => setEditingId(null)
  const toggleColorPicker = (id: string) => { setEditingId(null); setColorPickerId((cur) => cur === id ? null : id) }
  const setCircuitColorAndClose = (id: string, c: string) => { setCircuitColor(id, c); setColorPickerId(null) }

  const rowProps = {
    editingId, editingValue, onStartEdit: startEdit, onChangeEdit: setEditingValue, onCommitEdit: commitEdit, onCancelEdit: cancelEdit, onRemove: removeCircuit,
    colorPickerId, onToggleColorPicker: toggleColorPicker, onSetColor: setCircuitColorAndClose
  }

  return (
    // Este panel vive DENTRO del div de CanvasViewport.tsx que trae el
    // onPointerDown de selección/arrastre del lienzo (a diferencia de
    // PropertiesPanel/LayersPanel, que están fuera de ese div) — sin
    // stopPropagation, un clic sobre un checkbox de aquí también le
    // llegaba a ese handler, que hacía hit-test en esas coordenadas de
    // pantalla y seleccionaba/arrastraba lo que hubiera del lienzo debajo
    // del panel, como si el panel fuera transparente al clic (bug real,
    // reportado).
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute right-4 top-4 w-64 rounded-xl border border-[color:var(--hairline)] bg-[color:var(--panel-bg-solid)] backdrop-blur-xl p-3.5 shadow-[0_0_30px_rgba(0,0,0,0.25)] max-h-[calc(100%-2rem)] overflow-y-auto">
      <div className="font-mono-ui text-[10px] tracking-[0.1em] text-[var(--text-tertiary)] mb-2">CIRCUITOS DERIVADOS</div>

      {derivados.length === 0 && <div className="text-[11px] text-[var(--text-tertiary)] mb-2">Aún no hay circuitos definidos.</div>}
      <div className="flex flex-col gap-1.5 mb-3 max-h-32 overflow-y-auto">
        {derivados.map((c) => <CircuitRow key={c.id} circuit={c} {...rowProps} />)}
      </div>

      {/* "Retorno" no es un circuito derivado del tablero — es el
          conductor de ida y vuelta entre un apagador/timbre y lo que
          controla (ver types.ts) — por eso va en su propia lista, aparte
          de "Circuitos derivados", aunque comparta el mismo mecanismo de
          asignarse a un ducto (checklist de "DUCTO SELECCIONADO" más
          abajo). */}
      {retornos.length > 0 && (
        <>
          <div className="font-mono-ui text-[10px] tracking-[0.1em] text-[var(--text-tertiary)] mb-2">RETORNOS</div>
          <div className="flex flex-col gap-1.5 mb-3 max-h-32 overflow-y-auto">
            {retornos.map((c) => <CircuitRow key={c.id} circuit={c} {...rowProps} />)}
          </div>
        </>
      )}

      <div className="flex flex-col gap-1.5 mb-1">
        <input
          value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
          placeholder="Nombre del circuito"
          className="bg-[color:var(--glass-weak)] border border-[color:var(--hairline)] rounded-[8px] px-2.5 py-1.5 text-[11.5px] outline-none focus:border-cyan-400/50"
        />
        <div className="flex gap-1">
          {TYPE_DEFS.map((t) => (
            <button
              key={t.key} onClick={() => setType(t.key)}
              className="flex-1 rounded-[6px] py-1 text-[9px] font-mono-ui border"
              style={type === t.key ? { color: '#0a0a10', background: t.color, borderColor: 'transparent' } : { color: t.color, borderColor: `color-mix(in srgb, ${t.color} 30%, transparent)` }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {CIRCUIT_PALETTE.map((c) => (
            <button
              key={c} onClick={() => setColor(c)} title={c}
              className="w-[15px] h-[15px] rounded-full flex-none"
              style={{ background: c, boxShadow: circuitContourShadow(c, color === c ? '0 0 0 2px var(--text-primary)' : '0 0 0 1px color-mix(in srgb, var(--text-tertiary) 40%, transparent)') }}
            />
          ))}
        </div>
        <button
          onClick={handleAdd} className="rounded-[8px] py-1.5 text-[11px] font-semibold text-[#0a0a10]"
          style={{ background: color, boxShadow: circuitContourShadow(color) }}
        >
          + Agregar circuito
        </button>
      </div>

      {selectedDuct ? (
        <div className="mt-3 pt-3 border-t border-[color:var(--hairline)]">
          <div className="font-mono-ui text-[10px] tracking-[0.1em] text-[var(--text-tertiary)] mb-2">DUCTO SELECCIONADO</div>
          {lvl.circuits.length === 0 && <div className="text-[11px] text-[var(--text-tertiary)]">Crea un circuito para poder asignarlo.</div>}
          {derivados.length > 0 && (
            <div className="flex flex-col gap-1.5 mb-2">
              {derivados.map((c) => {
                const checked = selectedDuct.kind === 'path' && (selectedDuct.circuitIds ?? []).includes(c.id)
                return (
                  <label key={c.id} className="flex items-center gap-2 text-[11.5px] cursor-pointer">
                    <input type="checkbox" checked={checked} onChange={() => toggleCircuitOnDuct(selectedDuct.id, c.id)} className="accent-cyan-400" />
                    <div className="w-2 h-2 rounded-full flex-none" style={{ background: c.color, boxShadow: circuitContourShadow(c.color) }} />
                    <span>{c.name}</span>
                  </label>
                )
              })}
            </div>
          )}
          {retornos.length > 0 && (
            <>
              <div className="font-mono-ui text-[9px] tracking-[0.1em] text-[var(--text-tertiary)] mb-1.5">RETORNOS</div>
              <div className="flex flex-col gap-1.5">
                {retornos.map((c) => {
                  const checked = selectedDuct.kind === 'path' && (selectedDuct.circuitIds ?? []).includes(c.id)
                  return (
                    <label key={c.id} className="flex items-center gap-2 text-[11.5px] cursor-pointer">
                      <input type="checkbox" checked={checked} onChange={() => toggleCircuitOnDuct(selectedDuct.id, c.id)} className="accent-cyan-400" />
                      <div className="w-2 h-2 rounded-full flex-none" style={{ background: c.color, boxShadow: circuitContourShadow(c.color) }} />
                      <span>{c.name}</span>
                    </label>
                  )
                })}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="mt-3 pt-3 border-t border-[color:var(--hairline)] text-[11px] text-[var(--text-tertiary)]">
          Selecciona un ducto en el plano (herramienta "Seleccionar") para asignarle circuitos.
        </div>
      )}
    </div>
  )
}
