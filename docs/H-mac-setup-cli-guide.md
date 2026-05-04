# EPPCOM Hybrider LLM-Stack v4 — CLI-Setup-Anleitung

**Für andere LLMs lesbar / Stand: 2026-05-03**

Dieses Dokument beschreibt jeden manuellen Terminal-Befehl für den EPPCOM Hybrid-LLM-Stack v4.
Es ist gezielt als Übergabe-Dokument für KI-Assistenten oder neue Team-Mitglieder verfasst.

---

## Kontext

**Ziel:** MacBook M4 Pro (48GB RAM, 512GB intern + 4TB externe SSD) als lokales LLM-Backend für
DSGVO-konforme Tenant-Workflows. LiteLLM-Router läuft auf Hetzner 24/7. WireGuard-Tunnel verbindet
Mac und Hetzner. Drei Compliance-Tiers (strict/operational/public).

**Repos:**
- `eppcom-projects` → Infra-Configs unter `infra/litellm/`
- `immoapp` → Voicebot-Code, App, RAG

**Hetzner workflows-Server:** `94.130.170.167` (CX33, 4 vCPU / 8GB RAM / 80GB NVMe — kein Upgrade geplant, alle CX-Server bei Hetzner ausverkauft Stand 2026-05-04)

---

## Teil A: Mac-Terminal-Setup

Alle Befehle werden auf dem MacBook Pro im Terminal (zsh) ausgeführt.

### A0: Voraussetzungen prüfen

```bash
# SSD gemountet?
ls /Volumes/LLM
# Erwartet: Ordner wie 'ollama', 'models' o.ä. — oder leeres Volume

# Freier Speicherplatz prüfen (sollte >200GB frei haben)
df -h /Volumes/LLM

# Homebrew vorhanden?
brew --version
# Wenn nicht: /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### A1: zsh-Optionen setzen (einmalig, verhindert Terminal-Einfüge-Fehler)

```bash
# Ohne diese Optionen schlägt das Einfügen von Code-Blöcken mit # oder ! in zsh fehl.
# Fehlermeldungen ohne diese Optionen:
#   zsh: command not found: #         (fehlende interactive_comments)
#   zsh: event not found: DOCTYPE     (fehlende nobanghist bei <!DOCTYPE>-Strings)

echo 'setopt interactive_comments' >> ~/.zshrc
echo 'setopt nobanghist' >> ~/.zshrc
source ~/.zshrc
```

### A2: Ollama installieren (falls nicht vorhanden)

```bash
# Ollama: lokaler LLM-Runner mit Apple-Silicon-Optimierung
brew install ollama

# Dienst starten (temporär auf 0.0.0.0 für die initiale Einrichtung)
OLLAMA_HOST=0.0.0.0:11434 brew services start ollama

# Test ob Ollama läuft:
curl http://localhost:11434/api/tags
# Erwartet: {"models":[...]} — leere Liste ist OK wenn noch keine Modelle geladen
```

### A3: Modelle downloaden

```bash
# Schritt A3 dauert je nach Internet-Verbindung 30-90 Minuten.
# Gesamtgröße: ~40GB Erstdownload (qwen3.6:27b + glm-4.7-flash + nomic-embed-text)

# Fast-Modell (~5GB, 7B Params) — für triviale Anfragen
ollama pull qwen3.6:7b

# Standard-Modell (~17GB, 27B Params) — Voicebot + RAG für Tenants
ollama pull qwen3.6:27b

# Coder (~17GB, 30B-A3B MoE, nur 3B aktiv) — für eigene Code-Entwicklung
ollama pull glm-4.7-flash

# Embedding (~270MB) — Obsidian Smart Connections + Tenant-RAG-Index
ollama pull nomic-embed-text

