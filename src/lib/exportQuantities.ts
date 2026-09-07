import type { LayerKey, Project } from '../types'
import { quantifyLevel } from './quantify'
import { DISPOSITIVO_DEFS, EQUIPO_DEFS, PIEZA_DEFS, PIEZA_HIDRAULICA_DEFS, PRINCIPAL_DEFS } from './stamps'

const LAYER_LABEL: Record<LayerKey, string> = { base: 'Base', drenaje: 'Drenaje', hidraulica: 'Hidráulica', electrica: 'Eléctrica' }

/** Junta las etiquetas de todas las piezas/equipos/dispositivos colocables
 *  — vienen de las mismas listas que ya alimentan la barra de
 *  herramientas y la Simbología, así que la lista de materiales nunca se
 *  desincroniza si se agrega una pieza nueva. */
const SHAPE_LABEL: Record<string, string> = {
  ...Object.fromEntries(Object.entries(PIEZA_DEFS).map(([k, v]) => [k, v.label])),
  ...Object.fromEntries(Object.entries(PIEZA_HIDRAULICA_DEFS).map(([k, v]) => [k, v.label])),
  ...Object.fromEntries(Object.entries(EQUIPO_DEFS).map(([k, v]) => [k, v.label])),
  ...Object.fromEntries(Object.entries(DISPOSITIVO_DEFS).map(([k, v]) => [k, v.label])),
  ...Object.fromEntries(Object.entries(PRINCIPAL_DEFS).map(([k, v]) => [k, v.label])),
  escalera: 'Escalera / acceso entre niveles'
}

const SYMBOL_LAYERS: LayerKey[] = ['drenaje', 'hidraulica', 'electrica', 'base']

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/** Cuantificación real de todo el proyecto (todos los niveles) en formato
 *  CSV — largos de muro/tubería/ducto por nivel, más el conteo de cada
 *  pieza/equipo/dispositivo colocado, para usarse como lista de
 *  materiales de arranque (no sustituye un presupuesto real). */
export function buildQuantitiesCSV(project: Project): string {
  const rows: string[][] = [['Nivel', 'Capa', 'Concepto', 'Cantidad', 'Unidad']]

  for (const level of project.levels) {
    const q = quantifyLevel(level)
    rows.push([level.label, 'Base', 'Muros', q.wallLengthM.toFixed(2), 'm'])
    if (q.drenajeLengthM > 0) rows.push([level.label, 'Drenaje', 'Tubería', q.drenajeLengthM.toFixed(2), 'm'])
    if (q.hidraulicaLengthM > 0) rows.push([level.label, 'Hidráulica', 'Tubería', q.hidraulicaLengthM.toFixed(2), 'm'])
    if (q.electricaLengthM > 0) rows.push([level.label, 'Eléctrica', 'Ductos', q.electricaLengthM.toFixed(2), 'm'])

    for (const layerKey of SYMBOL_LAYERS) {
      const counts = new Map<string, number>()
      for (const o of level.layers[layerKey]) {
        if (o.kind === 'symbol') counts.set(o.shape, (counts.get(o.shape) ?? 0) + 1)
      }
      for (const [shape, count] of counts) {
        rows.push([level.label, LAYER_LABEL[layerKey], SHAPE_LABEL[shape] ?? shape, String(count), 'pza'])
      }
    }
  }

  return rows.map((r) => r.map(csvEscape).join(',')).join('\n')
}

export function downloadQuantitiesCSV(project: Project) {
  const csv = '﻿' + buildQuantitiesCSV(project) // BOM para que Excel detecte UTF-8
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${project.name.replace(/[^\w-]+/g, '_')}_cuantificacion.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
