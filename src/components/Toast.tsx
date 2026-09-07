import { useEffect, useState } from 'react'
import { useProjectStore } from '../store/useProjectStore'

const VISIBLE_MS = 2600

export function Toast() {
  const toast = useProjectStore((s) => s.toast)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!toast) return
    setVisible(true)
    const t = setTimeout(() => setVisible(false), VISIBLE_MS)
    return () => clearTimeout(t)
  }, [toast])

  if (!toast || !visible) return null

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-6 z-30 flex justify-center">
      <div
        className="pointer-events-auto flex items-center gap-2 rounded-full border px-4 py-2 text-[12px] font-medium backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.35)]"
        style={{ background: 'var(--panel-bg-solid)', borderColor: 'var(--hairline)', color: 'var(--text-primary)' }}
      >
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none"><path d="M4 12 L10 18 L20 6" stroke="var(--stair-hl)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></svg>
        {toast.message}
      </div>
    </div>
  )
}
