import { Fragment } from 'react'
import { useProjectStore, type DispositivoKey, type EquipoKey, type PipeDiameter, type PrincipalKey, type ToolKey } from '../store/useProjectStore'
import type { HidraulicaMaterial } from '../types'
import { DISPOSITIVO_DEFS, EQUIPO_DEFS, PIEZA_DEFS, PIEZA_HIDRAULICA_DEFS, PRINCIPAL_DEFS, type PiezaHidraulicaKey, type PiezaKey } from '../lib/stamps'

const TOOLS: { key: ToolKey; d: string; sep?: boolean }[] = [
  { key: 'select', d: 'M4 4 L4 18 L9 14 L12 20 L15 18.5 L12 12.5 L18 12.5 Z' },
  { key: 'wall', d: 'M4 18 L18 4 M4 12 L12 4 M12 18 L18 12' },
  { key: 'door', d: 'M6 20 V4 M6 20 A12 12 0 0 0 18 8' },
  { key: 'window', d: 'M4 9 H20 M4 15 H20 M4 5 V19 M20 5 V19' },
  { key: 'domo', d: 'M4 12 A8 8 0 1 1 20 12 A8 8 0 1 1 4 12 Z M6 6 L18 18 M18 6 L6 18' },
  { key: 'rectangulo', d: 'M4 6 H20 V18 H4 Z' },
  { key: 'cota', d: 'M4 6 V10 M20 6 V10 M4 8 H20 M4 8 L8 5 M4 8 L8 11 M20 8 L16 5 M20 8 L16 11' },
  { key: 'escalera', d: 'M4 20 V16 H8 V12 H12 V8 H16 V4 H20 M20 4 L16 4 M20 4 V8' },
  { key: 'pincel', d: 'M4 20 L7 19 L18 8 A2.1 2.1 0 0 0 15 5 L4 16 Z M15 5 L18 8', sep: true },
  { key: 'etiqueta', d: 'M4 6 H20 M4 6 V18 H20 V6 M8 10 H16 M8 14 H13' }
]

const DIAMETERS: PipeDiameter[] = ['2', '4']
const HIDRAULICA_DIAMETERS: ('1/2' | '3/4')[] = ['1/2', '3/4']
const HIDRAULICA_MATERIALES: { key: HidraulicaMaterial; label: string; title: string }[] = [
  { key: 'cobre', label: 'CU', title: 'Cobre' },
  { key: 'ppr', label: 'PPR', title: 'PPR' },
  { key: 'cpvc', label: 'CPVC', title: 'CPVC' },
  { key: 'manguera', label: 'MANG.', title: 'Manguera' }
]
const EQUIPO_KEYS = Object.keys(EQUIPO_DEFS) as EquipoKey[]
const DISPOSITIVO_KEYS = Object.keys(DISPOSITIVO_DEFS) as DispositivoKey[]
const PRINCIPAL_KEYS = Object.keys(PRINCIPAL_DEFS) as PrincipalKey[]
const PIEZA_KEYS = Object.keys(PIEZA_DEFS) as PiezaKey[]
const PIEZA_HIDRAULICA_KEYS = Object.keys(PIEZA_HIDRAULICA_DEFS) as PiezaHidraulicaKey[]
const DOOR_WIDTHS = [70, 80, 90, 100]
const WINDOW_WIDTHS = [50, 60, 70, 90]

function SectionDivider({ color, title }: { color: string; title: string }) {
  return (
    <>
      <div className="w-10 h-px bg-[color:var(--hairline)] my-1" />
      <div className="w-2 h-2 rounded-full mb-1" style={{ background: color, boxShadow: `0 0 6px ${color}` }} title={title} />
    </>
  )
}

function LayerToolButton({ active, color, title, onClick, children }: { active: boolean; color: string; title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick} title={title}
      className="w-[44px] h-[44px] rounded-[10px] flex items-center justify-center border"
      style={
        active
          ? { color: '#0a0a10', background: color, boxShadow: `0 0 14px color-mix(in srgb, ${color} 55%, transparent)`, borderColor: 'transparent' }
          : { color, background: `color-mix(in srgb, ${color} 8%, transparent)`, borderColor: `color-mix(in srgb, ${color} 30%, transparent)` }
      }
    >
      {children}
    </button>
  )
}

