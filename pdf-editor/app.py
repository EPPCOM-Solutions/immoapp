# pdf-editor/app.py
import asyncio
import os
import re
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

_UUID_RE = re.compile(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
    re.IGNORECASE,
)

_BASE_DIR = Path(__file__).parent

SESSIONS_DIR = Path(os.environ.get("SESSIONS_DIR", str(_BASE_DIR / "sessions")))
SESSIONS_DIR.mkdir(exist_ok=True)

SESSION_TTL = 3600  # seconds

_session_last_access: dict[str, float] = {}


def _touch(session_id: str) -> None:
    _session_last_access[session_id] = time.time()


def _get_session_dir(session_id: str) -> Path:
    if not _UUID_RE.match(session_id):
        raise HTTPException(400, "Invalid session_id")
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
    content = await file.read()
    if not content.startswith(b"%PDF"):
        raise HTTPException(422, "File is not a valid PDF")

    session_id = str(uuid.uuid4())
    session_dir = SESSIONS_DIR / session_id
    session_dir.mkdir()

    pdf_path = session_dir / "original.pdf"
    pdf_path.write_bytes(content)

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
    bbox: list[list[float]]
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
    try:
        for png_path in pages:
            img_doc = fitz.open(str(png_path))
            try:
                pdf_bytes = img_doc.convert_to_pdf()
            finally:
                img_doc.close()
            img_pdf = fitz.open("pdf", pdf_bytes)
            doc.insert_pdf(img_pdf)
            img_pdf.close()

        out_path = d / "export.pdf"
        doc.save(str(out_path))
    finally:
        doc.close()
    return FileResponse(
        str(out_path),
        media_type="application/pdf",
        filename="edited.pdf",
    )


app.mount("/", StaticFiles(directory=str(_BASE_DIR / "static"), html=True), name="static")


if __name__ == "__main__":
    import uvicorn
    if os.environ.get("AUTO_OPEN_BROWSER", "1") == "1":
        import threading
        threading.Timer(1.2, lambda: webbrowser.open("http://localhost:8000")).start()
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=False)
