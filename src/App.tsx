import { useEffect, useState } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { auth, firebaseEnabled } from './lib/firebase'
import { saveProject } from './lib/projectRepo'
import { localSaveProject } from './lib/localProjectStore'
import { useProjectStore } from './store/useProjectStore'
import { Login } from './components/Login'
import { ProjectsScreen } from './components/ProjectsScreen'
import { TopBar } from './components/TopBar'
import { Toolbar } from './components/Toolbar'
import { CanvasViewport } from './components/CanvasViewport'
import { LayersPanel } from './components/LayersPanel'
import { ExportModal } from './components/ExportModal'
import { Toast } from './components/Toast'

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [localBypass, setLocalBypass] = useState(false)
  const [authChecked, setAuthChecked] = useState(!firebaseEnabled)
  const view = useProjectStore((s) => s.view)
  const project = useProjectStore((s) => s.project)
  const syncState = useProjectStore((s) => s.syncState)
  const setSyncState = useProjectStore((s) => s.setSyncState)

  useEffect(() => {
    if (!auth) return
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      setAuthChecked(true)
    })
  }, [])

  // Autoguardado con debounce: cualquier cambio al proyecto abierto (una
  // pared nueva, una importación, etc.) se persiste solo, sin botón de guardar.
  useEffect(() => {
    if (view !== 'editor' || !project) return
    setSyncState('saving')
    const t = setTimeout(() => {
      saveProject(project)
        .then(() => setSyncState(firebaseEnabled ? 'synced' : 'local'))
        .catch((err) => {
          // Si Firebase está configurado pero el guardado falla (reglas de
          // Firestore, base de datos no creada en la consola, permisos…) el
          // indicador de arriba decía igual "Local (sin Firebase)" — mismo
          // texto que cuando NUNCA hubo Firebase configurado, así que no
          // había forma de distinguir "nunca configurado" de "configurado
          // pero fallando" desde la UI (bug real, reportado: el usuario veía
          // "Local" con credenciales correctas en .env). Se loguea el error
          // real (el código de Firestore, ej. permission-denied o
          // not-found, dice exactamente qué falta arreglar en la consola de
          // Firebase) y se distingue el estado en el TopBar.
          if (firebaseEnabled) console.error('[autoguardado] Firestore rechazó el guardado:', err)
          setSyncState(firebaseEnabled ? 'error' : 'local')
        })
    }, 700)
    return () => clearTimeout(t)
  }, [project, view, setSyncState])

  // El autoguardado de arriba espera 700ms desde el último cambio antes de
  // guardar — si la pestaña se cierra o recarga ANTES de que ese plazo
  // termine, esos últimos cambios nunca se guardan y se pierden sin aviso
  // (bug real, reportado: "a veces pierdo datos" — el patrón clásico de un
  // debounce sin "flush" al salir; concuerda con la sospecha del usuario de
  // que dejar de editar un momento antes de cerrar ya lo evita, porque el
  // debounce alcanza a completarse). `syncState === 'saving'` cubre tanto
  // el debounce en espera como el guardado ya en curso. En modo local
  // `localStorage` es síncrono, así que el guardado de verdad se puede
  // forzar ahí mismo sin esperar nada; con Firebase una petición de red a
  // medio vuelo del cierre de la pestaña no es confiable (el navegador
  // puede cortarla), así que ahí se usa el diálogo nativo de "¿seguro que
  // quieres salir?" para darle al usuario la oportunidad de cancelar y
  // esperar a que el guardado termine solo.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (syncState !== 'saving' || !project) return
      if (!firebaseEnabled) {
        localSaveProject({ ...project, updatedAt: Date.now() })
        return
      }
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [syncState, project])

  // Ctrl/Cmd+Z y Ctrl/Cmd+Shift+Z (o Ctrl+Y) para deshacer/rehacer cualquier
  // edición (muros, puertas, ventanas, …) — todas pasan por el mismo historial.
  useEffect(() => {
    if (view !== 'editor') return
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (!mod) return
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      if (e.key.toLowerCase() === 'z' && e.shiftKey) {
        e.preventDefault()
        useProjectStore.getState().redo()
      } else if (e.key.toLowerCase() === 'z') {
        e.preventDefault()
        useProjectStore.getState().undo()
      } else if (e.key.toLowerCase() === 'y') {
        e.preventDefault()
        useProjectStore.getState().redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view])

  const authenticated = user !== null || localBypass

  if (!authChecked) {
    return <div className="w-full h-full flex items-center justify-center bg-[var(--bg-app)] text-[var(--text-secondary)] text-sm">Cargando…</div>
  }

  if (!authenticated) {
    return <Login onBypass={() => setLocalBypass(true)} />
  }

  if (view === 'projects') {
    return <ProjectsScreen />
  }

  return (
    <div className="relative w-full h-full overflow-hidden flex flex-col">
      <div className="absolute w-[640px] h-[640px] rounded-full blur-[70px] -left-[160px] -top-[220px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.35), transparent 70%)' }} />
      <div className="absolute w-[700px] h-[700px] rounded-full blur-[70px] -right-[200px] -top-[260px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.28), transparent 70%)' }} />

      <div className="relative z-10 flex flex-col h-full">
        <TopBar />
        <div className="flex-1 flex min-h-0">
          <Toolbar />
          <main className="flex-1 relative overflow-hidden bg-[var(--bg-canvas)]">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: 'linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)',
                backgroundSize: '26px 26px'
              }}
            />
            <CanvasViewport />
          </main>
          <LayersPanel />
        </div>
      </div>

      <ExportModal />
      <Toast />
    </div>
  )
}
