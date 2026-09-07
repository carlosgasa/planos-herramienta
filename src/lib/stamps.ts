import type { DrawObject, SymbolShape } from '../types'
import type { DispositivoKey, EquipoKey, HidraulicaDiameter, PipeDiameter, WaterType } from '../store/useProjectStore'

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function makeSymbol(shape: SymbolShape, x: number, y: number, color: string, rotation = 0, label?: string, scale?: number): DrawObject {
  return {
    id: newId('sym'),
    kind: 'symbol',
    shape,
    x,
    y,
    rotation,
    color,
    ...(label !== undefined ? { label } : {}),
    ...(scale !== undefined ? { scale } : {})
  }
}

/** Escala de la pieza según el diámetro de tubería seleccionado al
 *  colocarla — el mismo campo `scale` que ya existe para redimensionar a
 *  mano después (campo TAMAÑO % en `PropertiesPanel.tsx`), solo que aquí
 *  se le da un valor inicial sensato en vez de siempre 1. Antes cualquier
 *  codo/tee salía del mismo tamaño sin importar si la tubería era de 2" o
 *  4" (o 1/2" o 3/4"), así que no había forma de distinguir a simple vista
 *  para qué diámetro era una pieza — coincide con la convención real de
 *  plano, donde el símbolo de una conexión más gruesa se dibuja más
 *  grande. */
const DRENAJE_DIAMETER_SCALE: Record<PipeDiameter, number> = { '2': 1, '4': 1.35 }
const HIDRAULICA_DIAMETER_SCALE: Record<HidraulicaDiameter, number> = { '1/2': 1, '3/4': 1.2 }

// ---------------------------------------------------------------------------
// Piezas de tubería: drenaje y agua comparten las formas básicas, cada capa
// agrega las suyas propias.
// ---------------------------------------------------------------------------

export type PiezaKey = 'codo' | 'codo45' | 'tee' | 'y' | 'reduccion' | 'coladera' | 'registro' | 'salidaCalle' | 'ventila' | 'trampa' | 'bajante'
export type PiezaHidraulicaKey = 'codo' | 'codo45' | 'tee' | 'llave' | 'llaveNariz' | 'toma' | 'checkValve' | 'conector' | 'tuercaUnion' | 'medidor' | 'filtro' | 'bajante'

export const PIEZA_DEFS: Record<PiezaKey, { label: string; short: string }> = {
  codo: { label: 'Codo 90°', short: 'CODO' },
  codo45: { label: 'Codo 45°', short: 'C-45°' },
  tee: { label: 'Tee', short: 'TEE' },
  y: { label: 'Y', short: 'Y' },
  reduccion: { label: 'Reducción', short: 'RED.' },
  coladera: { label: 'Coladera', short: 'COLAD.' },
  registro: { label: 'Registro', short: 'REG.' },
  salidaCalle: { label: 'Salida a calle (drenaje municipal)', short: 'A CALLE' },
  ventila: { label: 'Ventila (tubo de venteo)', short: 'VENTILA' },
  trampa: { label: 'Trampa / sifón', short: 'TRAMPA' },
  bajante: { label: 'Bajante (baja a un nivel inferior)', short: 'BAJANTE' }
}

export const PIEZA_HIDRAULICA_DEFS: Record<PiezaHidraulicaKey, { label: string; short: string }> = {
  codo: { label: 'Codo 90°', short: 'C-90°' },
  codo45: { label: 'Codo 45°', short: 'C-45°' },
  tee: { label: 'Tee', short: 'TEE' },
  llave: { label: 'Llave de paso', short: 'LLAVE' },
  llaveNariz: { label: 'Llave nariz (exterior, manguera)', short: 'NARIZ' },
  toma: { label: 'Toma municipal (entrada de agua)', short: 'TOMA' },
  checkValve: { label: 'Válvula check', short: 'CHECK' },
  conector: { label: 'Conector', short: 'CONEC.' },
  tuercaUnion: { label: 'Tuerca unión', short: 'UNIÓN' },
  medidor: { label: 'Medidor de agua', short: 'MEDID.' },
  filtro: { label: 'Filtro / purificador', short: 'FILTRO' },
  bajante: { label: 'Montante (sube a un nivel superior)', short: 'MONTANTE' }
}

/** Las piezas de drenaje son todas del mismo color — no hay fría/caliente
 *  ahí —, salvo "salida a calle" y "bajante" que además se autoetiquetan,
 *  igual que la toma municipal en hidráulica, para que se lean solas en el
 *  plano. */
export function makePiezaObject(key: PiezaKey, x: number, y: number, diameter: PipeDiameter): DrawObject {
  const label = key === 'salidaCalle' ? 'A CALLE' : key === 'bajante' ? 'BAJA' : undefined
  return makeSymbol(key, x, y, 'var(--fitting-hl)', 0, label, DRENAJE_DIAMETER_SCALE[diameter])
}

/** Las piezas hidráulicas toman el color de la línea (fría/caliente)
 *  seleccionada en la barra al momento de colocarlas — igual que ya pasa
 *  con la tubería —, salvo la toma municipal, que siempre es la entrada
 *  fría de la red por definición. "bajante" se reusa como el mismo glifo
 *  (círculo con punto central, el símbolo universal de "la tubería sigue
 *  verticalmente por este punto") en ambas capas — en drenaje se autoetiqueta
 *  "BAJA" y en hidráulica "SUBE", que es lo que realmente cambia entre un
 *  bajante (drenaje, siempre baja) y un montante (hidráulica, siempre
 *  sube); la geometría es idéntica, igual que "codo"/"tee" ya se comparten
 *  entre las dos capas. */
