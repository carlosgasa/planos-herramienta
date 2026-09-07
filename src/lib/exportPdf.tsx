import { createRoot } from 'react-dom/client'
import { PlanCanvas } from '../components/PlanCanvas'
import type { LayerKey, LayerStateMap, LevelKey, Project } from '../types'

function checksToLayerState(checks: Record<LayerKey, boolean>): LayerStateMap {
  const keys: LayerKey[] = ['base', 'drenaje', 'hidraulica', 'electrica']
  const out = {} as LayerStateMap
  for (const k of keys) out[k] = { visible: checks[k], locked: false, opacity: 100 }
  return out
}

export async function exportPlanToPdf(opts: {
  project: Project
  level: LevelKey
  levelLabel: string
  checks: Record<LayerKey, boolean>
}) {
  const { project, level, levelLabel, checks } = opts

  // jsPDF/html2canvas solo se descargan cuando de verdad se exporta — son
  // pesados y esta es una PWA, no vale la pena cargarlos en el arranque.
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf')
  ])

  const host = document.createElement('div')
  host.style.position = 'fixed'
  host.style.left = '-10000px'
  host.style.top = '0'
  host.style.background = '#ffffff'
  host.style.padding = '24px'
  document.body.appendChild(host)

  // El plano se exporta siempre en tema claro (aspecto tipo plano impreso
  // consistente), sin importar el tema que tenga activo la UI en ese
  // momento — los objetos del lienzo se colorean con var(--ink-wall) etc.,
  // que leen del tema puesto en <html>, así que hay que forzarlo ahí
  // mientras se arma la captura y devolverlo al que tenía justo después
  // (el host está fuera de pantalla, pero <html> es compartido con la UI
  // real, por eso el restore en el `finally`).
  const htmlEl = document.documentElement
  const previousTheme = htmlEl.dataset.theme
  htmlEl.dataset.theme = 'light'

  const root = createRoot(host)
  await new Promise<void>((resolve) => {
    root.render(<PlanCanvas level={level} layerStateOverride={checksToLayerState(checks)} />)
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })

  try {
    const canvas = await html2canvas(host, { backgroundColor: '#ffffff', scale: 1.5 })
    const imgData = canvas.toDataURL('image/jpeg', 0.85)

    const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' })
    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()
    const margin = 28
    const titleBlockH = 70
    const availW = pageW - margin * 2
    const availH = pageH - margin * 2 - titleBlockH

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
    pdf.text(project.name, margin + 12, tbY + 20)
    pdf.setFontSize(8)
    pdf.setTextColor(85, 83, 107)
    const activeLayers = (Object.keys(checks) as LayerKey[]).filter((k) => checks[k]).join(', ')
    pdf.text(`NIVEL: ${levelLabel}`, margin + 12, tbY + 38)
    pdf.text(`FECHA: ${new Date().toLocaleDateString('es-MX')}`, margin + 12, tbY + 50)
    pdf.text(`ESCALA: ${project.scaleLabel}`, margin + 200, tbY + 38)
    pdf.text(`CAPAS: ${activeLayers}`, margin + 200, tbY + 50)

    pdf.save(`${project.name.replace(/\s+/g, '_')}_${levelLabel}.pdf`)
  } finally {
    root.unmount()
    document.body.removeChild(host)
    if (previousTheme === undefined) delete htmlEl.dataset.theme
    else htmlEl.dataset.theme = previousTheme
  }
}
