import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle } from '@capacitor/haptics'

export const uid = () => Math.random().toString(36).slice(2, 10)
export const pad = (n: number) => String(n).padStart(2, '0')
export const fmtTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Bugünden hedef güne kalan tam gün sayısı (geçmişse negatif). */
export function daysUntil(due: string, now = new Date()): number {
  return Math.round((parseYmd(due).getTime() - startOfDay(now).getTime()) / 86400000)
}

/** Aynı günü bir sonraki aya taşır; ayın son günleri taşmaz (31 Ocak -> 28 Şubat). */
export function nextMonth(due: string): string {
  const d = parseYmd(due)
  const day = d.getDate()
  const first = new Date(d.getFullYear(), d.getMonth() + 1, 1)
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  first.setDate(Math.min(day, last))
  return ymd(first)
}

const dayMonth = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long' })
const dayMonthShort = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' })
const weekdayLong = new Intl.DateTimeFormat('tr-TR', { weekday: 'long' })
const weekdayShort = new Intl.DateTimeFormat('tr-TR', { weekday: 'short' })
export const fmtDayMonth = (d: Date) => dayMonth.format(d)
export const fmtDayMonthShort = (d: Date) => dayMonthShort.format(d)
export const fmtWeekday = (d: Date) => weekdayLong.format(d)
export const fmtWeekdayShort = (d: Date) => weekdayShort.format(d)

export function fmtHijri(d: Date): string {
  try {
    const parts = new Intl.DateTimeFormat('tr-TR-u-ca-islamic-umalqura', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).formatToParts(d)
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
    return `${Number(get('day')) || get('day')} ${get('month')} ${get('year')}`.trim()
  } catch {
    return ''
  }
}

export function dueLabel(days: number): string {
  if (days < -1) return `${-days} gün gecikti`
  if (days === -1) return 'Dün doldu'
  if (days === 0) return 'Bugün son gün'
  if (days === 1) return 'Yarın son gün'
  return `${days} gün kaldı`
}

export function fmtCountdown(ms: number): string {
  const min = Math.max(0, Math.ceil(ms / 60000))
  if (min < 1) return 'şimdi'
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m} dk`
  if (m === 0) return `${h} sa`
  return `${h} sa ${m} dk`
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}

export const isNative = Capacitor.isNativePlatform()

export function haptic(kind: 'light' | 'medium' = 'light') {
  if (!isNative) return
  Haptics.impact({ style: kind === 'light' ? ImpactStyle.Light : ImpactStyle.Medium }).catch(() => {})
}
