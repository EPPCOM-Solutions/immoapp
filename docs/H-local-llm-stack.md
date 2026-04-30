# H — Local LLM Stack (M4 Pro) + Knowledge Layer

**Stand:** 2026-04-30
**Zweck:** Komplette Anleitung für lokales LLM-Setup auf MacBook M4 Pro (48GB, 4TB ext. SSD), exponiert via Cloudflare Tunnel an code-server. Inkl. LLM-Router, Karpathy-inspirierter Obsidian-Wissensbasis, Kosten-Guardrails, Stabilität.

---

## 0. TL;DR

```
┌────────────────────┐   ┌──────────────────────────────────────────┐
│  code-server       │   │  MacBook M4 Pro (48GB, 4TB ext SSD)      │
│  (eppcom)          │   │                                          │
│                    │   │   ┌──────────────┐                       │
│   Cline ─────────────────► │  LiteLLM     │ ─┬─► Ollama (local)   │
│   Obsidian (sync) ─┼──┐│   │  (Router)    │  │   - GLM-4.7-Flash  │
│                    │  ││   │  :4000       │  │   - Qwen3-Coder-7B │
└────────────────────┘  ││   └──────┬───────┘  │   - nomic-embed    │
                        ││          │          │                    │
                        ││          ├──► z.ai Cloud API (GLM-4.7)   │
                        ││          └──► OpenRouter (GLM-5, fallback)│
                        ││                                          │
                        ││   Cloudflare Tunnel: mac-llm.eppcom.de   │
                        │└──────────────────────────────────────────┘
                        │
                        └─► Obsidian Vault (Git-synced) ──► Smart Connections (Ollama embed)
```

**Kosten-Ziel:** ~$5–15/Monat (z.ai $3-Plan + gelegentlich OpenRouter für GLM-5)
**Latenz-Ziel:** Local <500ms TTFT, Cloud <1.5s
**Verfügbarkeit:** 99% solange Mac wach ist (caffeinate während Arbeit)

---

## 1. Architektur-Entscheidungen

| Layer | Wahl | Warum |
|---|---|---|
| Local Runtime | **Ollama** (+ optional LM Studio MLX) | Einfachste Service-Integration, OpenAI-kompatibel |
| Modell-Storage | **Externe 4TB SSD** (APFS, Volume `LLM4TB`) | 512GB intern reichen nicht, Modelle ~50GB+ |
| Coder-Modell (lokal) | **GLM-4.7-Flash 30B-A3B** Q4_K_M (~17GB) | Nur 3B aktiv → schnell, neueste Generation, Familie-konsistent zum Architect |
| Schnell-Backup (lokal) | **Qwen3-Coder-7B** (~5GB) | Tunnel-frei nutzbar bei Connectivity-Problemen, Trivial-Edits |
| Embedding (lokal) | **nomic-embed-text** (~270MB) | Für Smart Connections / Obsidian RAG |
| Architect-Modell (Cloud) | **GLM-4.7 Standard** via z.ai | $0.60/M In, niedrigvolumig im Plan-Mode |
| Power-Up (Cloud) | **GLM-5** via OpenRouter | Pay-per-use, nur seltene Hardcore-Architektur |
| Router | **LiteLLM Proxy** | Einheitliche API, Fallbacks, Cost-Tracking, Logging |
| Tunnel | **Cloudflare Named Tunnel** über `eppcom.de` | Persistent, kostenlos, Zero-Trust-fähig |
| Frontend (code-server) | **Cline** | Plan/Act-Split, Multi-Profile-Support |
| Knowledge | **Obsidian** (Git-synced, Smart Connections + Ollama) | Karpathy-inspiriert, Markdown-nativ, lokal |

**Entscheidung gegen GLM-4.5-Air / Qwen3-Coder-32B:** GLM-4.7-Flash ist neuer, schneller (3B aktiv), kleiner (17GB statt 30GB+20GB), und teilt Konventionen mit dem Cloud-Architect.

