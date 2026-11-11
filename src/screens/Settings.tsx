import { useEffect, useState } from 'react'
import { BellRing, ClipboardCopy, ClipboardPaste, MapPin, RotateCcw, Search } from 'lucide-react'
import { PRAYERS } from '../lib/prayer'
import { exportData, importData, setPreview, setState, usePreview, useStore, type Settings as S, type SkyWeather } from '../lib/store'
import { askExact, askPermission, notifyStatus, reschedule, testNotification, type NotifyStatus } from '../lib/notify'
import { copyText, haptic, pad } from '../lib/util'
import { searchPlace, type GeoResult } from '../lib/weather'
import { Chips, Toggle, toast } from '../ui/kit'

const patch = (fn: (s: S) => S) => setState((st) => ({ ...st, settings: fn(st.settings) }))

export function Settings({ now }: { now: Date }) {
  const settings = useStore((s) => s.settings)
  const preview = usePreview()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<GeoResult[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [status, setStatus] = useState<NotifyStatus | null>(null)
  const [backup, setBackup] = useState('')

  const refreshStatus = () => notifyStatus().then(setStatus)
  useEffect(() => {
    void refreshStatus()
    const f = () => document.visibilityState === 'visible' && void refreshStatus()
    document.addEventListener('visibilitychange', f)
    return () => document.removeEventListener('visibilitychange', f)
  }, [])

  const search = async () => {
    if (q.trim().length < 2) return
    setSearching(true)
    try {
      setResults(await searchPlace(q.trim()))
    } catch {
      setResults([])
      toast('Arama yapılamadı. İnternet bağlantını kontrol et.')
    } finally {
      setSearching(false)
    }
  }

  const minutes = preview.minutes ?? now.getHours() * 60 + now.getMinutes()

  return (
    <div className="settings">

      <section className="group">
        <h2>Konum</h2>
        <div className="panel pad-in">
          <p className="place-now">
            <MapPin size={17} aria-hidden="true" />
            <span>
              {settings.place.name}
              <small>{settings.place.region}</small>
            </span>
          </p>
          <form
            className="search"
            onSubmit={(e) => {
              e.preventDefault()
              void search()
            }}
          >
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="İl ya da ilçe ara" aria-label="Konum ara" enterKeyHint="search" />
            <button className="round" type="submit" aria-label="Ara" disabled={searching}>
              <Search size={19} />
            </button>
          </form>
          {results && results.length === 0 && <p className="muted">Sonuç bulunamadı. Yazımı kontrol et.</p>}
          {results && results.length > 0 && (
            <ul className="results">
              {results.map((r) => (
                <li key={`${r.lat},${r.lon}`}>
                  <button
                    onClick={() => {
                      patch((s) => ({ ...s, place: r }))
                      setResults(null)
                      setQ('')
                      toast(`Konum ${r.name} oldu`)
                    }}
                  >
                    {r.name}
                    <small>{r.region}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="group">
        <h2>Namaz bildirimleri</h2>
        <div className="panel pad-in">
          <div className="set-row">
            <span>Bildirim gönder</span>
            <Toggle label="Namaz bildirimleri" checked={settings.prayer.enabled} onChange={(v) => patch((s) => ({ ...s, prayer: { ...s.prayer, enabled: v } }))} />
          </div>
          {settings.prayer.enabled && (
            <>
              <div className="set-row">
                <span>Vakit girdiğinde</span>
                <Toggle label="Vakit girdiğinde bildir" checked={settings.prayer.atTime} onChange={(v) => patch((s) => ({ ...s, prayer: { ...s.prayer, atTime: v } }))} />
              </div>
              <div className="set-col">
                <span>Vakitten önce hatırlat</span>
                <Chips
                  label="Vakitten önce"
                  value={settings.prayer.before}
                  onChange={(v) => patch((s) => ({ ...s, prayer: { ...s.prayer, before: v } }))}
                  options={[
                    { value: 0, label: 'Kapalı' },
                    { value: 5, label: '5 dk' },
                    { value: 10, label: '10 dk' },
                    { value: 15, label: '15 dk' },
                    { value: 30, label: '30 dk' },
                  ]}
                />
              </div>
              <div className="set-col">
                <span>Hangi vakitler</span>
                <div className="chips">
                  {PRAYERS.map((p) => (
                    <button
                      key={p.key}
                      className={`chip${settings.prayer.which[p.key] ? ' on' : ''}`}
                      aria-pressed={settings.prayer.which[p.key]}
                      onClick={() => {
                        haptic()
                        patch((s) => ({ ...s, prayer: { ...s.prayer, which: { ...s.prayer.which, [p.key]: !s.prayer.which[p.key] } } }))
                      }}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="group">
        <h2>Ödeme hatırlatmaları</h2>
        <div className="panel pad-in">
          <div className="set-row">
            <span>Bildirim gönder</span>
            <Toggle label="Ödeme hatırlatmaları" checked={settings.pay.enabled} onChange={(v) => patch((s) => ({ ...s, pay: { ...s.pay, enabled: v } }))} />
          </div>
          {settings.pay.enabled && (
            <>
              <div className="set-col">
                <span>Son günden kaç gün önce</span>
                <Chips
                  label="Kaç gün önce"
                  value={settings.pay.daysBefore}
                  onChange={(v) => patch((s) => ({ ...s, pay: { ...s.pay, daysBefore: v } }))}
                  options={[1, 2, 3, 5, 7].map((n) => ({ value: n, label: `${n} gün` }))}
                />
              </div>
              <div className="set-col">
                <span>Saat</span>
                <Chips
                  label="Hatırlatma saati"
                  value={settings.pay.hour}
                  onChange={(v) => patch((s) => ({ ...s, pay: { ...s.pay, hour: v } }))}
                  options={[8, 9, 12, 18, 20].map((n) => ({ value: n, label: `${pad(n)}:00` }))}
                />
              </div>
              <p className="muted">Son gün ayrıca aynı saatte bir kez daha hatırlatılır.</p>
            </>
          )}
        </div>
      </section>

      <section className="group">
        <h2>Bildirim izni</h2>
        <div className="panel pad-in">
          {!status?.supported ? (
            <p className="muted">Bildirimler telefona kurulu uygulamada çalışır; tarayıcı önizlemesinde kapalıdır.</p>
          ) : (
            <>
              <div className="set-row">
                <span>{status.granted ? 'Bildirim izni verildi' : 'Bildirim izni verilmedi'}</span>
                {!status.granted && (
                  <button
                    className="btn primary small"
                    onClick={async () => {
                      await askPermission()
                      await reschedule()
                      void refreshStatus()
                    }}
                  >
                    İzin ver
                  </button>
                )}
              </div>
              {!status.exact && (
                <div className="set-row">
                  <span>
                    Tam vaktinde çalsın
                    <small>İzin verilmezse bildirim birkaç dakika gecikebilir.</small>
                  </span>
                  <button className="btn ghost small" onClick={() => void askExact()}>
                    Ayarı aç
                  </button>
                </div>
              )}
              <button
                className="btn ghost"
                onClick={async () => toast((await testNotification()) ? '5 saniye içinde deneme bildirimi gelecek' : 'Önce bildirim izni ver')}
              >
                <BellRing size={17} aria-hidden="true" /> Deneme bildirimi gönder
              </button>
            </>
          )}
        </div>
      </section>

      <section className="group">
        <h2>Gökyüzü önizlemesi</h2>
        <div className="panel pad-in">
          <label className="set-col">
            <span>
              Saat {pad(Math.floor(minutes / 60))}:{pad(minutes % 60)}
              {preview.minutes !== null && <small>Önizleme açık; namaz sayacı da bu saate göre gösterilir.</small>}
            </span>
            <input type="range" min={0} max={1439} step={5} value={minutes} onChange={(e) => setPreview({ minutes: Number(e.target.value) })} />
          </label>
          <div className="set-col">
            <span>Hava</span>
            <Chips<SkyWeather | 'auto'>
              label="Hava önizlemesi"
              value={preview.weather ?? 'auto'}
              onChange={(v) => setPreview({ weather: v === 'auto' ? null : v })}
              options={[
                { value: 'auto', label: 'Gerçek' },
                { value: 'clear', label: 'Açık' },
                { value: 'cloud', label: 'Bulutlu' },
                { value: 'rain', label: 'Yağmur' },
                { value: 'snow', label: 'Kar' },
              ]}
            />
          </div>
          {(preview.minutes !== null || preview.weather !== null) && (
            <button className="btn ghost" onClick={() => setPreview({ minutes: null, weather: null })}>
              <RotateCcw size={17} aria-hidden="true" /> Şimdiye dön
            </button>
          )}
        </div>
      </section>

      <section className="group">
        <h2>Yedek</h2>
        <div className="panel pad-in">
          <p className="muted">Veriler yalnızca bu telefonda durur; uygulama silinirse gider. Yedeği kopyalayıp güvendiğin bir yere yapıştır.</p>
          <button className="btn ghost" onClick={async () => toast((await copyText(exportData())) ? 'Yedek panoya kopyalandı' : 'Kopyalanamadı')}>
            <ClipboardCopy size={17} aria-hidden="true" /> Yedeği kopyala
          </button>
          <textarea rows={2} value={backup} onChange={(e) => setBackup(e.target.value)} placeholder="Geri yüklemek için yedek metnini buraya yapıştır" aria-label="Yedek metni" />
          <button
            className="btn ghost"
            disabled={!backup.trim()}
            onClick={() => {
              if (importData(backup.trim())) {
                setBackup('')
                toast('Yedek geri yüklendi')
              } else toast('Bu metin geçerli bir yedek değil')
            }}
          >
            <ClipboardPaste size={17} aria-hidden="true" /> Yedekten geri yükle
          </button>
        </div>
      </section>

      <p className="stamp">Günüm 1.0 · Namaz vakitleri Diyanet yöntemiyle hesaplanır, resmi takvimden 1-2 dakika sapabilir.</p>
    </div>
  )
}
