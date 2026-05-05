#!/bin/bash
# ============================================================
# LLM Provider Switcher für Claude Code
# Usage:
#   source switch-llm.sh anthropic   → Standard (Claude via Anthropic)
#   source switch-llm.sh openrouter  → OpenRouter (freie/günstige Modelle)
#   source switch-llm.sh gemini      → Google Gemini CLI
# ============================================================

PROVIDER="${1:-anthropic}"

case "$PROVIDER" in
  openrouter)
    if [ -z "$OPENROUTER_API_KEY" ]; then
      echo "❌ OPENROUTER_API_KEY nicht gesetzt!"
      echo "   Hol dir einen Key auf: https://openrouter.ai/keys"
      echo "   Dann: export OPENROUTER_API_KEY=sk-or-..."
      return 1 2>/dev/null || exit 1
    fi
    export ANTHROPIC_BASE_URL="https://openrouter.ai/api/v1"
    export ANTHROPIC_API_KEY="$OPENROUTER_API_KEY"
    echo "✅ OpenRouter aktiv"
    echo "   Empfohlene Modelle (kostenlos/günstig):"
    echo "   - google/gemini-2.5-pro-exp-03-25 (kostenlos)"
    echo "   - meta-llama/llama-4-scout (kostenlos)"
    echo "   - deepseek/deepseek-chat-v3-0324 (günstig)"
    echo ""
    echo "   Model wechseln: claude --model google/gemini-2.5-pro-exp-03-25"
    ;;
  anthropic)
    unset ANTHROPIC_BASE_URL
    if [ -f /root/.env.keys ]; then
      export ANTHROPIC_API_KEY="$(grep ANTHROPIC_API_KEY /root/.env.keys | cut -d= -f2)"
    fi
    echo "✅ Anthropic (Standard) aktiv"
    ;;
  gemini)
    echo "✅ Gemini CLI:"
    echo "   npm install -g @google/gemini-cli"
    echo "   gemini  (Login mit Google-Account)"
    ;;
  *)
    echo "Usage: source switch-llm.sh [anthropic|openrouter|gemini]"
    ;;
esac