export function makePiezaHidraulicaObject(key: PiezaHidraulicaKey, x: number, y: number, waterType: WaterType, diameter: HidraulicaDiameter): DrawObject {
  const color = key === 'toma' ? 'var(--pipe-fria)' : (waterType === 'fria' ? 'var(--pipe-fria)' : 'var(--pipe-caliente)')
  const label = key === 'toma' ? 'TOMA MUNICIPAL' : key === 'bajante' ? 'SUBE' : undefined
  return makeSymbol(key, x, y, color, 0, label, HIDRAULICA_DIAMETER_SCALE[diameter])
}

// ---------------------------------------------------------------------------
// Dispositivos y tablero eléctrico (etapa 1: trazado físico)
// ---------------------------------------------------------------------------

export const DISPOSITIVO_DEFS: Record<DispositivoKey, { label: string; short: string; color: string }> = {
  contacto: { label: 'Contacto sencillo', short: 'CONT.', color: 'var(--circuit-contactos)' },
  contactoDoble: { label: 'Contacto doble', short: 'CONT.2', color: 'var(--circuit-contactos)' },
  contactoApagador: { label: 'Contacto + apagador', short: 'C+APG', color: 'var(--circuit-contactos)' },
  salida220: { label: 'Salida 220V (estufa/secadora)', short: '220V', color: 'var(--circuit-fuerza)' },
  salidaClima: { label: 'Salida para minisplit / clima', short: 'CLIMA', color: 'var(--circuit-fuerza)' },
  salidaDatos: { label: 'Salida de datos / TV', short: 'DATOS', color: 'var(--circuit-contactos)' },
  apagador: { label: 'Apagador sencillo', short: 'APG', color: 'var(--circuit-iluminacion)' },
  apagador3vias: { label: 'Apagador de 3 vías', short: 'APG.3', color: 'var(--circuit-iluminacion)' },
  lampara: { label: 'Lámpara', short: 'LMP', color: 'var(--circuit-iluminacion)' },
  timbre: { label: 'Timbre', short: 'TIMBRE', color: 'var(--circuit-iluminacion)' },
  tapaCiega: { label: 'Tapa ciega', short: 'TAPA', color: 'var(--layer-electrica)' },
  fotocelda: { label: 'Fotocelda', short: 'FOTOC.', color: 'var(--circuit-iluminacion)' },
  registroElectrico: { label: 'Registro sencillo (caja de paso)', short: 'REGIST.', color: 'var(--layer-electrica)' }
}

export function makeDispositivoObject(key: DispositivoKey, x: number, y: number): DrawObject {
  return makeSymbol(key, x, y, DISPOSITIVO_DEFS[key].color)
}

export type PrincipalKey = 'tablero' | 'acometida' | 'tierra'

export const PRINCIPAL_DEFS: Record<PrincipalKey, { label: string; short: string }> = {
  tablero: { label: 'Tablero / centro de carga', short: 'TABLERO' },
  acometida: { label: 'Acometida (entrada de luz de la calle)', short: 'ACOMET.' },
  tierra: { label: 'Electrodo de tierra física', short: 'TIERRA' }
}

export function makePrincipalObject(key: PrincipalKey, x: number, y: number): DrawObject {
  return makeSymbol(key, x, y, 'var(--layer-electrica)', 0, PRINCIPAL_DEFS[key].short)
}

// ---------------------------------------------------------------------------
// Equipos hidráulicos — cada uno con silueta propia y rotable en incrementos
// de 90° (antes y después de colocarlo).
// ---------------------------------------------------------------------------

export const EQUIPO_DEFS: Record<EquipoKey, { label: string; short: string; color: string }> = {
  calentadorPaso: { label: 'CALENT. PASO', short: 'C.PASO', color: 'var(--pipe-caliente)' },
  calentadorSolar: { label: 'CALENT. SOLAR', short: 'C.SOLAR', color: 'var(--pipe-caliente)' },
  bombaPresurizadora: { label: 'BOMBA PRESURIZ.', short: 'B.PRESU', color: 'var(--pipe-fria)' },
  bombaLlenado: { label: 'BOMBA LLENADO', short: 'B.LLEN', color: 'var(--pipe-fria)' },
  cisterna: { label: 'CISTERNA', short: 'CISTERNA', color: 'var(--pipe-fria)' },
  tinaco: { label: 'TINACO', short: 'TINACO', color: 'var(--pipe-fria)' }
}

export function makeEquipoObject(key: EquipoKey, x: number, y: number, rotationDeg = 0): DrawObject {
  const def = EQUIPO_DEFS[key]
  return makeSymbol(key, x, y, def.color, rotationDeg, def.label)
}

// ---------------------------------------------------------------------------
// Escalera / marcador de acceso vertical entre niveles (capa Base). Es un
// símbolo rotable como cualquier otro: la flecha marca "sube" y el usuario
// la orienta con R según hacia dónde sube realmente la escalera.
// ---------------------------------------------------------------------------

export function makeEscaleraObject(x: number, y: number, rotationDeg = 0): DrawObject {
  return makeSymbol('escalera', x, y, 'var(--stair-hl)', rotationDeg, 'SUBE')
}
