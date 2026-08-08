"""Unit tests for the grade-1 translation table."""

from app.pipeline.translate import (
    braille_mask_to_char,
    char_confidence,
    char_to_mask,
)


def test_alphabet_roundtrip():
    import string

    for letter in string.ascii_lowercase:
        mask = char_to_mask(letter)
        assert mask is not None, f"{letter} not in table"
        assert braille_mask_to_char(mask) == letter


def test_punctuation():
    for char, mask in [
        (",", 2),
        (";", 6),
        (":", 18),
        (".", 50),
        ("!", 22),
        ("?", 38),
        ("(", 54),
        ("-", 36),
        ("'", 4),
        ("#", 56),
        (" ", 0),
    ]:
        assert char_to_mask(char) == mask
        assert braille_mask_to_char(mask) == char


def test_unknown_mask_is_question_mark():
    assert braille_mask_to_char(0b101010) == "?"
    assert char_confidence(0b101010) == 0.0


def test_known_mask_confidence_is_one():
    assert char_confidence(char_to_mask("a")) == 1.0


def test_no_guessing_requirement():
    # The reader must never return a letter it is not sure about.
    for mask in range(0, 64):
        ch = braille_mask_to_char(mask)
        if ch != "?":
            assert char_to_mask(ch) == mask
