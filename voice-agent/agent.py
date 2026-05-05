"""
Nexo — EPPCOM Voice Bot Agent (livekit-agents v1.4+)
- STT: Local Whisper small INT8 (zero-cost, self-hosted)
- LLM: qwen3-voice:latest via Ollama (1.2s warm, best German quality)
- TTS: Cartesia Sonic-2 (ultra-natürlich, <200ms)
- VAD: Silero (300ms endpointing)
- RAG: n8n Webhook für kontextuelle Antworten

Deployment: Docker auf Server 1 via Coolify, Ollama auf Server 2 (46.224.54.65)
Target: <3s End-to-End (STT→LLM→TTS)
"""
import asyncio
import hashlib
import json
import logging
import os
import re
from typing import AsyncIterable, Optional

import httpx
from livekit import rtc
from livekit.agents import Agent, AgentSession, APIConnectOptions, JobContext, WorkerOptions, cli, llm
from livekit.plugins import cartesia, openai, silero


# ─── Logging Setup ──────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("nexo-voice")

# ─── Configuration via Environment ──────────────────────────────────────
LIVEKIT_URL = os.getenv("LIVEKIT_URL", "ws://livekit:7880")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY", "devkey")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET", "secret")

# STT Configuration
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY", "")
DEEPGRAM_MODEL = os.getenv("DEEPGRAM_MODEL", "nova-2")

# Local Whisper Configuration (self-hosted, zero-cost)
USE_LOCAL_WHISPER = os.getenv("USE_LOCAL_WHISPER", "true").lower() == "true"
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "tiny")
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "auto")

# LLM Configuration (Ollama local)
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://10.0.0.3:11434")
# qwen3-nothink: kein <think>-Tag → TTS startet sofort, ~500ms schneller
_raw_model = os.getenv("OLLAMA_MODEL", "qwen3-nothink:latest")
OLLAMA_MODEL = "qwen3-nothink:latest" if _raw_model == "qwen3-voice:latest" else _raw_model

# TTS Configuration (Cartesia Primary - Ultra-Low Latency)
CARTESIA_API_KEY = os.getenv("CARTESIA_API_KEY", "")
CARTESIA_VOICE_ID = os.getenv("CARTESIA_VOICE_ID", "default")
CARTESIA_MODEL = "sonic-2"

# OpenAI TTS as fallback
OPENAI_API_KEY_EXPLICIT = os.getenv("OPENAI_API_KEY", "").strip()
OPENAI_TTS_ENABLED = bool(OPENAI_API_KEY_EXPLICIT and not OPENAI_API_KEY_EXPLICIT.startswith("sk-dummy"))

# RAG Configuration (n8n Webhook)
RAG_WEBHOOK_URL = os.getenv("RAG_WEBHOOK_URL", "")
RAG_WEBHOOK_SECRET = os.getenv("RAG_WEBHOOK_SECRET", "")
RAG_TENANT_ID = os.getenv("RAG_TENANT_ID", "a0000000-0000-0000-0000-000000000001")
RAG_CACHE_FILE = os.getenv("RAG_CACHE_FILE", "/tmp/rag_cache.json")
RAG_PREWARM_ENABLED = os.getenv("RAG_PREWARM_ENABLED", "true").lower() == "true"
RAG_PREWARM_TIMEOUT_S = float(os.getenv("RAG_PREWARM_TIMEOUT_S", "60"))

# Voice Agent Configuration
VAD_THRESHOLD = float(os.getenv("VAD_THRESHOLD", "0.5"))
VAD_SILENCE_DURATION_MS = int(os.getenv("VAD_SILENCE_DURATION_MS", "250"))

# Streaming
VOICEBOT_STREAMING_ENABLED = os.getenv("VOICEBOT_STREAMING_ENABLED", "true").lower() == "true"

