import type { DrawObject } from '../types'

type Wall = Extract<DrawObject, { kind: 'wall' }>
type Pt = { x: number; y: number }

const MIN_REMAINDER = 6 // por debajo de esto, el tramo restante de muro se descarta en vez de crear una línea casi nula

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function pointToSegmentDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1
  const dy = y2 - y1
  const lenSq = dx * dx + dy * dy
  let t = lenSq === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  const cx = x1 + t * dx
  const cy = y1 + t * dy
  return { dist: Math.hypot(px - cx, py - cy), t }
}

export interface WallHit {
  wall: Wall
  /** longitud del muro y vectores unitarios: u = a lo largo, p = perpendicular */
  len: number
  ux: number
  uy: number
  px: number
  py: number
}

function wallVectors(w: Wall) {
  const dx = w.x2 - w.x1
  const dy = w.y2 - w.y1
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  return { len, ux, uy, px: -uy, py: ux }
}

/** Cualquier ángulo de muro funciona ahora — ya no hace falta que sea
 *  horizontal o vertical para poder abrirle una puerta o ventana. */
export function findWallNear(objs: DrawObject[], px: number, py: number, maxDist = 18): WallHit | null {
  let best: WallHit | null = null
  let bestDist = maxDist
  for (const o of objs) {
    if (o.kind !== 'wall') continue
    const { dist } = pointToSegmentDist(px, py, o.x1, o.y1, o.x2, o.y2)
    if (dist < bestDist) {
      bestDist = dist
      best = { wall: o, ...wallVectors(o) }
    }
  }
  return best
}

/** Proyecta un punto sobre la línea del muro y regresa la distancia desde
 *  (x1,y1) a lo largo del muro (para ubicar dónde abrir el hueco). */
export function projectAlongWall(hit: WallHit, px: number, py: number): number {
  const { wall, ux, uy } = hit
  return (px - wall.x1) * ux + (py - wall.y1) * uy
}

export interface Opening {
  wallId: string
  newWalls: Wall[]
  gapStart: Pt
  gapEnd: Pt
  ux: number
  uy: number
  px: number
  py: number
  width: number
}

export function computeOpening(hit: WallHit, alongClick: number, width: number, snap: number): Opening | null {
  const { wall, len, ux, uy, px, py } = hit
  const half = width / 2
  if (len < width + MIN_REMAINDER * 2) return null

  let center = Math.round(alongClick / snap) * snap
  center = Math.max(half, Math.min(len - half, center))
  const startT = center - half
  const endT = center + half

  const at = (t: number): Pt => ({ x: wall.x1 + ux * t, y: wall.y1 + uy * t })
  const gapStart = at(startT)
  const gapEnd = at(endT)

  const newWalls: Wall[] = []
  if (startT > MIN_REMAINDER) newWalls.push({ id: newId('wall'), kind: 'wall', x1: wall.x1, y1: wall.y1, x2: gapStart.x, y2: gapStart.y, thickness: wall.thickness })
  if (len - endT > MIN_REMAINDER) newWalls.push({ id: newId('wall'), kind: 'wall', x1: gapEnd.x, y1: gapEnd.y, x2: wall.x2, y2: wall.y2, thickness: wall.thickness })

  return { wallId: wall.id, newWalls, gapStart, gapEnd, ux, uy, px, py, width }
}

/** Ángulo de barrido del arco SVG que corresponde a ir de L a O rodeando el
 *  centro H por el camino corto (90°) — se deduce del signo del producto
 *  cruzado en vez de tabular los casos a mano (fácil de invertir por error). */
function arcSweepFlag(h: Pt, l: Pt, o: Pt): 0 | 1 {
  const cross = (l.x - h.x) * (o.y - h.y) - (l.y - h.y) * (o.x - h.x)
  return cross < 0 ? 1 : 0
}

/**
 * @param hinge  qué extremo del hueco es la bisagra ('start' = el extremo
 *   más cercano a (x1,y1) del muro, 'end' = el otro)
 * @param flip   hacia qué lado perpendicular del muro se abre la hoja
 */
export function makeDoorObject(o: Opening, hinge: 'start' | 'end' = 'start', flip = false): DrawObject {
  const sign = flip ? -1 : 1
  const h = hinge === 'start' ? o.gapStart : o.gapEnd
  const other = hinge === 'start' ? o.gapEnd : o.gapStart
  const l: Pt = { x: h.x + o.px * sign * o.width, y: h.y + o.py * sign * o.width }
  const sweep = arcSweepFlag(h, l, other)

  return {
    id: newId('door'), kind: 'doorArc',
    hingeX: h.x, hingeY: h.y, leafX: l.x, leafY: l.y,
    sweep: `M ${l.x} ${l.y} A ${o.width} ${o.width} 0 0 ${sweep} ${other.x} ${other.y}`
  }
}

type DoorArc = Extract<DrawObject, { kind: 'doorArc' }>

/** El punto final del arco (el otro extremo del hueco en el muro) no se
 *  guarda como campo aparte — vive metido al final del string `sweep` (ver
 *  `makeDoorObject`), así que hay que volver a sacarlo de ahí para poder
 *  editar la puerta ya colocada. */
function sweepEndPoint(sweep: string): Pt {
  const nums = sweep.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? []
  return { x: nums[nums.length - 2] ?? 0, y: nums[nums.length - 1] ?? 0 }
}

