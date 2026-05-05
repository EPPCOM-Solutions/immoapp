# Lokale LLM-Modelle: Vergleich, Empfehlung, SSD-Setup

**Stand:** 2026-05-05
**Hardware:** MacBook M4 Pro, 48GB Unified Memory, externe 4TB APFS SSD `/Volumes/LLM`

---

## 1. Aktuell verfügbare Modelle (live via LiteLLM)

| Alias | Backend | Größe | Verwendung |
|---|---|---|---|
| `chat-hetzner-micro` | CX33 → qwen3:1.7b | 1.4GB | Always-On-Fallback |
| `embed-hetzner` | CX33 → nomic-embed-text | 274MB | Embedding immer verfügbar |
| `voicebot-strict-fast` | Mac → qwen3:8b | 5.2GB | Schnelle Voicebot-Antworten |
| `voicebot-strict-std` | Mac → qwen3.6:27b | 17GB | Standard Voicebot/RAG |
| `chat-strict-std` | Mac → qwen3.6:27b | 17GB | Mandanten-Chat (DSGVO) |
| `embed-strict` | Mac → nomic-embed-text | 274MB | Mandanten-Embedding |
| `coder` | Mac → qwen2.5-coder:32b | 20GB | **Coding-Modell (TODO pull)** |
| `architect` | z.ai → glm-4.7 | Cloud | Architektur (kein Mandantencode) |
| `power` | OpenRouter → glm-5 | Cloud | Heavy Reasoning |
| `reason` | OpenRouter → DeepSeek-R1 | Cloud | Reasoning-Tasks |

**Endpoint:** `https://litellm.eppcom.de/v1/...` (OpenAI-API-kompatibel)

---

## 2. Vergleich: Lokal vs Top-Cloud (agentic coding, Stand 2026)

| Modell | Größe | RAM | Coding-Bench | Tool-Use | Verfügbar bei dir |
|---|---|---|---|---|---|
| **Anthropic Opus 4.7** | ~? | Cloud | 95+ | sehr stark | nur Cloud |
| **GPT-5.5** | ~? | Cloud | 92+ | sehr stark | nur Cloud |
| **Gemini 3.1 Pro** | ~? | Cloud | 90+ | stark | nur Cloud |
| Qwen2.5-Coder 32B Q4 | 20GB | 24GB | ~84 | mittel | ✓ (nach Pull) |
| Qwen3 30B-A3B (qwen3.6:27b) | 17GB | 22GB | ~78 | gut | ✓ aktuell |
| DeepSeek-Coder V2 33B | 20GB | 24GB | ~83 | gut | optional |
| GLM-4.5 (lokal nur als 9b) | 6GB | 8GB | ~75 | gut | optional |
| Llama 3.3 70B Q4 | 40GB | 44GB | ~78 | mittel | optional, langsam |
| DeepSeek-R1-Distill-Llama 70B Q4 | 42GB | 46GB | ~80 (Reasoning ~92) | wenig Tools | optional, sehr langsam |

**Realistische Einschätzung für agentic coding auf M4 Pro 48GB:**
- **Keiner der lokalen Modelle ersetzt Opus 4.7 / GPT-5.5 / Gemini 3.1 vollständig.** Lücke 10-15 Bench-Punkte plus deutlich schwächeres Tool-Use.
- **Beste lokale Option:** `qwen2.5-coder:32b` (Q4) — kommt am nächsten heran für reines Coding (Funktion schreiben, Refactor, Bugfix).
- **Für agentic Tasks** (mehrstufige Pläne, Tool-Use, Selbstkorrektur): Cloud bleibt klar besser. Lokal ist Tool-Use brüchig.
- **Sweet spot lokal:** trivialer Code (Boilerplate, Tests, kleine Bugfixes), Doku-Generation, Code-Review erste Stufe. Heavy Lifting → Cloud.

---

## 3. Optionale Modelle für mehr Flexibilität (M4 Pro 48GB taugliche)

Pull-Befehle (alle auf `/Volumes/LLM/ollama` nach Migration):

```bash
# Coding-Spezialisten
OLLAMA_HOST=10.8.0.10 ollama pull qwen2.5-coder:32b      # ~20GB — empfohlen
OLLAMA_HOST=10.8.0.10 ollama pull deepseek-coder-v2:16b  # ~10GB — schneller, etwas schwächer
OLLAMA_HOST=10.8.0.10 ollama pull codestral:22b          # ~13GB — Mistral-Coder

# Reasoning
OLLAMA_HOST=10.8.0.10 ollama pull deepseek-r1:32b        # ~20GB — starkes Reasoning
OLLAMA_HOST=10.8.0.10 ollama pull qwq:32b                # ~20GB — Qwen QwQ Reasoning

# General-Purpose
OLLAMA_HOST=10.8.0.10 ollama pull llama3.3:70b           # ~40GB — sehr eng, langsam
OLLAMA_HOST=10.8.0.10 ollama pull mistral-small:24b      # ~14GB — schnell, gut

# Vision/Multimodal
OLLAMA_HOST=10.8.0.10 ollama pull qwen2.5vl:32b          # ~20GB — Vision + Text
OLLAMA_HOST=10.8.0.10 ollama pull llama3.2-vision:11b    # ~7GB — kleinere Vision

# Embedding-Alternative
OLLAMA_HOST=10.8.0.10 ollama pull bge-m3:latest          # ~1.2GB — multilingual besser
```

