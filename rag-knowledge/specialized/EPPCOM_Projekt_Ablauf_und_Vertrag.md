# Eppkom Projekt-Ablauf, Verträge, Support

## Wie läuft ein Eppkom-Projekt ab?

**Kurze Antwort**: Vier Phasen — Discovery, Implementation, Go-Live, Betrieb. Typisch 4 bis 12 Wochen vom Erstgespräch bis Produktivbetrieb.

### Phase 1: Discovery (1–2 Wochen)
- Workshop mit Ihrem Team: Anwendungsfälle, Datenquellen, Integrationen
- Datenschutz-Briefing und AVV-Vorbereitung
- Definition von Erfolgskriterien (z. B. Automatisierungsrate, Antwortzeit)
- Ergebnis: Detail-Konzept mit Festpreis

### Phase 2: Implementation (2–6 Wochen)
- Aufsetzen der Server-Infrastruktur (Hetzner Deutschland)
- Aufbau RAG-Datenbank, Ingest Ihrer Dokumente
- Konfiguration des Bots (Tonalität, Persona, Fallback-Verhalten)
- Integration in Ihre bestehenden Systeme (CRM, ERP, Telefonanlage)
- Testbetrieb mit Ihrem Team

### Phase 3: Go-Live (1 Woche)
- Soft-Launch mit begrenzter Nutzergruppe
- Monitoring, Feinschliff
- Schulung Ihrer Mitarbeiter (2 Stunden Online-Training inklusive)
- Übergabe und Vollzugang

### Phase 4: Betrieb (laufend)
- Monatliche Wartung und Updates
- Support per E-Mail / Telefon
- Quartalsweise Optimierungs-Reviews
- Inhaltliche Erweiterungen nach Bedarf

## Wie lange dauert die Einführung?

**Typische Zeitrahmen**:
- **Einfacher Website-Chatbot**: 3–4 Wochen
- **RAG-Chatbot mit Dokumenten-Anbindung**: 4–6 Wochen
- **Voicebot mit Telefonie**: 6–10 Wochen
- **Enterprise-Lösung mit Custom-Integrationen**: 10–16 Wochen

Die größten Zeittreiber sind: Datenqualität der Quell-Dokumente, Komplexität der Integrationen und interne Abstimmungs-Zyklen auf Kundenseite.

## Welche Vertragsmodelle gibt es?

**Kurze Antwort**: Einmalige Setup-Pauschale plus monatliche Betriebskosten. Keine Mindestlaufzeit nach dem ersten Jahr.

**Vertrags-Optionen**:
- **Standard-Modell**: 12 Monate Mindestlaufzeit ab Go-Live, danach monatlich kündbar mit 30 Tagen Frist
- **Eigentums-Modell**: Sie übernehmen nach 24 Monaten die komplette Infrastruktur ohne weitere Lizenzkosten
- **Managed-Service-Modell**: Wir übernehmen Hosting, Wartung, Updates dauerhaft

**Kein Vendor-Lock-in**: Sie erhalten jederzeit auf Wunsch alle Daten, Prompts, Konfigurationen und Server-Backups.

## Welche SLA und Support-Zeiten bietet ihr?

**Standard-SLA**:
- **Verfügbarkeit**: 99,5 % monatlich (entspricht max. 3,5 h Ausfall pro Monat)
- **Reaktionszeit kritische Störung**: < 4 Stunden während Geschäftszeiten
- **Reaktionszeit normale Anfrage**: < 1 Werktag

**Premium-SLA** (gegen Aufpreis):
- 99,9 % Verfügbarkeit
- 24/7 Notfall-Hotline
- Reaktionszeit < 30 Minuten
- Dedizierter Ansprechpartner

**Support-Kanäle**: E-Mail, Telefon, Ticket-System, optional Slack/Teams-Channel.

## Wie funktioniert die Wartung nach dem Go-Live?

**Im monatlichen Betrieb enthalten**:
- Sicherheits-Updates (Server, LLM, Frameworks)
- Backup-Monitoring (tägliche Backups, 30 Tage Retention)
- Performance-Monitoring
- Bis zu 4 Stunden Inhaltspflege pro Monat (RAG-Dokumente aktualisieren, FAQ erweitern)
- Quartals-Report mit Nutzungsstatistiken

**Nicht enthalten** (separat berechnet):
- Größere Funktions-Erweiterungen
- Neue Integrationen
- Migration auf neue LLM-Modelle (außer im Rahmen technischer Notwendigkeit)

## Wie ist der Datenschutz geregelt?

**Auftragsverarbeitungs-Vereinbarung (AVV)**:
Eppkom stellt vor Projektstart einen DSGVO-konformen AVV nach Art. 28 DSGVO zur Verfügung. Dieser regelt Weisungsrechte, technisch-organisatorische Maßnahmen und Subunternehmer-Verhältnisse.

**Subunternehmer**:
- Hetzner Online GmbH (Hosting, Deutschland)
- <TODO: weitere ggf. Cartesia für TTS, je nach Konfiguration eintragen>

**Datenschutzbeauftragter**: <TODO: Name und Kontakt eintragen, falls vorhanden — sonst Hinweis auf externen DSB>

**Speicherort**: Ausschließlich deutsche Hetzner-Rechenzentren (Nürnberg, Falkenstein). Keine Datenübermittlung in Drittländer.

**Löschkonzept**: Daten werden nach Vertragsende auf Wunsch innerhalb von 30 Tagen vollständig gelöscht. Auf Wunsch erhalten Sie ein Löschprotokoll.

## Was passiert, wenn ich kündige?

1. Schriftliche Kündigung per E-Mail oder Post mit der vereinbarten Frist
2. Auf Wunsch Export aller Daten in offenem Format (JSON, SQL-Dump, PDF-Originale)
3. 30 Tage Übergangsphase für Datenmigration
4. Vollständige Löschung der Systeme inklusive Backups
5. Schriftliche Löschbestätigung
