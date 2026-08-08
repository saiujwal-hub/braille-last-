import { describe, it } from 'vitest'
import { renderBrailleText } from './sample'
import { runScan } from './cv/pipeline'

describe('full 3-line alphabet page scan', () => {
  it('scans a 3-line page of a-z letters', () => {
    const text = 'a b c d e f g h i j\nk l m n o p q r s t\nu v w x y z'
    const { rgba, width, height } = renderBrailleText(text, 'en')
    const out = runScan(1, rgba, width, height, 'en')
    console.log('[FULL PAGE ALPHABET] scan outcome ok:', out.ok)
    if (out.ok) {
      console.log('[FULL PAGE ALPHABET] text:\n' + out.text)
    } else {
      console.log('[FULL PAGE ALPHABET] fail:', out.error, out.message)
    }
  })
})
