import { useEffect, useState } from 'react'

const QUERY = '(max-width: 768px)'

/** "Móvil" = viewport angosto (breakpoint `md` de Tailwind), no un sniff de
 *  user-agent — reacciona a rotar el teléfono o a redimensionar la ventana,
 *  igual que el resto del layout responsivo de la app. Ver `App.tsx`, que
 *  sincroniza esto a `store.viewOnly`. */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(QUERY).matches : false))

  useEffect(() => {
    const mql = window.matchMedia(QUERY)
    const onChange = () => setIsMobile(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return isMobile
}
