import { create } from 'zustand'
import { makeBlankLevel } from '../data/seedProject'
import { shiftPathData } from '../lib/hitTest'
import type { CanvasBounds, Circuit, CircuitType, DrawObject, HidraulicaMaterial, LayerKey, LayerStateMap, LevelKey, Project } from '../types'
import { DEFAULT_CANVAS_BOUNDS } from '../types'
import type { PiezaHidraulicaKey, PiezaKey } from '../lib/stamps'

export type ToolKey =
  | 'select' | 'wall' | 'door' | 'window' | 'domo' | 'rectangulo' | 'cota' | 'pincel' | 'etiqueta' | 'escalera'
  | 'drenajeTuberia' | 'drenajePieza'
  | 'hidraulicaTuberia' | 'hidraulicaEquipo' | 'hidraulicaPieza' | 'hidraulicaPresion'
  | 'electricaDucto' | 'electricaTablero' | 'electricaDispositivo'
export type SyncState = 'local' | 'loading' | 'synced' | 'saving' | 'error'
export type ViewKey = 'projects' | 'editor'
export type PipeDiameter = '2' | '4'
export type WaterType = 'fria' | 'caliente'
export type HidraulicaDiameter = '1/2' | '3/4'
export type EquipoKey = 'calentadorPaso' | 'calentadorSolar' | 'bombaPresurizadora' | 'bombaLlenado' | 'cisterna' | 'tinaco'
export type DispositivoKey =
  | 'contacto' | 'contactoDoble' | 'contactoApagador' | 'salida220' | 'salidaClima' | 'salidaDatos'
  | 'apagador' | 'apagador3vias' | 'lampara' | 'timbre' | 'tapaCiega' | 'fotocelda' | 'registroElectrico'
export type PrincipalKey = 'tablero' | 'acometida' | 'tierra'
export type DoorHinge = 'start' | 'end'
export type ElectricaStage = 'trazado' | 'cableado'

interface Selection {
  layer: LayerKey
  id: string
}

/** Selección múltiple (Shift+clic) — vive aparte de `selection` a
 *  propósito: `selection` sigue siendo "el objeto principal" (el que usan
 *  las manijas de estirar y el panel de propiedades, que no tiene sentido
 *  mostrar para varios objetos de tipos distintos a la vez), mientras que
 *  `multiSelection` es el conjunto que se mueve/borra junto cuando hay más
 *  de uno. Así ningún código existente que ya asume una sola selección
 *  tuvo que tocarse. */
interface MultiSelection {
  layer: LayerKey
  ids: string[]
}

const MAX_HISTORY = 60
const ROTATABLE_KINDS = new Set(['symbol'])

