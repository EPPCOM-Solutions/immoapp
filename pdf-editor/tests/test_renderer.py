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
    # Blue channel should dominate given the input text color
    assert color[2] > color[0]


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
        # File must still be a valid readable PNG after empty text patch
        result = Image.open(tmp_path)
        assert result.size == (300, 100)
    finally:
        os.unlink(tmp_path)
