import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent } from 'react'
import { PlanCanvas, type DragPreview } from './PlanCanvas'
import { CircuitsPanel } from './CircuitsPanel'
import { useProjectStore, type ToolKey } from '../store/useProjectStore'
import { getHandles, hitDistance } from '../lib/hitTest'
import { DEFAULT_CANVAS_BOUNDS, type LayerKey } from '../types'

const MIN_SCALE = 0.15
const MAX_SCALE = 4
const FIT_PADDING = 48
const LAYER_ORDER: LayerKey[] = ['base', 'drenaje', 'hidraulica', 'electrica']

const LAYER_LABEL: Record<LayerKey, string> = { base: 'Base', drenaje: 'Drenaje', hidraulica: 'Hidráulica', electrica: 'Eléctrica' }

const HINTS: Partial<Record<ToolKey, { layer: LayerKey; text: string; color?: string }>> = {
  select: { layer: 'base', text: 'Clic para seleccionar (clic de nuevo en el mismo punto para ciclar entre objetos amontonados) · arrastra el punto o el objeto para moverlo · R rota · Supr borra' },
  wall: { layer: 'base', text: 'Clic para iniciar el muro · clic para cada tramo (cualquier ángulo) · doble clic o Esc para terminar' },
  door: { layer: 'base', text: 'Clic sobre un muro para abrir una puerta' },
  window: { layer: 'base', text: 'Clic sobre un muro para abrir una ventana' },
  domo: { layer: 'base', text: 'Clic en una esquina y clic en la opuesta para dibujar el domo' },
  rectangulo: { layer: 'base', text: 'Clic en una esquina y clic en la opuesta para dibujar el rectángulo' },
  cota: { layer: 'base', text: 'Clic en el primer punto y clic en el segundo para acotar la distancia' },
  escalera: { layer: 'base', text: 'Clic para marcar el acceso a otro nivel — selecciónala y usa R para orientar la flecha hacia donde sube' },
  pincel: { layer: 'base', text: 'Arrastra para dibujar a mano alzada' },
  etiqueta: { layer: 'base', text: 'Clic para escribir una etiqueta libre' },
  drenajeTuberia: { layer: 'drenaje', color: 'var(--layer-drenaje)', text: 'Clic para iniciar la tubería (origen del flujo) · clic para cada tramo · doble clic o Esc para terminar' },
  drenajePieza: { layer: 'drenaje', color: 'var(--layer-drenaje)', text: 'Clic para colocar la pieza seleccionada' },
  hidraulicaTuberia: { layer: 'hidraulica', color: 'var(--layer-hidraulica)', text: 'Clic para iniciar la tubería (origen del flujo) · clic para cada tramo · doble clic o Esc para terminar' },
  hidraulicaEquipo: { layer: 'hidraulica', color: 'var(--layer-hidraulica)', text: 'Clic para colocar el equipo · tecla R para rotarlo antes de soltar' },
  hidraulicaPieza: { layer: 'hidraulica', color: 'var(--layer-hidraulica)', text: 'Clic para colocar la pieza seleccionada' },
  hidraulicaPresion: { layer: 'hidraulica', color: 'var(--layer-hidraulica)', text: 'Clic en un punto de la tubería y escribe la presión (PSI)' },
  electricaDucto: { layer: 'electrica', color: 'var(--layer-electrica)', text: 'Clic para iniciar el ducto (techo o bajada por muro) · doble clic o Esc para terminar' },
  electricaTablero: { layer: 'electrica', color: 'var(--layer-electrica)', text: 'Clic para colocar lo seleccionado (tablero, acometida o tierra)' },
  electricaDispositivo: { layer: 'electrica', color: 'var(--layer-electrica)', text: 'Clic para colocar el dispositivo seleccionado' }
}

type ObjDrag =
  | { kind: 'translate'; ids: string[]; layer: LayerKey; startX: number; startY: number; moved: boolean }
  | { kind: 'endpoint'; id: string; layer: LayerKey; handleId: string; startX: number; startY: number; moved: boolean }