interface ProjectStoreState {
  view: ViewKey
  project: Project | null
  level: LevelKey
  activeTool: ToolKey
  showGhost: boolean
  showRoomAreas: boolean
  showExportModal: boolean
  /** Confirmación discreta para acciones puntuales (exportar, restaurar
   *  respaldo…) — no para el autoguardado continuo, que ya tiene su
   *  propio punto de estado en el TopBar y sería demasiado ruido como
   *  toast en cada edición. `key` cambia en cada `pushToast` (aunque el
   *  mensaje se repita) para que el temporizador de auto-cierre siempre
   *  reinicie. */
  toast: { message: string; key: number } | null
  layerState: LayerStateMap
  exportChecks: Record<LayerKey, boolean>
  syncState: SyncState
  past: Project[]
  future: Project[]
  /** Paso del imán a la cuadrícula al dibujar (1 unidad ≈ 1 cm) — 10 por
   *  defecto, 1 para trazos finos. También rige el paso de las flechas del
   *  teclado sobre un objeto seleccionado. */
  gridSnap: number
  pipeDiameter: PipeDiameter
  drenajeFlujo: boolean
  layersPanelCollapsed: boolean
  waterType: WaterType
  hidraulicaDiameter: HidraulicaDiameter
  hidraulicaMaterial: HidraulicaMaterial
  hidraulicaFlujo: boolean
  electricaFlujo: boolean
  selectedEquipo: EquipoKey
  selectedDispositivo: DispositivoKey
  selectedPrincipal: PrincipalKey
  selectedPieza: PiezaKey
  selectedPiezaHidraulica: PiezaHidraulicaKey
  doorWidth: number
  windowWidth: number
  doorHinge: DoorHinge
  doorFlip: boolean
  equipoRotation: number
  selection: Selection | null
  multiSelection: MultiSelection | null
  electricaStage: ElectricaStage
  /** true en viewport móvil (ver `src/lib/useIsMobile.ts`, sincronizado
   *  desde `App.tsx`) — el editor completo no cabe/no tiene sentido táctil
   *  en pantalla chica, así que ahí se entra solo en modo visualización: sin
   *  Toolbar/LayersPanel/CircuitsPanel, sin seleccionar ni arrastrar objetos
   *  en el lienzo (`CanvasViewport.tsx` cae directo a paneo), solo pan/zoom.
   *  No es responsabilidad del store decidir cuándo es "móvil" — solo
   *  reacciona a lo que `setViewOnly` le diga. */
  viewOnly: boolean
  /** Muestra/oculta, en `PlanCanvas.tsx`, los hilos de color + etiqueta de
   *  cada circuito asignado a un ducto — antes salían solo durante la
   *  etapa "Cableado" (o siempre en `viewOnly`), sin forma de apagarlos a
   *  propósito ni de verlos en otra etapa; ahora es un toggle aparte
   *  (ícono de ojo extra en `LayersPanel.tsx`, fila de Eléctrica),
   *  independiente de `electricaStage`. `exportPdf.tsx` también lo pisa
   *  temporalmente para poder exportar la página eléctrica con y sin
   *  cableado. */
  showCircuitWiring: boolean
  /** Con los hilos de color visibles (`showCircuitWiring`), esto decide si
   *  además se dibuja el nombre de cada circuito sobre su hilo — separado
   *  para poder exportar el PDF con los hilos pero sin las etiquetas
   *  (ver ExportModal.tsx, "Incluir etiquetas de nombre"), que en un
   *  ducto con varios circuitos cortos puede verse más limpio. Solo lo
   *  pisa exportPdf.tsx por página, no tiene ícono propio en
   *  LayersPanel.tsx (a diferencia de showCircuitWiring). */
  showCircuitLabels: boolean

  setViewOnly: (v: boolean) => void
  toggleShowCircuitWiring: () => void
  setShowCircuitWiring: (v: boolean) => void
  setShowCircuitLabels: (v: boolean) => void
  setPipeDiameter: (d: PipeDiameter) => void
  toggleDrenajeFlujo: () => void
  setWaterType: (w: WaterType) => void
  setHidraulicaDiameter: (d: HidraulicaDiameter) => void
  setHidraulicaMaterial: (m: HidraulicaMaterial) => void
  toggleHidraulicaFlujo: () => void
  toggleElectricaFlujo: () => void
  setSelectedEquipo: (e: EquipoKey) => void
  setSelectedDispositivo: (d: DispositivoKey) => void
  setSelectedPrincipal: (p: PrincipalKey) => void
  setSelectedPieza: (p: PiezaKey) => void
  setSelectedPiezaHidraulica: (p: PiezaHidraulicaKey) => void
  setDoorWidth: (w: number) => void
  setWindowWidth: (w: number) => void
  setDoorHinge: (h: DoorHinge) => void
  toggleDoorFlip: () => void
  rotateEquipo: () => void
  toggleLayersPanelCollapsed: () => void
  openProject: (project: Project) => void
  closeProject: () => void
  setProject: (project: Project) => void
  setSyncState: (s: SyncState) => void
  setLevel: (level: LevelKey) => void
  addLevel: (label?: string) => void
  renameLevel: (key: LevelKey, label: string) => void
  removeLevel: (key: LevelKey) => void
  resizeCanvas: (side: 'top' | 'bottom' | 'left' | 'right', deltaUnits: number) => void
  setActiveTool: (tool: ToolKey) => void
  toggleGhost: () => void
  toggleRoomAreas: () => void
  toggleGridSnap: () => void
  toggleLayerVisible: (key: LayerKey) => void
  toggleLayerLock: (key: LayerKey) => void
  setLayerOpacity: (key: LayerKey, value: number) => void
  openExport: () => void
  pushToast: (message: string) => void
  closeExport: () => void
  toggleExportCheck: (key: LayerKey) => void
  /** Generic mutation entry point for the current level's layer objects — every
   *  editing tool (wall, door, window, …) goes through this so undo/redo stays
   *  consistent without each tool having to manage history itself. */
  applyEdit: (layerKey: LayerKey, updater: (objs: DrawObject[]) => DrawObject[]) => void
  addObject: (layerKey: LayerKey, obj: DrawObject) => void
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean

