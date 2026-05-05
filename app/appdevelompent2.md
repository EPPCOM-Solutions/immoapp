# LivingMatch App — Entwicklungs-Status & Übergabe

> **Zweck:** Vollständige Kontext-Übergabe für die Weiterarbeit an der LivingMatch App in einem neuen Chat. Stand vom 26.04.2026.

---

## 1. Projekt-Kontext

**Repo:** `immoapp` → enthält LivingMatch App
- Lokaler Pfad (Code-Server): `/home/coder/eppcom`
- Lokaler Pfad (Mac): `/Users/marceleppler/Desktop/business/projects/antigravProject`
- GitHub: `git@github.com:EPPCOM-Solutions/immoapp.git`
- Branch: `main`

**Struktur im Repo:**
```
app/             ← Haupt-Next.js App (LivingMatch)
voice-agent/     ← LiveKit Voice Bot
admin-ui/        ← FastAPI Admin Panel
rag-knowledge/   ← RAG Daten/Workflows
```

**Wichtiger Hinweis aus `app/AGENTS.md`:**
> Diese Next.js-Version hat Breaking Changes — APIs, Konventionen und Datei-Struktur können vom Training-Stand abweichen. Vor Code-Änderungen den passenden Guide in `node_modules/next/dist/docs/` lesen.

---

## 2. Aktueller Deploy-Status

### Was funktioniert
1. **Server-Migration zu `EPPCOM-LLM` (80 GB) abgeschlossen** — Coolify läuft fehlerfrei. Speicherplatz-Problem (MISCONF Redis / OOM Killer) ist gelöst, `npm i` läuft schnell durch.
2. **Ports befreit** — Der blockierende `nginx-proxy` wurde gestoppt, Coolify nutzt 80/443 problemlos.
3. **App-Klon in Coolify** — App samt aller Umgebungsvariablen geklont, Server als Deploy-Ziel definiert.
4. **TypeScript-Fix gepusht** — siehe nächster Abschnitt.

### Der zentrale Build-Fehler (gelöst auf Server)

**Fehler im Coolify-Log:**
```
Type error: Property 'email' does not exist on type 'SavedSearch'.
```

**Ursache:** SQL-Query in `getAllActiveSearches` joint bereits die User-Email, aber der TypeScript-Rückgabetyp hatte das Feld nicht — Build-Failure in der Cron-Route `check-searches`.

**Fix (Commit `a27dfbd5f72`):**
- Datei: `app/src/lib/searches.ts`
- Rückgabetyp von `getAllActiveSearches` angepasst auf `Promise<(SavedSearch & { email: string })[]>`
- **Status auf Code-Server (`/home/coder/eppcom`):** ✅ Bereits in `origin/main` gepusht
- **Status auf Mac:** ⚠️ Laut altem `app-status.md` war Push dort blockiert wegen Git-Auth

### Git-Auth-Problem auf dem Mac (vermutlich noch offen)

Auf dem lokalen Mac war Push blockiert:
```
fatal: could not read Username for 'https://github.com': Device not configured
```
Hintergrund: GitHub-User wurde von `marcello2304` auf `eppcom-solutions` umgestellt.

**Fix-Optionen:**
- **Empfohlen — Remote auf SSH umstellen:**
  ```bash
  cd /Users/marceleppler/Desktop/business/projects/antigravProject
  git remote set-url origin git@github.com:EPPCOM-Solutions/immoapp.git
  git push
  ```
- Alternative: Personal Access Token bei der Username-Abfrage als Passwort angeben.

> ⚠️ In den Chat-Archiven wurde ein alter aktiver GitHub-PAT gefunden (`ghp_WseHN3...`). Der sollte revoked werden auf https://github.com/settings/tokens und ein neuer erstellt werden, falls noch benötigt.

---

## 3. Relevante Commits (chronologisch absteigend)