**Entscheidung gegen reines Cline-Multi-Profile ohne LiteLLM:** LiteLLM bringt Cost-Dashboard, Provider-Fallbacks und ein einheitliches Log — bei drei Providern und Budget-Bewusstsein lohnt sich der Layer.

---

## 2. Kosten-Überblick (monatlich)

| Posten | Erwartung | Notiz |
|---|---|---|
| z.ai Plan oder Pay-per-Token | $3–8 | $3-Plan deckt typische Plan-Mode-Nutzung ab |
| OpenRouter (GLM-5) | $0–5 | Nur bei seltener Eskalation, ~$0.30 pro Architektur-Plan |
| Cloudflare Tunnel | $0 | Free-Tier reicht |
| Strom Mac (24/7 wach) | ~€8–12 | Idle ~5W, unter Last ~60W |
| Internet-Traffic | ~0 | Tunnel-Traffic minimal |
| **Summe** | **~€15–25/Monat** | vs. Claude Pro $20 + Opus-API ~$100+ |

**Break-Even** vs. reine Cloud-Nutzung: nach ~1 Stunde Coding-Session pro Tag.

---

## 3. Phase 0 — Externe SSD vorbereiten

```bash
# Mac, Festplattendienstprogramm
open /System/Applications/Utilities/Disk\ Utility.app
```

GUI:
1. 4TB-SSD wählen → **Löschen**
2. Format: **APFS**
3. Schema: **GUID Partition Map**
4. Name: **`LLM4TB`** (genau so)

```bash
# Verifizieren
ls /Volumes/LLM4TB && diskutil info /Volumes/LLM4TB | grep "File System"

# Performance-Check (Ziel: >1500 MB/s über TB4/5)
dd if=/dev/zero of=/Volumes/LLM4TB/test.bin bs=1m count=2000 && rm /Volumes/LLM4TB/test.bin

# Ordnerstruktur
mkdir -p /Volumes/LLM4TB/{ollama,lmstudio,obsidian-vault,backups}
```

**Auto-Mount-Tipp:** Externe SSDs werden bei macOS-Login automatisch gemountet, solange sie angeschlossen sind. Falls die SSD im Standby getrennt wurde → Stromsparmodus prüfen (System Settings → Energy → Disable "Put hard disks to sleep").

---

## 4. Phase 1 — Software-Stack installieren

```bash
# Homebrew (falls nicht vorhanden)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Core
brew install ollama cloudflared
brew install --cask lm-studio          # GUI-Backup, MLX-Backend (~30% schneller)
brew install --cask obsidian
brew install python@3.12 git           # falls noch nicht da

# LiteLLM Proxy
pipx install 'litellm[proxy]'          # pipx isoliert, sauberer als pip global
# falls pipx fehlt: brew install pipx && pipx ensurepath
```

### Ollama-Konfiguration (Modelle auf externe SSD, externe Erreichbarkeit)

```bash
# Persistente Env-Vars für Ollama-Service
launchctl setenv OLLAMA_MODELS /Volumes/LLM4TB/ollama
launchctl setenv OLLAMA_HOST 127.0.0.1:11434     # nur lokal — LiteLLM exposed extern
launchctl setenv OLLAMA_KEEP_ALIVE 30m            # entlädt Modelle nach 30min Idle (RAM frei)
launchctl setenv OLLAMA_MAX_LOADED_MODELS 2       # max 2 Modelle gleichzeitig im RAM

# Auch nach Reboot
cat >> ~/.zshrc <<'EOF'
export OLLAMA_MODELS=/Volumes/LLM4TB/ollama
export OLLAMA_HOST=127.0.0.1:11434
export OLLAMA_KEEP_ALIVE=30m
export OLLAMA_MAX_LOADED_MODELS=2
EOF

brew services start ollama
sleep 2 && curl http://localhost:11434/api/tags
```