  select: (layer: LayerKey, id: string) => void
  clearSelection: () => void
  toggleMultiSelect: (layer: LayerKey, id: string) => void
  deleteMultiSelection: () => void
  nudgeMultiSelection: (dx: number, dy: number) => void
  rotateMultiSelection: () => void
  duplicateMultiSelection: () => void
  deleteSelected: () => void
  duplicateSelected: () => void
  rotateSelected: () => void
  nudgeSelected: (dx: number, dy: number) => void
  setHandlePoint: (objId: string, layer: LayerKey, handleId: string, x: number, y: number) => void

  setElectricaStage: (s: ElectricaStage) => void
  addCircuit: (name: string, type: CircuitType, color: string) => void
  renameCircuit: (id: string, name: string) => void
  setCircuitColor: (id: string, color: string) => void
  removeCircuit: (id: string) => void
  toggleCircuitOnDuct: (objId: string, circuitId: string) => void
}

const defaultLayerState: LayerStateMap = {
  base: { visible: true, locked: false, opacity: 100 },
  drenaje: { visible: true, locked: false, opacity: 100 },
  hidraulica: { visible: true, locked: false, opacity: 100 },
  electrica: { visible: true, locked: false, opacity: 100 }
}

const defaultExportChecks: Record<LayerKey, boolean> = { base: true, drenaje: true, hidraulica: true, electrica: true }

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

const DUP_OFFSET = 24

/** Clona un objeto con un id nuevo, desplazado para que no quede
 *  exactamente encima del original. `text`/`path` quitan la llave
 *  `groupId` del clon por completo, vía destructuring (para no encadenarlo
 *  al par de una cota) — asignarle `undefined` en vez de quitarla dejaba
 *  la llave presente con ese valor, y Firestore rechaza `setDoc()` con
 *  cualquier campo `undefined` en el documento (bug real: duplicar el
 *  texto o la línea de una cota rompía el autoguardado en cuanto había
 *  Firebase real de por medio, aunque en modo local nunca se notaba
 *  porque `JSON.stringify` de por sí descarta esas llaves). Los demás
 *  tipos ni siquiera tienen ese campo, así que no hace falta tocarlos.
 *  `doorArc` regresa `null` — su geometría (hinge/leaf + el radio y el
 *  punto final metidos en `sweep`) no encaja en el desplazamiento
 *  genérico, y además una puerta duplicada sin el hueco real en un muro
 *  no tiene mucho sentido por sí sola. */
