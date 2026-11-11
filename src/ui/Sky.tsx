import { useEffect, useRef, type CSSProperties } from 'react'
import { motion, useTransform, type MotionValue } from 'motion/react'
import type { SkyState } from '../lib/sky'
import type { SkyWeather } from '../lib/store'

type Star = { x: number; y: number; r: number; ph: number; sp: number }
type Drop = { x: number; y: number; l: number; v: number }

function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

const CLOUD_OPACITY: Record<SkyWeather, number> = { clear: 0.1, cloud: 0.62, rain: 0.78, snow: 0.72 }
const VEIL: Record<SkyWeather, number> = { clear: 0, cloud: 0.14, rain: 0.3, snow: 0.16 }

export function Sky({ sky, wx, progress }: { sky: SkyState; wx: SkyWeather; progress: MotionValue<number> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const live = useRef({ stars: sky.stars, wx })
  live.current = { stars: sky.stars, wx }

  const glowX = useTransform(progress, (p) => `${(0.5 - p) * 14}%`)
  const cloudX = useTransform(progress, (p) => `${(0.5 - p) * 8}%`)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rnd = seeded(7)
    const stars: Star[] = Array.from({ length: 120 }, () => ({
      x: rnd(),
      y: Math.pow(rnd(), 1.4) * 0.8,
      r: 0.4 + rnd() * 1.1,
      ph: rnd() * Math.PI * 2,
      sp: 0.4 + rnd() * 1.4,
    }))
    const drops: Drop[] = Array.from({ length: 110 }, () => ({ x: rnd(), y: rnd(), l: 0.012 + rnd() * 0.02, v: 0.55 + rnd() * 0.5 }))
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let w = 0
    let h = 0
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    let raf = 0
    let prev = 0
    let dirty = true
    const frame = (ms: number) => {
      raf = requestAnimationFrame(frame)
      if (ms - prev < 32) return
      const dt = Math.min(0.05, (ms - prev) / 1000)
      prev = ms
      const { stars: sa, wx: weather } = live.current
      const precip = weather === 'rain' || weather === 'snow'
      if (sa < 0.02 && !precip) {
        if (dirty) {
          ctx.clearRect(0, 0, w, h)
          dirty = false
        }
        return
      }
      dirty = true
      ctx.clearRect(0, 0, w, h)
      const t = ms / 1000
      if (sa >= 0.02) {
        const dim = weather === 'clear' ? 1 : 0.35
        for (const s of stars) {
          const tw = reduce ? 0.8 : 0.55 + 0.45 * Math.sin(t * s.sp + s.ph)
          ctx.globalAlpha = sa * tw * dim
          ctx.fillStyle = '#fff'
          ctx.beginPath()
          ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      if (weather === 'rain') {
        ctx.globalAlpha = 0.42
        ctx.strokeStyle = '#cfe0ff'
        ctx.lineWidth = 1.1
        ctx.beginPath()
        for (const d of drops) {
          if (!reduce) {
            d.y += d.v * dt * 1.6
            d.x -= d.v * dt * 0.22
            if (d.y > 1.05) {
              d.y = -0.05
              d.x = Math.random() * 1.2
            }
          }
          ctx.moveTo(d.x * w, d.y * h)
          ctx.lineTo(d.x * w - d.l * h * 0.14, (d.y + d.l) * h)
        }
        ctx.stroke()
      } else if (weather === 'snow') {
        ctx.fillStyle = '#fff'
        for (const d of drops) {
          if (!reduce) {
            d.y += d.v * dt * 0.12
            d.x += Math.sin(t * d.v + d.l * 400) * dt * 0.03
            if (d.y > 1.03) {
              d.y = -0.03
              d.x = Math.random()
            }
          }
          ctx.globalAlpha = 0.35 + d.v * 0.4
          ctx.beginPath()
          ctx.arc(d.x * w, d.y * h, 1 + d.l * 70, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      ctx.globalAlpha = 1
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  const style = {
    '--sky-top': sky.top,
    '--sky-mid': sky.mid,
    '--sky-bottom': sky.bottom,
    '--glow': sky.glow,
    '--glow-x': `${10 + sky.p * 80}%`,
    '--glow-y': `${46 - sky.alt * 34}%`,
    '--glow-a': sky.isDay ? (wx === 'clear' ? 0.46 : 0.22) : 0.26,
    '--cloud-a': CLOUD_OPACITY[wx],
    '--cloud-rgb': sky.isDay ? '255 255 255' : '132 146 204',
    '--veil-a': VEIL[wx],
  } as CSSProperties

  return (
    <div className="sky" style={style} aria-hidden="true">
      <motion.div className="sky-glow" style={{ x: glowX }} />
      <canvas ref={canvasRef} className="sky-canvas" />
      <motion.div className="clouds" style={{ x: cloudX }}>
        <span className="cloud c1" />
        <span className="cloud c2" />
        <span className="cloud c3" />
        <span className="cloud c4" />
      </motion.div>
      <div className="sky-veil" />
    </div>
  )
}
