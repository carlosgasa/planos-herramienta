import { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth, firebaseEnabled } from '../lib/firebase'
import { ThemeToggle } from './ThemeToggle'

export function Login({ onBypass }: { onBypass: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!auth) return
    setLoading(true)
    setError(null)
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch {
      setError('Correo o contraseña incorrectos.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-[var(--bg-app)]">
      <div className="absolute w-[800px] h-[800px] rounded-full blur-[90px] -left-[220px] -top-[260px]" style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.4), transparent 70%)' }} />
      <div className="absolute w-[820px] h-[820px] rounded-full blur-[90px] -right-[260px] -top-[200px]" style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.3), transparent 70%)' }} />

      <div className="absolute top-5 right-5 z-10"><ThemeToggle /></div>

      <div className="absolute top-14 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2.5 z-10">
        <div className="w-[52px] h-[52px] rounded-2xl border border-white/20 shadow-[0_0_32px_rgba(122,163,255,0.4)] flex items-center justify-center bg-gradient-to-br from-cyan-400 to-purple-500">
          <svg width={24} height={24} viewBox="0 0 24 24" fill="none"><path d="M3 12 L12 4 L21 12 M6 10 V20 H18 V10" stroke="#0a0a10" strokeWidth={1.8} strokeLinejoin="round" /></svg>
        </div>
        <div className="text-[15px] font-semibold tracking-[0.06em]">PLANOS RESIDENCIALES</div>
      </div>

      <div className="relative z-10 w-[380px] rounded-[20px] border border-[color:var(--hairline)] bg-[color:var(--panel-bg)] backdrop-blur-2xl shadow-[0_0_70px_rgba(120,80,220,0.22)] p-8">
        <div className="text-[19px] font-semibold mb-1.5">Iniciar sesión</div>
        <div className="text-[12.5px] text-[var(--text-secondary)] mb-6 leading-relaxed">
          Acceso privado con Firebase Auth. Las cuentas se crean desde consola — este formulario no registra usuarios nuevos.
        </div>

        {!firebaseEnabled && (
          <div className="mb-4 rounded-lg border border-amber-400/30 bg-amber-400/10 text-[color:var(--warn-text)] text-[11px] px-3 py-2">
            Firebase aún no está configurado en este entorno (.env). Puedes explorar la app en modo local mientras tanto.
          </div>
        )}

        <div className="mb-4">
          <label className="block font-mono-ui text-[10px] tracking-[0.08em] text-[var(--text-secondary)] mb-1.5">CORREO</label>
          <div className="flex items-center border border-[color:var(--hairline)] rounded-[10px] bg-[color:var(--glass-weak)] px-3 focus-within:border-cyan-400/60 focus-within:shadow-[0_0_14px_rgba(34,211,238,0.25)]">
            <input type="email" placeholder="tu@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} className="flex-1 bg-transparent outline-none text-[13.5px] py-2.5" />
          </div>
        </div>

        <div className="mb-4">
          <label className="block font-mono-ui text-[10px] tracking-[0.08em] text-[var(--text-secondary)] mb-1.5">CONTRASEÑA</label>
          <div className="flex items-center border border-[color:var(--hairline)] rounded-[10px] bg-[color:var(--glass-weak)] px-3 focus-within:border-cyan-400/60 focus-within:shadow-[0_0_14px_rgba(34,211,238,0.25)]">
            <input type={showPw ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="flex-1 bg-transparent outline-none text-[13.5px] py-2.5" />
            <button onClick={() => setShowPw((v) => !v)} className="text-[var(--text-tertiary)]">
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke="currentColor" strokeWidth={1.6} /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth={1.6} /></svg>
            </button>
          </div>
        </div>

        {error && <div className="text-[11px] text-[color:var(--danger-text)] mb-3">{error}</div>}

        {firebaseEnabled ? (
          <button onClick={handleSubmit} disabled={loading} className="w-full rounded-[10px] py-3 text-[13.5px] font-semibold text-[#08080d] bg-gradient-to-br from-cyan-400 to-purple-500 shadow-[0_0_22px_rgba(168,85,247,0.45)]">
            {loading ? 'Verificando…' : 'Entrar'}
          </button>
        ) : (
          <button onClick={onBypass} className="w-full rounded-[10px] py-3 text-[13.5px] font-semibold text-[#08080d] bg-gradient-to-br from-cyan-400 to-purple-500 shadow-[0_0_22px_rgba(168,85,247,0.45)]">
            Entrar en modo local
          </button>
        )}

        <div className="flex items-center gap-2.5 my-5 text-[10.5px] text-[var(--text-tertiary)] before:content-[''] before:flex-1 before:h-px before:bg-[color:var(--hairline)] after:content-[''] after:flex-1 after:h-px after:bg-[color:var(--hairline)]">
          SIN REGISTRO PÚBLICO
        </div>
        <div className="flex items-center justify-center gap-2 text-[11px] text-[var(--text-tertiary)]">
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth={1.6} /><path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth={1.6} /></svg>
          Cuenta gestionada por el administrador
        </div>
      </div>
    </div>
  )
}