# ─── System Prompt ──────────────────────────────────────────────────────
SYSTEM_PROMPT = """Du bist Nexo, der KI-Assistent von Eppkom Solutions. Antworte ausschließlich auf Deutsch.

REGELN (absolut einhalten):
- Maximal 2 kurze Sätze. Du sprichst, schreibst nicht.
- Nur Deutsch. Niemals Englisch, Chinesisch oder andere Sprachen.
- NIEMALS begrüßen oder vorstellen — das ist bereits geschehen. Beginne direkt mit der Antwort.
- Keine Füllwörter wie "Natürlich", "Gerne", "Selbstverständlich", "Hallo".
- Wenn du eine Eingabe nicht verstehst: Sage genau "Entschuldigung, das habe ich nicht verstanden." — nichts anderes.
- Merke dir den Namen des Nutzers und nutze ihn ab dem Moment, wo du ihn kennst.
- Wenn du etwas nicht weißt: "Das weiß ich leider nicht."
- Schreibe immer "Eppkom" (nie "EPPCOM").

Eppkom Solutions entwickelt KI-Chatbots, Voicebots und automatisiert Geschäftsprozesse für KMU in Deutschland. Self-Hosted auf deutschen Servern, DSGVO-konform."""


# ─── RAG Context Caching ───────────────────────────────────────────────
# Persistent on disk (survives container restarts) + normalized keys
# (so "Was kostet das?" and "was kostet das" share a cache entry).
_rag_cache: dict[str, str] = {}


def _normalize_query(query: str) -> str:
    """Lowercase, strip punctuation, collapse whitespace."""
    q = query.lower().strip()
    q = re.sub(r"[^\w\säöüß]", " ", q, flags=re.UNICODE)
    q = re.sub(r"\s+", " ", q)
    return q


def _query_hash(query: str) -> str:
    return hashlib.md5(_normalize_query(query).encode()).hexdigest()


def _load_rag_cache() -> None:
    """Load persisted cache from disk on startup. Best-effort."""
    global _rag_cache
    try:
        if os.path.exists(RAG_CACHE_FILE):
            with open(RAG_CACHE_FILE, "r", encoding="utf-8") as f:
                _rag_cache = json.load(f)
            logger.info(f"RAG cache loaded: {len(_rag_cache)} entries from {RAG_CACHE_FILE}")
    except Exception as e:
        logger.warning(f"RAG cache load failed: {e}")
        _rag_cache = {}


def _persist_rag_cache() -> None:
    """Write cache to disk. Best-effort, non-blocking-friendly."""
    try:
        tmp = RAG_CACHE_FILE + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(_rag_cache, f, ensure_ascii=False)
        os.replace(tmp, RAG_CACHE_FILE)
    except Exception as e:
        logger.warning(f"RAG cache persist failed: {e}")


# Common customer queries — pre-warmed on startup so the 0.8s voice timeout
# almost always hits the cache instead of waiting for the slow 17-50s webhook.
PREWARM_QUERIES = [
    "Was ist Eppkom?",
    "Wer ist der Gründer?",
    "Wie kann ich euch kontaktieren?",
    "Was kostet ein Chatbot?",
    "Was kostet ein Voicebot?",
    "Welche Branchen unterstützt ihr?",
    "Wie lange dauert die Einführung?",
    "Wie funktioniert RAG?",
    "Welche Sprachen werden unterstützt?",
    "Habt ihr Referenzkunden?",
    "Wie steht es um Datenschutz und DSGVO?",
    "Wo werden die Daten gespeichert?",
    "Welche Vertragslaufzeit gibt es?",
    "Wie kann ich kündigen?",
    "Welcher Support ist enthalten?",
    "Was ist der Unterschied zu ChatGPT?",
    "Was passiert wenn der Bot etwas nicht weiß?",
    "Bietet ihr eine Live-Demo an?",
    "Wie sieht ein Erstgespräch aus?",
    "Brauche ich ein eigenes IT-Team?",
]