export function CanvasViewport() {
  const [scale, setScale] = useState(1)
  const [tx, setTx] = useState(0)
  const [ty, setTy] = useState(0)
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null)
  // Barra espaciadora = paneo temporal (como Photoshop), sin importar qué
  // herramienta esté activa — se restaura sola al soltar la tecla.
  const [spacePanning, setSpacePanning] = useState(false)
  const dragging = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null)
  const objDrag = useRef<ObjDrag | null>(null)
  // Al soltar un paneo con espacio, el navegador dispara igual un
  // mousedown/click "de verdad" en el `<svg>` de abajo — a diferencia de
  // touch, con mouse real esos eventos NO son sintéticos de compatibilidad,
  // así que `preventDefault()` en el `pointerdown` no los evita (se probó,
  // el click fantasma seguía colando el primer punto de un tramo). Se
  // consume ese único click siguiente en fase de captura en vez de eso.
  const suppressNextClick = useRef(false)
  // Pellizcar para hacer zoom (tablet/móvil): dos dedos activos a la vez.
  // El escalado sale de la razón de distancias entre dedos; el paneo, del
  // desplazamiento del punto medio — ambos en píxeles de pantalla, igual
  // que ya usa el paneo de un solo dedo, así no hace falta invertir la
  // transformación CSS completa (translate+scale con transform-origin al
  // centro) para anclar el zoom exactamente bajo los dedos.
  const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map())
  const pinch = useRef<{ startDist: number; startScale: number; startMidX: number; startMidY: number; startTx: number; startTy: number } | null>(null)
  // Selección entre objetos amontonados: si el clic vuelve a caer casi en el
  // mismo punto que el clic anterior, en vez de repetir "el más cercano" se
  // avanza al siguiente candidato bajo el cursor (ciclando) — necesario
  // porque con varias piezas juntas (p. ej. un "Y" de drenaje justo sobre el
  // empalme de dos tuberías) el objeto visualmente más obvio no siempre es
  // el matemáticamente más cercano al punto exacto del clic, y antes ese
  // desempate por distancia ganaba siempre, sin forma de alcanzar al resto
  // (bug real, reportado). `order` guarda los candidatos de ESE punto en el
  // mismo orden que se mostraron la vez anterior, para saber cuál sigue.
  const clickCycle = useRef<{ x: number; y: number; order: { layer: LayerKey; id: string }[]; index: number } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const activeTool = useProjectStore((s) => s.activeTool)
  const layerState = useProjectStore((s) => s.layerState)
  const level = useProjectStore((s) => s.level)
  const project = useProjectStore((s) => s.project)
  const selection = useProjectStore((s) => s.selection)
  const multiSelection = useProjectStore((s) => s.multiSelection)
  const select = useProjectStore((s) => s.select)
  const toggleMultiSelect = useProjectStore((s) => s.toggleMultiSelect)
  const nudgeMultiSelection = useProjectStore((s) => s.nudgeMultiSelection)
  const nudgeSelected = useProjectStore((s) => s.nudgeSelected)
  const setHandlePoint = useProjectStore((s) => s.setHandlePoint)
  const toggleLayerVisible = useProjectStore((s) => s.toggleLayerVisible)
  const toggleLayerLock = useProjectStore((s) => s.toggleLayerLock)
  const panEnabled = activeTool === 'select' || spacePanning
  const hintDef = HINTS[activeTool]

  // Mantener presionada la barra espaciadora activa el paneo aunque haya
  // otra herramienta de dibujo activa — se ignora si el foco está en un
  // campo de texto (nombre de nivel, etiqueta, presión…) para no robarle el
  // espacio literal que el usuario esté escribiendo ahí.
  useEffect(() => {
    const isTyping = (target: EventTarget | null) => {
      const el = target as HTMLElement | null
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || isTyping(e.target)) return
      e.preventDefault()
      setSpacePanning(true)
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      setSpacePanning(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  const fitToContainer = () => {
    const el = rootRef.current
    if (!el) return
    const bounds = project?.levels.find((l) => l.key === level)?.bounds ?? DEFAULT_CANVAS_BOUNDS
    const { width, height } = el.getBoundingClientRect()
    const availW = Math.max(100, width - FIT_PADDING * 2)
    const availH = Math.max(100, height - FIT_PADDING * 2)
    const boundsW = bounds.maxX - bounds.minX
    const boundsH = bounds.maxY - bounds.minY
    const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.min(availW / boundsW, availH / boundsH)))
    setScale(next)
    setTx(0)
    setTy(0)
  }

  // Ajusta el plano al espacio disponible al abrir un proyecto o cambiar de
  // nivel — así el lienzo se ve grande de entrada en vez de arrancar a 100%
  // sin importar qué tan chica sea la ventana. No depende de `bounds`: al
  // agrandar/reducir el lienzo desde los botones no se quiere reencuadrar
  // solo, se pierde la referencia de dónde estabas parado.
  useEffect(() => { fitToContainer() }, [project?.id, level])

  useEffect(() => {
    const el = rootRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => fitToContainer())
    ro.observe(el)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // El div del lienzo se centra con flexbox: si su ancho/alto cambia (al
  // agrandar/reducir desde los botones de borde), AMBOS lados se recorren
  // en pantalla la mitad de lo que cambió el tamaño (es geometría del
  // centrado, no un bug de layout) — sentía como "se encoge todo el
  // lienzo" en vez de "solo el lado que toqué" (bug real, reportado).
  // Compensamos corriendo tx/ty la mitad de ese delta (ya en screen-px,
  // multiplicado por el scale actual) en la dirección contraria, así el
  // lado OPUESTO al que se tocó queda fijo en pantalla y solo se mueve el
  // lado correcto. `scaleRef` evita que este callback cambie de identidad
  // en cada tick de zoom (rompería el React.memo de PlanCanvas — ver nota
  // en ese archivo).
  const scaleRef = useRef(scale)
  useEffect(() => { scaleRef.current = scale }, [scale])
  const handleResizeSide = useCallback((side: 'top' | 'bottom' | 'left' | 'right', delta: number) => {
    useProjectStore.getState().resizeCanvas(side, delta)
    const half = (scaleRef.current * delta) / 2
    if (side === 'right') setTx((prev) => prev + half)
    else if (side === 'left') setTx((prev) => prev - half)
    else if (side === 'bottom') setTy((prev) => prev + half)
    else setTy((prev) => prev - half)
  }, [])

  // React attaches wheel listeners as passive, so preventDefault() there is a
  // silent no-op — a native listener is required to stop page/canvas scroll
  // while zooming with the mouse wheel.
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s - e.deltaY * 0.0015)))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Igual que en PlanCanvas: usar la CTM real del SVG en vez de recalcular
  // con getBoundingClientRect evita desalineaciones con escalado de pantalla.
  const svgPoint = (e: PointerEvent): { x: number; y: number } | null => {
    const svg = rootRef.current?.querySelector('svg')
    if (!svg) return null
    const ctm = svg.getScreenCTM()
    if (!ctm) return null
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const svgP = pt.matrixTransform(ctm.inverse())
    return { x: svgP.x, y: svgP.y }
  }

  const onPointerDown = (e: PointerEvent) => {
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (activePointers.current.size === 2) {
      // Un segundo dedo llegó — cancela cualquier arrastre de un solo dedo
      // en curso y arranca el pellizco.
      objDrag.current = null
      dragging.current = null
      setDragPreview(null)
      const [a, b] = [...activePointers.current.values()]
      pinch.current = { startDist: Math.hypot(a.x - b.x, a.y - b.y), startScale: scale, startMidX: (a.x + b.x) / 2, startMidY: (a.y + b.y) / 2, startTx: tx, startTy: ty }
      return
    }
    if (spacePanning) {
      // La barra espaciadora manda sobre cualquier herramienta — se marca
      // para tragarse el próximo click (ver `suppressNextClick` y
      // `onClickCapture` más abajo) así el mousedown/click real que dispara
      // el navegador al soltar el mouse no le llegue al onClick de
      // PlanCanvas (dibujar un tramo, colocar una pieza…).
      e.stopPropagation()
      suppressNextClick.current = true
      dragging.current = { x: e.clientX, y: e.clientY, tx, ty }
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      return
    }
    if (activeTool === 'select' && project) {
      const lvl = project.levels.find((l) => l.key === level)
      const pt = svgPoint(e)
      if (lvl && pt) {
        // 1) ¿el clic cae sobre una manija del objeto ya seleccionado? — estirarlo
        if (selection) {
          const selObj = lvl.layers[selection.layer].find((o) => o.id === selection.id)
          if (selObj) {
            const thresh = 16 / scale
            const hit = getHandles(selObj).find((h) => Math.hypot(h.x - pt.x, h.y - pt.y) < thresh)
            if (hit) {
              objDrag.current = { kind: 'endpoint', id: selObj.id, layer: selection.layer, handleId: hit.id, startX: hit.x, startY: hit.y, moved: false }
              e.stopPropagation()
              ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
              return
            }
          }
        }
        const draggableKinds = new Set(['symbol', 'circle', 'wall', 'path', 'dome', 'rect', 'text', 'window'])
        // 2) ¿el clic cae directo sobre el cuerpo de un objeto (símbolo,
        //    pieza, muro o tubería/ducto)? — moverlo completo (no estirar).
        //    En el primer clic sobre un punto nuevo, si el objeto YA
        //    seleccionado también cae bajo el clic, gana él sin importar el
        //    orden del arreglo ni la distancia — si no, dos objetos que se
        //    solapan (p. ej. un domo recién duplicado a solo 24 unidades del
        //    original) siempre resolvían a quien haya sido dibujado primero
        //    o esté matemáticamente más cerca, y arrastrar el clon recién
        //    duplicado en realidad movía el original por debajo, mientras el
        //    clon (el que se veía seleccionado) se quedaba quieto — se
        //    sentía como "lo arrastré y desapareció" (bug real, reportado).
        let found: { layer: LayerKey; obj: (typeof lvl.layers.base)[number] } | null = null
        // Todos los candidatos arrastrables bajo el clic, no solo el más
        // cercano — hace falta la lista completa para poder ciclar entre
        // ellos si el usuario vuelve a hacer clic en el mismo punto.
        const candidates: { layer: LayerKey; obj: (typeof lvl.layers.base)[number]; dist: number }[] = []
        for (const key of LAYER_ORDER) {
          if (!layerState[key].visible || layerState[key].locked) continue
          for (const o of lvl.layers[key]) {
            if (!draggableKinds.has(o.kind)) continue
            const d = hitDistance(o, pt.x, pt.y)
            if (d !== null && d < 20) candidates.push({ layer: key, obj: o, dist: d })
          }
        }
        candidates.sort((a, b) => a.dist - b.dist)
        const prevCycle = clickCycle.current
        const CYCLE_EPS = 6 / scale
        const sameSpot = !!prevCycle && Math.hypot(prevCycle.x - pt.x, prevCycle.y - pt.y) < CYCLE_EPS
        const sameSet = sameSpot && prevCycle!.order.length === candidates.length && prevCycle!.order.every((p, i) => p.id === candidates[i].obj.id)
        if (candidates.length > 0) {
          let chosenIndex = 0
          if (sameSet) {
            chosenIndex = (prevCycle!.index + 1) % candidates.length
          } else if (selection) {
            // Primer clic en un punto nuevo: prioriza el objeto ya
            // seleccionado si también cae bajo el clic (ver comentario del
            // bug de duplicar+arrastrar, arriba) en vez de forzar siempre el
            // más cercano.
            const selIdx = candidates.findIndex((c) => c.layer === selection.layer && c.obj.id === selection.id)
            chosenIndex = selIdx >= 0 ? selIdx : 0
          }
          found = { layer: candidates[chosenIndex].layer, obj: candidates[chosenIndex].obj }
          clickCycle.current = { x: pt.x, y: pt.y, order: candidates.map((c) => ({ layer: c.layer, id: c.obj.id })), index: chosenIndex }
        } else {
          clickCycle.current = null
        }
        if (found && draggableKinds.has(found.obj.kind)) {
          if (e.shiftKey) {
            // Shift+clic solo cambia qué está seleccionado, no arrastra —
            // así se pueden ir agregando/quitando objetos de la selección
            // múltiple sin mover nada por accidente.
            toggleMultiSelect(found.layer, found.obj.id)
            e.stopPropagation()
            return
          }
          const isPartOfMulti = multiSelection?.layer === found.layer && multiSelection.ids.length > 1 && multiSelection.ids.includes(found.obj.id)
          if (isPartOfMulti) {
            objDrag.current = { kind: 'translate', ids: multiSelection.ids, layer: found.layer, startX: pt.x, startY: pt.y, moved: false }
          } else {
            select(found.layer, found.obj.id)
            objDrag.current = { kind: 'translate', ids: [found.obj.id], layer: found.layer, startX: pt.x, startY: pt.y, moved: false }
          }
          e.stopPropagation()
          ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
          return
        }
      }
    }
    if (!panEnabled) return
    dragging.current = { x: e.clientX, y: e.clientY, tx, ty }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: PointerEvent) => {
    if (activePointers.current.has(e.pointerId)) activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pinch.current && activePointers.current.size === 2) {
      const [a, b] = [...activePointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const midX = (a.x + b.x) / 2
      const midY = (a.y + b.y) / 2
      setScale(Math.min(MAX_SCALE, Math.max(MIN_SCALE, pinch.current.startScale * (dist / pinch.current.startDist))))
      setTx(pinch.current.startTx + (midX - pinch.current.startMidX))
      setTy(pinch.current.startTy + (midY - pinch.current.startMidY))
      return
    }
    if (objDrag.current) {
      const pt = svgPoint(e)
      if (!pt) return
      const od = objDrag.current
      if (Math.hypot(pt.x - od.startX, pt.y - od.startY) > 1) od.moved = true
      setDragPreview(od.kind === 'translate'
        ? { kind: 'translate', ids: od.ids, dx: pt.x - od.startX, dy: pt.y - od.startY }
        : { kind: 'endpoint', id: od.id, handleId: od.handleId, x: pt.x, y: pt.y })
      return
    }
    if (!dragging.current) return
    setTx(dragging.current.tx + (e.clientX - dragging.current.x))
    setTy(dragging.current.ty + (e.clientY - dragging.current.y))
  }

  const onPointerUp = (e: PointerEvent) => {
    activePointers.current.delete(e.pointerId)
    if (activePointers.current.size < 2) pinch.current = null
    if (objDrag.current) {
      const od = objDrag.current
      if (od.moved) {
        const pt = svgPoint(e)
        if (pt) {
          if (od.kind === 'translate') {
            if (od.ids.length > 1) nudgeMultiSelection(pt.x - od.startX, pt.y - od.startY)
            else nudgeSelected(pt.x - od.startX, pt.y - od.startY)
          } else {
            setHandlePoint(od.id, od.layer, od.handleId, pt.x, pt.y)
          }
        }
      }
      objDrag.current = null
      setDragPreview(null)
      return
    }
    dragging.current = null
  }

  const onClickCapture = (e: ReactMouseEvent) => {
    if (!suppressNextClick.current) return
    suppressNextClick.current = false
    e.stopPropagation()
  }

  return (
    <div
      ref={rootRef}
      className={`absolute inset-0 overflow-hidden touch-none ${panEnabled ? 'cursor-grab active:cursor-grabbing' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onClickCapture={onClickCapture}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          style={{
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
            transition: (dragging.current || objDrag.current) ? 'none' : 'transform .06s ease-out',
            boxShadow: 'var(--canvas-shadow)'
          }}
          className="border border-[color:var(--hairline)] rounded"
        >
          <PlanCanvas dragPreview={dragPreview} onResizeSide={handleResizeSide} />
        </div>
      </div>

      {hintDef && (() => {
        const st = layerState[hintDef.layer]
        if (st.locked) {
          return (
            <button
              onClick={(e) => { e.stopPropagation(); toggleLayerLock(hintDef.layer) }}
              className="absolute top-4 left-1/2 -translate-x-1/2 backdrop-blur-md rounded-full px-4 py-1.5 text-[11px] font-mono-ui border"
              style={{ background: 'color-mix(in srgb, #fb7185 12%, var(--panel-bg))', borderColor: 'color-mix(in srgb, #fb7185 40%, transparent)', color: '#fb7185' }}
            >
              🔒 Capa {LAYER_LABEL[hintDef.layer]} bloqueada — clic para desbloquearla
            </button>
          )
        }
        if (!st.visible) {
          return (
            <button
              onClick={(e) => { e.stopPropagation(); toggleLayerVisible(hintDef.layer) }}
              className="absolute top-4 left-1/2 -translate-x-1/2 backdrop-blur-md rounded-full px-4 py-1.5 text-[11px] font-mono-ui border"
              style={{ background: 'color-mix(in srgb, #fbbf24 12%, var(--panel-bg))', borderColor: 'color-mix(in srgb, #fbbf24 40%, transparent)', color: '#fbbf24' }}
            >
              👁 Capa {LAYER_LABEL[hintDef.layer]} oculta — se dibuja igual, pero no la vas a ver · clic para mostrarla
            </button>
          )
        }
        return (
          <div
            className="absolute top-4 left-1/2 -translate-x-1/2 backdrop-blur-md rounded-full px-4 py-1.5 text-[11px] font-mono-ui border"
            style={hintDef.color
              ? { background: `color-mix(in srgb, ${hintDef.color} 12%, var(--panel-bg))`, borderColor: `color-mix(in srgb, ${hintDef.color} 35%, transparent)`, color: hintDef.color }
              : { background: 'var(--panel-bg)', borderColor: 'var(--hairline)', color: 'var(--text-secondary)' }}
          >
            {hintDef.text}
          </div>
        )
      })()}

      <CircuitsPanel />

      <div className="absolute right-6 bottom-4 flex items-center bg-[color:var(--panel-bg)] backdrop-blur-md border border-[color:var(--hairline)] rounded-full overflow-hidden">
        <button onClick={(e) => { e.stopPropagation(); setScale((s) => Math.max(MIN_SCALE, s - 0.15)) }} className="w-[30px] h-[30px] text-[var(--text-secondary)] text-base">−</button>
        <span onClick={(e) => { e.stopPropagation(); fitToContainer() }} title="Ajustar al espacio disponible" className="font-mono-ui text-[10.5px] text-[var(--text-secondary)] px-2 cursor-pointer select-none">{Math.round(scale * 100)}%</span>
        <button onClick={(e) => { e.stopPropagation(); setScale((s) => Math.min(MAX_SCALE, s + 0.15)) }} className="w-[30px] h-[30px] text-[var(--text-secondary)] text-base">+</button>
        <button onClick={(e) => { e.stopPropagation(); fitToContainer() }} title="Ajustar al espacio disponible" className="w-[30px] h-[30px] text-[var(--text-secondary)] flex items-center justify-center border-l border-[color:var(--hairline)]">
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none"><path d="M4 9 V4 H9 M20 9 V4 H15 M4 15 V20 H9 M20 15 V20 H15" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
    </div>
  )
}
