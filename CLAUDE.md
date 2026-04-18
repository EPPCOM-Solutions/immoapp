# EPPCOM Platform — Claude Code Context

## Projekt-Pfade
- Server Repo: /root/eppcom/
- Deployment: /opt/rag-platform/
- Homepage: /home/coder/homepage/
- LivingMatch App: /home/coder/livingmatch/

## Server
- Server 1: 94.130.170.167 (alle Services via Coolify)
- Server 2: 46.224.54.65 (Ollama LLMs)
- Admin UI: https://appdb.eppcom.de
- Voice Widget: https://appdb.eppcom.de/voice-widget

## Laufende Container
- eppcom-admin-ui (FastAPI, Port 8080)
- voice-agent (livekit_default network)
- livekit-server (wss://appdb.eppcom.de/lk)
- postgres-rag (app_db)

## Voicebot Stack
- STT: Whisper small, INT8, CPU
- LLM: qwen3-voice:latest (Ollama, 46.224.54.65:11434)
- TTS: Cartesia Sonic-2, Voice Alina (38aabb6a-...)
- RAG: https://workflows.eppcom.de/webhook/rag-query

## Wichtige Regeln
- Niemals Secrets committen (.env gitignored)
- Nach jeder Aufgabe committen + pushen
- Docker-Befehle auf Server 1
- eppcom-admin-ui ist NICHT in Coolify — manuell rebuilden

## Offene Tasks
- [ ] Voicebot Latenz optimieren
- [ ] Homepage Widgets (Typebot + Voicebot) aktivieren
- [ ] LivingMatch Coolify Deploy reparieren (package-lock.json fix)
- [ ] SMTP Passwort testen (Passwort-Reset)
