import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useDragControls } from 'motion/react'
import { X } from 'lucide-react'
import { haptic } from '../lib/util'

/* ---------- Geri tuşu yığını ---------- */
const backStack: (() => void)[] = []
export function popBack(): boolean {
  const fn = backStack.pop()
  if (!fn) return false
  fn()
  return true
}

/* ---------- Bildirim baloncuğu ---------- */
let toastMsg: { id: number; text: string } | null = null
const toastSubs = new Set<() => void>()
let toastTimer: number | undefined
export function toast(text: string) {
  toastMsg = { id: Date.now(), text }
  toastSubs.forEach((f) => f())
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toastMsg = null
    toastSubs.forEach((f) => f())
  }, 2200)
}
function subToast(cb: () => void) {
  toastSubs.add(cb)
  return () => {
    toastSubs.delete(cb)
  }
}
export function ToastHost() {
  const t = useSyncExternalStore(subToast, () => toastMsg)
  return (
    <div className="toast-host" role="status" aria-live="polite">
      <AnimatePresence>
        {t && (
          <motion.div
            key={t.id}
            className="toast"
            initial={{ opacity: 0, y: 16, scale: 0.94, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
          >
            {t.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ---------- Alt sayfa ---------- */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const controls = useDragControls()
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!open) return
    const fn = () => closeRef.current()
    backStack.push(fn)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      const i = backStack.indexOf(fn)
      if (i >= 0) backStack.splice(i, 1)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="sheet-root">
          <motion.div
            className="sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
          />
          <motion.div
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            drag="y"
            dragControls={controls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 600) onClose()
            }}
          >
            <div className="sheet-grab" onPointerDown={(e) => controls.start(e)}>
              <span />
            </div>
            <header className="sheet-head">
              <h2>{title}</h2>
              <button className="icon-btn" onClick={onClose} aria-label="Kapat">
                <X size={20} />
              </button>
            </header>
            <div className="sheet-body">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/* ---------- Küçük kontroller ---------- */
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`toggle${checked ? ' on' : ''}`}
      onClick={() => {
        haptic()
        onChange(!checked)
      }}
    >
      <motion.span layout transition={{ type: 'spring', stiffness: 600, damping: 34 }} />
    </button>
  )
}

export function Chips<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div className="chips" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={`chip${o.value === value ? ' on' : ''}`}
          onClick={() => {
            haptic()
            onChange(o.value)
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function PageHead({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {action}
    </header>
  )
}
