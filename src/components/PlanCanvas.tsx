import { memo, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import type { CanvasBounds, DrawObject, LayerKey, LayerStateMap, LevelKey } from '../types'
import { DEFAULT_CANVAS_BOUNDS } from '../types'
import { useProjectStore } from '../store/useProjectStore'
import { computeOpening, findWallNear, makeDoorObject, makeWindowObject, projectAlongWall, type WallHit } from '../lib/wallEdit'
import { findNearbyEndpoint, findObjectNear, getHandles, shiftPathData } from '../lib/hitTest'
import { computeRooms } from '../lib/rooms'
import { SymbolGlyph } from '../lib/symbols'
import {
  DISPOSITIVO_DEFS,
  makeDispositivoObject, makeEquipoObject, makeEscaleraObject, makePiezaHidraulicaObject, makePiezaObject, makePrincipalObject
} from '../lib/stamps'

const LAYER_ORDER: LayerKey[] = ['base', 'drenaje', 'hidraulica', 'electrica']
const GROW_STEP = 1000 // 10 m
const SHRINK_STEP = 100 // 1 m
// Relleno pastel por cuarto (a muy baja opacidad, ver render de `rooms` más
// abajo) — solo para diferenciar un cuarto de otro a simple vista, un color
// por índice de la lista (no representa nada semántico del cuarto). Ya
// depende de `showRoomAreas` igual que la etiqueta de m² porque ambos leen
// del mismo arreglo `rooms`, que sale vacío cuando el toggle "Área" está
// apagado.
const ROOM_FILL_COLORS = ['#22d3ee', '#a855f7', '#facc15', '#4ade80', '#fb7185', '#38bdf8', '#f472b6', '#fbbf24']

type Pt = { x: number; y: number }

export type DragPreview =
  | { kind: 'translate'; ids: string[]; dx: number; dy: number }
  | { kind: 'endpoint'; id: string; handleId: string; x: number; y: number }

interface PlanCanvasProps {
  /** Overrides used for export snapshots — when absent, reads live from the store. */
  level?: LevelKey
  layerStateOverride?: LayerStateMap
  showGhostOverride?: boolean
  /** Vista previa en vivo de un arrastre en curso (mover un símbolo o
   *  estirar el extremo de un muro/tubería) — la maneja CanvasViewport,
   *  que es quien conoce el pan/zoom para convertir coordenadas de pantalla. */
  dragPreview?: DragPreview | null
  /** Agrandar/reducir el lienzo por un lado — la maneja CanvasViewport
   *  cuando está disponible, para compensar el pan y que solo se mueva el
   *  borde que se está tocando (ver comentario en CanvasViewport.tsx sobre
   *  por qué no basta con cambiar `bounds`). Si no se pasa (export), cae al
   *  cambio directo en el store, sin compensar pan (no aplica ahí). */
  onResizeSide?: (side: 'top' | 'bottom' | 'left' | 'right', delta: number) => void
}

function applyDragPreview(o: DrawObject, preview: DragPreview | null | undefined): DrawObject {
  if (!preview) return o
  if (preview.kind === 'translate') {
    if (!preview.ids.includes(o.id)) return o
    const { dx, dy } = preview
    if (o.kind === 'symbol') return { ...o, x: o.x + dx, y: o.y + dy }
    if (o.kind === 'circle') return { ...o, cx: o.cx + dx, cy: o.cy + dy }
    if (o.kind === 'wall') return { ...o, x1: o.x1 + dx, y1: o.y1 + dy, x2: o.x2 + dx, y2: o.y2 + dy }
    if (o.kind === 'dome') return { ...o, x: o.x + dx, y: o.y + dy }
    if (o.kind === 'rect') return { ...o, x: o.x + dx, y: o.y + dy }
    if (o.kind === 'text') return { ...o, x: o.x + dx, y: o.y + dy }
    if (o.kind === 'window') return { ...o, x: o.x + dx, y: o.y + dy }
    if (o.kind === 'path') return { ...o, d: shiftPathData(o.d, dx, dy) }
    return o
  }
  if (preview.id !== o.id) return o
  if (o.kind === 'wall') {
    return preview.handleId === 'p1' ? { ...o, x1: preview.x, y1: preview.y } : { ...o, x2: preview.x, y2: preview.y }
  }
  if (o.kind === 'path') {
    const pts = o.d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? []
    if (pts.length !== 4) return o
    const [x1, y1, x2, y2] = pts
    const d = preview.handleId === 'p1' ? `M ${preview.x} ${preview.y} L ${x2} ${y2}` : `M ${x1} ${y1} L ${preview.x} ${preview.y}`
    return { ...o, d }
  }
  if (o.kind === 'dome' && preview.handleId === 'resize') {
    return { ...o, w: Math.max(10, preview.x - o.x), h: Math.max(10, preview.y - o.y) }
  }
  if (o.kind === 'rect' && preview.handleId === 'resize') {
    return { ...o, w: Math.max(10, preview.x - o.x), h: Math.max(10, preview.y - o.y) }
  }
  return o
}

function parsePathPoints(d: string): Pt[] {
  const re = /([ML])\s*(-?\d+(?:\.\d+)?)[ ,]+(-?\d+(?:\.\d+)?)/g
  const pts: Pt[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(d))) pts.push({ x: parseFloat(m[2]), y: parseFloat(m[3]) })
  return pts
}

/** Marcas de dirección de flujo — se dibujan JUNTO con el guion animado
 *  (`.flow-line`), no en su lugar: la animación se ve bien en vivo, pero al
 *  exportar a PDF (una sola foto estática vía html2canvas) queda congelada
 *  a medio parpadeo o de plano invisible, así que sola no comunica nada ahí
 *  (bug real, reportado). Estas flechitas son geometría estática — salen
 *  igual en vivo y en el PDF, así que garantizan la dirección se entienda
 *  ahí aunque la animación no sobreviva la foto. Una por tramo si es corto,
 *  o una cada `spacing` unidades si es largo, siempre apuntando del primer
 *  punto al segundo (mismo origen del flujo que ya usa el resto de la
 *  app). */
