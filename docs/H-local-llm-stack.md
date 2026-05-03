# H — Local LLM Stack (M4 Pro) + Hetzner-Router + DSGVO-Compliance

**Stand:** 2026-05-02 (Architektur-Pivot v2: LiteLLM nach Hetzner, DSGVO-Two-Path-Routing)
**Zweck:** Komplette Anleitung für hybriden LLM-Stack mit:
- **DSGVO-Pfad** für sensible Kundendaten (Ärzte, Anwälte, Steuerberater) — ausschließlich Mac-Ollama, kein Cloud-Fallback
- **Public-Pfad** für unsensible Workloads + eigene Coding-Arbeit — Mac primary, Cloud-Fallback erlaubt
- LiteLLM-Router auf Hetzner workflows-CX33 (24/7), Mac als bevorzugtes Backend
- Karpathy-inspirierte Obsidian-Wissensbasis lokal auf Mac
- Voicebot/Chatbot-Orchestrierung + Tenant-RAG mit Compliance-Routing

---

## 0. TL;DR

```
                          ┌────────────────────────────────────────────────┐
                          │ Hetzner workflows-CX33 (94.130.170.167) 24/7   │
                          │                                                │
                          │   Coolify ──► n8n / Typebot / Postgres / RAG   │
 ┌───────────────────┐    │                                                │
 │ code-server       │ ──►│   ★ LiteLLM-Router :4000  ──► litellm.eppcom.de│
 │ (Cline)           │    │     │                                          │
 └───────────────────┘    │     ├─ Pfad A: SENSITIVE (DSGVO)               │
                          │     │   ├─ Primary: Mac-Ollama (mandatory)     │
 ┌───────────────────┐    │     │   ├─ NO cloud fallback                   │
 │ Voicebot /        │ ──►│     │   └─ Mac off → 503 (System OFF policy)   │
 │ Chatbot Tenants   │    │     │                                          │
 │ (eppcom services) │    │     └─ Pfad B: PUBLIC (own coding, demos)      │
 └───────────────────┘    │         ├─ Primary: Mac-Ollama                 │
                          │         ├─ Fallback 1: z.ai GLM-4.7            │
                          │         └─ Fallback 2: OpenRouter (GLM-5/DS)   │
                          │                                                │
                          └─────────────▲──────────────────────────────────┘
                                        │ Cloudflare Tunnel
                                        │ mac-ollama.eppcom.de (only Ollama)
 ┌─────────────────────────────────────┴─────────────────────────┐
 │  MacBook M4 Pro (48GB, ext. SSD /Volumes/LLM)                 │
 │                                                               │
 │   Ollama :11434 (exponiert via Tunnel, NUR diese Komponente)  │
 │     - GLM-4.7-Flash 30B-A3B  (Coder)                          │
 │     - qwen3.6:27b / 35b-a3b  (Voicebot/RAG)                   │
 │     - gemma4:31b              (Alternative)                   │
 │     - nomic-embed-text        (Embeddings)                    │
 │                                                               │
 │   Obsidian Vault (Git-synced) ─► Smart Connections (lokal)    │
 └───────────────────────────────────────────────────────────────┘
```

**DSGVO-Kernregel:** Sensitive Workloads bekommen NIEMALS automatischen Cloud-Fallback. Wenn Mac off → bewusste 503-Antwort, nicht stilles Routing in PRC/US-Cloud.

**Kosten-Ziel:** ~€16–22/Monat (LiteLLM auf bestehendem Hetzner = €0 marginal, EPPCOM-LLM-Server kündigen spart €5–7)
**Latenz-Ziel:** Mac-Ollama via Tunnel <800ms TTFT, Cloud <1.5s, Tunnel-Hop-Cost ~50–150ms
**Verfügbarkeit:** Public-Pfad 99% (Cloud-Fallback), Sensitive-Pfad = Mac-Verfügbarkeit (bewusst gewählt)

---

## 1. Architektur-Entscheidungen

