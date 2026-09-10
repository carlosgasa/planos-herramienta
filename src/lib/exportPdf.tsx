import { createRoot } from 'react-dom/client'
import { PlanCanvas } from '../components/PlanCanvas'
import { SymbolGlyph } from './symbols'
import { usedSymbology } from './symbologyExport'
import { DEFAULT_CANVAS_BOUNDS, type LayerKey, type LayerStateMap, type Level, type LevelKey, type Project } from '../types'

const LAYER_ORDER: LayerKey[] = ['base', 'drenaje', 'hidraulica', 'electrica']
const LAYER_LABEL: Record<LayerKey, string> = { base: 'Base / Arquitectónica', drenaje: 'Drenaje', hidraulica: 'Hidráulica', electrica: 'Eléctrica' }

/** Estado de capas para la página de UNA sola disciplina: esa capa más
 *  `base` como contexto arquitectónico (una tubería o un ducto sin los
 *  muros alrededor no dice nada) — salvo que la página SEA la de base, ahí
 *  no hay nada más que agregar. `base` se muestra aunque el usuario no la
 *  haya marcado en el modal de exportar: es contexto, no una capa más que
 *  el usuario decide incluir o no. */
function pageLayerState(layer: LayerKey): LayerStateMap {
  const out = {} as LayerStateMap
  for (const k of LAYER_ORDER) out[k] = { visible: k === 'base' || k === layer, locked: false, opacity: 100 }
  return out
}

/** Captura UNA página (una disciplina) a un canvas — host y root nuevos
 *  cada vez, montados, capturados y desmontados antes de pasar a la
 *  siguiente. Reusar el mismo root entre páginas (render → render → …)
 *  dejaba cada captura un paso atrás de lo que de verdad se acababa de
 *  pintar (bug real, encontrado al probar: la página "Drenaje" salía sin
 *  tubería y la de "Hidráulica" mostraba en realidad el contenido de
 *  drenaje) — un root fresco por página es el mismo patrón que ya
 *  funcionaba para la exportación de una sola página, así que evita lo que
 *  sea que causaba ese desfase en vez de intentar diagnosticarlo a fondo. */
async function capturePage(opts: {
  html2canvas: typeof import('html2canvas').default
  level: LevelKey
  lvl: Level
  layer: LayerKey
  pageWidthPx: number
}) {
  const { html2canvas, level, lvl, layer, pageWidthPx } = opts
  const symbols = usedSymbology(lvl.layers[layer], layer)
  const showCircuits = layer === 'electrica' && lvl.circuits.length > 0

  const host = document.createElement('div')
  host.style.position = 'fixed'
  host.style.left = '-10000px'
  host.style.top = '0'
  host.style.background = '#ffffff'
  host.style.padding = '16px'
  document.body.appendChild(host)

  const root = createRoot(host)
  try {
    await new Promise<void>((resolve) => {
      root.render(
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: `${pageWidthPx}px` }}>
          <PlanCanvas level={level} layerStateOverride={pageLayerState(layer)} />
          {(symbols.length > 0 || showCircuits) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 16px', borderTop: '1px solid #ccc', paddingTop: '8px' }}>
              {symbols.map((s) => (
                <div key={s.shape} style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <svg width={20} height={20} viewBox="-16 -16 32 32"><SymbolGlyph shape={s.shape} color={s.color} /></svg>
                  <span style={{ fontSize: '9px', color: '#333', fontFamily: 'monospace' }}>{s.label}</span>
                </div>
              ))}
              {showCircuits && lvl.circuits.map((c) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: c.color, display: 'inline-block' }} />
                  <span style={{ fontSize: '9px', color: '#333', fontFamily: 'monospace' }}>{c.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })
    return await html2canvas(host, { backgroundColor: '#ffffff', scale: 1.5 })
  } finally {
    root.unmount()
    document.body.removeChild(host)
  }
}

export async function exportPlanToPdf(opts: {
  project: Project
  level: LevelKey
  levelLabel: string
  checks: Record<LayerKey, boolean>
}) {
  const { project, level, levelLabel, checks } = opts
  const lvl = project.levels.find((l) => l.key === level)
  if (!lvl) return
  const layers = LAYER_ORDER.filter((k) => checks[k])
  if (layers.length === 0) return

  // jsPDF/html2canvas solo se descargan cuando de verdad se exporta — son
  // pesados y esta es una PWA, no vale la pena cargarlos en el arranque.
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf')
  ])

  const bounds = lvl.bounds ?? DEFAULT_CANVAS_BOUNDS
  const pageWidthPx = bounds.maxX - bounds.minX

  // El plano se exporta siempre en tema claro (aspecto tipo plano impreso
  // consistente), sin importar el tema que tenga activo la UI en ese
  // momento — los objetos del lienzo se colorean con var(--ink-wall) etc.,
  // que leen del tema puesto en <html>, así que hay que forzarlo ahí
  // mientras se arma cada captura y devolverlo al que tenía justo después
  // (cada host está fuera de pantalla, pero <html> es compartido con la UI
  // real, por eso el restore en el `finally`).
  const htmlEl = document.documentElement
  const previousTheme = htmlEl.dataset.theme
  htmlEl.dataset.theme = 'light'

  try {
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' })
    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()
    const margin = 14
    const titleBlockH = 56
    const availW = pageW - margin * 2
    const availH = pageH - margin * 2 - titleBlockH

    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i]
      const canvas = await capturePage({ html2canvas, level, lvl, layer, pageWidthPx })
      const imgData = canvas.toDataURL('image/jpeg', 0.85)

      if (i > 0) pdf.addPage()

      const ratio = Math.min(availW / canvas.width, availH / canvas.height)
      const w = canvas.width * ratio
      const h = canvas.height * ratio
      const x = margin + (availW - w) / 2
      const y = margin

      pdf.setFillColor(255, 255, 255)
      pdf.rect(0, 0, pageW, pageH, 'F')
      pdf.addImage(imgData, 'JPEG', x, y, w, h)

      const tbY = pageH - margin - titleBlockH
      pdf.setDrawColor(200, 200, 210)
      pdf.rect(margin, tbY, availW, titleBlockH)
      pdf.setTextColor(26, 26, 36)
      pdf.setFontSize(11)
      pdf.text(project.name, margin + 12, tbY + 18)
      pdf.setFontSize(8)
      pdf.setTextColor(85, 83, 107)
      pdf.text(`NIVEL: ${levelLabel}`, margin + 12, tbY + 34)
      pdf.text(`CAPA: ${LAYER_LABEL[layer]}`, margin + 12, tbY + 46)
      pdf.text(`FECHA: ${new Date().toLocaleDateString('es-MX')}`, margin + 200, tbY + 34)
      pdf.text(`ESCALA: ${project.scaleLabel}`, margin + 200, tbY + 46)
      pdf.text(`PÁGINA ${i + 1} DE ${layers.length}`, pageW - margin - 90, tbY + 46)
    }

    pdf.save(`${project.name.replace(/\s+/g, '_')}_${levelLabel}.pdf`)
  } finally {
    if (previousTheme === undefined) delete htmlEl.dataset.theme
    else htmlEl.dataset.theme = previousTheme
  }
}
