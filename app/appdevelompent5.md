# LivingMatch — Übergabe-Doku Chat 5
Stand: 2026-04-30

---

## TL;DR — Alles läuft, nur User-Tasks offen

**https://livingmatch.app** ist live, SSL aktiv, Login + Reset-Mail + Passwort-ändern-Modal funktionieren.

---

## Was in Chat 5 gemacht wurde

### 1. Voicebot-Latenz optimiert (~600ms gespart) — `73c4674`
- Whisper: `beam_size 2 → 1`, `best_of=1` (greedy STT, ~400ms)
- VAD silence: `300ms → 250ms`
- RAG timeout: `1.0s → 0.8s`

### 2. ICANN Domain-Suspension behoben
- **Was passiert war**: livingmatch.app wurde am 2026-04-28 17:22 UTC vom Registrar Key-Systems (HEXONET) auf "on hold" gesetzt — exakt 15 Tage nach Registrierung, weil die WHOIS-Email-Verifizierung nicht bestätigt wurde.
- **Symptom**: Public DNS zeigte auf `94.23.162.163` (Suspension-Parking-Page), nicht mehr auf `46.224.54.65` (Server 2). Nameserver auf `ns1/ns2.emailverification.info` umgeleitet.
- **Fix**: Verification-Mail von `noreply@emailverification.info` (vom 2026-04-13) im Postfach `eppler@eppcom.de` gefunden, Link geklickt → DNS innerhalb von ~30 Min zurück auf Hetzner-NS (`ns1.your-server.de`).
- **Memory**: `project_domain_suspension.md` dokumentiert den Mechanismus für künftige Domain-Käufe.

### 3. Passwort-ändern-Modal in Profileinstellungen — `16de2bf`
- Ersetzt das hässliche `prompt()`/`alert()` in `ProfileVault.tsx`
- Inline-Modal mit:
  - Neues Passwort + Bestätigung
  - Validierung: min. 8 Zeichen, beide müssen übereinstimmen
  - Inline-Error/Success-Feedback (kein alert mehr)
  - Loading-State, Enter-to-submit, Click-Outside-to-close
- TypeCheck sauber (`npx tsc --noEmit` exit 0)

### 4. Forgot-Password-Flow vollständig verifiziert
- `/api/auth/forgot-password` generiert random PW (8 Zeichen + `!` + Ziffer), hashed, schreibt in DB, sendet via SMTP (`smtp.ionos.de:587` als `eppler@eppcom.de`).
- Login-Seite hat bereits "Passwort vergessen?"-Toggle (Zeile 116–125 in `login/page.tsx`) — Mail kam erfolgreich an, neuer Login funktioniert.

---

## Verifizierter Live-Stand

```
✅ https://livingmatch.app           → HTTP 307 → /login
✅ /login                            → HTTP 200
✅ POST /api/auth/login              → {"message":"Login erfolgreich","user":{...}}
✅ GET  /api/auth/me                 → {"authenticated":true,...}
✅ GET  /api/auth/searches           → {"searches":[]}
✅ GET  /api/properties              → 400 ("Locations required") — korrektes Verhalten
✅ POST /api/auth/forgot-password    → 200 + Mail kommt an
✅ SSL: Let's Encrypt R13            → notAfter Jul 27 2026
✅ DNS: ns1.your-server.de (Hetzner) → 46.224.54.65
```

---

## Noch offen — User-Aktionen

### 1. Coolify-Redeploy für Modal-UI (2 Min)
Das Passwort-Modal aus `16de2bf` ist im Repo aber noch nicht live. Coolify-UI → `livingmatch` → "Redeploy".

### 2. Admin-Passwort ändern (1 Min)
Initial-PW `n6rriabc!2` immer noch aktiv, aus Logs lesbar. Nach Login → Profil → "Passwort ändern" → neues sicheres PW setzen.

### 3. SSH-Public-Key auf Server 1 + 2 (2 Min)
Mein Public-Key ist nicht eingetragen. In Coolify-Terminal beider Server (Server 1 = `localhost`, Server 2 = `EPPCOM-LLM`) ausführen:
```bash
echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIMPR1kVSCJeKuslAwYuagV74WpkXNfNwSf7nDZblodGc git@eppcom.de" >> /root/.ssh/authorized_keys
```
Danach kann ich Docker/Postgres/Logs direkt steuern, ohne Coolify-API-Umweg.

### 4. Ionos FTP-Zugang für Homepage-Deploy (5 Min)
`www.eppcom.de` läuft auf Ionos-Webhosting (Apache, kein Coolify). Für `index_deploy.php` mit Voicebot-Widget brauche ich SFTP-Credentials aus Ionos-Kundencenter → Hosting → SFTP/SSH-Zugang.

---

## Wichtige UUIDs / URLs (unverändert)

```
App UUID:      nxdz457mwqx3pw6c5gapptk2
DB Hostname:   a8wnei5s33d9n6u73ofe4cjn  (intern, Server 2)
Coolify URL:   https://coolify.eppcom.de
Token-Pfad:    ~/.coolify-env
Server 2 IP:   46.224.54.65
Live Domain:   https://livingmatch.app
SSL-Issuer:    Let's Encrypt R13 (gültig bis 2026-07-27)
```

---

## Bekannte Coolify v4.0.0-beta.469 Bugs (für künftige Sessions)

- **Horizon-Queue stuck**: Deploys hängen in `queued` → `docker exec coolify php artisan horizon:restart` auf Server 1
- **Env-Vars über API**: PATCH funktioniert nur ohne `uuid`-Feld im Body, mit `key`+`value`
- **DB-Erstellung via API**: PostgreSQL-Resources nur über UI anlegen
- **FQDN-Patch via API**: Domains nur über UI ändern

---

## Checkliste für Chat 6

- [ ] Coolify-Redeploy ausgelöst → Modal live
- [ ] Admin-PW geändert
- [ ] SSH-Key auf Server 1 + 2 eingetragen
- [ ] Ionos-FTP-Daten erhalten → Homepage-Widget deployen
- [ ] (Optional) Voicebot weiter tunen
- [ ] (Optional) Backup-Strategie für livingmatch-db
