import type { DrawObject } from '../types'

function pointToSegDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1
  const dy = y2 - y1
  const lenSq = dx * dx + dy * dy
  let t = lenSq === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

function parsePathPoints(d: string): { x: number; y: number }[] {
  const re = /([ML])\s*(-?\d+(?:\.\d+)?)[ ,]+(-?\d+(?:\.\d+)?)/g
  const pts: { x: number; y: number }[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(d))) pts.push({ x: parseFloat(m[2]), y: parseFloat(m[3]) })
  return pts
}

/** Desplaza TODOS los puntos de un `d` de SVG por (dx,dy), sin importar
 *  cuántos M/L tenga — sirve tanto para una tubería de 2 puntos como para
 *  una cota (varios subtrazos) o un trazo de pincel (muchos puntos). */
export function shiftPathData(d: string, dx: number, dy: number): string {
  return d.replace(/([ML])\s*(-?\d+(?:\.\d+)?)[ ,]+(-?\d+(?:\.\d+)?)/g, (_match, cmd, x, y) => {
    return `${cmd} ${parseFloat(x) + dx} ${parseFloat(y) + dy}`
  })
}

/** Distancia del punto al objeto si cae dentro de un margen razonable para
 *  seleccionarlo con el mouse, o null si no aplica. Exportada (además de
 *  usarse en `findObjectNear`) porque `CanvasViewport` la usa directo para
 *  priorizar el objeto ya seleccionado antes de buscar "el más cercano" —
 *  ver comentario en ese archivo. */
export function hitDistance(o: DrawObject, px: number, py: number): number | null {
  switch (o.kind) {
    case 'wall': {
      const d = pointToSegDist(px, py, o.x1, o.y1, o.x2, o.y2)
      return d < o.thickness / 2 + 8 ? d : null
    }
    case 'path': {
      const pts = parsePathPoints(o.d)
      let best = Infinity
      for (let i = 0; i < pts.length - 1; i++) best = Math.min(best, pointToSegDist(px, py, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y))
      return best < o.strokeWidth / 2 + 8 ? best : null
    }
    case 'circle': {
      const d = Math.hypot(px - o.cx, py - o.cy)
      return d < o.r + 6 ? d : null
    }
    case 'symbol': {
      const d = Math.hypot(px - o.x, py - o.y)
      return d < 24 * (o.scale ?? 1) ? d : null
    }
    case 'rect':
      return px >= o.x - 4 && px <= o.x + o.w + 4 && py >= o.y - 4 && py <= o.y + o.h + 4 ? 0 : null
    case 'dome':
      return px >= o.x - 4 && px <= o.x + o.w + 4 && py >= o.y - 4 && py <= o.y + o.h + 4 ? 0 : null
    case 'window':
      return px >= o.x - 4 && px <= o.x + o.w + 4 && py >= o.y - 4 && py <= o.y + o.h + 4 ? 0 : null
    case 'text': {
      const d = Math.hypot(px - o.x, py - o.y)
      return d < 20 ? d : null
    }
    case 'doorArc': {
      // Sin manija propia: se selecciona por cercanía a la hoja (línea recta
      // bisagra→hoja, la que sí se dibuja) o al arco de barrido (círculo de
      // radio = ancho de la puerta centrado en la bisagra; el punto final
      // del arco viene embebido al final del string `sweep`, ver wallEdit.ts).
      // Antes esto regresaba `null` siempre — la puerta nunca se podía
      // seleccionar con clic, y por lo tanto tampoco borrar (bug real,
      // reportado).
      const dLeaf = pointToSegDist(px, py, o.hingeX, o.hingeY, o.leafX, o.leafY)
      const nums = o.sweep.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? []
      const otherX = nums[nums.length - 2] ?? o.leafX
      const otherY = nums[nums.length - 1] ?? o.leafY
      const dOther = pointToSegDist(px, py, o.hingeX, o.hingeY, otherX, otherY)
      const radius = Math.hypot(o.leafX - o.hingeX, o.leafY - o.hingeY)
      const dArc = Math.abs(Math.hypot(px - o.hingeX, py - o.hingeY) - radius)
      const best = Math.min(dLeaf, dOther, dArc)
      return best < 9 ? best : null
    }
  }
}

export interface Handle {
  id: string
  x: number
  y: number
}

/** Extremos que se pueden arrastrar de un objeto ya seleccionado para
 *  "estirarlo" (mover solo una punta). Un símbolo/círculo no tiene dos
 *  puntas — esos se mueven completos arrastrando su cuerpo, no por manija
 *  (ver `CanvasViewport`), así que no aparecen aquí. */
export function getHandles(o: DrawObject): Handle[] {
  switch (o.kind) {
    case 'wall':
      return [{ id: 'p1', x: o.x1, y: o.y1 }, { id: 'p2', x: o.x2, y: o.y2 }]
    case 'path': {
      const pts = parsePathPoints(o.d)
      return pts.length === 2 ? [{ id: 'p1', x: pts[0].x, y: pts[0].y }, { id: 'p2', x: pts[1].x, y: pts[1].y }] : []
    }
    case 'dome':
      return [{ id: 'resize', x: o.x + o.w, y: o.y + o.h }]
    case 'rect':
      return [{ id: 'resize', x: o.x + o.w, y: o.y + o.h }]
    default:
      return []
  }
}

/** Imán a puntas de muros/tuberías/ductos ya dibujados en la misma capa —
 *  sin esto casi ningún clic cae exacto sobre la esquina de otro objeto
 *  (el snap a la cuadrícula de 10 unidades ya no basta para eso), y las
 *  uniones en T terminan con una micro-separación que ni se ve pero rompe
 *  la detección de habitaciones cerradas. */
export function findNearbyEndpoint(objs: DrawObject[], px: number, py: number, maxDist: number): { x: number; y: number } | null {
  const candidates: { x: number; y: number }[] = []
  for (const o of objs) {
    if (o.kind === 'wall') { candidates.push({ x: o.x1, y: o.y1 }, { x: o.x2, y: o.y2 }) }
    else if (o.kind === 'path') { candidates.push(...parsePathPoints(o.d)) }
  }
  let best: { x: number; y: number; dist: number } | null = null
  for (const c of candidates) {
    const d = Math.hypot(px - c.x, py - c.y)
    if (d <= maxDist && (!best || d < best.dist)) best = { x: c.x, y: c.y, dist: d }
  }
  return best
}

export function findObjectNear(objs: DrawObject[], px: number, py: number, maxDist = 20): { obj: DrawObject; dist: number } | null {
  let best: { obj: DrawObject; dist: number } | null = null
  for (const o of objs) {
    const d = hitDistance(o, px, py)
    if (d !== null && d < maxDist && (!best || d < best.dist)) best = { obj: o, dist: d }
  }
  return best
}
