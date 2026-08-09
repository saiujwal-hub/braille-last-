import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import {
  ArrowRight,
  Camera,
  SpeakerHigh,
  Lock,
  DeviceMobile,
  Cpu,
  Browser,
  WifiHigh,
} from '@phosphor-icons/react'
import { ENGLISH_TABLE } from '../domain/tables'
import { Braille, Reveal, usePageTheme } from './shared'
import './landing.css'

const V = {
  '--paper': '#FBF9F4',
  '--card': '#FFFFFF',
  '--line': '#E7E1D2',
  '--ink': '#20293B',
  '--soft': '#555D6B',
  '--faint': '#8A8F99',
  '--accent': '#F0563B',
  '--accent-ink': '#A33117',
  '--yellow': '#FFC93E',
  '--mint': '#7ED8A2',
  '--lip': '#E4DDC8',
  '--bb-focus': '#F0563B',
  '--bb-dot-off': '#E3DCC9',
  '--bb-dot-on': '#1F2735',
}

const SOUNDS = [
  'ah', 'bee', 'see', 'dee', 'e', 'ef', 'gee', 'aitch',
  'i', 'jay', 'kay', 'el', 'em', 'en', 'oh', 'pee', 'cue', 'ar',
  'ess', 'tee', 'you', 'vee', 'double-u', 'eks', 'why', 'zed',
]

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('')

const ALPHA_FOCUS: Record<string, string> = {
  a: 'dot one alone, the first finger that trusts it',
  b: 'dots one and two, side by side',
  c: 'dots one and four, a tall pair',
  l: 'the whole three-line column down the right',
  x: 'all four corners. Some feel it before they read.',
}

function dotBits(ch: string): number[] {
  const mask = ENGLISH_TABLE.reverse[ch]
  if (!mask) return []
  const out: number[] = []
  for (let i = 0; i < 6; i++) if (mask & (1 << i)) out.push(i + 1)
  return out
}

const prefersReduced = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* ————— Magnetic hover: moves via CSS vars on the element, no re-renders. ————— */
function Magnetic({
  children,
  className = '',
  href,
  strength = 9,
}: {
  children: ReactNode
  className?: string
  href?: string
  strength?: number
}) {
  const ref = useRef<HTMLAnchorElement>(null)
  const move = (x: number, y: number) => {
    const el = ref.current
    if (!el || prefersReduced()) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--mx', String(((x - (r.left + r.width / 2)) / r.width) * strength))
    el.style.setProperty('--my', String(((y - (r.top + r.height / 2)) / r.height) * strength))
  }
  const reset = () => {
    const el = ref.current
    if (!el) return
    el.style.setProperty('--mx', '0px')
    el.style.setProperty('--my', '0px')
  }
  return (
    <a
      ref={ref}
      href={href}
      className={`magnetic ${className}`}
      onMouseMove={(e) => move(e.clientX, e.clientY)}
      onMouseLeave={reset}
    >
      {children}
    </a>
  )
}

/* ————— In-page scroll link: custom eased scroll to a section, offset for the
       sticky nav so the whole section lands in view (not half-hidden). ————— */
