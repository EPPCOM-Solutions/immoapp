# PDF Scan Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local web app that OCRs scanned PDFs, lets users click-to-edit text blocks, and renders edits back with matching color/rotation/noise so the result is visually indistinguishable from the original scan.

**Architecture:** FastAPI backend (Python 3.11) handles PDF-to-PNG conversion, PaddleOCR, and visual-match rendering. Vanilla JS frontend shows PDF pages with SVG overlays for clickable text blocks. Files live in a local `sessions/` directory; the app runs on `localhost:8000` (local) or `pdfcontrol.eppcom.de` (Coolify/Traefik).

**Tech Stack:** FastAPI, uvicorn, PaddleOCR, PyMuPDF (fitz), Pillow, NumPy, SciPy, python-multipart, pytest, httpx

---

## File Map

| File | Responsibility |
|---|---|
| `pdf-editor/app.py` | FastAPI app, all HTTP endpoints, session cleanup background task |
| `pdf-editor/ocr.py` | PaddleOCR wrapper, per-page caching |
| `pdf-editor/renderer.py` | Visual-match text rendering: color extraction, elastic distortion, noise, compositing |
| `pdf-editor/legal_checker.py` | Regex-based legal warning checker (no blocking) |
| `pdf-editor/static/index.html` | Single-page frontend: toolbar, canvas, SVG overlays, edit textarea, legal modal |
| `pdf-editor/requirements.txt` | Python dependencies |
| `pdf-editor/Dockerfile` | Container for Coolify deployment |
| `pdf-editor/.gitignore` | Ignore sessions/, __pycache__, .env |
| `pdf-editor/tests/test_legal_checker.py` | Unit tests for legal_checker |
| `pdf-editor/tests/test_renderer.py` | Unit tests for renderer (real Pillow images, no mocking) |
| `pdf-editor/tests/test_ocr.py` | Unit tests for ocr module (mock PaddleOCR) |
| `pdf-editor/tests/test_app.py` | Integration tests for API endpoints (TestClient, mock OCR + renderer) |

---

## Task 1: Project Scaffold

