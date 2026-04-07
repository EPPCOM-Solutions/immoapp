# Design-Spec: Cookie-Banner + Mehrstufiges Kontaktformular

**Datum:** 2026-04-07  
**Status:** Genehmigt  
**Ziel:** DSGVO-konformer Cookie-Banner im Glassmorphism-Stil + mehrstufiges Kontaktformular mit Kurzanalyse (Schritt 1 → Schritt 2)

---

## 1. Cookie-Banner

### Visuelles Design
- Fixierte Leiste am unteren Bildschirmrand, `max-width: 900px`, zentriert mit `margin: 0 auto`
- Glassmorphism: `background: rgba(11,15,26,0.97)`, `backdrop-filter: blur(16px)`, `border: 1px solid var(--glass-border)`, `border-radius: 16px 16px 0 0`
- Z-Index: 9999 (über allem, inkl. Header)
- Kein Dark Pattern: alle 3 Aktions-Buttons gleichwertig gestaltet

### Tab-Struktur
| Tab | Inhalt |
|-----|--------|
| Zustimmung | Kurzerklärung + 4 Toggle-Switches |
| Details | Pro Kategorie: Zweck, Beispiele, Speicherdauer |
| Über Cookies | Allgemeine Erklärung was Cookies sind + Links zu DSE/Impressum |

### Cookie-Kategorien
| Kategorie | Standard | Abschaltbar |
|-----------|----------|-------------|
| Notwendig | AN (fixiert) | Nein – mit Hinweis "technisch erforderlich" |
| Präferenzen | AUS | Ja |
| Statistiken | AUS | Ja |
| Marketing | AUS | Ja |

### Buttons (gleichwertige Gewichtung, kein Dark Pattern)
1. **Nur notwendige Cookies** – `btn-secondary`-Stil, gleiche Größe
2. **Auswahl erlauben** – `btn-secondary`-Stil
3. **Alle akzeptieren** – `btn-primary`-Stil (einzige Hervorhebung erlaubt per DSGVO)

### Consent-Logik
- Key: `eppcom_consent` in `localStorage`
- Struktur: `{ version: "1.0", timestamp: "ISO-8601", necessary: true, preferences: bool, statistics: bool, marketing: bool }`
- Banner zeigt sich wenn: `eppcom_consent` nicht gesetzt ODER gespeicherte Version != aktuelle Version
- Footer-Link "Cookie-Einstellungen" öffnet Banner erneut (auch nach Consent)
- Analytics/Marketing-Scripts werden **nur nach Consent** per `document.createElement('script')` dynamisch geladen

### DSGVO-Compliance-Checkliste
- [x] Keine Cookies/Scripts vor Zustimmung
- [x] Gleichwertigkeit der Ablehnungs- und Zustimmungsoptionen
- [x] Keine vorangekreuzten optionalen Kategorien
- [x] Consent-ID + Timestamp + Version gespeichert
- [x] Widerruf jederzeit möglich (Footer-Link)
- [x] Informationspflicht erfüllt (Tab "Details" + "Über Cookies")
- [x] Versionierung: bei Banner-Update erneute Einwilligung
- [x] Links zu Datenschutzerklärung und Impressum im Banner
- [x] Notwendige Cookies nicht deaktivierbar, mit Begründung

---

## 2. Mehrstufiges Kontaktformular

### Architektur
- **Ansatz A:** Pure-JS innerhalb bestehender `<section id="contact">`
- Schritt 1 und Schritt 2 sind separate `<div>`-Blöcke, nur einer ist sichtbar (`display:none`)
- Kein Scroll-Jump, kein neues Markup außerhalb der Sektion
- Schrittindikator oben: nummerierte Kreise (1, 2), aktiver Schritt hervorgehoben

### Schritt 1 – Kurzanalyse (neue, eigenständig formulierte Fragen)
| # | Frage | Feldtyp |
|---|-------|---------|
| 1 | "Welche Abläufe kosten Ihr Team derzeit am meisten Zeit?" | Textarea |
| 2 | "Setzen Sie bereits digitale Hilfsmittel ein – und was hat dabei funktioniert?" | Textarea |
| 3 | "Welcher Unternehmensbereich soll als Erstes entlastet werden?" | Text-Input |
| 4 | "Suchen Sie schnelle Entlastung oder eine nachhaltige Gesamtstrategie?" | Select: Quick Wins / Strategie / Beides |
| 5 | "Wie dringend ist Handlungsbedarf bei Ihnen? (1–10)" | Range-Slider mit Anzeige |

Alle Felder: `required`  
Button: "Weiter" → validiert Schritt 1, zeigt Schritt 2

### Schritt 2 – Kontaktformular
- Bestehendes Formular unverändert
- "Zurück"-Button kehrt zu Schritt 1 zurück (Werte bleiben erhalten)
- "Kontakt senden" sendet alles gemeinsam

### Datenweitergabe
- Schritt-1-Antworten werden in `<input type="hidden">`-Felder innerhalb `#contactForm` kopiert
- Beim Submit werden sie vom bestehenden PHP-Handler erfasst

### PHP-Handler-Erweiterung
Neue POST-Felder:
- `analysis_time_cost` – Welche Abläufe kosten Zeit
- `analysis_tools_used` – Digitale Tools + Erfahrungen
- `analysis_department` – Zu entlastender Bereich
- `analysis_strategy` – Quick Wins / Strategie / Beides
- `analysis_urgency` – Dringlichkeit 1–10

Diese werden als Block "Kurzanalyse:" an den bestehenden E-Mail-Body angehängt (analog zum ROI-Payload).

---

## 3. Implementierungsreihenfolge

1. PHP-Handler um 5 Analyse-Felder erweitern
2. Cookie-Banner HTML/CSS/JS vor `</body>` einfügen
3. Footer-Link "Cookie-Einstellungen" hinzufügen
4. `#contact`-Sektion: Schrittindikator + Schritt-1-Div + hidden Inputs in Schritt-2-Form
5. JS-Logik: Schritt-Navigation, Validierung, hidden-Input-Befüllung

---

## 4. Nicht im Scope

- Inhalte der Datenschutzerklärung / des Impressums (externe Rechtstexte)
- Google Analytics oder andere externe Scripts (nur Consent-Infrastruktur)
- Backend-Änderungen außerhalb der E-Mail-Formatierung