async def fetch_rag_context(query: str, timeout: float = 0.8) -> Optional[str]:
    """Fetch RAG context from n8n webhook. Cached per normalized query."""
    if not RAG_WEBHOOK_URL:
        return None

    qhash = _query_hash(query)
    if qhash in _rag_cache:
        logger.debug(f"RAG cache HIT: {qhash[:8]}")
        return _rag_cache[qhash]

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(RAG_WEBHOOK_URL, json={
                "tenant_id": RAG_TENANT_ID,
                "query": query,
                "transcript": query,
                "top_k": 3,
            })
            response.raise_for_status()
            data = response.json()

            if isinstance(data, dict):
                answer = (data.get("answer") or data.get("response")
                          or data.get("system_prompt") or data.get("context") or "")
                if answer:
                    _rag_cache[qhash] = answer
                    _persist_rag_cache()
                    logger.info(f"RAG: {len(answer)} chars fetched and cached")
                    return answer

            logger.debug(f"RAG: no answer in response keys: {list(data.keys())}")
            return None
    except (asyncio.TimeoutError, httpx.TimeoutException):
        logger.warning(f"RAG timeout ({timeout}s) — proceeding without context")
        return None
    except Exception as e:
        logger.warning(f"RAG fetch failed: {e}")
        return None


async def prewarm_rag_cache() -> None:
    """Fire pre-warm queries with a generous timeout so the cache fills.
    Runs as a background task — does not block agent startup."""
    if not RAG_WEBHOOK_URL or not RAG_PREWARM_ENABLED:
        return
    missing = [q for q in PREWARM_QUERIES if _query_hash(q) not in _rag_cache]
    if not missing:
        logger.info(f"RAG pre-warm skipped: all {len(PREWARM_QUERIES)} queries cached")
        return
    logger.info(f"RAG pre-warm: fetching {len(missing)} of {len(PREWARM_QUERIES)} queries")
    for q in missing:
        try:
            await fetch_rag_context(q, timeout=RAG_PREWARM_TIMEOUT_S)
        except Exception as e:
            logger.warning(f"RAG pre-warm failed for '{q[:40]}': {e}")
    logger.info(f"RAG pre-warm done: {len(_rag_cache)} entries cached")


# Load persisted cache at import time.
_load_rag_cache()


# ─── Think-Tag Filter (qwen3 always emits <think></think> prefix) ───────
async def _strip_think_chunks(stream: AsyncIterable) -> AsyncIterable:
    """
    Filter out <think>...</think> blocks from qwen3 LLM output.
    qwen3-nothink always emits an empty <think>\\n\\n</think>\\n\\n prefix.
    This strips it token by token so TTS never receives it.
    """
    in_think = False
    think_done = False
    buf = ""

    async for chunk in stream:
        if think_done:
            yield chunk
            continue

        # Extract token text safely
        try:
            token = chunk.choices[0].delta.content or ""
        except (AttributeError, IndexError, TypeError):
            yield chunk
            continue

        buf += token

        # Haven't started yet — check if we begin with <think>
        if not in_think and not think_done:
            if "<think>" in buf:
                in_think = True
            elif buf.strip() and "<" not in buf:
                # No think tag in first tokens → model outputting directly
                think_done = True
                yield chunk
                continue

        if in_think:
            if "</think>" in buf:
                in_think = False
                think_done = True
                # Yield any content after </think>
                after = buf.split("</think>", 1)[1].lstrip("\n")
                if after:
                    # Rebuild a minimal chunk with the remaining content
                    try:
                        import copy
                        leftover = copy.deepcopy(chunk)
                        leftover.choices[0].delta.content = after
                        yield leftover
                    except Exception:
                        pass
            # While in think block: skip
            continue

        yield chunk


# ─── STT Provider ──────────────────────────────────────────────────────
def _get_stt():
    if USE_LOCAL_WHISPER:
        logger.info(f"STT: Local Whisper-{WHISPER_MODEL} (INT8, self-hosted)")
        try:
            from local_whisper_stt import LocalWhisperSTT
            return LocalWhisperSTT(model_size=WHISPER_MODEL, device=WHISPER_DEVICE)
        except Exception as e:
            logger.warning(f"Local Whisper failed: {e}, trying fallback")

    if DEEPGRAM_API_KEY:
        logger.info("STT: Deepgram nova-2")
        try:
            from livekit.plugins import deepgram
            return deepgram.STT(model=DEEPGRAM_MODEL)
        except ImportError:
            pass

    openai_key = os.getenv("OPENAI_API_KEY", "").strip()
    if openai_key and not openai_key.startswith("sk-dummy"):
        logger.info("STT: OpenAI Whisper")
        return openai.STT(model="whisper-1")

    logger.critical("NO VALID STT PROVIDER — speech recognition will fail")
    os.environ.setdefault("OPENAI_API_KEY", "dummy")
    return openai.STT(model="whisper-1")


