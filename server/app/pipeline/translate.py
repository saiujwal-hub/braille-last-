"""Grade-1 (uncontracted) English Braille translation table.

Mirrors the proven table in the PWA (`src/lib/cv/translate.ts`). Unknown masks decode
to '?' — the reader never guesses (requirement of the brief). Both letter and the
common punctuation set are covered.
"""

from __future__ import annotations

# mask (6-bit, bit0 = dot1) -> character
_GRADE1: dict[int, str] = {
    0: " ",  # space
    # letters
    1: "a",
    3: "b",
    9: "c",
    25: "d",
    17: "e",
    11: "f",
    27: "g",
    19: "h",
    10: "i",
    26: "j",
    5: "k",
    7: "l",
    13: "m",
    29: "n",
    21: "o",
    15: "p",
    31: "q",
    23: "r",
    14: "s",
    30: "t",
    37: "u",
    39: "v",
    58: "w",
    45: "x",
    61: "y",
    53: "z",
    # punctuation
    2: ",",  # dot2
    6: ";",  # 23
    18: ":",  # 25
    50: ".",  # 256
    22: "!",  # 235
    38: "?",  # 236
    54: "(",  # 2356
    36: "-",  # 36
    4: "'",  # 3
    56: "#",  # 3456
}

_GRADE1_INV: dict[str, int] = {v: k for k, v in _GRADE1.items()}


def braille_mask_to_char(mask: int) -> str:
    """Decode a 6-bit mask to a character, or '?' when unknown."""
    return _GRADE1.get(mask, "?")


def char_to_mask(char: str) -> int | None:
    """Reverse lookup (used by tests and the YOLO-label sanity checks)."""
    return _GRADE1_INV.get(char)


def char_confidence(mask: int) -> float:
    """Validity score used by orientation search: 1.0 for a known char, else 0.0."""
    return 1.0 if mask in _GRADE1 else 0.0


def braille_unicode(mask: int) -> str:
    """Unicode Braille cell U+2800 + mask (matches the PWA debug view)."""
    return chr(0x2800 + mask)
