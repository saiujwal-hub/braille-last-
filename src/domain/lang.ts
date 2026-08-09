// Lightweight, fully-offline English language model for Reader C.
// Built from the Dolch sight-word list (ideal for Grade-1 reading) plus a
// letter-pair model derived from that same list. No external corpus needed.

import { type DotMask } from './cell'
import { CONTROL, TABLES, translateMasks, type BrailleLang } from './tables'

const DOLCH_WORDS = [
  'a','able','about','after','all','am','an','and','any','are','around','as','ask','at',
  'away','be','because','been','before','best','better','big','black','blue','both','bring',
  'but','buy','by','call','came','can','carry','clean','cold','come','could','cut','did',
  'do','does','done','don','down','draw','drink','eat','eight','every','fall','far','fast',
  'find','first','five','fly','for','found','four','from','full','funny','gave','get','give',
  'go','going','gone','good','got','grow','had','has','have','he','help','her','here','him',
  'his','hold','home','hot','how','hurt','i','if','in','into','is','it','its','jump','just',
  'keep','kind','know','laugh','let','light','like','little','live','long','look','made',
  'make','many','may','me','much','must','my','myself','never','new','no','not','now','of',
  'off','old','on','once','one','only','open','or','other','our','out','over','own','pick',
  'play','please','pretty','pull','put','ran','read','red','ride','right','round','run','said',
  'saw','say','school','see','seven','shall','she','show','sing','sit','six','sleep','small',
  'so','some','soon','start','stop','take','tell','ten','thank','that','the','their','them',
  'then','there','these','they','think','this','those','three','to','today','together','too',
  'try','two','under','up','upon','us','use','very','walk','want','warm','was','wash','we',
  'well','went','were','what','when','where','which','white','who','why','will','wish','with',
  'work','would','write','yellow','yes','you','your',
  // Additional common early-reading words (beyond the Dolch 220).
  'afternoon','again','air','animal','answer','apple','baby','bag','ball','barn','bed','bee',
  'bell','bike','bird','birthday','boat','book','box','boy','bread','breakfast','bridge','brother',
  'brown','bubble','bug','bus','cake','car','cat','chair','chicken','children','city','class',
  'coat','cow','dad','day','deer','dinner','doll','door','dot','duck','egg','engine','eye','face',
  'family','farm','father','feet','fire','fish','flower','food','foot','friend','frog','fruit',
  'game','garden','gift','girl','glass','gold','grandma','grandpa','grass','green','hair','hand',
  'happy','hat','head','heart','hen','hill','horse','house','ice','ill','inside','jar','kitten',
  'lady','lake','leaf','leg','letter','lion','lunch','mail','man','map','market','men','milk',
  'mom','money','moon','morning','mother','mountain','mouse','name','nap','nest','night','nose',
  'number','orange','outside','page','party','pen','pencil','people','pet','picture','pie','pig',
  'plant','plate','pocket','pond','pool','pot','present','prize','puppy','rain','ring','river',
  'road','rock','roof','room','rose','sail','sand','seat','seed','sheep','ship','shirt','shoe',
  'shopping','sick','side','sister','sky','sled','snow','song','soup','spoon','spring','square',
  'star','station','sticker','stone','storm','story','street','sun','supper','swim','table',
  'tail','teacher','team','tent','thing','ticket','tiger','time','toy','train','tree','trip',
  'truck','turtle','umbrella','uncle','van','vegetable','voice','water','weather','week','wheel',
  'window','wing','winter','wood','wool','word','worm','yard','year',
  // Common assistive-technology, desktop, and UI terms. Including these lets
  // the offline consensus reader resolve single-dot disagreements in real words
  // without needing a network language model.
  'app','apps','behavior','behaviour','braille','button','chrome','close','closed','common','cursor','desktop','file','files','folder','folders','grid','home','icon','icons','jaws','keyboard','laptop','line','list','lists','menu','mode','notepad','nvda','open','opened','page','phone','pin','pinned','program','programs','reader','scan','screen','search','searched','searching','settings','show','start','taskbar','text','type','types','view','views','window','windows',
] as const

const WORD_SET = new Set<string>(DOLCH_WORDS)

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'

// Letter-pair (bigram) log-probabilities derived from the wordlist.
const bigramLogs = buildBigramModel()

function buildBigramModel(): Map<string, number> {
  const counts = new Map<string, number>()
  let total = 0
  const bump = (a: string, b: string) => {
    const key = a + b
    counts.set(key, (counts.get(key) ?? 0) + 1)
    total++
  }
  for (const w of DOLCH_WORDS) {
    const word = w.replace(/[^a-z]/g, '')
    if (!word) continue
    bump(' ', word[0])
    for (let i = 0; i < word.length - 1; i++) bump(word[i], word[i + 1])
    bump(word[word.length - 1], ' ')
  }
  const logs = new Map<string, number>()
  for (const [k, c] of counts) logs.set(k, Math.log((c + 0.5) / (total + 0.5 * ALPHABET.length * ALPHABET.length)))
  return logs
}

function bigramLog(a: string, b: string): number {
  return bigramLogs.get(a + b) ?? Math.log(0.5 / (bigramLogs.size + 1))
}

