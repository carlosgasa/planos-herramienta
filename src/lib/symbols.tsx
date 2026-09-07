import type { SymbolShape } from '../types'

/**
 * Geometría LOCAL (centrada en 0,0) de cada símbolo — el componente que la
 * usa la envuelve en `<g transform="translate(x,y) rotate(r)">`, así que
 * rotar un objeto ya colocado es solo cambiar `rotation`, nunca hay que
 * recalcular coordenadas absolutas.
 */
export function SymbolGlyph({ shape, color }: { shape: SymbolShape; color: string }) {
  const fillTint = `color-mix(in srgb, ${color} 9%, transparent)`
  switch (shape) {
    case 'tinaco':
      return (
        <>
          <circle cx={0} cy={0} r={20} stroke={color} strokeWidth={1.6} fill={fillTint} />
          <line x1={0} y1={-20} x2={0} y2={-28} stroke={color} strokeWidth={1.6} />
        </>
      )
    case 'cisterna':
      return (
        <>
          <rect x={-24} y={-17} width={48} height={34} stroke={color} strokeWidth={1.6} fill={fillTint} strokeDasharray="6 4" />
          <line x1={0} y1={-17} x2={0} y2={-25} stroke={color} strokeWidth={1.6} />
        </>
      )
    case 'calentadorPaso':
      return (
        <>
          <rect x={-12} y={-17} width={24} height={34} stroke={color} strokeWidth={1.6} fill={fillTint} />
          <path d="M -6 6 L -2 -2 L 2 6 L 6 -2" stroke={color} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )
    case 'calentadorSolar':
      return (
        <>
          <rect x={-26} y={-14} width={52} height={28} stroke={color} strokeWidth={1.6} fill={fillTint} />
          <line x1={-18} y1={-14} x2={-18} y2={14} stroke={color} strokeWidth={1.2} />
          <line x1={0} y1={-14} x2={0} y2={14} stroke={color} strokeWidth={1.2} />
          <line x1={18} y1={-14} x2={18} y2={14} stroke={color} strokeWidth={1.2} />
        </>
      )
    case 'bombaPresurizadora':
    case 'bombaLlenado':
      return (
        <>
          <circle cx={0} cy={0} r={15} stroke={color} strokeWidth={1.6} fill={fillTint} />
          <path d="M -6 -7 L 8 0 L -6 7 Z" fill={color} />
        </>
      )
    case 'contacto':
      return (
        <>
          <circle cx={0} cy={0} r={6} stroke={color} strokeWidth={1.4} fill="none" />
          <line x1={-3} y1={-3} x2={-3} y2={3} stroke={color} strokeWidth={1.4} strokeLinecap="round" />
          <line x1={3} y1={-3} x2={3} y2={3} stroke={color} strokeWidth={1.4} strokeLinecap="round" />
        </>
      )
    case 'contactoDoble':
      return (
        <>
          <rect x={-12} y={-6.5} width={24} height={13} rx={2.5} stroke={color} strokeWidth={1.4} fill={fillTint} />
          <line x1={-6} y1={-3.5} x2={-6} y2={3.5} stroke={color} strokeWidth={1.2} strokeLinecap="round" />
          <line x1={-2} y1={-3.5} x2={-2} y2={3.5} stroke={color} strokeWidth={1.2} strokeLinecap="round" />
          <line x1={2} y1={-3.5} x2={2} y2={3.5} stroke={color} strokeWidth={1.2} strokeLinecap="round" />
          <line x1={6} y1={-3.5} x2={6} y2={3.5} stroke={color} strokeWidth={1.2} strokeLinecap="round" />
        </>
      )
    case 'contactoApagador':
      return (
        <>
          <rect x={-12} y={-6.5} width={24} height={13} rx={2.5} stroke={color} strokeWidth={1.4} fill={fillTint} />
          <line x1={0} y1={-6.5} x2={0} y2={6.5} stroke={color} strokeWidth={1} strokeDasharray="1.6 1.6" />
          <line x1={-8} y1={3} x2={-2} y2={-3} stroke={color} strokeWidth={1.6} strokeLinecap="round" />
          <line x1={3} y1={-3.5} x2={3} y2={3.5} stroke={color} strokeWidth={1.2} strokeLinecap="round" />
          <line x1={7} y1={-3.5} x2={7} y2={3.5} stroke={color} strokeWidth={1.2} strokeLinecap="round" />
        </>
      )
    case 'salida220':
      return (
        <>
          <rect x={-8} y={-8} width={16} height={16} stroke={color} strokeWidth={1.5} fill={fillTint} />
          <line x1={0} y1={0} x2={0} y2={-5} stroke={color} strokeWidth={1.4} strokeLinecap="round" />
          <line x1={0} y1={0} x2={-4.3} y2={2.5} stroke={color} strokeWidth={1.4} strokeLinecap="round" />
          <line x1={0} y1={0} x2={4.3} y2={2.5} stroke={color} strokeWidth={1.4} strokeLinecap="round" />
        </>
      )
    case 'salidaClima':
      return (
        <>
          <circle cx={0} cy={0} r={7} stroke={color} strokeWidth={1.4} fill={fillTint} />
          <path d="M 0 0 Q 4 -4 2 -7" stroke={color} strokeWidth={1.3} fill="none" strokeLinecap="round" />
          <path d="M 0 0 Q -5 1 -6 5" stroke={color} strokeWidth={1.3} fill="none" strokeLinecap="round" />
          <path d="M 0 0 Q 3 5 6 3" stroke={color} strokeWidth={1.3} fill="none" strokeLinecap="round" />
        </>
      )
    case 'salidaDatos':
      return (
        <>
          <rect x={-8} y={-6} width={16} height={12} rx={2} stroke={color} strokeWidth={1.4} fill={fillTint} />
          <circle cx={0} cy={0} r={2.4} stroke={color} strokeWidth={1.2} fill="none" />
          <line x1={-8} y1={-6} x2={-11} y2={-9} stroke={color} strokeWidth={1} strokeLinecap="round" />
          <line x1={8} y1={-6} x2={11} y2={-9} stroke={color} strokeWidth={1} strokeLinecap="round" />
        </>
      )
    case 'apagador':
      return (
        <>
          <circle cx={0} cy={0} r={6} stroke={color} strokeWidth={1.4} fill="none" />
          <line x1={-3} y1={3} x2={3} y2={-3} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
        </>
      )
    case 'apagador3vias':
      return (
        <>
          <circle cx={0} cy={0} r={6} stroke={color} strokeWidth={1.4} fill="none" />
          <line x1={-3.5} y1={2} x2={2} y2={-3.5} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
          <line x1={-1} y1={4.5} x2={4.5} y2={-1} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
        </>
      )
    case 'tapaCiega':
      return (
        <>
          <rect x={-8} y={-8} width={16} height={16} rx={2} stroke={color} strokeWidth={1.4} fill={fillTint} />
          <line x1={-4} y1={0} x2={4} y2={0} stroke={color} strokeWidth={1.6} strokeLinecap="round" />
        </>
      )
    case 'timbre':
      return (
        <>
          <path d="M -6 2 Q -6 -8 0 -8 Q 6 -8 6 2 L 8 5 H -8 Z" stroke={color} strokeWidth={1.4} fill={fillTint} strokeLinejoin="round" />
          <line x1={0} y1={-8} x2={0} y2={-10.5} stroke={color} strokeWidth={1.3} strokeLinecap="round" />
          <circle cx={0} cy={7.5} r={1.6} fill={color} />
        </>
      )
    case 'registroElectrico':
      // Caja de registro/paso: cuadro con cruz — deliberadamente distinto
      // del "registro" de drenaje (cuadro punteado, ver más abajo) para no
      // confundirlos a simple vista entre capas.
      return (
        <>
          <rect x={-8} y={-8} width={16} height={16} stroke={color} strokeWidth={1.4} fill={fillTint} />
          <line x1={-8} y1={-8} x2={8} y2={8} stroke={color} strokeWidth={1.1} />
          <line x1={8} y1={-8} x2={-8} y2={8} stroke={color} strokeWidth={1.1} />
        </>
      )
    case 'fotocelda':
      return (
        <>
          <circle cx={0} cy={0} r={5} stroke={color} strokeWidth={1.4} fill={fillTint} />
          <line x1={0} y1={-9.5} x2={0} y2={-6.8} stroke={color} strokeWidth={1.3} strokeLinecap="round" />
          <line x1={0} y1={6.8} x2={0} y2={9.5} stroke={color} strokeWidth={1.3} strokeLinecap="round" />
          <line x1={-9.5} y1={0} x2={-6.8} y2={0} stroke={color} strokeWidth={1.3} strokeLinecap="round" />
          <line x1={6.8} y1={0} x2={9.5} y2={0} stroke={color} strokeWidth={1.3} strokeLinecap="round" />
          <line x1={-6.7} y1={-6.7} x2={-4.8} y2={-4.8} stroke={color} strokeWidth={1.3} strokeLinecap="round" />
          <line x1={4.8} y1={-4.8} x2={6.7} y2={-6.7} stroke={color} strokeWidth={1.3} strokeLinecap="round" />
          <line x1={-6.7} y1={6.7} x2={-4.8} y2={4.8} stroke={color} strokeWidth={1.3} strokeLinecap="round" />
          <line x1={4.8} y1={4.8} x2={6.7} y2={6.7} stroke={color} strokeWidth={1.3} strokeLinecap="round" />
        </>
      )
    case 'lampara':
      return (
        <>
          <circle cx={0} cy={0} r={8} stroke={color} strokeWidth={1.4} fill="none" />
          <line x1={-8} y1={0} x2={8} y2={0} stroke={color} strokeWidth={1} />
          <line x1={0} y1={-8} x2={0} y2={8} stroke={color} strokeWidth={1} />
        </>
      )
    case 'tablero':
      return (
        <>
          <rect x={-16} y={-15} width={32} height={30} stroke={color} strokeWidth={1.6} fill={fillTint} />
          <line x1={-9} y1={-7} x2={9} y2={-7} stroke={color} strokeWidth={1.2} />
          <line x1={-9} y1={0} x2={9} y2={0} stroke={color} strokeWidth={1.2} />
          <line x1={-9} y1={7} x2={9} y2={7} stroke={color} strokeWidth={1.2} />
        </>
      )
    case 'acometida':
      return (
        <>
          <circle cx={0} cy={-16} r={3.5} stroke={color} strokeWidth={1.6} fill="none" />
          <line x1={0} y1={-12.5} x2={0} y2={0} stroke={color} strokeWidth={1.8} />
          <line x1={0} y1={0} x2={12} y2={11} stroke={color} strokeWidth={1.8} />
          <path d="M 7 6 L 12 11 L 7 13" stroke={color} strokeWidth={1.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )
    case 'tierra':
      return (
        <>
          <line x1={0} y1={-12} x2={0} y2={0} stroke={color} strokeWidth={1.8} />
          <line x1={-9} y1={0} x2={9} y2={0} stroke={color} strokeWidth={1.8} />
          <line x1={-6} y1={4.5} x2={6} y2={4.5} stroke={color} strokeWidth={1.6} />
          <line x1={-3} y1={9} x2={3} y2={9} stroke={color} strokeWidth={1.4} />
        </>
      )
    case 'codo':
      return (
        <>
          <path d="M -7 0 L 0 0 L 0 -7" stroke={color} strokeWidth={1.8} fill="none" strokeLinecap="round" />
          <circle cx={0} cy={0} r={3} fill={color} />
        </>
      )
    case 'codo45':
      return (
        <>
          <path d="M -7 0 L 0 0 L 5 -5" stroke={color} strokeWidth={1.8} fill="none" strokeLinecap="round" />
          <circle cx={0} cy={0} r={3} fill={color} />
        </>
      )
    case 'tee':
      return (
        <>
          <path d="M -7 0 H 7 M 0 0 V 7" stroke={color} strokeWidth={1.8} fill="none" strokeLinecap="round" />
          <circle cx={0} cy={0} r={3} fill={color} />
        </>
      )
    case 'y':
      return (
        <>
          <path d="M 0 7 V 0 M 0 0 L -6 -6 M 0 0 L 6 -6" stroke={color} strokeWidth={1.8} fill="none" strokeLinecap="round" />
          <circle cx={0} cy={0} r={3} fill={color} />
        </>
      )
    case 'reduccion':
      return <path d="M -7 -4 H 7 L 3 4 H -3 Z" stroke={color} strokeWidth={1.6} fill="none" strokeLinejoin="round" />
    case 'coladera':
      return (
        <>
          <rect x={-8} y={-8} width={16} height={16} stroke={color} strokeWidth={1.6} fill="none" />
          <line x1={-8} y1={-2.7} x2={8} y2={-2.7} stroke={color} strokeWidth={1} />
          <line x1={-8} y1={2.7} x2={8} y2={2.7} stroke={color} strokeWidth={1} />
        </>
      )
    case 'registro':
      return <rect x={-9} y={-9} width={18} height={18} stroke={color} strokeWidth={1.6} fill="none" strokeDasharray="3 2" />
    case 'salidaCalle':
      return (
        <>
          <circle cx={0} cy={0} r={8} stroke={color} strokeWidth={1.6} fill={fillTint} />
          <path d="M 8 0 H 17 M 12.5 -4.5 L 17 0 L 12.5 4.5" stroke={color} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )
    case 'ventila':
      return (
        <>
          <line x1={0} y1={9} x2={0} y2={-4} stroke={color} strokeWidth={1.8} />
          <path d="M -5 -4 H 5" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
          <circle cx={0} cy={9} r={3} fill={color} />
        </>
      )
    case 'trampa':
      return (
        <path d="M -6 -8 V -1 Q -6 6 0 6 Q 6 6 6 -1 V -8" stroke={color} strokeWidth={1.8} fill="none" strokeLinecap="round" />
      )
    case 'bajante':
      // Círculo con punto central relleno — la convención universal de
      // plano para "la tubería sigue verticalmente por este punto" (sube o
      // baja a otro nivel, no termina aquí). Se reusa igual en drenaje
      // ("BAJA") e hidráulica ("SUBE") — ver comentario en stamps.ts.
      return (
        <>
          <circle cx={0} cy={0} r={8} stroke={color} strokeWidth={1.6} fill={fillTint} />
          <circle cx={0} cy={0} r={3} fill={color} />
        </>
      )
    case 'llave':
      return (
        <>
          <circle cx={0} cy={0} r={5} stroke={color} strokeWidth={1.6} fill="none" />
          <line x1={-5} y1={0} x2={5} y2={0} stroke={color} strokeWidth={1.6} />
        </>
      )
    case 'llaveNariz':
      return (
        <>
          <circle cx={0} cy={0} r={5} stroke={color} strokeWidth={1.6} fill="none" />
          <path d="M 0 5 V 9 L 9 9" stroke={color} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <line x1={9} y1={6.5} x2={9} y2={11.5} stroke={color} strokeWidth={1.6} strokeLinecap="round" />
        </>
      )
    case 'tuercaUnion':
      return (
        <>
          <line x1={-3} y1={-7} x2={-3} y2={7} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
          <line x1={3} y1={-7} x2={3} y2={7} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
          <circle cx={0} cy={0} r={2} fill={color} />
        </>
      )
    case 'medidor':
      return (
        <>
          <circle cx={0} cy={0} r={7} stroke={color} strokeWidth={1.6} fill={fillTint} />
          <line x1={0} y1={0} x2={3} y2={-4} stroke={color} strokeWidth={1.4} strokeLinecap="round" />
          <circle cx={0} cy={0} r={1} fill={color} />
        </>
      )
    case 'filtro':
      return (
        <>
          <rect x={-6} y={-10} width={12} height={20} rx={4} stroke={color} strokeWidth={1.6} fill={fillTint} />
          <line x1={-6} y1={-2} x2={6} y2={-2} stroke={color} strokeWidth={1.2} />
        </>
      )
    case 'toma':
      return (
        <>
          <circle cx={0} cy={0} r={6} stroke={color} strokeWidth={1.6} fill="none" />
          <line x1={0} y1={-6} x2={0} y2={-16} stroke={color} strokeWidth={2} />
        </>
      )
    case 'checkValve':
      return (
        <>
          <circle cx={0} cy={0} r={7} stroke={color} strokeWidth={1.6} fill="none" />
          <path d="M -4 -3 L 4 0 L -4 3 Z" fill={color} />
          <line x1={4} y1={-4} x2={4} y2={4} stroke={color} strokeWidth={1.6} />
        </>
      )
    case 'conector':
      return <circle cx={0} cy={0} r={4} fill={color} />
    case 'escalera':
      return (
        <>
          <line x1={-10} y1={-18} x2={10} y2={-18} stroke={color} strokeWidth={1.4} />
          <line x1={-10} y1={-9} x2={10} y2={-9} stroke={color} strokeWidth={1.4} />
          <line x1={-10} y1={0} x2={10} y2={0} stroke={color} strokeWidth={1.4} />
          <line x1={-10} y1={9} x2={10} y2={9} stroke={color} strokeWidth={1.4} />
          <line x1={-10} y1={18} x2={10} y2={18} stroke={color} strokeWidth={1.4} />
          <path d="M -6 -22 L 0 -30 L 6 -22" stroke={color} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )
  }
}