| Layer | Wahl | Warum |
|---|---|---|
| Local Runtime | **Ollama** auf Mac M4 Pro | Apple-Silicon-optimiert, OpenAI-kompatibel, einfache Service-Integration |
| Modell-Storage | **Externe 4TB SSD** (APFS, Volume `LLM`) | 512GB intern reichen nicht, Modelle ~75GB |
| Tenant/Voicebot (lokal, DSGVO) | **qwen3.6:27b** Q4_K_M (~17GB) | Solide Sprachqualität, schnell genug für Voicebot, rein lokal |
| Tenant/RAG (lokal, DSGVO) | **qwen3.6:35b-a3b** (~24GB MoE, 3B aktiv) | Höhere RAG-Synthese-Qualität für Recht/Med/Steuer, MoE-fast |
| Coder-Modell (lokal, eigene Arbeit) | **GLM-4.7-Flash 30B-A3B** (~17GB) | 3B aktiv → schnell, Familie-konsistent zu z.ai-Architect |
| Alternative (lokal) | **gemma4:31b** | Backup wenn qwen-Output schwächelt |
| Embedding (lokal) | **nomic-embed-text** (~270MB) | Smart Connections, Obsidian-RAG, Tenant-RAG |
| **Router** | **LiteLLM auf Hetzner workflows-CX33** (Coolify-Container) | 24/7 erreichbar auch wenn Mac off, getrennte sensitive/public-Pfade |
| Tunnel | **Cloudflare Tunnel `mac-ollama.eppcom.de`** Mac → Hetzner | Mac exponiert NUR Ollama, nicht den Router-Layer |
| Architect-Cloud (public/coding only) | **GLM-4.7** via z.ai | Plan-Mode für eigene Coding-Tasks, NIE für Mandantendaten |
| Power-Up (public/coding only) | **GLM-5** via OpenRouter | Hardcore-Architektur eigener Code |
| Cost-Saver / Reason (public-only) | **DeepSeek-V3+/R1** via OpenRouter | PRC-Hosting → strikt nur eigener Code, niemals Tenant-Inhalt |
| Frontend (code-server) | **Cline** | Plan/Act-Split, spricht nur LiteLLM |
| Knowledge | **Obsidian** (lokal, Git-synced) | Karpathy-inspiriert, Smart Connections gegen lokales Ollama |

**Pivot ggü. v1: LiteLLM zieht von Mac auf Hetzner.** Wenn Router auf Mac läuft und Mac aus ist, ist auch der Cloud-Fallback weg → Cline blind. LiteLLM auf workflows-CX33 (läuft eh 24/7) entkoppelt das. Cline und Voicebot sprechen immer mit `litellm.eppcom.de`, egal ob Mac an oder aus.

**Pivot: getrennte Modell-Aliase pro Compliance-Pfad.** Statt unbewusster `fallbacks`-Liste explizit benannte Aliase (`*-sensitive` ohne Cloud-Fallback, `*-public` mit). Aufrufer wählt bewusst — Falsch-Tagging ist Konfig-Fehler, nicht stiller Datenleak.

**EPPCOM-LLM-Server kündigen:** 46.224.54.65 ohne GPU schafft GLM-4.7-Flash mit 1–2 t/s, unbrauchbar. Voicebot zieht künftig auf `litellm.eppcom.de` mit Sensitive-Alias → Server kann gekündigt werden, Ersparnis ~€5–7/Monat.

**Gegen GPU-Cloud-Server:** Hetzner GEX €180+/Monat sprengt Budget. Daher bewusste **System-OFF-Policy** für Sensitive: Mac off → 503 statt stille Cloud-Eskalation.

**Gegen z.ai/DeepSeek für Mandantendaten:** Beide ohne verlässlichen AVV für DACH-Heilberufe/Anwälte/Steuerberater. PRC-Hosting (z.ai, DeepSeek) ist für Art. 9 DSGVO untragbar. Mandantendaten = ausschließlich lokal Mac-Ollama.

---

## 1a. DSGVO-Architektur (Two-Path-Routing)

### Pfad-Definition

| Pfad | Aliase (Beispiel) | Backends | Fallback | Use-Case |
|---|---|---|---|---|
| **SENSITIVE** | `voicebot-sensitive`, `rag-sensitive`, `chat-sensitive` | NUR Mac-Ollama | **KEIN** — Mac down → HTTP 503 + Audit-Log | Heilberufe, Anwälte, Steuerberater, jeder PII-führende Tenant |
| **PUBLIC** | `voicebot-public`, `rag-public`, `chat-public` | Mac-Ollama → z.ai → OpenRouter | Auto-Kette | Demo-Voicebot eppcom.de, Marketing-Chatbot, Test-Tenants |
| **CODING** (eigene Arbeit) | `architect`, `coder`, `power`, `reason`, `architect-ds` | Mac-Coder + Cloud-Tiers | Auto-Kette | Cline auf code-server, eigener Quellcode (NIE Mandantencode!) |

### Compliance-Matrix