# Überblick nach Download:
ollama list
# NAME                    ID              SIZE    MODIFIED
# qwen3.6:27b             ...             17 GB   ...
# qwen3.6:7b              ...             5.2 GB  ...
# glm-4.7-flash           ...             17 GB   ...
# nomic-embed-text        ...             274 MB  ...
```

### A4: Bestehende Modelle auf externe SSD migrieren (falls ~/.ollama bereits Modelle hat)

```bash
# Prüfen ob Modelle auf interner SSD liegen (typisch nach bisheriger Nutzung):
du -sh ~/.ollama
# Wenn >0 Bytes: Migration nötig

# Ordner auf externer SSD anlegen:
mkdir -p /Volumes/LLM/ollama

# rsync-Migration (Archive-Modus: Rechte + Timestamps werden erhalten)
# --info=progress2: zeigt Gesamtfortschritt statt pro-Datei-Output
# Typische Dauer: 75GB über USB3 = 10-20 Minuten
rsync -a --info=progress2 ~/.ollama/ /Volumes/LLM/ollama/

# Nach Migration verifizieren (beide Seiten sollten gleich sein):
du -sh ~/.ollama
du -sh /Volumes/LLM/ollama

# Backup erst nach Verifikation löschen:
# rm -rf ~/.ollama   # ← ERST ausführen wenn A6-Verifikation bestanden!
```

### A5: Ollama auf WireGuard-IP rebinden

```bash
# WARUM 10.8.0.10 statt 0.0.0.0:
# 0.0.0.0 = Ollama ist von jedem Netzwerk erreichbar (Café-WLAN, Unternehmens-Netz)
# 10.8.0.10 = Ollama ist NUR über den WireGuard-Tunnel erreichbar
# Das ist die primäre Sicherheitsmaßnahme für §203-StGB-konforme Tenant-Daten.

# Dienst stoppen + hängende Prozesse beenden
brew services stop ollama
pkill -9 ollama 2>/dev/null || true
# (pkill gibt Fehler wenn nichts läuft — ist OK, daher || true)
sleep 2

# Umgebungsvariablen für macOS-Services setzen (launchctl):
launchctl setenv OLLAMA_MODELS          /Volumes/LLM/ollama
launchctl setenv OLLAMA_HOST            10.8.0.10:11434
launchctl setenv OLLAMA_KEEP_ALIVE      30m
launchctl setenv OLLAMA_MAX_LOADED_MODELS 1
# OLLAMA_MAX_LOADED_MODELS=1: verhindert simultanes Laden von zwei 17GB-Modellen
# (würde bei 48GB RAM crashen, wenn Betriebssystem + andere Apps ~10GB belegen)

# In ~/.zshrc schreiben (für neue Terminal-Sessions):
cat >> ~/.zshrc << 'EOF'

# Ollama v4 — EPPCOM LiteLLM-Stack
export OLLAMA_MODELS=/Volumes/LLM/ollama
export OLLAMA_HOST=10.8.0.10:11434
export OLLAMA_KEEP_ALIVE=30m
export OLLAMA_MAX_LOADED_MODELS=1
EOF

source ~/.zshrc

# Dienst mit neuen Einstellungen starten:
brew services start ollama
sleep 3

# Hinweis: curl zu 10.8.0.10:11434 funktioniert erst NACH WireGuard-Setup (Teil A6).
# Bis dahin ist Ollama unter dieser IP nicht erreichbar.
```

### A6: WireGuard-Schlüssel erzeugen (Mac-Seite)

```bash
# Schlüsselverzeichnis anlegen (nur für aktuellen User lesbar):
mkdir -p ~/wg
chmod 700 ~/wg

# Privaten Schlüssel erzeugen und gleichzeitig Public Key ableiten:
wg genkey | tee ~/wg/mac.key | wg pubkey > ~/wg/mac.pub

# Dateien schützen:
chmod 600 ~/wg/mac.key
chmod 644 ~/wg/mac.pub