/** Invierte hacia qué lado del muro se abre la hoja — refleja la hoja al
 *  otro lado de la línea bisagra→extremo. Como la hoja siempre está a
 *  exactamente 90° de esa línea (por construcción, ver `makeDoorObject`),
 *  reflejarla es tan simple como 2·bisagra − hoja (no hace falta saber la
 *  dirección del muro para esto). */
export function flipDoorObject(d: DoorArc): DrawObject {
  const other = sweepEndPoint(d.sweep)
  const h: Pt = { x: d.hingeX, y: d.hingeY }
  const l: Pt = { x: 2 * h.x - d.leafX, y: 2 * h.y - d.leafY }
  const width = Math.hypot(l.x - h.x, l.y - h.y)
  const sweep = arcSweepFlag(h, l, other)
  return { ...d, leafX: l.x, leafY: l.y, sweep: `M ${l.x} ${l.y} A ${width} ${width} 0 0 ${sweep} ${other.x} ${other.y}` }
}

/** Invierte cuál extremo del hueco es la bisagra (equivalente al parámetro
 *  `hinge: 'start'|'end'` de `makeDoorObject`, pero ya con la puerta
 *  colocada) — cambia el sentido hacia el que gira/cierra la hoja, sin
 *  tocar hacia qué lado del muro se abre (eso lo maneja `flipDoorObject`,
 *  el otro eje de inversión). El lado se conserva calculando la
 *  perpendicular a partir de la MISMA dirección bisagra→extremo de
 *  siempre (antes de intercambiarlos) — si se recalculara después de
 *  intercambiar, esa dirección quedaría invertida y "conservar el lado"
 *  se volvería "voltear el lado", pisando lo que hace `flipDoorObject`. */
export function swapDoorHinge(d: DoorArc): DrawObject {
  const other = sweepEndPoint(d.sweep)
  const oldHinge: Pt = { x: d.hingeX, y: d.hingeY }
  const wallLen = Math.hypot(other.x - oldHinge.x, other.y - oldHinge.y) || 1
  const ux = (other.x - oldHinge.x) / wallLen
  const uy = (other.y - oldHinge.y) / wallLen
  const perpX = -uy
  const perpY = ux
  const width = Math.hypot(d.leafX - oldHinge.x, d.leafY - oldHinge.y)
  const sign = (d.leafX - oldHinge.x) * perpX + (d.leafY - oldHinge.y) * perpY < 0 ? -1 : 1
  const newHinge = other
  const newOther = oldHinge
  const newLeaf: Pt = { x: newHinge.x + perpX * sign * width, y: newHinge.y + perpY * sign * width }
  const sweep = arcSweepFlag(newHinge, newLeaf, newOther)
  return {
    ...d, hingeX: newHinge.x, hingeY: newHinge.y, leafX: newLeaf.x, leafY: newLeaf.y,
    sweep: `M ${newLeaf.x} ${newLeaf.y} A ${width} ${width} 0 0 ${sweep} ${newOther.x} ${newOther.y}`
  }
}

/** Cambia el ancho de la puerta manteniendo la bisagra fija (el marco fijo
 *  del que cuelga la hoja) — el extremo abierto del hueco y la hoja se
 *  recalculan a partir de ahí, conservando el lado de apertura actual.
 *  Nota: solo cambia la geometría de la puerta, no el hueco real recortado
 *  en el muro — mismo alcance que ya tiene "ANCHO" para ventanas (tampoco
 *  toca el muro), así que una puerta bastante más ancha que su hueco
 *  original puede verse encimada al muro; es una limitación conocida, no
 *  un descuido. */
export function resizeDoorObject(d: DoorArc, newWidth: number): DrawObject {
  const other = sweepEndPoint(d.sweep)
  const h: Pt = { x: d.hingeX, y: d.hingeY }
  const wallLen = Math.hypot(other.x - h.x, other.y - h.y) || 1
  const ux = (other.x - h.x) / wallLen
  const uy = (other.y - h.y) / wallLen
  const perpX = -uy
  const perpY = ux
  const sign = (d.leafX - h.x) * perpX + (d.leafY - h.y) * perpY < 0 ? -1 : 1
  const l: Pt = { x: h.x + perpX * sign * newWidth, y: h.y + perpY * sign * newWidth }
  const newOther: Pt = { x: h.x + ux * newWidth, y: h.y + uy * newWidth }
  const sweep = arcSweepFlag(h, l, newOther)
  return { ...d, leafX: l.x, leafY: l.y, sweep: `M ${l.x} ${l.y} A ${newWidth} ${newWidth} 0 0 ${sweep} ${newOther.x} ${newOther.y}` }
}

/** Ancho actual de una puerta ya colocada — distancia bisagra→hoja, que por
 *  construcción es igual al radio del arco y al ancho del hueco original. */
export function doorWidth(d: DoorArc): number {
  return Math.hypot(d.leafX - d.hingeX, d.leafY - d.hingeY)
}

export function makeWindowObject(o: Opening): DrawObject {
  const cx = (o.gapStart.x + o.gapEnd.x) / 2
  const cy = (o.gapStart.y + o.gapEnd.y) / 2
  const angle = (Math.atan2(o.uy, o.ux) * 180) / Math.PI
  return { id: newId('win'), kind: 'window', x: cx - o.width / 2, y: cy - 6, w: o.width, h: 12, angle }
}
