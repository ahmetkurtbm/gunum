import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { AArrowDown, AArrowUp, BookOpenCheck, Check, ChevronRight, RefreshCw, SlidersHorizontal } from 'lucide-react'
import { EDITIONS, LAST_PAGE, SURAHS, jumpTo, loadPage, markRead, pairOf, prefetch, readAhead, syncQuranDay, type QPage } from '../lib/quran'
import { setState, useStore } from '../lib/store'
import { haptic } from '../lib/util'
import { Chips, PageHead, Sheet, toast } from '../ui/kit'

type Loaded = { key: string; pages: QPage[] | null; error: boolean }

export function Quran() {
  const q = useStore((s) => s.quran)
  const [data, setData] = useState<Loaded>({ key: '', pages: null, error: false })
  const [retry, setRetry] = useState(0)
  const [options, setOptions] = useState(false)
  const [goto, setGoto] = useState('')
  const pair = pairOf(q.page)
  const key = `${q.edition}:${q.page}`

  useEffect(() => {
    syncQuranDay()
    const f = () => document.visibilityState === 'visible' && syncQuranDay()
    document.addEventListener('visibilitychange', f)
    return () => document.removeEventListener('visibilitychange', f)
  }, [])

  useEffect(() => {
    let dead = false
    setData((d) => (d.key === key ? { ...d, error: false } : { key, pages: null, error: false }))
    Promise.all(pairOf(q.page).map((p) => loadPage(q.edition, p)))
      .then((pages) => {
        if (dead) return
        setData({ key, pages, error: false })
        prefetch(q.edition, q.page + 2)
      })
      .catch(() => {
        if (!dead) setData({ key, pages: null, error: true })
      })
    return () => {
      dead = true
    }
  }, [key, q.edition, q.page, retry])

  const pages = data.key === key ? data.pages : null
  const progress = Math.min(1, (q.page - 1 + (q.done ? pair.length : 0)) / LAST_PAGE)
  const pairLabel = pair.length === 2 ? `Sayfa ${pair[0]}–${pair[1]}` : `Sayfa ${pair[0]}`

  return (
    <div className="screen quran">
      <PageHead
        title="Kur’an Meali"
        sub={q.done ? 'Bugünkü okuman tamam.' : `Bugün: ${pairLabel.toLocaleLowerCase('tr-TR')}`}
        action={
          <button className="btn ghost" onClick={() => setOptions(true)} aria-label="Okuma seçenekleri">
            <SlidersHorizontal size={18} aria-hidden="true" />
          </button>
        }
      />

      <div className="q-progress" role="progressbar" aria-label="Hatim ilerlemesi" aria-valuemin={0} aria-valuemax={LAST_PAGE} aria-valuenow={q.page - 1}>
        <span>
          <motion.i animate={{ width: `${progress * 100}%` }} transition={{ type: 'spring', stiffness: 120, damping: 24 }} />
        </span>
        <small>
          {LAST_PAGE} sayfanın {Math.round(progress * LAST_PAGE)}’i okundu
          {q.hatim > 0 ? ` · ${q.hatim} hatim` : ''}
        </small>
      </div>

      <AnimatePresence mode="wait">
        {pages ? (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 18, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="q-pages"
            style={{ fontSize: `${q.size}rem` }}
          >
            {pages.map((p) => (
              <MealPage key={p.page} p={p} />
            ))}
          </motion.div>
        ) : data.error ? (
          <motion.div key="err" className="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <p>Bu sayfalar henüz telefona inmemiş ve şu an indirilemedi. İnternete bağlanıp yeniden dene; bir kez inen sayfa internetsiz de açılır.</p>
            <button className="btn ghost" onClick={() => setRetry((n) => n + 1)}>
              <RefreshCw size={17} aria-hidden="true" /> Yeniden dene
            </button>
          </motion.div>
        ) : (
          <motion.div key="load" className="panel q-page q-skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-label="Sayfalar yükleniyor">
            {[92, 100, 84, 96, 70, 100, 88].map((w, i) => (
              <span key={i} style={{ width: `${w}%` }} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {pages &&
        (q.done ? (
          <div className="q-done">
            <p>
              <BookOpenCheck size={20} aria-hidden="true" /> Okundu. Yarın sıradaki iki sayfa açılır.
            </p>
            <button
              className="btn ghost wide"
              onClick={() => {
                haptic()
                readAhead()
              }}
            >
              Şimdi devam et <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <button
            className="btn primary wide"
            onClick={() => {
              haptic('medium')
              markRead()
              toast('Bugünkü okuma tamamlandı')
            }}
          >
            <Check size={18} aria-hidden="true" /> Okudum
          </button>
        ))}

      <p className="stamp">Meal: {EDITIONS.find((e) => e.value === q.edition)?.label} · alquran.cloud</p>

      <Sheet open={options} onClose={() => setOptions(false)} title="Okuma seçenekleri">
        <div className="form">
          <div className="field">
            <span>Meal</span>
            <Chips label="Meal" value={q.edition} options={EDITIONS} onChange={(v) => setState((s) => ({ ...s, quran: { ...s.quran, edition: v } }))} />
          </div>
          <div className="field">
            <span>Yazı boyutu</span>
            <div className="btn-row">
              <button className="btn ghost" disabled={q.size <= 0.9} onClick={() => setState((s) => ({ ...s, quran: { ...s.quran, size: Math.max(0.9, +(s.quran.size - 0.1).toFixed(2)) } }))}>
                <AArrowDown size={19} aria-hidden="true" /> Küçült
              </button>
              <button className="btn ghost" disabled={q.size >= 1.5} onClick={() => setState((s) => ({ ...s, quran: { ...s.quran, size: Math.min(1.5, +(s.quran.size + 0.1).toFixed(2)) } }))}>
                <AArrowUp size={19} aria-hidden="true" /> Büyüt
              </button>
            </div>
          </div>
          <form
            className="field"
            onSubmit={(e) => {
              e.preventDefault()
              const n = Number(goto)
              if (!Number.isFinite(n) || n < 1 || n > LAST_PAGE) {
                toast(`1 ile ${LAST_PAGE} arasında bir sayfa yaz`)
                return
              }
              jumpTo(n)
              setGoto('')
              setOptions(false)
              toast('Okuma bu sayfadan sürecek')
            }}
          >
            <span>Kaldığım sayfa</span>
            <div className="search">
              <input value={goto} onChange={(e) => setGoto(e.target.value)} inputMode="numeric" placeholder={`Şu an ${q.page}. sayfadasın`} aria-label="Sayfa numarası" />
              <button className="btn primary" type="submit">
                Git
              </button>
            </div>
            <small className="muted">Başka bir yerde okuyorsan kaldığın sayfayı yaz; günlük iki sayfa oradan devam eder.</small>
          </form>
        </div>
      </Sheet>
    </div>
  )
}

function MealPage({ p }: { p: QPage }) {
  const blocks: { surah: number; starts: boolean; ayahs: QPage['ayahs'] }[] = []
  for (const a of p.ayahs) {
    const last = blocks[blocks.length - 1]
    if (!last || last.surah !== a.surah) blocks.push({ surah: a.surah, starts: a.n === 1, ayahs: [a] })
    else last.ayahs.push(a)
  }
  const names = [...new Set(p.ayahs.map((a) => SURAHS[a.surah - 1]))].join(', ')
  return (
    <article className="panel q-page">
      <header>
        <span>{names}</span>
        <span>
          Cüz {p.juz} · Sayfa {p.page}
        </span>
      </header>
      {blocks.map((b) => (
        <section key={`${b.surah}-${b.ayahs[0].n}`}>
          {b.starts && <h2>{SURAHS[b.surah - 1]} Suresi</h2>}
          <p>
            {b.ayahs.map((a) => (
              <span key={a.n} className="ayah">
                <sup>{a.n}</sup>
                {a.text}{' '}
              </span>
            ))}
          </p>
        </section>
      ))}
    </article>
  )
}
