<?php
/**
 * EPPCOM Chatbot Widget – Typebot + Modell-Auswahl (Nexo / Gemma 4 3B)
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
        p  { color: #555; text-align: center; font-size: 14px; max-width: 420px; }

        /* Modell-Tabs */
        .model-tabs {
            display: flex;
            gap: 8px;
            background: #e0e7ff;
            border-radius: 12px;
            padding: 4px;
        }
        .model-tab {
            padding: 8px 18px;
            border: none;
            border-radius: 9px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            background: transparent;
            color: #4b5563;
            transition: all 0.2s;
        }
        .model-tab.active {
            background: #fff;
            color: #1e3a8a;
            box-shadow: 0 1px 4px rgba(30,58,138,0.15);
        }

        /* Chat-Container */
        #chatbot-container {
            width: 100%;
            max-width: 420px;
            height: 580px;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 12px 48px rgba(30, 58, 138, 0.18);
            background: #fff;
            display: flex;
            flex-direction: column;
        }
        #typebot-wrapper { width: 100%; height: 100%; }

        /* Gemma Custom Chat */
        #gemma-chat { display: none; flex-direction: column; height: 100%; }
        #gemma-messages {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .msg { max-width: 85%; padding: 10px 14px; border-radius: 14px; font-size: 14px; line-height: 1.5; }
        .msg.user { align-self: flex-end; background: #1e3a8a; color: #fff; border-bottom-right-radius: 4px; }
        .msg.bot  { align-self: flex-start; background: #f1f5f9; color: #1e293b; border-bottom-left-radius: 4px; }
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
        #gemma-form {
            display: flex;
            gap: 8px;
            padding: 12px;
            border-top: 1px solid #e2e8f0;
        }
        #gemma-input {
            flex: 1;
            padding: 10px 14px;
            border: 1px solid #cbd5e1;
            border-radius: 10px;
            font-size: 14px;
            outline: none;
        }
        #gemma-input:focus { border-color: #1e3a8a; }
        #gemma-send {
            padding: 10px 16px;
            background: #1e3a8a;
            color: #fff;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
        }
        #gemma-send:disabled { opacity: 0.5; cursor: not-allowed; }

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
        <button class="model-tab" onclick="switchModel('gemma', this)">Gemma 4 3B (Free)</button>
    </div>

    <!-- Chat-Bereich -->
    <div id="chatbot-container">
        <!-- Typebot (Nexo) -->
        <div id="typebot-wrapper"></div>

        <!-- Gemma Custom Chat -->
        <div id="gemma-chat">
            <div class="model-badge">Google Gemma 3 4B · via OpenRouter (kostenlos)</div>
            <div id="gemma-messages">
                <div class="msg bot">Hallo! Ich bin Gemma, ein Open-Source-Modell von Google. Wie kann ich dir helfen?</div>
            </div>
            <form id="gemma-form" onsubmit="sendGemma(event)">
                <input id="gemma-input" type="text" placeholder="Nachricht eingeben…" autocomplete="off" />
                <button id="gemma-send" type="submit">Senden</button>
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
        const gemmaHistory = [];

        function switchModel(model, btn) {
            document.querySelectorAll(".model-tab").forEach(t => t.classList.remove("active"));
            btn.classList.add("active");

            const wrapper = document.getElementById("typebot-wrapper");
            const gemmaChat = document.getElementById("gemma-chat");

            if (model === "nexo") {
                gemmaChat.style.display = "none";
                wrapper.style.display = "block";
                if (window._typebotStart) window._typebotStart();
            } else {
                if (window._typebotStop) window._typebotStop();
                wrapper.style.display = "none";
                gemmaChat.style.display = "flex";
                document.getElementById("gemma-input").focus();
            }
        }

        async function sendGemma(e) {
            e.preventDefault();
            const input = document.getElementById("gemma-input");
            const text = input.value.trim();
            if (!text) return;

            input.value = "";
            addMsg(text, "user");
            gemmaHistory.push({ role: "user", content: text });

            const sendBtn = document.getElementById("gemma-send");
            sendBtn.disabled = true;
            const typingEl = addMsg("Schreibt…", "bot typing");

            try {
                const resp = await fetch(CHAT_API, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ model: "gemma", messages: gemmaHistory })
                });
                const data = await resp.json();
                const reply = data.reply || "Keine Antwort erhalten.";
                typingEl.textContent = reply;
                typingEl.classList.remove("typing");
                gemmaHistory.push({ role: "assistant", content: reply });
            } catch (err) {
                typingEl.textContent = "Verbindungsfehler – bitte erneut versuchen.";
                typingEl.classList.remove("typing");
            } finally {
                sendBtn.disabled = false;
                input.focus();
            }
        }

        function addMsg(text, cls) {
            const messages = document.getElementById("gemma-messages");
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
