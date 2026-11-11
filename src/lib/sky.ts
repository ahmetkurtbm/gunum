import type { Times } from './prayer'

type RGB = [number, number, number]
type Pal = { c: [RGB, RGB, RGB]; stars: number }

const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const pal = (a: string, b: string, c: string, stars: number): Pal => ({ c: [hex(a), hex(b), hex(c)], stars })

// Gökyüzü durakları: üst, orta, ufuk rengi ve yıldız görünürlüğü.
const NIGHT = pal('#040820', '#0a123a', '#1a2260', 1)
const FIRST_LIGHT = pal('#0a1238', '#252a6e', '#63438a', 0.75)
const PRE_SUNRISE = pal('#1c2f7c', '#7a4f9c', '#ee8a5e', 0.15)
const SUNRISE = pal('#2452ac', '#c0709a', '#f59f5c', 0)
const MORNING = pal('#1257b8', '#2f7bd2', '#5c9bdc', 0)
const NOON = pal('#0b4fb0', '#1f70cf', '#4a93dc', 0)
const AFTERNOON = pal('#1552a6', '#3a7cc8', '#7f9fca', 0)
const GOLDEN = pal('#234f9a', '#96689e', '#ef9a58', 0)
const SUNSET = pal('#2a2e7a', '#ae4c7c', '#f2774a', 0.05)
const DUSK = pal('#131950', '#48307a', '#a34f6e', 0.45)
const LATE_DUSK = pal('#080e30', '#151c56', '#2e2a6c', 0.85)

const MIN = 60000
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const mix = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]
const css = (c: RGB) => `rgb(${Math.round(c[0])} ${Math.round(c[1])} ${Math.round(c[2])})`

export type SkyState = {
  top: string
  mid: string
  bottom: string
  stars: number
  isDay: boolean
  /** Güneşin (gece ise ayın) gökteki yatay ilerleyişi, 0-1. */
  p: number
  /** Yükseklik, 0 ufuk - 1 tepe. */
  alt: number
  glow: string
}

export function skyAt(now: Date, t: Times): SkyState {
  const n = now.getTime()
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const sr = t.gunes.getTime()
  const mg = t.aksam.getTime()
  const stops: [number, Pal][] = [
    [dayStart, NIGHT],
    [t.imsak.getTime() - 40 * MIN, NIGHT],
    [t.imsak.getTime(), FIRST_LIGHT],
    [sr - 25 * MIN, PRE_SUNRISE],
    [sr, SUNRISE],
    [sr + 70 * MIN, MORNING],
    [t.ogle.getTime(), NOON],
    [t.ikindi.getTime(), AFTERNOON],
    [mg - 50 * MIN, GOLDEN],
    [mg, SUNSET],
    [mg + 30 * MIN, DUSK],
    [t.yatsi.getTime(), LATE_DUSK],
    [t.yatsi.getTime() + 40 * MIN, NIGHT],
    [dayStart + 24 * 60 * MIN, NIGHT],
  ]
  let a = stops[0]
  let b = stops[stops.length - 1]
  for (let i = 0; i < stops.length - 1; i++) {
    if (n >= stops[i][0] && n <= stops[i + 1][0]) {
      a = stops[i]
      b = stops[i + 1]
      break
    }
  }
  const span = Math.max(1, b[0] - a[0])
  const k = Math.min(1, Math.max(0, (n - a[0]) / span))
  const isDay = n >= sr && n <= mg
  let p: number
  if (isDay) p = (n - sr) / (mg - sr)
  else {
    const nightLen = 24 * 60 * MIN - (mg - sr)
    p = n > mg ? (n - mg) / nightLen : (n + 24 * 60 * MIN - mg) / nightLen
  }
  p = Math.min(1, Math.max(0, p))
  const alt = Math.sin(Math.PI * p)
  const glow = isDay ? css(mix(hex('#ff9a55'), hex('#fff0c8'), alt)) : css(hex('#c9d4ff'))
  return {
    top: css(mix(a[1].c[0], b[1].c[0], k)),
    mid: css(mix(a[1].c[1], b[1].c[1], k)),
    bottom: css(mix(a[1].c[2], b[1].c[2], k)),
    stars: lerp(a[1].stars, b[1].stars, k),
    isDay,
    p,
    alt,
    glow,
  }
}
