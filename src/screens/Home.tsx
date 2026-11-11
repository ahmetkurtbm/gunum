import { motion } from 'motion/react'
import { ArrowDown, ArrowUp, BookOpen, Check, ChevronRight, Droplets, MapPin, Moon, RefreshCw, Settings2, Wind } from 'lucide-react'
import { pairOf } from '../lib/quran'
import { PRAYERS, nextPrayer, type Times } from '../lib/prayer'
import { setState, useStore, type Place } from '../lib/store'
import { daysUntil, dueLabel, fmtCountdown, fmtDayMonth, fmtHijri, fmtTime, fmtWeekday, fmtWeekdayShort, haptic } from '../lib/util'
import { wxInfo, type WeatherState } from '../lib/weather'
import { PayIcon, WxIcon } from '../ui/icons'

const ease = [0.16, 1, 0.3, 1] as const
const rise = {
  hidden: { opacity: 0, y: 22, filter: 'blur(8px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.7, ease } },
}

export function Home({
  now,
  times,
  place,
  weather,
  go,
  openSettings,
}: {
  now: Date
  times: Times
  place: Place
  weather: WeatherState
  go: (page: number) => void
  openSettings: () => void
}) {
  const quran = useStore((s) => s.quran)
  const pair = pairOf(quran.page)
  const payments = useStore((s) => s.payments)
  const todos = useStore((s) => s.todos)
  const next = nextPrayer(place, now)
  const nextInfo = PRAYERS.find((p) => p.key === next.key)!
  const w = weather.data
  const upcoming = [...payments].sort((a, b) => a.due.localeCompare(b.due)).slice(0, 2)
  const open = todos.filter((t) => !t.done)
  const hijri = fmtHijri(now)

  return (
    <motion.div className="home" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.07 } } }}>
      <motion.header className="home-top" variants={rise}>
        <div className="home-bar">
          <button className="place" onClick={openSettings} aria-label={`Konum: ${place.name}. Değiştirmek için ayarları aç`}>
            <MapPin size={15} aria-hidden="true" />
            {place.name}
          </button>
          <button className="icon-btn" onClick={openSettings} aria-label="Ayarlar">
            <Settings2 size={20} />
          </button>
        </div>
        <p className="today">
          {fmtDayMonth(now)} {fmtWeekday(now)}
          {hijri && <span> · {hijri}</span>}
        </p>
      </motion.header>

      <motion.section className="wx" variants={rise} aria-label="Hava durumu">
        {w ? (
          <>
            <div className="wx-main">
              <p className="wx-temp">
                {Math.round(w.current.temp)}
                <span>°</span>
              </p>
              <div className="wx-side">
                <WxIcon code={w.current.code} isDay={w.current.isDay} size={34} />
                <p className="wx-label">{wxInfo(w.current.code).label}</p>
                <p className="wx-feels">Hissedilen {Math.round(w.current.feels)}°</p>
              </div>
            </div>
            <ul className="wx-facts">
              <li>
                <ArrowUp size={14} aria-hidden="true" />
                {Math.round(w.daily[0]?.max ?? w.current.temp)}°
              </li>
              <li>
                <ArrowDown size={14} aria-hidden="true" />
                {Math.round(w.daily[0]?.min ?? w.current.temp)}°
              </li>
              <li>
                <Droplets size={14} aria-hidden="true" />
                Nem %{Math.round(w.current.humidity)}
              </li>
              <li>
                <Wind size={14} aria-hidden="true" />
                {Math.round(w.current.wind)} km/sa
              </li>
            </ul>
          </>
        ) : (
          <div className="wx-empty">
            <p className="wx-temp dim">
              –<span>°</span>
            </p>
            <div>
              <p>{weather.error ?? 'Hava durumu alınıyor…'}</p>
              {weather.error && (
                <button className="btn ghost small" onClick={weather.refresh}>
                  <RefreshCw size={15} aria-hidden="true" /> Yeniden dene
                </button>
              )}
            </div>
          </div>
        )}
      </motion.section>

      <motion.section className="arc-wrap" variants={rise} aria-label="Namaz vakitleri">
        <DayArc now={now} times={times} nextKey={next.key} />
        <div className="arc-count">
          <p className="arc-big">{fmtCountdown(next.at.getTime() - now.getTime())}</p>
          <p className="arc-sub">
            sonra {nextInfo.name} · {fmtTime(next.at)}
          </p>
        </div>
      </motion.section>

      <motion.ol className="vakits" variants={rise}>
        {PRAYERS.map((p) => (
          <li key={p.key} className={p.key === next.key ? 'next' : p.key === next.current ? 'current' : undefined}>
            <span>{p.name}</span>
            <strong>{fmtTime(times[p.key])}</strong>
          </li>
        ))}
      </motion.ol>

      {w && w.hourly.length > 0 && (
        <motion.section className="panel hours" variants={rise} aria-label="Saatlik tahmin">
          <ul>
            {w.hourly.slice(0, 14).map((h, i) => (
              <li key={h.time}>
                <span className="h-time">{i === 0 ? 'Şimdi' : fmtTime(new Date(h.time))}</span>
                <WxIcon code={h.code} isDay={h.isDay} size={22} />
                <strong>{Math.round(h.temp)}°</strong>
                <span className="h-rain">{h.rain >= 20 ? `%${Math.round(h.rain)}` : ''}</span>
              </li>
            ))}
          </ul>
        </motion.section>
      )}

      <motion.section className="panel soon" variants={rise}>
        <button className="soon-head" onClick={() => go(3)}>
          <h2>Ödemeler</h2>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
        {upcoming.length === 0 ? (
          <p className="muted pad">Kayıtlı ödeme yok. Eklemek için başlığa dokun.</p>
        ) : (
          <ul className="rows">
            {upcoming.map((p) => {
              const d = daysUntil(p.due, now)
              return (
                <li key={p.id}>
                  <button className="row" onClick={() => go(3)}>
                    <span className="row-ico">
                      <PayIcon kind={p.kind} />
                    </span>
                    <span className="row-main">{p.name}</span>
                    <span className={`due ${d < 0 ? 'late' : d <= 3 ? 'near' : ''}`}>{dueLabel(d)}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        <button className="soon-head second" onClick={() => go(1)}>
          <h2>Yapılacaklar</h2>
          <span className="count">{open.length}</span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
        {open.length === 0 ? (
          <p className="muted pad">Bugün için bekleyen iş yok.</p>
        ) : (
          <ul className="rows">
            {open.slice(0, 3).map((t) => (
              <li key={t.id}>
                <div className="row">
                  <button
                    className="check"
                    aria-label={`${t.text}: tamamlandı olarak işaretle`}
                    onClick={() => {
                      haptic('medium')
                      setState((s) => ({
                        ...s,
                        todos: s.todos.map((x) => (x.id === t.id ? { ...x, done: true, doneAt: Date.now() } : x)),
                      }))
                    }}
                  >
                    <Check size={14} strokeWidth={3} aria-hidden="true" />
                  </button>
                  <span className="row-main">{t.text}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </motion.section>

      <motion.button className="panel q-card" variants={rise} onClick={() => go(0)}>
        <span className="row-ico">
          <BookOpen size={20} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <span className="row-main">
          Kur’an Meali
          <small>{pair.length === 2 ? `Sayfa ${pair[0]}–${pair[1]}` : `Sayfa ${pair[0]}`}</small>
        </span>
        <span className={`due${quran.done ? ' ok' : ''}`}>{quran.done ? 'Okundu' : 'Bugün okunacak'}</span>
        <ChevronRight size={18} aria-hidden="true" />
      </motion.button>

      {w && w.daily.length > 1 && (
        <motion.section className="panel week" variants={rise} aria-label="7 günlük tahmin">
          <h2>Bu hafta</h2>
          <Week daily={w.daily} />
        </motion.section>
      )}

      {w && (
        <p className="stamp">
          Hava: Open-Meteo · {fmtTime(new Date(w.at))}
          {weather.loading ? ' · yenileniyor' : ''}
        </p>
      )}
    </motion.div>
  )
}

function Week({ daily }: { daily: { time: number; code: number; max: number; min: number; rain: number }[] }) {
  const lo = Math.min(...daily.map((d) => d.min))
  const hi = Math.max(...daily.map((d) => d.max))
  const span = Math.max(1, hi - lo)
  return (
    <ul className="week-rows">
      {daily.map((d, i) => (
        <li key={d.time}>
          <span className="w-day">{i === 0 ? 'Bugün' : fmtWeekdayShort(new Date(d.time))}</span>
          <WxIcon code={d.code} isDay size={20} />
          <span className="w-rain">{d.rain >= 20 ? `%${Math.round(d.rain)}` : ''}</span>
          <span className="w-min">{Math.round(d.min)}°</span>
          <span className="w-bar" aria-hidden="true">
            <i style={{ left: `${((d.min - lo) / span) * 100}%`, right: `${((hi - d.max) / span) * 100}%` }} />
          </span>
          <span className="w-max">{Math.round(d.max)}°</span>
        </li>
      ))}
    </ul>
  )
}

/* Günün yayı: yatay eksen imsaktan yatsıya zaman, eğri güneşin ufka göre yüksekliği. */
function DayArc({ now, times, nextKey }: { now: Date; times: Times; nextKey: string }) {
  const W = 340
  const H = 128
  const HY = 100
  const X0 = 16
  const X1 = 324
  const f = times.imsak.getTime()
  const sr = times.gunes.getTime()
  const mg = times.aksam.getTime()
  const ish = times.yatsi.getTime()
  const xOf = (t: number) => X0 + ((X1 - X0) * (t - f)) / (ish - f)
  const yOf = (t: number) => {
    if (t < sr) return HY + 24 * Math.sin((Math.PI / 2) * ((sr - t) / (sr - f)))
    if (t > mg) return HY + 24 * Math.sin((Math.PI / 2) * ((t - mg) / (ish - mg)))
    return HY - 76 * Math.sin((Math.PI * (t - sr)) / (mg - sr))
  }
  const n = now.getTime()
  const night = n < f || n > ish
  const tc = Math.min(ish, Math.max(f, n))
  const STEPS = 80
  const pts: string[] = []
  const done: string[] = []
  for (let i = 0; i <= STEPS; i++) {
    const t = f + ((ish - f) * i) / STEPS
    const cmd = `${i === 0 ? 'M' : 'L'}${xOf(t).toFixed(1)} ${yOf(t).toFixed(1)}`
    pts.push(cmd)
    if (t <= tc) done.push(cmd)
  }
  if (done.length) done.push(`L${xOf(tc).toFixed(1)} ${yOf(tc).toFixed(1)}`)
  const mx = xOf(tc)
  const my = yOf(tc)

  return (
    <svg className="arc" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Güneşin gün içindeki yolu ve namaz vakitleri">
      <defs>
        <linearGradient id="arcDone" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#ffb86b" stopOpacity="0.5" />
          <stop offset="1" stopColor="#ffd9a0" />
        </linearGradient>
        <radialGradient id="sunHalo">
          <stop offset="0" stopColor="#ffe2ae" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffb86b" stopOpacity="0" />
        </radialGradient>
      </defs>
      <line x1="0" x2={W} y1={HY} y2={HY} className="arc-horizon" />
      <path d={pts.join(' ')} className="arc-rest" />
      {done.length > 1 && (
        <motion.path
          d={done.join(' ')}
          className="arc-done"
          stroke="url(#arcDone)"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: 0.25 }}
        />
      )}
      {PRAYERS.map((p) => {
        const t = times[p.key].getTime()
        const isNext = p.key === nextKey
        return (
          <circle
            key={p.key}
            cx={xOf(t)}
            cy={yOf(t)}
            r={isNext ? 4.5 : 3}
            className={`arc-dot${t <= n ? ' past' : ''}${isNext ? ' next' : ''}`}
          />
        )
      })}
      {night ? (
        <g transform={`translate(${mx - 9} ${my - 26})`} className="arc-moon">
          <Moon size={18} strokeWidth={1.75} />
        </g>
      ) : (
        <motion.g
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.2, type: 'spring', stiffness: 260, damping: 18 }}
          style={{ transformOrigin: `${mx}px ${my}px` }}
        >
          <circle cx={mx} cy={my} r="20" fill="url(#sunHalo)" />
          <circle cx={mx} cy={my} r="6.5" className="arc-sun" />
        </motion.g>
      )}
    </svg>
  )
}
