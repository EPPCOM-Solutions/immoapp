<?php
/**
 * EPPCOM Chatbot Widget – Typebot + Multi-Model-Auswahl via OpenRouter
 * Dieses File auf dem Website-Server hochladen (www.eppcom.de/test.php).
 */
?>
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>EPPCOM – KI-Assistent Nexo</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #f0f4ff;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 20px;
            gap: 16px;
        }
        h1 { font-size: 22px; color: #1e3a8a; text-align: center; }
        p  { color: #555; text-align: center; font-size: 14px; max-width: 480px; }

        /* Modell-Tabs */
        .model-tabs {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 6px;
            background: #e0e7ff;
            border-radius: 14px;
            padding: 5px;
            max-width: 480px;
            width: 100%;
        }
        .model-tab {
            padding: 7px 14px;
            border: none;
            border-radius: 9px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            background: transparent;
            color: #4b5563;
            transition: all 0.2s;
            white-space: nowrap;
        }
        .model-tab.active {
            background: #fff;
            color: #1e3a8a;
            box-shadow: 0 1px 4px rgba(30,58,138,0.15);
        }

        /* Chat-Container */
        #chatbot-container {
            width: 100%;
            max-width: 480px;
            height: 580px;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 12px 48px rgba(30, 58, 138, 0.18);
            background: #fff;
            display: flex;
            flex-direction: column;
        }
        #typebot-wrapper { width: 100%; height: 100%; }

        /* LLM Custom Chat */
        #llm-chat { display: none; flex-direction: column; height: 100%; }
        #llm-messages {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .msg { max-width: 85%; padding: 10px 14px; border-radius: 14px; font-size: 14px; line-height: 1.5; }
        .msg.user  { align-self: flex-end; background: #1e3a8a; color: #fff; border-bottom-right-radius: 4px; }
        .msg.bot   { align-self: flex-start; background: #f1f5f9; color: #1e293b; border-bottom-left-radius: 4px; }
        .msg.typing { color: #94a3b8; font-style: italic; }
        .model-badge {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
            text-align: center;
            margin: 10px 16px 0;
            background: #dcfce7;
            color: #166534;
        }
        #llm-form {
            display: flex;
            gap: 8px;
            padding: 12px;
            border-top: 1px solid #e2e8f0;
        }
        #llm-input {
            flex: 1;
            padding: 10px 14px;
            border: 1px solid #cbd5e1;
            border-radius: 10px;
            font-size: 14px;
            outline: none;
        }
        #llm-input:focus { border-color: #1e3a8a; }
        #llm-send {
            padding: 10px 16px;
            background: #1e3a8a;
            color: #fff;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
        }
        #llm-send:disabled { opacity: 0.5; cursor: not-allowed; }

        .back { font-size: 13px; color: #888; }
        .back a { color: #1e3a8a; text-decoration: none; }
    </style>
</head>
<body>
    <h1>Nexo – KI-Assistent von EPPCOM</h1>
    <p>Stelle eine Frage zu KI-Automatisierung, unseren Paketen oder vereinbare direkt einen Termin.</p>

    <!-- Modell-Auswahl -->
    <div class="model-tabs">
        <button class="model-tab active" onclick="switchModel('nexo', this)">Nexo (Standard)</button>
        <button class="model-tab" onclick="switchModel('gemma', this)">Gemma 3 4B</button>
        <button class="model-tab" onclick="switchModel('llama', this)">Llama 3.1 8B</button>
        <button class="model-tab" onclick="switchModel('mistral', this)">Mistral 7B</button>
        <button class="model-tab" onclick="switchModel('qwen', this)">Qwen3 8B</button>
        <button class="model-tab" onclick="switchModel('deepseek', this)">DeepSeek V3</button>
    </div>

    <!-- Chat-Bereich -->
    <div id="chatbot-container">
        <!-- Typebot (Nexo) -->
        <div id="typebot-wrapper"></div>

        <!-- OpenRouter LLM Chat (alle Nicht-Nexo-Modelle) -->
        <div id="llm-chat">
            <div class="model-badge" id="llm-badge"></div>
            <div id="llm-messages"></div>
            <form id="llm-form" onsubmit="sendLLM(event)">
                <input id="llm-input" type="text" placeholder="Nachricht eingeben…" autocomplete="off" />
                <button id="llm-send" type="submit">Senden</button>
            </form>
        </div>
    </div>

    <p class="back"><a href="https://www.eppcom.de">&larr; Zurück zur Website</a></p>

    <script type="module">
        import Typebot from "https://cdn.jsdelivr.net/npm/@typebot.io/js@0.3/dist/web.js";
        window._typebotStart = () => Typebot.initContainer({
            typebot: "eppcom-chatbot-v2",
            apiHost: "https://bot.eppcom.de",
            container: document.getElementById("typebot-wrapper"),
            theme: {
                chatWindow: { backgroundColor: "#FFFFFF" },
                customCss: `
                    .typebot-powered-by,
                    a[href*="typebot.io"],
                    [data-testid="branding"],
                    .typebot-branding { display: none !important; }
                `
            }
        });
        window._typebotStop = () => {
            try { Typebot.destroy(); } catch(e) {}
            document.getElementById("typebot-wrapper").innerHTML = "";
        };
        window._typebotStart();
    </script>

    <script>
        const CHAT_API = "https://appdb.eppcom.de/api/public/llm-chat";

        const MODELS = {
            gemma:    { label: "Google Gemma 3 4B · via OpenRouter (kostenlos)",   greeting: "Hallo! Ich bin Gemma, ein Open-Source-Modell von Google. Wie kann ich helfen?" },
            llama:    { label: "Meta Llama 3.1 8B · via OpenRouter (kostenlos)",    greeting: "Hi! Ich bin Llama, Metas Open-Source-Modell. Was kann ich für dich tun?" },
            mistral:  { label: "Mistral 7B Instruct · via OpenRouter (kostenlos)",  greeting: "Hallo! Ich bin Mistral, ein effizientes KI-Modell. Wie kann ich helfen?" },
            qwen:     { label: "Alibaba Qwen3 8B · via OpenRouter (kostenlos)",     greeting: "Hallo! Ich bin Qwen3 von Alibaba. Wie kann ich dir helfen?" },
            deepseek: { label: "DeepSeek V3 · via OpenRouter (kostenlos)",          greeting: "Hallo! Ich bin DeepSeek V3. Wie kann ich dir helfen?" },
        };

        const histories = {};
        const renderedMessages = {};
        let currentModel = null;

        function switchModel(model, btn) {
            document.querySelectorAll(".model-tab").forEach(t => t.classList.remove("active"));
            btn.classList.add("active");

            const wrapper = document.getElementById("typebot-wrapper");
            const llmChat = document.getElementById("llm-chat");

            if (model === "nexo") {
                llmChat.style.display = "none";
                wrapper.style.display = "block";
                if (window._typebotStart) window._typebotStart();
                currentModel = null;
                return;
            }

            if (window._typebotStop) window._typebotStop();
            wrapper.style.display = "none";
            llmChat.style.display = "flex";
            currentModel = model;

            document.getElementById("llm-badge").textContent = MODELS[model].label;

            if (!renderedMessages[model]) {
                renderedMessages[model] = [];
                histories[model] = [];
                const greetEl = document.createElement("div");
                greetEl.className = "msg bot";
                greetEl.textContent = MODELS[model].greeting;
                renderedMessages[model].push(greetEl);
            }
            const msgContainer = document.getElementById("llm-messages");
            msgContainer.innerHTML = "";
            renderedMessages[model].forEach(el => msgContainer.appendChild(el));
            msgContainer.scrollTop = msgContainer.scrollHeight;

            document.getElementById("llm-input").focus();
        }

        async function sendLLM(e) {
            e.preventDefault();
            if (!currentModel) return;
            const input = document.getElementById("llm-input");
            const text = input.value.trim();
            if (!text) return;

            input.value = "";

            const userEl = addMsg(text, "user");
            renderedMessages[currentModel].push(userEl);
            histories[currentModel].push({ role: "user", content: text });

            const sendBtn = document.getElementById("llm-send");
            sendBtn.disabled = true;
            const typingEl = addMsg("Schreibt…", "bot typing");

            try {
                const resp = await fetch(CHAT_API, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ model: currentModel, messages: histories[currentModel] })
                });
                const data = await resp.json();
                const reply = data.reply || "Keine Antwort erhalten.";
                typingEl.textContent = reply;
                typingEl.classList.remove("typing");
                renderedMessages[currentModel].push(typingEl);
                histories[currentModel].push({ role: "assistant", content: reply });
            } catch (err) {
                typingEl.textContent = "Verbindungsfehler – bitte erneut versuchen.";
                typingEl.classList.remove("typing");
                renderedMessages[currentModel].push(typingEl);
            } finally {
                sendBtn.disabled = false;
                input.focus();
            }
        }

        function addMsg(text, cls) {
            const messages = document.getElementById("llm-messages");
            const el = document.createElement("div");
            el.className = "msg " + cls;
            el.textContent = text;
            messages.appendChild(el);
            messages.scrollTop = messages.scrollHeight;
            return el;
        }
    </script>
</body>
</html>
