import { SpeechRecognition } from '@capacitor-community/speech-recognition'
import { isNative } from './util'

export type Listener = { stop: () => void }

type Handlers = {
  onPartial: (text: string) => void
  onDone: (text: string) => void
  onError: (message: string) => void
}

type WebRecognition = {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

/** Türkçe tek cümle dinler. Telefonda yerel tanıma, tarayıcıda Web Speech kullanılır. */
export async function listen(h: Handlers): Promise<Listener | null> {
  if (isNative) return listenNative(h)
  return listenWeb(h)
}

async function listenNative(h: Handlers): Promise<Listener | null> {
  try {
    const { available } = await SpeechRecognition.available()
    if (!available) {
      h.onError('Bu telefonda ses tanıma hizmeti bulunamadı.')
      return null
    }
    const perm = await SpeechRecognition.requestPermissions()
    if (perm.speechRecognition !== 'granted') {
      h.onError('Mikrofon izni verilmedi. Ayarlardan izin verebilirsin.')
      return null
    }
    let last = ''
    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      void SpeechRecognition.removeAllListeners()
      h.onDone(last.trim())
    }
    await SpeechRecognition.removeAllListeners()
    await SpeechRecognition.addListener('partialResults', (d: { matches: string[] }) => {
      if (d.matches?.[0]) {
        last = d.matches[0]
        h.onPartial(last)
      }
    })
    await SpeechRecognition.addListener('listeningState', (d: { status: 'started' | 'stopped' }) => {
      if (d.status === 'stopped') window.setTimeout(finish, 250)
    })
    SpeechRecognition.start({ language: 'tr-TR', maxResults: 1, partialResults: true, popup: false }).catch(() => {
      if (!finished && !last) {
        finished = true
        void SpeechRecognition.removeAllListeners()
        h.onError('Ses anlaşılamadı. Tekrar dene.')
      }
    })
    return {
      stop: () => {
        SpeechRecognition.stop().catch(() => {})
        window.setTimeout(finish, 400)
      },
    }
  } catch {
    h.onError('Ses tanıma başlatılamadı.')
    return null
  }
}

function listenWeb(h: Handlers): Listener | null {
  const w = window as unknown as { SpeechRecognition?: new () => WebRecognition; webkitSpeechRecognition?: new () => WebRecognition }
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition
  if (!Ctor) {
    h.onError('Bu tarayıcı sesle yazmayı desteklemiyor.')
    return null
  }
  const rec = new Ctor()
  let last = ''
  let failed = false
  rec.lang = 'tr-TR'
  rec.interimResults = true
  rec.continuous = false
  rec.onresult = (e) => {
    let text = ''
    for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript
    last = text
    h.onPartial(text)
  }
  rec.onerror = (e) => {
    failed = true
    h.onError(e.error === 'not-allowed' ? 'Mikrofon izni verilmedi.' : 'Ses anlaşılamadı. Tekrar dene.')
  }
  rec.onend = () => {
    if (!failed) h.onDone(last.trim())
  }
  rec.start()
  return { stop: () => rec.stop() }
}
