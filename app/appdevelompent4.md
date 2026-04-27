# LivingMatch — Übergabe-Doku Chat 4
Stand: 2026-04-27

---

## TL;DR — App läuft vollständig ✅

**https://livingmatch.app ist live und funktioniert.**

Login: `eppler@eppcom.de` / `n6rriabc!2` (sofort nach Login ändern!)

---

## Was in Chat 4 gemacht wurde

### Problem: postgres-rag nicht erreichbar von Server 2
postgres-rag läuft auf Server 1 (94.130.170.167) in Docker-Netz ohne externen Port.
LivingMatch läuft auf Server 2 (46.224.54.65) — kann Server 1 DB nicht erreichen.

**Lösung:** Neue PostgreSQL-Instanz auf Server 2 über Coolify UI erstellt:
- Name: `livingmatch-db`
- Image: postgres:18-alpine
- User: `livingmatch`
- DB: `livingmatch`
- Container-hostname: `a8wnei5s33d9n6u73ofe4cjn`
- Läuft auf Server 2 im `coolify`-Docker-Netz (gleiche Netz wie die App)

### Environment Variables gesetzt (alle via Coolify API)
| Variable | Wert |
|---|---|
| `DATABASE_URL` | `postgres://livingmatch:...@a8wnei5s33d9n6u73ofe4cjn:5432/livingmatch` |
| `JWT_SECRET` | `5ea566d546b371c7bfe1dc66d1f2a4dd644a00055b6186bc9d555614cf51771d` |
| `CRON_SECRET` | `04a9e4d7b2a9193b24365bc369ba738c43886cd9ad8e19e1` |
| `NODE_ENV` | `production` |
| `SMTP_HOST` | `smtp.ionos.de` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | `eppler@eppcom.de` |
| `SMTP_PASS` | `85234Marci!` |

### Tabellen-Init automatisch
Die App erstellt bei erstem Start automatisch:
- `livingmatch_users` (via `initDb()` in `src/lib/db.ts`)
- `livingmatch_searches`
- Superuser `eppler@eppcom.de` mit generiertem Passwort

### Coolify-Deployment
- App UUID: `nxdz457mwqx3pw6c5gapptk2`
- Projekt: Apps / production
- Server: EPPCOM-LLM (46.224.54.65)
- Netzwerk: coolify (Docker)
- Build: Nixpacks

---

## Verifizierter Stand

```
✅ https://livingmatch.app      → HTTP 307 → /login
✅ https://livingmatch.app/login → HTTP 200
✅ POST /api/auth/login          → {"message":"Login erfolgreich","user":{"id":1,"email":"eppler@eppcom.de","role":"admin"}}
✅ GET  /api/auth/me             → {"authenticated":true,"user":{"email":"eppler@eppcom.de","role":"admin"}}
✅ GET  /api/auth/searches       → {"searches":[]} (DB verbunden, leer = korrekt)
✅ GET  /api/properties          → Property-Suche funktioniert
✅ SMTP konfiguriert             → smtp.ionos.de / eppler@eppcom.de
⚠️ SSL  Traefik-Selbstsigniert  → Let's Encrypt provisioniert sich auto (kann 5-30 Min dauern)
```

---

## Bekannte Einschränkungen / Nächste Schritte

### 1. Admin-Passwort SOFORT ändern
Initial-Passwort `n6rriabc!2` ist unsicher (aus Container-Logs lesbar).
→ Nach Login Passwort-Reset nutzen oder direkt in DB ändern.

### 2. SSL-Zertifikat
Traefik/Let's Encrypt provisioniert automatisch sobald:
- Port 80 HTTP-01 Challenge erfolgreich ist
- DNS stabil zeigt auf 46.224.54.65

Status prüfen:
```bash
echo | openssl s_client -servername livingmatch.app -connect livingmatch.app:443 2>/dev/null | openssl x509 -noout -issuer
```
Ziel: `issuer=C = US, O = Let's Encrypt`

### 3. Coolify Horizon-Queue Bug
Deploys hängen manchmal in "queued". Fix:
```bash
# Auf Server 1 (94.130.170.167):
docker exec coolify php artisan horizon:restart
```
Oder im Coolify UI auf den hängenden Deploy klicken → Cancel → neu deployen.

### 4. SMTP Passwort-Reset testen
Flow: Passwort vergessen → E-Mail kommt an? Noch nicht verifiziert.

---

## Wichtige UUIDs und Verbindungsdaten

```
App UUID:         nxdz457mwqx3pw6c5gapptk2
DB UUID:          (siehe Coolify UI → livingmatch-db)
DB Hostname:      a8wnei5s33d9n6u73ofe4cjn  (intern im coolify-Netz auf Server 2)
Coolify URL:      https://coolify.eppcom.de
Token-Pfad:       ~/.coolify-env
Live Domain:      https://livingmatch.app
Server 2 IP:      46.224.54.65
```

---

## Offene Tasks (aus CLAUDE.md)

- [ ] Admin-Passwort ändern (PRIORITÄT)
- [ ] SMTP Passwort-Reset Flow testen
- [ ] SSL Let's Encrypt verifizieren
- [ ] Voicebot Latenz optimieren
- [ ] Homepage Widgets (Typebot + Voicebot) aktivieren
