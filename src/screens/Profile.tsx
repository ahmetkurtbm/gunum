import { useState } from 'react'
import { motion } from 'motion/react'
import { Check, Copy, Pencil, Plus, Trash2, X } from 'lucide-react'
import { setState, useStore, type Field, type ProfileGroup } from '../lib/store'
import { copyText, haptic, uid } from '../lib/util'
import { PageHead, toast } from '../ui/kit'

const setGroups = (fn: (g: ProfileGroup[]) => ProfileGroup[]) => setState((s) => ({ ...s, profile: fn(s.profile) }))
const patchGroup = (id: string, fn: (g: ProfileGroup) => ProfileGroup) =>
  setGroups((gs) => gs.map((g) => (g.id === id ? fn(g) : g)))

export function Profile() {
  const groups = useStore((s) => s.profile)
  const [editing, setEditing] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const filled = groups.some((g) => g.fields.some((f) => f.value.trim()))

  const copy = async (f: Field) => {
    haptic()
    const ok = await copyText(f.value)
    toast(ok ? `${f.label} kopyalandı` : 'Kopyalanamadı')
    if (ok) {
      setCopied(f.id)
      window.setTimeout(() => setCopied((c) => (c === f.id ? null : c)), 1400)
    }
  }

  return (
    <div className="screen">
      <PageHead
        title="Profil"
        sub={editing ? 'Alanları doldur; bitince Tamam’a bas.' : filled ? 'Kopyalamak için bir satıra dokun.' : 'Bilgilerini bir kez gir, hep elinin altında olsun.'}
        action={
          <button className={`btn ${editing ? 'primary' : 'ghost'}`} onClick={() => setEditing(!editing)}>
            {editing ? <Check size={18} aria-hidden="true" /> : <Pencil size={17} aria-hidden="true" />}
            {editing ? 'Tamam' : 'Düzenle'}
          </button>
        }
      />

      {groups.map((g) => {
        const shown = editing ? g.fields : g.fields.filter((f) => f.value.trim())
        return (
          <motion.section layout="position" key={g.id} className="group">
            {editing ? (
              <div className="group-edit-head">
                <input
                  className="group-title-input"
                  aria-label="Grup adı"
                  value={g.title}
                  onChange={(e) => patchGroup(g.id, (x) => ({ ...x, title: e.target.value }))}
                  placeholder="Grup adı"
                />
                <button className="icon-btn subtle" aria-label={`${g.title || 'Grup'} grubunu sil`} onClick={() => setGroups((gs) => gs.filter((x) => x.id !== g.id))}>
                  <Trash2 size={18} />
                </button>
              </div>
            ) : (
              <h2>{g.title}</h2>
            )}

            {editing ? (
              <div className="panel pad-in">
                {g.fields.map((f) => (
                  <div className="pair" key={f.id}>
                    <input
                      aria-label="Alan adı"
                      value={f.label}
                      onChange={(e) => patchGroup(g.id, (x) => ({ ...x, fields: x.fields.map((y) => (y.id === f.id ? { ...y, label: e.target.value } : y)) }))}
                      placeholder="Alan adı"
                    />
                    <input
                      aria-label={`${f.label || 'Alan'} değeri`}
                      value={f.value}
                      onChange={(e) => patchGroup(g.id, (x) => ({ ...x, fields: x.fields.map((y) => (y.id === f.id ? { ...y, value: e.target.value } : y)) }))}
                      placeholder="Değer"
                    />
                    <button className="icon-btn" aria-label={`${f.label || 'Alan'} satırını kaldır`} onClick={() => patchGroup(g.id, (x) => ({ ...x, fields: x.fields.filter((y) => y.id !== f.id) }))}>
                      <X size={18} />
                    </button>
                  </div>
                ))}
                <button className="btn ghost small" onClick={() => patchGroup(g.id, (x) => ({ ...x, fields: [...x.fields, { id: uid(), label: '', value: '' }] }))}>
                  <Plus size={16} aria-hidden="true" /> Alan ekle
                </button>
              </div>
            ) : shown.length === 0 ? (
              <button className="panel hint" onClick={() => setEditing(true)}>
                {g.title === 'Aile' ? 'Aile bireylerinin TC ve telefonlarını eklemek için dokun.' : 'Henüz bilgi yok. Eklemek için dokun.'}
              </button>
            ) : (
              <ul className="panel copy-list flush">
                {shown.map((f) => (
                  <li key={f.id}>
                    <button className="copy-row" onClick={() => copy(f)}>
                      <span>
                        <small>{f.label}</small>
                        {f.value}
                      </span>
                      {copied === f.id ? <Check size={18} className="ok" aria-hidden="true" /> : <Copy size={17} aria-hidden="true" />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </motion.section>
        )
      })}

      {editing && (
        <button className="btn ghost wide" onClick={() => setGroups((gs) => [...gs, { id: uid(), title: '', fields: [{ id: uid(), label: '', value: '' }] }])}>
          <Plus size={18} aria-hidden="true" /> Grup ekle
        </button>
      )}
      <p className="stamp">Bu bilgiler yalnızca bu telefonda saklanır.</p>
    </div>
  )
}
