# EPPCOM Platform — Claude Code Context

## GitHub Repos
- **immoapp** → LivingMatch App (app/, voice-agent/, admin-ui/, rag-knowledge/)
- **eppcom-projects** → Platform-Infrastruktur (docker/, sql/, n8n/, scripts/, docs/, eppcom-homepage/, jitsi-meet/)
- **eppcom-ai-automation** → AI/Voicebot-Automatisierung

## Lokale Pfade (Code-Server)
- Aktives Repo: `/home/coder/eppcom` (→ immoapp)
- AI Automation: `/home/coder/projects/eppcom-ai-automation`
- Coolify-Token: `~/.coolify-env` (`COOLIFY_URL` + `COOLIFY_TOKEN`)

## Server
- **Server 1**: `94.130.170.167` — Coolify-Host, postgres-rag, n8n, admin-ui, voicebot
- **Server 2**: `46.224.54.65` — EPPCOM-LLM, Ollama, **LivingMatch App + DB**
- Admin UI: https://appdb.eppcom.de
- Voice Widget: https://appdb.eppcom.de/voice-widget

## LivingMatch App (live)
- Live unter `https://livingmatch.app` (sobald DNS-Suspension behoben — siehe Memory `project_domain_suspension.md`)
- App-UUID Coolify: `nxdz457mwqx3pw6c5gapptk2`
- Projekt: Apps / production / Server EPPCOM-LLM
- DB: Coolify-managed `livingmatch-db` auf Server 2, intern erreichbar als `a8wnei5s33d9n6u73ofe4cjn:5432`
- DB-Name: `livingmatch`, User: `livingmatch`
- Auto-Migration: `initDb()` in `src/lib/db.ts` legt `livingmatch_users` + `livingmatch_searches` beim Start an
- Initialer Admin: `eppler@eppcom.de` (PW in `app/appdevelompent4.md`, **MUSS geändert werden**)
- SSL: Let's Encrypt R13 aktiv (gültig bis 2026-07-27)

## Voicebot Stack
- STT: Whisper small, INT8, CPU (beam_size 1, greedy)
- LLM: `qwen3-voice:latest` (Ollama, 46.224.54.65:11434)
- TTS: Cartesia Sonic-2, Voice Alina (38aabb6a-...)
- RAG: https://workflows.eppcom.de/webhook/rag-query (timeout 0.8s)

## Wichtige Regeln
- Niemals Secrets committen (`.env` ist gitignored)
- Nach jeder Aufgabe committen + pushen
- Docker-Befehle auf Server 1 (postgres-rag, admin-ui, voice-agent)
- eppcom-admin-ui ist NICHT in Coolify — manuell rebuilden
- `.app` Domain ist suspendiert (ICANN, fehlende Email-Verifikation) — NS zeigen auf Parking; `.de` läuft korrekt auf Hetzner

## Bekannte Coolify-Bugs (v4.0.0-beta.469)
- **Horizon-Queue stuck**: Deploys hängen in `queued`. Fix: `docker exec coolify php artisan horizon:restart` auf Server 1
- **DB-Erstellung via API geht nicht**: PostgreSQL-Resources nur über UI anlegen
- **FQDN-Patch geht nicht**: Domains nur über UI ändern
- **Env-Vars über API**: POST funktioniert; PATCH nur ohne `uuid`-Feld im Body, mit `key`+`value`

## Offene Tasks
- [ ] LivingMatch Admin-Passwort ändern (PRIORITÄT)
- [ ] `.app` ICANN Email-Verifikation abschließen → DNS wieder Hetzner-NS
- [ ] SSH-Public-Key in Server 1+2 `~/.ssh/authorized_keys` (Memory enthält Key)
- [ ] SMTP Passwort-Reset Flow testen
- [ ] Homepage Widgets via Ionos FTP deployen (`index_deploy.php` → www.eppcom.de)
- [ ] Voicebot weiter optimieren

## Persistenz für neue Chat-Sessions
1. **CLAUDE.md** (diese Datei) — stabile Projekt-Regeln, Live-Daten, immer aktiv
2. **`~/.claude/projects/-home-coder-eppcom/memory/`** — Auto-Memory, lädt automatisch in jedem Chat
3. **`app/appdevelompentN.md`** — detaillierte Session-Logs (UUIDs, Befehle, Workarounds)
4. **Obsidian-Vault** `/home/coder/obsidian-vault/` — alle Chat-Transcripte (Stop-Hook → GitHub `EPPCOM-Solutions/llm-chats`); MCP-Server `obsidian` für Lesezugriff in Sessions (`mcp__obsidian__*` Tools)
5. **Karpathy LLM-Wiki** `/home/coder/obsidian-wiki/` — kompiliertes Wissen via Ar9av/obsidian-wiki Framework (Repo `EPPCOM-Solutions/eppcom-wiki`); ingest aus chat-archive; global `/wiki-query` + `/wiki-update`, project-lokal alle 25 Skills inkl. `/wiki-setup`, `/wiki-ingest`, `/wiki-lint`
6. **Globale Coding-Regeln** `~/.claude/CLAUDE.md` — Karpathy 4-Punkte-Disziplin (Think-before-coding, Simplicity-first, Surgical-changes, Goal-driven)
