/** Paleta para diferenciar circuitos derivados a simple vista en el plano —
 *  el usuario elige uno al crear el circuito (`CircuitsPanel.tsx`), se
 *  guarda en `Circuit.color` y se usa para pintar el ducto en
 *  `PlanCanvas.tsx` cuando el circuito queda asignado (etapa "Cableado").
 *  Deliberadamente saturados y distintos entre sí incluso en tema oscuro. */
export const CIRCUIT_PALETTE = [
  '#f87171', '#fb923c', '#facc15', '#4ade80', '#34d399', '#22d3ee',
  '#60a5fa', '#818cf8', '#c084fc', '#f472b6', '#fb7185', '#a3e635'
]

export function nextCircuitColor(usedCount: number): string {
  return CIRCUIT_PALETTE[usedCount % CIRCUIT_PALETTE.length]
}
