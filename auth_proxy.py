import os, json, hashlib, secrets, time, smtplib
from email.mime.text import MIMEText
from pathlib import Path
import httpx
from fastapi import FastAPI, Request, Form
from fastapi.responses import HTMLResponse, RedirectResponse, Response
import uvicorn

app = FastAPI()
BASE_DIR = Path(__file__).parent
DATA_FILE = BASE_DIR / "auth_users.json"
ALLOWED_EMAIL = "eppler@eppcom.de"
CODE_SERVER_URL = os.getenv("CODE_SERVER_URL", "http://localhost:8080")

def _read_cs_password():
    if p := os.getenv("CODE_SERVER_PASSWORD"):
        return p
    for cfg_path in [
        Path("/home/coder/.config/code-server/config.yaml"),
        Path.home() / ".config/code-server/config.yaml",
    ]:
        try:
            for line in cfg_path.read_text().splitlines():
                if line.startswith("password:"):
                    return line.split(":", 1)[1].strip()
        except Exception:
            continue
    return ""

CODE_SERVER_PASSWORD = _read_cs_password()
SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", "noreply@eppcom.de")
BASE_URL = os.getenv("BASE_URL", "https://code.eppcom.de")
DEFAULT_PASSWORD = os.getenv("AUTH_DEFAULT_PASSWORD", "mX7kP3vQ9nL5wR2j")
sessions = {}
reset_tokens = {}

def hash_pw(p): return hashlib.sha256(p.encode()).hexdigest()

def load_users():
    if DATA_FILE.exists(): return json.loads(DATA_FILE.read_text())
    u = {ALLOWED_EMAIL: {"password_hash": hash_pw(DEFAULT_PASSWORD)}}
    DATA_FILE.write_text(json.dumps(u, indent=2))
    return u

def save_users(u): DATA_FILE.write_text(json.dumps(u, indent=2))

def get_session(req):
    sid = req.cookies.get("auth_session")
    if sid and sid in sessions and sessions[sid]["expires"] > time.time():
        return sessions[sid]["email"]

def send_email(to, reset_url):
    msg = MIMEText(f"Reset-Link (1h gültig):\n{reset_url}", "plain", "utf-8")
    msg["Subject"] = "Passwort zurücksetzen – code.eppcom.de"
    msg["From"] = SMTP_FROM
    msg["To"] = to
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as s:
        s.starttls(); s.login(SMTP_USER, SMTP_PASSWORD); s.send_message(msg)

_CSS_BASE = """*{box-sizing:border-box;margin:0;padding:0}body{background:#0b0f1a;color:#F8FAFC;font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background-image:radial-gradient(ellipse at 60% 20%,rgba(102,126,234,.15) 0%,transparent 60%),radial-gradient(ellipse at 20% 80%,rgba(118,75,162,.12) 0%,transparent 60%)}.card{background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.18);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-radius:16px;padding:40px 36px;width:100%;max-width:400px;box-shadow:0 20px 60px rgba(0,0,0,.4)}.logo{text-align:center;margin-bottom:28px}.logo h1{font-size:24px;font-weight:700;background:linear-gradient(135deg,#667eea,#764ba2);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}.logo p{font-size:13px;color:#E2E8F0;margin-top:5px;opacity:.7}label{display:block;font-size:13px;color:#E2E8F0;margin-bottom:6px;margin-top:16px;opacity:.85}input{width:100%;padding:10px 14px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.2);border-radius:8px;color:#F8FAFC;font-size:14px;outline:none;transition:border .2s}input:focus{border-color:#667eea;background:rgba(102,126,234,.1)}button{width:100%;margin-top:24px;padding:12px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;font-size:14px;font-weight:600;border:none;border-radius:8px;cursor:pointer;transition:opacity .2s}button:hover{opacity:.9}.error{background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.4);color:#fca5a5;border-radius:8px;padding:10px 14px;font-size:13px;margin-top:16px}.ok{background:rgba(16,185,129,.15);border:1px solid rgba(16,185,129,.4);color:#6ee7b7;border-radius:8px;padding:12px 14px;font-size:13px}.rl,.back{text-align:center;margin-top:18px}.rl a,.back a{color:#BFDBFE;font-size:13px;text-decoration:none;opacity:.8}"""

LOGIN = f"""<!DOCTYPE html><html lang=de><head><meta charset=UTF-8><meta name=viewport content="width=device-width,initial-scale=1"><title>EPPCOM Login</title><style>{_CSS_BASE}</style></head>
<body><div class=card><div class=logo><h1>EPPCOM</h1><p>Code Server</p></div>
<form method=post action=/login><label>E-Mail</label><input type=email name=email value="eppler@eppcom.de" required><label>Passwort</label><input type=password name=password required autofocus>{{ERR}}<button type=submit>Anmelden</button></form>
<div class=rl><a href=/reset>Passwort vergessen?</a></div></div></body></html>"""