# Public Key anzeigen — dieser Wert wird in wg0-server.conf eingetragen:
echo "Mac Public Key (→ wg0-server.conf [Peer] PublicKey):"
cat ~/wg/mac.pub

# Privaten Key anzeigen — dieser Wert wird in wg0.conf [Interface] PrivateKey:
echo "Mac Private Key (→ wg0.conf [Interface] PrivateKey):"
cat ~/wg/mac.key
```

### A7: WireGuard-Config auf dem Mac einrichten

```bash
# WireGuard-Tools installieren falls nicht vorhanden:
brew install wireguard-tools

# Config-Verzeichnis anlegen:
sudo mkdir -p /usr/local/etc/wireguard

# Template aus Repo kopieren:
sudo cp ~/path/to/eppcom-projects/infra/litellm/wg0-mac.conf.template \
        /usr/local/etc/wireguard/wg0.conf

# Keys und Server-Werte eintragen:
sudo nano /usr/local/etc/wireguard/wg0.conf
# Ersetze:
#   <REPLACE_WITH_CONTENTS_OF_~/wg/mac.key>  → Inhalt von ~/wg/mac.key
#   <REPLACE_WITH_SERVER_PUBLIC_KEY>          → cat ~/wg/server.pub (nach Server-Setup)

# WireGuard-Tunnel starten:
sudo wg-quick up wg0

# Status prüfen:
sudo wg show
# Ausgabe zeigt: interface wg0, public key, latest handshake, transfer stats

# Nach WireGuard-Start: Ollama über WG-IP testen:
curl http://10.8.0.10:11434/api/tags
# Erwartet: {"models":[...]} mit den installierten Modellen
```

### A8: pf-Firewall einrichten (Defense-in-Depth)

```bash
# pf blockiert Port 11434 auf allen Interfaces außer WireGuard (utun?).
# Selbst wenn OLLAMA_HOST falsch gesetzt wäre, ist der Port trotzdem gesperrt.

# Config-Datei schreiben:
sudo tee /etc/pf.eppcom.conf << 'EOF'
# EPPCOM: Ollama ausschließlich über WireGuard erreichbar
block in proto tcp from any to any port 11434
pass in on utun3 proto tcp from 10.8.0.1 to 10.8.0.10 port 11434
EOF

# WICHTIG: WireGuard-Interface-Name prüfen — kann utun0..utun9 sein!
ifconfig | grep -E 'utun[0-9]' | awk '{print $1}'
# Ausgabe z.B.: utun0: utun1: utun3:
# Das WG-Interface ist das, das nach 'wg-quick up wg0' erschienen ist.
# Vergleiche vor/nach 'sudo wg-quick up wg0' um das richtige utun zu finden.
# Falls nicht utun3: /etc/pf.eppcom.conf entsprechend anpassen!

# pf aktivieren:
sudo pfctl -e
sudo pfctl -f /etc/pf.eppcom.conf

# Verifikation — lokaler Zugriff soll fehlschlagen:
curl http://localhost:11434
# Erwartet: curl: (7) Failed to connect to localhost port 11434 (korrekt!)

# Verifikation — WG-Zugriff soll funktionieren:
curl http://10.8.0.10:11434/api/tags
# Erwartet: {"models":[...]}

# pf-Status anzeigen:
sudo pfctl -s rules | grep 11434
```

### A9: Pre-Warm-Cron einrichten

```bash
# Pre-Warm lädt das Tenant-Modell 30 Minuten vor Geschäftsbeginn in RAM.
# Ohne Pre-Warm: erste Anfrage des Tages wartet 5-15 Sekunden auf Modell-Load.
# Mit Pre-Warm: erste Anfrage sofort (<500ms TTFT).

# Crontab bearbeiten:
crontab -e

# Folgende Zeilen einfügen:
# Mo-Fr 7:30: qwen3.6:27b für Tenants vorladen (Geschäftsbeginn 8:00)
30 7 * * 1-5 curl -s http://10.8.0.10:11434/api/generate -d '{"model":"qwen3.6:27b","keep_alive":"13h","prompt":""}' >/dev/null 2>&1

