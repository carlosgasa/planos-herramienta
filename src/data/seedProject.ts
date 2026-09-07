import type { DrawObject, Level, Project } from '../types'

const wall = (id: string, x1: number, y1: number, x2: number, y2: number, thickness = 16): DrawObject => ({
  id, kind: 'wall', x1, y1, x2, y2, thickness
})

const piso1Base: DrawObject[] = [
  wall('w1', 40, 40, 130, 40), wall('w2', 210, 40, 480, 40), wall('w3', 560, 40, 780, 40),
  wall('w4', 780, 40, 780, 100), wall('w5', 780, 180, 780, 420), wall('w6', 780, 480, 780, 560),
  wall('w7', 780, 560, 370, 560), wall('w8', 300, 560, 40, 560),
  wall('w9', 40, 560, 40, 430), wall('w10', 40, 350, 40, 40),
  wall('w11', 420, 40, 420, 150, 14), wall('w12', 420, 220, 420, 400, 14), wall('w13', 420, 470, 420, 560, 14),
  wall('w14', 420, 300, 780, 300, 14), wall('w15', 620, 300, 620, 400, 14), wall('w16', 620, 470, 620, 560, 14),
  { id: 'd1', kind: 'doorArc', hingeX: 300, hingeY: 560, leafX: 300, leafY: 490, sweep: 'M 300 490 A 70 70 0 0 1 370 560' },
  { id: 'd2', kind: 'doorArc', hingeX: 420, hingeY: 150, leafX: 490, leafY: 150, sweep: 'M 490 150 A 70 70 0 0 1 420 220' },
  { id: 'd3', kind: 'doorArc', hingeX: 420, hingeY: 400, leafX: 490, leafY: 400, sweep: 'M 490 400 A 70 70 0 0 1 420 470' },
  { id: 'd4', kind: 'doorArc', hingeX: 620, hingeY: 400, leafX: 690, leafY: 400, sweep: 'M 690 400 A 70 70 0 0 1 620 470' },
  { id: 'win1', kind: 'window', x: 130, y: 34, w: 80, h: 12 },
  { id: 'win2', kind: 'window', x: 480, y: 34, w: 80, h: 12 },
  { id: 'win3', kind: 'window', x: 774, y: 100, w: 12, h: 80 },
  { id: 'win4', kind: 'window', x: 774, y: 420, w: 12, h: 60 },
  { id: 'win5', kind: 'window', x: 34, y: 350, w: 12, h: 80 },
  { id: 'dome1', kind: 'dome', x: 680, y: 380, w: 60, h: 40, label: 'DOMO' },
  { id: 'txt-sala', kind: 'text', x: 230, y: 500, text: 'SALA / COCINA', color: 'var(--text-secondary)', anchor: 'middle' },
  { id: 'txt-r1', kind: 'text', x: 600, y: 185, text: 'RECÁMARA 1', color: 'var(--text-secondary)', anchor: 'middle' },
  { id: 'txt-r2', kind: 'text', x: 500, y: 525, text: 'RECÁMARA 2', color: 'var(--text-secondary)', anchor: 'middle' },
  { id: 'txt-bano', kind: 'text', x: 700, y: 510, text: 'BAÑO', color: 'var(--text-secondary)', anchor: 'middle' },
  { id: 'stair-lbl', kind: 'text', x: 60, y: 170, text: '▲ SUBE', color: 'var(--circuit-contactos)' }
]

const piso1Drenaje: DrawObject[] = [
  { id: 'dr-trunk', kind: 'path', d: 'M700 520 L400 540 L370 560 L370 598', stroke: 'var(--layer-drenaje)', strokeWidth: 2.6, animated: true },
  { id: 'dr-branch', kind: 'path', d: 'M150 470 L150 540 L370 540', stroke: 'var(--layer-drenaje)', strokeWidth: 2 },
  { id: 'dr-f1', kind: 'circle', cx: 370, cy: 540, r: 5, stroke: 'none', fill: 'var(--fitting-hl)' },
  { id: 'dr-f2', kind: 'circle', cx: 700, cy: 520, r: 5, stroke: 'none', fill: 'var(--fitting-hl)' },
  { id: 'dr-f3', kind: 'circle', cx: 370, cy: 560, r: 5, stroke: 'none', fill: 'var(--fitting-hl)' },
  { id: 'dr-txt1', kind: 'text', x: 540, y: 533, text: '4"', color: 'var(--layer-drenaje)' },
  { id: 'dr-txt2', kind: 'text', x: 200, y: 463, text: '2"', color: 'var(--layer-drenaje)' }
]

