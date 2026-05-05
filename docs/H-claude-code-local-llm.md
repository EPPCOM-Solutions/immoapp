# Claude Code mit lokalen LLMs

Zwei Pfade um Tokens zu sparen oder lokale Mac-Modelle zu nutzen.

## Pfad A — Ollama als MCP-Tool (empfohlen)

Der `ollama-mac` MCP-Server ist installiert. Claude entscheidet selbst, wann er
lokale Modelle für Subtasks nutzt (z.B. einfache Klassifikationen, Übersetzungen,
Boilerplate-Generierung).

**Status:**
```bash
claude mcp list
# ollama-mac: ✓ Connected (zeigt auf 10.8.0.10:11434 via WireGuard)
```

**Verwendung im Chat:**
> "Nutze das lokale qwen3.6:27b um diese 50 Produktbeschreibungen zu übersetzen"

Claude ruft den MCP auf statt den Anthropic-API zu belasten.

**Kosten:** 0 Token bei Anthropic, nur Strom auf dem Mac.

## Pfad B — Komplette Claude-Code-Session über LiteLLM

Hier wird der **gesamte** Claude-Code-Verlauf über lokale Modelle geleitet
(kein Anthropic-API-Call mehr). Sinnvoll für coding-lastige Sessions wo dein
GLM-4.7-Coder oder DeepSeek reichen.

```bash
export ANTHROPIC_BASE_URL=https://litellm.eppcom.de
export ANTHROPIC_API_KEY=sk-eppcom-a394bc64803510b556ad47b796649096f507a3b8
export ANTHROPIC_MODEL=coder        # oder: architect, power, reason
claude
```

**Modell-Aliase aus LiteLLM (Auszug Coding-Pool):**
- `architect` — GLM-4.7 via z.ai (cloud)
- `coder` — eigener GLM-4.7-flash auf Mac via WireGuard
- `power` — GLM-5 via OpenRouter (cloud)
- `reason` — DeepSeek-R1 via OpenRouter (cloud)

**Achtung:** Manche Claude-Code-Features (Tool-Use, MCP) brauchen volle
Anthropic-Kompatibilität. Pfad A ist die robustere Wahl.

## Modell-Routing-Strategie

| Aufgabe | Pfad | Modell |
|---|---|---|
| Komplexe Plan-Phase, Architektur | A (Default Anthropic) | Sonnet/Opus |
| Bulk-Klassifikation, Boilerplate | A + Ollama-MCP | qwen3.6:27b auf Mac |
| Eigenes Coding ohne Mandantendaten | B (LiteLLM-Backend) | coder/architect |
| Sehr lange Sessions, Strict-Tier | B mit `--model voicebot-strict-std` | qwen3.6:27b auf Mac |

## Verifikation

```bash
# Pfad A: MCP läuft?
claude mcp list | grep ollama-mac

# Pfad B: LiteLLM erreichbar mit Coder-Model?
curl -s https://litellm.eppcom.de/v1/chat/completions \
  -H "Authorization: Bearer sk-eppcom-a394bc64803510b556ad47b796649096f507a3b8" \
  -H "Content-Type: application/json" \
  -d '{"model":"coder","messages":[{"role":"user","content":"ping"}],"max_tokens":10}'
```
