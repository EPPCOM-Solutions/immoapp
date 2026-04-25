#!/usr/bin/env bash
# Reparatur-Script für LivingMatch Coolify-Deploy
#
# Voraussetzung: ~/.coolify-env existiert und enthält:
#   COOLIFY_URL=https://coolify.eppcom.de
#   COOLIFY_TOKEN=<api-token-mit-read-write-deploy>
#
# Was es tut:
#   1. Listet beide LivingMatch-Apps auf
#   2. Patcht die Original-App (livingmatch auf localhost) auf das richtige
#      Repo (EPPCOM-Solutions/immoapp), branch=main, base_directory=/app
#   3. Stellt sicher, dass beide Domains (mit und ohne www) konfiguriert sind
#   4. Triggert einen Deploy und pollt das Ergebnis
#   5. Bei Erfolg: stoppt den Klon und gibt Anweisung zum manuellen Löschen
#
# Aufruf:
#   bash scripts/coolify-fix-livingmatch.sh
#   bash scripts/coolify-fix-livingmatch.sh --dry-run    # nur anzeigen, nichts ändern

set -euo pipefail

DRY_RUN=0
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

# ---------- Setup ----------
if [[ ! -f "$HOME/.coolify-env" ]]; then
  echo "FEHLER: ~/.coolify-env nicht gefunden. Lege die Datei an mit:"
  echo "  COOLIFY_URL=https://coolify.eppcom.de"
  echo "  COOLIFY_TOKEN=<dein-token>"
  exit 1
fi

# shellcheck disable=SC1091
source "$HOME/.coolify-env"

: "${COOLIFY_URL:?COOLIFY_URL fehlt in ~/.coolify-env}"
: "${COOLIFY_TOKEN:?COOLIFY_TOKEN fehlt in ~/.coolify-env}"

API="$COOLIFY_URL/api/v1"
AUTH=(-H "Authorization: Bearer $COOLIFY_TOKEN" -H "Content-Type: application/json")

curl_api() {
  curl -sS "${AUTH[@]}" "$@"
}

# ---------- 1. API erreichbar? ----------
echo "→ Teste API-Zugriff..."
if ! curl_api -f "$API/applications" >/tmp/apps.json; then
  echo "FEHLER: Coolify-API nicht erreichbar oder Token ungültig."
  exit 1
fi
echo "  OK"

# ---------- 2. Apps finden ----------
echo "→ Suche LivingMatch-Apps..."
ORIGINAL_UUID=$(jq -r '.[] | select(.name=="livingmatch") | .uuid' /tmp/apps.json)
CLONE_UUID=$(jq -r '.[] | select(.name | startswith("clone-of-livingmatch")) | .uuid' /tmp/apps.json)

if [[ -z "$ORIGINAL_UUID" ]]; then
  echo "FEHLER: App 'livingmatch' nicht gefunden."
  jq -r '.[] | "  - \(.name) [\(.uuid)]"' /tmp/apps.json
  exit 1
fi

echo "  Original-App livingmatch UUID: $ORIGINAL_UUID"
[[ -n "$CLONE_UUID" ]] && echo "  Klon-UUID:                     $CLONE_UUID"

# ---------- 3. Aktuelle Config anzeigen ----------
echo "→ Aktuelle Config der Original-App:"
curl_api "$API/applications/$ORIGINAL_UUID" | \
  jq '{git_repository, git_branch, base_directory, fqdn, status}'

# ---------- 4. Patch ausführen ----------
PATCH_BODY=$(jq -n \
  --arg repo "https://github.com/EPPCOM-Solutions/immoapp" \
  --arg branch "main" \
  --arg base "/app" \
  --arg fqdn "https://livingmatch.app,https://www.livingmatch.app" \
  '{
    git_repository: $repo,
    git_branch: $branch,
    base_directory: $base,
    fqdn: $fqdn
  }')

echo "→ Patch-Plan:"
echo "$PATCH_BODY" | jq .

if [[ $DRY_RUN -eq 1 ]]; then
  echo "[DRY-RUN] kein PATCH ausgeführt"
  exit 0
fi

echo "→ PATCH /applications/$ORIGINAL_UUID ..."
curl_api -X PATCH "$API/applications/$ORIGINAL_UUID" -d "$PATCH_BODY" | jq -r '.message // "ok"'

# ---------- 5. Deploy triggern ----------
echo "→ Trigger Deploy..."
DEPLOY_RESP=$(curl_api -X POST "$API/deploy?uuid=$ORIGINAL_UUID&force=true")
DEPLOY_UUID=$(echo "$DEPLOY_RESP" | jq -r '.deployments[0].deployment_uuid // empty')

if [[ -z "$DEPLOY_UUID" ]]; then
  echo "WARN: Kein Deploy-UUID in Response. Antwort:"
  echo "$DEPLOY_RESP" | jq .
  echo "Manuell prüfen unter: $COOLIFY_URL"
  exit 1
fi
echo "  Deployment UUID: $DEPLOY_UUID"

# ---------- 6. Polling ----------
echo "→ Warte auf Deploy (max 15 Min)..."
for i in $(seq 1 90); do
  sleep 10
  STATUS=$(curl_api "$API/deployments/$DEPLOY_UUID" | jq -r '.status')
  printf "  [%02d] status=%s\n" "$i" "$STATUS"
  case "$STATUS" in
    finished|success) echo "✅ Deploy erfolgreich"; break ;;
    failed|error|cancelled) echo "❌ Deploy fehlgeschlagen"; break ;;
  esac
done

# ---------- 7. App-Status final prüfen ----------
echo "→ App-Status final:"
curl_api "$API/applications/$ORIGINAL_UUID" | jq '{status, fqdn}'

# ---------- 8. SSL & HTTP testen ----------
echo "→ Teste https://livingmatch.app ..."
HTTP_CODE=$(curl -sk -o /dev/null -w "%{http_code}" --max-time 15 https://livingmatch.app || echo "000")
echo "  HTTP-Code: $HTTP_CODE"

echo "→ Cert-Issuer prüfen..."
echo | openssl s_client -servername livingmatch.app -connect livingmatch.app:443 2>/dev/null | \
  openssl x509 -noout -issuer 2>/dev/null || echo "  (cert nicht abrufbar)"

# ---------- 9. Klon-Hinweis ----------
if [[ -n "$CLONE_UUID" ]]; then
  echo ""
  echo "ℹ️  Der Klon ($CLONE_UUID) ist NICHT gelöscht worden — bitte erst manuell"
  echo "   verifizieren, dass die Original-App stabil läuft, dann im Coolify-UI"
  echo "   stoppen + löschen. Oder mit folgendem Befehl wenn alles grün ist:"
  echo ""
  echo "   curl -X DELETE -H 'Authorization: Bearer \$COOLIFY_TOKEN' \\"
  echo "     '$API/applications/$CLONE_UUID'"
fi

echo ""
echo "Fertig. Browser-Test: https://livingmatch.app"
