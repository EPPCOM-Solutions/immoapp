# EPPCOM Voice Bot - Projektstatus & Handoff für Claude Code

Dieses Dokument dient als Einstiegspunkt und Statusbericht für die weitere KI-gestützte Entwicklung (z.B. mit Claude Code). Es fasst den aktuellen Stand des Voice Bot Projekts zusammen.

## Projektübersicht
Das Projekt ist ein Voice Bot, der LiveKit (WebRTC), lokale STT (Whisper), LLM (Ollama phi:2b), TTS (Cartesia) und eine RAG-Integration (über n8n und PostgreSQL) nutzt. 

### Architektur
- **Server 1 (Coolify):** PostgreSQL + pgvector (RAG), n8n Workflows (Ingestion & Query), Typebot.
- **Server 2 (Docker Compose):** Nginx-Proxy, LiveKit-Server, LiveKit-Agent (Python), Ollama, Token-Server (JWT).
- **Ablauf:** Browser holt Token vom Token-Server -> Verbindet via WebSocket zu LiveKit -> Agent orchestriert STT -> LLM -> TTS und holt RAG-Kontext über n8n Webhook.

## Was funktioniert (✅)
1. **Infrastruktur:** Docker-Compose Stack läuft, alle Container sind verbunden. Nginx routet korrekt.
2. **Token Server:** `livekit-token-server.py` läuft und generiert valide JWT Tokens für LiveKit.
3. **LiveKit Server:** Läuft, Webhook URLs sind konfiguriert.
4. **Voice Agent Backend:** `agent.py` nutzt LiveKit v1.4 API. STT, LLM, TTS Provider sind implementiert. RAG Kontext wird über n8n Webhooks geladen.
5. **Frontend:** `test-voice-agent.html` implementiert die LiveKit v2.x JS API für den Browser-Zugriff.
6. **RAG Integration:** n8n Workflows laufen, Agent ruft diese erfolgreich ab.

## Was noch NICHT funktioniert / Bekannte Issues (🔴 / 🟡)
1. 🔴 **KRITISCH: Environment-Variablen im Docker-Compose:** Die Variablen (z.B. `LIVEKIT_API_SECRET`, `CARTESIA_API_KEY`) werden im Backend (Agent) nicht geladen, da Compose sie nicht aus `.env.server2` in die Container injectet. 
   - **Lösung:** `.env.server2` als `.env` nach `docker/.env` kopieren und Container neu bauen.
2. 🟡 **Cartesia Voice ID:** In `.env.server2` steht `CARTESIA_VOICE_ID=default`. Das muss auf eine gültige Cartesia Voice ID geändert werden.
3. 🟡 **Browser-Fehler bei der Verbindung:** Frontend (`test-voice-agent.html`) generiert zwar den Token, aber beim Klick auf "Verbinden" kommt oft "LivekitClient not properly loaded". Möglicherweise ein Caching-Problem oder die Einbindung der JS-Library.
4. 🟡 **Ollama Status:** Container ist teils "unhealthy". Es muss sichergestellt werden, dass `phi:2b` via `docker exec ollama ollama pull phi:2b` heruntergeladen wurde.
5. 🟡 **`test-voice-simple.html`:** Ist im Repo, aber nicht im Nginx gemountet (kann zur Fehlersuche im Browser hilfreich sein).

## Nächste Schritte (Prio-Liste für Claude)
1. **Docker Env-Fix:** Führe den Fix für die Environment-Variablen auf dem Server durch (Dateien kopieren, Docker-Compose neustarten).
2. **Cartesia Voice ID:** Trage die echte Cartesia Voice ID ein.
3. **Ollama Modell:** Stelle sicher, dass `phi:2b` geladen ist.
4. **Frontend-Debugging:** Behebe den "LivekitClient not properly loaded" Fehler in `test-voice-agent.html` oder mounte `test-voice-simple.html` zum Testen.
5. **End-to-End Test:** Prüfe die Audio-Verbindung und die Latenz des gesamten Pipelines (STT -> LLM -> TTS).

Alle wichtigen Dateien ([`agent.py`](agent.py), [`livekit-token-server.py`](livekit-token-server.py), [`test-voice-agent.html`](test-voice-agent.html), [`# EPPCOM-2203.md`](# EPPCOM-2203.md)) sind im lokalen Git-Repository versioniert.
