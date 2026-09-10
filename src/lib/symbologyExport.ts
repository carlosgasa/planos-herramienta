import type { DrawObject, LayerKey, SymbolShape } from '../types'
import { DISPOSITIVO_DEFS, EQUIPO_DEFS, PIEZA_DEFS, PIEZA_HIDRAULICA_DEFS, PRINCIPAL_DEFS } from './stamps'

function labelsOf(defs: Record<string, { label: string }>): Partial<Record<SymbolShape, string>> {
  return Object.fromEntries(Object.entries(defs).map(([k, v]) => [k, v.label]))
}

/** Igual que `SymbologyPanel.tsx` (mismo catálogo, mismas etiquetas) pero
 *  por capa — para exportar solo lo que de verdad se colocó en ESA capa, no
 *  el catálogo completo. "codo"/"tee"/"bajante" existen en más de un
 *  catálogo con etiquetas distintas (p. ej. "bajante" es "Bajante (baja...)"
 *  en drenaje pero "Montante (sube...)" en hidráulica) — por eso el mapa de
 *  etiquetas depende de qué capa se está exportando, no es uno solo global. */
const LAYER_SHAPE_LABELS: Partial<Record<LayerKey, Partial<Record<SymbolShape, string>>>> = {
  base: { escalera: 'Escalera / acceso entre niveles' },
  drenaje: labelsOf(PIEZA_DEFS),
  hidraulica: { ...labelsOf(PIEZA_HIDRAULICA_DEFS), ...labelsOf(EQUIPO_DEFS) },
  electrica: { ...labelsOf(DISPOSITIVO_DEFS), ...labelsOf(PRINCIPAL_DEFS) }
}

export interface UsedSymbol {
  shape: SymbolShape
  label: string
  color: string
}

/** Símbolos realmente colocados en `objects` (una capa de un nivel), sin
 *  duplicados por `shape` — el color de cada uno sale de la primera
 *  instancia encontrada (por ejemplo una pieza hidráulica fría vs caliente
 *  se queda con la del primer colocado, simplificación aceptable para una
 *  leyenda). */
export function usedSymbology(objects: DrawObject[], layer: LayerKey): UsedSymbol[] {
  const labels = LAYER_SHAPE_LABELS[layer] ?? {}
  const seen = new Map<SymbolShape, UsedSymbol>()
  for (const o of objects) {
    if (o.kind !== 'symbol' || seen.has(o.shape)) continue
    seen.set(o.shape, { shape: o.shape, label: labels[o.shape] ?? o.shape, color: o.color })
  }
  return [...seen.values()]
}
