import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CalendarCheck, Copy, Pencil, Plus, Trash2, X } from 'lucide-react'
import { setState, useStore, type Field, type Payment } from '../lib/store'
import { copyText, daysUntil, dueLabel, fmtDayMonth, fmtDayMonthShort, fmtWeekday, haptic, nextMonth, parseYmd, uid, ymd } from '../lib/util'
import { PAY_KINDS, PayIcon } from '../ui/icons'
import { Chips, PageHead, Sheet, toast } from '../ui/kit'

function blank(): Payment {
  return {
    id: uid(),
    name: '',
    kind: 'elektrik',
    due: ymd(new Date()),
    repeat: 'monthly',
    amount: '',
    fields: [
      { id: uid(), label: 'Abone no', value: '' },
      { id: uid(), label: 'Kurum', value: '' },
    ],
    note: '',
  }
}

export function Payments({ now }: { now: Date }) {
  const payments = useStore((s) => s.payments)
  const [openId, setOpenId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Payment | null>(null)
  const sorted = [...payments].sort((a, b) => a.due.localeCompare(b.due))
  const current = payments.find((p) => p.id === openId) ?? null
  const urgent = sorted.filter((p) => daysUntil(p.due, now) <= 3).length

  const save = (p: Payment) => {
    const clean: Payment = {
      ...p,
      name: p.name.trim() || PAY_KINDS.find((k) => k.value === p.kind)!.label,
      fields: p.fields.filter((x) => x.label.trim() || x.value.trim()),
    }
    setState((s) => ({
      ...s,
      payments: s.payments.some((x) => x.id === clean.id)
        ? s.payments.map((x) => (x.id === clean.id ? clean : x))
        : [...s.payments, clean],
    }))
    setDraft(null)
    toast('Ödeme kaydedildi')
  }

  const markPaid = (p: Payment) => {
    haptic('medium')
    if (p.repeat === 'monthly') {
      const due = nextMonth(p.due)
      setState((s) => ({ ...s, payments: s.payments.map((x) => (x.id === p.id ? { ...x, due } : x)) }))
      toast(`Ödendi. Sıradaki: ${fmtDayMonth(parseYmd(due))}`)
    } else {
      setState((s) => ({ ...s, payments: s.payments.filter((x) => x.id !== p.id) }))
      toast('Ödendi, listeden kaldırıldı')
    }
    setOpenId(null)
  }

  const remove = (p: Payment) => {
    setState((s) => ({ ...s, payments: s.payments.filter((x) => x.id !== p.id) }))
    setOpenId(null)
    toast('Ödeme silindi')
  }

  return (
    <div className="screen">
      <PageHead
        title="Ödemeler"
        sub={
          payments.length === 0
            ? 'Faturalarını ve düzenli ödemelerini buraya ekle.'
            : urgent > 0
              ? `${urgent} ödemenin günü yaklaştı ya da geçti.`
              : 'Yakın zamanda son günü gelen ödeme yok.'
        }
        action={
          <button className="btn primary" onClick={() => setDraft(blank())}>
            <Plus size={18} aria-hidden="true" /> Ekle
          </button>
        }
      />

      {sorted.length === 0 ? (
        <div className="empty">
          <p>Elektrik, su, kira… Son ödeme tarihini bir kez gir, kalan günü burada gör; günü yaklaşınca bildirim gelsin.</p>
          <button className="btn ghost" onClick={() => setDraft(blank())}>
            <Plus size={18} aria-hidden="true" /> İlk ödemeni ekle
          </button>
        </div>
      ) : (
        <ul className="panel rows big">
          <AnimatePresence initial={false}>
            {sorted.map((p) => {
              const d = daysUntil(p.due, now)
              return (
                <motion.li
                  key={p.id}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 36 }}
                >
                  <button className="row" onClick={() => setOpenId(p.id)}>
                    <span className="row-ico">
                      <PayIcon kind={p.kind} />
                    </span>
                    <span className="row-main">{p.name}</span>
                    <span className="row-end">
                      <span className={`due ${d < 0 ? 'late' : d <= 3 ? 'near' : ''}`}>{dueLabel(d)}</span>
                      <span className="row-date">{fmtDayMonthShort(parseYmd(p.due))}</span>
                    </span>
                  </button>
                </motion.li>
              )
            })}
          </AnimatePresence>
        </ul>
      )}

      <Sheet open={!!current} onClose={() => setOpenId(null)} title={current?.name ?? ''}>
        {current && <Detail p={current} now={now} onPaid={markPaid} onEdit={(p) => { setOpenId(null); setDraft(p) }} onRemove={remove} />}
      </Sheet>

      <Sheet open={!!draft} onClose={() => setDraft(null)} title={draft && payments.some((p) => p.id === draft.id) ? 'Ödemeyi düzenle' : 'Yeni ödeme'}>
        {draft && <Form draft={draft} setDraft={setDraft} onSave={save} />}
      </Sheet>
    </div>
  )
}