function ScrollLink({
  to,
  children,
  className = '',
}: {
  to: string
  children: ReactNode
  className?: string
}) {
  const id = to.replace(/^#/, '')
  const onClick = (e: ReactMouseEvent<HTMLAnchorElement>) => {
    const el = document.getElementById(id)
    if (!el) return
    e.preventDefault()
    const nav = document.querySelector('.lnd-nav') as HTMLElement | null
    const navH = nav?.getBoundingClientRect().height ?? 0
    const vh = window.innerHeight
    const secH = el.getBoundingClientRect().height
    // Fit-aware offset: land a fitting section beneath the nav with a gap,
    // but if it only just misses (section ≈ viewport), pin it flush to the
    // viewport so the WHOLE section shows — the nav then only grazes its top
    // padding instead of leaving the bottom cut off.
    let pad = navH + 20
    if (secH <= vh - navH - 20) pad = navH + 20
    else if (secH <= vh) pad = Math.max(4, vh - secH - 4)
    else pad = navH
    const y = Math.max(0, el.getBoundingClientRect().top + window.scrollY - pad)
    if (prefersReduced()) {
      window.scrollTo(0, y)
      return
    }
    const startY = window.scrollY
    const dist = y - startY
    if (Math.abs(dist) < 2) return
    const t0 = performance.now()
    const dur = Math.min(850, 360 + Math.abs(dist) * 0.25)
    const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / dur)
      window.scrollTo(0, startY + dist * easeInOutCubic(t))
      if (t < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }
  return (
    <a className={className} href={`#${id}`} onClick={onClick}>
      {children}
    </a>
  )
}

/* ————— Typewriter for the read-aloud panel, started once visible. ————— */
function useTypewriter(text: string, run: boolean, speed = 85) {
  const [printed, setPrinted] = useState('')
  useEffect(() => {
    if (!run) return
    if (prefersReduced()) {
      setPrinted(text)
      return
    }
    setPrinted('')
    let i = 0
    const id = window.setInterval(() => {
      i += 1
      setPrinted(text.slice(0, i))
      if (i >= text.length) window.clearInterval(id)
    }, speed)
    return () => window.clearInterval(id)
  }, [run, text, speed])
  return printed
}

/* ————— Count-up number: writes straight to the DOM on scroll-in. ————— */
function CountUp({
  to,
  prefix = '',
  suffix = '',
  duration = 1500,
  delay = 120,
}: {
  to: number
  prefix?: string
  suffix?: string
  duration?: number
  delay?: number
}) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let started = false
    const finish = () => {
      el.textContent = `${prefix}${to}${suffix}`
    }
    const io = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting || started) return
      started = true
      io.disconnect()
      if (prefersReduced()) {
        finish()
        return
      }
      const t0 = performance.now() + delay
      const tick = (now: number) => {
        const t = Math.min(1, Math.max(0, (now - t0) / duration))
        const eased = 1 - Math.pow(1 - t, 3)
        el.textContent = `${prefix}${Math.round(to * eased)}${suffix}`
        if (t < 1) requestAnimationFrame(tick)
        else finish()
      }
      requestAnimationFrame(tick)
    })
    io.observe(el)
    return () => io.disconnect()
  }, [to, prefix, suffix, duration, delay])
  return <span ref={ref}>{`${prefix}0${suffix}`}</span>
}

/* ————— Sticky-nav border: hairline + shadow once you have scrolled. ————— */
function useScrolledNav() {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const sentinel = document.createElement('div')
    sentinel.style.position = 'absolute'
    sentinel.style.top = '0'
    sentinel.style.height = '1px'
    el.parentElement?.appendChild(sentinel)
    const io = new IntersectionObserver(
      ([entry]) => el.classList.toggle('is-scrolled', !entry.isIntersecting),
      { rootMargin: '-48px 0px 0px 0px' },
    )
    io.observe(sentinel)
    return () => {
      io.disconnect()
      sentinel.remove()
    }
  }, [])
  return ref
}

export function Landing() {
  usePageTheme(V, '#F4F1EA')
  return (
    <div className="lnd">
      <TopNav />
      <Hero />
      <Ticker />
      <Alphabet />
      <Stats />
      <ReadBack />
      <HowItWorks />
      <People />
      <Shelf />
      <Privacy />
      <Quote />
      <Faq />
      <Final />
      <FooterNote />
    </div>
  )
}

/* ─────────────────────────────── nav ─────────────────────────────── */
function TopNav() {
  const obsRef = useScrolledNav()
  return (
    <header className="lnd-nav" ref={obsRef}>
      <ScrollLink className="lnd-brand" to="#top">
        <img className="lnd-brand__logo" src="/braille_logo.png" alt="Braille Bridge" width={1774} height={230} />
      </ScrollLink>
      <nav className="lnd-nav__links" aria-label="Sections">
        <ScrollLink to="#alphabet">The alphabet</ScrollLink>
        <ScrollLink to="#how">How it reads</ScrollLink>
        <ScrollLink to="#people">For whom</ScrollLink>
        <ScrollLink to="#privacy">Privacy</ScrollLink>
      </nav>
      <Magnetic className="lnd-btn lnd-btn--solid lnd-btn--nav" href="#/dashboard">
        Try the demo <ArrowRight size={14} weight="bold" />
      </Magnetic>
    </header>
  )
}

