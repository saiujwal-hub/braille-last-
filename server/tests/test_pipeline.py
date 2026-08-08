"""Integration tests for the full pipeline using synthetic Braille pages."""

import cv2
import numpy as np
import pytest

from app.errors import NotBrailleError
from app.pipeline import run_pipeline
from app.pipeline.translate import braille_mask_to_char
from tests.helpers import render_page_bytes


def test_scan_decodes_hello():
    resp = run_pipeline(render_page_bytes(["hello"]))
    assert resp.ok
    assert resp.text == "hello"
    assert resp.overall_confidence >= 0.5
    assert len(resp.cells) == 5


def test_scan_with_space():
    resp = run_pipeline(render_page_bytes(["hi there"]))
    assert resp.text.replace(" ", "") == "hithere"
    assert "\n" not in resp.text  # single line


def test_scan_two_lines():
    resp = run_pipeline(render_page_bytes(["hi", "me"]))
    assert "\n" in resp.text


def test_scan_debug_payload_is_fully_populated():
    resp = run_pipeline(render_page_bytes(["hello"]), debug=True)
    assert resp.debug is not None
    assert resp.debug.original
    assert resp.debug.preprocessed
    assert resp.debug.cells_overlay
    assert resp.debug.dots_overlay
    assert resp.debug.cells == resp.cells
    assert len(resp.debug.dots.points) >= 10


def test_reader_never_guesses():
    # An impossible mask (all 6 dots) has no letter: it must be '?'.
    assert braille_mask_to_char(0b111111) == "?"
    assert braille_mask_to_char(0) == " "


def test_scan_rejects_blank_image():
    blank = np.full((400, 400, 3), 255, dtype=np.uint8)
    ok, buf = cv2.imencode(".jpg", blank)
    assert ok
    with pytest.raises(NotBrailleError):
        run_pipeline(buf.tobytes())


def test_scan_is_deterministic():
    data = render_page_bytes(["wow"])
    r1 = run_pipeline(data)
    r2 = run_pipeline(data)
    assert r1.text == r2.text
    assert r1.overall_confidence == r2.overall_confidence