function duplicateObject(original: DrawObject): DrawObject | null {
  const id = newId(`${original.kind}-dup`)
  if (original.kind === 'doorArc') return null
  if (original.kind === 'symbol') return { ...original, id, x: original.x + DUP_OFFSET, y: original.y + DUP_OFFSET }
  if (original.kind === 'circle') return { ...original, id, cx: original.cx + DUP_OFFSET, cy: original.cy + DUP_OFFSET }
  if (original.kind === 'wall') return { ...original, id, x1: original.x1 + DUP_OFFSET, y1: original.y1 + DUP_OFFSET, x2: original.x2 + DUP_OFFSET, y2: original.y2 + DUP_OFFSET }
  if (original.kind === 'dome') return { ...original, id, x: original.x + DUP_OFFSET, y: original.y + DUP_OFFSET }
  if (original.kind === 'text') {
    const { groupId: _groupId, ...rest } = original
    return { ...rest, id, x: original.x + DUP_OFFSET, y: original.y + DUP_OFFSET }
  }
  if (original.kind === 'window') return { ...original, id, x: original.x + DUP_OFFSET, y: original.y + DUP_OFFSET }
  if (original.kind === 'rect') return { ...original, id, x: original.x + DUP_OFFSET, y: original.y + DUP_OFFSET }
  const { groupId: _groupId, ...restPath } = original
  return { ...restPath, id, d: shiftPathData(original.d, DUP_OFFSET, DUP_OFFSET) }
}