function flowArrowMarks(d: string, spacing: number): { x: number; y: number; angle: number }[] {
  const pts = parsePathPoints(d)
  const marks: { x: number; y: number; angle: number }[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.hypot(dx, dy)
    if (len < 1) continue
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI
    const ux = dx / len
    const uy = dy / len
    const count = Math.max(1, Math.floor(len / spacing))
    for (let k = 1; k <= count; k++) {
      const t = (k * len) / (count + 1)
      marks.push({ x: a.x + ux * t, y: a.y + uy * t, angle })
    }
  }
  return marks
}

function pathMidpoint(d: string): Pt {
  const pts = parsePathPoints(d)
  if (pts.length === 0) return { x: 0, y: 0 }
  const i = Math.floor((pts.length - 1) / 2)
  const a = pts[i]
  const b = pts[Math.min(i + 1, pts.length - 1)]
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

function renderObject(o: DrawObject, selected: boolean) {
  switch (o.kind) {
    case 'wall':
      return (
        <g key={o.id}>
          {selected && <line className="sel-highlight" x1={o.x1} y1={o.y1} x2={o.x2} y2={o.y2} stroke="#22d3ee" strokeWidth={o.thickness + 8} strokeLinecap="square" opacity={0.35} />}
          <line x1={o.x1} y1={o.y1} x2={o.x2} y2={o.y2} stroke="var(--ink-wall)" strokeWidth={o.thickness} strokeLinecap="square" />
        </g>
      )
    case 'doorArc':
      return (
        <g key={o.id}>
          {selected && (
            <g className="sel-highlight" opacity={0.45}>
              <line x1={o.hingeX} y1={o.hingeY} x2={o.leafX} y2={o.leafY} stroke="#22d3ee" strokeWidth={6} strokeLinecap="round" />
              <path d={o.sweep} stroke="#22d3ee" strokeWidth={6} fill="none" strokeLinecap="round" />
              <circle cx={o.hingeX} cy={o.hingeY} r={5} fill="#22d3ee" />
            </g>
          )}
          <line x1={o.hingeX} y1={o.hingeY} x2={o.leafX} y2={o.leafY} stroke="var(--ink-symbol)" strokeWidth={1.4} />
          <path d={o.sweep} stroke="var(--ink-symbol)" strokeWidth={1.4} fill="none" />
        </g>
      )
    case 'window': {
      const cx = o.x + o.w / 2
      const cy = o.y + o.h / 2
      const transform = o.angle ? `rotate(${o.angle} ${cx} ${cy})` : undefined
      return (
        <g key={o.id} transform={transform}>
          <rect x={o.x} y={o.y} width={o.w} height={o.h} fill="none" stroke="var(--ink-window)" strokeWidth={1.4} />
          <line x1={o.x} y1={cy} x2={o.x + o.w} y2={cy} stroke="var(--ink-window)" strokeWidth={1.4} />
        </g>
      )
    }
    case 'dome':
      return (
        <g key={o.id}>
          {selected && <rect className="sel-highlight" x={o.x - 4} y={o.y - 4} width={o.w + 8} height={o.h + 8} fill="none" stroke="#22d3ee" strokeWidth={2} strokeDasharray="4 3" />}
          <rect x={o.x} y={o.y} width={o.w} height={o.h} fill="none" stroke="#c084fc" strokeWidth={1.6} strokeDasharray="4 3" />
          <line x1={o.x} y1={o.y} x2={o.x + o.w} y2={o.y + o.h} stroke="#c084fc" strokeWidth={1.2} />
          <line x1={o.x + o.w} y1={o.y} x2={o.x} y2={o.y + o.h} stroke="#c084fc" strokeWidth={1.2} />
          {o.label && <text x={o.x + o.w / 2} y={o.y + o.h + 14} fill="#c084fc" fontSize={9} textAnchor="middle" className="font-mono-ui">{o.label}</text>}
        </g>
      )
    case 'path':
      return (
        <g key={o.id}>
          {selected && <path className="sel-highlight" d={o.d} stroke="#22d3ee" strokeWidth={o.strokeWidth + 8} fill="none" opacity={0.35} />}
          <path
            d={o.d} stroke={o.stroke} strokeWidth={o.strokeWidth} fill={o.filled ? o.stroke : 'none'}
            strokeDasharray={o.dashed ? '4 3' : o.animated ? '3 7' : undefined}
            className={o.animated ? 'flow-line' : undefined}
          />
          {o.animated && flowArrowMarks(o.d, 36).map((m, i) => (
            <path
              key={i} d="M -4.5 -3.2 L 3.2 0 L -4.5 3.2" stroke={o.stroke} strokeWidth={Math.max(1.2, o.strokeWidth * 0.55)}
              fill="none" strokeLinecap="round" strokeLinejoin="round"
              transform={`translate(${m.x} ${m.y}) rotate(${m.angle})`}
            />
          ))}
        </g>
      )
    case 'circle':
      return <circle key={o.id} cx={o.cx} cy={o.cy} r={o.r} stroke={o.stroke} strokeWidth={1.4} fill={o.fill ?? 'none'} />
    case 'rect':
      return (
        <g key={o.id}>
          {selected && <rect className="sel-highlight" x={o.x - 4} y={o.y - 4} width={o.w + 8} height={o.h + 8} fill="none" stroke="#22d3ee" strokeWidth={2} strokeDasharray="4 3" />}
          <rect x={o.x} y={o.y} width={o.w} height={o.h} stroke={o.stroke} strokeWidth={1.6} fill={o.fill ?? 'none'} strokeDasharray={o.dashed ? '10 6' : undefined} />
        </g>
      )
    case 'text':
      return <text key={o.id} x={o.x} y={o.y} fill={o.color} fontSize={o.size ?? 11} textAnchor={o.anchor ?? 'start'} className="font-mono-ui">{o.text}</text>
    case 'symbol': {
      const scale = o.scale ?? 1
      return (
        <g key={o.id}>
          {selected && <circle className="sel-highlight" cx={o.x} cy={o.y} r={24 * scale} fill="none" stroke="#22d3ee" strokeWidth={1.6} strokeDasharray="3 3" />}
          <g transform={`translate(${o.x},${o.y}) rotate(${o.rotation}) scale(${scale})`}>
            <SymbolGlyph shape={o.shape} color={o.color} />
          </g>
          {o.label && <text x={o.x} y={o.y + 32 * scale} fill={o.color} fontSize={7.5} textAnchor="middle" className="font-mono-ui">{o.label}</text>}
        </g>
      )
    }
  }
}

const snap = (v: number, step: number) => Math.round(v / step) * step

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

/** 1 unidad de lienzo ≈ 1 cm — igual que en `makeCotaObjects`. */
function distanceM(a: Pt, b: Pt): number {
  return Math.hypot(b.x - a.x, b.y - a.y) / 100
}

/** Preview de medida mientras se dibuja un tramo: el tramo actual, y si ya
 *  se llevan varios tramos en la misma cadena, también la distancia en
 *  línea recta desde el punto donde empezó todo — ayuda a calibrar sin
 *  tener que soltar la herramienta y usar "Cota" aparte. */
function DistancePreview({ cursor, color, segmentM, totalM }: { cursor: Pt; color: string; segmentM: number; totalM: number | null }) {
  const lines = totalM !== null ? [`Tramo ${segmentM.toFixed(2)} m`, `Total ${totalM.toFixed(2)} m`] : [`${segmentM.toFixed(2)} m`]
  const w = 84
  const h = lines.length === 2 ? 34 : 18
  const x = cursor.x + 14
  const y = cursor.y - 14 - h
  return (
    <g pointerEvents="none">
      <rect x={x} y={y} width={w} height={h} rx={5} fill="var(--panel-bg)" stroke={color} strokeWidth={1} opacity={0.92} />
      {lines.map((line, i) => (
        <text key={line} x={x + w / 2} y={y + 13 + i * 16} textAnchor="middle" fontSize={10} fill={color} className="font-mono-ui">{line}</text>
      ))}
    </g>
  )
}

/** Botones +10m/-1m en cada lado del lienzo para agrandarlo/reducirlo — ver
 *  `resizeCanvas` en el store. Encimados sobre el borde del plano, no sobre
 *  la herramienta activa, por eso cada uno detiene la propagación del clic
 *  (si no, el `onClick`/`onMouseDown` del `<svg>` los interpretaría como un
 *  punto de dibujo). */
function ResizePill({ x, y, onGrow, onShrink }: { x: number; y: number; onGrow: () => void; onShrink: () => void }) {
  const w = 56
  const h = 22
  const stop = (e: ReactMouseEvent) => e.stopPropagation()
  return (
    <g transform={`translate(${x - w / 2},${y - h / 2})`} pointerEvents="auto" className="canvas-resize-pill">
      <rect width={w} height={h} rx={11} fill="var(--panel-bg-solid)" stroke="var(--hairline)" strokeWidth={1} />
      <line x1={w / 2} y1={3} x2={w / 2} y2={h - 3} stroke="var(--hairline)" strokeWidth={1} />
      <g onMouseDown={stop} onMouseUp={stop} onClick={(e) => { stop(e); onShrink() }} style={{ cursor: 'pointer' }}>
        <title>Reducir el lienzo 1 m de este lado</title>
        <rect width={w / 2} height={h} fill="transparent" />
        <text x={w / 4} y={h / 2 + 4.5} textAnchor="middle" fontSize={13} fontWeight={700} fill="var(--text-secondary)" className="font-mono-ui">−</text>
      </g>
      <g onMouseDown={stop} onMouseUp={stop} onClick={(e) => { stop(e); onGrow() }} style={{ cursor: 'pointer' }}>
        <title>Agrandar el lienzo 10 m de este lado</title>
        <rect x={w / 2} width={w / 2} height={h} fill="transparent" />
        <text x={(w * 3) / 4} y={h / 2 + 4.5} textAnchor="middle" fontSize={13} fontWeight={700} fill="var(--text-secondary)" className="font-mono-ui">+</text>
      </g>
    </g>
  )
}

function ResizeControls({ bounds, onResize }: { bounds: CanvasBounds; onResize: (side: 'top' | 'bottom' | 'left' | 'right', delta: number) => void }) {
  const midX = (bounds.minX + bounds.maxX) / 2
  const midY = (bounds.minY + bounds.maxY) / 2
  const sides: { side: 'top' | 'bottom' | 'left' | 'right'; x: number; y: number; vertical: boolean }[] = [
    { side: 'top', x: midX, y: bounds.minY + 20, vertical: false },
    { side: 'bottom', x: midX, y: bounds.maxY - 20, vertical: false },
    { side: 'left', x: bounds.minX + 20, y: midY, vertical: true },
    { side: 'right', x: bounds.maxX - 20, y: midY, vertical: true }
  ]
  return (
    <g opacity={0.7}>
      {sides.map(({ side, x, y, vertical }) => (
        <g key={side} transform={vertical ? `rotate(90 ${x} ${y})` : undefined}>
          <ResizePill x={x} y={y} onGrow={() => onResize(side, GROW_STEP)} onShrink={() => onResize(side, -SHRINK_STEP)} />
        </g>
      ))}
    </g>
  )
}

function makeCotaObjects(a: Pt, b: Pt): DrawObject[] {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy)
  if (len < 1) return []
  const ux = dx / len
  const uy = dy / len
  const px = -uy
  const py = ux
  const tick = 6
  const d = [
    `M ${a.x - px * tick} ${a.y - py * tick} L ${a.x + px * tick} ${a.y + py * tick}`,
    `M ${a.x} ${a.y} L ${b.x} ${b.y}`,
    `M ${b.x - px * tick} ${b.y - py * tick} L ${b.x + px * tick} ${b.y + py * tick}`
  ].join(' ')
  const midX = (a.x + b.x) / 2
  const midY = (a.y + b.y) / 2
  const meters = (len / 100).toFixed(2)
  // Comparten groupId para que borrar una (la línea o el texto) borre la
  // otra también — son dos objetos independientes pero visualmente son
  // "una sola cota", no debería poder quedar la etiqueta huérfana.
  const groupId = newId('cotagrp')
  return [
    { id: newId('cota'), kind: 'path', d, stroke: 'var(--text-secondary)', strokeWidth: 1, groupId },
    { id: newId('cotalbl'), kind: 'text', x: midX + px * 11, y: midY + py * 11, text: `${meters} m`, color: 'var(--text-primary)', size: 9, anchor: 'middle', groupId }
  ]
}

