# Stand am Morgen — LivingMatch Deploy

Letzte Session: 2026-04-26 ~01:00 nachts

## Was erledigt ist ✅

Alle bekannten Build-Fehler sind im Code gefixt und auf `main` gepusht (Repo `EPPCOM-Solutions/immoapp`):

| Commit | Was |
|---|---|
| `a27dfbd` | TypeScript: `getAllActiveSearches` returntype mit email |
| `3f4f5a2` | Doku-Snapshot (35 Dateien Status/Deploy-Notes) |
| `517798d` | Coolify-API Fix-Script |
| `c47f04f` | Import-Pfade, async cookies(), propertyType-Default |

**Lokaler Build verifiziert:** `npm run build` läuft mit Exit 0 durch — alle 16 Routen kompilieren.

## Was NICHT erledigt ist ❌

Die Coolify-Konfiguration hängt **immer noch am falschen Repo** (`marcello2304/marcello2304`). Solange das nicht umgestellt ist, zieht jeder Deploy-Versuch den uralten Code und scheitert beim Email-Type-Error.

**Du hast zwei Apps in Coolify:**
- `livingmatch` (auf Server `localhost`, Domain `https://www.livingmatch.app`) — die echte
- `clone-of-livingmatch-q7t3snqv...` (auf Server `EPPCOM-LLM`) — der Klon, der die ganze Zeit deployed wurde

**Beide sind aktuell offline (rote Punkte).**

## Was du jetzt tun musst — pick eins

### Pfad A: 5 Minuten manuell (sicher)

1. Coolify-Dashboard → klick App `livingmatch` (rechts, mit `www.livingmatch.app`)
2. **Configuration → Source/General**:
   - Repo: `EPPCOM-Solutions/immoapp`
   - Branch: `main`
   - Base Directory: `/app`
3. **Configuration → Domains**:
   - Eintragen: `https://livingmatch.app` (zusätzlich zur www-Variante)
4. **Deploy** klicken
5. Wenn grün: Klon-App stoppen + löschen

### Pfad B: 60 Sekunden + Script (automatisch)

1. Coolify → **Keys & Tokens** (linke Sidebar) → **+ Create Token**
   - Name: `claude-code`
   - Permissions: `read`, `write`, `deploy` (kein `root`)
2. Token in Code-Server speichern:
   ```bash
   cat > ~/.coolify-env <<'EOF'
   COOLIFY_URL=https://coolify.eppcom.de
   COOLIFY_TOKEN=DEIN_TOKEN
   EOF
   chmod 600 ~/.coolify-env
   ```
3. `jq` installieren (falls Mac):
   ```bash
   brew install jq
   ```
4. Erst Dry-Run zum Anschauen:
   ```bash
   bash scripts/coolify-fix-livingmatch.sh --dry-run
   ```
5. Wenn die Plan-Anzeige passt — scharf schalten:
   ```bash
   bash scripts/coolify-fix-livingmatch.sh
   ```

Das Script:
- Findet beide Apps automatisch
- Patcht die Original-`livingmatch` auf das richtige Repo
- Triggert Deploy
- Pollt 15 Min auf Erfolg
- Testet HTTPS + Cert
- Lässt den Klon stehen (zu löschen ist destruktiv → manuell)

## Wenn du mir nochmal Zugang gibst

Kommt im Chat eine neue Frage rein → schick mir einfach den Token-Pfad (`~/.coolify-env`) und ich übernehme den Rest live, mit dir mitlesend.

## Was schief gehen kann

- **Token-Permissions zu eng:** Wenn `write` fehlt, kann das Script kein PATCH machen. Token neu erstellen.
- **GitHub-Zugang:** Falls Coolify nicht auf `EPPCOM-Solutions/immoapp` zugreifen kann, musst du im Coolify unter **Sources** eine GitHub-App installieren oder das Repo public machen.
- **Build-OOM:** Server hatte beim letzten Versuch nach ~7 Min `npm i` Probleme. Falls erneut: Swap aktivieren am Server, oder `package-lock.json` einchecken (ist aktuell nicht im Repo).

## Falls Pfad A & B beide fehlschlagen

Schreib mir die exakte Fehlermeldung aus dem Coolify-Deploy-Log, ich kann die Code-Seite weiter debuggen — aber an der Coolify-UI komme ich nicht ohne Token vorbei.
