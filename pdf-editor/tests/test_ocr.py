# pdf-editor/tests/test_ocr.py
import json
import math
from unittest.mock import patch, MagicMock
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
    with patch("paddleocr.PaddleOCR") as MockOCR:
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

    with patch("paddleocr.PaddleOCR") as MockOCR:
        blocks = run_ocr(img_path, str(cache_path))
        MockOCR.assert_not_called()

    assert blocks[0]["text"] == "Cached"


def test_run_ocr_empty_result(tmp_path):
    with patch("paddleocr.PaddleOCR") as MockOCR:
        instance = MagicMock()
        instance.ocr.return_value = [[]]
        MockOCR.return_value = instance

        from PIL import Image
        img_path = str(tmp_path / "page.png")
        Image.new("RGB", (100, 60)).save(img_path)
        cache_path = str(tmp_path / "ocr.json")

        blocks = run_ocr(img_path, cache_path)

    assert blocks == []