**Files:**
- Create: `pdf-editor/requirements.txt`
- Create: `pdf-editor/.gitignore`
- Create: `pdf-editor/sessions/.gitkeep`
- Create: `pdf-editor/static/.gitkeep`
- Create: `pdf-editor/tests/__init__.py`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p pdf-editor/sessions pdf-editor/static pdf-editor/tests
touch pdf-editor/sessions/.gitkeep pdf-editor/static/.gitkeep pdf-editor/tests/__init__.py
```

- [ ] **Step 2: Write requirements.txt**

```
fastapi==0.111.0
uvicorn[standard]==0.29.0
paddlepaddle==2.6.1
paddleocr==2.7.3
pymupdf==1.24.3
Pillow==10.3.0
numpy==1.26.4
scipy==1.13.0
python-multipart==0.0.9
pytest==8.2.0
httpx==0.27.0
```

File: `pdf-editor/requirements.txt`

- [ ] **Step 3: Write .gitignore**

```
sessions/*/
__pycache__/
*.pyc
.env
*.egg-info/
dist/
```

File: `pdf-editor/.gitignore`

- [ ] **Step 4: Install dependencies**

```bash
cd pdf-editor && pip install -r requirements.txt
```

Expected: all packages installed without errors (PaddleOCR downloads models on first run, not at install time).

- [ ] **Step 5: Commit**

```bash
cd pdf-editor
git add requirements.txt .gitignore sessions/.gitkeep static/.gitkeep tests/__init__.py
git commit -m "feat(pdf-editor): project scaffold"
```

---

## Task 2: Legal Checker

**Files:**
- Create: `pdf-editor/legal_checker.py`
- Create: `pdf-editor/tests/test_legal_checker.py`

- [ ] **Step 1: Write failing tests**

```python
# pdf-editor/tests/test_legal_checker.py
import pytest
from legal_checker import check

def test_no_warning_for_plain_text():
    assert check("Hallo Welt", "Dies ist ein normaler Brief.") is None

def test_warning_for_ausweis_keyword_in_page():
    result = check("Max Mustermann", "Personalausweis Nummer 123456789")
    assert result is not None
    assert "§ 267 StGB" in result

def test_warning_for_zeugnis_keyword():
    result = check("Sehr gut", "Schulzeugnis der Realschule Bayern")
    assert result is not None

def test_warning_for_urkunde_keyword():
    result = check("2025", "Geburtsurkunde Standesamt München")
    assert result is not None

def test_warning_for_vertrag_keyword():
    result = check("1000", "Mietvertrag Wohnung Berlin")
    assert result is not None

def test_warning_for_rechnung_keyword():
    result = check("500,00", "Rechnung Nr. 2025-001")
    assert result is not None

def test_warning_for_vollmacht_keyword():
    result = check("bevollmächtigt", "Vollmacht Handelsregister")
    assert result is not None

def test_no_warning_for_unrelated_amount():
    # Amount alone without sensitive keyword should not warn
    assert check("150,00 €", "Einkaufsliste Supermarkt") is None

def test_warning_is_string():
    result = check("test", "Führerschein Klasse B")
    assert isinstance(result, str)
    assert len(result) > 20

def test_case_insensitive():
    result = check("test", "AUSWEIS NR. 12345")
    assert result is not None
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd pdf-editor && pytest tests/test_legal_checker.py -v
```

Expected: `ModuleNotFoundError: No module named 'legal_checker'`

- [ ] **Step 3: Implement legal_checker.py**

```python
# pdf-editor/legal_checker.py
import re
from typing import Optional

_KEYWORDS = [
    r'\bausweis\b', r'\bzeugnis\b', r'\burkunde\b', r'\bzertifikat\b',
    r'\bbescheinigung\b', r'\bführerschein\b', r'\bfuhrerschein\b',
    r'\bvertrag\b', r'\brechnung\b', r'\burteil\b', r'\bvollmacht\b',
    r'\bpassport\b', r'\bcertificate\b', r'\bcontract\b', r'\binvoice\b',
]

_WARNING = (
    "Hinweis: Diese Änderung betrifft möglicherweise ein amtliches oder "
    "rechtlich relevantes Dokument. Unbefugte Urkundenfälschung ist strafbar "
    "(§ 267 StGB). Bitte sicherstellen, dass du zur Bearbeitung berechtigt bist."
)


def check(new_text: str, page_text: str) -> Optional[str]:
    """
    Return warning string if edit seems legally sensitive, else None.
    Checks the combined text (new_text + page_text) for sensitive keywords.
    """
    combined = new_text + " " + page_text
    for pattern in _KEYWORDS:
        if re.search(pattern, combined, re.IGNORECASE):
            return _WARNING
    return None
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd pdf-editor && pytest tests/test_legal_checker.py -v
```

Expected: all 10 tests PASS

- [ ] **Step 5: Commit**

```bash
cd pdf-editor
git add legal_checker.py tests/test_legal_checker.py
git commit -m "feat(pdf-editor): legal checker with keyword rules"
```

---

## Task 3: Visual-Match Renderer

**Files:**
- Create: `pdf-editor/renderer.py`
- Create: `pdf-editor/tests/test_renderer.py`

- [ ] **Step 1: Write failing tests**

```python
# pdf-editor/tests/test_renderer.py
import numpy as np
import pytest
from PIL import Image
import tempfile
import os
from renderer import extract_text_color, measure_noise, patch_block


def _make_test_image(width=200, height=50, text_color=(30, 30, 30)):
    """Create a white image with a dark text-like rectangle."""
    arr = np.full((height, width, 3), 240, dtype=np.uint8)
    # Simulate dark text pixels in center
    arr[10:40, 10:180] = text_color
    return arr


def test_extract_text_color_returns_dark_color():
    arr = _make_test_image(text_color=(25, 25, 25))
    color = extract_text_color(arr)
    assert len(color) == 3
    # Should be dark (all channels < 100)
    assert all(c < 100 for c in color)


def test_extract_text_color_rgb():
    arr = _make_test_image(text_color=(10, 20, 80))
    color = extract_text_color(arr)
    assert len(color) == 3


def test_measure_noise_returns_float():
    arr = _make_test_image()
    noise = measure_noise(arr)
    assert isinstance(noise, float)
    assert noise >= 0.0


def test_measure_noise_noisy_higher_than_clean():
    clean = np.full((50, 50, 3), 200, dtype=np.uint8)
    noisy = clean.copy()
    rng = np.random.default_rng(0)
    noisy = np.clip(noisy.astype(float) + rng.normal(0, 20, noisy.shape), 0, 255).astype(np.uint8)
    assert measure_noise(noisy) > measure_noise(clean)


def test_patch_block_modifies_image():
    """patch_block should change pixels in the target region."""
    arr = _make_test_image(width=300, height=80)
    img = Image.fromarray(arr)

    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
        tmp_path = f.name
    try:
        img.save(tmp_path)
        before = np.array(Image.open(tmp_path)).copy()

        bbox = [[10, 10], [190, 10], [190, 40], [10, 40]]
        patch_block(tmp_path, bbox, "Neuer Text", angle=0.0)

        after = np.array(Image.open(tmp_path))
        # Image must have changed in the patched region
        assert not np.array_equal(before[10:40, 10:190], after[10:40, 10:190])
    finally:
        os.unlink(tmp_path)


def test_patch_block_with_rotation():
    """patch_block should work with non-zero rotation without crashing."""
    arr = np.full((100, 300, 3), 240, dtype=np.uint8)
    img = Image.fromarray(arr)

    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
        tmp_path = f.name
    try:
        img.save(tmp_path)
        bbox = [[20, 20], [200, 20], [200, 50], [20, 50]]
        patch_block(tmp_path, bbox, "Schräger Text", angle=3.5)
        result = Image.open(tmp_path)
        assert result.size == (300, 100)
    finally:
        os.unlink(tmp_path)


def test_patch_block_empty_text_no_crash():
    arr = np.full((100, 300, 3), 240, dtype=np.uint8)
    img = Image.fromarray(arr)
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
        tmp_path = f.name
    try:
        img.save(tmp_path)
        bbox = [[10, 10], [100, 10], [100, 30], [10, 30]]
        patch_block(tmp_path, bbox, "", angle=0.0)
    finally:
        os.unlink(tmp_path)
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd pdf-editor && pytest tests/test_renderer.py -v
```

Expected: `ModuleNotFoundError: No module named 'renderer'`

- [ ] **Step 3: Implement renderer.py**

```python
# pdf-editor/renderer.py
import math
import os
from typing import Tuple

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy.ndimage import gaussian_filter, map_coordinates

# Font search order: Linux server fonts first, then macOS
_FONT_PATHS = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
    "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
    "/System/Library/Fonts/Helvetica.ttc",  # macOS
    "/System/Library/Fonts/Arial.ttf",
]


def _get_font(size: int) -> ImageFont.FreeTypeFont:
    for path in _FONT_PATHS:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()


def extract_text_color(region: np.ndarray) -> Tuple[int, int, int]:
    """
    Sample the darkest 10% of pixels in region to find text color.
    region: HxWx3 numpy array (RGB)
    Returns (R, G, B) tuple.
    """
    if region.size == 0:
        return (0, 0, 0)

    lum = (
        0.299 * region[:, :, 0].astype(float)
        + 0.587 * region[:, :, 1].astype(float)
        + 0.114 * region[:, :, 2].astype(float)
    )
    threshold = np.percentile(lum, 10)
    mask = lum <= threshold
    dark = region[mask]
    if len(dark) == 0:
        return (0, 0, 0)
    median = np.median(dark, axis=0).astype(int)
    return (int(median[0]), int(median[1]), int(median[2]))


def measure_noise(region: np.ndarray) -> float:
    """Return std-dev of pixel values as noise level estimate."""
    return float(np.std(region.astype(float)))


def _elastic_distort(arr: np.ndarray, alpha: float = 3.5, sigma: float = 1.3) -> np.ndarray:
    """Apply elastic distortion to simulate scan/typewriter artifacts."""
    rng = np.random.default_rng(7)
    h, w = arr.shape[:2]
    dx = gaussian_filter(rng.standard_normal((h, w)) * alpha, sigma)
    dy = gaussian_filter(rng.standard_normal((h, w)) * alpha, sigma)
    xs, ys = np.meshgrid(np.arange(w), np.arange(h))
    coords = [
        np.clip(ys + dy, 0, h - 1),
        np.clip(xs + dx, 0, w - 1),
    ]
    if arr.ndim == 3:
        result = np.stack(
            [map_coordinates(arr[:, :, c], coords, order=1, mode="reflect")
             for c in range(arr.shape[2])],
            axis=-1,
        )
    else:
        result = map_coordinates(arr, coords, order=1, mode="reflect")
    return result.astype(arr.dtype)


def patch_block(
    page_path: str,
    bbox: list,
    new_text: str,
    angle: float,
) -> None:
    """
    Patch a text block in-place in the page PNG.

    bbox: [[x0,y0],[x1,y1],[x2,y2],[x3,y3]] in image pixel coords
    angle: rotation of original text block in degrees
    """
    img = Image.open(page_path).convert("RGB")
    img_arr = np.array(img)

    xs = [p[0] for p in bbox]
    ys = [p[1] for p in bbox]
    x0 = max(0, int(min(xs)))
    y0 = max(0, int(min(ys)))
    x1 = min(img.width, int(max(xs)))
    y1 = min(img.height, int(max(ys)))
    bw, bh = x1 - x0, y1 - y0

    if bw <= 4 or bh <= 4:
        return

    region = img_arr[y0:y1, x0:x1]
    text_color = extract_text_color(region)
    noise_sigma = measure_noise(region) * 0.25

    # Render text on white background
    font_size = max(8, int(bh * 0.72))
    font = _get_font(font_size)

    # Render wider than needed to avoid clipping, then crop
    render_w = max(bw, 600)
    text_img = Image.new("RGB", (render_w, bh), color=(255, 255, 255))
    draw = ImageDraw.Draw(text_img)
    text_y = max(0, (bh - font_size) // 2)
    draw.text((2, text_y), new_text, font=font, fill=tuple(text_color))
    text_img = text_img.crop((0, 0, bw, bh))

    text_arr = np.array(text_img)

    # Elastic distortion
    text_arr = _elastic_distort(text_arr)

    # Add noise matching original
    if noise_sigma > 1.5:
        rng = np.random.default_rng(42)
        noise = rng.normal(0, noise_sigma, text_arr.shape)
        text_arr = np.clip(text_arr.astype(float) + noise, 0, 255).astype(np.uint8)

    # Apply rotation
    patch = Image.fromarray(text_arr)
    if abs(angle) > 0.3:
        patch = patch.rotate(-angle, expand=False, fillcolor=(255, 255, 255))

    # White out region, paste patch
    img_arr[y0:y1, x0:x1] = 255
    patch_arr = np.array(patch)
    ph = min(bh, patch_arr.shape[0])
    pw = min(bw, patch_arr.shape[1])
    img_arr[y0:y0 + ph, x0:x0 + pw] = patch_arr[:ph, :pw]

    Image.fromarray(img_arr).save(page_path)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd pdf-editor && pytest tests/test_renderer.py -v
```

Expected: all 6 tests PASS

- [ ] **Step 5: Commit**

```bash
cd pdf-editor
git add renderer.py tests/test_renderer.py
git commit -m "feat(pdf-editor): visual-match renderer with elastic distortion and noise"
```

---

## Task 4: OCR Module

**Files:**
- Create: `pdf-editor/ocr.py`
- Create: `pdf-editor/tests/test_ocr.py`

- [ ] **Step 1: Write failing tests**

```python
# pdf-editor/tests/test_ocr.py
import json
import math
import tempfile
import os
from pathlib import Path
from unittest.mock import patch, MagicMock
import pytest
from ocr import run_ocr, _compute_angle


def test_compute_angle_horizontal():
    # Horizontal text: bbox top-left=[0,0], top-right=[100,0]
    bbox = [[0, 0], [100, 0], [100, 20], [0, 20]]
    angle = _compute_angle(bbox)
    assert abs(angle) < 1.0


def test_compute_angle_slanted():
    # Slanted ~5 degrees
    import math
    angle_deg = 5.0
    rad = math.radians(angle_deg)
    bbox = [[0, 0], [100 * math.cos(rad), 100 * math.sin(rad)],
            [100, 20], [0, 20]]
    angle = _compute_angle(bbox)
    assert abs(angle - angle_deg) < 1.0


def test_run_ocr_returns_list(tmp_path):
    fake_result = [[
        [[[10, 5], [90, 5], [90, 25], [10, 25]], ("Hallo Welt", 0.97)],
        [[[10, 30], [80, 30], [80, 50], [10, 50]], ("Foo Bar", 0.88)],
    ]]
    with patch("ocr.PaddleOCR") as MockOCR:
        instance = MagicMock()
        instance.ocr.return_value = fake_result
        MockOCR.return_value = instance

        img_path = str(tmp_path / "page.png")
        cache_path = str(tmp_path / "ocr.json")

        # Create dummy image file
        from PIL import Image
        Image.new("RGB", (100, 60), color=(255, 255, 255)).save(img_path)

        blocks = run_ocr(img_path, cache_path)

    assert len(blocks) == 2
    assert blocks[0]["text"] == "Hallo Welt"
    assert abs(blocks[0]["confidence"] - 0.97) < 0.01
    assert "bbox" in blocks[0]
    assert "angle" in blocks[0]


def test_run_ocr_uses_cache(tmp_path):
    cached = [{"text": "Cached", "bbox": [[0,0],[10,0],[10,5],[0,5]], "angle": 0.0, "confidence": 0.99}]
    cache_path = tmp_path / "ocr.json"
    cache_path.write_text(json.dumps(cached))
    img_path = str(tmp_path / "page.png")

    with patch("ocr.PaddleOCR") as MockOCR:
        blocks = run_ocr(img_path, str(cache_path))
        MockOCR.assert_not_called()

    assert blocks[0]["text"] == "Cached"


def test_run_ocr_empty_result(tmp_path):
    with patch("ocr.PaddleOCR") as MockOCR:
        instance = MagicMock()
        instance.ocr.return_value = [[]]
        MockOCR.return_value = instance

        from PIL import Image
        img_path = str(tmp_path / "page.png")
        Image.new("RGB", (100, 60)).save(img_path)
        cache_path = str(tmp_path / "ocr.json")

        blocks = run_ocr(img_path, cache_path)

    assert blocks == []
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd pdf-editor && pytest tests/test_ocr.py -v
```

Expected: `ModuleNotFoundError: No module named 'ocr'`

- [ ] **Step 3: Implement ocr.py**

```python
# pdf-editor/ocr.py
import json
import math
from pathlib import Path
from typing import Optional

_ocr_instance = None


def _get_ocr():
    global _ocr_instance
    if _ocr_instance is None:
        from paddleocr import PaddleOCR
        _ocr_instance = PaddleOCR(
            use_angle_cls=True,
            lang="en",       # works for Latin script incl. German
            use_gpu=False,
            show_log=False,
        )
    return _ocr_instance


# Lazy import so tests can mock before first use
def _paddle_ocr_class():
    from paddleocr import PaddleOCR
    return PaddleOCR


def _compute_angle(bbox: list) -> float:
    """Compute text rotation angle in degrees from 4-point bbox."""
    dx = bbox[1][0] - bbox[0][0]
    dy = bbox[1][1] - bbox[0][1]
    return math.degrees(math.atan2(dy, dx))


def run_ocr(image_path: str, cache_path: str) -> list:
    """
    Run PaddleOCR on image_path, cache result at cache_path.
    Returns list of dicts: {text, bbox, angle, confidence}
    """
    cache = Path(cache_path)
    if cache.exists():
        return json.loads(cache.read_text())

    ocr = _get_ocr()
    result = ocr.ocr(image_path, cls=True)

    blocks = []
    if result and result[0]:
        for line in result[0]:
            bbox, (text, confidence) = line
            blocks.append({
                "text": text,
                "bbox": bbox,
                "angle": _compute_angle(bbox),
                "confidence": float(confidence),
            })

    cache.write_text(json.dumps(blocks))
    return blocks
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd pdf-editor && pytest tests/test_ocr.py -v
```

Expected: all 5 tests PASS

- [ ] **Step 5: Commit**

```bash
cd pdf-editor
git add ocr.py tests/test_ocr.py
git commit -m "feat(pdf-editor): OCR module with PaddleOCR and per-page caching"
```

---

## Task 5: FastAPI Backend

**Files:**
- Create: `pdf-editor/app.py`
- Create: `pdf-editor/tests/test_app.py`

- [ ] **Step 1: Write failing tests**

```python
# pdf-editor/tests/test_app.py
import io
import json
import shutil
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("SESSIONS_DIR", str(tmp_path / "sessions"))
    # Must import app AFTER setting env so SESSIONS_DIR is used
    import importlib
    import app as app_module
    importlib.reload(app_module)
    return TestClient(app_module.app)


def _make_minimal_pdf() -> bytes:
    """Return a minimal valid 1-page PDF as bytes."""
    import fitz
    doc = fitz.open()
    page = doc.new_page(width=200, height=100)
    page.insert_text((10, 50), "Test PDF Content")
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


def test_upload_returns_session_and_page_count(client):
    pdf_bytes = _make_minimal_pdf()
    response = client.post(
        "/upload",
        files={"file": ("test.pdf", pdf_bytes, "application/pdf")},
    )
    assert response.status_code == 200
    data = response.json()
    assert "session_id" in data
    assert data["page_count"] == 1


def test_list_pages(client):
    pdf_bytes = _make_minimal_pdf()
    session_id = client.post(
        "/upload",
        files={"file": ("test.pdf", pdf_bytes, "application/pdf")},
    ).json()["session_id"]

    response = client.get(f"/pages/{session_id}")
    assert response.status_code == 200
    assert response.json()["pages"] == ["page_0.png"]


def test_list_pages_invalid_session(client):
    response = client.get("/pages/nonexistent-session")
    assert response.status_code == 404


def test_ocr_page(client):
    pdf_bytes = _make_minimal_pdf()
    session_id = client.post(
        "/upload",
        files={"file": ("test.pdf", pdf_bytes, "application/pdf")},
    ).json()["session_id"]

    fake_blocks = [{"text": "Test", "bbox": [[0,0],[50,0],[50,10],[0,10]], "angle": 0.0, "confidence": 0.9}]
    with patch("app.run_ocr", return_value=fake_blocks):
        response = client.get(f"/ocr/{session_id}/0")
    assert response.status_code == 200
    assert response.json()["blocks"] == fake_blocks


def test_legal_check_no_warning(client):
    response = client.post(
        "/legal-check",
        json={"new_text": "Hallo", "page_text": "Ein normaler Text"},
    )
    assert response.status_code == 200
    assert response.json()["warning"] is False


def test_legal_check_warning(client):
    response = client.post(
        "/legal-check",
        json={"new_text": "Max", "page_text": "Personalausweis Nummer 12345"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["warning"] is True
    assert "§ 267 StGB" in data["message"]


def test_save_block(client):
    pdf_bytes = _make_minimal_pdf()
    session_id = client.post(
        "/upload",
        files={"file": ("test.pdf", pdf_bytes, "application/pdf")},
    ).json()["session_id"]

    with patch("app.patch_block") as mock_patch:
        response = client.post("/save-block", json={
            "session_id": session_id,
            "page_index": 0,
            "block_index": 0,
            "bbox": [[10,10],[80,10],[80,25],[10,25]],
            "angle": 0.0,
            "new_text": "Neuer Text",
        })
    assert response.status_code == 200
    assert response.json()["ok"] is True
    mock_patch.assert_called_once()


def test_save_block_invalid_session(client):
    response = client.post("/save-block", json={
        "session_id": "invalid",
        "page_index": 0,
        "block_index": 0,
        "bbox": [[0,0],[10,0],[10,5],[0,5]],
        "angle": 0.0,
        "new_text": "test",
    })
    assert response.status_code == 404


def test_export_pdf(client):
    pdf_bytes = _make_minimal_pdf()
    session_id = client.post(
        "/upload",
        files={"file": ("test.pdf", pdf_bytes, "application/pdf")},
    ).json()["session_id"]

    response = client.get(f"/export/{session_id}")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"


def test_get_page_image(client):
    pdf_bytes = _make_minimal_pdf()
    session_id = client.post(
        "/upload",
        files={"file": ("test.pdf", pdf_bytes, "application/pdf")},
    ).json()["session_id"]

    response = client.get(f"/page-image/{session_id}/0")
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd pdf-editor && pytest tests/test_app.py -v
```

Expected: `ModuleNotFoundError: No module named 'app'`

- [ ] **Step 3: Implement app.py**

```python
# pdf-editor/app.py
import asyncio
import os
import shutil
import time
import uuid
import webbrowser
from contextlib import asynccontextmanager
from pathlib import Path

import fitz  # PyMuPDF
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from legal_checker import check as legal_check_fn
from ocr import run_ocr
from renderer import patch_block

SESSIONS_DIR = Path(os.environ.get("SESSIONS_DIR", "sessions"))
SESSIONS_DIR.mkdir(exist_ok=True)

SESSION_TTL = 3600  # seconds

_session_last_access: dict[str, float] = {}


def _touch(session_id: str) -> None:
    _session_last_access[session_id] = time.time()


def _get_session_dir(session_id: str) -> Path:
    d = SESSIONS_DIR / session_id
    if not d.exists():
        raise HTTPException(404, "Session not found")
    _touch(session_id)
    return d


async def _cleanup_loop() -> None:
    while True:
        await asyncio.sleep(300)
        cutoff = time.time() - SESSION_TTL
        for sid, ts in list(_session_last_access.items()):
            if ts < cutoff:
                d = SESSIONS_DIR / sid
                if d.exists():
                    shutil.rmtree(d)
                _session_last_access.pop(sid, None)


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(_cleanup_loop())
    yield
    task.cancel()


app = FastAPI(lifespan=lifespan)


# --- Endpoints ---

@app.post("/upload")
async def upload(file: UploadFile = File(...)):
    session_id = str(uuid.uuid4())
    session_dir = SESSIONS_DIR / session_id
    session_dir.mkdir()

    pdf_path = session_dir / "original.pdf"
    pdf_path.write_bytes(await file.read())

    doc = fitz.open(str(pdf_path))
    page_count = len(doc)
    for i, page in enumerate(doc):
        mat = fitz.Matrix(2.0, 2.0)
        pix = page.get_pixmap(matrix=mat)
        pix.save(str(session_dir / f"page_{i}.png"))
    doc.close()

    _touch(session_id)
    return {"session_id": session_id, "page_count": page_count}


@app.get("/pages/{session_id}")
def list_pages(session_id: str):
    d = _get_session_dir(session_id)
    pages = sorted(d.glob("page_*.png"), key=lambda p: int(p.stem.split("_")[1]))
    return {"pages": [p.name for p in pages]}


@app.get("/page-image/{session_id}/{page_index}")
def get_page_image(session_id: str, page_index: int):
    d = _get_session_dir(session_id)
    img_path = d / f"page_{page_index}.png"
    if not img_path.exists():
        raise HTTPException(404, "Page not found")
    return FileResponse(str(img_path), media_type="image/png")


@app.get("/ocr/{session_id}/{page_index}")
def ocr_page(session_id: str, page_index: int):
    d = _get_session_dir(session_id)
    img_path = d / f"page_{page_index}.png"
    if not img_path.exists():
        raise HTTPException(404, "Page not found")
    cache_path = d / f"ocr_{page_index}.json"
    blocks = run_ocr(str(img_path), str(cache_path))
    return {"blocks": blocks}


class SaveBlockRequest(BaseModel):
    session_id: str
    page_index: int
    block_index: int
    bbox: list
    angle: float
    new_text: str


@app.post("/save-block")
def save_block(req: SaveBlockRequest):
    d = _get_session_dir(req.session_id)
    img_path = d / f"page_{req.page_index}.png"
    if not img_path.exists():
        raise HTTPException(404, "Page not found")
    # Invalidate OCR cache so re-OCR picks up edits
    cache = d / f"ocr_{req.page_index}.json"
    if cache.exists():
        cache.unlink()
    patch_block(str(img_path), req.bbox, req.new_text, req.angle)
    return {"ok": True}


class LegalCheckRequest(BaseModel):
    new_text: str
    page_text: str


@app.post("/legal-check")
def legal_check_endpoint(req: LegalCheckRequest):
    msg = legal_check_fn(req.new_text, req.page_text)
    if msg:
        return {"warning": True, "message": msg}
    return {"warning": False, "message": None}


@app.get("/export/{session_id}")
def export_pdf(session_id: str):
    d = _get_session_dir(session_id)
    pages = sorted(
        d.glob("page_*.png"),
        key=lambda p: int(p.stem.split("_")[1]),
    )
    if not pages:
        raise HTTPException(400, "No pages found")

    doc = fitz.open()
    for png_path in pages:
        img_doc = fitz.open(str(png_path))
        pdf_bytes = img_doc.convert_to_pdf()
        img_doc.close()
        img_pdf = fitz.open("pdf", pdf_bytes)
        doc.insert_pdf(img_pdf)

    out_path = d / "export.pdf"
    doc.save(str(out_path))
    doc.close()
    return FileResponse(
        str(out_path),
        media_type="application/pdf",
        filename="edited.pdf",
    )


app.mount("/", StaticFiles(directory="static", html=True), name="static")


if __name__ == "__main__":
    import uvicorn
    if os.environ.get("AUTO_OPEN_BROWSER", "1") == "1":
        import threading
        threading.Timer(1.2, lambda: webbrowser.open("http://localhost:8000")).start()
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=False)
```

- [ ] **Step 4: Create placeholder static/index.html so StaticFiles mount doesn't crash tests**

```html
<!DOCTYPE html><html><body>Loading...</body></html>
```

File: `pdf-editor/static/index.html`

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd pdf-editor && pytest tests/test_app.py -v
```

Expected: all 10 tests PASS

- [ ] **Step 6: Commit**

```bash
cd pdf-editor
git add app.py static/index.html tests/test_app.py
git commit -m "feat(pdf-editor): FastAPI backend with all endpoints and session cleanup"
```

---

## Task 6: Frontend SPA

**Files:**
- Modify: `pdf-editor/static/index.html`

- [ ] **Step 1: Write full index.html**

Replace the placeholder `pdf-editor/static/index.html` with:

```html
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PDF Scan Editor</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           background: #1a1a2e; color: #eee; min-height: 100vh; }

    /* ── Toolbar ── */
    #toolbar {
      display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
      padding: 8px 16px; background: #16213e;
      border-bottom: 1px solid #0f3460; position: sticky; top: 0; z-index: 20;
    }
    #toolbar button {
      padding: 6px 14px; background: #0f3460; color: #eee;
      border: 1px solid #1a4080; border-radius: 5px; cursor: pointer;
      font-size: 13px; transition: background 0.15s;
    }
    #toolbar button:hover:not(:disabled) { background: #e94560; border-color: #e94560; }
    #toolbar button:disabled { opacity: 0.35; cursor: default; }
    #page-info { font-size: 13px; color: #aaa; min-width: 80px; text-align: center; }
    #status { font-size: 12px; color: #6dbf6d; margin-left: auto; }

    /* ── Canvas area ── */
    #canvas-wrapper {
      display: flex; justify-content: center;
      padding: 28px 16px; overflow: auto; min-height: calc(100vh - 50px);
    }
    #page-container { position: relative; display: none; box-shadow: 0 6px 32px rgba(0,0,0,0.6); }
    #page-img { display: block; max-width: 100%; }

    /* ── OCR block overlays ── */
    .ocr-block {
      position: absolute; cursor: text; pointer-events: all;
      border: 1px solid transparent;
      transition: background 0.12s, border-color 0.12s;
    }
    .ocr-block:hover {
      background: rgba(100,160,255,0.18);
      border-color: rgba(100,160,255,0.7);
    }
    .ocr-block.edited {
      border-color: rgba(80,220,80,0.6);
      background: rgba(80,220,80,0.08);
    }

    /* ── Edit overlay ── */
    #edit-overlay { position: absolute; display: none; z-index: 10; }
    #edit-textarea {
      width: 100%; min-height: 48px; background: rgba(255,255,220,0.97);
      color: #111; border: 2px solid #e94560; padding: 5px 6px;
      resize: vertical; font-family: monospace; font-size: 13px;
      border-radius: 3px 3px 0 0;
    }
    #edit-actions { display: flex; gap: 5px; }
    #edit-actions button {
      flex: 1; padding: 5px 0; border: none; border-radius: 0 0 3px 3px;
      cursor: pointer; font-size: 12px; font-weight: 600;
    }
    #btn-save-block  { background: #27ae60; color: #fff; }
    #btn-cancel-block { background: #555; color: #ddd; }
    #btn-save-block:hover  { background: #1e8449; }
    #btn-cancel-block:hover { background: #333; }

    /* ── Legal modal ── */
    #legal-modal {
      display: none; position: fixed; inset: 0;
      background: rgba(0,0,0,0.65); z-index: 100;
      align-items: center; justify-content: center;
    }
    #legal-modal.active { display: flex; }
    #legal-box {
      background: #fffbe6; color: #222; border: 2px solid #f0ad4e;
      border-radius: 10px; padding: 28px 24px; max-width: 480px; width: 92%;
    }
    #legal-box h3 { color: #c87f0a; margin-bottom: 14px; font-size: 16px; }
    #legal-box p { line-height: 1.65; font-size: 14px; margin-bottom: 20px; }
    #btn-understood {
      background: #f0ad4e; color: #333; border: none; border-radius: 5px;
      padding: 10px 0; font-size: 14px; font-weight: 700;
      cursor: pointer; width: 100%; transition: background 0.15s;
    }
    #btn-understood:hover { background: #d68910; color: #fff; }

    /* ── Loading overlay ── */
    #loading {
      display: none; position: fixed; inset: 0;
      background: rgba(0,0,0,0.55); z-index: 200;
      align-items: center; justify-content: center;
    }
    #loading.active { display: flex; }
    #loading-box {
      background: #16213e; border: 1px solid #0f3460;
      padding: 20px 36px; border-radius: 8px; font-size: 15px; color: #cce;
    }

    /* ── Empty state ── */
    #empty-hint {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; min-height: 60vh; color: #555; gap: 14px;
    }
    #empty-hint svg { opacity: 0.3; }
    #empty-hint p { font-size: 15px; }
  </style>