function MiniButton({ active, color, label, title, onClick }: { active: boolean; color: string; label: string; title: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick} title={title}
      className="w-full min-h-[24px] px-1.5 rounded-[7px] flex items-center justify-center font-mono-ui text-[10px] font-semibold border leading-tight text-center"
      style={active
        ? { color: '#0a0a10', background: color, borderColor: 'transparent' }
        : { color, background: 'transparent', borderColor: `color-mix(in srgb, ${color} 30%, transparent)` }}
    >
      {label}
    </button>
  )
}

export function Toolbar() {
  const {
    activeTool, setActiveTool,
    pipeDiameter, setPipeDiameter, drenajeFlujo, toggleDrenajeFlujo, selectedPieza, setSelectedPieza,
    waterType, setWaterType, hidraulicaDiameter, setHidraulicaDiameter, hidraulicaMaterial, setHidraulicaMaterial,
    hidraulicaFlujo, toggleHidraulicaFlujo, electricaFlujo, toggleElectricaFlujo,
    selectedEquipo, setSelectedEquipo, equipoRotation, rotateEquipo, selectedPiezaHidraulica, setSelectedPiezaHidraulica,
    selectedDispositivo, setSelectedDispositivo, selectedPrincipal, setSelectedPrincipal,
    doorWidth, setDoorWidth, windowWidth, setWindowWidth, doorHinge, setDoorHinge, doorFlip, toggleDoorFlip,
    electricaStage, setElectricaStage
  } = useProjectStore()

  return (
    <aside className="w-20 flex-none flex flex-col items-center py-3 px-2 gap-1.5 border-r border-[color:var(--hairline)] bg-[color:var(--panel-bg)] backdrop-blur-xl overflow-y-auto overflow-x-hidden">
      {TOOLS.map((t) => (
        <Fragment key={t.key}>
          {t.sep && <div className="w-8 h-px bg-[color:var(--hairline)] my-1" />}
          <button
            onClick={() => setActiveTool(t.key)}
            title={t.key}
            className={`w-[44px] h-[44px] rounded-[10px] flex items-center justify-center ${
              activeTool === t.key
                ? 'text-[#0a0a10] bg-gradient-to-br from-cyan-400 to-indigo-400 shadow-[0_0_14px_rgba(99,102,241,0.55)]'
                : 'text-[var(--text-secondary)]'
            }`}
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <path d={t.d} stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </Fragment>
      ))}

      {activeTool === 'door' && (
        <div className="flex flex-col gap-1 mt-0.5 items-center">
          <div className="grid grid-cols-2 gap-1">
            {DOOR_WIDTHS.map((w) => <MiniButton key={w} active={doorWidth === w} color="#22d3ee" label={`${w}`} title={`Ancho ${w} cm`} onClick={() => setDoorWidth(w)} />)}
          </div>
          <div className="flex gap-1">
            <MiniButton active={doorHinge === 'start'} color="#22d3ee" label="◧" title="Bisagra al inicio" onClick={() => setDoorHinge('start')} />
            <MiniButton active={doorHinge === 'end'} color="#22d3ee" label="◨" title="Bisagra al final" onClick={() => setDoorHinge('end')} />
          </div>
          <MiniButton active={doorFlip} color="#22d3ee" label="Voltear" title="Voltear hacia dónde abre" onClick={toggleDoorFlip} />
        </div>
      )}
      {activeTool === 'window' && (
        <div className="grid grid-cols-2 gap-1 mt-0.5">
          {WINDOW_WIDTHS.map((w) => <MiniButton key={w} active={windowWidth === w} color="#22d3ee" label={`${w}`} title={`Ancho ${w} cm`} onClick={() => setWindowWidth(w)} />)}
        </div>
      )}

      {/* Drenaje */}
      <SectionDivider color="var(--layer-drenaje)" title="Herramientas de la capa Drenaje" />
      <LayerToolButton active={activeTool === 'drenajeTuberia'} color="var(--layer-drenaje)" title="Tubería de drenaje" onClick={() => setActiveTool('drenajeTuberia')}>
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none"><path d="M4 6 H12 V18 H20 M9 6 L12 6 L12 9" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" /></svg>
      </LayerToolButton>
      <LayerToolButton active={activeTool === 'drenajePieza'} color="var(--layer-drenaje)" title="Pieza / conexión (codo, tee, Y, reducción)" onClick={() => setActiveTool('drenajePieza')}>
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth={1.7} /></svg>
      </LayerToolButton>
      {activeTool === 'drenajeTuberia' && (
        <div className="flex flex-col gap-1 mt-0.5">
          {DIAMETERS.map((d) => <MiniButton key={d} active={pipeDiameter === d} color="var(--layer-drenaje)" label={`${d}"`} title={`Diámetro ${d}"`} onClick={() => setPipeDiameter(d)} />)}
          <MiniButton active={drenajeFlujo} color="var(--layer-drenaje)" label="FLUJO" title="Animar dirección de flujo (sigue el sentido en que dibujas: primer clic = origen)" onClick={toggleDrenajeFlujo} />
        </div>
      )}
      {activeTool === 'drenajePieza' && (
        <div className="flex flex-col gap-1 mt-0.5">
          {PIEZA_KEYS.map((k) => <MiniButton key={k} active={selectedPieza === k} color="var(--fitting-hl)" label={PIEZA_DEFS[k].short} title={PIEZA_DEFS[k].label} onClick={() => setSelectedPieza(k)} />)}
        </div>
      )}

      {/* Hidráulica */}
      <SectionDivider color="var(--layer-hidraulica)" title="Herramientas de la capa Hidráulica" />
      <LayerToolButton active={activeTool === 'hidraulicaTuberia'} color="var(--layer-hidraulica)" title="Tubería hidráulica" onClick={() => setActiveTool('hidraulicaTuberia')}>
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none"><path d="M4 6 H12 V18 H20 M9 6 L12 6 L12 9" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" /></svg>
      </LayerToolButton>
      <LayerToolButton active={activeTool === 'hidraulicaPieza'} color="var(--layer-hidraulica)" title="Codo / tee / llave de paso / toma municipal" onClick={() => setActiveTool('hidraulicaPieza')}>
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth={1.7} /><path d="M9 12 H15" stroke="currentColor" strokeWidth={1.4} /></svg>
      </LayerToolButton>
      <LayerToolButton active={activeTool === 'hidraulicaEquipo'} color="var(--layer-hidraulica)" title="Equipo (tinaco, calentador, bomba…)" onClick={() => setActiveTool('hidraulicaEquipo')}>
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none"><rect x="5" y="6" width="14" height="12" rx="1.5" stroke="currentColor" strokeWidth={1.7} /></svg>
      </LayerToolButton>
      <LayerToolButton active={activeTool === 'hidraulicaPresion'} color="var(--layer-hidraulica)" title="Anotar presión (PSI) en un punto de la tubería" onClick={() => setActiveTool('hidraulicaPresion')}>
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="13" r="8" stroke="currentColor" strokeWidth={1.7} /><path d="M12 13 L16 9" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" /><path d="M9 3 H15" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" /></svg>
      </LayerToolButton>
      {activeTool === 'hidraulicaTuberia' && (
        <div className="flex flex-col gap-1 mt-0.5">
          {(['fria', 'caliente'] as const).map((w) => (
            <MiniButton key={w} active={waterType === w} color={w === 'fria' ? 'var(--pipe-fria)' : 'var(--pipe-caliente)'} label={w === 'fria' ? 'FRÍA' : 'CAL.'} title={w === 'fria' ? 'Agua fría' : 'Agua caliente'} onClick={() => setWaterType(w)} />
          ))}
          {HIDRAULICA_DIAMETERS.map((d) => <MiniButton key={d} active={hidraulicaDiameter === d} color="var(--layer-hidraulica)" label={`${d}"`} title={`Diámetro ${d}"`} onClick={() => setHidraulicaDiameter(d)} />)}
          {HIDRAULICA_MATERIALES.map((m) => <MiniButton key={m.key} active={hidraulicaMaterial === m.key} color="var(--layer-hidraulica)" label={m.label} title={`Material: ${m.title}`} onClick={() => setHidraulicaMaterial(m.key)} />)}
          <MiniButton active={hidraulicaFlujo} color="var(--layer-hidraulica)" label="FLUJO" title="Animar dirección de flujo (sigue el sentido en que dibujas: primer clic = origen)" onClick={toggleHidraulicaFlujo} />
        </div>
      )}
      {activeTool === 'hidraulicaPieza' && (
        <div className="flex flex-col gap-1 mt-0.5">
          {(['fria', 'caliente'] as const).map((w) => (
            <MiniButton key={w} active={waterType === w} color={w === 'fria' ? 'var(--pipe-fria)' : 'var(--pipe-caliente)'} label={w === 'fria' ? 'FRÍA' : 'CAL.'} title={w === 'fria' ? 'Colorear como línea fría' : 'Colorear como línea caliente'} onClick={() => setWaterType(w)} />
          ))}
          {PIEZA_HIDRAULICA_KEYS.map((k) => (
            <MiniButton
              key={k} active={selectedPiezaHidraulica === k}
              color={k === 'toma' ? 'var(--pipe-fria)' : (waterType === 'fria' ? 'var(--pipe-fria)' : 'var(--pipe-caliente)')}
              label={PIEZA_HIDRAULICA_DEFS[k].short} title={PIEZA_HIDRAULICA_DEFS[k].label} onClick={() => setSelectedPiezaHidraulica(k)}
            />
          ))}
        </div>
      )}
      {activeTool === 'hidraulicaEquipo' && (
        <div className="flex flex-col gap-1 mt-0.5">
          {EQUIPO_KEYS.map((k) => <MiniButton key={k} active={selectedEquipo === k} color="var(--layer-hidraulica)" label={EQUIPO_DEFS[k].short} title={EQUIPO_DEFS[k].label} onClick={() => setSelectedEquipo(k)} />)}
          <button
            onClick={rotateEquipo} title="Rotar 90° (tecla R)"
            className="w-full min-h-[24px] px-1.5 rounded-[7px] flex items-center justify-center font-mono-ui text-[10px] font-semibold border mt-0.5"
            style={{ color: 'var(--layer-hidraulica)', borderColor: 'color-mix(in srgb, var(--layer-hidraulica) 30%, transparent)' }}
          >
            ⟳ {equipoRotation}°
          </button>
        </div>
      )}

      {/* Eléctrica */}
      <SectionDivider color="var(--layer-electrica)" title="Herramientas de la capa Eléctrica" />
      <div className="flex flex-col gap-1">
        <MiniButton active={electricaStage === 'trazado'} color="var(--layer-electrica)" label="TRAZADO" title="Etapa 1: trazado físico" onClick={() => setElectricaStage('trazado')} />
        <MiniButton active={electricaStage === 'cableado'} color="var(--layer-electrica)" label="CABLEADO" title="Etapa 2: asignar circuitos a los ductos" onClick={() => setElectricaStage('cableado')} />
      </div>
      {electricaStage === 'trazado' ? (
        <>
          <LayerToolButton active={activeTool === 'electricaTablero'} color="var(--layer-electrica)" title="Tablero / acometida / tierra" onClick={() => setActiveTool('electricaTablero')}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none"><rect x="6" y="4" width="12" height="16" rx="1.5" stroke="currentColor" strokeWidth={1.7} /><path d="M9 8 H15 M9 12 H15 M9 16 H15" stroke="currentColor" strokeWidth={1.4} /></svg>
          </LayerToolButton>
          {activeTool === 'electricaTablero' && (
            <div className="flex flex-col gap-1 mt-0.5">
              {PRINCIPAL_KEYS.map((k) => <MiniButton key={k} active={selectedPrincipal === k} color="var(--layer-electrica)" label={PRINCIPAL_DEFS[k].short} title={PRINCIPAL_DEFS[k].label} onClick={() => setSelectedPrincipal(k)} />)}
            </div>
          )}
          <LayerToolButton active={activeTool === 'electricaDucto'} color="var(--layer-electrica)" title="Ducto eléctrico (techo o bajada por muro)" onClick={() => setActiveTool('electricaDucto')}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none"><path d="M4 6 H12 V18 H20" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeDasharray="3 2" /></svg>
          </LayerToolButton>
          {activeTool === 'electricaDucto' && (
            <div className="flex flex-col gap-1 mt-0.5">
              <MiniButton active={electricaFlujo} color="var(--layer-electrica)" label="FLUJO" title="Animar dirección del cableado (sigue el sentido en que dibujas: primer clic = origen)" onClick={toggleElectricaFlujo} />
            </div>
          )}
          <LayerToolButton active={activeTool === 'electricaDispositivo'} color="var(--layer-electrica)" title="Contacto / apagador / lámpara" onClick={() => setActiveTool('electricaDispositivo')}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth={1.7} /></svg>
          </LayerToolButton>
          {activeTool === 'electricaDispositivo' && (
            <div className="flex flex-col gap-1 mt-0.5">
              {DISPOSITIVO_KEYS.map((k) => <MiniButton key={k} active={selectedDispositivo === k} color={DISPOSITIVO_DEFS[k].color} label={DISPOSITIVO_DEFS[k].short} title={DISPOSITIVO_DEFS[k].label} onClick={() => setSelectedDispositivo(k)} />)}
            </div>
          )}
        </>
      ) : (
        <div className="text-[10px] text-center px-1 leading-snug" style={{ color: 'var(--layer-electrica)' }}>
          Usa "Seleccionar" y haz clic en un ducto para asignarle circuitos →
        </div>
      )}
    </aside>
  )
}