> **Wichtig:** `OLLAMA_HOST` bewusst auf `127.0.0.1` — der LiteLLM-Proxy davor übernimmt die externe Exposition. Damit haben wir Logging + Auth + Routing als zentrale Schicht.

---

## 5. Phase 2 — Modelle ziehen

**Vor dem Pull:** Modellnamen auf https://ollama.com/library prüfen — Slugs ändern sich. Falls in Ollama-Library nicht vorhanden, via LM Studio + bartowski-GGUF importieren.

```bash
# Hauptcoder
ollama pull glm-4.7-flash             # ggf. exakter Tag z.B. glm-4.7-flash:30b-a3b-q4_K_M

# Backup für Trivia ohne Tunnel
ollama pull qwen3-coder:7b

# Embeddings für Obsidian Smart Connections
ollama pull nomic-embed-text

# Test
ollama run glm-4.7-flash "Schreib eine TS-Funktion: parse ISO-8601 Date robust"
# /bye

# Speicher-Check
du -sh /Volumes/LLM4TB/ollama
```

**Falls `glm-4.7-flash` nicht in Ollama-Library existiert:**

```bash
# LM Studio öffnen → Search → "bartowski GLM-4.7-Flash"
# Variante Q4_K_M laden
# Settings → Storage → Models Directory: /Volumes/LLM4TB/lmstudio
# Developer → Start Server (Port 1234, OpenAI-compatible)
# In LiteLLM-Config dann lm-studio statt ollama als Backend für glm-4.7-flash eintragen
```

---

## 6. Phase 3 — LiteLLM Router konfigurieren

LiteLLM ist die **eine API** vor allen Backends. Cline spricht nur mit LiteLLM, der entscheidet je nach Modell-Name wohin.

```bash
mkdir -p ~/.litellm
```

Config `~/.litellm/config.yaml`:

```yaml
model_list:
  # === Cloud: Architect ===
  - model_name: architect
    litellm_params:
      model: openai/glm-4.7
      api_base: https://api.z.ai/api/paas/v4
      api_key: os.environ/ZAI_API_KEY

  # === Local: Coder ===
  - model_name: coder
    litellm_params:
      model: ollama/glm-4.7-flash
      api_base: http://localhost:11434

  # === Local: Fast ===
  - model_name: fast
    litellm_params:
      model: ollama/qwen3-coder:7b
      api_base: http://localhost:11434

  # === Cloud: Power-Up ===
  - model_name: power
    litellm_params:
      model: openrouter/z-ai/glm-5
      api_key: os.environ/OPENROUTER_API_KEY

  # === Embeddings für Obsidian ===
  - model_name: embed
    litellm_params:
      model: ollama/nomic-embed-text
      api_base: http://localhost:11434

# Fallback-Kette: falls coder lokal down → architect (Cloud)
router_settings:
  fallbacks:
    - coder: [architect]
    - architect: [power]

# Cost-Tracking + Logs
litellm_settings:
  drop_params: true
  set_verbose: false
  success_callback: ["langfuse"]   # optional, weglassen wenn kein Langfuse

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY   # Auth-Token für eingehende Requests
  database_url: sqlite:////Volumes/LLM4TB/litellm/litellm.db   # Cost-Tracking
  budget_duration: 30d
  max_budget: 20.0   # USD/Monat hard cap
```