interface ChainTool {
  layer: LayerKey
  locked: boolean
  previewColor: string
  build: (a: Pt, b: Pt) => DrawObject
}

interface StampTool {
  layer: LayerKey
  locked: boolean
  previewColor: string
  rectSize?: { w: number; h: number }
  previewRadius?: number
  build: (pt: Pt) => DrawObject[]
}

interface TwoPointTool {
  layer: LayerKey
  locked: boolean
  previewColor: string
  preview: 'rect' | 'line'
  build: (a: Pt, b: Pt) => DrawObject[]
}

// Memoizado: el zoom y el paneo del lienzo viven en CanvasViewport y se
// aplican con un transform de CSS al contenedor (no le pasan nada a este
// componente), así que sin memo cada tick de la rueda del mouse y cada
// pixel de un arrastre de paneo volvían a renderizar TODO el plano (cada
// muro, tubería, símbolo…) — con un plano real de tamaño normal eso
// saturaba el hilo principal y se sentía justo como lo describió el
// usuario: el contenedor cambia de tamaño de inmediato (CSS, gratis) pero
// el contenido se queda atrás, y el paneo se ve trabado/a tirones.
export const PlanCanvas = memo(function PlanCanvas({ level: levelProp, layerStateOverride, showGhostOverride, dragPreview, onResizeSide }: PlanCanvasProps = {}) {
  const store = useProjectStore()
  const project = store.project
  const level = levelProp ?? store.level
  const layerState = layerStateOverride ?? store.layerState
  const showGhost = showGhostOverride ?? store.showGhost
  const interactive = levelProp === undefined // false for export snapshots
  const activeTool = store.activeTool
  const addObject = store.addObject
  const applyEdit = store.applyEdit
  const baseLocked = store.layerState.base.locked
  const drenajeLocked = store.layerState.drenaje.locked
  const hidraulicaLocked = store.layerState.hidraulica.locked
  const electricaLocked = store.layerState.electrica.locked
  const selection = store.selection

  const currentLevelForRooms = project?.levels.find((l) => l.key === level)
  const showRoomAreas = store.showRoomAreas && layerState.base.visible
  const rooms = useMemo(
    () => (showRoomAreas && currentLevelForRooms ? computeRooms(currentLevelForRooms.layers.base) : []),
    [showRoomAreas, currentLevelForRooms]
  )

  const svgRef = useRef<SVGSVGElement>(null)
  const [chainStart, setChainStart] = useState<Pt | null>(null)
  // Punto donde empezó la cadena completa (primer clic) — a diferencia de
  // chainStart, que se mueve a cada tramo nuevo, este se queda fijo hasta
  // terminar o cancelar el trazo, para poder mostrar "distancia total
  // desde el origen" además de la del tramo actual.
  const [chainOrigin, setChainOrigin] = useState<Pt | null>(null)
  const [cursorPt, setCursorPt] = useState<Pt | null>(null)
  const [wallHover, setWallHover] = useState<WallHit | null>(null)
  const [brushPts, setBrushPts] = useState<Pt[] | null>(null)
  const [labelEditingAt, setLabelEditingAt] = useState<Pt | null>(null)
  const [labelValue, setLabelValue] = useState('')
  // Enter confirma la etiqueta y, al desmontarse el <input>, el navegador
  // dispara blur — sin este guard commitLabel corría dos veces y duplicaba
  // el texto.
  const labelCommittedRef = useRef(false)
  const [pressureEditingAt, setPressureEditingAt] = useState<Pt | null>(null)
  const [pressureValue, setPressureValue] = useState('')
  const pressureCommittedRef = useRef(false)

  const placingOpening = interactive && (activeTool === 'door' || activeTool === 'window')
  const selecting = interactive && activeTool === 'select'
  const painting = interactive && activeTool === 'pincel'
  const labeling = interactive && activeTool === 'etiqueta'
  const pressuring = interactive && activeTool === 'hidraulicaPresion'

  const chainTool: ChainTool | null = !interactive ? null : (() => {
    switch (activeTool) {
      case 'wall':
        return { layer: 'base', locked: baseLocked, previewColor: '#22d3ee', build: (a, b) => ({ id: newId('wall'), kind: 'wall', x1: a.x, y1: a.y, x2: b.x, y2: b.y, thickness: 14 }) }
      case 'drenajeTuberia':
        return {
          layer: 'drenaje', locked: drenajeLocked, previewColor: 'var(--layer-drenaje)',
          build: (a, b) => ({ id: newId('pipe'), kind: 'path', d: `M ${a.x} ${a.y} L ${b.x} ${b.y}`, stroke: 'var(--layer-drenaje)', strokeWidth: store.pipeDiameter === '4' ? 4.5 : 2.2, animated: store.drenajeFlujo })
        }
      case 'hidraulicaTuberia': {
        const color = store.waterType === 'fria' ? 'var(--pipe-fria)' : 'var(--pipe-caliente)'
        return {
          layer: 'hidraulica', locked: hidraulicaLocked, previewColor: color,
          build: (a, b) => ({ id: newId('hpipe'), kind: 'path', d: `M ${a.x} ${a.y} L ${b.x} ${b.y}`, stroke: color, strokeWidth: store.hidraulicaDiameter === '3/4' ? 3.6 : 2, material: store.hidraulicaMaterial, animated: store.hidraulicaFlujo })
        }
      }
      case 'electricaDucto':
        return {
          layer: 'electrica', locked: electricaLocked, previewColor: 'var(--layer-electrica)',
          build: (a, b) => ({ id: newId('duct'), kind: 'path', d: `M ${a.x} ${a.y} L ${b.x} ${b.y}`, stroke: 'var(--layer-electrica)', strokeWidth: 1.3, dashed: true, circuitIds: [], animated: store.electricaFlujo })
        }
      default:
        return null
    }
  })()

  const stampTool: StampTool | null = !interactive ? null : (() => {
    switch (activeTool) {
      case 'drenajePieza':
        return { layer: 'drenaje', locked: drenajeLocked, previewColor: 'var(--fitting-hl)', previewRadius: 9, build: (pt) => [makePiezaObject(store.selectedPieza, pt.x, pt.y, store.pipeDiameter)] }
      case 'hidraulicaPieza': {
        const color = store.selectedPiezaHidraulica === 'toma' ? 'var(--pipe-fria)' : (store.waterType === 'fria' ? 'var(--pipe-fria)' : 'var(--pipe-caliente)')
        return { layer: 'hidraulica', locked: hidraulicaLocked, previewColor: color, previewRadius: 9, build: (pt) => [makePiezaHidraulicaObject(store.selectedPiezaHidraulica, pt.x, pt.y, store.waterType, store.hidraulicaDiameter)] }
      }
      case 'hidraulicaEquipo':
        return { layer: 'hidraulica', locked: hidraulicaLocked, previewColor: 'var(--layer-hidraulica)', rectSize: { w: 70, h: 50 }, build: (pt) => [makeEquipoObject(store.selectedEquipo, pt.x, pt.y, store.equipoRotation)] }
      case 'electricaTablero':
        return { layer: 'electrica', locked: electricaLocked, previewColor: 'var(--layer-electrica)', previewRadius: 18, build: (pt) => [makePrincipalObject(store.selectedPrincipal, pt.x, pt.y)] }
      case 'electricaDispositivo': {
        const def = DISPOSITIVO_DEFS[store.selectedDispositivo]
        return { layer: 'electrica', locked: electricaLocked, previewColor: def.color, previewRadius: 9, build: (pt) => [makeDispositivoObject(store.selectedDispositivo, pt.x, pt.y)] }
      }
      case 'escalera':
        return { layer: 'base', locked: baseLocked, previewColor: 'var(--stair-hl)', previewRadius: 20, build: (pt) => [makeEscaleraObject(pt.x, pt.y)] }
      default:
        return null
    }
  })()

  const twoPointTool: TwoPointTool | null = !interactive ? null : (() => {
    switch (activeTool) {
      case 'domo':
        return {
          layer: 'base', locked: baseLocked, previewColor: '#c084fc', preview: 'rect',
          build: (a, b) => [{ id: newId('domo'), kind: 'dome', x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.max(10, Math.abs(b.x - a.x)), h: Math.max(10, Math.abs(b.y - a.y)), label: 'DOMO' }]
        }
      case 'rectangulo':
        return {
          layer: 'base', locked: baseLocked, previewColor: 'var(--ink-wall)', preview: 'rect',
          build: (a, b) => [{ id: newId('rect'), kind: 'rect', x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.max(10, Math.abs(b.x - a.x)), h: Math.max(10, Math.abs(b.y - a.y)), stroke: 'var(--ink-wall)' }]
        }
      case 'cota':
        return { layer: 'base', locked: baseLocked, previewColor: 'var(--text-secondary)', preview: 'line', build: (a, b) => makeCotaObjects(a, b) }
      default:
        return null
    }
  })()

  const chaining = !!chainTool || !!twoPointTool

  useEffect(() => { setChainStart(null); setChainOrigin(null); setWallHover(null); setBrushPts(null); setLabelEditingAt(null); labelCommittedRef.current = true }, [activeTool, level, project?.id])

  useEffect(() => {
    if (!chaining) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setChainStart(null); setChainOrigin(null) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [chaining])

  useEffect(() => {
    if (!interactive || activeTool !== 'hidraulicaEquipo') return
    const onKey = (e: KeyboardEvent) => { if (e.key.toLowerCase() === 'r') store.rotateEquipo() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive, activeTool])

  // Seleccionar un objeto: R rota (si aplica), Supr/Backspace borra, flechas
  // lo mueve al paso de `gridSnap` (10 unidades por defecto, 1 en modo
  // fino) — así se pueden corregir cosas ya colocadas sin tener que
  // deshacer y repetir.
  useEffect(() => {
    if (!interactive || (!selection && !store.multiSelection)) return
    const isMulti = (store.multiSelection?.ids.length ?? 0) > 1
    const nudgeStep = store.gridSnap
    const runDelete = () => { if (isMulti) store.deleteMultiSelection(); else store.deleteSelected() }
    const runNudge = (dx: number, dy: number) => { if (isMulti) store.nudgeMultiSelection(dx, dy); else store.nudgeSelected(dx, dy) }
    const runDuplicate = () => { if (isMulti) store.duplicateMultiSelection(); else store.duplicateSelected() }
    const runRotate = () => { if (isMulti) store.rotateMultiSelection(); else store.rotateSelected() }
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); runDelete() }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); runDuplicate() }
      else if (e.key.toLowerCase() === 'r') { runRotate() }
      else if (e.key === 'ArrowUp') { e.preventDefault(); runNudge(0, -nudgeStep) }
      else if (e.key === 'ArrowDown') { e.preventDefault(); runNudge(0, nudgeStep) }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); runNudge(-nudgeStep, 0) }
      else if (e.key === 'ArrowRight') { e.preventDefault(); runNudge(nudgeStep, 0) }
      else if (e.key === 'Escape') { store.clearSelection() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive, selection, store.multiSelection, store.gridSnap])

  // getScreenCTM() le pregunta al navegador la transformación real
  // pantalla→SVG (viewBox, zoom, cualquier CSS transform de un ancestro) en
  // vez de recalcularla a mano con getBoundingClientRect — eso último se
  // desalinea en algunos entornos con escalado fraccional de pantalla.
  const toSvgPoint = (e: ReactMouseEvent) => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const ctm = svg.getScreenCTM()
    if (!ctm) return { x: 0, y: 0 }
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const svgP = pt.matrixTransform(ctm.inverse())

    // Imán a la esquina/extremo más cercano de un objeto ya dibujado en la
    // misma capa (muro contra muro, tubería contra tubería…) antes de caer
    // al snap plano de la cuadrícula — así cierran los rincones de verdad.
    // En modo fino (1 cm) el radio del imán baja de 16 a 6 unidades, si no
    // un clic a propósito a unos centímetros de una esquina existente
    // siempre terminaría saltando a ella en vez de respetar el trazo fino.
    const gridStep = store.gridSnap
    const snapLayer = chainTool?.layer ?? twoPointTool?.layer
    if (snapLayer) {
      const objs = project?.levels.find((l) => l.key === level)?.layers[snapLayer] ?? []
      const near = findNearbyEndpoint(objs, svgP.x, svgP.y, gridStep <= 1 ? 6 : 16)
      if (near) return near
    }

    return { x: snap(svgP.x, gridStep), y: snap(svgP.y, gridStep) }
  }

  const baseObjects = project?.levels.find((l) => l.key === level)?.layers.base ?? []
  const currentLevelData = project?.levels.find((l) => l.key === level)

  const handleMouseMove = (e: ReactMouseEvent) => {
    if (painting && brushPts) {
      setCursorPt(toSvgPoint(e))
      setBrushPts((pts) => (pts ? [...pts, toSvgPoint(e)] : pts))
      return
    }
    if (chainTool || stampTool || twoPointTool || labeling || pressuring) {
      setCursorPt(toSvgPoint(e))
    } else if (placingOpening && !baseLocked) {
      const pt = toSvgPoint(e)
      setWallHover(findWallNear(baseObjects, pt.x, pt.y))
    }
  }

  const handleMouseDown = (e: ReactMouseEvent) => {
    if (!painting || baseLocked) return
    setBrushPts([toSvgPoint(e)])
  }

  const handleMouseUp = () => {
    if (!painting) return
    // Nunca llamar acciones del store (con efecto secundario) desde dentro
    // de un updater de setState — React lo marca como "setState mientras
    // se renderiza otro componente" y deja el resto de la interacción en un
    // estado inconsistente. brushPts ya está disponible en este closure.
    if (brushPts && brushPts.length > 1) {
      const d = 'M ' + brushPts.map((p) => `${p.x} ${p.y}`).join(' L ')
      addObject('base', { id: newId('brush'), kind: 'path', d, stroke: '#fbbf24', strokeWidth: 3, filled: false })
    }
    setBrushPts(null)
  }

  const handleClick = (e: ReactMouseEvent) => {
    // El segundo click de un doble-click real (detail=2) no debe agregar un
    // tramo nuevo — solo el dblclick lo cierra. Sin este filtro, un doble
    // clic para terminar un trazo a veces generaba un tramo diminuto extra
    // por el pequeño jitter del mouse entre los dos clics.
    if (e.detail > 1) return
    const pt = toSvgPoint(e)

    if (labeling) {
      if (baseLocked) return
      labelCommittedRef.current = false
      setLabelEditingAt(pt)
      setLabelValue('')
      return
    }

    if (pressuring) {
      if (hidraulicaLocked) return
      pressureCommittedRef.current = false
      setPressureEditingAt(pt)
      setPressureValue('')
      return
    }

    if (selecting) {
      if (!currentLevelData) return
      let found: { layer: LayerKey; obj: DrawObject } | null = null
      let bestDist = Infinity
      for (const key of LAYER_ORDER) {
        if (!layerState[key].visible || layerState[key].locked) continue
        const hit = findObjectNear(currentLevelData.layers[key], pt.x, pt.y)
        if (hit && hit.dist < bestDist) { bestDist = hit.dist; found = { layer: key, obj: hit.obj } }
      }
      // Un objeto de tipo arrastrable (símbolo, muro, tubería…) ya lo
      // selecciona/multiselecciona por completo CanvasViewport
      // (onPointerDown, que corre primero) — este "click" nativo llega
      // DESPUÉS de cualquier pointerdown/up (arrastre o no), así que si se
      // deja correr aquí sin filtrarlo pisa esa selección con un select()
      // normal (perdiendo, por ejemplo, la selección múltiple justo
      // después de arrastrar el grupo). Para los tipos no arrastrables
      // (doorArc, CanvasViewport no los toca) sí hace falta manejarlo aquí.
      const draggableKinds = new Set(['symbol', 'circle', 'wall', 'path', 'dome', 'rect', 'text', 'window'])
      if (found && draggableKinds.has(found.obj.kind)) return
      if (e.shiftKey) {
        if (found) store.toggleMultiSelect(found.layer, found.obj.id)
        return
      }
      if (found) store.select(found.layer, found.obj.id)
      else store.clearSelection()
      return
    }

    if (chainTool) {
      if (chainTool.locked) return
      if (!chainStart) {
        setChainStart(pt)
        setChainOrigin(pt)
        return
      }
      if (pt.x !== chainStart.x || pt.y !== chainStart.y) {
        addObject(chainTool.layer, chainTool.build(chainStart, pt))
      }
      setChainStart(pt)
      return
    }

    if (twoPointTool) {
      if (twoPointTool.locked) return
      if (!chainStart) {
        setChainStart(pt)
        return
      }
      if (pt.x !== chainStart.x || pt.y !== chainStart.y) {
        applyEdit(twoPointTool.layer, (objs) => [...objs, ...twoPointTool.build(chainStart, pt)])
      }
      setChainStart(null)
      return
    }

    if (stampTool) {
      if (stampTool.locked) return
      applyEdit(stampTool.layer, (objs) => [...objs, ...stampTool.build(pt)])
      return
    }

    if (placingOpening) {
      if (baseLocked) return
      const hit = findWallNear(baseObjects, pt.x, pt.y)
      if (!hit) return
      const along = projectAlongWall(hit, pt.x, pt.y)
      const width = activeTool === 'door' ? store.doorWidth : store.windowWidth
      const opening = computeOpening(hit, along, width, store.gridSnap)
      if (!opening) return
      const newExtra = activeTool === 'door' ? makeDoorObject(opening, store.doorHinge, store.doorFlip) : makeWindowObject(opening)
      applyEdit('base', (objs) => [...objs.filter((o) => o.id !== opening.wallId), ...opening.newWalls, newExtra])
      setWallHover(null)
    }
  }

  const handleDoubleClick = () => { setChainStart(null); setChainOrigin(null) }

  const finishLabelEditing = (commit: boolean) => {
    if (labelCommittedRef.current) return
    labelCommittedRef.current = true
    if (commit && labelEditingAt && labelValue.trim()) {
      addObject('base', { id: newId('label'), kind: 'text', x: labelEditingAt.x, y: labelEditingAt.y, text: labelValue.trim(), color: 'var(--text-primary)', size: 12 })
    }
    setLabelEditingAt(null)
    setLabelValue('')
  }

  const finishPressureEditing = (commit: boolean) => {
    if (pressureCommittedRef.current) return
    pressureCommittedRef.current = true
    const value = pressureValue.trim()
    if (commit && pressureEditingAt && value) {
      const text = /psi$/i.test(value) ? value : `${value} PSI`
      addObject('hidraulica', { id: newId('psi'), kind: 'text', x: pressureEditingAt.x, y: pressureEditingAt.y, text, color: 'var(--layer-hidraulica)', size: 11 })
    }
    setPressureEditingAt(null)
    setPressureValue('')
  }

  if (!project) return null
  const current = project.levels.find((l) => l.key === level)!
  const bounds = current.bounds ?? DEFAULT_CANVAS_BOUNDS
  const viewW = bounds.maxX - bounds.minX
  const viewH = bounds.maxY - bounds.minY
  const levelIndex = project.levels.findIndex((l) => l.key === level)
  const previousLevel = levelIndex > 0 ? project.levels[levelIndex - 1] : null
  const ghostVisible = !!previousLevel && showGhost

  const hoverPreview = (wallHover && cursorPt) ? (() => {
    const width = activeTool === 'door' ? store.doorWidth : store.windowWidth
    const half = width / 2
    const along = projectAlongWall(wallHover, cursorPt.x, cursorPt.y)
    const clamped = Math.max(half, Math.min(wallHover.len - half, along))
    const cx = wallHover.wall.x1 + wallHover.ux * clamped
    const cy = wallHover.wall.y1 + wallHover.uy * clamped
    return { x1: cx - wallHover.ux * half, y1: cy - wallHover.uy * half, x2: cx + wallHover.ux * half, y2: cy + wallHover.uy * half }
  })() : null

  const locked = chainTool?.locked || stampTool?.locked || twoPointTool?.locked

  return (
    <svg
      ref={svgRef}
      width={viewW} height={viewH} viewBox={`${bounds.minX} ${bounds.minY} ${viewW} ${viewH}`}
      style={{
        display: 'block',
        cursor: (chainTool || stampTool || twoPointTool || placingOpening || painting || labeling || pressuring) ? (locked ? 'not-allowed' : 'crosshair') : selecting ? 'default' : undefined
      }}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      <defs>
        <filter id="glowSoft" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.4" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {ghostVisible && previousLevel && (
        <g opacity={0.16}>
          {previousLevel.layers.base.filter((o) => o.kind === 'wall').map((o) => renderObject(o, false))}
        </g>
      )}

      {LAYER_ORDER.map((key) => {
        const st = layerState[key]
        const opacity = st.visible ? st.opacity / 100 : 0
        return (
          <g key={key} style={{ opacity, transition: 'opacity .15s ease' }} filter={key !== 'base' ? 'url(#glowSoft)' : undefined}>
            {current.layers[key].map((o) => renderObject(
              applyDragPreview(o, dragPreview),
              (selection?.layer === key && selection.id === o.id) || (store.multiSelection?.layer === key && store.multiSelection.ids.includes(o.id))
            ))}
            {interactive && key === 'electrica' && store.electricaStage === 'cableado' && current.layers.electrica.map((o) => {
              if (o.kind !== 'path') return null
              const mid = pathMidpoint(o.d)
              const count = o.circuitIds?.length ?? 0
              return (
                <g key={`${o.id}-badge`} pointerEvents="none">
                  <circle cx={mid.x} cy={mid.y} r={9} fill="var(--layer-electrica)" />
                  <text x={mid.x} y={mid.y + 3} fontSize={9} fontWeight={700} textAnchor="middle" fill="#0a0a10" className="font-mono-ui">{count}</text>
                </g>
              )
            })}
          </g>
        )
      })}

      {rooms.length > 0 && (
        <g pointerEvents="none">
          {rooms.map((r, i) => (
            <polygon
              key={`room-fill-${i}`}
              points={r.points.map((p) => `${p.x},${p.y}`).join(' ')}
              fill={ROOM_FILL_COLORS[i % ROOM_FILL_COLORS.length]}
              fillOpacity={0.13}
            />
          ))}
          {rooms.map((r, i) => {
            const label = `${r.areaM2.toFixed(1)} m²`
            const w = label.length * 6.4 + 10
            return (
              <g key={`room-${i}`}>
                <rect x={r.centroid.x - w / 2} y={r.centroid.y - 13} width={w} height={16} rx={4} fill="var(--panel-bg-solid)" opacity={0.8} />
                <text
                  x={r.centroid.x} y={r.centroid.y - 1.5} textAnchor="middle"
                  fontSize={11} fontWeight={600} fill="var(--text-primary)" className="font-mono-ui"
                >
                  {label}
                </text>
              </g>
            )
          })}
        </g>
      )}

      {selection && (() => {
        const selObj = current.layers[selection.layer].find((o) => o.id === selection.id)
        if (!selObj) return null
        const handles = getHandles(applyDragPreview(selObj, dragPreview))
        if (handles.length === 0) return null
        return (
          <g pointerEvents="none">
            {handles.map((h) => (
              <circle key={h.id} cx={h.x} cy={h.y} r={7} fill="#0a0a10" stroke="#22d3ee" strokeWidth={2.5} />
            ))}
          </g>
        )
      })()}

      {chainTool && chainStart && (
        <circle cx={chainStart.x} cy={chainStart.y} r={4} fill={chainTool.previewColor} pointerEvents="none" />
      )}
      {chainTool && chainStart && cursorPt && (
        <g pointerEvents="none">
          <line x1={chainStart.x} y1={chainStart.y} x2={cursorPt.x} y2={cursorPt.y} stroke={chainTool.previewColor} strokeWidth={2} strokeDasharray="5 4" />
          <circle cx={cursorPt.x} cy={cursorPt.y} r={4} fill={chainTool.previewColor} />
          <DistancePreview
            cursor={cursorPt} color={chainTool.previewColor}
            segmentM={distanceM(chainStart, cursorPt)}
            totalM={chainOrigin && (chainOrigin.x !== chainStart.x || chainOrigin.y !== chainStart.y) ? distanceM(chainOrigin, cursorPt) : null}
          />
        </g>
      )}

      {twoPointTool && chainStart && (
        <circle cx={chainStart.x} cy={chainStart.y} r={4} fill={twoPointTool.previewColor} pointerEvents="none" />
      )}
      {twoPointTool && chainStart && cursorPt && (
        <g pointerEvents="none">
          {twoPointTool.preview === 'rect'
            ? <rect x={Math.min(chainStart.x, cursorPt.x)} y={Math.min(chainStart.y, cursorPt.y)} width={Math.abs(cursorPt.x - chainStart.x)} height={Math.abs(cursorPt.y - chainStart.y)} fill="none" stroke={twoPointTool.previewColor} strokeWidth={1.6} strokeDasharray="4 3" />
            : <line x1={chainStart.x} y1={chainStart.y} x2={cursorPt.x} y2={cursorPt.y} stroke={twoPointTool.previewColor} strokeWidth={1.4} strokeDasharray="3 3" />}
          <DistancePreview cursor={cursorPt} color={twoPointTool.previewColor} segmentM={distanceM(chainStart, cursorPt)} totalM={null} />
        </g>
      )}

      {stampTool && cursorPt && !stampTool.locked && (
        stampTool.rectSize
          ? <rect x={cursorPt.x - stampTool.rectSize.w / 2} y={cursorPt.y - stampTool.rectSize.h / 2} width={stampTool.rectSize.w} height={stampTool.rectSize.h} fill="none" stroke={stampTool.previewColor} strokeWidth={1.4} strokeDasharray="4 3" pointerEvents="none" />
          : <circle cx={cursorPt.x} cy={cursorPt.y} r={stampTool.previewRadius ?? 6} fill="none" stroke={stampTool.previewColor} strokeWidth={1.6} pointerEvents="none" />
      )}

      {painting && brushPts && brushPts.length > 1 && (
        <path d={'M ' + brushPts.map((p) => `${p.x} ${p.y}`).join(' L ')} stroke="#fbbf24" strokeWidth={3} fill="none" pointerEvents="none" opacity={0.85} />
      )}

      {labelEditingAt && (
        <foreignObject x={labelEditingAt.x} y={labelEditingAt.y - 12} width={220} height={30}>
          <input
            autoFocus
            value={labelValue}
            onChange={(e) => setLabelValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') finishLabelEditing(true); if (e.key === 'Escape') finishLabelEditing(false) }}
            onBlur={() => finishLabelEditing(true)}
            placeholder="Escribe y Enter…"
            style={{ font: '12px IBM Plex Sans, sans-serif', width: '210px', padding: '2px 4px', border: '1px solid #22d3ee', borderRadius: 4, outline: 'none' }}
          />
        </foreignObject>
      )}

      {pressureEditingAt && (
        <foreignObject x={pressureEditingAt.x} y={pressureEditingAt.y - 12} width={140} height={30}>
          <input
            autoFocus
            inputMode="decimal"
            value={pressureValue}
            onChange={(e) => setPressureValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') finishPressureEditing(true); if (e.key === 'Escape') finishPressureEditing(false) }}
            onBlur={() => finishPressureEditing(true)}
            placeholder="PSI…"
            style={{ font: '12px IBM Plex Sans, sans-serif', width: '90px', padding: '2px 4px', border: '1px solid var(--layer-hidraulica)', borderRadius: 4, outline: 'none' }}
          />
        </foreignObject>
      )}

      {placingOpening && wallHover && (
        <g pointerEvents="none">
          <line x1={wallHover.wall.x1} y1={wallHover.wall.y1} x2={wallHover.wall.x2} y2={wallHover.wall.y2} stroke="#22d3ee" strokeWidth={wallHover.wall.thickness + 4} strokeLinecap="square" opacity={0.28} />
          {hoverPreview && <line x1={hoverPreview.x1} y1={hoverPreview.y1} x2={hoverPreview.x2} y2={hoverPreview.y2} stroke="#22d3ee" strokeWidth={4} strokeLinecap="round" />}
        </g>
      )}

      <g transform={`translate(${bounds.minX + 60},${bounds.maxY - 50})`}>
        <path d="M0 0 l-6 12 l6 -3 l6 3 Z" fill="var(--text-tertiary)" />
        <text x={10} y={10} fill="var(--text-tertiary)" fontSize={9} className="font-mono-ui">N</text>
      </g>
      <text x={bounds.maxX - 20} y={bounds.maxY - 15} fill="var(--text-tertiary)" fontSize={9} textAnchor="end" className="font-mono-ui">ESC. {project.scaleLabel}</text>

      {interactive && (
        <ResizeControls bounds={bounds} onResize={onResizeSide ?? ((side, delta) => store.resizeCanvas(side, delta))} />
      )}
    </svg>
  )
})