/** Score how "English-like" a lowercase-only character sequence is. */
export function scoreEnglishSequence(seq: string): number {
  const lower = seq.toLowerCase()
  let bigramSum = 0
  let bigramCount = 0
  let unknown = 0
  let wordCount = 0
  let invalidWordCount = 0
  for (const t of lower.split(/[^a-z]+/)) {
    if (t) {
      if (WORD_SET.has(t) || t === 'a' || t === 'i') wordCount++
      else invalidWordCount++
    }
  }
  for (let i = 0; i < lower.length - 1; i++) {
    const a = lower[i]
    const b = lower[i + 1]
    if (a >= 'a' && a <= 'z' && b >= 'a' && b <= 'z') {
      bigramSum += bigramLog(a, b)
      bigramCount++
    }
  }
  let letterCount = 0
  for (const ch of lower) {
    if (ch >= 'a' && ch <= 'z') letterCount++
    else if (ch !== ' ') unknown++
  }
  const avgBigram = bigramCount > 0 ? bigramSum / bigramCount : 0
  // Dictionary words are strong evidence; non-dictionary words penalize.
  return wordCount * 3 - invalidWordCount * 1.5 + letterCount * 0.5 + avgBigram * 0.4 - unknown * 1.5
}

export interface ScoredReading {
  text: string
  cells: string[]
  score: number
}

/**
 * Produce a scored reading for a sequence of masks (applies translation
 * including number/caps state).
 */
export function readingFor(masks: readonly DotMask[], lang: BrailleLang): ScoredReading {
  const { text, cells } = translateMasks(masks, lang)
  return { text, cells, score: scoreEnglishSequence(text) }
}

/**
 * Repair a word when it contains an unknown cell or is not a recognized word.
 * This keeps the reader from altering confident valid words while repairing
 * OCR misreads (such as "Ope e" -> "Open and").
 */
export function repairUnknownEnglishWords(text: string): string {
  let repaired = text.replace(/(?:^|\s)'([a-z])/ig, (match, letter) => {
    const prefix = match.startsWith(' ') ? ' ' : ''
    return prefix + letter.toUpperCase()
  })

  if (/\s[ai]$/i.test(repaired)) {
    repaired = repaired.replace(/\s[ai]$/i, '')
  }

  return repaired.replace(/\u0001?[A-Za-z?;()]+/g, (segment) => {
    let markedCapital = segment.startsWith('\u0001')
    const word = markedCapital ? segment.slice(1) : segment
    if (!/[^A-Za-z]/.test(word)) {
      const lower = word.toLowerCase()
      if (WORD_SET.has(lower) || lower === 'a' || lower === 'i') return word
      // Do not expand single valid letters (e.g. 's', 't', 'w') into 2-letter words ('so', 'to', 'we')
      if (word.length === 1 && lower !== 'e') return word
    }
    if (/[^A-Za-z?]/.test(word) && /[^A-Za-z?]$/.test(word)) return word
    const lower = word.toLowerCase().replace(/[^a-z]/g, '?')
    const maximumDistance = word.length >= 5 ? 2 : 1
    const closestMatches = (input: string, limit: number) => {
      const scored = [...WORD_SET].map((candidate) => ({ candidate, distance: editDistance(input, candidate) }))
      const distance = Math.min(...scored.map((entry) => entry.distance))
      return distance <= limit ? scored.filter((entry) => entry.distance === distance).map((entry) => entry.candidate) : []
    }
    let matches = closestMatches(lower, maximumDistance)
    if (matches.length > 1) {
      const prefixMatches = matches.filter((c) => c.startsWith(lower))
      if (prefixMatches.length === 1) matches = prefixMatches
    }
    if (matches.length !== 1 && word.startsWith('??')) {
      matches = closestMatches(lower.slice(1), 1)
      markedCapital = matches.length === 1
    }
    if (matches.length !== 1 && lower === 'e') {
      matches = ['and']
    }
    if (matches.length !== 1) return word
    const corrected = matches[0]
    return markedCapital || (word[0] >= 'A' && word[0] <= 'Z') ? corrected[0].toUpperCase() + corrected.slice(1) : corrected
  })
}

function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 1) return 99
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    let rowMin = current[0]
    for (let j = 1; j <= b.length; j++) {
      const isMatch = a[i - 1] === b[j - 1] || a[i - 1] === '?' || b[j - 1] === '?'
      const value = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (isMatch ? 0 : 1)
      )
      current.push(value)
      rowMin = Math.min(rowMin, value)
    }
    if (rowMin > 2) return 99
    previous = current
  }
  return previous[b.length]
}

/**
 * Reader C tie-breaker: given the two disagreeing full sequences, choose the
 * more plausible English reading.
 */
export function tieBreak(a: ScoredReading, b: ScoredReading): { winner: 'A' | 'B'; score: number; confident: boolean } {
  if (a.score === b.score) return { winner: 'A', score: a.score, confident: false }
  const diff = Math.abs(a.score - b.score)
  const confident = diff > 0.3
  return { winner: a.score > b.score ? 'A' : 'B', score: Math.max(a.score, b.score), confident }
}

/** Detect page orientation: braille on the front of a slate page is mirrored. */
export function bestOrientation(masks: readonly DotMask[], lang: BrailleLang): { flip: boolean; score: number } {
  const normal = readingFor(masks, lang)
  const flipped = readingFor(masks.map(mirrorMask), lang)
  if (flipped.score > normal.score + 0.3) return { flip: true, score: flipped.score }
  return { flip: false, score: normal.score }
}

/** Mirror a mask left-right within the cell (swap dots 1<->4, 2<->5, 3<->6). */
export function mirrorMask(mask: DotMask): DotMask {
  let out = 0
  if (mask & 1) out |= 8
  if (mask & 2) out |= 16
  if (mask & 4) out |= 32
  if (mask & 8) out |= 1
  if (mask & 16) out |= 2
  if (mask & 32) out |= 4
  return out
}

export function isControl(mask: DotMask): boolean {
  return mask === CONTROL.NUMBER_SIGN || mask === CONTROL.CAPITAL_SIGN
}

export { TABLES, translateMasks }