</head>
<body>

<div id="toolbar">
  <button id="btn-open">PDF öffnen</button>
  <input type="file" id="file-input" accept=".pdf" style="display:none">
  <button id="btn-prev" disabled>◀</button>
  <span id="page-info">—</span>
  <button id="btn-next" disabled>▶</button>
  <button id="btn-export" disabled>PDF speichern</button>
  <span id="status"></span>
</div>

<div id="canvas-wrapper">
  <div id="page-container">
    <img id="page-img" alt="PDF Seite">
    <div id="ocr-overlay"></div>
    <div id="edit-overlay">
      <textarea id="edit-textarea" rows="3"></textarea>
      <div id="edit-actions">
        <button id="btn-save-block">Speichern</button>
        <button id="btn-cancel-block">Abbrechen</button>
      </div>
    </div>
  </div>
  <div id="empty-hint">
    <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
    <p>PDF öffnen um zu beginnen</p>
  </div>
</div>

<div id="legal-modal">
  <div id="legal-box">
    <h3>⚠ Rechtlicher Hinweis</h3>
    <p id="legal-text"></p>
    <button id="btn-understood">Verstanden</button>
  </div>
</div>

<div id="loading"><div id="loading-box">Bitte warten...</div></div>

<script>
  let sessionId = null;
  let pageCount = 0;
  let currentPage = 0;
  let ocrBlocks = [];
  let activeBlockIndex = null;
  let pendingSave = null;  // {block, newText, blockIndex} awaiting legal confirmation

  const $ = id => document.getElementById(id);

  function setStatus(msg) { $('status').textContent = msg; }

  function showLoading(msg) {
    $('loading-box').textContent = msg || 'Bitte warten...';
    $('loading').classList.add('active');
  }
  function hideLoading() { $('loading').classList.remove('active'); }

  // ── File open ──
  $('btn-open').onclick = () => $('file-input').click();

  $('file-input').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    showLoading('PDF wird geladen...');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const data = await fetch('/upload', { method: 'POST', body: fd }).then(r => r.json());
      sessionId = data.session_id;
      pageCount = data.page_count;
      $('empty-hint').style.display = 'none';
      $('page-container').style.display = 'inline-block';
      $('btn-export').disabled = false;
      await loadPage(0);
    } catch (err) {
      alert('Fehler beim Laden: ' + err.message);
    } finally {
      hideLoading();
      e.target.value = '';
    }
  };

  // ── Page navigation ──
  $('btn-prev').onclick = () => loadPage(currentPage - 1);
  $('btn-next').onclick = () => loadPage(currentPage + 1);

  async function loadPage(idx) {
    currentPage = idx;
    $('page-info').textContent = `Seite ${idx + 1} / ${pageCount}`;
    $('btn-prev').disabled = idx === 0;
    $('btn-next').disabled = idx >= pageCount - 1;
    closeEditor();
    $('ocr-overlay').innerHTML = '';
    ocrBlocks = [];

    const img = $('page-img');
    img.src = `/page-image/${sessionId}/${idx}?t=${Date.now()}`;
    await new Promise(r => { img.onload = r; });

    showLoading('Text wird erkannt...');
    try {
      const data = await fetch(`/ocr/${sessionId}/${idx}`).then(r => r.json());
      ocrBlocks = data.blocks;
      renderOverlays();
      setStatus(`${ocrBlocks.length} Textblöcke erkannt`);
    } catch (err) {
      setStatus('OCR fehlgeschlagen');
    } finally {
      hideLoading();
    }
  }

  // ── OCR overlays ──
  function renderOverlays() {
    const overlay = $('ocr-overlay');
    overlay.innerHTML = '';
    const img = $('page-img');
    const scaleX = img.clientWidth / img.naturalWidth;
    const scaleY = img.clientHeight / img.naturalHeight;

    ocrBlocks.forEach((block, i) => {
      const xs = block.bbox.map(p => p[0] * scaleX);
      const ys = block.bbox.map(p => p[1] * scaleY);
      const x = Math.min(...xs), y = Math.min(...ys);
      const w = Math.max(...xs) - x, h = Math.max(...ys) - y;

      const div = document.createElement('div');
      div.className = 'ocr-block';
      div.dataset.index = i;
      Object.assign(div.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
      div.title = block.text;
      div.onclick = (e) => { e.stopPropagation(); openEditor(i, div); };
      overlay.appendChild(div);
    });
  }

  // ── Editor ──
  function openEditor(blockIndex, blockDiv) {
    activeBlockIndex = blockIndex;
    const ta = $('edit-textarea');
    ta.value = ocrBlocks[blockIndex].text;

    const eo = $('edit-overlay');
    const top = parseInt(blockDiv.style.top) + parseInt(blockDiv.style.height) + 4;
    Object.assign(eo.style, {
      display: 'block',
      left: blockDiv.style.left,
      top: top + 'px',
      width: Math.max(220, parseInt(blockDiv.style.width)) + 'px',
    });
    ta.style.height = 'auto';
    ta.focus();
    ta.select();
  }

  function closeEditor() {
    $('edit-overlay').style.display = 'none';
    activeBlockIndex = null;
  }

  $('btn-cancel-block').onclick = closeEditor;

  // Click outside editor closes it
  document.addEventListener('click', (e) => {
    const eo = $('edit-overlay');
    if (eo.style.display !== 'none' && !eo.contains(e.target) && !e.target.classList.contains('ocr-block')) {
      closeEditor();
    }
  });

  // ── Save block ──
  $('btn-save-block').onclick = async () => {
    if (activeBlockIndex === null) return;
    const block = ocrBlocks[activeBlockIndex];
    const newText = $('edit-textarea').value;
    if (!newText.trim()) return;

    const pageText = ocrBlocks.map(b => b.text).join(' ');
    const legalData = await fetch('/legal-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_text: newText, page_text: pageText }),
    }).then(r => r.json());

    if (legalData.warning) {
      $('legal-text').textContent = legalData.message;
      $('legal-modal').classList.add('active');
      pendingSave = { block, newText, blockIndex: activeBlockIndex };
    } else {
      await doSaveBlock(block, newText, activeBlockIndex);
    }
  };

  $('btn-understood').onclick = async () => {
    $('legal-modal').classList.remove('active');
    if (pendingSave) {
      const { block, newText, blockIndex } = pendingSave;
      pendingSave = null;
      await doSaveBlock(block, newText, blockIndex);
    }
  };

  async function doSaveBlock(block, newText, blockIndex) {
    showLoading('Text wird gerendert...');
    try {
      await fetch('/save-block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          page_index: currentPage,
          block_index: blockIndex,
          bbox: block.bbox,
          angle: block.angle,
          new_text: newText,
        }),
      });
      ocrBlocks[blockIndex].text = newText;
      // Reload image with cache-bust
      const img = $('page-img');
      img.src = `/page-image/${sessionId}/${currentPage}?t=${Date.now()}`;
      await new Promise(r => { img.onload = r; });
      // Re-render overlays (scale might shift with new img load)
      renderOverlays();
      // Mark edited
      const div = $('ocr-overlay').querySelector(`[data-index="${blockIndex}"]`);
      if (div) div.classList.add('edited');
      closeEditor();
      setStatus('Gespeichert ✓');
    } catch (err) {
      alert('Fehler: ' + err.message);
    } finally {
      hideLoading();
    }
  }

  // ── Export ──
  $('btn-export').onclick = async () => {
    showLoading('PDF wird erstellt...');
    try {
      const res = await fetch(`/export/${sessionId}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'edited.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus('PDF gespeichert ✓');
    } catch (err) {
      alert('Export fehlgeschlagen: ' + err.message);
    } finally {
      hideLoading();
    }
  };

  // Re-render overlays on window resize
  window.addEventListener('resize', () => { if (ocrBlocks.length) renderOverlays(); });
</script>
</body>
</html>
```

- [ ] **Step 2: Start the app and manually verify in browser**

```bash
cd pdf-editor && python app.py
```

Open `http://localhost:8000`, load a test PDF, click a text block, edit it, save. Verify:
- OCR overlay appears over text blocks
- Click opens textarea with pre-filled text
- Save patches the image and updates the view
- Legal warning appears for documents with "Ausweis", "Zeugnis" etc.
- "Verstanden" dismisses modal and saves
- "PDF speichern" downloads a valid PDF

- [ ] **Step 3: Commit**

```bash
cd pdf-editor
git add static/index.html
git commit -m "feat(pdf-editor): full SPA frontend with visual editor and legal modal"
```

---

## Task 7: Dockerfile + Coolify Deployment

**Files:**
- Create: `pdf-editor/Dockerfile`

- [ ] **Step 1: Write Dockerfile**

```dockerfile
FROM python:3.11-slim

# System deps for PaddleOCR and PyMuPDF
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 libsm6 libxext6 libxrender-dev libgomp1 \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download PaddleOCR models at build time
RUN python -c "from paddleocr import PaddleOCR; PaddleOCR(use_angle_cls=True, lang='en', use_gpu=False, show_log=False)"

COPY . .
RUN mkdir -p sessions static

ENV AUTO_OPEN_BROWSER=0

EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
```

File: `pdf-editor/Dockerfile`

- [ ] **Step 2: Build and verify locally**

```bash
cd pdf-editor
docker build -t pdf-editor .
docker run -p 8000:8000 pdf-editor
```

Open `http://localhost:8000` — app should load.

- [ ] **Step 3: Add to .gitignore**

Add to `pdf-editor/.gitignore`:
```
sessions/*/
```

- [ ] **Step 4: Commit**

```bash
cd pdf-editor
git add Dockerfile .gitignore
git commit -m "feat(pdf-editor): Dockerfile for Coolify deployment on pdfcontrol.eppcom.de"
```

---

## Task 8: Run Full Test Suite

- [ ] **Step 1: Run all tests**

```bash
cd pdf-editor && pytest tests/ -v
```

Expected: all tests PASS (legal_checker: 10, renderer: 6, ocr: 5, app: 10 = 31 total)

- [ ] **Step 2: Fix any failures before proceeding**

If failures occur, read the error message and fix the root cause. Do not skip tests.

- [ ] **Step 3: Final commit**

```bash
cd pdf-editor
git add -A
git commit -m "chore(pdf-editor): all tests green, ready for deployment"
```

---

## Coolify Deployment Checklist (manual)

After all tests pass:

1. Push repo to Git remote
2. In Coolify: New Service → Dockerfile → point to `pdf-editor/` subdirectory
3. Set domain: `pdfcontrol.eppcom.de`
4. Port: `8000`
5. Traefik handles HTTPS/Let's Encrypt automatically
6. Deploy — first deploy takes longer (PaddleOCR models are pre-baked in image)
