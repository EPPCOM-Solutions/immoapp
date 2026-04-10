# PDF Scan Editor — Design Spec
**Datum:** 2026-04-10  
**Zweck:** AI-gestützte Demo für Dokumentbearbeitung, vergleichbar mit Adobe Acrobat  
**Stack:** Python 3.11 + FastAPI + PaddleOCR + PyMuPDF + Vanilla JS

---

## 1. Ziel

Eine Web-App, die eingescannte PDFs öffnet, Texte per OCR erkennt und visuell editierbar macht. Bearbeiteter Text wird so zurückgerendert, dass er optisch ununterscheidbar vom Original ist (gleiche Farbe, Rotation, Verzerrung, Textur). Die App kann lokal auf dem Mac oder als Server-Service unter `pdfcontrol.eppcom.de` betrieben werden.

---

## 2. Architektur

```
Browser (localhost:8000)
    ↕ HTTP/REST + JSON
FastAPI Backend
    ├── /upload          → PDF einlesen, Seiten als PNG rendern
    ├── /ocr/{page}      → PaddleOCR → Textblöcke + Bounding Boxes + Winkel
    ├── /save-block      → Block patchen, Text-Rendering mit Visual Match
    ├── /export          → Fertige PDF speichern
    └── /legal-check     → Regelbasierte Hinweis-Prüfung
```

Alle Dateien liegen in einem **lokalen Temp-Verzeichnis** (`/tmp/pdf-editor-session/`). Kein Upload zu externen Diensten.

---

## 3. Komponenten

### 3.1 Backend (`app.py`)

**FastAPI-App mit folgenden Endpunkten:**

| Endpunkt | Methode | Beschreibung |
|---|---|---|
| `/upload` | POST | PDF hochladen (multipart), Seiten als PNG rendern via PyMuPDF, Session-ID zurückgeben |
| `/pages/{session_id}` | GET | Liste aller Seiten-PNGs |
| `/ocr/{session_id}/{page}` | GET | PaddleOCR auf Seite ausführen → JSON mit Blöcken (text, bbox, angle, confidence) |
| `/save-block` | POST | Einen Textblock ersetzen: Visual-Match-Rendering + In-Place-Patch ins Seiten-PNG |
| `/legal-check` | POST | Text auf rechtlich sensible Muster prüfen → Hinweis-Text oder null |
| `/export/{session_id}` | GET | Alle gepatchten PNGs zu PDF zusammenbauen, als Download zurückgeben |

### 3.2 OCR-Modul (`ocr.py`)

- PaddleOCR mit `lang='german'` (oder `en` als Fallback)
- Liefert pro Block: `text`, `bbox` (4 Punkte), `angle`, `confidence`
- Ergebnis wird je Seite gecacht (JSON in Session-Verzeichnis)

### 3.3 Visual-Match-Renderer (`renderer.py`)

Für jeden bearbeiteten Block:

1. **Farb-Extraktion:** Pixel-Sampling im Original-Bounding-Box → dominante Textfarbe (dunkelste ~10% der Pixel, Median)
2. **Rotation:** Winkel aus PaddleOCR-Ergebnis übernehmen
3. **Noise-Level-Messung:** Standardabweichung der Pixelwerte im Block → Basis für späteren Noise
4. **Text rendern:** Pillow (`ImageDraw`) mit ermittelter Farbe + passendem Systemfont (Größe aus Bounding-Box-Höhe)
5. **Elastic Distortion:** scipy `ndimage.map_coordinates` mit leichtem Zufalls-Displacement-Grid (σ ≈ 1–2px, α ≈ 3–5px) → wabbeliger Look
6. **Gaussian Noise:** numpy — gemessenes Noise-Level als σ auf gerenderten Text addieren
7. **Rotation anwenden:** Pillow `rotate` mit dem gemessenen Winkel
8. **Compositing:** Weißer Rechteck-Patch im Original-PNG → gerenderten Block einfügen

### 3.4 Legal Checker (`legal_checker.py`)

Regelbasiert, **kein Block — nur Hinweis.**

Prüft auf folgende Muster (case-insensitive, Deutsch + Englisch):
- Dokument-Keywords: `ausweis`, `zeugnis`, `urkunde`, `zertifikat`, `bescheinigung`, `pass`, `führerschein`, `vertrag`, `rechnung`, `urteil`, `vollmacht`
- Kontext: Änderung betrifft Datum, ID-Nummer, Betrag, Unterschrift-nahen Bereich
- Amtliche Stempel-Nähe: Bounding Box nah an erkannten Stempel-/Siegel-Regionen

