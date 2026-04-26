# LivingMatch.app — Deployment-Status & Reparatur-Übergabe

Stand: 2026-04-26 — Übergabe-Doku für die Fortsetzung in einem neuen Chat.

## TL;DR

- **Code-Fixes sind alle erledigt und auf GitHub** (`EPPCOM-Solutions/immoapp`, `main`).
- **App ist offline** (HTTP 503 auf `https://livingmatch.app`), weil Coolify noch auf dem **falschen Repo** (`marcello2304/marcello2304`) hängt.
- **Letzter Schritt** (Coolify-UI oder API-Token) muss vom User durchgeführt werden — die Coolify-API ist von hier aus ohne Token nicht erreichbar.

## Faktenlage

### DNS / Erreichbarkeit
| Check | Ergebnis |
|---|---|
| `livingmatch.app` A-Record | `46.224.54.65` (Server 2 / EPPCOM-LLM) |
| `www.livingmatch.app` A-Record | `46.224.54.65` |
| HTTPS-Port 443 | ✓ erreichbar |
| SSL-Zertifikat | ✗ selbstsigniert (Traefik-Default, kein Let's Encrypt) |
| HTTP-Status | **503 Service Unavailable** (Traefik findet kein Backend) |

### Server / Infrastruktur
- **Server 1**: `94.130.170.167` (Hetzner) — Coolify, code-server, voice-agent, jitsi, n8n, postgres-rag, livekit
- **Server 2**: `46.224.54.65` (EPPCOM-LLM, 80 GB) — Ollama LLMs, Ziel-Server für LivingMatch-Migration
- **Coolify**: https://coolify.eppcom.de (auf Server 1)
- **Traefik** (`coolify-proxy`) ist der Reverse-Proxy auf beiden Servern

### Repos
- **Aktives Repo:** `EPPCOM-Solutions/immoapp` (auf GitHub)
  - Lokaler Pfad im Code-Server: `/home/coder/eppcom`
  - Lokaler Pfad auf Mac: `/Users/marceleppler/Desktop/business/projects/antigravProject`
- **Coolify zeigt fälschlich auf:** `marcello2304/marcello2304` ← das ist die Wurzel des Problems

## Was bereits gefixt + gepusht ist

Alle Build-Fehler sind im Code repariert. Lokaler `npm run build` läuft mit Exit 0 durch — alle 16 Routen kompilieren.

| Commit | Inhalt |
|---|---|
| `a27dfbd` | TypeScript: `getAllActiveSearches` Returntype mit `email` (`Promise<(SavedSearch & { email: string })[]>`) |
| `3f4f5a2` | Doku-Snapshot (35 Dateien Status/Deploy-Notes) |
| `517798d` | Coolify-API Fix-Script (`scripts/coolify-fix-livingmatch.sh`) |
| `c47f04f` | Import-Pfade (4-Punkte statt 3), `await cookies()` (Next 15+), `propertyType`-Default |
| `3aaf88a` | `STATUS_NEXT_MORNING.md` + `jq`-Check im Script |

### Details zu `c47f04f`
- `auth/admin`, `login`, `me`, `forgot-password` benutzten 3-Punkt-Imports für `../../../lib/*`, aber die Routen sind 4 Ebenen tief → korrigiert
- `cookies()` ist async in Next.js 15+ → `await` an allen 8 Aufrufstellen ergänzt
- `checkAdminAccess` war sync, braucht jetzt `await cookies()` → async gemacht und an 4 Aufrufstellen awaited
- `aggregateProperties`: `propertyType` ist optional in `SearchSettings`, aber `fetch*` erwarten `string` → Default auf `''`

## Was NOCH offen ist

**Du hast zwei Apps in Coolify:**
- `livingmatch` (Server `localhost`, Domain `https://www.livingmatch.app`) — die echte
- `clone-of-livingmatch-q7t3snqv...` (Server `EPPCOM-LLM`) — der Klon, der wegen falschem Repo immer scheitert

Beide sind aktuell offline (rote Punkte in Coolify). Das DNS zeigt allerdings auf Server 2 (Klon-Ziel), während die Original-App auf Server 1 (`localhost`) konfiguriert ist — hier muss eines von beiden konsistent gemacht werden.

## Pfad A — Manuell in Coolify (5 Min)

1. https://coolify.eppcom.de öffnen
2. App **`livingmatch`** anklicken (mit `www.livingmatch.app`)
3. **Configuration → Source/General**:
   - Repo: `EPPCOM-Solutions/immoapp`
   - Branch: `main`
   - Base Directory: `/app`
4. **Configuration → Domains**: zusätzlich `https://livingmatch.app` (ohne www) eintragen
5. **Deploy** klicken
6. Wenn grün: Klon-App stoppen und löschen

## Pfad B — Automatisch via API-Token (60 Sekunden Setup, dann läuft Script)

### Token erstellen
1. https://coolify.eppcom.de → linke Sidebar → **Keys & Tokens** → **+ Create Token**
2. Name: `claude-code`, Permissions: `read`, `write`, `deploy` (kein `root`)

### Token im Code-Server hinterlegen
```bash
cat > ~/.coolify-env <<'EOF'
COOLIFY_URL=https://coolify.eppcom.de
COOLIFY_TOKEN=<DEIN_TOKEN>
EOF
chmod 600 ~/.coolify-env
```

### Falls auf dem Mac: jq installieren
```bash
brew install jq
```

### Erst Dry-Run, dann scharf
```bash
bash scripts/coolify-fix-livingmatch.sh --dry-run
bash scripts/coolify-fix-livingmatch.sh
```

Das Script:
- Findet beide Apps (Original + Klon) per Name automatisch
- Patcht die Original-App auf Repo `EPPCOM-Solutions/immoapp`, Branch `main`, Base `/app`, FQDN beide Varianten
- Triggert Deploy via API
- Pollt 15 Min auf Erfolg
- Testet HTTPS + Cert-Issuer
- Lässt den Klon stehen (Löschen ist destruktiv → manuell)

Script-Pfad im Repo: [scripts/coolify-fix-livingmatch.sh](scripts/coolify-fix-livingmatch.sh)

## Was schiefgehen kann

- **Token-Permissions zu eng:** Wenn `write` fehlt, kein PATCH möglich. Token neu erstellen.
- **GitHub-Zugang:** Falls Coolify das Repo `EPPCOM-Solutions/immoapp` nicht erreicht → in Coolify unter **Sources** eine GitHub-App installieren oder das Repo public machen.
- **Build-OOM:** Letzter Versuch hatte nach ~7 Min `npm i` Probleme. Falls erneut: Swap am Server aktivieren oder `package-lock.json` einchecken (aktuell **nicht** im Repo).
- **DNS-Mismatch:** DNS zeigt auf Server 2 (`46.224.54.65`), Coolify-App liegt aktuell auf `localhost` (Server 1). Nach Fix entweder DNS umlegen oder App in Coolify auf Server 2 verschieben.

## Verifikation nach Deploy

```bash
# Antwort + SSL-Cert
curl -sI https://livingmatch.app | head -5
echo | openssl s_client -servername livingmatch.app -connect livingmatch.app:443 2>/dev/null | openssl x509 -noout -issuer

# Erwartung: HTTP/2 200, Issuer = Let's Encrypt
```

## Zusatz-Info aus dieser Session

### Code-Server / Auth (Nebenprojekt — nicht livingmatch direkt, aber im selben Push)
- Commit `8389e09` `feat(auth-proxy): add code.eppcom.de auth layer with EPPCOM branding`
- auth_proxy.py Container läuft auf Server 1 (`docker ps` → `auth-proxy`, Image `python:3.11-slim`, Code unter `/app/auth_proxy.py`)
- Code-Server-Container: `code-server` (codercom/code-server), Port-Mapping `8443:8080`
- Eingebaute code-server-Auth wurde deaktiviert (`auth: none` in `/home/coder/.config/code-server/config.yaml`), damit auth_proxy als alleinige Auth-Schicht keinen Redirect-Loop mehr verursacht
- Login: E-Mail `eppler@eppcom.de`, Passwort `mX7kP3vQ9nL5wR2j` (Default — sollte nach erstem Login geändert werden)
- `auth_users.json` (enthält Passwort-Hash) ist gitignored

### Wichtige Pfade & Zugänge
- **Code-Server (Browser-IDE)**: https://code.eppcom.de
- **Coolify**: https://coolify.eppcom.de (Server 1)
- **Admin UI**: https://appdb.eppcom.de
- **Voice Widget**: https://appdb.eppcom.de/voice-widget
- **n8n / RAG**: https://workflows.eppcom.de/webhook/rag-query

### Git-Setup im Code-Server
- Remote `origin`: `git@github.com:EPPCOM-Solutions/immoapp.git` (SSH, funktioniert)
- Letzter Push: `8389e09` (a27dfbd..8389e09) auf `main`

## Nächster Chat — Empfohlene Eröffnung

> "Ich möchte LivingMatch.app deployen. Lies appdevelompent1.md und STATUS_NEXT_MORNING.md, dann führe Pfad B aus. Hier ist der Coolify-Token: …"

Damit kann der nächste Chat in unter 5 Minuten loslegen, ohne dass der ganze Kontext nochmal aufgebaut werden muss.
