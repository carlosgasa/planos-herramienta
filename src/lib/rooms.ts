import type { DrawObject } from '../types'

export interface RoomPolygon {
  points: { x: number; y: number }[]
  areaM2: number
  centroid: { x: number; y: number }
}

interface Pt { x: number; y: number }
interface Segment { x1: number; y1: number; x2: number; y2: number }

/** Funde extremos de muro que casi coinciden en un mismo nodo — dos clics
 *  "casi" en el mismo punto no deberían dejar la habitación sin cerrar. */
const MERGE_EPS = 8
/** Tolerancia perpendicular para detectar que el extremo de un muro cae
 *  sobre la mitad de OTRO muro (unión en T de un muro divisorio contra uno
 *  perimetral) — sin esto, la mayoría de los planos reales no cerrarían
 *  ninguna habitación, porque casi ningún muro divisorio termina justo en
 *  la esquina de otro. */
const T_JUNCTION_TOL = 6
/** Área mínima (unidades² — 1 unidad ≈ 1 cm) para contar como habitación
 *  real y no como ruido de un muro colgante o una cara degenerada. */
const MIN_AREA_UNITS2 = 400 // 0.04 m²

interface Node extends Pt { id: number }

function dist(ax: number, ay: number, bx: number, by: number) {
  return Math.hypot(ax - bx, ay - by)
}

/** Una puerta o ventana deja un hueco real en el muro (`wallEdit.ts` parte
 *  el muro en dos al colocarla) — para el área habitable ese hueco sigue
 *  siendo el límite del cuarto, así que se "tapa" con un tramo virtual
 *  entre los dos extremos del hueco, solo para cerrar el polígono. */
function doorGapSegment(d: Extract<DrawObject, { kind: 'doorArc' }>): Segment {
  // El extremo lejano del hueco es el punto final del arco de `sweep`
  // ("M lx ly A rx ry rot largeArc sweepFlag ex ey") — los últimos dos
  // números del path.
  const nums = d.sweep.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? []
  const ex = nums.length >= 2 ? nums[nums.length - 2] : d.hingeX
  const ey = nums.length >= 2 ? nums[nums.length - 1] : d.hingeY
  return { x1: d.hingeX, y1: d.hingeY, x2: ex, y2: ey }
}

function windowGapSegment(w: Extract<DrawObject, { kind: 'window' }>): Segment {
  const cx = w.x + w.w / 2
  const cy = w.y + w.h / 2
  if (w.angle !== undefined) {
    const rad = (w.angle * Math.PI) / 180
    const ux = Math.cos(rad)
    const uy = Math.sin(rad)
    const half = w.w / 2
    return { x1: cx - ux * half, y1: cy - uy * half, x2: cx + ux * half, y2: cy + uy * half }
  }
  // Sin `angle`: la orientación se infiere de cuál lado del rectángulo es
  // más largo (ventana vertical vs horizontal sin rotar).
  return w.w >= w.h
    ? { x1: w.x, y1: cy, x2: w.x + w.w, y2: cy }
    : { x1: cx, y1: w.y, x2: cx, y2: w.y + w.h }
}

/** Punto donde dos tramos se cruzan en "X" (ninguno termina ahí, ambos lo
 *  atraviesan por en medio) — dos particiones que se cruzan sin que una
 *  termine sobre la otra, a diferencia de una unión en T. */
function segmentCross(s1: Segment, s2: Segment): Pt | null {
  const d1x = s1.x2 - s1.x1, d1y = s1.y2 - s1.y1
  const d2x = s2.x2 - s2.x1, d2y = s2.y2 - s2.y1
  const denom = d1x * d2y - d1y * d2x
  if (Math.abs(denom) < 1e-9) return null // paralelos (o colineales)
  const t = ((s2.x1 - s1.x1) * d2y - (s2.y1 - s1.y1) * d2x) / denom
  const u = ((s2.x1 - s1.x1) * d1y - (s2.y1 - s1.y1) * d1x) / denom
  if (t <= 0.02 || t >= 0.98 || u <= 0.02 || u >= 0.98) return null
  return { x: s1.x1 + t * d1x, y: s1.y1 + t * d1y }
}

/** Junta todos los extremos de los tramos (con tolerancia) en una lista de
 *  nodos únicos, resuelve cruces en "X" y parte cada tramo donde otro nodo
 *  cae sobre su mitad (unión en T). */
function buildGraph(segments: Segment[]): { nodes: Node[]; edges: [number, number][] } {
  const nodes: Node[] = []
  const nodeAt = (x: number, y: number): number => {
    for (const n of nodes) if (dist(n.x, n.y, x, y) <= MERGE_EPS) return n.id
    const id = nodes.length
    nodes.push({ x, y, id })
    return id
  }

  for (const s of segments) {
    nodeAt(s.x1, s.y1)
    nodeAt(s.x2, s.y2)
  }
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const cross = segmentCross(segments[i], segments[j])
      if (cross) nodeAt(cross.x, cross.y)
    }
  }

  const edges: [number, number][] = []
  const edgeKeys = new Set<string>()
  const addEdge = (a: number, b: number) => {
    if (a === b) return
    const key = a < b ? `${a}-${b}` : `${b}-${a}`
    if (edgeKeys.has(key)) return
    edgeKeys.add(key)
    edges.push([a, b])
  }

  for (const s of segments) {
    const a = nodeAt(s.x1, s.y1)
    const b = nodeAt(s.x2, s.y2)
    const pa = nodes[a]
    const pb = nodes[b]
    const dx = pb.x - pa.x
    const dy = pb.y - pa.y
    const lenSq = dx * dx + dy * dy
    if (lenSq < 1) continue

    const onSegment: { t: number; id: number }[] = []
    for (const n of nodes) {
      if (n.id === a || n.id === b) continue
      const t = ((n.x - pa.x) * dx + (n.y - pa.y) * dy) / lenSq
      if (t <= 0.02 || t >= 0.98) continue
      const projX = pa.x + t * dx
      const projY = pa.y + t * dy
      if (dist(n.x, n.y, projX, projY) <= T_JUNCTION_TOL) onSegment.push({ t, id: n.id })
    }

    if (onSegment.length === 0) {
      addEdge(a, b)
      continue
    }
    onSegment.sort((p, q) => p.t - q.t)
    let prev = a
    for (const p of onSegment) {
      addEdge(prev, p.id)
      prev = p.id
    }
    addEdge(prev, b)
  }

  return { nodes, edges }
}