| Anforderung | Lösung |
|---|---|
| Verarbeitung im EU-Raum | Mac in DE, Hetzner in DE → ✓ |
| AVV mit Auftragsverarbeitern | LiteLLM self-hosted, kein Dritt-AVV nötig → ✓ |
| Datenminimierung | Sensitive-Aliase senden NIE an Cloud → ✓ |
| Löschkonzept | Sensitive-Pfad: `log_raw_request: false`, nur Metadaten-Logs |
| Auditierbarkeit | Getrennte SQLite-DBs für sensitive vs. public Spend/Logs |
| Transport-Verschlüsselung | Cloudflare Tunnel = TLS 1.3 |
| Storage-Verschlüsselung | macOS FileVault auf Mac (PFLICHT!), Hetzner LUKS-Volume |

### Mandanten-Tagging-Konvention

```python
# Voicebot für Arzt-Tenant — SENSITIVE
client.chat.completions.create(
    model="voicebot-sensitive",            # explizit, kein Cloud möglich
    messages=[...],
    extra_headers={"X-Tenant-ID": "praxis-mueller", "X-Compliance": "dsgvo-art9"}
)

# Demo-Voicebot eppcom.de — PUBLIC
client.chat.completions.create(model="voicebot-public", messages=[...])

# FALSCH — leakt Mandantendaten in z.ai
client.chat.completions.create(
    model="voicebot-public",
    messages=[{"role": "user", "content": patient_data}]   # ⚠️ NEIN
)
```

**n8n-Regel:** Postgres-Tabelle `tenants` trägt Spalte `compliance_tier` ∈ {`sensitive`, `public`}. n8n-Node leitet Modell-Alias dynamisch daraus ab. Falsch-Tagging ist DB-Konfig-Fehler, nicht versteckter Code-Bug.

### System-OFF-Policy (Sensitive bei Mac-Down)

- LiteLLM Health-Check `mac-ollama.eppcom.de` schlägt fehl
- Sensitive-Aliase liefern HTTP 503 + `{"error":"sensitive_backend_offline"}`
- Voicebot Wartungs-Antwort: *"Telefonservice für [Tenant] aktuell außer Betrieb. Notfälle bitte direkt anrufen."*
- Audit-Log notiert versuchte Aufrufe mit Tenant-ID + Timestamp
- **Niemals automatisches Cloud-Fallback** — bewusste Geschäftsentscheidung pro Tenant ob Wartungsfenster akzeptabel
- Public-Aliase laufen währenddessen ungestört über Cloud weiter

---

## 2. Kosten-Überblick (monatlich)

| Posten | Erwartung | Notiz |
|---|---|---|
| Hetzner workflows-CX33 (Coolify-Host) | €5.49 | läuft eh, LiteLLM-Container marginal +€0 |
| Hetzner Object Storage (RAG-Backups) | €4.99 | läuft eh |
| Hetzner Backups + IPv4 + Snapshots | ~€2.50 | läuft eh |
| **EPPCOM-LLM Server (46.224.54.65)** | **−€5–7** | **kündigen sobald Migration durch → Ersparnis** |
| z.ai GLM-4.7 ($3-Plan) | ~€2.80 | nur public/coding |
| OpenRouter (GLM-5/DeepSeek) | €0–5 | nur public/coding, pay-per-use |
| Cloudflare Tunnel | €0 | Free-Tier |
| Strom Mac (wach während Sensitive-Slots) | ~€5–10 | abhängig von Betriebszeit; Sensitive-Tenants definieren Slot |
| **Summe nach Migration** | **~€16–22/Monat** | praktisch kostenneutral ggü. heute, deutlich mehr LLM-Power |

**DSGVO-Rechnung:** Selbst bei vollem Sensitive-Pfad-Volumen kein Cloud-Token-Verbrauch für Mandantendaten → Mandantenkosten = nur Strom Mac + anteilig Hetzner.

---

## 3. Phase 0 — Externe SSD vorbereiten



GUI:
1. 4TB-SSD wählen → **Löschen**
2. Format: **APFS**
3. Schema: **GUID Partition Map**
4. Name: **`LLM4TB`** (genau so)

```bash
# Verifizieren
ls /Volumes/LLM && diskutil info /Volumes/LLM | grep "File System"

# Performance-Check (Ziel: >1500 MB/s über TB4/5)
dd if=/dev/zero of=/Volumes/LLM/test.bin bs=1m count=2000 && rm /Volumes/LLM/test.bin

# Ordnerstruktur
mkdir -p /Volumes/LLM/{ollama,lmstudio,obsidian-vault,backups}
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
launchctl setenv OLLAMA_MODELS /Volumes/LLM/ollama
launchctl setenv OLLAMA_HOST 127.0.0.1:11434     # nur lokal — LiteLLM exposed extern
launchctl setenv OLLAMA_KEEP_ALIVE 30m            # entlädt Modelle nach 30min Idle (RAM frei)
launchctl setenv OLLAMA_MAX_LOADED_MODELS 2       # max 2 Modelle gleichzeitig im RAM

# Auch nach Reboot
cat >> ~/.zshrc <<'EOF'
export OLLAMA_MODELS=/Volumes/LLM/ollama
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
du -sh /Volumes/LLM/ollama
```