/* ─────────────────────────────── hero ─────────────────────────────── */
function HeroCopy() {
  return (
    <div className="lnd-hero__copy">
      <p className="lnd-hero__mono">AN ONLINE READER FOR BRAILLE YOU CAN TOUCH</p>
      <h1 className="lnd-hero__title">
        Check a&nbsp;<span className="lnd-underline">braille homework</span> in&nbsp;seconds.
      </h1>
      <p className="lnd-hero__sub">
        Snap the slate page. It reads six&nbsp;dots into words and speaks them aloud, right in your browser.
      </p>
      <div className="lnd-hero__cta">
        <Magnetic className="lnd-btn lnd-btn--solid lnd-btn--big" href="#/dashboard">
          Try the demo <ArrowRight size={16} weight="bold" />
        </Magnetic>
        <ScrollLink className="lnd-btn lnd-btn--paper" to="#alphabet">See the alphabet</ScrollLink>
      </div>
      <p className="lnd-hero__note">
        <Lock size={13} weight="fill" /> No account
      </p>
    </div>
  )
}

function useSpeech() {
  const [speaking, setSpeaking] = useState(false)
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    }
  }, [])
  const speak = (text: string) => {
    if (!('speechSynthesis' in window)) return
    const synth = window.speechSynthesis
    synth.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'en-US'
    u.rate = 0.95
    u.pitch = 1
    u.onstart = () => setSpeaking(true)
    u.onend = () => setSpeaking(false)
    u.onerror = () => setSpeaking(false)
    synth.speak(u)
  }
  return { speak, speaking }
}

function HeroDemo() {
  const [seen, setSeen] = useState(false)
  const { speak, speaking } = useSpeech()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setSeen(true)
          io.disconnect()
        }
      },
      { threshold: 0.35 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  const printed = useTypewriter('Good morning, Maya!', seen)

  return (
    <div className="hero-demo" ref={ref}>
      <div className="hero-card hero-card--photo">
        <span className="hero-card__badge"><Camera size={13} weight="fill" /> photograph of a slate page</span>
        <div className="hero-photo__sheet stamp">
          <Braille text="good morning maya" cellWidth={12} />
        </div>
        <div className="hero-photo__dots" aria-hidden="true">· · · · ·</div>
      </div>

      <span className="hero-flow" aria-hidden="true"><ArrowRight size={18} weight="bold" /></span>

      <div className="hero-card hero-card--read">
        <div className="hero-read__top">
          <span className="hero-read__label">reads it aloud</span>
          <span className="hero-read__live"><i /> local voice</span>
        </div>
        <p className="hero-read__text" aria-live="polite">
          {printed}
          <span className="hero-read__caret" aria-hidden="true">|</span>
        </p>
        <Braille text="good morning maya" cellWidth={9} className="hero-read__mirror" />
        <button type="button" className="hero-read__play" onClick={() => speak('Good morning, Maya!')} aria-pressed={speaking}>
          <SpeakerHigh size={14} weight="fill" /> {speaking ? 'reading…' : 'hear it once more'}
        </button>
      </div>
    </div>
  )
}

function Hero() {
  return (
    <section id="top" className="lnd-hero">
      <HeroCopy />
      <HeroDemo />
    </section>
  )
}

/* ─────────────────────────────── marquee ─────────────────────────────── */
const MARQUEE = [
  { w: 'hello', c: 'hello' },
  { w: 'the cat sat', c: 'typed in ~4s' },
  { w: 'look and see', c: 'a note home' },
  { w: 'good morning', c: 'to the class' },
  { w: 'write a note', c: 'slate page' },
  { w: 'thank you', c: 'no sign-up' },
]

