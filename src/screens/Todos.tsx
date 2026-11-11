import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Mic, Plus, Square, Trash2 } from 'lucide-react'
import { setState, useStore, type Todo } from '../lib/store'
import { listen, type Listener } from '../lib/speech'
import { haptic, uid } from '../lib/util'
import { PageHead, toast } from '../ui/kit'

const spring = { type: 'spring', stiffness: 420, damping: 36 } as const

function addTodo(text: string) {
  const t = text.trim()
  if (!t) return false
  const clean = t.charAt(0).toLocaleUpperCase('tr-TR') + t.slice(1)
  setState((s) => ({ ...s, todos: [{ id: uid(), text: clean, done: false, createdAt: Date.now() }, ...s.todos] }))
  return true
}

export function Todos() {
  const todos = useStore((s) => s.todos)
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)
  const listener = useRef<Listener | null>(null)
  const open = todos.filter((t) => !t.done)
  const done = todos.filter((t) => t.done).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0))

  const submit = () => {
    if (addTodo(text)) {
      haptic()
      setText('')
    }
  }

  const toggleMic = async () => {
    if (listening) {
      listener.current?.stop()
      return
    }
    haptic('medium')
    setListening(true)
    setText('')
    listener.current = await listen({
      onPartial: (t) => setText(t),
      onDone: (t) => {
        setListening(false)
        listener.current = null
        if (addTodo(t)) {
          setText('')
          haptic('medium')
          toast('Listeye eklendi')
        } else {
          setText('')
          toast('Bir şey duyamadım. Tekrar dene.')
        }
      },
      onError: (m) => {
        setListening(false)
        listener.current = null
        toast(m)
      },
    })
    if (!listener.current) setListening(false)
  }

  const toggle = (t: Todo) => {
    haptic(t.done ? 'light' : 'medium')
    setState((s) => ({
      ...s,
      todos: s.todos.map((x) => (x.id === t.id ? { ...x, done: !x.done, doneAt: x.done ? undefined : Date.now() } : x)),
    }))
  }
  const remove = (t: Todo) => setState((s) => ({ ...s, todos: s.todos.filter((x) => x.id !== t.id) }))

  return (
    <div className="screen">
      <PageHead
        title="Yapılacaklar"
        sub={open.length === 0 ? 'Bekleyen iş yok.' : `${open.length} iş bekliyor.`}
      />

      <form
        className={`composer${listening ? ' live' : ''}`}
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={listening ? 'Dinliyorum…' : 'Yeni iş yaz ya da mikrofona bas'}
          aria-label="Yeni iş"
          readOnly={listening}
          enterKeyHint="done"
        />
        {text.trim() && !listening ? (
          <button type="submit" className="round primary" aria-label="Listeye ekle">
            <Plus size={22} />
          </button>
        ) : (
          <button type="button" className={`round mic${listening ? ' on' : ''}`} onClick={toggleMic} aria-label={listening ? 'Dinlemeyi bitir' : 'Sesle ekle'} aria-pressed={listening}>
            {listening ? <Square size={18} fill="currentColor" /> : <Mic size={21} />}
          </button>
        )}
      </form>

      {todos.length === 0 && (
        <div className="empty">
          <p>Aklına geleni yaz, ya da mikrofona basıp söyle: “Yarın eczaneye uğra.” Cümle bitince listeye düşer.</p>
        </div>
      )}

      {open.length > 0 && (
        <ul className="panel rows big">
          <AnimatePresence initial={false}>
            {open.map((t) => (
              <Row key={t.id} t={t} onToggle={toggle} onRemove={remove} />
            ))}
          </AnimatePresence>
        </ul>
      )}

      {done.length > 0 && (
        <>
          <div className="sub-head">
            <h2>Tamamlanan {done.length}</h2>
            <button className="link" onClick={() => setState((s) => ({ ...s, todos: s.todos.filter((x) => !x.done) }))}>
              Temizle
            </button>
          </div>
          <ul className="panel rows big done">
            <AnimatePresence initial={false}>
              {done.map((t) => (
                <Row key={t.id} t={t} onToggle={toggle} onRemove={remove} />
              ))}
            </AnimatePresence>
          </ul>
        </>
      )}
    </div>
  )
}

function Row({ t, onToggle, onRemove }: { t: Todo; onToggle: (t: Todo) => void; onRemove: (t: Todo) => void }) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0, x: -24 }}
      transition={spring}
    >
      <div className="row">
        <button className={`check${t.done ? ' on' : ''}`} onClick={() => onToggle(t)} aria-label={t.done ? `${t.text}: geri al` : `${t.text}: tamamlandı olarak işaretle`}>
          <Check size={14} strokeWidth={3} aria-hidden="true" />
        </button>
        <span className="row-main todo-text">{t.text}</span>
        <button className="icon-btn subtle" onClick={() => onRemove(t)} aria-label={`${t.text}: sil`}>
          <Trash2 size={17} />
        </button>
      </div>
    </motion.li>
  )
}