**Falls `glm-4.7-flash` nicht in Ollama-Library existiert:**

```bash
# LM Studio öffnen → Search → "bartowski GLM-4.7-Flash"
# Variante Q4_K_M laden
# Settings → Storage → Models Directory: /Volumes/LLM/lmstudio
# Developer → Start Server (Port 1234, OpenAI-compatible)
# In LiteLLM-Config dann lm-studio statt ollama als Backend für glm-4.7-flash eintragen
```

---

## 6. Phase 3 — LiteLLM Router auf Hetzner workflows-CX33 (Coolify)

LiteLLM läuft als Docker-Container in Coolify, NICHT mehr auf dem Mac. Cline + Voicebot + n8n sprechen alle mit `https://litellm.eppcom.de`.

### Schritt 6a — Coolify-Anwendung anlegen

Coolify-UI → Project `production` → Server `EPPCOM-Workflows` (CX33) → New Resource → Docker Image:
- **Image:** `ghcr.io/berriai/litellm:main-stable`
- **Port:** `4000`
- **Domain:** `litellm.eppcom.de` (Coolify legt Cloudflare-DNS automatisch an)
- **Persistent Volume:** `/app/litellm` → Coolify-managed (für SQLite-DBs)

Environment-Variablen (Coolify → Configuration → Environment Variables):
```
ZAI_API_KEY=sk-zai-...
OPENROUTER_API_KEY=sk-or-...
LITELLM_MASTER_KEY=sk-eppcom-<openssl rand -hex 16 lokal generieren>
LITELLM_SALT_KEY=<openssl rand -hex 16>
SENSITIVE_DB_URL=sqlite:////app/litellm/sensitive.db
PUBLIC_DB_URL=sqlite:////app/litellm/public.db
```

### Schritt 6b — Config-File mounten

In Coolify → Storages → `/app/config.yaml` als File-Mount → Inhalt:

```yaml
# Two-Path-Routing für DSGVO-Compliance
model_list:

  # ============================================================
  # SENSITIVE PATH — Tenant-Daten, NUR Mac, KEIN Cloud-Fallback
  # ============================================================
  - model_name: voicebot-sensitive
    litellm_params:
      model: ollama/qwen3.6:27b
      api_base: https://mac-ollama.eppcom.de
      timeout: 30
      stream_timeout: 60

  - model_name: rag-sensitive
    litellm_params:
      model: ollama/qwen3.6:35b-a3b
      api_base: https://mac-ollama.eppcom.de
      timeout: 60

  - model_name: chat-sensitive
    litellm_params:
      model: ollama/qwen3.6:27b
      api_base: https://mac-ollama.eppcom.de

  - model_name: embed-sensitive
    litellm_params:
      model: ollama/nomic-embed-text
      api_base: https://mac-ollama.eppcom.de

  # ============================================================
  # PUBLIC PATH — unsensible Workloads, mit Cloud-Fallback
  # ============================================================
  - model_name: voicebot-public
    litellm_params:
      model: ollama/qwen3.6:27b
      api_base: https://mac-ollama.eppcom.de

  - model_name: voicebot-public-fallback
    litellm_params:
      model: openai/glm-4.7
      api_base: https://api.z.ai/api/paas/v4
      api_key: os.environ/ZAI_API_KEY

  - model_name: rag-public
    litellm_params:
      model: ollama/qwen3.6:35b-a3b
      api_base: https://mac-ollama.eppcom.de

  - model_name: chat-public
    litellm_params:
      model: ollama/qwen3.6:27b
      api_base: https://mac-ollama.eppcom.de

  # ============================================================
  # CODING PATH — eigene Arbeit (Cline auf code-server)
  # ============================================================
  - model_name: architect
    litellm_params:
      model: openai/glm-4.7
      api_base: https://api.z.ai/api/paas/v4
      api_key: os.environ/ZAI_API_KEY

  - model_name: coder
    litellm_params:
      model: ollama/glm-4.7-flash
      api_base: https://mac-ollama.eppcom.de

  - model_name: power
    litellm_params:
      model: openrouter/z-ai/glm-5
      api_key: os.environ/OPENROUTER_API_KEY

  - model_name: architect-ds
    litellm_params:
      model: openrouter/deepseek/deepseek-chat
      api_key: os.environ/OPENROUTER_API_KEY

  - model_name: reason
    litellm_params:
      model: openrouter/deepseek/deepseek-r1
      api_key: os.environ/OPENROUTER_API_KEY

# ============================================================
# Routing — getrennt nach Pfad
# ============================================================
router_settings:
  fallbacks:
    # PUBLIC: Mac → z.ai erlaubt
    - voicebot-public: [voicebot-public-fallback]

    # CODING: vollständige Kette
    - coder: [architect]
    - architect: [architect-ds, power]
    - architect-ds: [architect, power]

    # SENSITIVE: KEINE Fallbacks definiert → bei Mac-Down 503

  num_retries: 1
  request_timeout: 120

# ============================================================
# Logging — getrennt für Audit
# ============================================================
litellm_settings:
  drop_params: true
  set_verbose: false
  # Sensitive: nur Metadaten, kein Prompt-/Response-Body
  redact_user_api_key_info: true
  turn_off_message_logging: true   # für sensitive aliase Pflicht — DSGVO

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  database_url: os.environ/PUBLIC_DB_URL
  budget_duration: 30d
  max_budget: 20.0
  # Pro-Alias-Budget bei Bedarf in litellm-UI setzen
```

