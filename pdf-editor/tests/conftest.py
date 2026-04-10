# pdf-editor/tests/conftest.py
import sys
import pytest
from unittest.mock import MagicMock

# Mock paddleocr before any code tries to import it
sys.modules['paddleocr'] = MagicMock()
sys.modules['paddlex'] = MagicMock()
sys.modules['cv2'] = MagicMock()

import ocr


@pytest.fixture(autouse=True)
def reset_ocr_singleton():
    """Reset PaddleOCR singleton before each test to allow mocking."""
    ocr._ocr_instance = None
    yield
    ocr._ocr_instance = None
