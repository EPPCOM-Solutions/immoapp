<?php
/**
 * EPPCOM Chatbot Widget – Typebot direkt eingebettet
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
            gap: 24px;
        }
        h1 { font-size: 22px; color: #1e3a8a; text-align: center; }
        p  { color: #555; text-align: center; font-size: 14px; max-width: 420px; }
        #chatbot-container {
            width: 100%;
            max-width: 420px;
            height: 580px;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 12px 48px rgba(30, 58, 138, 0.18);
            background: #fff;
        }
        .back { font-size: 13px; color: #888; }
        .back a { color: #1e3a8a; text-decoration: none; }
    </style>
</head>
<body>
    <h1>Nexo – KI-Assistent von EPPCOM</h1>
    <p>Stelle eine Frage zu KI-Automatisierung, unseren Paketen oder vereinbare direkt einen Termin.</p>

    <div id="chatbot-container"></div>

    <p class="back"><a href="https://www.eppcom.de">&larr; Zurück zur Website</a></p>

    <script type="module">
        import Typebot from "https://cdn.jsdelivr.net/npm/@typebot.io/js@0.3/dist/web.js";
        Typebot.initContainer({
            typebot: "eppcom-chatbot-v2",
            apiHost: "https://bot.eppcom.de",
            container: document.getElementById("chatbot-container"),
            theme: {
                chatWindow: { backgroundColor: "#FFFFFF" }
            }
        });
    </script>
</body>
</html>