function Detail({
  p,
  now,
  onPaid,
  onEdit,
  onRemove,
}: {
  p: Payment
  now: Date
  onPaid: (p: Payment) => void
  onEdit: (p: Payment) => void
  onRemove: (p: Payment) => void
}) {
  const [confirm, setConfirm] = useState(false)
  const d = daysUntil(p.due, now)
  const date = parseYmd(p.due)
  const info: Field[] = [
    ...(p.amount ? [{ id: 'amount', label: 'Tutar', value: p.amount }] : []),
    ...p.fields.filter((f) => f.value.trim()),
  ]
  return (
    <div className="detail">
      <div className="detail-due">
        <p className={`due-big ${d < 0 ? 'late' : d <= 3 ? 'near' : ''}`}>{dueLabel(d)}</p>
        <p className="muted">
          Son ödeme {fmtDayMonth(date)} {fmtWeekday(date)} · {p.repeat === 'monthly' ? 'her ay yinelenir' : 'tek seferlik'}
        </p>
      </div>

      {info.length > 0 && (
        <ul className="copy-list">
          {info.map((f) => (
            <li key={f.id}>
              <button
                className="copy-row"
                onClick={async () => {
                  haptic()
                  toast((await copyText(f.value)) ? `${f.label} kopyalandı` : 'Kopyalanamadı')
                }}
              >
                <span>
                  <small>{f.label}</small>
                  {f.value}
                </span>
                <Copy size={17} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {p.note && <p className="note">{p.note}</p>}

      <button className="btn primary wide" onClick={() => onPaid(p)}>
        <CalendarCheck size={18} aria-hidden="true" /> Ödendi olarak işaretle
      </button>
      <div className="btn-row">
        <button className="btn ghost" onClick={() => onEdit(p)}>
          <Pencil size={17} aria-hidden="true" /> Düzenle
        </button>
        {confirm ? (
          <button className="btn danger" onClick={() => onRemove(p)}>
            <Trash2 size={17} aria-hidden="true" /> Silmeyi onayla
          </button>
        ) : (
          <button className="btn ghost" onClick={() => setConfirm(true)}>
            <Trash2 size={17} aria-hidden="true" /> Sil
          </button>
        )}
      </div>
    </div>
  )
}

function Form({ draft, setDraft, onSave }: { draft: Payment; setDraft: (p: Payment) => void; onSave: (p: Payment) => void }) {
  const set = (patch: Partial<Payment>) => setDraft({ ...draft, ...patch })
  const setField = (id: string, patch: Partial<Field>) =>
    set({ fields: draft.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)) })
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault()
        onSave(draft)
      }}
    >
      <div className="kinds" role="radiogroup" aria-label="Ödeme türü">
        {PAY_KINDS.map((k) => (
          <button
            key={k.value}
            type="button"
            role="radio"
            aria-checked={draft.kind === k.value}
            className={`kind${draft.kind === k.value ? ' on' : ''}`}
            onClick={() => {
              const auto = !draft.name.trim() || PAY_KINDS.some((x) => x.label === draft.name)
              set({ kind: k.value, name: auto ? k.label : draft.name })
            }}
          >
            <k.icon size={20} strokeWidth={1.75} aria-hidden="true" />
            {k.label}
          </button>
        ))}
      </div>

      <label className="field">
        <span>Ad</span>
        <input value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="Elektrik faturası" />
      </label>
      <div className="field-2">
        <label className="field">
          <span>Son ödeme tarihi</span>
          <input type="date" required value={draft.due} onChange={(e) => set({ due: e.target.value || draft.due })} />
        </label>
        <label className="field">
          <span>Tutar (isteğe bağlı)</span>
          <input value={draft.amount} onChange={(e) => set({ amount: e.target.value })} placeholder="840 TL" inputMode="decimal" />
        </label>
      </div>
      <div className="field">
        <span>Yineleme</span>
        <Chips
          label="Yineleme"
          value={draft.repeat}
          onChange={(v) => set({ repeat: v })}
          options={[
            { value: 'monthly', label: 'Her ay' },
            { value: 'none', label: 'Tek seferlik' },
          ]}
        />
      </div>

      <fieldset className="field">
        <legend>Abone bilgileri</legend>
        {draft.fields.map((f) => (
          <div className="pair" key={f.id}>
            <input aria-label="Bilgi adı" value={f.label} onChange={(e) => setField(f.id, { label: e.target.value })} placeholder="Abone no" />
            <input aria-label={`${f.label || 'Bilgi'} değeri`} value={f.value} onChange={(e) => setField(f.id, { value: e.target.value })} placeholder="Değer" />
            <button type="button" className="icon-btn" aria-label={`${f.label || 'Bilgi'} satırını kaldır`} onClick={() => set({ fields: draft.fields.filter((x) => x.id !== f.id) })}>
              <X size={18} />
            </button>
          </div>
        ))}
        <button type="button" className="btn ghost small" onClick={() => set({ fields: [...draft.fields, { id: uid(), label: '', value: '' }] })}>
          <Plus size={16} aria-hidden="true" /> Bilgi ekle
        </button>
      </fieldset>

      <label className="field">
        <span>Not</span>
        <textarea rows={2} value={draft.note} onChange={(e) => set({ note: e.target.value })} placeholder="Otomatik ödeme talimatı yok" />
      </label>

      <button className="btn primary wide" type="submit">
        Kaydet
      </button>
    </form>
  )
}