> **Wichtig DSGVO:** `turn_off_message_logging: true` global, damit auch Public-Pfad keine Voicebot-Inhalte mitschreibt. Spend wird trotzdem getrackt (nur Token-Counts, keine Inhalte).

### Schritt 6c — Custom-Hook für Sensitive-Health-Enforcement

Coolify → Storages → `/app/sensitive_guard.py` mounten:

```python
"""
Pre-Call-Hook: Sensitive-Aliase werfen 503 wenn Mac-Backend offline.
Verhindert dass LiteLLM still auf cloud fallback'd selbst wenn man fallbacks einträgt.
"""
import os, httpx, time
from litellm.integrations.custom_logger import CustomLogger

MAC_HEALTH_URL = "https://mac-ollama.eppcom.de/api/tags"
CACHE_TTL = 30
_cache = {"ts": 0, "ok": False}

SENSITIVE_PREFIXES = ("voicebot-sensitive", "rag-sensitive", "chat-sensitive", "embed-sensitive")

def mac_alive() -> bool:
    if time.time() - _cache["ts"] < CACHE_TTL:
        return _cache["ok"]
    try:
        r = httpx.get(MAC_HEALTH_URL, timeout=3)
        ok = r.status_code == 200 and len(r.json().get("models", [])) > 0
    except Exception:
        ok = False
    _cache.update(ts=time.time(), ok=ok)
    return ok

class SensitiveGuard(CustomLogger):
    async def async_pre_call_hook(self, user_api_key_dict, cache, data, call_type):
        model = data.get("model", "")
        if model.startswith(SENSITIVE_PREFIXES) and not mac_alive():
            from fastapi import HTTPException
            raise HTTPException(
                status_code=503,
                detail={
                    "error": "sensitive_backend_offline",
                    "message": "DSGVO-Tenant-Backend (Mac-Ollama) nicht erreichbar. Wartungsfenster.",
                    "retry_after": 3600,
                }
            )
        return data

proxy_handler_instance = SensitiveGuard()
```

In `config.yaml` zusätzlich:
```yaml
litellm_settings:
  callbacks: ["sensitive_guard.proxy_handler_instance"]
```

### Schritt 6d — Verifizieren

```bash
# Health
curl https://litellm.eppcom.de/health

# Modelle
curl -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  https://litellm.eppcom.de/v1/models | jq '.data[].id'

# Sensitive-Test mit Mac an
curl -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  https://litellm.eppcom.de/v1/chat/completions \
  -d '{"model":"voicebot-sensitive","messages":[{"role":"user","content":"hi"}]}'

# Sensitive-Test mit Mac aus → erwartet 503
# (vorher brew services stop ollama auf Mac)
```

---

## 7. Phase 4 — Cloudflare Tunnel: Mac exponiert NUR Ollama

Mac → Hetzner LiteLLM. Subdomain `mac-ollama.eppcom.de`. Tunnel terminiert in der Cloudflare-Edge, Hetzner LiteLLM ruft die HTTPS-URL auf (kein direktes IP-Routing nötig).

```bash
# Auf Mac
cloudflared tunnel login                        # Browser, eppcom.de auswählen
cloudflared tunnel create mac-ollama
cloudflared tunnel route dns mac-ollama mac-ollama.eppcom.de

# Config — Editor statt Heredoc (zsh-safe!)
nano ~/.cloudflared/config.yml
```

Inhalt (`UUID` durch Output von `ls ~/.cloudflared/*.json` ersetzen):

