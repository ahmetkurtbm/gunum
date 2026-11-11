import { getState, setState } from './store'
import { ymd } from './util'

export const LAST_PAGE = 604

export const EDITIONS = [
  { value: 'tr.diyanet', label: 'Diyanet İşleri' },
  { value: 'tr.vakfi', label: 'Diyanet Vakfı' },
  { value: 'tr.yazir', label: 'Elmalılı' },
]

export const SURAHS = [
  'Fâtiha', 'Bakara', 'Âl-i İmrân', 'Nisâ', 'Mâide', 'En’âm', 'A’râf', 'Enfâl', 'Tevbe', 'Yûnus',
  'Hûd', 'Yûsuf', 'Ra’d', 'İbrâhîm', 'Hicr', 'Nahl', 'İsrâ', 'Kehf', 'Meryem', 'Tâhâ',
  'Enbiyâ', 'Hac', 'Mü’minûn', 'Nûr', 'Furkân', 'Şuarâ', 'Neml', 'Kasas', 'Ankebût', 'Rûm',
  'Lokmân', 'Secde', 'Ahzâb', 'Sebe’', 'Fâtır', 'Yâsîn', 'Sâffât', 'Sâd', 'Zümer', 'Mü’min',
  'Fussilet', 'Şûrâ', 'Zuhruf', 'Duhân', 'Câsiye', 'Ahkâf', 'Muhammed', 'Fetih', 'Hucurât', 'Kâf',
  'Zâriyât', 'Tûr', 'Necm', 'Kamer', 'Rahmân', 'Vâkıa', 'Hadîd', 'Mücâdele', 'Haşr', 'Mümtehine',
  'Saf', 'Cuma', 'Münâfikûn', 'Teğâbün', 'Talâk', 'Tahrîm', 'Mülk', 'Kalem', 'Hâkka', 'Meâric',
  'Nûh', 'Cin', 'Müzzemmil', 'Müddessir', 'Kıyâme', 'İnsân', 'Mürselât', 'Nebe’', 'Nâziât', 'Abese',
  'Tekvîr', 'İnfitâr', 'Mutaffifîn', 'İnşikâk', 'Bürûc', 'Târık', 'A’lâ', 'Gâşiye', 'Fecr', 'Beled',
  'Şems', 'Leyl', 'Duhâ', 'İnşirâh', 'Tîn', 'Alak', 'Kadir', 'Beyyine', 'Zilzâl', 'Âdiyât',
  'Kâria', 'Tekâsür', 'Asr', 'Hümeze', 'Fîl', 'Kureyş', 'Mâûn', 'Kevser', 'Kâfirûn', 'Nasr',
  'Tebbet', 'İhlâs', 'Felak', 'Nâs',
]

export type QAyah = { n: number; surah: number; text: string }
export type QPage = { page: number; juz: number; ayahs: QAyah[] }

const cacheKey = (edition: string, page: number) => `gunum.q.${edition}.${page}`
const inflight = new Map<string, Promise<QPage>>()

function readCached(edition: string, page: number): QPage | null {
  try {
    const s = localStorage.getItem(cacheKey(edition, page))
    return s ? (JSON.parse(s) as QPage) : null
  } catch {
    return null
  }
}

type ApiAyah = { text: string; numberInSurah: number; juz: number; surah: { number: number } }

/** Mushaf sayfasının mealini getirir; bir kez indirilen sayfa telefonda saklanır. */
export function loadPage(edition: string, page: number): Promise<QPage> {
  const cached = readCached(edition, page)
  if (cached) return Promise.resolve(cached)
  const k = cacheKey(edition, page)
  const running = inflight.get(k)
  if (running) return running
  const job = fetch(`https://api.alquran.cloud/v1/page/${page}/${edition}`)
    .then((r) => {
      if (!r.ok) throw new Error(`Meal servisi ${r.status}`)
      return r.json()
    })
    .then((j) => {
      const ayahs = (j?.data?.ayahs ?? []) as ApiAyah[]
      if (!ayahs.length) throw new Error('Sayfa boş geldi')
      const q: QPage = {
        page,
        juz: ayahs[0].juz,
        ayahs: ayahs.map((a) => ({ n: a.numberInSurah, surah: a.surah.number, text: a.text.trim() })),
      }
      try {
        localStorage.setItem(k, JSON.stringify(q))
      } catch {
        /* depolama dolu: önbelleksiz devam */
      }
      return q
    })
    .finally(() => inflight.delete(k))
  inflight.set(k, job)
  return job
}

/** Sonraki günlerin sayfalarını sessizce indirir ki internetsiz de okunabilsin. */
export function prefetch(edition: string, from: number, count = 6) {
  for (let i = 0; i < count; i++) {
    const p = from + i
    if (p <= LAST_PAGE) loadPage(edition, p).catch(() => {})
  }
}

export const pairOf = (start: number): number[] => (start >= LAST_PAGE ? [LAST_PAGE] : [start, start + 1])

function advance(page: number): { page: number; wrapped: boolean } {
  const next = page + 2
  return next > LAST_PAGE ? { page: 1, wrapped: true } : { page: next, wrapped: false }
}

/** Gün değiştiyse: dünkü okunduysa sıradaki iki sayfaya geçer, okunmadıysa aynı çift kalır. */
export function syncQuranDay(now = new Date()) {
  const today = ymd(now)
  const q = getState().quran
  if (q.day === today) return
  setState((s) => {
    if (!s.quran.done) return { ...s, quran: { ...s.quran, day: today } }
    const a = advance(s.quran.page)
    return { ...s, quran: { ...s.quran, page: a.page, day: today, done: false, hatim: s.quran.hatim + (a.wrapped ? 1 : 0) } }
  })
}

export function markRead() {
  setState((s) => ({ ...s, quran: { ...s.quran, done: true, day: ymd(new Date()) } }))
}

/** Bugünkü okuma bittiyse fazladan okumak için sıradaki çifte geçer. */
export function readAhead() {
  setState((s) => {
    const a = advance(s.quran.page)
    return { ...s, quran: { ...s.quran, page: a.page, done: false, hatim: s.quran.hatim + (a.wrapped ? 1 : 0) } }
  })
}

export function jumpTo(page: number) {
  const p = Math.min(LAST_PAGE, Math.max(1, Math.round(page)))
  const start = p % 2 === 0 ? p - 1 : p
  setState((s) => ({ ...s, quran: { ...s.quran, page: start, done: false, day: ymd(new Date()) } }))
}
