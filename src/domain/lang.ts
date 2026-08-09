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
  'accent','accents','ampersand','app','apps','area','asterisk','asterisks','backspace','backspaces','backslash','bar','bars','behavior','behaviour','brace','braces','bracket','brackets','braille','browser','button','buttons','caret','carets','character','characters',
  '0','1','2','3','4','5','6','7','8','9',
  'chrome','close','closed','colon','comma','common','cortana','cursor','dash','delete','deleted','deleting','desktop','dialog','dialogue','dollar','dollars','cent','cents','currency','money','cash','coin','coins','amount','price','cost','total','double',
  'equals','file','files','folder','folders','glyph','glyphs','grave','grid','hello','hyphen','icon','icons','jaws','keyboard',
  'laptop','line','link','list','lists','menu','minus','mode','notepad','notification','notifications',
  'nvda','open','opened','page','parenthesis','parentheses','period','phone','pin','pinned','plus','program','programs','quote','quotes','reader','replace',
  'scan','screen','search','searched','searching','settings','show','single','slash','special','symbol','symbols','tab','talk','taskbar',
  'text','tilde','toolbar','tray','type','types','typing','underscore','url','vertical','view','views','webpage','website','window',
  'windows','world','insert','inserting','arrow','arrows','left','right','up','down','key','keys',
  'use','uses','using','used','press','pressing','pressed','select','selecting','selection',
  'selected','enter','space','escape','control','shift','alt',
  'rupee','rupees','rs','inr','paisa','paise','pound','pounds','euro','euros','yen','yuan',
] as const

/** Words that should always appear capitalised when auto-repaired (brand names, etc.). */
const PROPER_NOUNS = new Set(['cortana', 'chrome', 'jaws', 'nvda', 'braille', 'windows'])