export const useProjectStore = create<ProjectStoreState>((set, get) => ({
  view: 'projects',
  project: null,
  level: '',
  activeTool: 'select',
  showGhost: false,
  showRoomAreas: true,
  showExportModal: false,
  toast: null,
  layerState: defaultLayerState,
  exportChecks: defaultExportChecks,
  syncState: 'local',
  past: [],
  future: [],
  gridSnap: 10,
  pipeDiameter: '2',
  drenajeFlujo: true,
  layersPanelCollapsed: false,
  waterType: 'fria',
  hidraulicaDiameter: '1/2',
  hidraulicaMaterial: 'cpvc',
  hidraulicaFlujo: true,
  electricaFlujo: true,
  selectedEquipo: 'tinaco',
  selectedDispositivo: 'contacto',
  selectedPrincipal: 'tablero',
  selectedPieza: 'codo',
  selectedPiezaHidraulica: 'codo',
  doorWidth: 80,
  windowWidth: 70,
  doorHinge: 'start',
  doorFlip: false,
  equipoRotation: 0,
  selection: null,
  multiSelection: null,
  electricaStage: 'trazado',
  viewOnly: false,
  showCircuitWiring: true,
  showCircuitLabels: true,

  setViewOnly: (v) => set({ viewOnly: v }),
  toggleShowCircuitWiring: () => set((s) => ({ showCircuitWiring: !s.showCircuitWiring })),
  setShowCircuitWiring: (v) => set({ showCircuitWiring: v }),
  setShowCircuitLabels: (v) => set({ showCircuitLabels: v }),
  setPipeDiameter: (d) => set({ pipeDiameter: d }),
  toggleDrenajeFlujo: () => set((s) => ({ drenajeFlujo: !s.drenajeFlujo })),
  setWaterType: (w) => set({ waterType: w }),
  setHidraulicaDiameter: (d) => set({ hidraulicaDiameter: d }),
  setHidraulicaMaterial: (m) => set({ hidraulicaMaterial: m }),
  toggleHidraulicaFlujo: () => set((s) => ({ hidraulicaFlujo: !s.hidraulicaFlujo })),
  toggleElectricaFlujo: () => set((s) => ({ electricaFlujo: !s.electricaFlujo })),
  setSelectedEquipo: (e) => set({ selectedEquipo: e }),
  setSelectedDispositivo: (d) => set({ selectedDispositivo: d }),
  setSelectedPrincipal: (p) => set({ selectedPrincipal: p }),
  setSelectedPieza: (p) => set({ selectedPieza: p }),
  setSelectedPiezaHidraulica: (p) => set({ selectedPiezaHidraulica: p }),
  setDoorWidth: (w) => set({ doorWidth: w }),
  setWindowWidth: (w) => set({ windowWidth: w }),
  setDoorHinge: (h) => set({ doorHinge: h }),
  toggleDoorFlip: () => set((s) => ({ doorFlip: !s.doorFlip })),
  rotateEquipo: () => set((s) => ({ equipoRotation: (s.equipoRotation + 90) % 360 })),
  toggleLayersPanelCollapsed: () => set((s) => ({ layersPanelCollapsed: !s.layersPanelCollapsed })),
  openProject: (project) => set({
    project, view: 'editor', level: project.levels[0]?.key ?? '', activeTool: 'select', showGhost: false, showRoomAreas: true,
    showExportModal: false, layerState: defaultLayerState, exportChecks: defaultExportChecks,
    past: [], future: [], selection: null, multiSelection: null, electricaStage: 'trazado'
  }),
  closeProject: () => set({ project: null, view: 'projects', past: [], future: [], selection: null, multiSelection: null }),
  setProject: (project) => set({ project }),
  setSyncState: (syncState) => set({ syncState }),
  setLevel: (level) => set({ level, showGhost: false, selection: null, multiSelection: null }),
  addLevel: (label) => set((s) => {
    if (!s.project) return s
    const n = s.project.levels.length + 1
    const key = `level-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const newLevel = makeBlankLevel(key, label && label.trim() ? label.trim().toUpperCase() : `PISO ${n}`)
    return {
      project: { ...s.project, levels: [...s.project.levels, newLevel], updatedAt: Date.now() },
      level: key, showGhost: false, selection: null, multiSelection: null
    }
  }),
  renameLevel: (key, label) => set((s) => {
    if (!s.project || !label.trim()) return s
    const levels = s.project.levels.map((lvl) => (lvl.key === key ? { ...lvl, label: label.trim().toUpperCase() } : lvl))
    return { project: { ...s.project, levels, updatedAt: Date.now() } }
  }),
  removeLevel: (key) => set((s) => {
    if (!s.project || s.project.levels.length <= 1) return s
    const levels = s.project.levels.filter((lvl) => lvl.key !== key)
    const level = s.level === key ? levels[0].key : s.level
    return { project: { ...s.project, levels, updatedAt: Date.now() }, level, selection: null, multiSelection: null }
  }),
  resizeCanvas: (side, deltaUnits) => set((s) => {
    if (!s.project) return s
    const MIN_DIM = 200
    const levels = s.project.levels.map((lvl) => {
      if (lvl.key !== s.level) return lvl
      const b: CanvasBounds = lvl.bounds ?? DEFAULT_CANVAS_BOUNDS
      const next = { ...b }
      if (side === 'left') next.minX = Math.min(b.maxX - MIN_DIM, b.minX - deltaUnits)
      if (side === 'right') next.maxX = Math.max(b.minX + MIN_DIM, b.maxX + deltaUnits)
      if (side === 'top') next.minY = Math.min(b.maxY - MIN_DIM, b.minY - deltaUnits)
      if (side === 'bottom') next.maxY = Math.max(b.minY + MIN_DIM, b.maxY + deltaUnits)
      return { ...lvl, bounds: next }
    })
    return { project: { ...s.project, levels, updatedAt: Date.now() } }
  }),
  setActiveTool: (tool) => set({ activeTool: tool, selection: null, multiSelection: null }),
  toggleGhost: () => set((s) => ({ showGhost: !s.showGhost })),
  toggleRoomAreas: () => set((s) => ({ showRoomAreas: !s.showRoomAreas })),
  toggleGridSnap: () => set((s) => ({ gridSnap: s.gridSnap === 10 ? 1 : 10 })),
  toggleLayerVisible: (key) => set((s) => ({
    layerState: { ...s.layerState, [key]: { ...s.layerState[key], visible: !s.layerState[key].visible } }
  })),
  toggleLayerLock: (key) => set((s) => ({
    layerState: { ...s.layerState, [key]: { ...s.layerState[key], locked: !s.layerState[key].locked } }
  })),
  setLayerOpacity: (key, value) => set((s) => ({
    layerState: { ...s.layerState, [key]: { ...s.layerState[key], opacity: value } }
  })),
  openExport: () => set({ showExportModal: true }),
  pushToast: (message) => set({ toast: { message, key: Date.now() } }),
  closeExport: () => set({ showExportModal: false }),
  toggleExportCheck: (key) => set((s) => ({ exportChecks: { ...s.exportChecks, [key]: !s.exportChecks[key] } })),

  applyEdit: (layerKey, updater) => set((s) => {
    if (!s.project) return s
    const levels = s.project.levels.map((lvl) =>
      lvl.key === s.level
        ? { ...lvl, layers: { ...lvl.layers, [layerKey]: updater(lvl.layers[layerKey]) } }
        : lvl
    )
    const nextProject = { ...s.project, levels, updatedAt: Date.now() }
    return { project: nextProject, past: [...s.past, s.project].slice(-MAX_HISTORY), future: [] }
  }),
  addObject: (layerKey, obj) => get().applyEdit(layerKey, (objs) => [...objs, obj]),

  undo: () => set((s) => {
    if (s.past.length === 0 || !s.project) return s
    const prev = s.past[s.past.length - 1]
    return { project: prev, past: s.past.slice(0, -1), future: [s.project, ...s.future].slice(0, MAX_HISTORY), selection: null, multiSelection: null }
  }),
  redo: () => set((s) => {
    if (s.future.length === 0 || !s.project) return s
    const next = s.future[0]
    return { project: next, past: [...s.past, s.project].slice(-MAX_HISTORY), future: s.future.slice(1), selection: null, multiSelection: null }
  }),
  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  select: (layer, id) => set({ selection: { layer, id }, multiSelection: null }),
  clearSelection: () => set({ selection: null, multiSelection: null }),
  toggleMultiSelect: (layer, id) => set((s) => {
    if (!s.multiSelection || s.multiSelection.layer !== layer) {
      const base = s.selection && s.selection.layer === layer && s.selection.id !== id ? [s.selection.id] : []
      return { multiSelection: { layer, ids: [...base, id] }, selection: { layer, id } }
    }
    const has = s.multiSelection.ids.includes(id)
    const ids = has ? s.multiSelection.ids.filter((x) => x !== id) : [...s.multiSelection.ids, id]
    return { multiSelection: ids.length ? { layer, ids } : null, selection: { layer, id } }
  }),
  deleteMultiSelection: () => {
    const ms = get().multiSelection
    if (!ms || get().layerState[ms.layer].locked) return
    get().applyEdit(ms.layer, (objs) => {
      const idSet = new Set(ms.ids)
      const groupIds = new Set(
        objs.filter((o) => idSet.has(o.id) && 'groupId' in o && o.groupId).map((o) => ('groupId' in o ? o.groupId : undefined))
      )
      return objs.filter((o) => !idSet.has(o.id) && !('groupId' in o && o.groupId && groupIds.has(o.groupId)))
    })
    set({ multiSelection: null, selection: null })
  },
  nudgeMultiSelection: (dx, dy) => {
    const ms = get().multiSelection
    if (!ms || get().layerState[ms.layer].locked) return
    const idSet = new Set(ms.ids)
    get().applyEdit(ms.layer, (objs) => objs.map((o) => {
      if (!idSet.has(o.id)) return o
      if (o.kind === 'symbol') return { ...o, x: o.x + dx, y: o.y + dy }
      if (o.kind === 'circle') return { ...o, cx: o.cx + dx, cy: o.cy + dy }
      if (o.kind === 'wall') return { ...o, x1: o.x1 + dx, y1: o.y1 + dy, x2: o.x2 + dx, y2: o.y2 + dy }
      if (o.kind === 'dome') return { ...o, x: o.x + dx, y: o.y + dy }
      if (o.kind === 'rect') return { ...o, x: o.x + dx, y: o.y + dy }
      if (o.kind === 'text') return { ...o, x: o.x + dx, y: o.y + dy }
      if (o.kind === 'window') return { ...o, x: o.x + dx, y: o.y + dy }
      if (o.kind === 'path') return { ...o, d: shiftPathData(o.d, dx, dy) }
      return o
    }))
  },
  rotateMultiSelection: () => {
    const ms = get().multiSelection
    if (!ms || get().layerState[ms.layer].locked) return
    const idSet = new Set(ms.ids)
    get().applyEdit(ms.layer, (objs) => objs.map((o) =>
      idSet.has(o.id) && ROTATABLE_KINDS.has(o.kind) && o.kind === 'symbol'
        ? { ...o, rotation: (o.rotation + 90) % 360 }
        : o
    ))
  },
  duplicateMultiSelection: () => {
    const ms = get().multiSelection
    if (!ms || get().layerState[ms.layer].locked) return
    const objs = get().project?.levels.find((l) => l.key === get().level)?.layers[ms.layer] ?? []
    const idSet = new Set(ms.ids)
    const clones = objs.filter((o) => idSet.has(o.id)).map((o) => duplicateObject(o)).filter((o): o is DrawObject => o !== null)
    if (clones.length === 0) return
    get().applyEdit(ms.layer, (curObjs) => [...curObjs, ...clones])
    set({ multiSelection: { layer: ms.layer, ids: clones.map((c) => c.id) }, selection: { layer: ms.layer, id: clones[clones.length - 1].id } })
  },
  // deleteSelected/rotateSelected/nudgeSelected/duplicateSelected actúan
  // sobre `selection` (el objeto "principal") y de paso limpian
  // `multiSelection` — sin esto, un Shift+clic que arranca la selección
  // múltiple con un solo objeto (sin selección previa que fusionar) deja
  // un `multiSelection` de 1 elemento que ninguna de estas acciones toca;
  // si luego se borra/mueve ese objeto por su cuenta, `multiSelection`
  // queda apuntando a un id que ya no existe.
  deleteSelected: () => {
    const sel = get().selection
    if (!sel || get().layerState[sel.layer].locked) return
    get().applyEdit(sel.layer, (objs) => {
      const target = objs.find((o) => o.id === sel.id)
      const groupId = target && 'groupId' in target ? target.groupId : undefined
      return objs.filter((o) => o.id !== sel.id && !(groupId && 'groupId' in o && o.groupId === groupId))
    })
    set({ selection: null, multiSelection: null })
  },
  duplicateSelected: () => {
    const sel = get().selection
    if (!sel || get().layerState[sel.layer].locked) return
    const objs = get().project?.levels.find((l) => l.key === get().level)?.layers[sel.layer] ?? []
    const original = objs.find((o) => o.id === sel.id)
    if (!original) return
    const clone = duplicateObject(original)
    if (!clone) return
    get().addObject(sel.layer, clone)
    set({ selection: { layer: sel.layer, id: clone.id }, multiSelection: null })
  },
  rotateSelected: () => {
    const sel = get().selection
    if (!sel || get().layerState[sel.layer].locked) return
    get().applyEdit(sel.layer, (objs) => objs.map((o) =>
      o.id === sel.id && ROTATABLE_KINDS.has(o.kind) && o.kind === 'symbol'
        ? { ...o, rotation: (o.rotation + 90) % 360 }
        : o
    ))
    set({ multiSelection: null })
  },
  nudgeSelected: (dx, dy) => {
    const sel = get().selection
    if (!sel || get().layerState[sel.layer].locked) return
    get().applyEdit(sel.layer, (objs) => objs.map((o) => {
      if (o.id !== sel.id) return o
      if (o.kind === 'symbol') return { ...o, x: o.x + dx, y: o.y + dy }
      if (o.kind === 'circle') return { ...o, cx: o.cx + dx, cy: o.cy + dy }
      if (o.kind === 'wall') return { ...o, x1: o.x1 + dx, y1: o.y1 + dy, x2: o.x2 + dx, y2: o.y2 + dy }
      if (o.kind === 'dome') return { ...o, x: o.x + dx, y: o.y + dy }
      if (o.kind === 'rect') return { ...o, x: o.x + dx, y: o.y + dy }
      if (o.kind === 'text') return { ...o, x: o.x + dx, y: o.y + dy }
      if (o.kind === 'window') return { ...o, x: o.x + dx, y: o.y + dy }
      if (o.kind === 'path') return { ...o, d: shiftPathData(o.d, dx, dy) }
      return o
    }))
    set({ multiSelection: null })
  },
  setHandlePoint: (objId, layer, handleId, x, y) => {
    if (get().layerState[layer].locked) return
    get().applyEdit(layer, (objs) => objs.map((o) => {
      if (o.id !== objId) return o
      if (o.kind === 'wall') {
        return handleId === 'p1' ? { ...o, x1: x, y1: y } : { ...o, x2: x, y2: y }
      }
      if (o.kind === 'path') {
        const pts = o.d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? []
        if (pts.length !== 4) return o
        const [x1, y1, x2, y2] = pts
        const d = handleId === 'p1' ? `M ${x} ${y} L ${x2} ${y2}` : `M ${x1} ${y1} L ${x} ${y}`
        return { ...o, d }
      }
      if (o.kind === 'dome' && handleId === 'resize') {
        return { ...o, w: Math.max(10, x - o.x), h: Math.max(10, y - o.y) }
      }
      if (o.kind === 'rect' && handleId === 'resize') {
        return { ...o, w: Math.max(10, x - o.x), h: Math.max(10, y - o.y) }
      }
      return o
    }))
  },

  setElectricaStage: (electricaStage) => set({ electricaStage, selection: null, multiSelection: null }),
  addCircuit: (name, type, color) => set((s) => {
    if (!s.project) return s
    const circuit: Circuit = { id: newId('circ'), name, type, color }
    const levels = s.project.levels.map((lvl) => lvl.key === s.level ? { ...lvl, circuits: [...lvl.circuits, circuit] } : lvl)
    return { project: { ...s.project, levels, updatedAt: Date.now() } }
  }),
  renameCircuit: (id, name) => set((s) => {
    if (!s.project || !name.trim()) return s
    const levels = s.project.levels.map((lvl) => lvl.key === s.level
      ? { ...lvl, circuits: lvl.circuits.map((c) => c.id === id ? { ...c, name: name.trim() } : c) }
      : lvl)
    return { project: { ...s.project, levels, updatedAt: Date.now() } }
  }),
  setCircuitColor: (id, color) => set((s) => {
    if (!s.project) return s
    const levels = s.project.levels.map((lvl) => lvl.key === s.level
      ? { ...lvl, circuits: lvl.circuits.map((c) => c.id === id ? { ...c, color } : c) }
      : lvl)
    return { project: { ...s.project, levels, updatedAt: Date.now() } }
  }),
  removeCircuit: (id) => set((s) => {
    if (!s.project) return s
    const levels = s.project.levels.map((lvl) => {
      if (lvl.key !== s.level) return lvl
      return {
        ...lvl,
        circuits: lvl.circuits.filter((c) => c.id !== id),
        layers: { ...lvl.layers, electrica: lvl.layers.electrica.map((o) => o.kind === 'path' && o.circuitIds ? { ...o, circuitIds: o.circuitIds.filter((c) => c !== id) } : o) }
      }
    })
    return { project: { ...s.project, levels, updatedAt: Date.now() } }
  }),
  toggleCircuitOnDuct: (objId, circuitId) => {
    get().applyEdit('electrica', (objs) => objs.map((o) => {
      if (o.id !== objId || o.kind !== 'path') return o
      const current = o.circuitIds ?? []
      const has = current.includes(circuitId)
      return { ...o, circuitIds: has ? current.filter((c) => c !== circuitId) : [...current, circuitId] }
    }))
  }
}))