# Sa 8:30: Samstag-Makler-Tenants (Geschäftsbeginn 9:00 oder 10:00)
30 8 * * 6 curl -s http://10.8.0.10:11434/api/generate -d '{"model":"qwen3.6:27b","keep_alive":"5h","prompt":""}' >/dev/null 2>&1

# Mo-Fr 7:30: Mac wach halten für 13 Stunden (bis 20:30)
30 7 * * 1-5 /usr/bin/caffeinate -dimsu -t 46800 >/dev/null 2>&1 &

# Sa 8:30: Samstag 8 Stunden wach (bis 16:30)
30 8 * * 6 /usr/bin/caffeinate -dimsu -t 28800 >/dev/null 2>&1 &

# Crontab prüfen:
crontab -l
```

### A10: Gesamtverifikation nach Mac-Setup

```bash
# 1. Modelle sauber auf externer SSD:
ls -lh /Volumes/LLM/ollama/models/

# 2. Ollama-Service läuft:
brew services list | grep ollama
# Erwartet: ollama   started

# 3. WireGuard aktiv:
sudo wg show
# Erwartet: interface: wg0, latest handshake: X seconds ago

# 4. Ollama über WG erreichbar (vom Hetzner-Server aus testen):
ssh root@94.130.170.167 'curl -s http://10.8.0.10:11434/api/tags | python3 -m json.tool'

# 5. Lokaler Zugriff blockiert:
curl http://localhost:11434  # → Connection refused (korrekt)

# 6. Crontab aktiv:
crontab -l | grep ollama

# 7. Backup intern löschen (erst wenn alles oben passt):
du -sh ~/.ollama   # Sollte immer noch ~75GB zeigen
rm -rf ~/.ollama   # Erst nach vollständiger Verifikation!
```

---

## Teil B: Hetzner-Server-Setup (workflows, 94.130.170.167)

Alle Befehle via SSH: `ssh root@94.130.170.167`

### B1: Crash-Diagnose (CX33 ist dauerhaftes Setup)

**Stand 2026-05-04: Alle CX-Server bei Hetzner ausverkauft. CX33 bleibt dauerhafter Router.**
CPX-Serie (dedizierte AMD) ist kein sinnvoller Ersatz: weniger Storage (40GB vs 80GB NVMe), höherer Preis.

```bash
ssh root@94.130.170.167

# OOM-Ereignisse in Kernel-Log prüfen (bei CX33 mit 8GB RAM relevant):
journalctl -k | grep -iE "oom|killed|panic" | tail -20

# Speichernutzung aktuell:
free -h

# Top-Prozesse nach RAM:
ps aux --sort=-%mem | head -10
```

Bei OOM-Events auf CX33: LiteLLM-Container-RAM-Limit in Coolify setzen (max 4GB),
Postgres `shared_buffers` reduzieren, n8n-Worker-Anzahl begrenzen.
Ein Upgrade ist erst wieder möglich wenn Hetzner CX-Server nachliefert.

### B1.5: Ollama auf CX33 einrichten (Micro-Modelle, immer verfügbar)

**Zweck:** Chatbot und Embedding bleiben 24/7 erreichbar — auch wenn Mac M4 offline ist.
CX33 läuft Ollama mit zwei Micro-Modellen resident im RAM (~1.4GB gesamt):
- `nomic-embed-text` (270MB) — Embeddings für RAG, dauerhaft resident
- `qwen3:1.7b` (1.1GB) — kleinstes brauchbares Chat-Modell, ~3-5 t/s auf CPU

LiteLLM Fallback-Kette Operational: **Mac → CX33 (immer an) → Mistral EU-Cloud**

```bash
# Script direkt auf den Hetzner-Server streamen und ausführen:
ssh root@94.130.170.167 'bash -s' < eppcom-projects/infra/litellm/hetzner-ollama-setup.sh

