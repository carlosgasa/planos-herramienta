/** Blanco puro — caso especial en `PlanCanvas.tsx`/`CircuitsPanel.tsx`: sin
 *  un contorno negro propio, un circuito blanco se vuelve invisible contra
 *  un fondo también blanco (tema claro, o exportar a PDF, que siempre
 *  fuerza fondo blanco — ver `exportPdf.tsx`). */
export const CIRCUIT_WHITE = '#ffffff'

/** Paleta para diferenciar circuitos derivados a simple vista en el plano —
 *  el usuario elige uno al crear el circuito (`CircuitsPanel.tsx`), se
 *  guarda en `Circuit.color` y se usa para pintar el ducto en
 *  `PlanCanvas.tsx` cuando el circuito queda asignado (etapa "Cableado").
 *  Deliberadamente saturados y distintos entre sí incluso en tema oscuro.
 *  Blanco y negro van al final — únicos dos que necesitan tratamiento
 *  especial de contraste (ver `CIRCUIT_WHITE` arriba). */
export const CIRCUIT_PALETTE = [
  '#f87171', '#fb923c', '#facc15', '#4ade80', '#34d399', '#22d3ee',
  '#60a5fa', '#818cf8', '#c084fc', '#f472b6', '#fb7185', '#a3e635',
  CIRCUIT_WHITE, '#000000'
]

export function nextCircuitColor(usedCount: number): string {
  return CIRCUIT_PALETTE[usedCount % CIRCUIT_PALETTE.length]
}

/** Anillo negro extra para un punto/swatch de color de circuito — solo
 *  hace algo para `CIRCUIT_WHITE`, que si no se pierde contra cualquier
 *  fondo claro (paneles en tema claro, PDF exportado). Se combina con el
 *  `boxShadow` que ya tenga ese elemento (ej. el anillo de "seleccionado"
 *  de la paleta), nunca lo reemplaza. */
export function circuitContourShadow(color: string, existing?: string): string | undefined {
  if (color !== CIRCUIT_WHITE) return existing
  const ring = 'inset 0 0 0 1px #000'
  return existing ? `${existing}, ${ring}` : ring
}
