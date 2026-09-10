export type LayerKey = 'base' | 'drenaje' | 'hidraulica' | 'electrica'
/** Id de un nivel dentro del proyecto — ya no es un enum fijo: los niveles
 *  son una lista dinámica (empieza en 1, se agregan los que hagan falta). */
export type LevelKey = string

export interface LayerState {
  visible: boolean
  locked: boolean
  opacity: number // 0-100
}

export type LayerStateMap = Record<LayerKey, LayerState>

export type SymbolShape =
  | 'tinaco' | 'cisterna' | 'calentadorPaso' | 'calentadorSolar' | 'bombaPresurizadora' | 'bombaLlenado'
  | 'contacto' | 'contactoDoble' | 'contactoApagador' | 'salida220' | 'salidaClima' | 'salidaDatos'
  | 'apagador' | 'apagador3vias' | 'lampara' | 'timbre'
  | 'tablero' | 'acometida' | 'tierra' | 'tapaCiega' | 'fotocelda' | 'registroElectrico'
  | 'codo' | 'codo45' | 'tee' | 'y' | 'reduccion' | 'coladera' | 'registro' | 'salidaCalle' | 'ventila' | 'trampa' | 'bajante'
  | 'llave' | 'llaveNariz' | 'toma' | 'checkValve' | 'conector' | 'tuercaUnion' | 'medidor' | 'filtro'
  | 'escalera'

/** 'retorno' es distinto de los otros tres: no es un circuito derivado del
 *  tablero, es el conductor de ida y vuelta entre un apagador/timbre y lo
 *  que controla (una lámpara, el timbre mismo) — convención real de plano
 *  eléctrico, se dibuja/organiza aparte aunque comparta el mismo mecanismo
 *  de asignar-a-un-ducto que los circuitos derivados (ver CircuitsPanel.tsx,
 *  que lo separa en su propia sección "Retornos"). */
export type CircuitType = 'contactos' | 'iluminacion' | 'fuerza' | 'retorno'
export type HidraulicaMaterial = 'cobre' | 'ppr' | 'cpvc' | 'manguera'

export interface Circuit {
  id: string
  name: string
  type: CircuitType
  /** Color elegido por el usuario de una paleta (ver `src/lib/circuitColors.ts`)
   *  — pinta el ducto en `PlanCanvas.tsx` cuando el circuito queda asignado,
   *  independiente del color fijo por `type`. */
  color: string
}

/**
 * A drawable primitive tagged with enough intent (kind) to render correctly
 * and, later, to be queried for quantification / connectivity. This is a
 * pragmatic v1 model — walls/openings are explicit geometry rather than a
 * fully parametric wall system, and pipe/duct "graphs" are not yet modeled
 * as connectable networks. Both are natural next steps once this scaffold
 * is running against the real repo.
 *
 * 'symbol' is the generic, reusable placeholder for anything that should be
 * selectable/rotatable after being placed (equipment, devices, fittings) —
 * its actual geometry is looked up by `shape` at render time (see
 * src/lib/symbols.tsx) rather than baked into absolute coordinates, which is
 * what makes post-placement rotation possible.
 */
export type DrawObject =
  | { id: string; kind: 'wall'; x1: number; y1: number; x2: number; y2: number; thickness: number }
  | { id: string; kind: 'doorArc'; hingeX: number; hingeY: number; leafX: number; leafY: number; sweep: string }
  | { id: string; kind: 'window'; x: number; y: number; w: number; h: number; angle?: number }
  | { id: string; kind: 'dome'; x: number; y: number; w: number; h: number; label?: string }
  | { id: string; kind: 'path'; d: string; stroke: string; strokeWidth: number; dashed?: boolean; animated?: boolean; filled?: boolean; circuitIds?: string[]; material?: HidraulicaMaterial; groupId?: string }
  | { id: string; kind: 'circle'; cx: number; cy: number; r: number; stroke: string; fill?: string }
  | { id: string; kind: 'rect'; x: number; y: number; w: number; h: number; stroke: string; fill?: string; dashed?: boolean }
  | { id: string; kind: 'text'; x: number; y: number; text: string; color: string; size?: number; anchor?: 'start' | 'middle' | 'end'; groupId?: string }
  | { id: string; kind: 'symbol'; shape: SymbolShape; x: number; y: number; rotation: number; color: string; label?: string; scale?: number }

export interface CanvasBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export const DEFAULT_CANVAS_BOUNDS: CanvasBounds = { minX: 0, minY: 0, maxX: 1600, maxY: 1100 }

export interface Level {
  key: LevelKey
  label: string
  layers: Record<LayerKey, DrawObject[]>
  circuits: Circuit[]
  bounds?: CanvasBounds
}

export interface Project {
  id: string
  name: string
  scaleLabel: string
  levels: Level[]
  createdAt: number
  updatedAt: number
}