RESET = f"""<!DOCTYPE html><html lang=de><head><meta charset=UTF-8><meta name=viewport content="width=device-width,initial-scale=1"><title>Reset</title><style>{_CSS_BASE}h2{{color:#667eea;margin-bottom:12px}}p{{font-size:13px;color:#E2E8F0;margin-bottom:16px;line-height:1.5;opacity:.85}}</style></head>
<body><div class=card><h2>Passwort zurücksetzen</h2>{{CONTENT}}<div class=back><a href=/login>← Zurück</a></div></div></body></html>"""

NEWPW = f"""<!DOCTYPE html><html lang=de><head><meta charset=UTF-8><meta name=viewport content="width=device-width,initial-scale=1"><title>Neues Passwort</title><style>{_CSS_BASE}h2{{color:#667eea;margin-bottom:20px}}</style></head>
<body><div class=card><h2>Neues Passwort</h2><form method=post action=/reset/confirm><input type=hidden name=token value="{{TOKEN}}"><label>Neues Passwort</label><input type=password name=password required minlength=8 autofocus><label>Wiederholen</label><input type=password name=password2 required minlength=8>{{ERR}}<button>Speichern</button></form></div></body></html>"""

@app.get("/auth")
async def check_auth(request: Request):
    return Response(status_code=200 if get_session(request) else 401)

@app.get("/login", response_class=HTMLResponse)
async def login_get(request: Request):
    if get_session(request): return RedirectResponse("/", status_code=302)
    return LOGIN.replace("{ERR}", "")

@app.post("/login")
async def login_post(request: Request, email: str = Form(...), password: str = Form(...)):
    err = ""
    if email.lower() != ALLOWED_EMAIL:
        err = "Diese E-Mail ist nicht berechtigt."
    else:
        u = load_users().get(ALLOWED_EMAIL)
        if not u or u["password_hash"] != hash_pw(password):
            err = "Falsches Passwort."
    if err:
        return HTMLResponse(LOGIN.replace("{ERR}", f'<div class=error>{err}</div>'), status_code=401)
    cs_key = ""
    if CODE_SERVER_PASSWORD:
        try:
            async with httpx.AsyncClient() as c:
                r = await c.post(f"{CODE_SERVER_URL}/login", data={"password": CODE_SERVER_PASSWORD},
                                 follow_redirects=False, timeout=5)
                cs_key = r.cookies.get("key", "")
        except: pass
    sid = secrets.token_hex(32)
    sessions[sid] = {"email": ALLOWED_EMAIL, "expires": time.time() + 86400 * 30}
    resp = RedirectResponse("/", status_code=302)
    resp.set_cookie("auth_session", sid, httponly=True, max_age=86400*30, samesite="lax", secure=True)
    if cs_key: resp.set_cookie("key", cs_key, httponly=True, samesite="lax", secure=True)
    return resp

@app.get("/logout")
async def logout(request: Request):
    sid = request.cookies.get("auth_session")
    if sid in sessions: del sessions[sid]
    resp = RedirectResponse("/login", status_code=302)
    resp.delete_cookie("auth_session"); resp.delete_cookie("key")
    return resp

@app.get("/reset", response_class=HTMLResponse)
async def reset_get():
    f = '<p>Gib deine E-Mail ein.</p><form method=post action=/reset><label>E-Mail</label><input type=email name=email value="eppler@eppcom.de" required><button>Reset-Link senden</button></form>'
    return RESET.replace("{CONTENT}", f)

@app.post("/reset", response_class=HTMLResponse)
async def reset_post(email: str = Form(...)):
    if email.lower() == ALLOWED_EMAIL:
        token = secrets.token_urlsafe(48)
        reset_tokens[token] = {"email": ALLOWED_EMAIL, "expires": time.time() + 3600}
        url = f"{BASE_URL}/reset/confirm?token={token}"
        try: send_email(ALLOWED_EMAIL, url)
        except Exception as e: print(f"[RESET] SMTP-Fehler: {e} | URL: {url}")
    return RESET.replace("{CONTENT}", '<div class=ok>Falls registriert, wurde ein Link gesendet.</div>')

@app.get("/reset/confirm", response_class=HTMLResponse)
async def reset_confirm_get(token: str = ""):
    if not token or token not in reset_tokens or reset_tokens[token]["expires"] < time.time():
        return RESET.replace("{CONTENT}", "<p>Link ungültig oder abgelaufen.</p>")
    return NEWPW.replace("{TOKEN}", token).replace("{ERR}", "")

@app.post("/reset/confirm")
async def reset_confirm_post(token: str = Form(...), password: str = Form(...), password2: str = Form(...)):
    if not token or token not in reset_tokens or reset_tokens[token]["expires"] < time.time():
        return HTMLResponse("Ungültiger Link.", status_code=400)
    if password != password2:
        return HTMLResponse(NEWPW.replace("{TOKEN}", token).replace("{ERR}", '<div class=error>Passwörter stimmen nicht überein.</div>'))
    if len(password) < 8:
        return HTMLResponse(NEWPW.replace("{TOKEN}", token).replace("{ERR}", '<div class=error>Mindestens 8 Zeichen.</div>'))
    u = load_users()
    u[ALLOWED_EMAIL]["password_hash"] = hash_pw(password)
    save_users(u)
    del reset_tokens[token]
    return RedirectResponse("/login", status_code=302)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8082)