```bash
# Secrets in ~/.zshrc (NICHT committen)
cat >> ~/.zshrc <<'EOF'
export ZAI_API_KEY="sk-zai-..."          # von chat.z.ai → API Keys
export OPENROUTER_API_KEY="sk-or-..."    # von openrouter.ai/keys
export LITELLM_MASTER_KEY="sk-eppcom-$(openssl rand -hex 16)"   # einmalig generieren, dann fix
EOF
source ~/.zshrc

mkdir -p /Volumes/LLM4TB/litellm

# LiteLLM als launchd-Service
cat > ~/Library/LaunchAgents/com.eppcom.litellm.plist <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.eppcom.litellm</string>
  <key>ProgramArguments</key>
  <array>
    <string>/Users/$(whoami)/.local/bin/litellm</string>
    <string>--config</string><string>/Users/$(whoami)/.litellm/config.yaml</string>
    <string>--port</string><string>4000</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>ZAI_API_KEY</key><string>\${ZAI_API_KEY}</string>
    <key>OPENROUTER_API_KEY</key><string>\${OPENROUTER_API_KEY}</string>
    <key>LITELLM_MASTER_KEY</key><string>\${LITELLM_MASTER_KEY}</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/Volumes/LLM4TB/litellm/stdout.log</string>
  <key>StandardErrorPath</key><string>/Volumes/LLM4TB/litellm/stderr.log</string>
</dict>
</plist>
EOF

launchctl load ~/Library/LaunchAgents/com.eppcom.litellm.plist
sleep 3 && curl -H "Authorization: Bearer $LITELLM_MASTER_KEY" http://localhost:4000/health
```

> **Modell-Selektion-Logik:** Cline wählt das Modell-Profil (`architect` / `coder` / `fast` / `power`). Optional kann LiteLLM auch automatisch routen via Tag-basiertes Routing — für unseren Use-Case ist explizite Auswahl per Cline-Profil aber transparenter und vorhersagbarer.

---

## 7. Phase 4 — Cloudflare Tunnel auf LiteLLM

```bash
cloudflared tunnel login                        # Browser, eppcom.de auswählen
cloudflared tunnel create mac-llm
cloudflared tunnel route dns mac-llm mac-llm.eppcom.de

# Config
cat > ~/.cloudflared/config.yml <<EOF
tunnel: mac-llm
credentials-file: /Users/$(whoami)/.cloudflared/$(ls ~/.cloudflared/*.json | head -1 | xargs basename)

ingress:
  - hostname: mac-llm.eppcom.de
    service: http://localhost:4000               # LiteLLM, nicht Ollama direkt
    originRequest:
      connectTimeout: 30s
      noTLSVerify: true
  - service: http_status:404
EOF

sudo cloudflared service install
brew services start cloudflared

# Test (DNS kann 30-60s brauchen)
curl -H "Authorization: Bearer $LITELLM_MASTER_KEY" https://mac-llm.eppcom.de/health
```

**Sicherheit obligatorisch:** LiteLLM-`master_key` ist die Auth. Ohne Header bekommt jeder Web-Crawler 401. Optional zusätzlich Cloudflare Access (Zero Trust → Application → Email-Policy `marcel.e@gmx.de`).

---

## 8. Phase 5 — Cline auf code-server konfigurieren

In code-server (Browser):
1. Extensions → Cline (saoudrizwan) → Install
2. Cline-Icon → ⚙️ Settings → **API Configuration Profiles**

Drei Profile, alle gegen LiteLLM:

| Profil | Provider | Base URL | API Key | Model ID |
|---|---|---|---|---|
| `architect` | OpenAI Compatible | `https://mac-llm.eppcom.de` | `<LITELLM_MASTER_KEY>` | `architect` |
| `coder` | OpenAI Compatible | `https://mac-llm.eppcom.de` | `<LITELLM_MASTER_KEY>` | `coder` |
| `power` | OpenAI Compatible | `https://mac-llm.eppcom.de` | `<LITELLM_MASTER_KEY>` | `power` |

**Plan/Act-Split aktivieren:**
- Plan Model: `architect`
- Act Model: `coder`
- Power-Up nur manuell wechseln bei Greenfield-Architektur

Test im Cline-Chat:
```
Plan-Mode: Lies app/src/lib/db.ts und entwirf einen Migration-Helper.
```
Du solltest sehen: erst Plan vom Cloud-GLM-4.7, dann Umsetzung vom Local-Flash.

---

## 9. Phase 6 — Obsidian (Karpathy-inspiriert)

> **Disclaimer:** Karpathy hat seinen Workflow nie vollständig dokumentiert. Was folgt ist eine Synthese aus seinen öffentlichen Aussagen + Best Practices der LLM+PKM-Community. Anpassen wie es für dich funktioniert.