```yaml
tunnel: mac-ollama
credentials-file: /Users/marcel/.cloudflared/UUID.json

ingress:
  - hostname: mac-ollama.eppcom.de
    service: http://localhost:11434              # Ollama direkt, KEIN LiteLLM auf Mac mehr
    originRequest:
      connectTimeout: 30s
      noTLSVerify: true
  - service: http_status:404
```

```bash
sudo cloudflared service install
brew services start cloudflared

# Test — Mac Ollama public erreichbar via Cloudflare
curl -s https://mac-ollama.eppcom.de/api/tags | python3 -m json.tool | head -10
```

**Sicherheit Ollama-Endpoint:** Ollama hat keine native Auth. Optionen:
1. **Cloudflare Access** (empfohlen): Zero Trust → Application → `mac-ollama.eppcom.de` → Service-Token-Policy. LiteLLM-Container schickt Service-Token-Header bei jedem Aufruf
2. **Cloudflare WAF-Rule**: nur Hetzner-IP `94.130.170.167` erlauben
3. Minimum: Mac-Firewall blockt Port 11434 außer für `localhost` + Cloudflared

---

## 8. Phase 5 — Cline auf code-server konfigurieren

Cline spricht mit `https://litellm.eppcom.de` (Hetzner), NICHT mehr direkt mit dem Mac.

| Profil | Provider | Base URL | API Key | Model ID | Wann |
|---|---|---|---|---|---|
| `architect` | OpenAI Compatible | `https://litellm.eppcom.de` | `<LITELLM_MASTER_KEY>` | `architect` | Default Plan |
| `coder` | OpenAI Compatible | `https://litellm.eppcom.de` | `<LITELLM_MASTER_KEY>` | `coder` | Default Act |
| `power` | OpenAI Compatible | `https://litellm.eppcom.de` | `<LITELLM_MASTER_KEY>` | `power` | GLM-5 Greenfield |
| `architect-ds` | OpenAI Compatible | `https://litellm.eppcom.de` | `<LITELLM_MASTER_KEY>` | `architect-ds` | DeepSeek Cost-Saver |
| `reason` | OpenAI Compatible | `https://litellm.eppcom.de` | `<LITELLM_MASTER_KEY>` | `reason` | Algorithmen, Math |

**Plan/Act-Split:** Plan = `architect`, Act = `coder`. Andere bei spezifischem Bedarf manuell wechseln.

> **Wichtig:** Cline-Profile sind nur für **eigene Coding-Arbeit**. Für Mandantencode der Tenants gibt's keinen Cline-Profile-Zugriff — die laufen ausschließlich über Voicebot/n8n mit Sensitive-Aliasen.

---

## 8a. Phase 5b — Voicebot/n8n auf LiteLLM umstellen

Bestehende Voicebot-Konfig zeigt heute auf Server 2 Ollama (`46.224.54.65:11434` mit `qwen3-voice:latest`). Künftig:

### Voicebot-Container (Coolify)
```env
# Vorher
LLM_BASE_URL=http://46.224.54.65:11434/v1
LLM_MODEL=qwen3-voice:latest

# Nachher (compliance_tier kommt aus Tenant-DB pro Call)
LLM_BASE_URL=https://litellm.eppcom.de/v1
LLM_API_KEY=<LITELLM_MASTER_KEY>
LLM_MODEL_TEMPLATE=voicebot-{tier}        # tier ∈ {sensitive, public}
```

### n8n-Workflow
- Postgres-Tabelle `tenants` Spalte `compliance_tier` ergänzen (Migration: `ALTER TABLE tenants ADD COLUMN compliance_tier TEXT NOT NULL DEFAULT 'sensitive'`)
- Default `sensitive` ist bewusst sicher: lieber 503 als versehentlich Cloud
- LLM-Aufruf-Node: `model: voicebot-{{$json.tenant.compliance_tier}}`

### RAG-Pipeline
- Embeddings: `embed-sensitive` für Tenant-RAG (Anwalts-Wissensbasis), `embed` für Demo
- Retrieval: Vector-Store (postgres-rag oder pgvector) bleibt wie er ist, nur die Synthesis-LLM wechselt auf den passenden Sensitive-Alias
- Wichtig: Vector-Store-Inhalte sind selbst PII-geladen → Backup-Verschlüsselung in Hetzner Object Storage prüfen

