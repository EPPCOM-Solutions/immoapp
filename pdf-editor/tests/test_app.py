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