const piso1Hidraulica: DrawObject[] = [
  { id: 'hi-toma', kind: 'circle', cx: 300, cy: 600, r: 6, stroke: 'var(--pipe-fria)' },
  { id: 'hi-riser', kind: 'path', d: 'M300 594 L300 520', stroke: 'var(--pipe-fria)', strokeWidth: 2.4 },
  { id: 'hi-valve', kind: 'circle', cx: 300, cy: 520, r: 4.5, stroke: 'var(--pipe-fria)' },
  { id: 'hi-k', kind: 'path', d: 'M300 520 L150 520 L150 470', stroke: 'var(--pipe-fria)', strokeWidth: 2 },
  { id: 'hi-c', kind: 'path', d: 'M300 520 L610 490', stroke: 'var(--pipe-fria)', strokeWidth: 2 },
  { id: 'hi-w', kind: 'path', d: 'M300 520 L720 520', stroke: 'var(--pipe-fria)', strokeWidth: 2 },
  { id: 'hi-cp', kind: 'rect', x: 605, y: 470, w: 35, h: 30, stroke: 'var(--pipe-fria)', fill: 'rgba(56,189,248,0.08)' },
  { id: 'hi-hot1', kind: 'path', d: 'M622 470 L700 480', stroke: 'var(--pipe-caliente)', strokeWidth: 2 },
  { id: 'hi-hot2', kind: 'path', d: 'M622 470 L650 520', stroke: 'var(--pipe-caliente)', strokeWidth: 2 },
  { id: 'hi-txt1', kind: 'text', x: 330, y: 513, text: 'CPVC 1/2"', color: 'var(--pipe-fria)' },
  { id: 'hi-txt2', kind: 'text', x: 270, y: 505, text: '35 PSI', color: '#a5f3fc' }
]

const piso1Electrica: DrawObject[] = [
  { id: 'el-panel', kind: 'rect', x: 175, y: 90, w: 32, h: 30, stroke: 'var(--layer-electrica)', fill: 'rgba(192,132,252,0.08)' },
  { id: 'el-panel-lbl', kind: 'text', x: 191, y: 108, text: 'TABLERO', color: 'var(--layer-electrica)', anchor: 'middle', size: 7 },
  { id: 'el-trunk', kind: 'path', d: 'M207 105 L600 105', stroke: 'var(--layer-electrica)', strokeWidth: 1.3, dashed: true },
  { id: 'el-drop1', kind: 'path', d: 'M230 105 L230 300', stroke: 'var(--layer-electrica)', strokeWidth: 1.3, dashed: true },
  { id: 'el-drop2', kind: 'path', d: 'M600 105 L600 170', stroke: 'var(--layer-electrica)', strokeWidth: 1.3, dashed: true },
  { id: 'el-drop3', kind: 'path', d: 'M520 105 L520 430', stroke: 'var(--layer-electrica)', strokeWidth: 1.3, dashed: true },
  { id: 'el-drop4', kind: 'path', d: 'M700 105 L700 430', stroke: 'var(--layer-electrica)', strokeWidth: 1.3, dashed: true },
  { id: 'el-lamp1', kind: 'circle', cx: 230, cy: 300, r: 8, stroke: 'var(--circuit-iluminacion)' },
  { id: 'el-lamp2', kind: 'circle', cx: 600, cy: 170, r: 8, stroke: 'var(--circuit-iluminacion)' },
  { id: 'el-lamp3', kind: 'circle', cx: 520, cy: 430, r: 8, stroke: 'var(--circuit-iluminacion)' },
  { id: 'el-lamp4', kind: 'circle', cx: 700, cy: 430, r: 8, stroke: 'var(--circuit-iluminacion)' },
  { id: 'el-outlet1', kind: 'circle', cx: 60, cy: 500, r: 6, stroke: 'var(--circuit-contactos)' },
  { id: 'el-outlet2', kind: 'circle', cx: 700, cy: 90, r: 6, stroke: 'var(--circuit-contactos)' },
  { id: 'el-sw1', kind: 'circle', cx: 260, cy: 540, r: 6, stroke: 'var(--circuit-iluminacion)' },
  { id: 'el-sw2', kind: 'circle', cx: 450, cy: 410, r: 6, stroke: 'var(--circuit-iluminacion)' }
]

const piso2Base: DrawObject[] = [
  wall('w1', 40, 40, 130, 40), wall('w2', 210, 40, 480, 40), wall('w3', 560, 40, 780, 40),
  wall('w4', 780, 40, 780, 100), wall('w5', 780, 180, 780, 560),
  wall('w7', 780, 560, 40, 560),
  wall('w9', 40, 560, 40, 430), wall('w10', 40, 350, 40, 40),
  wall('w11', 420, 40, 420, 150, 14), wall('w12', 420, 220, 420, 400, 14), wall('w13', 420, 470, 420, 560, 14),
  wall('w14', 420, 300, 780, 300, 14),
  { id: 'd2', kind: 'doorArc', hingeX: 420, hingeY: 150, leafX: 490, leafY: 150, sweep: 'M 490 150 A 70 70 0 0 1 420 220' },
  { id: 'd3', kind: 'doorArc', hingeX: 420, hingeY: 400, leafX: 490, leafY: 400, sweep: 'M 490 400 A 70 70 0 0 1 420 470' },
  { id: 'win1', kind: 'window', x: 130, y: 34, w: 80, h: 12 },
  { id: 'win2', kind: 'window', x: 480, y: 34, w: 80, h: 12 },
  { id: 'win5', kind: 'window', x: 34, y: 350, w: 12, h: 80 },
  { id: 'txt-r3', kind: 'text', x: 600, y: 185, text: 'RECÁMARA 3', color: 'var(--text-secondary)', anchor: 'middle' },
  { id: 'txt-rp', kind: 'text', x: 600, y: 440, text: 'RECÁMARA PRINCIPAL', color: 'var(--text-secondary)', anchor: 'middle' },
  { id: 'stair-lbl', kind: 'text', x: 60, y: 170, text: '▼ BAJA · ▲ SUBE', color: 'var(--text-secondary)', size: 9 }
]