# Oder manuell Schritt für Schritt:
ssh root@94.130.170.167

# 1. Ollama installieren:
curl -fsSL https://ollama.com/install.sh | sh

# 2. Ollama auf 127.0.0.1 binden (NICHT extern erreichbar):
mkdir -p /etc/systemd/system/ollama.service.d
cat > /etc/systemd/system/ollama.service.d/override.conf << 'EOF'
[Service]
Environment="OLLAMA_HOST=127.0.0.1:11434"
Environment="OLLAMA_MAX_LOADED_MODELS=2"
Environment="OLLAMA_KEEP_ALIVE=-1"
EOF
systemctl daemon-reload && systemctl enable ollama && systemctl restart ollama
sleep 3

# 3. Micro-Modelle laden:
ollama pull nomic-embed-text   # ~270MB, Embeddings
ollama pull qwen3:1.7b         # ~1.1GB, Chat-Fallback

# 4. Modelle resident machen (keep_alive=-1 = nie entladen):
curl -s http://127.0.0.1:11434/api/generate \
  -d '{"model":"nomic-embed-text","keep_alive":-1,"prompt":""}' >/dev/null
curl -s http://127.0.0.1:11434/api/generate \
  -d '{"model":"qwen3:1.7b","keep_alive":-1,"prompt":""}' >/dev/null

# 5. Verifikation — beide Modelle resident:
curl -s http://127.0.0.1:11434/api/ps | python3 -m json.tool
# Erwartet: {"models":[{"name":"nomic-embed-text",...},{"name":"qwen3:1.7b",...}]}

# 6. Embedding-Test:
curl -s http://127.0.0.1:11434/api/embeddings \
  -d '{"model":"nomic-embed-text","prompt":"Test"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d['embedding']), 'dims')"
# Erwartet: 768 dims

# 7. Chat-Test:
curl -s http://127.0.0.1:11434/api/generate \
  -d '{"model":"qwen3:1.7b","prompt":"Sag kurz Hallo","stream":false}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['response'][:80])"

# 8. Sicherheit — extern NICHT erreichbar:
# Vom lokalen Rechner: curl http://94.130.170.167:11434  → Connection refused (korrekt)
```

**RAM-Budget auf CX33 nach diesem Setup:**
| Service | RAM |
|---|---|
| Coolify + Traefik | ~500MB |
| PostgreSQL | ~300MB |
| n8n | ~400MB |
| LiteLLM | ~300MB |
| **Ollama: nomic-embed-text** | ~270MB |
| **Ollama: qwen3:1.7b** | ~1.1GB |
| OS + Buffer | ~600MB |
| **Gesamt** | **~3.5GB** von 8GB |

### B2: WireGuard auf Hetzner einrichten

```bash
ssh root@94.130.170.167

# WireGuard installieren:
apt update && apt install -y wireguard

# Schlüssel erzeugen:
wg genkey | tee /etc/wireguard/server.key | wg pubkey > /etc/wireguard/server.pub
chmod 600 /etc/wireguard/server.key

# Server Public Key anzeigen (→ wg0-mac.conf Peer/PublicKey):
echo "Server Public Key:"
cat /etc/wireguard/server.pub

# WireGuard-Config anlegen:
nano /etc/wireguard/wg0.conf
# Template: eppcom-projects/infra/litellm/wg0-server.conf.template
# Ersetze:
#   <REPLACE_WITH_CONTENTS_OF_/etc/wireguard/server.key>  → Inhalt von server.key
#   <REPLACE_WITH_MAC_PUBLIC_KEY>                          → Inhalt von ~/wg/mac.pub (vom Mac)

# Tunnel starten + beim Boot aktivieren:
systemctl enable --now wg-quick@wg0