### Vault-Setup

```bash
# Vault auf interner SSD (Performance + iCloud-Sync möglich), Backup auf 4TB-SSD
mkdir -p ~/Documents/Obsidian/EppcomVault/{daily,projects,notes,refs,inbox}
cd ~/Documents/Obsidian/EppcomVault

# Git für Versionierung (Karpathy-Prinzip: append-only + Versionsgeschichte)
git init
cat > .gitignore <<'EOF'
.obsidian/workspace*
.obsidian/cache
.trash/
.DS_Store
EOF
git add .gitignore && git commit -m "init vault"

# Optional: privates GitHub-Repo als Remote
# gh repo create eppcom-vault --private --source=. --push
```

In Obsidian → Open → Folder → `~/Documents/Obsidian/EppcomVault`.

### Plugins installieren

Settings → Community Plugins → Browse:

| Plugin | Zweck |
|---|---|
| **Smart Connections** | Semantische Suche + Chat über deinen Vault, Ollama-kompatibel |
| **Copilot** (logan-marie) | Inline LLM-Chat, OpenAI-kompatibel → LiteLLM |
| **Templater** | Tägliche Notiz-Templates |
| **Daily Notes** (Core) | Tagesstruktur |
| **Obsidian Git** | Auto-Commit alle X Minuten |
| **Dataview** | Strukturierte Queries über Notes |

### Smart Connections konfigurieren (lokales Embedding)

Settings → Smart Connections:
- **Embedding Model:** Custom / Local
- **API Base:** `http://localhost:11434/v1` (lokal direkt, nicht über Tunnel)
- **Model:** `nomic-embed-text`
- **Chat Model API:** `https://mac-llm.eppcom.de/v1`
- **Chat Model:** `coder`
- **API Key:** `<LITELLM_MASTER_KEY>`

→ "Refresh Embeddings" — indexiert dein Vault.

### Copilot konfigurieren

Settings → Copilot:
- Provider: **OpenAI-Compatible**
- Base URL: `https://mac-llm.eppcom.de/v1`
- API Key: `<LITELLM_MASTER_KEY>`
- Default Model: `coder`
- Long Context Model: `architect`

### Daily-Notes-Template (Karpathy-Style)

`~/Documents/Obsidian/EppcomVault/templates/daily.md`:
```markdown
# {{date:YYYY-MM-DD}} ({{date:dddd}})

## 🎯 Today
- [ ]

## 📝 Log
<!-- timestamp + 1-2 Sätze, append-only -->

## 🧠 Ideas / Open Questions

## 🔗 Touched
<!-- Links zu Files/PRs/Tickets -->

## 🪞 Daily Distill
<!-- am Abend: Was habe ich gelernt? Was wiederverwendbar? -->
```

Settings → Templates → Folder: `templates`, Daily Notes Template: `daily`

### Karpathy-inspirierte Workflow-Prinzipien

1. **Capture-First:** Jeder Gedanke landet sofort in `inbox/` als kurze MD-Note (Hotkey-Plugin: `Cmd+Shift+N`). Strukturieren später.
2. **Append-Only Daily Log:** Keine Edits in alten Daily-Notes — neue Erkenntnisse als neue Note mit Backlink.
3. **Liberales Linken:** `[[Coolify Horizon Bug]]`, `[[GLM-4.7-Flash]]`, `[[LivingMatch RAG]]` — Smart Connections ergänzt automatische Bezüge.
4. **Distill am Tagesende:** 5 Minuten — was war wiederverwendbar? In `notes/` oder `projects/` sauber rausziehen.
5. **LLM als Zweitleser:** Wöchentlich Smart-Connections-Chat fragen "Was sind wiederkehrende Themen der letzten 7 Tage?"
6. **Markdown ist die Wahrheit:** Keine Lock-in-Plugins-Daten. Alles bleibt in Plain MD + Git.

