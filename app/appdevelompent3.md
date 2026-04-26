# LivingMatch — Übergabe-Doku Chat 3
Stand: 2026-04-26

---

## TL;DR — Was jetzt zu tun ist

**Ein einziger API-Call löst alles:**

```bash
source ~/.coolify-env
curl -X POST \
  -H "Authorization: Bearer $COOLIFY_TOKEN" \
  "$COOLIFY_URL/api/v1/deploy?uuid=q7t3snqv56866xe4lzrgmr0n&force=true"
```

→ Deploy läuft ~10 Min → `https://livingmatch.app` wird grün → SSL-Cert kommt automatisch.

Das war's. Alles andere weiter unten ist Kontext.

---

## Vollständiger Stand nach Chat 3

### Coolify API — Zugang vorhanden

- **Token-Pfad:** `~/.coolify-env` (COOLIFY_URL + COOLIFY_TOKEN)
- **Status:** Verifiziert, funktioniert ✅
- **Basis-URL:** `https://coolify.eppcom.de/api/v1`

### Beide Apps in Coolify

| App | UUID | Repo | Branch | BaseDir | FQDN | Status | Server |
|---|---|---|---|---|---|---|---|
| `clone-of-livingmatch-q7t3snqv...` | `q7t3snqv56866xe4lzrgmr0n` | EPPCOM-Solutions/immoapp | main | /app | `https://livingmatch.app` + `www.` | **running:unknown** | EPPCOM-LLM |
| `livingmatch` | `nxdz457mwqx3pw6c5gapptk2` | EPPCOM-Solutions/immoapp | main | /app | *keine* | exited:unhealthy | localhost |

**Der Klon ist die aktive App** — er hat die Domains, läuft auf dem richtigen Server und ist konfiguriert. Die "Original"-App (`livingmatch`) auf `localhost` ist unhealthy, hat keine Domain, irrelevant.

### DNS

- `livingmatch.app` → A: `46.224.54.65` = Server 2 = EPPCOM-LLM ✅
- Nameserver: Hetzner Robot (`ns1.your-server.de`), **nicht** Hetzner Cloud / Hetzner DNS Console
- SSL: Traefik in Coolify holt Let's Encrypt automatisch — sobald Deploy erfolgreich und Domain registriert ist

### Code — Alle Fixes auf main

Gepusht auf `EPPCOM-Solutions/immoapp`, Branch `main`, alle verifizierten Build-Fehler behoben:

| Commit | Fix |
|---|---|
| `a27dfbd` | TypeScript: `getAllActiveSearches` returntype fehlte `email` |
| `c47f04f` | Auth-Routes: Import-Pfade 3→4 Ebenen; `await cookies()`; `propertyType` default |

**Lokaler Build verifiziert:** `npm run build` → Exit 0, alle 16 Routen grün.

Der Klon läuft noch auf dem alten gecachten Build (Commit `e668a0b` — vor dem Email-Fix). Der frische Deploy zieht `c47f04f` und baut neu.

### Was NICHT stimmt (noch offen)

1. **Deploy nicht getriggert** — der Fix ist auf GitHub, aber Coolify hat noch nicht neu gebaut
2. **SSL-Zertifikat** — aktuell "TRAEFIK DEFAULT CERT" (selbstsigniert). Wird nach erfolgreichem Deploy automatisch durch Let's Encrypt ersetzt
3. **Die "Original"-App** (`nxdz457mwqx3pw6c5gapptk2`) ist unhealthy aber irrelevant — sie hat keine Domain. Kann nach dem erfolgreichen Klon-Deploy gelöscht werden
4. **Avast-SSL-Warnung** — separate Sache. Avast auf dem Mac macht HTTPS-Scanning (MITM). Wenn echter LE-Cert da ist, verschwindet die Meldung. Oder Avast HTTPS-Scanning in Einstellungen deaktivieren

---

## Schritt-für-Schritt für den Hauptchat

### Schritt 1 — Deploy triggern

```bash
source ~/.coolify-env
curl -sf -X POST \
  -H "Authorization: Bearer $COOLIFY_TOKEN" \
  "$COOLIFY_URL/api/v1/deploy?uuid=q7t3snqv56866xe4lzrgmr0n&force=true" | python3 -m json.tool
```

### Schritt 2 — Build-Status pollen

```bash
source ~/.coolify-env
DEPLOY_UUID="<aus Schritt 1 Response>"
watch -n 10 "curl -sf -H 'Authorization: Bearer $COOLIFY_TOKEN' '$COOLIFY_URL/api/v1/deployments/$DEPLOY_UUID' | python3 -c \"import sys,json; d=json.load(sys.stdin); print(d.get('status'))\""
```

Oder das fertige Script nutzen:
```bash
bash scripts/coolify-fix-livingmatch.sh
```
(Braucht `jq`: `brew install jq` auf Mac)

### Schritt 3 — Nach Erfolg verifizieren

```bash
curl -sI https://livingmatch.app | head -5
echo | openssl s_client -servername livingmatch.app -connect livingmatch.app:443 2>/dev/null | openssl x509 -noout -issuer
```

### Schritt 4 — Original-App aufräumen (optional, erst nach grünem Deploy)

```bash
source ~/.coolify-env
# Original-App stoppen + löschen (nur NACH verifiziertem Klon-Deploy!)
curl -X DELETE \
  -H "Authorization: Bearer $COOLIFY_TOKEN" \
  "$COOLIFY_URL/api/v1/applications/nxdz457mwqx3pw6c5gapptk2"
```

---

## Offene Folgepunkte (nach funktionierendem Deploy)

- [ ] SMTP Passwort testen (Passwort-Reset Flow)
- [ ] Voicebot Latenz optimieren
- [ ] Homepage Widgets (Typebot + Voicebot) aktivieren
- [ ] Package-lock.json ins Repo (stabilere npm ci builds)

---

## Wichtige Pfade und UUIDs zum Kopieren

```
Coolify URL:           https://coolify.eppcom.de
Token-Pfad:            ~/.coolify-env
Klon UUID (aktiv):     q7t3snqv56866xe4lzrgmr0n
Original UUID (inaktiv): nxdz457mwqx3pw6c5gapptk2
GitHub Repo:           EPPCOM-Solutions/immoapp
Live Domain:           https://livingmatch.app
Server (EPPCOM-LLM):   46.224.54.65
```