# ─── LLM Provider ──────────────────────────────────────────────────────
def _get_llm():
    logger.info(f"LLM: Ollama {OLLAMA_MODEL} at {OLLAMA_BASE_URL}")
    return openai.LLM(
        model=OLLAMA_MODEL,
        api_key="ollama",
        base_url=OLLAMA_BASE_URL,
        max_completion_tokens=100,  # ~2-3 Sätze Voice-Antwort
        temperature=0.4,
    )


# ─── Voice Config from Admin-UI ─────────────────────────────────────────
async def _fetch_voice_id() -> str:
    try:
        import aiohttp
        admin_url = os.getenv("ADMIN_UI_URL", "http://eppcom-admin-ui:8080")
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=3)) as s:
            async with s.get(f"{admin_url}/api/voice-config") as resp:
                if resp.status == 200:
                    data = await resp.json()
                    vid = data.get("voice_id", "")
                    if vid:
                        logger.info(f"Voice config from admin-ui: {vid}")
                        return vid
    except Exception as e:
        logger.debug(f"Voice config fetch failed: {e}")
    return ""


# ─── TTS Provider ──────────────────────────────────────────────────────
def _get_tts(voice_id_override: str = ""):
    GERMAN_VOICE_DEFAULT = "38aabb6a-f52b-4fb0-a3d1-988518f4dc06"  # Alina

    if CARTESIA_API_KEY:
        voice_id = voice_id_override or CARTESIA_VOICE_ID
        if not voice_id or voice_id.lower() == "default":
            voice_id = GERMAN_VOICE_DEFAULT
        logger.info(f"TTS: Cartesia {CARTESIA_MODEL} (voice={voice_id[:8]}...)")
        try:
            return cartesia.TTS(
                api_key=CARTESIA_API_KEY,
                model=CARTESIA_MODEL,
                language="de",
                voice=voice_id,
                encoding="pcm_s16le",
                sample_rate=24000,
            )
        except Exception as e:
            logger.error(f"Cartesia TTS failed: {e}")

    if OPENAI_TTS_ENABLED:
        logger.info("TTS: OpenAI TTS-1 (nova)")
        return openai.TTS(model="tts-1", voice="nova")

    logger.critical("NO TTS PROVIDER CONFIGURED")
    return cartesia.TTS(api_key="dummy", model="sonic-2")


# ─── Base Agent (no RAG) ────────────────────────────────────────────────
class NexoAgent(Agent):
    def __init__(self, instructions: str = SYSTEM_PROMPT):
        super().__init__(instructions=instructions)


# ─── Streaming Agent with RAG + Think-Tag Filter ────────────────────────
class NexoStreamingAgent(Agent):
    """Voice agent with RAG context injection and qwen3 think-tag filtering."""

    def __init__(self, instructions: str = ""):
        super().__init__(instructions=instructions)

    @staticmethod
    def _get_last_user_query(chat_ctx) -> Optional[str]:
        for msg in reversed(chat_ctx.messages()):
            if msg.role == "user":
                content = msg.content
                if isinstance(content, str):
                    return content
                if isinstance(content, list):
                    for part in content:
                        if hasattr(part, "text"):
                            return part.text
        return None

    async def llm_node(self, chat_ctx, tools, model_settings):
        """RAG-augmented LLM node with qwen3 think-tag stripping."""
        user_query = self._get_last_user_query(chat_ctx)

        # Inject RAG context into system message
        if user_query:
            rag_context = await fetch_rag_context(user_query)
            if rag_context:
                try:
                    ctx_copy = chat_ctx.copy()
                    for i, item in enumerate(ctx_copy._items):
                        if item.role == "system":
                            ctx_copy._items[i] = item.model_copy(update={
                                "content": [SYSTEM_PROMPT + f"\n\nRELEVANTES WISSEN:\n{rag_context}"]
                            })
                            chat_ctx = ctx_copy
                            logger.info(f"RAG injected: {len(rag_context)} chars")
                            break
                except Exception as e:
                    logger.warning(f"RAG injection failed: {e}")

        # Get default LLM stream and filter think tags
        stream = Agent.default.llm_node(self, chat_ctx, tools, model_settings)
        return _strip_think_chunks(stream)


