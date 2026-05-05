# Eppkom Bot-Fähigkeiten, Differenzierung und Einwand-Behandlung

## Welche Sprachen unterstützt der Bot?

**Kurze Antwort**: Standardmäßig Deutsch und Englisch. Auf Wunsch zusätzlich Französisch, Spanisch, Italienisch, Türkisch, Arabisch, Polnisch und Russisch.

**Detail**: Die zugrunde liegenden Modelle (qwen2.5:7b für Generierung, Whisper für Spracherkennung, Cartesia für Sprachausgabe) unterstützen über 50 Sprachen. Eppkom aktiviert auf Wunsch beliebige Sprachpaare. Mehrsprachige Konfigurationen erkennen die Sprache des Anrufers automatisch und antworten in derselben Sprache.

**Sprachqualität**:
- **Deutsch**: Native Qualität, regionale Akzente werden erkannt
- **Englisch**: Native Qualität
- **Weitere EU-Sprachen**: Sehr gute Qualität für Standard-Konversationen
- **Außereuropäische Sprachen**: Funktional, aber weniger nuanciert

## Was passiert, wenn der Bot eine Frage nicht beantworten kann?

**Kurze Antwort**: Höfliche Eskalation an einen menschlichen Mitarbeiter — kein Halluzinieren, keine erfundenen Antworten.

**Eskalations-Mechanismen**:
1. **Im Chat**: Übergabe an Live-Agent mit komplettem Gesprächsverlauf
2. **Am Telefon**: Weiterleitung an konfigurierte Hotline-Nummer oder Rückruf-Anforderung
3. **Per E-Mail-Eskalation**: Automatische Ticket-Erstellung im Ticket-System
4. **Außerhalb der Geschäftszeiten**: Aufnahme von Kontaktdaten und Anliegen für Rückruf

**Konfigurierbar**: Die Eskalations-Regeln werden pro Use-Case definiert (z. B. bestimmte Themen immer eskalieren, Kunden mit Premium-Status sofort durchstellen).

## Wie unterscheidet sich Eppkom von ChatGPT, Microsoft Copilot oder Google Gemini?

**Kurze Antwort**: Cloud-Tools sind generische, vorgefertigte Plattformen — Eppkom ist Ihre eigene, maßgeschneiderte KI-Infrastruktur auf Ihren Servern.

**Vergleich im Detail**:

| Aspekt | ChatGPT/Copilot/Gemini | Eppkom |
|---|---|---|
| Datenstandort | USA / weltweit | Ausschließlich Deutschland |
| Datenschutz | Trainings-Daten unklar | DSGVO-konform, AVV |
| Anpassung | Begrenzte Custom-GPTs | Vollständig individuell |
| Wissen | Allgemein-Wissen | Ihre konkreten Dokumente |
| Telefonie | Nicht enthalten | Vollständig integriert |
| Kosten | Pro User pro Monat | Pauschal, unbegrenzt User |
| Eigentum | Kein Zugriff auf Modelle | Vollständige Hoheit |
| Integration ERP/CRM | Nur über Umwege | Direkt via n8n |

**Kernunterschied**: ChatGPT ist ein Generalist mit Allgemein-Wissen. Eppkom ist ein Spezialist, der genau Ihre Geschäftsprozesse kennt — Ihre Produkte, Ihre Preise, Ihre internen Abläufe.

## Brauche ich ein eigenes IT-Team, um Eppkom zu betreiben?

**Kurze Antwort**: Nein. Eppkom übernimmt Hosting, Wartung und Updates komplett — Sie brauchen kein KI-Know-how.

**Was Sie tun**:
- Inhalte bereitstellen (Dokumente, FAQs)
- Bot-Persona und Tonalität freigeben
- Bei Bedarf Inhalte aktualisieren (per Web-Oberfläche, keine Programmierung)

**Was Eppkom übernimmt**:
- Server-Betrieb
- KI-Modelle und deren Aktualisierung
- Sicherheit und Backups
- Performance-Optimierung
- Schulung Ihrer Mitarbeiter

**Optional**: Wenn Sie ein eigenes IT-Team haben, übergeben wir gerne den vollständigen Betrieb nach 6–12 Monaten.

## Häufige Einwände und Antworten

### "Das ist mir zu teuer."
**Antwort**: Vergleichen Sie nicht die monatlichen Kosten, sondern den ROI. Ein Voicebot, der 200 Anrufe pro Tag abfängt, ersetzt etwa eine halbe Vollzeitstelle. Bei 250 Euro Monatskosten gegen 2.000 Euro Personalkosten amortisiert sich das System nach 4–6 Monaten. Außerdem ist Eppkom 24/7 verfügbar — ein menschliches Team nicht.