### Migration-Reihenfolge
1. LiteLLM auf Hetzner deployen, mit Mac-Tunnel verbinden
2. **Test-Tenant** (interner Demo-Tenant) auf `voicebot-public` umstellen → 1 Woche beobachten
3. Sensitive Pilot-Tenant (am besten unkritischer Fall) auf `voicebot-sensitive` → 1 Woche
4. Restliche Tenants migrieren, jeweils `compliance_tier` korrekt setzen
5. **Erst dann** EPPCOM-LLM Server 2 (46.224.54.65) kündigen
6. Coolify-Voicebot-Container auf neuen Endpoint umkonfigurieren, `qwen3-voice` Modell-Pull entfernen

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
echo "0 3 * * 0 rsync -a --delete ~/Documents/Obsidian/EppcomVault/ /Volumes/LLM/backups/vault/" | crontab -

# LiteLLM-DB (Cost-History) ist eh schon auf /Volumes/LLM/litellm/litellm.db
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

### Workflow G: Sensitive-Tenant-Aufruf (DSGVO)
1. Patient ruft Praxis Müller an → Voicebot nimmt Anruf
2. n8n: Tenant-Lookup → `compliance_tier='sensitive'` → Modell-Alias `voicebot-sensitive`
3. Aufruf an `https://litellm.eppcom.de/v1/chat/completions`
4. SensitiveGuard-Hook prüft `mac-ollama.eppcom.de/api/tags` (cached 30s)
5. Mac an → Request läuft an `qwen3.6:27b` auf Mac-Ollama, Response zurück
6. Audit-Log: nur Token-Counts + Tenant-ID, keine Inhalte
7. Bei Mac-aus: 503 → Voicebot spielt Wartungs-TTS ab

### Workflow H: Wochenend-Modus (Mac aus)
1. Freitag 22:00: Mac runterfahren oder Caffeinate stoppen
2. Sensitive-Tenants → 503 (gewollt, im Tenant-Vertrag dokumentiert als Geschäftszeiten)
3. Public-Demo-Voicebot eppcom.de läuft via z.ai weiter
4. Cline auf code-server: läuft via z.ai-Fallback (kostet ein paar Cents)
5. Montag früh: Mac an, Caffeinate, alles wieder lokal

---

## 13. Wartungs-Plan

| Frequenz | Task |
|---|---|
| Täglich (auto) | Obsidian Git Auto-Commit (alle 30min wenn Changes) |
| Wöchentlich | `~/bin/llm-status.sh` checken, Vault-Backup verifizieren |
| Wöchentlich | Cost-Report: `curl .../spend/logs` anschauen |
| Monatlich | `ollama list` aufräumen, ungenutzte Modelle löschen |
| Monatlich | LiteLLM-Logs unter `/Volumes/LLM/litellm/*.log` rotieren |
| Quartal | Modell-Updates: neuer GLM-Release? `ollama pull glm-X.Y-flash` |
| Quartal | Cloudflare-Tunnel-Credentials rotieren |

---

## 14. Troubleshooting

| Symptom | Ursache | Fix |
|---|---|---|
| `ollama list` leer nach Reboot | SSD nicht gemountet | `diskutil mount /Volumes/LLM && brew services restart ollama` |
| Cline 401 | LITELLM_MASTER_KEY falsch in Cline | In code-server Cline-Settings neu eintragen |
| Cline Timeout | Erstes Modell-Loading 30-60s | Cline → Request Timeout 120s |
| `mac-ollama.eppcom.de` nicht erreichbar | Tunnel down | `brew services restart cloudflared` + DNS prüfen mit `dig mac-ollama.eppcom.de` |
| Sensitive-Aufruf 503 obwohl Mac an | SensitiveGuard-Cache stale ODER Mac-Ollama hat keine Modelle gelistet | `curl https://mac-ollama.eppcom.de/api/tags` direkt prüfen, ggf. SensitiveGuard-Cache verkürzen |
| LiteLLM-Container startet nicht | YAML-Fehler in `config.yaml` | Coolify-Logs ansehen, `python3 -c "import yaml; yaml.safe_load(open('/app/config.yaml'))"` testen |
| Voicebot routet auf Cloud trotz sensitive | n8n-Tenant-Lookup falsch | Postgres `SELECT compliance_tier FROM tenants WHERE id=...` checken, Default ist `sensitive` |
| Mac überhitzt / langsam | RAM voll mit 2 Modellen | `OLLAMA_MAX_LOADED_MODELS=1` setzen, Service neu |
| Smart Connections findet nichts | Embeddings nicht generiert | Refresh-Button, Logs in `.smart-connections/` prüfen |
| z.ai 429 / Rate Limit | Plan-Limit erreicht | LiteLLM-Fallback greift für Public-Pfad, NIE für Sensitive |
| Hohe Kosten unerwartet | Loop in Cline (selten) | LiteLLM `/spend/logs` prüfen, Budget-Cap rettet bei $20 |
| `litellm` Install scheitert mit `pyo3 / Python 3.14` | LiteLLM braucht Python ≤3.13 | `brew install python@3.13 && pipx install --python /opt/homebrew/bin/python3.13 'litellm[proxy]'` |
| Bootstrap-Fehler `5: Input/output error` bei `brew services start ollama` | Service-State korrupt | `pkill -9 ollama; brew services restart ollama` |