const piso2Hidraulica: DrawObject[] = [
  { id: 'hi2', kind: 'path', d: 'M600 300 L600 450 L520 450', stroke: 'var(--pipe-fria)', strokeWidth: 2 },
  { id: 'hi2-riser', kind: 'circle', cx: 100, cy: 165, r: 4, stroke: 'var(--pipe-fria)' },
  { id: 'hi2-lbl', kind: 'text', x: 118, y: 168, text: 'MONTANTE', color: '#5b7a90', size: 7.5 }
]

const piso2Electrica: DrawObject[] = [
  { id: 'el2-lamp1', kind: 'circle', cx: 600, cy: 170, r: 8, stroke: 'var(--circuit-iluminacion)' },
  { id: 'el2-lamp2', kind: 'circle', cx: 600, cy: 440, r: 8, stroke: 'var(--circuit-iluminacion)' }
]

const azoteaBase: DrawObject[] = [
  { id: 'az-parapet', kind: 'rect', x: 40, y: 40, w: 740, h: 520, stroke: 'var(--ink-wall)', dashed: true },
  { id: 'az-stair-lbl', kind: 'text', x: 60, y: 170, text: '▼ BAJA', color: 'var(--text-secondary)', size: 9 },
  { id: 'az-lbl', kind: 'text', x: 400, y: 300, text: 'AZOTEA', color: 'var(--text-tertiary)', anchor: 'middle', size: 12 }
]

const azoteaHidraulica: DrawObject[] = [
  { id: 'az-tinaco', kind: 'rect', x: 560, y: 120, w: 90, h: 60, stroke: 'var(--pipe-fria)', fill: 'rgba(56,189,248,0.08)' },
  { id: 'az-tinaco-lbl', kind: 'text', x: 605, y: 155, text: 'TINACO 1100 L', color: 'var(--pipe-fria)', anchor: 'middle', size: 8.5 },
  { id: 'az-calent', kind: 'rect', x: 200, y: 420, w: 110, h: 60, stroke: 'var(--pipe-caliente)', fill: 'rgba(251,113,133,0.06)' },
  { id: 'az-calent-lbl', kind: 'text', x: 255, y: 453, text: 'CALENTADOR SOLAR', color: 'var(--pipe-caliente)', anchor: 'middle', size: 8 },
  { id: 'az-pipe', kind: 'path', d: 'M605 180 L605 240 L100 240 L100 161', stroke: 'var(--pipe-fria)', strokeWidth: 2 }
]

const azoteaDrenaje: DrawObject[] = [
  { id: 'az-vent', kind: 'path', d: 'M700 40 L700 10', stroke: 'var(--layer-drenaje)', strokeWidth: 2.4 },
  { id: 'az-vent-cap', kind: 'circle', cx: 700, cy: 8, r: 5, stroke: 'var(--layer-drenaje)' },
  { id: 'az-vent-lbl', kind: 'text', x: 700, y: 26, text: 'VENTEO', color: 'var(--layer-drenaje)', anchor: 'middle', size: 8.5 }
]

export function makeSeedProject(name = 'Casa Reforma 142 (ejemplo)'): Project {
  const now = Date.now()
  return {
    id: `demo-${now}`,
    name,
    scaleLabel: '1:75',
    createdAt: now,
    updatedAt: now,
    levels: [
      { key: 'piso1', label: 'PISO 1', circuits: [], layers: { base: piso1Base, drenaje: piso1Drenaje, hidraulica: piso1Hidraulica, electrica: piso1Electrica } },
      { key: 'piso2', label: 'PISO 2', circuits: [], layers: { base: piso2Base, drenaje: [], hidraulica: piso2Hidraulica, electrica: piso2Electrica } },
      { key: 'azotea', label: 'AZOTEA', circuits: [], layers: { base: azoteaBase, drenaje: azoteaDrenaje, hidraulica: azoteaHidraulica, electrica: [] } }
    ]
  }
}

export function emptyLayers() {
  return { base: [] as DrawObject[], drenaje: [] as DrawObject[], hidraulica: [] as DrawObject[], electrica: [] as DrawObject[] }
}

export function makeBlankLevel(key: string, label: string): Level {
  return { key, label, circuits: [], layers: emptyLayers() }
}

export function makeBlankProject(name: string): Project {
  const now = Date.now()
  return {
    id: `proj-${now}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    scaleLabel: '1:75',
    createdAt: now,
    updatedAt: now,
    levels: [makeBlankLevel('piso1', 'PISO 1')]
  }
}
