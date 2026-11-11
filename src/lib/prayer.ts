import { CalculationMethod, Coordinates, PrayerTimes } from 'adhan'
import type { Place, PrayerKey } from './store'

export type Times = Record<PrayerKey, Date>

export const PRAYERS: { key: PrayerKey; name: string; dative: string }[] = [
  { key: 'imsak', name: 'İmsak', dative: 'İmsaka' },
  { key: 'gunes', name: 'Güneş', dative: 'Güneşe' },
  { key: 'ogle', name: 'Öğle', dative: 'Öğleye' },
  { key: 'ikindi', name: 'İkindi', dative: 'İkindiye' },
  { key: 'aksam', name: 'Akşam', dative: 'Akşama' },
  { key: 'yatsi', name: 'Yatsı', dative: 'Yatsıya' },
]

const cache = new Map<string, Times>()

/** Diyanet yöntemiyle (adhan: Turkey) hesaplanır; resmi takvimden 1-2 dk sapabilir. */
export function timesFor(place: Place, date: Date): Times {
  const k = `${place.lat},${place.lon},${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
  const hit = cache.get(k)
  if (hit) return hit
  const pt = new PrayerTimes(new Coordinates(place.lat, place.lon), date, CalculationMethod.Turkey())
  const t: Times = {
    imsak: pt.fajr,
    gunes: pt.sunrise,
    ogle: pt.dhuhr,
    ikindi: pt.asr,
    aksam: pt.maghrib,
    yatsi: pt.isha,
  }
  if (cache.size > 40) cache.clear()
  cache.set(k, t)
  return t
}

export function nextPrayer(place: Place, now: Date): { key: PrayerKey; at: Date; current: PrayerKey } {
  const today = timesFor(place, now)
  let current: PrayerKey = 'yatsi'
  for (const p of PRAYERS) {
    if (today[p.key].getTime() > now.getTime()) return { key: p.key, at: today[p.key], current }
    current = p.key
  }
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return { key: 'imsak', at: timesFor(place, tomorrow).imsak, current: 'yatsi' }
}