function connectedComponents(nodeIds: number[], adj: Map<number, Set<number>>): number[][] {
  const visited = new Set<number>()
  const components: number[][] = []
  for (const start of nodeIds) {
    if (visited.has(start)) continue
    const comp: number[] = []
    const stack = [start]
    visited.add(start)
    while (stack.length) {
      const cur = stack.pop()!
      comp.push(cur)
      for (const nb of adj.get(cur) ?? []) {
        if (!visited.has(nb)) { visited.add(nb); stack.push(nb) }
      }
    }
    components.push(comp)
  }
  return components
}

/** Detecta las habitaciones (caras cerradas) que forman los muros de un
 *  nivel — más los huecos de puertas/ventanas, "tapados" con un tramo
 *  virtual solo para efectos de cerrar el polígono — y calcula su área
 *  real en m². Usa el "sistema de rotación" clásico para trazar las caras
 *  de un grafo planar: en cada nodo se ordenan los vecinos por ángulo y se
 *  recorre "el anterior en sentido antihorario" — con esa regla fija, toda
 *  cara interior queda con área con signo positiva y la única cara
 *  exterior de cada componente queda negativa, así que no hace falta
 *  adivinar cuál es "la de afuera": basta el signo. */
export function computeRooms(baseLayerObjects: DrawObject[]): RoomPolygon[] {
  const segments: Segment[] = []
  for (const o of baseLayerObjects) {
    if (o.kind === 'wall') segments.push({ x1: o.x1, y1: o.y1, x2: o.x2, y2: o.y2 })
    else if (o.kind === 'doorArc') segments.push(doorGapSegment(o))
    else if (o.kind === 'window') segments.push(windowGapSegment(o))
  }
  if (segments.length < 3) return []

  const { nodes, edges } = buildGraph(segments)
  const adj = new Map<number, Set<number>>()
  for (const [a, b] of edges) {
    if (!adj.has(a)) adj.set(a, new Set())
    if (!adj.has(b)) adj.set(b, new Set())
    adj.get(a)!.add(b)
    adj.get(b)!.add(a)
  }
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const nodeIds = nodes.filter((n) => (adj.get(n.id)?.size ?? 0) > 0).map((n) => n.id)
  const components = connectedComponents(nodeIds, adj)

  const rooms: RoomPolygon[] = []

  for (const comp of components) {
    if (comp.length < 3) continue

    const sortedNeighbors = new Map<number, number[]>()
    for (const id of comp) {
      const p = byId.get(id)!
      const neighbors = [...(adj.get(id) ?? [])]
      neighbors.sort((na, nb) => {
        const pa = byId.get(na)!
        const pb = byId.get(nb)!
        return Math.atan2(pa.y - p.y, pa.x - p.x) - Math.atan2(pb.y - p.y, pb.x - p.x)
      })
      sortedNeighbors.set(id, neighbors)
    }

    const visitedHalfEdge = new Set<string>()
    const faces: number[][] = []

    for (const u of comp) {
      for (const v of adj.get(u) ?? []) {
        const startKey = `${u}->${v}`
        if (visitedHalfEdge.has(startKey)) continue

        const face: number[] = [u]
        let curU = u
        let curV = v
        let guard = 0
        const maxSteps = edges.length * 2 + 10
        for (;;) {
          visitedHalfEdge.add(`${curU}->${curV}`)
          face.push(curV)
          const neighbors = sortedNeighbors.get(curV)!
          const idx = neighbors.indexOf(curU)
          const next = neighbors[(idx - 1 + neighbors.length) % neighbors.length]
          curU = curV
          curV = next
          guard++
          if (curU === u && curV === v) break
          if (guard > maxSteps) break // salvaguarda — no debería ocurrir en un grafo planar válido
        }
        faces.push(face)
      }
    }

    for (const f of faces) {
      const pts = f.slice(0, -1).map((id) => byId.get(id)!)
      if (pts.length < 3) continue
      let signedArea = 0
      for (let i = 0; i < pts.length; i++) {
        const p1 = pts[i]
        const p2 = pts[(i + 1) % pts.length]
        signedArea += p1.x * p2.y - p2.x * p1.y
      }
      signedArea /= 2
      if (signedArea <= MIN_AREA_UNITS2) continue // negativa (cara exterior) o casi cero (ruido)

      const centroid = pts.reduce((acc, p) => ({ x: acc.x + p.x / pts.length, y: acc.y + p.y / pts.length }), { x: 0, y: 0 })
      rooms.push({ points: pts, areaM2: signedArea / 10000, centroid })
    }
  }

  return rooms
}