function Ticker() {
  const items = [...MARQUEE, ...MARQUEE]
  return (
    <div className="lnd-ticker" aria-hidden="true">
      <div className="lnd-ticker__track">
        {items.map((m, i) => (
          <span className="lnd-ticker__item" key={`${m.w}-${i}`}>
            <Braille text={m.w} cellWidth={13} className="lnd-ticker__braille" />
            <span className="lnd-ticker__tag">{m.c}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

/* ─────────────────────────── alphabet ─────────────────────────── */
function AlphabetPreview({ ch }: { ch: string }) {
  const bits = dotBits(ch)
  return (
    <div className="lnd-preview" aria-live="polite">
      <span className="lnd-preview__label">live · run a finger up the board</span>

      <div className="lnd-preview__stage">
        <div className="lnd-preview__cell" key={ch}>
          <Braille text={ch} cellWidth={60} className="lnd-preview__braille" />
        </div>
        <span className="lnd-preview__big">{ch}</span>
      </div>

      <div className="lnd-preview__meta">
        <span className="lnd-preview__name">letter {ch.toUpperCase()}</span>
        <span className="lnd-preview__dots">dots {bits.length ? bits.join(' + ') : '·'}</span>
      </div>
      <p className="lnd-preview__tip">{ALPHA_FOCUS[ch] ?? 'the whole cell, read by touch'}</p>
      <p className="lnd-preview__voice">/ {SOUNDS[LETTERS.indexOf(ch)]} /</p>
    </div>
  )
}

function Alphabet() {
  const [picked, setPicked] = useState('a')
  return (
    <section id="alphabet" className="lnd-alphabet">
      <div className="lnd-section-head">
        <h2 className="lnd-h2">Twenty-six letters, six dots each.</h2>
        <p className="lnd-section-sub">
          Braille is read by touch, not by eye. Run your finger along the board. Each tile answers back the moment
          you hover the letter’s cell.
        </p>
      </div>

      <div className="lnd-alphabet__grid">
        <div className="lnd-board">
          <span className="lnd-board__title"><i /> a reading board · grade 1</span>
          <div className="lnd-board__grid">
            {LETTERS.map((ch) => (
              <button
                type="button"
                key={ch}
                className={`lnd-tile ${picked === ch ? 'is-on' : ''}`}
                onMouseEnter={() => setPicked(ch)}
                onFocus={() => setPicked(ch)}
                onClick={() => setPicked(ch)}
                aria-label={`letter ${ch}`}
                aria-pressed={picked === ch}
              >
                <Braille text={ch} cellWidth={20} />
                <span className="lnd-tile__ch">{ch}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="lnd-preview-wrap">
          <AlphabetPreview ch={picked} />
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────── stats ─────────────────────────── */
const STATS = [
  { to: 26, note: 'letters, a to z · the grade-1 alphabet you just touched' },
  { to: 20, prefix: '~', note: 'seconds per page, a typical slate page read and spoken' },
  { to: 0, note: 'bytes uploaded. nothing leaves your own network' },
  { to: 3, note: 'readers per cell: geometric, template, and a word sense' },
]

function Stats() {
  return (
    <section className="lnd-stats">
      <Reveal>
        <h2 className="lnd-h2">Conscious numbers.</h2>
      </Reveal>
      <div className="lnd-stats__grid">
        {STATS.map((s) => (
          <div className="lnd-stat" key={s.to + s.note}>
            <div className="lnd-stat__num" data-stat={s.note}>
              <CountUp to={s.to} prefix={s.prefix ?? ''} />
            </div>
            <p className="lnd-stat__note">{s.note}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ─────────────────────── the read-back ─────────────────────── */
function ReadBack() {
  const [open, setOpen] = useState(false)
  return (
    <section id="focus" className="lnd-readback">
      <div className="lnd-readback__copy">
        <h2 className="lnd-h2">It doesn’t guess. It explains.</h2>
        <p className="lnd-section-sub">
          Every letter arrives with its six dots. When a cell is hard to read, the page shows both ways it could be
          read, then you decide.
        </p>
        <div className="lnd-legend">
          <span><i className="lnd-legend__dot lnd-legend__ok" /> confident</span>
          <span><i className="lnd-legend__dot lnd-legend__warn" /> needs your eyes</span>
        </div>
      </div>

      <div className="lnd-readback__card">
        <p className="lnd-readback__text">
          hello,{' '}
          <button
            type="button"
            className={`lnd-word ${open ? 'is-open' : 'lnd-word--warn'}`}
            onClick={() => setOpen(!open)}
            aria-expanded={open}
          >
            {open ? 'k' : 'r'}
          </button>
          est friend
        </p>
        <div className="lnd-readback__meta">
          {open
            ? 'why this could be “k”: a dim dot is lost in the paper crease.'
            : '“r” against “k”: the crease eats two dots. Tap the word to open it.'}
        </div>
        {open && (
          <div className="lnd-unfold">
            <div className="lnd-cell-compare">
              <span>
                <Braille text="k" cellWidth={34} />
                <i>k</i>
                <em>dots 1·3</em>
              </span>
              <span>
                <Braille text="r" cellWidth={34} />
                <i>r</i>
                <em>dots 1·2·4·5</em>
              </span>
            </div>
            <p className="lnd-unfold__help">Compare them by touch with the page beside you. Nothing leaves home.</p>
          </div>
        )}
      </div>
    </section>
  )
}

/* ─────────────────────── how it works ─────────────────────── */
const HOW = [
  {
    n: '01',
    braille: 'point',
    chip: 'photo',
    title: 'Point at the page',
    body: 'Line the slate up in the frame. The angle is squared off and the contrast lifted, so dim classroom light is fine.',
  },
  {
    n: '02',
    braille: 'cell',
    chip: 'cell grid',
    title: 'Each cell is found',
    body: 'Every six-dot cell is located and its dots isolated, one at a time, straight off the paper.',
  },
  {
    n: '03',
    braille: 'read',
    chip: 'consensus',
    title: 'Three readers agree',
    body: 'Geometric, template, and word-sense readers each read the same cell; when they disagree, the page explains. It never quietly guesses.',
  },
  {
    n: '04',
    braille: 'say',
    chip: 'local speech',
    title: 'Tap once, it speaks',
    body: 'The words you see are spoken locally, and the transcript stays with you. Nothing needs the internet.',
  },
]

function HowItWorks() {
  return (
    <section id="how" className="lnd-how">
      <div className="lnd-section-head lnd-section-head--left">
        <h2 className="lnd-h2">Read it the way a careful editor would.</h2>
        <p className="lnd-section-sub">One photo, four quiet steps, and the dots come out as words.</p>
      </div>

      <ol className="lnd-how__list">
        {HOW.map((step) => (
          <li className="lnd-how__item" key={step.n}>
            <span className="lnd-how__glyph">
              <Braille text={step.braille} cellWidth={15} />
              <span className="lnd-how__chip">{step.chip}</span>
            </span>
            <span className="lnd-how__n">{step.n}</span>
            <div className="lnd-how__copy">
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

/* ─────────────────────── people ─────────────────────── */
const PEOPLE = [
  {
    n: '01',
    w: 'A parent, after lights-out.',
    d: '“Did they hand it in?” Now you can answer from bed, with the phone’s voice turned low.',
    braille: 'bed',
    surface: 'the hallway, 11:01 pm',
  },
  {
    n: '02',
    w: 'A teacher before the bell.',
    d: 'Ten pages, ten seconds each. The confusing cells are already flagged in amber.',
    braille: 'your turn',
    surface: 'the classroom',
  },
  {
    n: '03',
    w: 'A curious sibling or grandparent.',
    d: 'Decode cards, notes and labels written by hand in six neat dots.',
    braille: 'thank you',
    surface: 'the living room',
  },
]

function People() {
  return (
    <section id="people" className="lnd-people">
      <div className="lnd-section-head">
        <h2 className="lnd-h2">Three people, one page.</h2>
        <p className="lnd-section-sub">The same page, read the same way, from three rooms of the same house.</p>
      </div>

      <div className="lnd-people__list">
        {PEOPLE.map((p) => (
          <div className="lnd-person" key={p.n}>
            <span className="lnd-person__n">{p.n}</span>
            <span className="lnd-person__braille">
              <Braille text={p.braille} cellWidth={9} />
            </span>
            <div className="lnd-person__copy">
              <h3>{p.w}</h3>
              <p>{p.d}</p>
            </div>
            <span className="lnd-person__surface">{p.surface}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ─────────────────────── the shelf ─────────────────────── */
function Shelf() {
  return (
    <section id="shelf" className="lnd-shelf">
      <div className="lnd-section-head lnd-section-head--left">
        <h2 className="lnd-h2">You already own it.</h2>
        <p className="lnd-section-sub">One phone, one nearby server, one open tab. The whole station fits in a room.</p>
      </div>

      <div className="lnd-shelf__rig">
        <div className="lnd-rig">
          <span className="lnd-rig__ico"><DeviceMobile size={24} weight="fill" /></span>
          <strong>the phone</strong>
          <small>captures the page · speaks the answer</small>
        </div>
        <span className="lnd-rig__link" aria-hidden="true">LAN</span>
        <div className="lnd-rig">
          <span className="lnd-rig__ico"><Cpu size={24} weight="fill" /></span>
          <strong>the server</strong>
          <small>a laptop or Raspberry Pi on the shelf</small>
        </div>
        <span className="lnd-rig__link" aria-hidden="true">LAN</span>
        <div className="lnd-rig">
          <span className="lnd-rig__ico"><Browser size={24} weight="fill" /></span>
          <strong>the browser</strong>
          <small>the demo lives in one tab, all on-device</small>
        </div>
      </div>

      <p className="lnd-shelf__note"><WifiHigh size={15} weight="bold" /> Pull the internet plug and it still reads.</p>
    </section>
  )
}

/* ─────────────────────── privacy ─────────────────────── */
function Privacy() {
  return (
    <section id="privacy" className="lnd-privacy">
      <div className="lnd-privacy__copy">
        <p className="lnd-eyebrow lnd-eyebrow--on">the private</p>
        <h2 className="lnd-h2 lnd-h2--inverse">Homework never leaves the house.</h2>
        <p className="lnd-privacy__p">
          No cloud, no sign-up, no uploads. The photo, the reader and the voice all live on hardware in the same room
          as the paper.
        </p>
        <Magnetic className="lnd-btn lnd-btn--ghost lnd-privacy__btn" href="#/dashboard">
          Try the demo <ArrowRight size={15} weight="bold" />
        </Magnetic>
      </div>
      <div className="lnd-privacy__room" aria-hidden="true">
        <Braille text="home" cellWidth={16} className="lnd-privacy__braille" />
        <span className="lnd-privacy__wire">‐‐‐</span>
        <span className="lnd-privacy__plugs">
          <i>photo</i>
          <i>reader</i>
          <i>voice</i>
        </span>
        <p className="lnd-privacy__tag">always on your network</p>
      </div>
    </section>
  )
}

/* ─────────────────────── quote ─────────────────────── */
function Quote() {
  return (
    <section className="lnd-quote">
      <Reveal>
        <blockquote>
          “It showed me the dots, so I could double-check what she wrote myself. That is what a
          reading aid is for.”
          <cite>a braille teacher, first evening with the demo</cite>
        </blockquote>
      </Reveal>
    </section>
  )
}

/* ─────────────────────── FAQ ─────────────────────── */
const FAQ = [
  {
    q: 'Does it read any braille page, or just one kind?',
    a: 'It is trained on slate-and-stylus pages: the kind you emboss by hand with a stylus. A display or a page from a different tool reads its dots its own way; that is a different project.',
  },
  {
    q: 'Does it really speak, or is that just a mock-up?',
    a: 'It really speaks, with on-device speech. A small button on the transcript reads the page back quietly, whenever you ask.',
  },
  {
    q: 'I don’t read braille. Can I still double-check the reading?',
    a: 'That is exactly the point. Every letter comes with the six dots that made it, so you can hold the page and its reading side by side.',
  },
  {
    q: 'Where does my photo go?',
    a: 'Nowhere. The capture, the reading and the voice all run on your own hardware. You can pull the network plug and it still works.',
  },
]

function Faq() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <section id="faq" className="lnd-faq">
      <div className="lnd-section-head">
        <h2 className="lnd-h2">Straight questions, straight answers.</h2>
      </div>
      <div className="lnd-faq__list">
        {FAQ.map((item, i) => {
          const isOpen = open === i
          return (
            <div className="lnd-faq__item" key={item.q}>
              <button
                type="button"
                className="lnd-faq__q"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
              >
                <span>{item.q}</span>
                <i aria-hidden="true">{isOpen ? '−' : '+'}</i>
              </button>
              <div className={`lnd-faq__a ${isOpen ? 'is-open' : ''}`}>
                <p>{item.a}</p>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

/* ─────────────────────── final CTA ─────────────────────── */
function Final() {
  return (
    <section className="lnd-final" id="demo">
      <div className="lnd-final__sketch" aria-hidden="true">
        <Braille text="good morning" cellWidth={20} className="lnd-final__braille" />
        <span className="lnd-final__note">demo · one page</span>
      </div>
      <h2 className="lnd-h2 lnd-final__title">Point it at a page, and the dots come out as words.</h2>
      <p className="lnd-final__sub">No install. No account. It runs right here, in this tab.</p>
      <Magnetic className="lnd-btn lnd-btn--solid lnd-btn--big lnd-btn--ink" href="#/dashboard">
        Try the demo <ArrowRight size={17} weight="bold" />
      </Magnetic>
    </section>
  )
}

/* ─────────────────────── footer ─────────────────────── */
function FooterNote() {
  return (
    <footer className="lnd-foot">
      <span><strong>Braille Bridge</strong> · an online reading shelf for slate-and-stylus braille</span>
      <span className="lnd-foot__links">
        <ScrollLink to="#how">how it reads</ScrollLink>
        <ScrollLink to="#people">for whom</ScrollLink>
        <ScrollLink to="#privacy">privacy</ScrollLink>
        <ScrollLink to="#faq">questions</ScrollLink>
      </span>
    </footer>
  )
}