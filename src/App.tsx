import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { motion, useScroll, useTransform, type MotionValue } from 'motion/react'
import { App as NativeApp } from '@capacitor/app'
import { BookOpen, House, ListChecks, UserRound, Wallet, type LucideIcon } from 'lucide-react'
import { timesFor } from './lib/prayer'
import { skyAt } from './lib/sky'
import { usePreview, useStore } from './lib/store'
import { haptic, isNative } from './lib/util'
import { useWeather, wxInfo } from './lib/weather'
import { Home } from './screens/Home'
import { Payments } from './screens/Payments'
import { Profile } from './screens/Profile'
import { Quran } from './screens/Quran'
import { Settings } from './screens/Settings'
import { Todos } from './screens/Todos'
import { Sheet, ToastHost, popBack } from './ui/kit'
import { Sky } from './ui/Sky'

const TABS: { label: string; icon: LucideIcon }[] = [
  { label: 'Kur’an', icon: BookOpen },
  { label: 'Yapılacaklar', icon: ListChecks },
  { label: 'Ana sayfa', icon: House },
  { label: 'Ödemeler', icon: Wallet },
  { label: 'Profil', icon: UserRound },
]
const HOME = 2
const LAST = TABS.length - 1

function useNow(previewMinutes: number | null): Date {
  const [tick, setTick] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now()), 15000)
    const f = () => document.visibilityState === 'visible' && setTick(Date.now())
    document.addEventListener('visibilitychange', f)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', f)
    }
  }, [])
  return useMemo(() => {
    const d = new Date(tick)
    if (previewMinutes === null) return d
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(previewMinutes / 60), previewMinutes % 60)
  }, [tick, previewMinutes])
}

export default function App() {
  const place = useStore((s) => s.settings.place)
  const preview = usePreview()
  const now = useNow(preview.minutes)
  const times = timesFor(place, now)
  const sky = skyAt(now, times)
  const weather = useWeather(place)
  const wx = preview.weather ?? (weather.data ? wxInfo(weather.data.current.code).sky : 'clear')

  const pager = useRef<HTMLDivElement>(null)
  const { scrollXProgress } = useScroll({ container: pager })
  const [active, setActive] = useState(HOME)
  const activeRef = useRef(HOME)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [keyboard, setKeyboard] = useState(false)

  const go = useCallback((i: number, smooth = true) => {
    const el = pager.current
    if (!el) return
    el.scrollTo({ left: i * el.clientWidth, behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  useLayoutEffect(() => {
    go(HOME, false)
  }, [go])

  useEffect(() => {
    const el = pager.current
    if (!el) return
    const onScroll = () => {
      const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth))
      if (i !== activeRef.current) {
        activeRef.current = i
        setActive(i)
        haptic()
      }
    }
    const onResize = () => go(activeRef.current, false)
    el.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    return () => {
      el.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
    }
  }, [go])

  // Klavye açılınca alt çubuk yazı alanının üstüne binmesin.
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    let full = vv.height
    const f = () => {
      full = Math.max(full, vv.height)
      setKeyboard(full - vv.height > 140)
    }
    vv.addEventListener('resize', f)
    return () => vv.removeEventListener('resize', f)
  }, [])

  useEffect(() => {
    if (!isNative) return
    const sub = NativeApp.addListener('backButton', () => {
      if (popBack()) return
      if (activeRef.current !== HOME) go(HOME)
      else void NativeApp.minimizeApp()
    })
    return () => {
      void sub.then((s) => s.remove())
    }
  }, [go])

  const openSettings = useCallback(() => setSettingsOpen(true), [])

  return (
    <>
      <Sky sky={sky} wx={wx} progress={scrollXProgress} />
      <main className="pager" ref={pager}>
        <Page index={0} progress={scrollXProgress} active={active}>
          <Quran />
        </Page>
        <Page index={1} progress={scrollXProgress} active={active}>
          <Todos />
        </Page>
        <Page index={2} progress={scrollXProgress} active={active}>
          <Home now={now} times={times} place={place} weather={weather} go={go} openSettings={openSettings} />
        </Page>
        <Page index={3} progress={scrollXProgress} active={active}>
          <Payments now={now} />
        </Page>
        <Page index={4} progress={scrollXProgress} active={active}>
          <Profile />
        </Page>
      </main>

      <nav className={`tabbar${keyboard ? ' hidden' : ''}`} aria-label="Sekmeler">
        <motion.span className="tab-glow" style={{ x: useTransform(scrollXProgress, (p) => `${p * LAST * 100}%`) }} aria-hidden="true" />
        {TABS.map((t, i) => (
          <button
            key={t.label}
            className={`tab${i === HOME ? ' home' : ''}${i === active ? ' on' : ''}`}
            aria-current={i === active ? 'page' : undefined}
            aria-label={t.label}
            onClick={() => go(i)}
          >
            <t.icon size={i === HOME ? 26 : 22} strokeWidth={i === active ? 2.1 : 1.7} aria-hidden="true" />
            {i !== HOME && <span>{t.label}</span>}
          </button>
        ))}
      </nav>

      <Sheet open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Ayarlar">
        <Settings now={now} />
      </Sheet>
      <ToastHost />
    </>
  )
}

function Page({ index, progress, active, children }: { index: number; progress: MotionValue<number>; active: number; children: ReactNode }) {
  const d = useTransform(progress, (p) => p * LAST - index)
  const scale = useTransform(d, [-1, 0, 1], [0.9, 1, 0.9])
  const opacity = useTransform(d, [-1, -0.5, 0, 0.5, 1], [0, 0.55, 1, 0.55, 0])
  const rotateY = useTransform(d, [-1, 0, 1], [14, 0, -14])
  const y = useTransform(d, [-1, 0, 1], [26, 0, 26])
  return (
    <section className="page" aria-hidden={active !== index} inert={active !== index}>
      <motion.div className="page-inner" style={{ scale, opacity, rotateY, y, transformPerspective: 900 }}>
        {children}
      </motion.div>
    </section>
  )
}
