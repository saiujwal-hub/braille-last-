"""API-level tests: /health and /scan using FastAPI's TestClient."""

from fastapi.testclient import TestClient

from app.main import app
from tests.helpers import render_page_bytes

client = TestClient(app)


def test_health_endpoint():
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert "detectors" in body
    assert body["tts"] == "disabled"  # env-disabled in tests


def test_scan_endpoint_ok():
    r = client.post("/scan", files={"file": ("page.jpg", render_page_bytes(["hello"]), "image/jpeg")})
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["text"] == "hello"
    assert body["quality"]["detector"] == "geometric"


def test_scan_endpoint_debug_flag():
    r = client.post(
        "/scan",
        files={"file": ("page.jpg", render_page_bytes(["hi"]), "image/jpeg")},
        params={"debug": "true"},
    )
    assert r.status_code == 200
    assert r.json()["debug"]["cells_overlay"]


def test_scan_endpoint_bad_image():
    r = client.post("/scan", files={"file": ("bad.jpg", b"not an image", "image/jpeg")})
    assert r.status_code == 400
    assert r.json()["error"] == "decode"


def test_scan_endpoint_blank_image_422():
    import cv2
    import numpy as np

    blank = np.full((400, 400, 3), 255, dtype=np.uint8)
    ok, buf = cv2.imencode(".jpg", blank)
    assert ok
    r = client.post("/scan", files={"file": ("blank.jpg", buf.tobytes(), "image/jpeg")})
    assert r.status_code == 422
    assert r.json()["error"] == "not-braille"


def test_tts_disabled_returns_503():
    r = client.post("/tts", json={"text": "hello"})
    assert r.status_code == 503
    assert r.json()["error"] == "model-unavailable"