### EPPCOM-Erstbefüllung

```bash
cd ~/Documents/Obsidian/EppcomVault
mkdir -p projects/livingmatch projects/voicebot projects/coolify refs

# Bestehende Projekt-Docs reinziehen
cp /home/coder/eppcom/CLAUDE.md refs/CLAUDE-snapshot.md   # via SSH/scp vom code-server
cp /home/coder/eppcom/app/appdevelompent*.md projects/livingmatch/
cp /home/coder/eppcom/docs/*.md refs/

git add . && git commit -m "seed vault from eppcom repo"
```

Smart Connections nochmal "Refresh" → du kannst jetzt z.B. fragen:
*"Welche Coolify-Bugs sind dokumentiert?"* → Synthese aus Snapshots + Daily-Notes.

---

## 10. Phase 7 — Stabilität

### Caffeinate während Coding

```bash
# Wenn du remote von code-server arbeitest, Mac wach halten
caffeinate -dimsu &
# Strg+C beendet (oder pkill caffeinate)
```

Optional als Hotkey via Raycast/Alfred. **Nicht 24/7 laufen lassen** — Strom + Modell-Wear.

### Healthcheck-Cron auf code-server

`/home/coder/bin/check-mac-llm.sh`:
```bash
#!/bin/bash
URL="https://mac-llm.eppcom.de/health"
KEY="$LITELLM_MASTER_KEY"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $KEY" "$URL")
if [ "$HTTP" != "200" ]; then
  echo "$(date -Iseconds) mac-llm DOWN (HTTP $HTTP)" >> ~/mac-llm-health.log
  # optional: ntfy-Push o.ä.
fi
```
```bash
chmod +x /home/coder/bin/check-mac-llm.sh
( crontab -l 2>/dev/null; echo "*/5 * * * * /home/coder/bin/check-mac-llm.sh" ) | crontab -
```

### Backup-Strategie

```bash
# Wöchentlich: Vault auf 4TB-SSD spiegeln
echo "0 3 * * 0 rsync -a --delete ~/Documents/Obsidian/EppcomVault/ /Volumes/LLM4TB/backups/vault/" | crontab -

# LiteLLM-DB (Cost-History) ist eh schon auf /Volumes/LLM4TB/litellm/litellm.db
```

### Service-Übersicht

```bash
# Ein Befehl, alle relevanten Services prüfen
cat > ~/bin/llm-status.sh <<'EOF'
#!/bin/bash
echo "=== Ollama ==="
brew services list | grep ollama
curl -s http://localhost:11434/api/tags | jq '.models[].name'
echo "=== LiteLLM ==="
launchctl list | grep eppcom.litellm
curl -sf http://localhost:4000/health > /dev/null && echo "OK" || echo "FAIL"
echo "=== Cloudflared ==="
brew services list | grep cloudflared
echo "=== Tunnel ==="
curl -sf -H "Authorization: Bearer $LITELLM_MASTER_KEY" https://mac-llm.eppcom.de/health > /dev/null && echo "OK" || echo "FAIL"
EOF
chmod +x ~/bin/llm-status.sh
```

---

## 11. Phase 8 — Kosten-Guardrails

### z.ai
- chat.z.ai → Console → Billing → Hard Cap setzen ($10/Monat)
- Email-Alert bei 80%

### OpenRouter
- openrouter.ai → Settings → Limits → Monthly limit $5
- "Disable on limit" aktivieren

### LiteLLM-Tracking
```bash
# Aktuelle Kosten dieses Monats
curl -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  http://localhost:4000/spend/logs | jq '.[].spend' | paste -sd+ | bc
```

LiteLLM-UI (optional, schicker): `litellm-ui` Container starten oder Web-Endpoint `:4000/ui` aktivieren.

### Eskalations-Heuristik (wann GLM-5?)

