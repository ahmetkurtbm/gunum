import { useSyncExternalStore } from 'react'
import { uid } from './util'

export type Field = { id: string; label: string; value: string }

export type PaymentKind =
  | 'elektrik' | 'su' | 'dogalgaz' | 'internet' | 'telefon' | 'kira' | 'kredi' | 'diger'

export type Payment = {
  id: string
  name: string
  kind: PaymentKind
  due: string // YYYY-MM-DD
  repeat: 'monthly' | 'none'
  amount: string
  fields: Field[]
  note: string
}

export type Todo = { id: string; text: string; done: boolean; createdAt: number; doneAt?: number }
export type ProfileGroup = { id: string; title: string; fields: Field[] }
export type PrayerKey = 'imsak' | 'gunes' | 'ogle' | 'ikindi' | 'aksam' | 'yatsi'
export type Place = { name: string; region: string; lat: number; lon: number }

export type Settings = {
  place: Place
  prayer: { enabled: boolean; atTime: boolean; before: number; which: Record<PrayerKey, boolean> }
  pay: { enabled: boolean; daysBefore: number; hour: number }
}

/** Günlük okuma: `page` o günün iki sayfasının ilki; okunmayan çift ertesi güne taşınır. */
export type QuranState = { page: number; day: string; done: boolean; edition: string; size: number; hatim: number }

export type State = {
  quran: QuranState
  payments: Payment[]
  todos: Todo[]
  profile: ProfileGroup[]
  settings: Settings
}

const KEY = 'gunum.v1'
const f = (label: string): Field => ({ id: uid(), label, value: '' })

function defaults(): State {
  return {
    quran: { page: 1, day: '', done: false, edition: 'tr.diyanet', size: 1, hatim: 0 },
    payments: [],
    todos: [],
    profile: [
      { id: uid(), title: 'Kişisel', fields: [f('Ad Soyad'), f('TC Kimlik No'), f('Telefon'), f('E-posta'), f('Doğum tarihi')] },
      { id: uid(), title: 'Banka', fields: [f('IBAN'), f('Banka')] },
      { id: uid(), title: 'Adres', fields: [f('Ev adresi')] },
      { id: uid(), title: 'Aile', fields: [] },
    ],
    settings: {
      place: { name: 'Osmaniye', region: 'Merkez', lat: 37.0742, lon: 36.2478 },
      prayer: {
        enabled: true,
        atTime: true,
        before: 10,
        which: { imsak: true, gunes: false, ogle: true, ikindi: true, aksam: true, yatsi: true },
      },
      pay: { enabled: true, daysBefore: 2, hour: 9 },
    },
  }
}

function normalize(raw: unknown): State {
  const d = defaults()
  if (!raw || typeof raw !== 'object') return d
  const r = raw as Partial<State>
  return {
    quran: { ...d.quran, ...r.quran },
    payments: Array.isArray(r.payments) ? r.payments : d.payments,
    todos: Array.isArray(r.todos) ? r.todos : d.todos,
    profile: Array.isArray(r.profile) ? r.profile : d.profile,
    settings: {
      place: { ...d.settings.place, ...r.settings?.place },
      prayer: {
        ...d.settings.prayer,
        ...r.settings?.prayer,
        which: { ...d.settings.prayer.which, ...r.settings?.prayer?.which },
      },
      pay: { ...d.settings.pay, ...r.settings?.pay },
    },
  }
}

function load(): State {
  try {
    const s = localStorage.getItem(KEY)
    return s ? normalize(JSON.parse(s)) : defaults()
  } catch {
    return defaults()
  }
}

let state = load()
const subs = new Set<() => void>()

export const getState = () => state

export function setState(fn: (s: State) => State) {
  state = fn(state)
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* depolama dolu: bellekte devam */
  }
  subs.forEach((cb) => cb())
}

export function subscribe(cb: () => void) {
  subs.add(cb)
  return () => {
    subs.delete(cb)
  }
}

export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => sel(state))
}

export const exportData = () => JSON.stringify(state)

export function importData(json: string): boolean {
  try {
    const parsed = JSON.parse(json)
    if (!parsed || typeof parsed !== 'object' || !('settings' in parsed)) return false
    setState(() => normalize(parsed))
    return true
  } catch {
    return false
  }
}

/* Gökyüzü önizlemesi: kalıcı değil, yalnızca oturumda. */
export type SkyWeather = 'clear' | 'cloud' | 'rain' | 'snow'
export type Preview = { minutes: number | null; weather: SkyWeather | null }
let preview: Preview = { minutes: null, weather: null }
const psubs = new Set<() => void>()

export function setPreview(p: Partial<Preview>) {
  preview = { ...preview, ...p }
  psubs.forEach((cb) => cb())
}

function psubscribe(cb: () => void) {
  psubs.add(cb)
  return () => {
    psubs.delete(cb)
  }
}

export function usePreview(): Preview {
  return useSyncExternalStore(psubscribe, () => preview)
}