# ─── Agent Entrypoint ───────────────────────────────────────────────────
async def entrypoint(ctx: JobContext):
    await ctx.connect()
    logger.info(f"Connected to room: {ctx.room.name}")

    # Kick off RAG pre-warm in the background — does not block this session,
    # but populates the disk cache so the next sessions hit cached answers.
    asyncio.create_task(prewarm_rag_cache())

    configured_voice = await _fetch_voice_id()

    from livekit.agents.voice.agent_session import SessionConnectOptions
    session = AgentSession(
        stt=_get_stt(),
        llm=_get_llm(),
        tts=_get_tts(voice_id_override=configured_voice),
        vad=silero.VAD.load(),
        conn_options=SessionConnectOptions(
            llm_conn_options=APIConnectOptions(max_retry=3, retry_interval=2.0, timeout=60.0),
        ),
    )

    agent_class = NexoStreamingAgent if VOICEBOT_STREAMING_ENABLED else NexoAgent
    logger.info(f"Using {agent_class.__name__}")
    agent = agent_class(instructions=SYSTEM_PROMPT)

    async def _publish_data(payload: dict):
        try:
            import json
            data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            await ctx.room.local_participant.publish_data(data, reliable=True)
        except Exception as e:
            logger.debug(f"publish_data failed: {e}")

    @session.on("user_speech_committed")
    def _on_user_speech(ev):
        text = getattr(ev, "transcript", None) or getattr(ev, "text", None) or ""
        if text:
            asyncio.ensure_future(_publish_data({"type": "user_speech", "text": text}))

    @session.on("agent_speech_committed")
    def _on_agent_speech(ev):
        text = getattr(ev, "transcript", None) or getattr(ev, "text", None) or ""
        if text:
            asyncio.ensure_future(_publish_data({"type": "agent_speech", "text": text}))

    await session.start(room=ctx.room, agent=agent)
    logger.info("Agent started and listening")

    # Begrüßung — nicht unterbrechbar, fragt nach Name
    greeting = "Hallo! Ich bin Nexo, der KI-Assistent von Eppkom Solutions. Mit wem habe ich das Vergnügen, wie heißt du?"
    await session.say(greeting, allow_interruptions=True)
    await _publish_data({"type": "agent_speech", "text": greeting})

    await asyncio.Event().wait()


# ─── Ollama Pre-Warm ────────────────────────────────────────────────────
def _prewarm_ollama(_proc=None):
    """Load model into RAM at worker start to eliminate cold-start latency."""
    import requests
    try:
        base = OLLAMA_BASE_URL.rstrip("/").removesuffix("/v1")
        logger.info(f"Pre-warming '{OLLAMA_MODEL}' at {base}...")
        resp = requests.post(
            f"{base}/api/generate",
            json={"model": OLLAMA_MODEL, "prompt": "hi", "stream": False, "options": {"num_predict": 1}},
            timeout=120,
        )
        if resp.status_code == 200:
            logger.info(f"✓ '{OLLAMA_MODEL}' pre-warmed and ready")
        else:
            logger.warning(f"Pre-warm HTTP {resp.status_code}")
    except Exception as e:
        logger.warning(f"Pre-warm failed (non-fatal): {e}")


# ─── Worker Options & CLI ───────────────────────────────────────────────
if __name__ == "__main__":
    cli.run_app(WorkerOptions(
        entrypoint_fnc=entrypoint,
        api_key=LIVEKIT_API_KEY,
        api_secret=LIVEKIT_API_SECRET,
        ws_url=LIVEKIT_URL,
        prewarm_fnc=_prewarm_ollama,
        num_idle_processes=1,       # Statt 4 — spart ~3 GB RAM (Whisper je ~1 GB pro Prozess)
        job_memory_warn_mb=1400,    # Warning erst ab 1.4 GB (realistischer Wert)
        job_memory_limit_mb=1800,   # Hard-kill erst ab 1.8 GB
    ))