| Commit | Beschreibung |
|---|---|
| `c47f04f` | fix(api): correct lib import paths, await cookies(), handle optional propertyType |
| `3f4f5a2` | docs: archive deployment, voicebot, and session notes |
| `a27dfbd` | **fix(searches): add email to getAllActiveSearches return type** ← der entscheidende Build-Fix |
| `07f8177` | fix(livingmatch): fix aggregator crashing when N8N unavailable |
| `417a403` | fix(livingmatch): sync package-lock.json with package.json |
| `e2ae458` | feat(alerts): saved searches, cron-alerts, skeleton UI |
| `fb92ecb` | feat(auth): postgres auth system, admin panel, search fixes |
| `b1d80ab` | feat(pro): broker mode + equity yield calculator + regional newspaper scraper |
| `61d73a5` | fix(ui): comma parsing/formatting in space & rooms UI |
| `92af253` | fix(fallback): immonet deep link + placeholder gallery (Cloudflare bypass) |

---

## 4. Infrastruktur

### Server
- **Server 1:** `94.130.170.167` (alle Services via Coolify)
- **Server 2:** `46.224.54.65` (Ollama LLMs)
- **Coolify-Host neu:** `EPPCOM-LLM` (intern `10.0.0.3`, via Coolify-Proxy)

### Live-Services
- Admin UI: https://appdb.eppcom.de
- Voice Widget: https://appdb.eppcom.de/voice-widget
- Workflows: https://workflows.eppcom.de

### Container (Server 1)
- `eppcom-admin-ui` (FastAPI, Port 8080) — **NICHT in Coolify**, manuell rebuilden
- `voice-agent` (livekit_default network)
- `livekit-server` (`wss://appdb.eppcom.de/lk`)
- `postgres-rag` (`app_db`)

### Voicebot Stack (Referenz)
- STT: Whisper small, INT8, CPU
- LLM: `qwen3-voice:latest` (Ollama, `46.224.54.65:11434`)
- TTS: Cartesia Sonic-2, Voice Alina (`38aabb6a-...`)
- RAG: `https://workflows.eppcom.de/webhook/rag-query`

---

## 5. Nächste Schritte für die Weiterarbeit

### Priorität 1 — Deploy verifizieren
1. Im Coolify-Dashboard prüfen, ob der letzte Build mit Commit `a27dfbd` oder neuer (`c47f04f`) erfolgreich durchläuft.
2. Falls Coolify weiterhin alten Code zieht: Webhook/Auto-Deploy-Verbindung prüfen.

### Priorität 2 — Mac-Repo synchronisieren
Damit lokale Änderungen vom Mac wieder pushbar sind:
```bash
cd /Users/marceleppler/Desktop/business/projects/antigravProject
git remote set-url origin git@github.com:EPPCOM-Solutions/immoapp.git
git pull --rebase origin main
git push
```

### Priorität 3 — Offene Tasks aus CLAUDE.md
- [ ] Voicebot Latenz optimieren
- [ ] Homepage Widgets (Typebot + Voicebot) aktivieren
- [ ] LivingMatch Coolify Deploy abschließend verifizieren
- [ ] SMTP-Passwort testen (Passwort-Reset-Flow)

---

## 6. Wichtige Regeln (aus CLAUDE.md)

- **Niemals Secrets committen** — `.env` ist gitignored
- **Nach jeder Aufgabe committen + pushen**
- Docker-Befehle laufen auf Server 1
- `eppcom-admin-ui` ist **nicht** in Coolify — manuell rebuilden
- Diese Next.js-Version weicht vom Standard ab → vor Code-Änderungen Docs in `node_modules/next/dist/docs/` lesen

---

## 7. Quellen dieser Übergabe

- `/home/coder/eppcom/app/app-status.md` (vorhandene Status-Doku)
- `/home/coder/eppcom/CLAUDE.md` (Projekt-Kontext)
- `/home/coder/eppcom/app/AGENTS.md` (Next.js-Hinweise)
- `git log` auf `main` im Code-Server-Repo