# Hetzner-Firewall: UDP 51820 öffnen
# (im Hetzner-Dashboard: Firewall → Inbound Rule: UDP 51820 von 0.0.0.0/0)

# Status prüfen:
wg show
# Erwartet: interface wg0, peer (Mac-Public-Key), latest handshake: X seconds ago

# Mac von Hetzner aus ansprechen:
curl http://10.8.0.10:11434/api/tags
# Erwartet: {"models":[...]}
```

### B3: LiteLLM in Coolify deployen

```bash
# Über Coolify-Dashboard (https://workflows.eppcom.de:8000):
# 1. New Resource → Docker Image
# 2. Image: ghcr.io/berriai/litellm:main-stable
# 3. Port: 4000:4000
# 4. Domain: litellm.eppcom.de (mit Cloudflare-Tunnel)
# 5. Volumes:
#    /data/litellm/config.yaml → /app/config.yaml
#    /data/litellm/sensitive_guard.py → /app/sensitive_guard.py
#    /data/litellm/model_selector.py → /app/model_selector.py
#    /data/litellm/business_hours.json → /app/data/business_hours.json
#    /data/litellm/ → /app/data/   (für audit logs)

# Environment Variables (in Coolify UI eintragen):
LITELLM_MASTER_KEY=sk-...          # Sicherer zufälliger Key
LITELLM_CONFIG=/app/config.yaml
ZAI_API_KEY=...                    # z.ai Account
OPENROUTER_API_KEY=...             # OpenRouter Account
MISTRAL_API_KEY=...                # Mistral La Plateforme Account
LITELLM_DB_URL=postgresql://...    # Coolify-managed Postgres für Spend-Tracking
DATABASE_URL=postgresql://...      # Gleiche DB für LiteLLM intern

# Config-Files auf Hetzner bereitstellen:
ssh root@94.130.170.167
mkdir -p /data/litellm/data

# Alle 4 Config-Files uploaden (vom lokalen Rechner):
scp eppcom-projects/infra/litellm/config.yaml         root@94.130.170.167:/data/litellm/
scp eppcom-projects/infra/litellm/sensitive_guard.py  root@94.130.170.167:/data/litellm/
scp eppcom-projects/infra/litellm/model_selector.py   root@94.130.170.167:/data/litellm/
scp eppcom-projects/infra/litellm/business_hours.json root@94.130.170.167:/data/litellm/
```

### B4: LiteLLM-Deploy verifizieren

```bash
# Health-Check:
curl https://litellm.eppcom.de/health
# Erwartet: {"status":"healthy",...}

# Modell-Liste:
curl https://litellm.eppcom.de/v1/models \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  | python3 -m json.tool | grep '"id"' | head -20

# Test-Chat über Strict-Alias (Mac muss per WG erreichbar sein):
curl https://litellm.eppcom.de/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "voicebot-strict-fast",
    "messages": [{"role": "user", "content": "Hallo, kurzer Test."}]
  }' | python3 -m json.tool

# Test Strict-Fehler (Mac WG nicht aktiv simulieren → erwartete 503-Antwort):
# Ollama auf Mac temporär stoppen: brew services stop ollama
# Dann obigen Curl wiederholen — Body soll user_message enthalten:
# {"error":"strict_backend_offline","user_message":"Unsere IT-Systeme befinden sich..."}

# Test Operational-Fallback (Mac off → Mistral antwortet):
curl https://litellm.eppcom.de/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "voicebot-op-fast",
    "messages": [{"role": "user", "content": "Test Fallback"}]
  }' | python3 -m json.tool
# Soll auch bei Mac-off antworten (Mistral-Fallback greift)
```

---

## Teil C: Datenbank-Erweiterungen (Postgres auf Hetzner)

```bash
# Verbindung zur Postgres-Datenbank:
# Coolify-managed Postgres: workflows.eppcom.de:5432 (intern im Coolify-Netz)
# Zugriff via: docker exec -it <postgres-container> psql -U eppcom