Gibt zurück:
```json
{
  "warning": true,
  "message": "Hinweis: Diese Änderung betrifft ein amtliches Dokument. Unbefugte Urkundenfälschung ist strafbar (§ 267 StGB). Bitte sicherstellen, dass du zur Bearbeitung berechtigt bist."
}
```

### 3.5 Frontend (`static/index.html`)

Single-Page-App, kein Framework-Dependency.

**UI-Elemente:**
- **Toolbar:** "PDF öffnen", Seiten-Navigation (◀ ▶), "PDF speichern"
- **Canvas-Bereich:** Seite als `<img>`, darüber `<svg>` mit halbtransparenten Rechtecken pro OCR-Block
- **Block-Klick:** Öffnet ein `<textarea>`-Overlay direkt über dem Block, vorausgefüllt mit erkanntem Text
- **Speichern-Button im Overlay:** Ruft `/legal-check` auf → ggf. Modal mit Hinweis + "Verstanden"-Button → dann `/save-block`
- **Legal-Hinweis-Modal:** Gelber Banner, Hinweistext, einziger Button: "Verstanden" → schließt Modal, Speichern wird fortgesetzt

**Kein Framework** — reines HTML/CSS/JS (~300 Zeilen), eingebettet in FastAPI `StaticFiles`.

---

## 4. Datenfluss

```
1. User wählt PDF          → POST /upload → session_id + Seiten-PNGs
2. Seite anzeigen          → GET /pages/{id} → PNG als <img>
3. OCR laden               → GET /ocr/{id}/{page} → SVG-Overlays zeichnen
4. User klickt Block       → textarea-Overlay erscheint
5. User ändert Text        → "Speichern" klicken
6. Legal-Check             → POST /legal-check → ggf. Modal
7. "Verstanden"            → POST /save-block → PNG wird gepatcht
8. Export                  → GET /export/{id} → PDF-Download
```

---

## 5. Datei-Struktur

```
pdf-editor/
├── app.py               # FastAPI-Einstiegspunkt + Endpunkte
├── ocr.py               # PaddleOCR-Wrapper + Caching
├── renderer.py          # Visual-Match-Text-Rendering
├── legal_checker.py     # Regelbasierter Hinweis-Checker
├── requirements.txt     # Abhängigkeiten
├── static/
│   └── index.html       # komplette Frontend-SPA
└── sessions/            # temporäre Session-Daten (gitignored)
    └── {session_id}/
        ├── original.pdf
        ├── page_0.png
        ├── page_1.png
        ├── ocr_0.json
        └── ...
```

---

## 6. Abhängigkeiten (`requirements.txt`)

```
fastapi
uvicorn[standard]
paddlepaddle
paddleocr
pymupdf
Pillow
numpy
scipy
python-multipart
```

---

## 7. Start

```bash
pip install -r requirements.txt
python app.py
# → Öffnet automatisch http://localhost:8000 im Browser
```

---

## 8. Deployment

### Option A: Lokal (Mac)
```bash
pip install -r requirements.txt
python app.py
# → http://localhost:8000
```

### Option B: Server via Coolify + Traefik (`pdfcontrol.eppcom.de`)

**`Dockerfile`:**
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Coolify-Konfiguration:**
- Service-Typ: Dockerfile
- Port: 8000
- Domain: `pdfcontrol.eppcom.de`
- Traefik übernimmt HTTPS/Let's Encrypt automatisch

**Datei-Handling bei Server-Deployment:**
- PDF wird vom Mac-Browser per multipart-Upload auf den Server übertragen
- Verarbeitung + Temp-Dateien auf dem Server (`/app/sessions/`)
- Export liefert die fertige PDF als Download zurück in den Browser → Mac

**Session-Cleanup:**
- Temp-Dateien werden nach 1 Stunde Inaktivität automatisch gelöscht (Background-Task in FastAPI)

---

## 9. Nicht im Scope

- Authentifizierung / Multi-User
- Cloud-Speicherung
- Batch-Verarbeitung mehrerer PDFs gleichzeitig
- Handschrift-spezifische OCR-Modelle
- Undo/Redo über mehrere Schritte hinaus (nur aktueller Block resetbar)
