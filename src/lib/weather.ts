import { useEffect, useState } from 'react'
import type { Place, SkyWeather } from './store'

export type Weather = {
  at: number
  placeKey: string
  current: { temp: number; feels: number; humidity: number; wind: number; code: number; isDay: boolean; cloud: number }
  hourly: { time: number; temp: number; code: number; rain: number; isDay: boolean }[]
  daily: { time: number; code: number; max: number; min: number; rain: number }[]
}

const KEY = 'gunum.weather.v2'
const MAX_AGE = 20 * 60 * 1000
const keyOf = (p: Place) => `${p.lat.toFixed(3)},${p.lon.toFixed(3)}`

function readCache(p: Place): Weather | null {
  try {
    const w = JSON.parse(localStorage.getItem(KEY) || 'null') as Weather | null
    return w && w.placeKey === keyOf(p) ? w : null
  } catch {
    return null
  }
}

async function fetchWeather(p: Place): Promise<Weather> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}` +
    '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day,cloud_cover' +
    '&hourly=temperature_2m,weather_code,precipitation_probability,is_day' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
    '&timezone=auto&forecast_days=7&timeformat=unixtime'
  const r = await fetch(url)
  if (!r.ok) throw new Error(`Hava servisi ${r.status}`)
  const j = await r.json()
  const now = Date.now()
  const hourly: Weather['hourly'] = []
  for (let i = 0; i < j.hourly.time.length && hourly.length < 24; i++) {
    const time = j.hourly.time[i] * 1000
    if (time < now - 30 * 60000) continue
    hourly.push({
      time,
      temp: j.hourly.temperature_2m[i],
      code: j.hourly.weather_code[i],
      rain: j.hourly.precipitation_probability?.[i] ?? 0,
      isDay: j.hourly.is_day[i] === 1,
    })
  }
  const w: Weather = {
    at: now,
    placeKey: keyOf(p),
    current: {
      temp: j.current.temperature_2m,
      feels: j.current.apparent_temperature,
      humidity: j.current.relative_humidity_2m,
      wind: j.current.wind_speed_10m,
      code: j.current.weather_code,
      isDay: j.current.is_day === 1,
      cloud: j.current.cloud_cover ?? 0,
    },
    hourly,
    daily: j.daily.time.map((t: number, i: number) => ({
      // Günlük zaman damgası konumun gece yarısıdır; öğlene kaydırmak gün adını saat dilimi farkından korur.
      time: t * 1000 + 12 * 3600 * 1000,
      code: j.daily.weather_code[i],
      max: j.daily.temperature_2m_max[i],
      min: j.daily.temperature_2m_min[i],
      rain: j.daily.precipitation_probability_max?.[i] ?? 0,
    })),
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(w))
  } catch {
    /* yok say */
  }
  return w
}

export type WeatherState = { data: Weather | null; loading: boolean; error: string | null; refresh: () => void }

export function useWeather(place: Place): WeatherState {
  const [data, setData] = useState<Weather | null>(() => readCache(place))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const k = keyOf(place)

  useEffect(() => {
    let dead = false
    const cached = readCache(place)
    setData(cached)
    if (cached && Date.now() - cached.at < MAX_AGE && tick === 0) return
    setLoading(true)
    fetchWeather(place)
      .then((w) => {
        if (dead) return
        setData(w)
        setError(null)
      })
      .catch(() => {
        if (!dead) setError('Hava durumu alınamadı. İnternet bağlantını kontrol et.')
      })
      .finally(() => {
        if (!dead) setLoading(false)
      })
    return () => {
      dead = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k, tick])

  useEffect(() => {
    const check = () => {
      if (document.visibilityState !== 'visible') return
      const c = readCache(place)
      if (!c || Date.now() - c.at > MAX_AGE) setTick((t) => t + 1)
    }
    document.addEventListener('visibilitychange', check)
    const id = window.setInterval(check, 10 * 60 * 1000)
    return () => {
      document.removeEventListener('visibilitychange', check)
      window.clearInterval(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k])

  return { data, loading, error, refresh: () => setTick((t) => t + 1) }
}

export type WxKind = 'clear' | 'partly' | 'cloud' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm'

export function wxInfo(code: number): { label: string; kind: WxKind; sky: SkyWeather } {
  if (code === 0) return { label: 'Açık', kind: 'clear', sky: 'clear' }
  if (code === 1) return { label: 'Az bulutlu', kind: 'partly', sky: 'clear' }
  if (code === 2) return { label: 'Parçalı bulutlu', kind: 'partly', sky: 'cloud' }
  if (code === 3) return { label: 'Kapalı', kind: 'cloud', sky: 'cloud' }
  if (code === 45 || code === 48) return { label: 'Sisli', kind: 'fog', sky: 'cloud' }
  if (code >= 51 && code <= 57) return { label: 'Çisenti', kind: 'drizzle', sky: 'rain' }
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82))
    return { label: code >= 80 ? 'Sağanak' : 'Yağmurlu', kind: 'rain', sky: 'rain' }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { label: 'Karlı', kind: 'snow', sky: 'snow' }
  if (code >= 95) return { label: 'Gök gürültülü', kind: 'storm', sky: 'rain' }
  return { label: 'Bulutlu', kind: 'cloud', sky: 'cloud' }
}

export type GeoResult = { name: string; region: string; lat: number; lon: number }

type GeoRow = { name: string; admin1?: string; country?: string; latitude: number; longitude: number }

export async function searchPlace(q: string): Promise<GeoResult[]> {
  const r = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=tr&format=json`,
  )
  if (!r.ok) throw new Error('Arama yapılamadı')
  const j = await r.json()
  return ((j.results || []) as GeoRow[]).map((x) => ({
    name: x.name,
    region: [x.admin1, x.country].filter(Boolean).join(', '),
    lat: x.latitude,
    lon: x.longitude,
  }))
}