# Compliance-Tier-Spalten zu bestehender tenants-Tabelle hinzufügen:
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS default_compliance_tier TEXT NOT NULL DEFAULT 'strict',
  ADD COLUMN IF NOT EXISTS business_hours JSONB;

# Failsafe: DEFAULT 'strict' bedeutet neue Tenants ohne explizite Konfig
# landen auf Strict — lieber Wartungsmeldung als Datenleak.

# Workflow-Routes-Tabelle für per-Workflow Tier-Overrides:
CREATE TABLE IF NOT EXISTS workflow_routes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,
  workflow_key TEXT NOT NULL,           -- 'termin_buchung', 'mandantenchat', etc.
  compliance_tier TEXT NOT NULL         -- strict | operational | public
    CHECK (compliance_tier IN ('strict', 'operational', 'public')),
  available_24_7 BOOLEAN DEFAULT FALSE  -- überschreibt Geschäftszeiten-Check
);

-- Index für schnelle Tenant-Lookups:
CREATE INDEX IF NOT EXISTS idx_workflow_routes_tenant
  ON workflow_routes (tenant_id, workflow_key);

-- Beispiel: Arztpraxis mit strict-Default, aber Terminbuchung 24/7 operational:
INSERT INTO tenants (id, name, default_compliance_tier)
  VALUES ('praxis-mueller-uuid', 'Praxis Dr. Müller', 'strict');

INSERT INTO workflow_routes (tenant_id, workflow_key, compliance_tier, available_24_7)
  VALUES
  ('praxis-mueller-uuid', 'termin_buchung',   'operational', true),
  ('praxis-mueller-uuid', 'rag_query',         'operational', true),
  ('praxis-mueller-uuid', 'mandantenchat',     'strict',      false),
  ('praxis-mueller-uuid', 'symptom_triage',    'strict',      false);
```

---

## Teil D: Cline in VS Code / code-server konfigurieren

```bash
# Cline-Extension in code-server installieren:
# Extensions-Panel → "Cline" suchen → Install

# Cline-Profile anlegen (5 Profile, alle gegen litellm.eppcom.de):
# Settings → Cline → API Provider: OpenAI Compatible
# Base URL: https://litellm.eppcom.de/v1
# API Key: <LITELLM_MASTER_KEY>

# Profile:
# 1. "Architect"  → Model: architect     (GLM-4.7 via z.ai, Plan-Mode)
# 2. "Coder"      → Model: coder         (GLM-4.7-Flash lokal, Act-Mode)
# 3. "Power"      → Model: power         (GLM-5 via OpenRouter, selten)
# 4. "Architect-DS" → Model: architect-ds (DeepSeek-V3+, nur eigener Code!)
# 5. "Reason"     → Model: reason        (DeepSeek-R1, für Reasoning-Tasks)