const UI_TERMS = new Set<string>([
  'accent','accents','ampersand','app','apps','area','asterisk','asterisks','backspace','backspaces','backslash','bar','bars','behavior','behaviour','brace','braces','bracket','brackets','braille','browser','button','buttons','caret','carets','character','characters',
  'chrome','close','closed','colon','comma','common','cortana','cursor','dash','delete','deleted','deleting','desktop','dialog','dialogue','dollar','dollars','cent','cents','currency','money','cash','coin','coins','amount','price','cost','total','double',
  'equals','file','files','folder','folders','glyph','glyphs','grave','grid','hello','hyphen','icon','icons','jaws','keyboard',
  'laptop','line','link','list','lists','menu','minus','mode','notepad','notification','notifications',
  'nvda','open','opened','page','parenthesis','parentheses','period','phone','pin','pinned','plus','program','programs','quote','quotes','reader','replace',
  'scan','screen','search','searched','searching','settings','show','single','slash','special','symbol','symbols','tab','talk','taskbar',
  'text','tilde','toolbar','tray','type','types','typing','underscore','url','vertical','view','views','webpage','website','window',
  'windows','world','insert','inserting','arrow','arrows','left','right','up','down','key','keys',
  'use','uses','using','used','press','pressing','pressed','select','selecting','selection',
  'selected','enter','space','escape','control','shift','alt',
  'rupee','rupees','rs','inr','paisa','paise','pound','pounds','euro','euros','yen','yuan',
])


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
  for (const t of lower.split(/[^a-z0-9]+/)) {
    if (t && WORD_SET.has(t)) wordCount++
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
    if ((ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9')) letterCount++
    else if (ch !== ' ') unknown++
  }
  const avgBigram = bigramCount > 0 ? bigramSum / bigramCount : 0
  // Dictionary words are strong evidence; letters add baseline confidence; unknown characters penalize.
  return wordCount * 3 + letterCount * 0.5 + avgBigram * 0.4 - unknown * 1.5
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
  const getScored = (m: readonly DotMask[]) => {
    const { text, cells } = translateMasks(m, lang)
    const repairedText = lang === 'en' ? repairUnknownEnglishWords(text) : text
    return { text: repairedText, cells, score: scoreEnglishSequence(repairedText) }
  }

  const original = getScored(masks)

  // Try shifting masks up (fixes grid shifted down by 1 row)
  const shiftedUpMasks = masks.map((m) => {
    let shifted = 0
    if (m & (1 << 1)) shifted |= 1 << 0 // dot 2 -> dot 1
    if (m & (1 << 2)) shifted |= 1 << 1 // dot 3 -> dot 2
    if (m & (1 << 4)) shifted |= 1 << 3 // dot 5 -> dot 4
    if (m & (1 << 5)) shifted |= 1 << 4 // dot 6 -> dot 5
    // Reconstruct NUMBER_SIGN (60) if shifted-up mask is dots 4-5 (24)
    if (shifted === 24) shifted = 60
    return shifted
  })
  const shiftedUp = getScored(shiftedUpMasks)

  // Try shifting masks down (fixes grid shifted up by 1 row)
  const shiftedDownMasks = masks.map((m) => {
    let shifted = 0
    if (m & (1 << 0)) shifted |= 1 << 1 // dot 1 -> dot 2
    if (m & (1 << 1)) shifted |= 1 << 2 // dot 2 -> dot 3
    if (m & (1 << 3)) shifted |= 1 << 4 // dot 4 -> dot 5
    if (m & (1 << 4)) shifted |= 1 << 5 // dot 5 -> dot 6
    // Reconstruct NUMBER_SIGN (60) if shifted-down mask is dots 3-5-6 (52)
    if (shifted === 52) shifted = 60
    return shifted
  })
  const shiftedDown = getScored(shiftedDownMasks)

  let best = original

  if (shiftedUp.score > best.score && shiftedUp.score > 0) {
    best = shiftedUp
  }
  if (shiftedDown.score > best.score && shiftedDown.score > 0) {
    best = shiftedDown
  }

  return best
}

/**
 * Repair a word when it contains an unknown cell or is not a recognized word.
 *
 * Four sequential steps:
 *  1. Convert leading apostrophe (misread capital sign) to capital letter.
 *  2. Merge "word a/i" pairs that form a known word at end-of-line.
 *  3. Trim trailing isolated a/i edge artifact.
 *  4a. Per-token fuzzy repair (skips ≤ 2-char unknown fragments for the merge pass).
 *  4b. Merge adjacent short unknown fragments (catches OCR spurious-space splits).
 */
export function repairUnknownEnglishWords(text: string): string {
  // Step 1: Strip a leading apostrophe (misread capital sign) before the first letter.
  let repaired = text.replace(/(?:^|\s)'([a-z])/ig, (match, letter) => {
    const prefix = match.startsWith(' ') ? ' ' : ''
    return prefix + letter.toUpperCase()
  })

  // Step 1.5: Replace any invalid apostrophe between two words (misread space) with a space.
  repaired = repaired.replace(/\b([A-Za-z]+)'([A-Za-z]+)\b/g, (match, w1, w2) => {
    const lowerW2 = w2.toLowerCase()
    const contractionEndings = /^(?:s|d|ll|re|ve|m|t|clock|all)$/
    if (!contractionEndings.test(lowerW2)) {
      return w1 + ' ' + w2
    }
    return match
  })

  // Step 2: Merge "word a" or "word i" pairs into a known combined word,
  // but ONLY when the a/i is the very last token on its line.
  // e.g. "Notification are a" -> "Notification area"
  repaired = repaired.replace(/\b([A-Za-z]{2,})\s([ai])(\n|$)/gi, (match, w1, w2, tail) => {
    const combined = (w1 + w2).toLowerCase()
    if (WORD_SET.has(combined)) {
      const cap = w1[0] >= 'A' && w1[0] <= 'Z'
      return (cap ? combined[0].toUpperCase() + combined.slice(1) : combined) + tail
    }
    return match
  })

  // Step 3: Trim a trailing isolated 'a' or 'i' that could not be merged.
  repaired = repaired.replace(/\s[ai]$/i, '')

  // Step 3.5: Replace punctuation like , . : ; in the middle of a word (OCR errors) with '?'
  repaired = repaired.replace(/([A-Za-z?])[,.:;]([A-Za-z?])/g, '$1?$2')

  const fuzzyMatch = (lower: string): string[] => {
    const maxDist = lower.length >= 5 ? 3 : lower.length >= 4 ? 2 : 1
    const scored = [...WORD_SET].map((c) => ({ c, d: editDistance(lower, c) }))
    const minDist = Math.min(...scored.map((e) => e.d))
    return minDist <= maxDist ? scored.filter((e) => e.d === minDist).map((e) => e.c) : []
  }

  const applyCorrection = (corrected: string, originalWord: string, markedCapital: boolean): string => {
    const cap = markedCapital || (originalWord[0] >= 'A' && originalWord[0] <= 'Z') || PROPER_NOUNS.has(corrected)
    return cap ? corrected[0].toUpperCase() + corrected.slice(1) : corrected
  }

  // Step 4a: Per-token fuzzy repair.
  // Short (≤ 2 char) unknown fragments are preserved for the merge pass (step 4b).
  let result = repaired.replace(/\u0001?[A-Za-z?;()]+/g, (segment, offset) => {
    let markedCapital = segment.startsWith('\u0001')
    const word = markedCapital ? segment.slice(1) : segment
    if (!/[^A-Za-z]/.test(word)) {
      const lower = word.toLowerCase()
      if (WORD_SET.has(lower) || lower === 'a' || lower === 'i') return word
      // Do not expand single valid letters into 2-letter words ('s' -> 'so', etc.)
      if (word.length === 1 && lower !== 'e') return word
    }
    if (/[^A-Za-z?]/.test(word) && /[^A-Za-z?]$/.test(word)) return word
    const lower = word.toLowerCase().replace(/[^a-z]/g, '?')
    if (WORD_SET.has(lower)) return segment
    // Special case: a lone 'e' is a braille OCR artifact for 'and'
    if (lower === 'e' && word.length === 1) return 'and'
    // Preserve very short unknown fragments for the merge pass
    if (word.length <= 2) return segment
    let matches = fuzzyMatch(lower)
    // Prefix tiebreaker: if multiple matches share minimum distance, prefer prefix
    if (matches.length > 1) {
      const prefixMatches = matches.filter((c) => c.startsWith(lower.replace(/\?/g, '')))
      if (prefixMatches.length === 1) matches = prefixMatches
    }
    // Bigram context tiebreaker: score each candidate sentence using the language model
    if (matches.length > 1) {
      let bestCandidate = matches[0]
      let bestCandidateScore = -Infinity
      for (const cand of matches) {
        const candidateWord = applyCorrection(cand, word, markedCapital)
        const candidateSentence = repaired.slice(0, offset) + candidateWord + repaired.slice(offset + segment.length)
        let score = scoreEnglishSequence(candidateSentence)
        // Normalize for word length differences to avoid penalizing shorter words
        score -= candidateWord.length * 0.5
        // Boost scoring for relevant UI terms in this application's domain
        if (UI_TERMS.has(cand.toLowerCase())) {
          score += 1.0
        }
        if (score > bestCandidateScore) {
          bestCandidateScore = score
          bestCandidate = cand
        }
      }
      matches = [bestCandidate]
    }
    if (matches.length !== 1 && word.startsWith('??')) {
      matches = fuzzyMatch(lower.slice(1))
      markedCapital = matches.length === 1
    }
    if (matches.length !== 1 && lower === 'e') matches = ['and']
    if (matches.length !== 1) return segment
    return applyCorrection(matches[0], word, markedCapital)
  })

  // Step 4b: Merge adjacent short unknown fragments separated by a single space.
  // OCR sometimes inserts a spurious gap inside a single Braille word, splitting
  // e.g. '??ertana' into 'or?b ga'. Uses token iteration so no token is skipped.
  const tokens = result.split(' ')
  const merged: string[] = []
  let i = 0
  while (i < tokens.length) {
    const tok = tokens[i]
    const lA = tok.toLowerCase().replace(/[^a-z]/g, '?')
    if (
      i + 1 < tokens.length &&
      tok.length >= 2 && tok.length <= 5 &&
      !WORD_SET.has(lA)
    ) {
      const next = tokens[i + 1]
      const lB = next.toLowerCase().replace(/[^a-z]/g, '?')
      if (next.length >= 2 && next.length <= 5 && !WORD_SET.has(lB)) {
        const combined = lA + lB
        const matches = fuzzyMatch(combined)
        if (matches.length === 1) {
          merged.push(applyCorrection(matches[0], tok, false))
          i += 2
          continue
        }
      }
    }
    merged.push(tok)
    i++
  }

  return merged.join(' ')
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
    if (rowMin > 3) return 99
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