**Power-Profil aktivieren NUR bei:**
- Komplettes neues App-Modul (>5 Dateien, eigene Domain) greenfield
- Cross-System-Architektur (z.B. RAG-Pipeline-Redesign mit Vector-DB-Wechsel)
- Wenn `architect` (GLM-4.7) nach 2 Plan-Iterationen keinen sauberen Plan liefert

**NICHT für:** Coolify-Debugging, Migration in `db.ts`, n8n-Workflow-Edit, Bug-Fixes, Refactors innerhalb einer Datei → das macht `coder` lokal.

---

## 12. Konkrete Workflows

### Workflow A: Coding-Task (Standard)
1. code-server, Cline öffnen
2. Plan-Mode aktiv (`architect` läuft im Cloud)
3. Prompt: "Plan mir einen Rate-Limiter für LivingMatch-Login (max 5/min/IP)"
4. Plan-Output reviewen, Cline → Switch to Act
5. `coder` (Local-Flash) implementiert, du reviewst Diffs

### Workflow B: Knowledge-Capture
1. Idee taucht auf → Obsidian Cmd+Shift+N → in `inbox/`
2. Abends: Daily-Note öffnen, Distill-Sektion füllen
3. Wenn relevant für Projekt → Note nach `projects/livingmatch/` ziehen, taggen
4. Smart-Connections-Chat: "Fasse meine letzten 5 Tage zu LivingMatch zusammen"

### Workflow C: Architektur-Eskalation (GLM-5)
1. Problem zu groß für `architect` (z.B. "Refactor RAG komplett auf pgvector + Hybrid-Search")
2. Cline → Switch Plan-Profil zu `power`
3. Sehr ausführlicher Prompt mit Constraints (RAM, $, Latenz)
4. Plan reviewen → in Obsidian unter `projects/.../decisions/` ablegen
5. Zurück auf `architect` für Detail-Planung der Subtasks
6. `coder` für Umsetzung

### Workflow D: Vault-RAG (Karpathy-Style Recall)
1. "Wie hatte ich das Coolify-Horizon-Problem gelöst?"
2. Smart-Connections-Chat in Obsidian
3. Antwort mit Backlinks zu den Original-Notes
4. Wenn neue Erkenntnis → in `refs/coolify-bugs.md` konsolidieren

---

## 13. Wartungs-Plan

| Frequenz | Task |
|---|---|
| Täglich (auto) | Obsidian Git Auto-Commit (alle 30min wenn Changes) |
| Wöchentlich | `~/bin/llm-status.sh` checken, Vault-Backup verifizieren |
| Wöchentlich | Cost-Report: `curl .../spend/logs` anschauen |
| Monatlich | `ollama list` aufräumen, ungenutzte Modelle löschen |
| Monatlich | LiteLLM-Logs unter `/Volumes/LLM4TB/litellm/*.log` rotieren |
| Quartal | Modell-Updates: neuer GLM-Release? `ollama pull glm-X.Y-flash` |
| Quartal | Cloudflare-Tunnel-Credentials rotieren |

---

## 14. Troubleshooting

| Symptom | Ursache | Fix |
|---|---|---|
| `ollama list` leer nach Reboot | SSD nicht gemountet | `diskutil mount /Volumes/LLM4TB && brew services restart ollama` |
| Cline 401 | LITELLM_MASTER_KEY falsch in Cline | In code-server Cline-Settings neu eintragen |
| Cline Timeout | Erstes Modell-Loading 30-60s | Cline → Request Timeout 120s |
| `mac-llm.eppcom.de` nicht erreichbar | Tunnel down | `brew services restart cloudflared` + DNS prüfen mit `dig mac-llm.eppcom.de` |
| Mac überhitzt / langsam | RAM voll mit 2 Modellen | `OLLAMA_MAX_LOADED_MODELS=1` setzen, Service neu |
| Smart Connections findet nichts | Embeddings nicht generiert | Refresh-Button, Logs in `.smart-connections/` prüfen |
| z.ai 429 / Rate Limit | Plan-Limit erreicht | LiteLLM-Fallback greift → `architect → power` automatisch (kostet aber!) |
| Hohe Kosten unerwartet | Loop in Cline (selten) | LiteLLM-Logs `/spend/logs` prüfen, Budget-Cap rettet bei $20 |

