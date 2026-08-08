// Speech via the Web Speech API (free, offline via installed voices).
// Exposes a single speak() that reports success/failure so callers can degrade
// gracefully (per spec: "silently switch" fallback — here TTS is the fallback
// since we have no cloud TTS keys).

let supported: boolean | null = null

export function speechAvailable(): boolean {
  if (supported !== null) return supported
  if (typeof window === 'undefined') return false
  supported = 'speechSynthesis' in window
  return supported
}

export interface SpeakOptions {
  rate?: number
  pitch?: number
  lang?: string
}

export function speak(text: string, opts: SpeakOptions = {}): boolean {
  if (!speechAvailable()) return false
  try {
    const synth = window.speechSynthesis
    synth.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.rate = opts.rate ?? 0.95
    u.pitch = opts.pitch ?? 1
    const lang = opts.lang ?? pickVoiceLang('en')
    u.lang = lang
    const voice = pickVoice(lang)
    if (voice) u.voice = voice
    synth.speak(u)
    return true
  } catch {
    return false
  }
}

export function stopSpeaking(): void {
  if (!speechAvailable()) return
  try {
    window.speechSynthesis.cancel()
  } catch {
    // ignore
  }
}

function pickVoiceLang(pref: string): string {
  const prefs = [pref, pref + '-IN', pref + '-US', pref + '-GB', 'en-US']
  for (const p of prefs) if (findVoice(p)) return p
  return pref
}

function findVoice(sub: string): SpeechSynthesisVoice | undefined {
  try {
    return window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(sub.toLowerCase()))
  } catch {
    return undefined
  }
}

function pickVoice(sub: string): SpeechSynthesisVoice | undefined {
  return findVoice(sub)
}