---

## 15. Master-Checkliste

### Hardware/SSD
- [ ] 4TB SSD APFS-formatiert als `LLM`
- [ ] FileVault auf Mac aktiviert (DSGVO-Pflicht für Mandantendaten)
- [ ] Ordnerstruktur `/Volumes/LLM/{ollama,lmstudio,obsidian-vault,backups}` angelegt
- [ ] Energiesparmodus für externe Disks deaktiviert
- [ ] zsh: `setopt interactive_comments` + `setopt nobanghist` in `~/.zshrc`

### Mac (Backend)
- [ ] Homebrew, Ollama, cloudflared, LM Studio, Obsidian, Python 3.13 installiert
- [ ] Ollama-Env-Vars in `~/.zshrc` UND via `launchctl` (Pfad `/Volumes/LLM/ollama`)
- [ ] Modelle: `qwen3.6:27b`, `qwen3.6:35b-a3b`, `glm-4.7-flash`, `gemma4:31b`, `nomic-embed-text`
- [ ] Migration von `~/.ollama/models` auf SSD durchgeführt + intern aufgeräumt
- [ ] Cloudflare Tunnel `mac-ollama` → `mac-ollama.eppcom.de` Port 11434
- [ ] Mac-Firewall blockt 11434 außer für localhost + cloudflared

### Hetzner workflows-CX33 (Router)
- [ ] LiteLLM-Container in Coolify deployed (Image `ghcr.io/berriai/litellm:main-stable`)
- [ ] Domain `litellm.eppcom.de` aktiv
- [ ] Env-Vars (`ZAI_API_KEY`, `OPENROUTER_API_KEY`, `LITELLM_MASTER_KEY`)
- [ ] `/app/config.yaml` mit 3-Pfad-Struktur (sensitive/public/coding)
- [ ] `sensitive_guard.py` als Pre-Call-Hook aktiv
- [ ] `turn_off_message_logging: true` für DSGVO
- [ ] Health-Endpoint: `curl https://litellm.eppcom.de/health` = 200
- [ ] Sensitive-Test mit Mac aus: 503 mit `sensitive_backend_offline`
- [ ] Cloudflare Access vor `mac-ollama.eppcom.de` (Service-Token für Hetzner)

### Voicebot/n8n-Migration
- [ ] Postgres `tenants.compliance_tier` Spalte ergänzt (Default `sensitive`)
- [ ] n8n-Workflow nutzt dynamischen Modell-Alias je Tenant
- [ ] Pilot-Tenant 1 Woche getestet
- [ ] Voicebot-Container auf `https://litellm.eppcom.de/v1` umkonfiguriert
- [ ] **EPPCOM-LLM Server 2 (46.224.54.65) gekündigt** nach erfolgreicher Migration

### code-server / Cline (eigene Arbeit)
- [ ] Cline-Extension installiert
- [ ] Profile (`architect`, `coder`, `power`, `architect-ds`, `reason`) gegen `litellm.eppcom.de`
- [ ] Plan/Act-Split: Plan=`architect`, Act=`coder`
- [ ] Test-Prompt erfolgreich

### Obsidian (lokal)
- [ ] Vault unter `~/Documents/Obsidian/EppcomVault`
- [ ] Plugins: Smart Connections, Copilot, Templater, Daily Notes, Git, Dataview
- [ ] Smart Connections gegen lokales Ollama (`http://localhost:11434/v1`), nicht Tunnel
- [ ] Daily-Notes-Template aktiv
- [ ] Vault als Git-Repo (privates Remote)

### Stabilität + Kosten
- [ ] Healthcheck-Cron auf code-server: `curl -f https://litellm.eppcom.de/health`
- [ ] Sensitive-Tenants haben Wartungsfenster im Vertrag dokumentiert
- [ ] z.ai Hard Cap $10/Monat
- [ ] OpenRouter Limit $5/Monat
- [ ] LiteLLM `max_budget: 20.0` aktiv

### DSGVO-Audit-Ready
- [ ] AVV mit Tenants schließt Mac-basiertes Processing ein (DE, FileVault)
- [ ] Verarbeitungsverzeichnis aktualisiert
- [ ] Sensitive-Logs enthalten KEINE Inhalte (nur Token-Counts)
- [ ] Backup der Tenant-RAG-Daten verschlüsselt

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
tail -f /Volumes/LLM/litellm/stderr.log

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