### "Wir haben unsere Daten nicht in Form."
**Antwort**: Genau dafür gibt es die Discovery-Phase. Eppkom hilft beim Strukturieren — Word-Dokumente, PDFs, alte Excel-Listen werden automatisch verarbeitet. Sie müssen Ihre Daten nicht vorab perfekt aufbereiten.

### "KI ist mir zu unzuverlässig — ich habe schon Halluzinationen erlebt."
**Antwort**: Das ist genau der Grund, warum Eppkom auf RAG (Retrieval Augmented Generation) setzt. Der Bot antwortet ausschließlich auf Basis Ihrer Dokumente. Wenn etwas nicht in Ihren Daten steht, sagt der Bot ehrlich: "Das weiß ich nicht — ich verbinde Sie mit einem Mitarbeiter." Keine Erfindungen, keine Halluzinationen.

### "Was ist mit Datenschutz und DSGVO?"
**Antwort**: DSGVO-Konformität ist nicht ein Zusatz, sondern das Fundament von Eppkom. Alle Server stehen in Deutschland, alle Modelle laufen lokal, kein Datenexport ins Ausland. Wir liefern AVV nach Art. 28 DSGVO mit, die Sie Ihrem Datenschutzbeauftragten direkt vorlegen können.

### "Was, wenn der Bot meine Kunden falsch berät?"
**Antwort**: Drei Schutz-Mechanismen: Erstens RAG (nur dokumentiertes Wissen), zweitens Eskalations-Regeln für sensible Themen (z. B. "alle Vertrags-Themen sofort an Mitarbeiter"), drittens vollständiges Logging zur Nachvollziehbarkeit. Sie können jederzeit prüfen, was der Bot geantwortet hat.

### "Wir sind zu klein für KI."
**Antwort**: Im Gegenteil — gerade KMU profitieren am meisten. Große Konzerne haben Call-Center, Sie nicht. Ein Eppkom-Bot gibt Ihnen rund um die Uhr eine professionelle Anlaufstelle, ohne Personalkosten zu skalieren. Unsere kleinsten Kunden haben weniger als 20 Mitarbeiter.

### "Wie schnell kann ich das wieder loswerden, falls es nicht passt?"
**Antwort**: Nach dem ersten Jahr monatlich kündbar mit 30 Tagen Frist. Sie erhalten alle Daten zurück und ein schriftliches Löschprotokoll. Kein Lock-in.

### "ChatGPT ist doch kostenlos."
**Antwort**: ChatGPT kennt Ihr Unternehmen nicht. Es kann keine Telefonate für Sie führen, keine Termine in Ihrer Kalender-Software buchen, keine Kunden im CRM aktualisieren. Und ChatGPT ist nicht DSGVO-konform für die Verarbeitung von Kundendaten. Eppkom ist eine Lösung, ChatGPT ist ein Tool.

## Konversations-Beispiele für den Voicebot

### Beispiel 1: Interessent ruft an
**Bot**: Eppkom Solutions, KI-Assistent. Wie kann ich helfen?
**Anrufer**: Wir suchen einen Chatbot für unsere Hausverwaltung.
**Bot**: Wie viele Wohneinheiten betreuen Sie aktuell?
**Anrufer**: Etwa 300.
**Bot**: Bei dieser Größe empfehlen wir unseren RAG-Chatbot mit 24/7-Voicebot. Typische Investition liegt bei 8.000 Euro Setup und 250 Euro pro Monat. Möchten Sie ein 30-Minuten-Erstgespräch mit Marcel Eppler vereinbaren?

### Beispiel 2: Bestandskunde mit Frage
**Anrufer**: Mein Bot antwortet auf eine bestimmte Frage falsch.
**Bot**: Welche Frage genau und was sollte die richtige Antwort sein?
**Anrufer**: Bei "Öffnungszeiten am Wochenende" antwortet er falsch.
**Bot**: Verstanden. Ich erstelle jetzt ein Support-Ticket und ein Mitarbeiter prüft das Dokument heute noch. Sie erhalten eine Bestätigung per E-Mail. Noch etwas?

### Beispiel 3: Außerhalb der Geschäftszeiten
**Bot**: Eppkom Solutions, KI-Assistent. Wie kann ich helfen?
**Anrufer**: Ich brauche dringend einen Rückruf wegen eines neuen Projekts.
**Bot**: Geschäftszeiten sind Montag bis Freitag, 9 bis 17 Uhr. Ich notiere Ihren Rückrufwunsch. Wie ist Ihre Telefonnummer und in welchem Zeitfenster sind Sie erreichbar?