---

## 15. Master-Checkliste

### Hardware/SSD
- [ ] 4TB SSD APFS-formatiert als `LLM4TB`
- [ ] Ordnerstruktur `/Volumes/LLM4TB/{ollama,lmstudio,obsidian-vault,backups,litellm}` angelegt
- [ ] Energiesparmodus für externe Disks deaktiviert

### Local Stack
- [ ] Homebrew, Ollama, cloudflared, LM Studio, Obsidian, LiteLLM installiert
- [ ] Ollama-Env-Vars in `~/.zshrc` UND via `launchctl`
- [ ] Modelle: `glm-4.7-flash`, `qwen3-coder:7b`, `nomic-embed-text` gepullt
- [ ] LiteLLM-Config unter `~/.litellm/config.yaml`
- [ ] Secrets (ZAI/OpenRouter/LiteLLM-Master) in `~/.zshrc`, NICHT committed
- [ ] LiteLLM als launchd-Service läuft (`launchctl list | grep eppcom`)

### Tunnel
- [ ] `cloudflared tunnel login` durchgeführt
- [ ] `mac-llm` Tunnel + DNS-Route für `mac-llm.eppcom.de`
- [ ] `~/.cloudflared/config.yml` zeigt auf Port **4000** (LiteLLM, nicht Ollama)
- [ ] Tunnel als brew-Service läuft
- [ ] `curl -H "Authorization: ..." https://mac-llm.eppcom.de/health` = 200

### code-server / Cline
- [ ] Cline-Extension installiert
- [ ] Drei Profile (`architect`, `coder`, `power`) konfiguriert
- [ ] Plan/Act-Split: Plan=`architect`, Act=`coder`
- [ ] Test-Prompt erfolgreich

### Obsidian
- [ ] Vault unter `~/Documents/Obsidian/EppcomVault`
- [ ] Plugins: Smart Connections, Copilot, Templater, Daily Notes, Git, Dataview
- [ ] Smart Connections mit `nomic-embed-text` + `coder` für Chat
- [ ] Copilot mit LiteLLM-URL + `coder` Default
- [ ] Daily-Notes-Template aktiv
- [ ] Vault als Git-Repo (optional Remote)
- [ ] EPPCOM-Docs einmalig in `refs/` gespiegelt

### Stabilität + Kosten
- [ ] `~/bin/llm-status.sh` + `check-mac-llm.sh` Cron auf code-server
- [ ] Vault-Backup-Cron auf 4TB
- [ ] z.ai Hard Cap $10/Monat
- [ ] OpenRouter Limit $5/Monat
- [ ] LiteLLM `max_budget: 20.0` aktiv

---

## 16. Anhang: Befehl-Cheat-Sheet

```bash
# Status
~/bin/llm-status.sh

# Modelle ansehen
ollama list
ollama ps                                       # was ist grad geladen

# Modell-Reload
ollama stop glm-4.7-flash && ollama run glm-4.7-flash "hi"

# LiteLLM-Logs
tail -f /Volumes/LLM4TB/litellm/stderr.log

# Cost diesen Monat
curl -s -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  http://localhost:4000/spend/logs | jq '[.[].spend] | add'

# Tunnel-Restart
brew services restart cloudflared

# Vault-Sync (manuell)
cd ~/Documents/Obsidian/EppcomVault && git add . && git commit -m "sync $(date -Iseconds)" && git push
```

---

**Pflege dieser Datei:** Bei Änderungen am Stack (neue Modelle, Konfig-Drift, Workflow-Anpassungen) hier nachziehen. Diese Datei ist die Source-of-Truth — Memory-Einträge in `~/.claude/projects/-home-coder-eppcom/memory/project_local_llm_mac.md` referenzieren sie.
