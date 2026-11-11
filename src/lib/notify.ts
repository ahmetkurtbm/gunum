import { LocalNotifications } from '@capacitor/local-notifications'
import { getState, subscribe } from './store'
import { PRAYERS, timesFor } from './prayer'
import { daysUntil, isNative, parseYmd } from './util'

const DAYS_AHEAD = 7

export type NotifyStatus = { supported: boolean; granted: boolean; exact: boolean }

export async function notifyStatus(): Promise<NotifyStatus> {
  if (!isNative) return { supported: false, granted: false, exact: false }
  try {
    const p = await LocalNotifications.checkPermissions()
    let exact = true
    try {
      exact = (await LocalNotifications.checkExactNotificationSetting()).exact_alarm === 'granted'
    } catch {
      exact = true
    }
    return { supported: true, granted: p.display === 'granted', exact }
  } catch {
    return { supported: false, granted: false, exact: false }
  }
}

export async function askPermission(): Promise<boolean> {
  if (!isNative) return false
  const p = await LocalNotifications.requestPermissions()
  return p.display === 'granted'
}

export async function askExact(): Promise<void> {
  if (!isNative) return
  try {
    await LocalNotifications.changeExactNotificationSetting()
  } catch {
    /* eski Android: gerek yok */
  }
}

/** Bekleyen bütün bildirimleri silip ayarlara göre yeniden kurar. */
export async function reschedule(requestIfNeeded = false): Promise<void> {
  if (!isNative) return
  const { settings, payments } = getState()
  try {
    let perm = (await LocalNotifications.checkPermissions()).display
    const wants = settings.prayer.enabled || settings.pay.enabled
    if (perm !== 'granted' && wants && requestIfNeeded) {
      perm = (await LocalNotifications.requestPermissions()).display
    }
    const pending = await LocalNotifications.getPending()
    if (pending.notifications.length) {
      await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) })
    }
    if (perm !== 'granted') return

    await LocalNotifications.createChannel({ id: 'vakit', name: 'Namaz vakitleri', importance: 4, visibility: 1 })
    await LocalNotifications.createChannel({ id: 'odeme', name: 'Ödeme hatırlatmaları', importance: 4, visibility: 1 })

    const now = Date.now()
    const list: { id: number; title: string; body: string; channelId: string; schedule: { at: Date; allowWhileIdle: boolean } }[] = []

    if (settings.prayer.enabled) {
      const base = new Date()
      for (let d = 0; d < DAYS_AHEAD; d++) {
        const day = new Date(base.getFullYear(), base.getMonth(), base.getDate() + d)
        const t = timesFor(settings.place, day)
        PRAYERS.forEach((p, i) => {
          if (!settings.prayer.which[p.key]) return
          const at = t[p.key].getTime()
          if (settings.prayer.atTime && at > now) {
            list.push({
              id: 1000 + d * 20 + i * 2,
              title: `${p.name} vakti`,
              body: `${settings.place.name} için ${p.name.toLocaleLowerCase('tr-TR')} vakti girdi.`,
              channelId: 'vakit',
              schedule: { at: new Date(at), allowWhileIdle: true },
            })
          }
          const early = at - settings.prayer.before * 60000
          if (settings.prayer.before > 0 && early > now) {
            list.push({
              id: 1000 + d * 20 + i * 2 + 1,
              title: `${p.dative} ${settings.prayer.before} dakika`,
              body: `${p.name} vakti yaklaşıyor.`,
              channelId: 'vakit',
              schedule: { at: new Date(early), allowWhileIdle: true },
            })
          }
        })
      }
    }

    if (settings.pay.enabled) {
      payments.forEach((pay, i) => {
        const due = parseYmd(pay.due)
        const marks = [...new Set([settings.pay.daysBefore, 0])]
        marks.forEach((before, j) => {
          const at = new Date(due.getFullYear(), due.getMonth(), due.getDate() - before, settings.pay.hour, 0, 0)
          if (at.getTime() <= now) return
          list.push({
            id: 5000 + i * 4 + j,
            title: before === 0 ? `${pay.name}: bugün son gün` : `${pay.name}: ${before} gün kaldı`,
            body: pay.amount ? `Tutar ${pay.amount}` : 'Son ödeme tarihi yaklaşıyor.',
            channelId: 'odeme',
            schedule: { at, allowWhileIdle: true },
          })
        })
        if (daysUntil(pay.due) < 0) {
          // gecikmiş ödeme: yarın sabah bir kez hatırlat
          const t = new Date()
          const at = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1, settings.pay.hour, 0, 0)
          list.push({
            id: 5000 + i * 4 + 3,
            title: `${pay.name} gecikti`,
            body: 'Son ödeme tarihi geçti.',
            channelId: 'odeme',
            schedule: { at, allowWhileIdle: true },
          })
        }
      })
    }

    if (list.length) await LocalNotifications.schedule({ notifications: list })
  } catch (e) {
    console.warn('Bildirimler kurulamadı', e)
  }
}

export async function testNotification(): Promise<boolean> {
  if (!isNative) return false
  if (!(await askPermission())) return false
  await LocalNotifications.createChannel({ id: 'vakit', name: 'Namaz vakitleri', importance: 4, visibility: 1 })
  await LocalNotifications.schedule({
    notifications: [
      {
        id: 99,
        title: 'Günüm',
        body: 'Bildirimler çalışıyor.',
        channelId: 'vakit',
        schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true },
      },
    ],
  })
  return true
}

/** Ayar ya da ödeme değişince ve uygulama öne gelince bildirimleri yeniler. */
export function startNotifications() {
  if (!isNative) return
  let timer: number | undefined
  let lastKey = ''
  const keyOf = () => {
    const s = getState()
    return JSON.stringify([s.settings, s.payments.map((p) => [p.id, p.name, p.due, p.amount])])
  }
  const run = (ask: boolean) => {
    window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      lastKey = keyOf()
      void reschedule(ask)
    }, 600)
  }
  run(true)
  subscribe(() => {
    if (keyOf() !== lastKey) run(false)
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') run(false)
  })
}
