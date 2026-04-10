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
