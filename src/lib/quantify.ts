import type { Level } from '../types'

// Nuestras unidades de dibujo son ~1 unidad = 1 cm (una casa de 740 unidades
// de ancho equivale a 7.40 m), de ahí el /100 para pasar a metros.
const UNITS_PER_METER = 100

function polylineLength(d: string): number {
  const re = /([ML])\s*(-?\d+(?:\.\d+)?)[ ,]+(-?\d+(?:\.\d+)?)/g
  let total = 0
  let cx = 0
  let cy = 0
  let started = false
  let m: RegExpExecArray | null
  while ((m = re.exec(d))) {
    const x = parseFloat(m[2])
    const y = parseFloat(m[3])
    if (started) total += Math.hypot(x - cx, y - cy)
    cx = x
    cy = y
    started = true
  }
  return total
}

export function quantifyLevel(level: Level) {
  const wallLength = level.layers.base
    .filter((o) => o.kind === 'wall')
    .reduce((sum, o) => sum + (o.kind === 'wall' ? Math.hypot(o.x2 - o.x1, o.y2 - o.y1) : 0), 0)

  const pipeLength = (layer: typeof level.layers.drenaje) =>
    layer.filter((o) => o.kind === 'path').reduce((sum, o) => sum + (o.kind === 'path' ? polylineLength(o.d) : 0), 0)

  const symbolCount = (layer: typeof level.layers.drenaje) => layer.filter((o) => o.kind === 'symbol').length

  return {
    wallLengthM: wallLength / UNITS_PER_METER,
    drenajeLengthM: pipeLength(level.layers.drenaje) / UNITS_PER_METER,
    hidraulicaLengthM: pipeLength(level.layers.hidraulica) / UNITS_PER_METER,
    electricaLengthM: pipeLength(level.layers.electrica) / UNITS_PER_METER,
    fittingsCount: symbolCount(level.layers.drenaje) + symbolCount(level.layers.hidraulica),
    outletsCount: symbolCount(level.layers.electrica),
    totalElements: level.layers.base.length + level.layers.drenaje.length + level.layers.hidraulica.length + level.layers.electrica.length
  }
}