# WICHTIG: Niemals einen Coder/Architect-Alias für Tenant-Daten verwenden!
# DeepSeek-Aliase: PRC-Hosting, KEINE Mandantendaten, nur eigener Code.
```

---

## Modell-Referenz

| Modell | Größe | Use-Case | Tier |
|---|---|---|---|
| `qwen3.6:7b` | ~5GB | Fast-Variante: Begrüßung, Öffnungszeiten, simple Slots | strict/op/public |
| `qwen3.6:27b` | ~17GB | Standard: Voicebot-Dialog, RAG-Synthese, komplexe Anfragen | strict/op |
| `glm-4.7-flash` | ~17GB | Eigene Code-Entwicklung (MoE, nur 3B aktiv) | coding |
| `nomic-embed-text` | ~270MB | Embeddings: Obsidian Smart Connections, Tenant-RAG | alle |
| `mistral-small-latest` | Cloud | Operational-Fallback Fast (via Mistral La Plateforme FR) | operational |
| `mistral-medium-latest` | Cloud | Operational-Fallback Standard | operational |
| `glm-4.7` (z.ai) | Cloud | Architect Plan-Mode, eigene Coding-Tasks | public/coding |
| `glm-5` (OpenRouter) | Cloud | Power-Tasks, selten | public/coding |

---

## Compliance-Regeln (unveränderlich)

1. **STRICT-Tier:** NIEMALS Cloud-Backend aktivieren. Mac off → HTTP 503 mit deutschem TTS-Text im Body.
2. **Operational-Tier:** Mistral La Plateforme (FR, EU-AVV) als einziger Cloud-Fallback erlaubt.
3. **Public/Coding-Tier:** z.ai, DeepSeek, OpenRouter erlaubt — NIEMALS für Tenant-Mandantendaten.
4. **`turn_off_message_logging: true`** in LiteLLM-Config: Pflicht für DSGVO (kein Prompt-Logging).
5. **Neuer Tenant:** Default `strict` in DB — Failsafe, lieber Wartungsmeldung als Datenleak.
6. **AVV-Prüfung:** Vor Aktivierung eines neuen Cloud-Providers immer AVV-Status prüfen.
7. **WireGuard-IP:** `10.8.0.10:11434` — NICHT auf `0.0.0.0` binden, pf als zweite Schicht.

---

## Bekannte Fallstricke

| Problem | Ursache | Lösung |
|---|---|---|
| `zsh: command not found: #` | zsh behandelt `#` nicht als Kommentar in interaktivem Modus | `setopt interactive_comments` in ~/.zshrc |
| `zsh: event not found: DOCTYPE` | `!` in zsh triggert History-Expansion | `setopt nobanghist` in ~/.zshrc |
| `Bootstrap failed: 5: Input/output error` | Ollama-Service-State korrupt nach env-Änderungen | `pkill -9 ollama && brew services restart ollama` |
| `{"models":[]}` nach OLLAMA_MODELS-Änderung | Modelle liegen noch in ~/.ollama, nicht in /Volumes/LLM | rsync-Migration + Ollama-Restart |
| `ollama pull qwen3-coder:7b` schlägt fehl | Slug existiert nicht in Ollama-Library | Korrekt: `qwen3.6:7b` (mit Punkt) |
| LiteLLM Install schlägt fehl (Python 3.14) | orjson/PyO3 unterstützt Python ≤3.13 | LiteLLM läuft in Coolify auf Hetzner — kein Lokal-Install nötig |
| CX-Server ausverkauft (Stand 2026-05-04) | Hetzner liefert CX-Serie gerade nicht | CX33 bleibt dauerhaftes Setup; CPX-Serie kein Ersatz (weniger Storage, teurer) |
| `at >> ~/.zshrc` hat keinen Effekt | `at` ist ein Job-Scheduler, nicht `cat` | `nano ~/.zshrc` oder `echo '...' >> ~/.zshrc` |
| Git push fehlgeschlagen (HTTPS) | Remote auf HTTPS, keine Credentials | `git remote set-url origin git@github.com:EPPCOM-Solutions/eppcom-projects.git` |
| pf-Regel für falsches utun | WG-Interface-Name variiert | `ifconfig \| grep utun` vor/nach `wg-quick up` vergleichen |

---

## Automatisiertes Setup-Script

Das komplette Mac-Setup ist in einem Script zusammengefasst:

```bash
# Script aus dem Repo laden (nach git clone auf dem Mac):
bash ~/path/to/eppcom-projects/infra/litellm/mac-setup.sh

# Das Script führt aus: zsh-Optionen → Ollama stop → rsync-Migration →
# Env setzen → Modelle prüfen/ziehen → WireGuard-Anleitung ausgeben →
# pf-Config schreiben → Pre-Warm-Cron einrichten → Verifikations-Checkliste
```

---

*Erstellt: 2026-05-03 | Repo: eppcom-projects/infra/litellm/ + immoapp/docs/*