**Empfehlung Reihenfolge:**
1. `qwen2.5-coder:32b` (Coding-Pflicht)
2. `deepseek-r1:32b` (Reasoning)
3. `qwen2.5vl:32b` (Vision für RAG mit Bildern, Dokumenten-OCR)

---

## 4. SSD-Sleep-Fix (USB/Thunderbolt Disconnect)

**Problem:** macOS trennt externe SSD nach längerem Standby trotz deaktiviertem System-Sleep.

**Ursachen:**
1. Disk-Sleep separat vom System-Sleep
2. PowerNap/Hibernation nicht aus
3. USB-C-Hub mit eigenem Power-Management
4. APFS-Disk-Image lazy-mounten

**Fix (alle Befehle auf Mac als sudo):**

```bash
# Power-Management komplett aus
sudo pmset -a disksleep 0       # Festplatte nie schlafen
sudo pmset -a sleep 0           # System nie schlafen (Netzbetrieb)
sudo pmset -a powernap 0        # PowerNap aus
sudo pmset -a hibernatemode 0   # Hibernation aus
sudo pmset -a standby 0         # Standby aus (M-Series)
sudo pmset -a autopoweroff 0    # Auto-Power-Off aus

# Status verifizieren
pmset -g
```

**Zusätzlich falls weiter Probleme:**

```bash
# Automount via /etc/fstab (verhindert Lazy-Unmount)
UUID=$(diskutil info /Volumes/LLM | grep "Volume UUID" | awk '{print $3}')
echo "UUID=$UUID none apfs rw,auto,nobrowse 0 0" | sudo tee -a /etc/fstab

# Spotlight-Indexing auf SSD ausschalten (verhindert IO-Stalls)
sudo mdutil -i off /Volumes/LLM
sudo mdutil -E /Volumes/LLM
```

**Hardware-Checks:**
- USB-C/Thunderbolt-Kabel direkt am Mac (kein Hub)
- SSD-Gehäuse mit Bus-Power: prüfe ob das Gehäuse selbst Sleep macht (manche Sabrent/SanDisk Gehäuse haben firmware-side disk sleep — Tool des Herstellers checken)
- Aktivitätsanzeige: schau ob `corestoraged` oder `apfsd` in Loops läuft

---

## 5. SSD-Vault-Layout `/Volumes/LLM`

Sichtbare Ordner laut Finder-Screenshot (Größenangaben Soll-Stand):

| Ordner | Inhalt | Soll-Größe |
|---|---|---|
| `backups/` | Time-Machine-ähnliche Backups (Vault, Modelle, Configs) | flexibel |
| `embeddings/` | RAG-Embeddings (FAISS-Indizes, Vector-Stores) | wächst mit RAG-Korpus |
| `litellm/` | LiteLLM-DB-Backup, Config-Snapshots | <1GB |
| `lmstudio/` | LM-Studio-eigene Modelle (separates Format vom Ollama) | optional |
| `obsidian-vault/` | Obsidian Notes, Wiki | wächst |
| `ollama/` | Ollama-Modelle (qwen3:8b, qwen3.6:27b, nomic-embed) | aktuell ~22.5GB, nach qwen2.5-coder ~42.5GB |
| `whisper/` | Whisper-Modelle (small, medium, large-v3) | bis ~6GB für large-v3 |

**Was fehlt vermutlich noch:**
- Ollama-Modelle sind in `~/.ollama` statt `/Volumes/LLM/ollama` → Migration via `mac-migrate-models.sh`
- Whisper-Modelle: prüfen ob in `~/.cache/whisper` statt `/Volumes/LLM/whisper`
- Obsidian-Vault: prüfen ob alle Notes synchronisiert
- LM-Studio: separat, falls verwendet

---

## 6. Token-Sparen für Claude Code

### Option A: Komplettes Routing über LiteLLM
```bash
# In ~/.claude/settings.json oder Shell:
export ANTHROPIC_BASE_URL=https://litellm.eppcom.de
export ANTHROPIC_AUTH_TOKEN=sk-eppcom-a394bc64803510b556ad47b796649096f507a3b8

# Claude Code mit lokalem Coder-Modell
claude --model coder
```
**Vorteil:** Komplette Session geht über lokal/Mistral.
**Nachteil:** Tool-Use eingeschränkt wenn lokales Modell schwächer.

### Option B: Hybrid via MCP-Tools (empfohlen für agentic Tasks)
Behalte Claude Code mit Anthropic. Nutze die Ollama-MCP-Tools (`mcp__ollama-mac__*`) für Subtasks:
- Boilerplate generieren → `mcp__ollama-mac__ollama_chat` mit qwen2.5-coder:32b
- Embeddings → `mcp__ollama-mac__ollama_embed` mit nomic-embed-text
- Schnelle Klassifizierung → `mcp__ollama-mac__ollama_generate` mit qwen3:8b

### Option C: Subagent mit lokalem Modell
Custom Subagent in `~/.claude/agents/` mit `model: coder` (LiteLLM-Alias).

---

## 7. Verbindungs-Test-Befehle

```bash
# WireGuard-Tunnel
ssh root@94.130.170.167 'wg show wg0'

# Mac Ollama via WireGuard
curl -s http://10.8.0.10:11434/api/tags | python3 -m json.tool

# LiteLLM End-to-End
curl -s https://litellm.eppcom.de/v1/chat/completions \
  -H "Authorization: Bearer sk-eppcom-..." \
  -H "Content-Type: application/json" \
  -d '{"model":"coder","messages":[{"role":"user","content":"def hello():"}]}'
```
