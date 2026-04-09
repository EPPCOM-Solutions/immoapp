<?php declare(strict_types=1);
/* =========================================================
   Kontaktformular-Endpoint: POST /?action=contact  (inkl. ROI + Analyse)
   ========================================================= */
if (($_GET['action'] ?? '') === 'contact') {
  header('Content-Type: application/json; charset=utf-8');
  $autoload = __DIR__ . '/vendor/autoload.php';
  if (!is_readable($autoload)) {
    http_response_code(500); echo json_encode(['ok'=>false,'error'=>'vendor_missing']); exit;
  }
  require $autoload;
  $cfgPath = __DIR__ . '/secure/config.php';
  if (!is_readable($cfgPath)) {
    http_response_code(500); echo json_encode(['ok'=>false,'error'=>'config_missing']); exit;
  }
  $cfg = require $cfgPath;
  // Honeypot
  if (!empty($_POST['website'] ?? '')) { echo json_encode(['ok'=>true]); exit; }

  $name    = trim($_POST['name']    ?? '');
  $company = trim($_POST['company'] ?? '');
  $phone   = trim($_POST['phone']   ?? '');
  $email   = trim($_POST['email']   ?? '');
  $service = trim($_POST['service'] ?? '');
  $msg     = trim($_POST['message'] ?? '');

  $san = static function(string $v): string {
    $v = str_replace(['€','€ '], ['EUR','EUR '], $v);
    $map = ['ä'=>'ae','ö'=>'oe','ü'=>'ue','Ä'=>'Ae','Ö'=>'Oe','Ü'=>'Ue','ß'=>'ss'];
    return strtr($v, $map);
  };

  // ROI-Daten
  $roi_enabled = (isset($_POST['roi_enabled']) && $_POST['roi_enabled'] === '1');
  $roi_payload = '';
  if ($roi_enabled) {
    $roi = [
      'employees' => trim($_POST['roi_employees'] ?? ''),
      'industry'  => trim($_POST['roi_industry']  ?? ''),
      'hours'     => trim($_POST['roi_hours']      ?? ''),
      'wage'      => trim($_POST['roi_wage']       ?? ''),
      'level'     => trim($_POST['roi_level']      ?? ''),
      'package'   => trim($_POST['roi_package']    ?? ''),
      'weekly'    => trim($_POST['roi_weekly']     ?? ''),
      'monthly'   => trim($_POST['roi_monthly']    ?? ''),
      'yearly_roi'=> trim($_POST['roi_yearly']     ?? ''),
      'payback'   => trim($_POST['roi_payback']    ?? ''),
      'time_saved'=> trim($_POST['roi_time_saved'] ?? ''),
    ];
    foreach ($roi as $k => $v) { $roi[$k] = $san($v); }
    $roi_payload =
      "Moegliche ROI-Analyse:\n"
      . "Mitarbeiter: {$roi['employees']}\n"
      . "Branche: {$roi['industry']}\n"
      . "Aktuelle Std/Woche: {$roi['hours']}\n"
      . "Stundensatz (EUR): {$roi['wage']}\n"
      . "Automatisierungsgrad: {$roi['level']}\n"
      . "Gewaehltes Paket: {$roi['package']}\n"
      . "Ergebnis:\n"
      . "  Woechentliche Ersparnis: {$roi['weekly']}\n"
      . "  Monatliche Ersparnis: {$roi['monthly']}\n"
      . "  Jahres-ROI: {$roi['yearly_roi']}\n"
      . "  Amortisation: {$roi['payback']}\n"
      . "  Zeitersparnis: {$roi['time_saved']}\n";
  }

  // Analyse-Daten (neu)
  $analysis_payload = '';
  $a_time = trim($_POST['analysis_time_cost']  ?? '');
  $a_tool = trim($_POST['analysis_tools_used'] ?? '');
  $a_dept = trim($_POST['analysis_department'] ?? '');
  $a_strat= trim($_POST['analysis_strategy']   ?? '');
  $a_urg  = trim($_POST['analysis_urgency']    ?? '');
  if ($a_time !== '' || $a_tool !== '') {
    $analysis_payload =
      "Kurzanalyse:\n"
      . "Zeitfressende Ablaeufe: " . $san($a_time) . "\n"
      . "Bisherige Tools / Erfahrungen: " . $san($a_tool) . "\n"
      . "Zielbereich: " . $san($a_dept) . "\n"
      . "Strategie-Ausrichtung: " . $san($a_strat) . "\n"
      . "Dringlichkeit (1-10): " . $san($a_urg) . "\n";
  }

  if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(422); echo json_encode(['ok'=>false,'error'=>'validation']); exit;
  }
  try {
    $mail = new PHPMailer\PHPMailer\PHPMailer(true);
    $mail->isSMTP();
    $mail->Host       = (string)$cfg['smtp_host'];
    $mail->Port       = (int)$cfg['smtp_port'];
    $mail->SMTPAuth   = true;
    $mail->Username   = (string)$cfg['smtp_user'];
    $mail->Password   = (string)$cfg['smtp_pass'];
    $mail->SMTPSecure = PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
    $mail->setFrom((string)$cfg['from_email'], (string)($cfg['from_name'] ?? 'Website'));
    $mail->addAddress((string)$cfg['to_email']);
    if (!empty($cfg['cc_email'])) $mail->addCC((string)$cfg['cc_email']);
    $mail->addReplyTo($email, $name);
    $mail->Subject = 'Neue Anfrage ueber eppcom.de';
    $body = "Name: ".$san($name)."\n"
          . "Unternehmen: ".($company !== '' ? $san($company) : '-')."\n"
          . "Telefon: ".($phone !== '' ? $san($phone) : '-')."\n"
          . "E-Mail: ".$san($email)."\n"
          . "Leistung: ".$san($service)."\n\n";
    if ($msg !== '')           $body .= "Nachricht:\n".$san($msg)."\n\n";
    if ($analysis_payload !== '') $body .= $analysis_payload."\n";
    if ($roi_payload !== '')   $body .= $roi_payload."\n";
    $mail->Body    = $body;
    $mail->AltBody = $body;
    $mail->send();
    echo json_encode(['ok'=>true]);
  } catch (Throwable $e) {
    error_log('MAIL_ERR: '.$e->getMessage());
    http_response_code(500);
    echo json_encode(['ok'=>false,'error'=>'send_failed']);
  }
  exit;
}
?><!DOCTYPE html>
<html lang="de">
<head>
  <meta name="color-scheme" content="dark light">
  <meta name="language" content="de">
  <meta name="keywords" content="KI Automatisierung, Workflow Automation, Chatbots, Reutlingen, Tübingen, Stuttgart, KMU, ROI, EPPCOM Solutions">
  <meta property="og:title" content="EPPCOM Solutions – KI-Automatisierung für KMU">
  <meta property="og:description" content="Vom Hype zur Rendite – bis zu 60 % weniger Büroarbeit mit EPPCOM Solutions.">
  <link rel="preload" href="/assets/images/background.webp" as="image">
  <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
  <script type="application/ld+json">{
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "EPPCOM Solutions",
    "url": "https://www.eppcom.de/",
    "image": "https://www.eppcom.de/assets/images/Logo.webp",
    "logo": "https://www.eppcom.de/assets/images/Logo.webp",
    "telephone": "+49 157 53640191",
    "email": "kontakt@eppcom.de",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Ulrichstraße 3",
      "addressLocality": "Reutlingen",
      "postalCode": "72764",
      "addressCountry": "DE"
    },
    "areaServed": [
      { "@type": "City", "name": "Reutlingen" },
      { "@type": "City", "name": "Tübingen" },
      { "@type": "City", "name": "Stuttgart" }
    ],
    "openingHoursSpecification": [{
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday"],
      "opens": "09:00",
      "closes": "17:00"
    }],
    "sameAs": ["https://www.linkedin.com/company/eppcom"]
  }</script>
  <title>EPPCOM Solutions – KI-Automatisierung für KMU</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="description" content="Vom Hype zur Rendite. Mehr Zeit, weniger Routine, mehr Umsatz – mit smarter KI-Automatisierung. Ø60% weniger Büroarbeit in 2–4 Wochen. Reutlingen, Tübingen, Stuttgart, Zollernalbkreis – bundesweit remote." />
  <meta name="robots" content="index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1" />
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="EPPCOM Solutions – KI-Automatisierung für KMU">
  <meta name="twitter:description" content="Ø 60 % weniger Büroarbeit in 2–6 Wochen. Workflows, Chatbots, KI-Prozesse. Reutlingen, Tübingen, Stuttgart – bundesweit remote.">
  <meta name="twitter:image" content="https://www.eppcom.de/assets/images/og-cover.webp">
  <meta name="theme-color" content="#0b0f1a">
  <meta property="og:url" content="https://www.eppcom.de/">
  <meta property="og:image" content="https://www.eppcom.de/assets/images/og-cover.webp">
  <link rel="canonical" href="https://www.eppcom.de/" />
  <link rel="icon" type="image/webp" href="/assets/images/Logo.webp">
  <link rel="apple-touch-icon" href="/assets/images/Logo.webp">
  <link rel="mask-icon" href="/images/logo.svg" color="#0b0f1a">
  <link rel="manifest" href="/site.webmanifest">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css">
  <link rel="stylesheet" href="/assets/vendor/fontawesome/css/all.min.css">
  <style>
    :root {
      --glass-bg: rgba(255,255,255,0.14);
      --glass-card: rgba(255,255,255,0.16);
      --glass-border: rgba(255,255,255,0.28);
      --shadow: 0 10px 30px rgba(0,0,0,0.25);
      --txt: #F8FAFC;
      --txt-sub: #E2E8F0;
      --link: #BFDBFE;
      --focus: 0 0 0 3px rgba(99,179,237,.55);
      --accent: #667eea;
      --accent-2: #764ba2;
      --danger: #ef4444;
      --ok: #10b981;
      --ok-contrast: #0f6f52;
    }
    * { scroll-behavior: smooth; box-sizing: border-box; }
    html, body { height: 100%; }
    body { min-height: 100vh; margin: 0; font-family: ui-sans-serif, system-ui, Inter, Segoe UI, Roboto, Arial; background:#000; color: var(--txt-sub); }
    body.modal-open { overflow: hidden; touch-action: none; }
    #bg { position: fixed; inset:0; z-index:-2; background:url('/assets/images/background.webp') center/cover no-repeat; }
    #bg::after { content:""; position:absolute; inset:0; background:rgba(0,0,0,.45); }
    .header { transition: transform .3s; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); background: var(--glass-bg); border-bottom:1px solid var(--glass-border); }
    .header.hidden { transform: translateY(-100%); }
    .logo { height: 84px; width:auto; }
    .content-section { background:var(--glass-bg); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border:1px solid var(--glass-border); border-radius:16px; box-shadow:var(--shadow); margin:24px auto; max-width:1200px; padding:24px; }
    .service-card,.price-card { background:var(--glass-card); border:1px solid var(--glass-border); border-radius:16px; box-shadow:var(--shadow); backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px); transition:transform .2s, box-shadow .2s; }
    .service-card:hover,.price-card:hover { transform:translateY(-3px); box-shadow:0 18px 32px rgba(0,0,0,.3); }
    .btn-primary { background:linear-gradient(135deg,var(--accent),var(--accent-2)); color:#fff; border:none; padding:12px 20px; border-radius:10px; font-weight:700; cursor:pointer; }
    .btn-secondary { background:transparent; border:2px solid var(--accent); color:var(--link); padding:10px 18px; border-radius:10px; font-weight:600; cursor:pointer; }
    .btn-secondary:hover { background:var(--accent); color:#fff; }
    .form-control { width:100%; padding:14px 16px; border:1px solid var(--glass-border); border-radius:10px; background:rgba(0,0,0,.42); color:#fff; font-size:1rem; }
    .form-control:focus { outline:none; box-shadow:var(--focus); border-color:#63b3ed; }
    .form-label { display: block; margin-bottom: 8px; font-weight: 600; }
    .modal { display:none; position:fixed; inset:0; z-index:1000; background:rgba(0,0,0,.7); backdrop-filter:blur(6px); overscroll-behavior:contain; align-items:center; justify-content:center; }
    .modal-content { display:flex; flex-direction:column; background:rgba(17,24,39,.98); border:1px solid var(--glass-border); border-radius:16px; width:92%; max-width:980px; max-height:88vh; box-shadow:var(--shadow); overflow:hidden; }
    .modal-header { flex:0 0 auto; background:rgba(102,126,234,.98); color:#fff; padding:16px 20px; border-radius:16px 16px 0 0; display:flex; justify-content:space-between; align-items:center; }
    .modal-body { flex:1 1 auto; padding:24px; color:#f9fafb; font-size:1.06rem; line-height:1.65; overflow:auto; -webkit-overflow-scrolling:touch; }
    .close { color:#fff; font-size:28px; cursor:pointer; background:transparent; border:0; }
    .result-value { font-weight:800; font-size:1.35rem; }
    .result-ok { color: var(--ok); }
    .result-warn { color: var(--danger); }
    .fan-btn { display:inline-flex; flex-direction:column; gap:4px; padding:10px; border-radius:10px; border:1px solid var(--glass-border); background:rgba(0,0,0,.25); cursor:pointer; }
    .fan-line { width:26px; height:3px; border-radius:2px; background:#fff; }
    .fan-line:nth-child(2) { width:20px; }
    .fan-line:nth-child(3) { width:14px; }
    .sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }
    .sr-only:focus { position:static; width:auto; height:auto; padding:0.5rem; margin:0; overflow:visible; clip:auto; white-space:normal; outline:2px solid #fff; }
    .video-placeholder { background:rgba(0,0,0,.4); border-radius:10px; width:100%; height:300px; display:flex; align-items:center; justify-content:center; margin:1rem 0; }
    .note-red { display:inline-block; font-size:1.05rem; font-weight:700; color:#fff; background:rgba(239,68,68,.82); border:1px solid rgba(239,68,68,.9); padding:6px 12px; border-radius:10px; }
    .result-highlight { background:rgba(16,185,129,.18); border:2px solid rgba(16,185,129,.55); color:#d1fae5; padding:12px 14px; border-radius:12px; font-weight:800; font-size:1.05rem; display:inline-block; white-space:nowrap; }
    .badge { display:inline-block; padding:4px 8px; border-radius:8px; background:rgba(255,255,255,.08); border:1px solid var(--glass-border); font-size:.9rem; font-weight:700; color:#fff; }
    .services-grid .service-card img { width:200px; height:200px; object-fit:cover; border-radius:12px; }
    .roi-row label.form-label { display:flex; flex-direction:column; justify-content:flex-end; margin-bottom:0; }
    .faq-item + .faq-item { margin-top: 1rem; }
    details summary { cursor:pointer; font-weight:700; outline:none; }
    details[open] summary { color:#fff; }
    .fade-section { opacity:0; transform:translateY(24px); transition:opacity .6s ease, transform .6s ease; }
    .fade-section.fade-visible { opacity:1; transform:translateY(0); }
    .cta-subline { display:block; font-size:.75rem; font-weight:400; opacity:.8; margin-top:2px; }

    /* ===== Cookie-Banner ===== */
    #cookieBanner {
      position: fixed; bottom: 0; left: 0; right: 0; z-index: 9999;
      padding: 0 16px 16px;
      display: none;
    }
    .cb-inner {
      max-width: 900px; margin: 0 auto;
      background: rgba(11,15,26,0.96);
      border: 1px solid var(--glass-border);
      border-radius: 16px 16px 0 0;
      backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
      box-shadow: 0 -8px 40px rgba(0,0,0,.6);
      overflow: hidden;
    }
    .cb-tabs {
      display: flex; border-bottom: 1px solid rgba(255,255,255,.12);
      background: rgba(102,126,234,.08);
    }
    .cb-tab {
      flex: 1; padding: 12px 8px; background: transparent; border: none;
      color: var(--txt-sub); font-size: .9rem; font-weight: 600; cursor: pointer;
      border-bottom: 3px solid transparent; transition: color .2s, border-color .2s, background .2s;
    }
    .cb-tab:hover { color: #fff; background: rgba(255,255,255,.04); }
    .cb-tab.cb-tab-active { color: var(--accent); border-bottom-color: var(--accent); background: rgba(102,126,234,.1); }
    .cb-panel { padding: 16px 20px; }
    .cb-panel h3 { font-size: 1rem; font-weight: 700; color: #fff; margin-bottom: 8px; }
    .cb-panel p { font-size: .88rem; line-height: 1.55; color: var(--txt-sub); margin-bottom: 6px; }
    .cb-panel a { color: var(--link); text-decoration: underline; }
    .cb-categories {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 14px;
    }
    @media(max-width:600px) { .cb-categories { grid-template-columns: repeat(2,1fr); } }
    .cb-category {
      background: var(--glass-card); border: 1px solid var(--glass-border);
      border-radius: 10px; padding: 10px 12px;
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      font-size: .85rem; font-weight: 600; color: #fff; text-align: center;
    }
    /* Toggle switch */
    .cb-toggle-wrap { position: relative; display: inline-block; width: 44px; height: 24px; }
    .cb-toggle-wrap input { opacity: 0; width: 0; height: 0; }
    .cb-slider {
      position: absolute; cursor: pointer; inset: 0;
      background: rgba(255,255,255,.12); border-radius: 24px;
      transition: background .25s; border: 1px solid rgba(255,255,255,.2);
    }
    .cb-slider:before {
      content: ""; position: absolute;
      width: 18px; height: 18px; left: 3px; bottom: 3px;
      background: #fff; border-radius: 50%;
      transition: transform .25s;
    }
    .cb-toggle-wrap input:checked + .cb-slider { background: var(--accent); border-color: var(--accent); }
    .cb-toggle-wrap input:checked + .cb-slider:before { transform: translateX(20px); }
    .cb-toggle-locked {
      width: 44px; height: 24px; background: rgba(16,185,129,.5);
      border-radius: 24px; position: relative; cursor: not-allowed;
      border: 1px solid rgba(16,185,129,.7);
    }
    .cb-toggle-locked:before {
      content: ""; position: absolute;
      width: 18px; height: 18px; right: 3px; top: 3px;
      background: #fff; border-radius: 50%;
    }
    .cb-cat-note { font-size: .75rem; color: #6b7280; font-weight: 400; }
    .cb-buttons {
      display: flex; flex-wrap: wrap; gap: 8px;
      padding: 12px 20px 16px; border-top: 1px solid rgba(255,255,255,.1);
      background: rgba(0,0,0,.2);
    }
    .cb-btn-secondary {
      flex: 1; min-width: 140px; padding: 10px 16px; border-radius: 10px;
      background: rgba(255,255,255,.06); border: 1px solid var(--glass-border);
      color: var(--txt-sub); font-size: .9rem; font-weight: 600; cursor: pointer;
      transition: border-color .2s, color .2s, background .2s;
    }
    .cb-btn-secondary:hover { border-color: var(--accent); color: #fff; background: rgba(102,126,234,.15); }
    .cb-btn-primary {
      flex: 1; min-width: 140px; padding: 10px 16px; border-radius: 10px;
      background: linear-gradient(135deg, var(--accent), var(--accent-2));
      border: none; color: #fff; font-size: .9rem; font-weight: 700; cursor: pointer;
      box-shadow: 0 4px 16px rgba(102,126,234,.4);
    }
    .cb-btn-primary:hover { opacity: .9; }
    .cb-details-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
    .cb-details-list li { background: var(--glass-card); border: 1px solid var(--glass-border); border-radius: 10px; padding: 12px 14px; }
    .cb-details-list li strong { display: block; color: #fff; margin-bottom: 4px; }
    .cb-details-list li span { font-size: .85rem; color: var(--txt-sub); }

    /* ===== Multistep Contact ===== */
    .step-indicator {
      display: flex; align-items: center; gap: 0; margin-bottom: 28px;
    }
    .step-dot {
      width: 34px; height: 34px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: .9rem; flex-shrink: 0;
      transition: background .3s, color .3s;
    }
    .step-dot.active { background: var(--accent); color: #fff; }
    .step-dot.done { background: rgba(102,126,234,.45); color: #fff; }
    .step-dot.inactive { background: rgba(255,255,255,.12); color: #94a3b8; }
    .step-line { flex: 1; height: 2px; background: var(--glass-border); transition: background .3s; }
    .step-line.done { background: var(--accent); }
    .step-label { font-size: .72rem; font-weight: 600; text-align: center; margin-top: 4px; }
  </style>
</head>
<body>
  <a id="top"></a>
  <div id="bg" aria-hidden="true"></div>
  <a href="#main" class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 bg-black text-white px-3 py-2 rounded">Zum Hauptinhalt springen</a>

  <!-- ===== COOKIE-BANNER ===== -->
  <div id="cookieBanner" role="dialog" aria-modal="true" aria-label="Cookie-Einstellungen" aria-live="polite">
    <div class="cb-inner">
      <div class="cb-tabs">
        <button class="cb-tab cb-tab-active" id="cb-tab-consent" onclick="switchCookieTab('consent')">Zustimmung</button>
        <button class="cb-tab" id="cb-tab-details" onclick="switchCookieTab('details')">Details</button>
        <button class="cb-tab" id="cb-tab-about" onclick="switchCookieTab('about')">Über Cookies</button>
      </div>

      <!-- Tab: Zustimmung -->
      <div id="cb-panel-consent" class="cb-panel">
        <h3>Diese Website verwendet Cookies</h3>
        <p>Wir setzen Cookies ein, um Ihnen eine optimale Nutzungserfahrung zu bieten, die Website-Performance auszuwerten und unsere Inhalte kontinuierlich zu verbessern. Technisch notwendige Cookies sind für den Betrieb der Seite unerlässlich und können nicht deaktiviert werden.</p>
        <p>Detaillierte Informationen finden Sie in unserer <a href="/datenschutz">Datenschutzerklärung</a> und im <a href="/impressum">Impressum</a>. Ihre Einwilligung können Sie jederzeit über den Link „Cookie-Einstellungen" im Footer widerrufen.</p>
        <div class="cb-categories">
          <div class="cb-category">
            Notwendig
            <div class="cb-toggle-locked" title="Immer aktiv – technisch erforderlich"></div>
            <span class="cb-cat-note">Immer aktiv</span>
          </div>
          <div class="cb-category">
            Präferenzen
            <label class="cb-toggle-wrap">
              <input type="checkbox" id="toggle_preferences">
              <span class="cb-slider"></span>
            </label>
          </div>
          <div class="cb-category">
            Statistiken
            <label class="cb-toggle-wrap">
              <input type="checkbox" id="toggle_statistics">
              <span class="cb-slider"></span>
            </label>
          </div>
          <div class="cb-category">
            Marketing
            <label class="cb-toggle-wrap">
              <input type="checkbox" id="toggle_marketing">
              <span class="cb-slider"></span>
            </label>
          </div>
        </div>
      </div>

      <!-- Tab: Details -->
      <div id="cb-panel-details" class="cb-panel" style="display:none">
        <ul class="cb-details-list">
          <li>
            <strong>Notwendige Cookies</strong>
            <span>Sichern grundlegende Funktionen wie Navigation, Formulare und Sicherheit. Speicherdauer: Sitzung bis max. 1 Jahr. Keine Weitergabe an Dritte.</span>
          </li>
          <li>
            <strong>Präferenz-Cookies</strong>
            <span>Speichern Ihre Einstellungen (z. B. Sprachauswahl, Theme) für einen komfortableren Besuch. Speicherdauer: bis zu 12 Monate.</span>
          </li>
          <li>
            <strong>Statistik-Cookies</strong>
            <span>Helfen uns zu verstehen, wie Besucher die Website nutzen (z. B. besuchte Seiten, Verweildauer). Daten werden anonymisiert erhoben. Speicherdauer: bis zu 24 Monate.</span>
          </li>
          <li>
            <strong>Marketing-Cookies</strong>
            <span>Ermöglichen die Darstellung personalisierter Werbung auf externen Plattformen. Speicherdauer: bis zu 12 Monate. Weitergabe an Werbenetzwerke möglich.</span>
          </li>
        </ul>
      </div>

      <!-- Tab: Über Cookies -->
      <div id="cb-panel-about" class="cb-panel" style="display:none">
        <h3>Was sind Cookies?</h3>
        <p>Cookies sind kleine Textdateien, die beim Besuch einer Website in Ihrem Browser gespeichert werden. Sie ermöglichen es, Einstellungen zu merken, die Nutzung zu analysieren und personalisierte Inhalte anzuzeigen.</p>
        <p>Gemäß der DSGVO und dem TTDSG haben Sie das Recht, nicht notwendige Cookies abzulehnen oder Ihre Einwilligung jederzeit zu widerrufen – ohne Nachteile für Ihre Nutzung der Website.</p>
        <p>Weitere Informationen: <a href="/datenschutz">Datenschutzerklärung</a> · <a href="/impressum">Impressum</a></p>
      </div>

      <div class="cb-buttons">
        <button class="cb-btn-secondary" onclick="acceptNecessaryOnly()">Nur notwendige Cookies</button>
        <button class="cb-btn-secondary" onclick="acceptSelection()">Auswahl erlauben</button>
        <button class="cb-btn-primary" onclick="acceptAll()">Alle akzeptieren</button>
      </div>
    </div>
  </div>
  <!-- /COOKIE-BANNER -->

  <header id="header" class="header fixed top-0 left-0 right-0 z-50">
    <div class="container mx-auto px-4">
      <div class="flex items-center justify-between py-3">
        <div class="flex items-center gap-3">
          <img src="/assets/images/Logo.webp" alt="EPPCOM Solutions" class="logo" width="168" height="84" />
          <div>
            <div class="text-lg md:text-xl font-bold text-white">EPPCOM Solutions</div>
            <p class="text-sm" style="color:#e6eaee">KI-Automatisierung für KMU</p>
          </div>
        </div>
        <nav class="hidden md:flex gap-6" aria-label="Hauptnavigation">
          <a href="#home" class="text-white">Start</a>
          <a href="#services" class="text-white">Leistungen</a>
          <a href="#about" class="text-white">Über uns</a>
          <a href="#pricing" class="text-white">Preise</a>
          <a href="#cases" class="text-white">Praxisbeispiele</a>
          <a href="#roi" class="text-white">ROI-Analyse</a>
          <a href="#faq" class="text-white">FAQ</a>
          <a href="#contact" class="text-white">Kontakt</a>
        </nav>
        <button id="mobileMenuBtn" class="md:hidden fan-btn" aria-label="Menü öffnen" aria-controls="mobileMenu" aria-expanded="false">
          <span class="fan-line"></span><span class="fan-line"></span><span class="fan-line"></span>
        </button>
      </div>
      <nav id="mobileMenu" class="hidden md:hidden py-3 border-t border-white/20">
        <a href="#home" class="block py-2 text-white">Start</a>
        <a href="#services" class="block py-2 text-white">Leistungen</a>
        <a href="#about" class="block py-2 text-white">Über uns</a>
        <a href="#pricing" class="block py-2 text-white">Preise</a>
        <a href="#cases" class="block py-2 text-white">Praxisbeispiele</a>
        <a href="#roi" class="block py-2 text-white">ROI-Analyse</a>
        <a href="#faq" class="block py-2 text-white">FAQ</a>
        <a href="#contact" class="block py-2 text-white">Kontakt</a>
      </nav>
    </div>
  </header>

  <section id="home" role="banner"
    class="relative flex flex-col items-center justify-center text-center px-8 overflow-hidden rounded-3xl max-w-6xl mx-auto shadow-2xl"
    style="min-height: 85vh; margin-top: 120px; padding: 80px 2rem;">
    <div class="relative z-10 flex flex-col items-center" aria-live="polite">
      <h1 class="block font-extrabold text-white mb-3 fade-section hero-title drop-shadow-lg"
        style="font-size: clamp(2rem, 5vw, 3.5rem); letter-spacing: 0.02em; line-height: 1.1;">
        Vom Hype zur Rendite</h1>
      <h2 class="font-extrabold leading-tight text-blue-300 mb-4 fade-section hero-subtitle drop-shadow-lg"
        style="font-size: clamp(1.5rem, 4vw, 2.5rem); line-height: 1.15;">
        Mehr Zeit, weniger Routine – mehr Umsatz</h2>
      <p class="text-base md:text-lg text-slate-100 max-w-3xl mx-auto mb-10 leading-relaxed fade-section hero-description">
        Durchschnittlich <span class="font-extrabold text-[#f35555] bg-[#5e2127]/60 px-2 rounded-md shadow-sm animate-pulse-subtle">bis zu 60 % weniger Büroarbeit</span>
        in <span class="font-bold text-white">2–6 Wochen</span>.<br>
        Wir automatisieren E-Mail, Rechnungen, Anfragen und Freigaben. Mit Monitoring, KPIs und menschlicher Kontrolle.<br>
        <span class="text-cyan-200">Für KMU</span> in Reutlingen, Tübingen, Stuttgart und bundesweit remote.</p>

      <div class="hero-box relative bg-gradient-to-br from-[#f35555]/80 via-[#c72f54]/85 to-rose-600/80 text-white px-8 py-7 rounded-2xl shadow-[0_20px_60px_-15px_rgba(243,85,85,0.3)] max-w-3xl mx-auto mb-10 border-2 border-[#c72f54]/50 fade-section animate-fadeInScale">
        <div class="relative z-10 space-y-2">
          <span class="font-extrabold text-xl md:text-2xl leading-tight drop-shadow-xl text-[#f35555] bg-[#220a11]/60 px-2 rounded-md shadow animate-glow" style="display:inline-block;">
            Bis zu 50 % staatliche Zuschüsse
          </span>
          <span class="text-base md:text-lg text-white/90 font-medium block mt-2">
            Inkl. EU AI Act-Compliance-Support. Förderfähig sind je nach Programm oft Beratung, Qualifizierung und Umsetzung.<br>
            EPPCOM begleitet Sie <span class="font-bold text-[#f35555]">von der Prüfung bis zur Umsetzung</span>.
          </span>
        </div>
        <div class="absolute inset-0 bg-white/5 rounded-2xl animate-shimmer"></div>
      </div>

      <div class="hero-ctas flex flex-col sm:flex-row gap-6 justify-center mb-16 fade-section">
        <a href="#roi" aria-label="Potentiellen ROI berechnen"
          class="group relative inline-flex items-center justify-center px-10 py-5 rounded-2xl font-bold text-lg
          text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700
          shadow-[0_15px_50px_-10px_rgba(37,99,235,0.7)]
          focus:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/70">
          <span class="mr-3 text-2xl">📊</span> Potentiellen ROI in 2 Minuten berechnen
          <span class="cta-subline">Unverbindliche Schätzung auf Basis Ihrer Angaben</span>
        </a>
        <a href="#contact" aria-label="Kontaktformular öffnen"
          class="group inline-flex items-center justify-center px-10 py-5 rounded-2xl font-bold text-lg
          text-slate-50 bg-slate-800/50 border-2 border-slate-300/70
          hover:bg-slate-700/70 hover:border-cyan-300 backdrop-blur-sm">
          <span class="mr-3 text-2xl">💬</span> Direkt Starten
        </a>
      </div>

      <div class="hero-usps grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto text-left fade-section">
        <div class="bg-slate-800/30 backdrop-blur-sm border border-slate-600/30 rounded-2xl p-6 hover:bg-slate-800/50 transition-all duration-500 hover:scale-105 hover:shadow-[0_20px_40px_-10px_rgba(56,189,248,0.3)] transform hover:-translate-y-2">
          <div class="text-3xl mb-3 animate-bounce-subtle">⚡</div>
          <h3 class="font-bold text-white text-lg mb-2">Schnelle Umsetzung</h3>
          <p class="text-slate-300 text-base leading-relaxed">Erste Automatisierungen nach <span class="text-cyan-300 font-semibold">2–4 Wochen</span> im Einsatz.</p>
        </div>
        <div class="bg-slate-800/30 backdrop-blur-sm border border-slate-600/30 rounded-2xl p-6 hover:bg-slate-800/50 transition-all duration-500 hover:scale-105 hover:shadow-[0_20px_40px_-10px_rgba(34,197,94,0.3)] transform hover:-translate-y-2">
          <div class="text-3xl mb-3 animate-bounce-subtle">🔒</div>
          <h3 class="font-bold text-white text-lg mb-2">DSGVO &amp; EU AI Act</h3>
          <p class="text-slate-300 text-base leading-relaxed"><span class="text-green-300 font-semibold">Datenschutz-konforme</span> Lösungen mit Compliance-Beratung.</p>
        </div>
        <div class="bg-slate-800/30 backdrop-blur-sm border border-slate-600/30 rounded-2xl p-6 hover:bg-slate-800/50 transition-all duration-500 hover:scale-105 hover:shadow-[0_20px_40px_-10px_rgba(243,85,85,0.4)] transform hover:-translate-y-2">
          <div class="text-3xl mb-3 animate-bounce-subtle">💰</div>
          <h3 class="font-bold text-white text-lg mb-2">Staatliche Förderung</h3>
          <p class="text-slate-300 text-base leading-relaxed"><span class="font-semibold" style="color:#f35555;">Bis zu 50 % Zuschüsse</span> – wir unterstützen bei der Beantragung.</p>
        </div>
      </div>
    </div>
  </section>

  <style>
    @keyframes fadeUpIn { 0%{opacity:0;transform:translateY(60px)} 100%{opacity:1;transform:translateY(0)} }
    @keyframes fadeInScale { 0%{opacity:0;transform:scale(0.9)} 100%{opacity:1;transform:scale(1)} }
    @keyframes shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
    @keyframes glow { 0%,100%{text-shadow:0 0 20px #f35555} 50%{text-shadow:0 0 30px #c72f54,0 0 40px #f35555} }
    @keyframes pulseSubtle { 0%,100%{opacity:1} 50%{opacity:0.85} }
    @keyframes bounceSubtle { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
    @keyframes pulseSlow { 0%,100%{opacity:.3} 50%{opacity:.5} }
    .animate-shimmer { background:linear-gradient(90deg,transparent,rgba(255,255,255,0.1),transparent); background-size:200% 100%; animation:shimmer 3s infinite; }
    .animate-glow { animation:glow 2s ease-in-out infinite; }
    .animate-pulse-subtle { animation:pulseSubtle 3s ease-in-out infinite; }
    .animate-bounce-subtle { animation:bounceSubtle 2s ease-in-out infinite; }
    .hero-title    { animation:fadeUpIn 1s ease-out forwards; animation-delay:.2s; }
    .hero-subtitle { animation:fadeUpIn 1s ease-out forwards; animation-delay:.5s; }
    .hero-description { animation:fadeUpIn 1s ease-out forwards; animation-delay:.8s; }
    .hero-box      { animation:fadeInScale 1s ease-out forwards; animation-delay:1.1s; }
    .hero-ctas,.hero-usps { animation:fadeUpIn 1s ease-out forwards; animation-delay:1.4s; }
    @media(max-width:768px){
      #home{padding:24px 16px;}
      #home h1{font-size:2.2rem !important; margin-bottom:18px;}
      .hero-description{font-size:.92rem;}
    }
    @media(min-width:769px) and (max-width:1024px){ #home h1{font-size:2.8rem !important;} }
    @media(min-width:1025px){ #home h1{font-size:3rem !important;} }
  </style>

  <script>
  document.addEventListener('DOMContentLoaded', () => {
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('fade-visible');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -100px 0px' });
    document.querySelectorAll('.fade-section').forEach(el => observer.observe(el));

    // Parallax hero-box
    const heroBox = document.querySelector('.hero-box');
    if (heroBox) {
      window.addEventListener('scroll', () => {
        const rate = window.pageYOffset * 0.15;
        if (heroBox.getBoundingClientRect().top < window.innerHeight)
          heroBox.style.transform = `translateY(${rate}px) scale(1)`;
      }, { passive: true });
    }

    // Smooth scroll
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const id = this.getAttribute('href');
        if (id === '#top' || id === '#home') { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
        const el = document.querySelector(id);
        if (el) {
          const offset = el.getBoundingClientRect().top + window.pageYOffset - 100;
          window.scrollTo({ top: offset, behavior: 'smooth' });
        }
      });
    });

    // Tracking hooks
    document.querySelectorAll('a[href="#roi"]').forEach(a => a.addEventListener('click', () => track('cta_roi_click')));
    document.querySelectorAll('a[href="#contact"]').forEach(a => a.addEventListener('click', () => track('cta_contact_click')));

    // Staggered USP
    document.querySelectorAll('.hero-usps > div').forEach((el, i) => { el.style.transitionDelay = `${i * 0.15}s`; });

    // Mobile menu
    document.getElementById('mobileMenuBtn')?.addEventListener('click', function() {
      const menu = document.getElementById('mobileMenu');
      const exp = this.getAttribute('aria-expanded') === 'true';
      menu.classList.toggle('hidden');
      this.setAttribute('aria-expanded', String(!exp));
    });

    // Header hide on scroll
    let lastY = 0;
    window.addEventListener('scroll', () => {
      const h = document.getElementById('header');
      const y = window.scrollY;
      if (y > lastY && y > 120) h.classList.add('hidden');
      else h.classList.remove('hidden');
      lastY = y;
    }, { passive: true });

    // Init pricing
    renderPricing();
    // Init ROI
    calcROI();
    // Init cookie banner
    initCookieBanner();
  });
  </script>

  <main id="main">

  <!-- LEISTUNGEN -->
  <section id="services" class="content-section container mx-auto px-4 py-16" aria-labelledby="services-title">
    <div class="text-center mb-12">
      <h2 id="services-title" class="text-3xl md:text-4xl font-bold mb-4">Kern-Dienstleistungen</h2>
      <p class="text-xl max-w-3xl mx-auto">Klarer Nutzen. Schnelle Umsetzung. Ergebnisse statt Buzzwords.</p>
    </div>
    <div class="grid md:grid-cols-4 gap-8 services-grid">
      <article class="service-card p-6 text-center">
        <img class="mx-auto mb-4" src="/assets/images/services/KI-workflow_automation.webp" alt="KI-Workflow-Automatisierung" width="200" height="200" loading="lazy" decoding="async">
        <h3 class="text-xl font-bold mb-2">Workflow-Automatisierung</h3>
        <p class="mb-3">Von Chaos zu Kontrolle – Wir automatisieren Backoffice-Prozesse wie E-Mail, Rechnungen, Freigaben und Reporting. Regelbasiert, nachvollziehbar und mit menschlicher Kontrolle.</p>
        <ul class="list-disc list-inside text-left mt-3 space-y-1">
          <li>E-Mail von 8 h auf 1 h/Woche</li>
          <li>Rechnungen: 90 % weniger Klicks</li>
          <li>Klarer Status, KPIs &amp; Monitoring</li>
        </ul>
        <button class="btn-secondary mt-4" onclick="openServiceModal('workflow')">Details &amp; Video</button>
      </article>
      <article class="service-card p-6 text-center">
        <img class="mx-auto mb-4" src="/assets/images/services/KI-Chatbots.webp" alt="KI-Chatbots" width="200" height="200" loading="lazy" decoding="async">
        <h3 class="text-xl font-bold mb-2">KI-Chatbots</h3>
        <p class="mb-3">Chatbots für Website, WhatsApp und Voice. Antworten, Vorqualifizierung und Terminvereinbarung. Übergabe ins CRM oder Helpdesk inklusive.</p>
        <ul class="list-disc list-inside text-left mt-3 space-y-1">
          <li>Website-Chatbots, WhatsApp &amp; Voice-Bots</li>
          <li>Lead-Qualifizierung &amp; Übergabe ins CRM</li>
          <li>24/7 Antworten + Eskalation an Team</li>
        </ul>
        <button class="btn-secondary mt-4" onclick="openServiceModal('chatbots')">Details &amp; Video</button>
      </article>
      <article class="service-card p-6 text-center">
        <img class="mx-auto mb-4" src="/assets/images/services/KI-Strategie+Schulungen.webp" alt="KI-Strategie & Schulung" width="200" height="200" loading="lazy" decoding="async">
        <h3 class="text-xl font-bold mb-2">KI-Strategie &amp; Schulungen</h3>
        <p class="mb-3">Klarer Plan statt KI-Chaos. Potenzialanalyse, Roadmap, Governance und Team-Enablement. Damit die Umsetzung nicht am Alltag scheitert.</p>
        <ul class="list-disc list-inside text-left mt-3 space-y-1">
          <li>ROI-basierte Priorisierung &amp; Roadmap</li>
          <li>Governance: Rollen, Regeln, Verantwortlichkeiten</li>
          <li>Teams können Prozesse eigenständig fortführen</li>
        </ul>
        <button class="btn-secondary mt-4" onclick="openServiceModal('strategy')">Details &amp; Video</button>
      </article>
      <article class="service-card p-6 text-center">
        <img class="mx-auto mb-4" src="/assets/images/services/KI-Webdesign+Marketing.webp" alt="KI-Webdesign & Marketing" width="200" height="200" loading="lazy" decoding="async">
        <h3 class="text-xl font-bold mb-2">KI-Webdesign &amp; Marketing</h3>
        <p class="mb-3">Landingpages, SEO-Cluster und Content-Prozesse, die Leads liefern. Mit Tracking, Tests und Chatbot-Vorqualifizierung.</p>
        <ul class="list-disc list-inside text-left mt-3 space-y-1">
          <li>Landingpages &amp; strukturierte Daten</li>
          <li>Automatisierte Redaktion</li>
          <li>Chatbot-Conversion</li>
        </ul>
        <button class="btn-secondary mt-4" onclick="openServiceModal('webmarketing')">Details &amp; Video</button>
      </article>
    </div>
    <div class="service-card p-6 md:p-8 mt-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
      <div class="flex items-start gap-5">
        <img class="rounded-lg" src="/assets/images/services/IAD-logo.png" alt="Digitaler Real-Estate-Service iAD" width="140" height="140" loading="lazy" decoding="async">
        <div>
          <h3 class="text-2xl font-bold mb-2">Digitaler Real-Estate-Service iAD</h3>
          <p class="max-w-3xl">Bewertung, Exposé, 360°-Tour, Vermarktung, Besichtigungen, Verhandlung und sichere Abwicklung – provisionsbasiert.</p>
        </div>
      </div>
      <div class="flex gap-3 md:shrink-0">
        <button class="btn-secondary" onclick="openServiceModal('real-estate')">Details</button>
        <a href="#contact" class="btn-primary">Anfragen</a>
      </div>
    </div>
  </section>

  <!-- ÜBER UNS -->
  <section id="about" class="content-section container mx-auto px-4 py-16">
    <div class="grid md:grid-cols-2 gap-8 items-start">
      <div>
        <h2 class="text-3xl md:text-4xl font-bold mb-4">Über EPPCOM Solutions</h2>
        <p>EPPCOM Solutions automatisiert wiederkehrende Prozesse in KMU mit KI und Workflows. Ziel ist messbare Entlastung im Alltag. <b>Unser Vorgehen:</b> Wir starten mit den Prozessen, die sofort Zeit und Kosten sparen.</p>
        <ul class="list-disc list-inside mt-4 space-y-2">
          <li>Ø 60 % weniger Büroarbeit in 2–6 Wochen</li>
          <li>Klare Roadmap mit ROI-Priorisierung</li>
          <li>Governance, Datenschutz &amp; EU AI Act included</li>
          <li>Staatliche Förderung – wir kümmern uns um den Antrag</li>
        </ul>
        <p class="mt-4">Unsere Philosophie: Automatisierung ist nur dann wertvoll, wenn der Mensch im Mittelpunkt bleibt. Wir bauen KI-Systeme, die Ihr Team befähigen – nicht ersetzen.</p>
      </div>
      <aside class="service-card p-6">
        <h3 class="text-2xl font-bold mb-3">Warum EPPCOM?</h3>
        <ul class="space-y-2">
          <li><strong>Fokus auf KMU:</strong> keine One-Size-Fits-All-Lösungen.</li>
          <li><strong>Messbare Erfolge:</strong> ROI in Wochen, nicht Jahren.</li>
          <li><strong>Volle Beratung:</strong> von Analyse bis Support.</li>
          <li><strong>Regional präsent:</strong> Reutlingen, Tübingen, Stuttgart – bundesweit remote.</li>
          <li><strong>Förderpartner:</strong> Begleitung durch Programme &amp; Zuschüsse.</li>
        </ul>
      </aside>
    </div>
  </section>

  <!-- PREISE -->
  <section id="pricing" class="content-section container mx-auto px-4 py-16" aria-labelledby="pricing-title">
    <div class="text-center mb-10">
      <h2 id="pricing-title" class="text-3xl md:text-4xl font-bold mb-2">Preise &amp; Pakete</h2>
      <p>Transparent &amp; nachvollziehbar – alle Preise zzgl. MwSt. (<em>inkl. MwSt. in Klammern</em>).</p>
    </div>
    <div class="service-card p-4 md:p-5 mb-6 flex flex-col md:flex-row md:items-center md:gap-4">
      <label class="form-label mb-2 md:mb-0" for="serviceFocus">Service-Fokus</label>
      <select id="serviceFocus" class="form-control md:max-w-xs" onchange="renderPricing()">
        <option value="workflow">KI-Workflow-Automatisierungen</option>
        <option value="chatbots">KI-Chatbots</option>
        <option value="webmarketing">KI-Webdesign &amp; Marketing</option>
        <option value="training">KI-Strategie &amp; Schulungen</option>
      </select>
      <p id="serviceHelp" class="md:ml-3 mt-3 md:mt-0 text-sm flex-1"></p>
    </div>
    <div id="pricingGrid" class="grid md:grid-cols-4 gap-8"></div>
    <div id="trainingGrid" class="grid md:grid-cols-4 gap-8 mt-8"></div>
    <div class="text-center mt-8">
      <button id="billingToggle" class="btn-secondary px-6 py-3" aria-pressed="false" onclick="toggleBilling()">Preise pro: Jahr</button>
      <p class="text-sm mt-2">Monatspreis ↔ Jahrespreis</p>
    </div>
    <div class="text-center mt-8 p-6 rounded-lg" style="background:rgba(0,0,0,.25); border:1px solid var(--glass-border)">
      <h3 class="text-xl font-bold mb-3" style="color:#b7f0c2">Transparent &amp; marktgerecht</h3>
      <ul class="inline-block text-left space-y-1">
        <li>• Kostenlose Erstberatung 30 Min</li>
        <li>• KI-Potentialanalyse: 390 € (bei Auftrag verrechnet)</li>
        <li>• Workflow-Automatisierung: ab 133 € p.m. (1.490 €/Jahr)</li>
        <li>• KI-Chatbots: ab 89 € p.m. (990 €/Jahr)</li>
        <li>• KI-Webdesign &amp; Marketing: ab 133 € p.m. (1.490 €/Jahr)</li>
        <li>• KI-Strategie &amp; Schulungen: ab 790 € (Halbtags-Workshop)</li>
        <li>• Laufende Betreuung: 490 € p.m.</li>
        <li>• Alle Preise zzgl. 19 % MwSt. · Bis zu 50 % staatliche Förderung möglich</li>
      </ul>
    </div>
  </section>

  <!-- PRAXISBEISPIELE -->
  <section id="cases" class="content-section container mx-auto px-4 py-16" aria-labelledby="cases-title">
    <div class="text-center mb-12">
      <h2 id="cases-title" class="text-3xl md:text-4xl font-bold mb-4">Praxisbeispiele</h2>
      <p class="text-xl max-w-3xl mx-auto">Kurz, konkret und messbar – Vorher/Nachher im Popup. Beispiele aus Büro, Kanzlei, Praxis, Handwerk und Vertrieb.</p>
    </div>
    <div class="grid md:grid-cols-3 gap-8">
      <button class="price-card p-6 text-left" onclick="openCase('email')"><h3 class="text-xl font-bold mb-1">E-Mail-Postfach</h3><p>Von 8h auf 1h / Woche.</p></button>
      <button class="price-card p-6 text-left" onclick="openCase('invoice')"><h3 class="text-xl font-bold mb-1">Rechnungen</h3><p>Extraktion, Prüfung, Freigabe.</p></button>
      <button class="price-card p-6 text-left" onclick="openCase('leads')"><h3 class="text-xl font-bold mb-1">Kundenanfragen</h3><p>Vorqualifizierung &amp; CRM.</p></button>
      <button class="price-card p-6 text-left" onclick="openCase('steuerkanzlei')"><h3 class="text-xl font-bold mb-1">Steuerkanzlei</h3><p>Mandatskommunikation &amp; Fristen.</p></button>
      <button class="price-card p-6 text-left" onclick="openCase('arztpraxis')"><h3 class="text-xl font-bold mb-1">Arztpraxis</h3><p>Voice-Bot, Terminaufbereitung.</p></button>
      <button class="price-card p-6 text-left" onclick="openCase('immobilien')"><h3 class="text-xl font-bold mb-1">Immobilienmakler</h3><p>Leads, Exposés, Termine.</p></button>
      <button class="price-card p-6 text-left" onclick="openCase('handwerk')"><h3 class="text-xl font-bold mb-1">Handwerk</h3><p>Angebote &amp; Nachkalkulation.</p></button>
      <button class="price-card p-6 text-left" onclick="openCase('it')"><h3 class="text-xl font-bold mb-1">IT-Services</h3><p>Ticket-Triage &amp; Doku.</p></button>
      <button class="price-card p-6 text-left" onclick="openCase('anwaltskanzlei')"><h3 class="text-xl font-bold mb-1">Anwaltskanzlei</h3><p>Akten-Erfassung &amp; Intake.</p></button>
    </div>
  </section>

  <!-- ROI-ANALYSE -->
  <section id="roi" class="content-section container mx-auto px-4 py-16" aria-labelledby="roi-title">
    <div class="text-center mb-10">
      <h2 id="roi-title" class="text-3xl md:text-4xl font-bold mb-2">ROI-Analyse</h2>
      <p class="text-xl max-w-3xl mx-auto">Unverbindlich in 2 Minuten abschätzen – potentielles Ergebnis klar hervorgehoben.</p>
    </div>
    <form id="roiForm" class="service-card p-6" onsubmit="return submitROI(event)">
      <div class="grid md:grid-cols-4 gap-4">
        <label class="form-label">Unternehmensgröße
          <select id="roi_employees" name="roi_employees" class="form-control" required>
            <option>1–9</option><option>10–49</option><option>50–249</option><option>250+</option>
          </select>
        </label>
        <label class="form-label">Branchenauswahl
          <select id="roi_industry" name="roi_industry" class="form-control" required onchange="updatePackagesForIndustry(); calcROI()">
            <option value="" disabled selected>Bitte Branche auswählen</option>
            <option>IT- und Technologieunternehmen</option>
            <option>Dienstleistungsunternehmen</option>
            <option>Handelsunternehmen / -dienstleister</option>
            <option>Handwerksbetrieb</option>
            <option>Produktionsunternehmen / Industrie</option>
            <option>Immobilien- und Bauwirtschaft</option>
            <option>Anwalts- / Steuerberatungskanzlei</option>
            <option>Gesundheitswesen / Arztpraxis</option>
            <option>Gastronomie &amp; Hotellerie</option>
            <option>Öffentlicher Sektor / Bildung / Verwaltung</option>
            <option>Sonstige Branche</option>
          </select>
        </label>
        <label class="form-label">Aktuelle Std/Woche
          <input id="roi_hours" name="roi_hours" type="number" min="0" max="80" step="0.5" value="8" class="form-control" oninput="calcROI()">
        </label>
        <label class="form-label">Stundensatz in €
          <input id="roi_wage" name="roi_wage" type="number" min="20" max="200" step="5" value="40" class="form-control" oninput="calcROI()">
        </label>
      </div>
      <div class="grid md:grid-cols-3 gap-4 mt-4 items-end roi-row">
        <label class="form-label">Automatisierungsgrad
          <div class="flex items-center gap-3">
            <input id="roi_level" name="roi_level" type="range" min="0.5" max="0.95" step="0.05" value="0.7" class="w-full"
              oninput="document.getElementById('autoPct').textContent=Math.round(this.value*100)+'%'; calcROI();">
            <span class="badge" aria-live="polite">Aktuell: <span id="autoPct">70%</span></span>
          </div>
        </label>
        <label class="form-label">Paket
          <select id="roi_package" name="roi_package" class="form-control" onchange="calcROI()">
            <option value="1490">Mini: 1.490 €</option>
            <option value="3490" selected>Basis: 3.490 €</option>
            <option value="6990">Profi: 6.990 €</option>
            <option value="11990">Enterprise: 11.990 €</option>
          </select>
        </label>
        <button class="btn-primary w-full py-3" type="button" onclick="openFinder()">Automatisierungsfinder</button>
      </div>
      <div class="grid md:grid-cols-5 gap-4 mt-6">
        <div><h4>Wöchentliche Ersparnis</h4><div class="result-value result-warn" id="weekly_savings">–</div></div>
        <div><h4>Monatliche Ersparnis</h4><div class="result-value result-warn" id="monthly_savings">–</div></div>
        <div><h4>Amortisation</h4><div class="result-value result-warn" id="payback_time">–</div></div>
        <div><h4>Zeitersparnis</h4><div class="result-value result-warn" id="time_saved">–</div></div>
        <div>
          <h4>Jahres-ROI</h4>
          <div id="yearly_roi" class="result-highlight" role="status" aria-live="polite">–</div>
        </div>
      </div>
      <input type="hidden" name="roi_weekly"    id="roi_weekly_h">
      <input type="hidden" name="roi_monthly"   id="roi_monthly_h">
      <input type="hidden" name="roi_yearly"    id="roi_yearly_h">
      <input type="hidden" name="roi_payback"   id="roi_payback_h">
      <input type="hidden" name="roi_time_saved" id="roi_time_saved_h">
    </form>
    <div class="mt-8 p-6 rounded-lg" style="background:rgba(0,0,0,.25); border:1px solid rgba(255,255,255,.15)">
      <h3 class="text-xl font-bold mb-3" style="color:#b7f0c2">Wie der ROI zu verstehen ist</h3>
      <p class="text-sm leading-relaxed text-gray-200">Kleine Pakete automatisieren meist einzelne Prozesse – etwa E-Mails oder Rechnungen – und sorgen für schnelle, sichtbare Entlastung. Größere Pakete vernetzen ganze Abläufe, binden CRM oder Buchhaltung ein und steigern die Wirkung deutlich.</p>
      <p class="text-sm leading-relaxed text-gray-200 mt-2">Die höheren Kosten größerer Pakete rechtfertigen sich durch den höheren Automatisierungsgrad: mehr Zeitersparnis, weniger Fehler, kürzere Durchlaufzeiten. Je stärker integriert, desto schneller amortisiert sich die Investition – oft in wenigen Monaten.</p>
      <p class="text-sm leading-relaxed text-gray-200 mt-2"><strong>Hinweis zur Prozentangabe beim Jahres-ROI:</strong> Die Zahl in Klammern zeigt die <em>Rendite relativ zur Investition</em>.</p>
      <p class="text-sm leading-relaxed text-gray-200 mt-2"><strong>Monatliche Bezahlung:</strong> Der Jahrespreis kann in 12 Raten zu marktüblichen Zinsen beglichen werden – wir zeigen den <em>Endpreis inkl. APR</em>.</p>
    </div>
    <div class="mt-4 text-center">
      <button type="button" class="btn-primary px-6 py-3" onclick="captureROIAndGoToContact()">Analyse übermitteln und Ersparnis direkt beginnen</button>
      <p class="text-xs mt-2" style="color:#94a3b8">Beim Absenden des Kontaktformulars werden Ihre ROI-Eingaben und Ergebnisse mitgesendet.</p>
    </div>
  </section>

  <!-- FAQ -->
  <section id="faq" class="content-section container mx-auto px-4 py-16" aria-labelledby="faq-title">
    <div class="text-center mb-8">
      <h2 id="faq-title" class="text-3xl md:text-4xl font-bold mb-2">FAQ – Häufige Fragen</h2>
      <p class="text-lg max-w-3xl mx-auto">Kurze Antworten auf häufige Fragen zu Automatisierung, Förderung, EU AI Act, Datenschutz und ROI.</p>
    </div>
    <div class="max-w-4xl mx-auto">
      <div class="faq-item">
        <details class="service-card p-6">
          <summary>Was bedeutet „Bis zu 50 Prozent staatliche Zuschüsse"?</summary>
          <div class="mt-3 text-sm text-gray-300">
            Viele Digitalisierungs- und KI-Projekte können über Förderprogramme bezuschusst werden. Je nach Programm und Bundesland sind Förderquoten von bis zu 50 Prozent der Projektkosten möglich. EPPCOM prüft, ob Ihr Vorhaben förderfähig ist und in welcher Höhe eine Förderung realistisch ist, und begleitet Sie durch die Antragstellung.
          </div>
        </details>
      </div>
      <div class="faq-item">
        <details class="service-card p-6">
          <summary>Was umfasst der EU AI Act-Compliance-Support?</summary>
          <div class="mt-3 text-sm text-gray-300">
            Wir prüfen, welche Vorgaben des EU AI Act für Ihr Projekt relevant sind. Dazu gehören eine verständliche Beschreibung der eingesetzten KI, eine einfache Risiko- und Zweckdokumentation, Regeln für den praktischen Einsatz im Unternehmen sowie Empfehlungen zu technischen und organisatorischen Schutzmaßnahmen. Ziel ist, dass Ihre Lösung fachlich sinnvoll und rechtlich sauber nutzbar ist.
          </div>
        </details>
      </div>
      <div class="faq-item">
        <details class="service-card p-6">
          <summary>Was bedeutet „Förderung, Qualifizierung und Compliance aus einer Hand"?</summary>
          <div class="mt-3 text-sm text-gray-300">
            Technik, Förderung und Schulung greifen bei EPPCOM zusammen. Wir planen das Projekt so, dass es zu den Förderkriterien passt, schulen Ihre Mitarbeitenden im Umgang mit den neuen Workflows und dokumentieren die Lösung im Hinblick auf EU AI Act und Datenschutz. Sie müssen keine zusätzlichen Dienstleister koordinieren.
          </div>
        </details>
      </div>
      <div class="faq-item">
        <details class="service-card p-6">
          <summary>Welche Vorteile habe ich als Unternehmen?</summary>
          <div class="mt-3 text-sm text-gray-300">
            Sie senken Ihre Investitionskosten durch mögliche Zuschüsse, erhalten eine klar strukturierte Umsetzung und können nachweisen, dass Sie sich mit EU AI Act und Datenschutz aktiv auseinandersetzen. Gleichzeitig gewinnen Sie Zeit durch automatisierte Abläufe und haben einen festen Ansprechpartner von der ersten Idee bis zum laufenden Betrieb.
          </div>
        </details>
      </div>
      <div class="faq-item">
        <details class="service-card p-6">
          <summary>Wie berechnet EPPCOM die Einsparungen und den ROI?</summary>
          <div class="mt-3 text-sm text-gray-300">
            Grundlage ist der reduzierte Zeitaufwand multipliziert mit dem Stundenlohn der beteiligten Rollen. Im ROI-Rechner fließen der ausgewählte Pakettyp und ein typischer Automatisierungsgrad ein. Die Zahl beim Jahres-ROI zeigt, wie stark sich die Investition voraussichtlich innerhalb eines Jahres auszahlt.
          </div>
        </details>
      </div>
      <div class="faq-item">
        <details class="service-card p-6">
          <summary>Sind meine Daten und Dokumente sicher?</summary>
          <div class="mt-3 text-sm text-gray-300">
            Wir arbeiten mit DSGVO-konformen Prozessen, verschlüsselten Verbindungen und klar geregelten Zugriffsrechten. Hosting- und Technikpartner werden über Auftragsverarbeitungsverträge eingebunden. Auf Wunsch prüfen wir zusätzlich, ob eine reine EU-Verarbeitung oder On-Premise-Varianten sinnvoll sind.
          </div>
        </details>
      </div>
      <div class="faq-item">
        <details class="service-card p-6">
          <summary>Wie schnell amortisiert sich eine Automation?</summary>
          <div class="mt-3 text-sm text-gray-300">
            Das hängt von Aufwand, Stundensätzen und gewähltem Paket ab. In vielen Projekten erreichen Kunden die Amortisation innerhalb weniger Wochen oder Monate. Der ROI-Rechner auf dieser Seite gibt Ihnen eine erste, realistische Einschätzung.
          </div>
        </details>
      </div>
      <div class="faq-item">
        <details class="service-card p-6">
          <summary>Welche Leistungen sind in den Paketen enthalten?</summary>
          <div class="mt-3 text-sm text-gray-300">
            Die Paketübersicht oben zeigt die wichtigsten Bausteine wie Anzahl Prozesse, Integrationen, Laufzeit und Support. In einem kurzen Vorgespräch klären wir Ihre Ist-Situation und erstellen eine präzise Leistungsbeschreibung mit Fixpreis oder klarer Budgetspanne.
          </div>
        </details>
      </div>
    </div>
  </section>

  <script type="application/ld+json">{
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {"@type":"Question","name":"Wie berechnet EPPCOM die Einsparungen / ROI?","acceptedAnswer":{"@type":"Answer","text":"Die Einsparungen ergeben sich aus reduziertem Zeitaufwand multipliziert mit dem Stundenlohn. Höhere Investitionen ermöglichen größere Automatisierungsgrade und damit mehr Einsparungen. Die Prozentangabe zeigt die Rendite relativ zur Investition."}},
      {"@type":"Question","name":"Sind meine Daten sicher?","acceptedAnswer":{"@type":"Answer","text":"Wir arbeiten DSGVO-konform mit TLS, Zugriffsbeschränkungen und Auftragsverarbeitungsverträgen. EU-only- und On-Premise-Optionen auf Anfrage."}},
      {"@type":"Question","name":"Wie schnell amortisiert sich eine Automation?","acceptedAnswer":{"@type":"Answer","text":"Oft innerhalb weniger Wochen bis Monate. Der ROI-Rechner liefert eine individuelle Schätzung."}},
      {"@type":"Question","name":"Unterstützt EPPCOM bei Fördermitteln?","acceptedAnswer":{"@type":"Answer","text":"Ja – von der Prüfung über den Antrag bis zur Umsetzung."}},
      {"@type":"Question","name":"Was ist in den Paketen enthalten?","acceptedAnswer":{"@type":"Answer","text":"Definierte Prozesse, Integrationen und Support-Level. Genaue Leistungsbeschreibung nach Potenzialanalyse."}}
    ]
  }</script>

  <!-- KONTAKT (Mehrstufig) -->
  <section id="contact" class="content-section container mx-auto px-4 py-16" aria-labelledby="contact-title">
    <div class="text-center mb-12">
      <h2 id="contact-title" class="text-3xl md:text-4xl font-bold mb-4">Kontakt</h2>
    </div>
    <div class="grid md:grid-cols-2 gap-12">
      <div>
        <h3 class="text-2xl font-bold mb-6">Kostenlose Erstberatung</h3>

        <!-- Schrittanzeige -->
        <div class="step-indicator mb-8" id="stepIndicator" aria-label="Fortschritt">
          <div style="text-align:center">
            <div id="step1Dot" class="step-dot active">1</div>
            <div class="step-label" style="color:#fff">Kurzanalyse</div>
          </div>
          <div id="stepLine" class="step-line mx-2"></div>
          <div style="text-align:center">
            <div id="step2Dot" class="step-dot inactive">2</div>
            <div class="step-label" style="color:#94a3b8">Kontaktdaten</div>
          </div>
        </div>

        <!-- Schritt 1: Kurzanalyse -->
        <div id="contactStep1">
          <p class="text-sm mb-6" style="color:#94a3b8">Zwei Minuten, die den Unterschied machen – so können wir Ihnen sofort konkreter helfen.</p>

          <div class="mb-4">
            <label class="form-label" for="a_time_cost">Welche Abläufe kosten Ihr Team derzeit am meisten Zeit? <span style="color:#ef4444">*</span></label>
            <textarea id="a_time_cost" rows="3" class="form-control" placeholder="z. B. E-Mail-Bearbeitung, Rechnungsprüfung, manuelle Dateneingabe …"></textarea>
          </div>
          <div class="mb-4">
            <label class="form-label" for="a_tools">Setzen Sie bereits digitale Hilfsmittel ein – und was hat dabei funktioniert? <span style="color:#ef4444">*</span></label>
            <textarea id="a_tools" rows="3" class="form-control" placeholder="z. B. Excel, CRM-System, bisher keine digitalen Tools …"></textarea>
          </div>
          <div class="mb-4">
            <label class="form-label" for="a_dept">Welcher Unternehmensbereich soll als Erstes entlastet werden? <span style="color:#ef4444">*</span></label>
            <input id="a_dept" type="text" class="form-control" placeholder="z. B. Buchhaltung, Kundenservice, Vertrieb …">
          </div>
          <div class="mb-4">
            <label class="form-label" for="a_strategy">Was steht für Sie im Vordergrund? <span style="color:#ef4444">*</span></label>
            <select id="a_strategy" class="form-control">
              <option value="">Bitte wählen</option>
              <option value="Quick Wins">Schnelle Entlastung – Quick Wins zuerst</option>
              <option value="Strategie">Nachhaltige Gesamtstrategie aufbauen</option>
              <option value="Beides">Beides – erst Entlastung, dann Strategie</option>
            </select>
          </div>
          <div class="mb-6">
            <label class="form-label" for="a_urgency">Wie dringend ist Handlungsbedarf bei Ihnen? (1 = entspannt · 10 = akut) <span style="color:#ef4444">*</span></label>
            <div class="flex items-center gap-3 mt-2">
              <input id="a_urgency" type="range" min="1" max="10" step="1" value="5" class="w-full"
                oninput="document.getElementById('urgencyVal').textContent=this.value">
              <span class="badge" style="min-width:2.5rem; text-align:center" aria-live="polite"><span id="urgencyVal">5</span></span>
            </div>
          </div>
          <button type="button" class="btn-primary w-full py-3" onclick="goToStep2()">Weiter →</button>
        </div>

        <!-- Schritt 2: Kontaktformular -->
        <div id="contactStep2" style="display:none">
          <form id="contactForm" action="?action=contact" method="POST" onsubmit="return submitForm(event)">
            <!-- Hidden: Analyse -->
            <input type="hidden" name="analysis_time_cost"  id="h_time_cost">
            <input type="hidden" name="analysis_tools_used" id="h_tools">
            <input type="hidden" name="analysis_department" id="h_dept">
            <input type="hidden" name="analysis_strategy"   id="h_strategy">
            <input type="hidden" name="analysis_urgency"    id="h_urgency">
            <!-- Hidden: ROI -->
            <input type="hidden" name="roi_enabled"   value="0" id="contact_roi_enabled">
            <input type="hidden" name="roi_employees" id="c_roi_employees">
            <input type="hidden" name="roi_industry"  id="c_roi_industry">
            <input type="hidden" name="roi_hours"     id="c_roi_hours">
            <input type="hidden" name="roi_wage"      id="c_roi_wage">
            <input type="hidden" name="roi_level"     id="c_roi_level">
            <input type="hidden" name="roi_package"   id="c_roi_package">
            <input type="hidden" name="roi_weekly"    id="c_roi_weekly">
            <input type="hidden" name="roi_monthly"   id="c_roi_monthly">
            <input type="hidden" name="roi_yearly"    id="c_roi_yearly">
            <input type="hidden" name="roi_payback"   id="c_roi_payback">
            <input type="hidden" name="roi_time_saved" id="c_roi_time_saved">
            <!-- Honeypot -->
            <input type="text" name="website" id="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px;opacity:0" aria-hidden="true">

            <div class="mb-4"><label class="form-label" for="name">Name *</label><input id="name" name="name" type="text" class="form-control" required></div>
            <div class="mb-4"><label class="form-label" for="company">Unternehmen</label><input id="company" name="company" type="text" class="form-control"></div>
            <div class="mb-4"><label class="form-label" for="phone">Telefon</label><input id="phone" name="phone" type="tel" class="form-control"></div>
            <div class="mb-4"><label class="form-label" for="email">E-Mail *</label><input id="email" name="email" type="email" class="form-control" required></div>
            <div class="mb-4">
              <label class="form-label" for="serviceContact">Interessierte Leistung</label>
              <select id="serviceContact" name="service" class="form-control">
                <option value="">Bitte wählen</option>
                <option>KI-Workflow-Automatisierungen</option>
                <option>KI-Chatbots</option>
                <option>KI-Strategie &amp; Schulungen</option>
                <option>KI-Webdesign &amp; Marketing</option>
                <option>Digitaler Real-Estate-Service iAD</option>
              </select>
            </div>
            <div class="mb-4"><label class="form-label" for="message">Nachricht</label><textarea id="message" name="message" rows="4" class="form-control" placeholder="Kurze Zielbeschreibung oder Ist-Situation"></textarea></div>
            <div class="mb-6">
              <label class="flex items-start gap-3">
                <input type="checkbox" id="privacy" required class="mt-1">
                <span>Ich stimme der Verarbeitung meiner Daten gemäß der <a href="#" class="underline" onclick="openPrivacyModal();return false;">Datenschutzerklärung</a> zu.</span>
              </label>
            </div>
            <div class="flex gap-3">
              <button type="button" class="btn-secondary py-3 px-5" onclick="goToStep1()">← Zurück</button>
              <button id="submitBtn" type="submit" class="btn-primary flex-1 py-3">
                <span id="submitText">Kontakt senden</span>
                <span id="submitLoading" class="hidden">Wird gesendet …</span>
              </button>
            </div>
          </form>
          <div id="successMessage" class="hidden mt-4 p-4 rounded-lg" style="background:rgba(16,185,129,.15); border:1px solid rgba(16,185,129,.4); color:#d1fae5">✓ Vielen Dank! Wir melden uns innerhalb von 24 Stunden.</div>
          <div id="errorMessage" class="hidden mt-4 p-4 rounded-lg" style="background:rgba(239,68,68,.15); border:1px solid rgba(239,68,68,.4); color:#fca5a5">Fehler beim Senden. Bitte direkt schreiben: <a href="mailto:kontakt@eppcom.de" class="underline font-bold text-white">kontakt@eppcom.de</a></div>
        </div>
      </div>

      <div>
        <h3 class="text-2xl font-bold mb-6">Standort &amp; Zeiten</h3>
        <ul class="space-y-3">
          <li><strong>EPPCOM Solutions</strong> – KI-Automatisierung für KMU</li>
          <li><strong>Standort:</strong> 72764 Reutlingen, Deutschland</li>
          <li><strong>Geschäftszeiten:</strong> Mo–Fr 9:00 – 17:00 Uhr</li>
          <li><strong>Leistungsgebiet:</strong> Reutlingen, Tübingen, Stuttgart, Zollernalbkreis und remote in ganz Deutschland</li>
        </ul>
        <div class="mt-8 p-6 rounded-lg" style="background:rgba(0,0,0,.25); border:1px solid rgba(255,255,255,.15)">
          <h4 class="font-bold mb-2" style="color:#bfe1ff">Service-Level</h4>
          <ul class="space-y-1">
            <li>Antwort innerhalb 24 Stunden</li>
            <li>Kostenlose Erstberatung</li>
            <li>Konkrete Vorschläge</li>
            <li>Transparente Kosten</li>
          </ul>
        </div>
      </div>
    </div>
  </section>

  </main>

  <!-- FOOTER -->
  <footer class="content-section mt-16" aria-labelledby="footer-title">
    <div class="container mx-auto px-4 py-12">
      <h2 id="footer-title" class="sr-only">Fußbereich</h2>
      <div class="grid md:grid-cols-4 gap-8">
        <div>
          <img src="/assets/images/Logo.webp" alt="EPPCOM Logo" class="h-12 mb-4" loading="lazy" decoding="async">
          <p class="text-sm">EPPCOM Solutions – KI-Automatisierung für KMU. Reutlingen, Tübingen, Stuttgart und bundesweit remote.</p>
        </div>
        <div>
          <h4 class="font-bold mb-4">Dienstleistungen</h4>
          <ul class="space-y-2 text-sm">
            <li><a href="#services" class="underline">KI-Workflow-Automatisierungen</a></li>
            <li><a href="#services" class="underline">KI-Chatbots</a></li>
            <li><a href="#services" class="underline">KI-Strategie &amp; Schulungen</a></li>
            <li><a href="#services" class="underline">KI-Webdesign &amp; Marketing</a></li>
            <li><a href="#services" class="underline">Digitaler Real-Estate-Service iAD</a></li>
          </ul>
        </div>
        <div>
          <h4 class="font-bold mb-4">Kontakt</h4>
          <ul class="space-y-2 text-sm">
            <li>EPPCOM Solutions</li>
            <li>Ulrichstraße 3, 72764 Reutlingen</li>
            <li><a href="tel:+4915753640191" class="underline">+49 157 53640191</a></li>
            <li><a href="mailto:kontakt@eppcom.de" class="underline">kontakt@eppcom.de</a></li>
            <li><a href="https://www.linkedin.com/company/eppcom" target="_blank" rel="noopener" class="underline">LinkedIn</a></li>
          </ul>
        </div>
        <div>
          <h4 class="font-bold mb-4">Rechtliches</h4>
          <ul class="space-y-2 text-sm">
            <li><a href="/impressum" class="underline">Impressum</a></li>
            <li><a href="/datenschutz" class="underline">Datenschutzerklärung</a></li>
            <li><button onclick="reopenCookieBanner()" class="underline text-left" style="background:none;border:none;color:inherit;cursor:pointer;padding:0;font-size:inherit">Cookie-Einstellungen</button></li>
            <li><a href="#faq" class="underline">FAQ</a></li>
          </ul>
        </div>
      </div>
      <div class="border-t border-white/10 mt-8 pt-6 text-center text-sm" style="color:#64748b">
        © <?php echo date('Y'); ?> EPPCOM Solutions – Alle Rechte vorbehalten.
      </div>
    </div>
  </footer>

  <!-- ===== MODALS ===== -->

  <!-- Service / Case Modal (geteilt) -->
  <div id="serviceModal" class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle"
    onclick="if(event.target===this)closeModal('serviceModal')">
    <div class="modal-content">
      <div class="modal-header">
        <h3 id="modalTitle" class="text-xl font-bold">Details</h3>
        <button class="close" onclick="closeModal('serviceModal')" aria-label="Schließen">&times;</button>
      </div>
      <div id="modalBody" class="modal-body"></div>
    </div>
  </div>

  <!-- Datenschutz-Modal -->
  <div id="privacyModal" class="modal" role="dialog" aria-modal="true" aria-label="Datenschutzerklärung"
    onclick="if(event.target===this)closeModal('privacyModal')">
    <div class="modal-content">
      <div class="modal-header">
        <h3 class="text-xl font-bold">Datenschutzerklärung</h3>
        <button class="close" onclick="closeModal('privacyModal')" aria-label="Schließen">&times;</button>
      </div>
      <div class="modal-body">
        <p>Die vollständige Datenschutzerklärung finden Sie unter <a href="/datenschutz" class="underline" style="color:var(--link)">/datenschutz</a>.</p>
        <p class="mt-3">Verantwortlicher: EPPCOM Solutions, Ulrichstraße 3, 72764 Reutlingen · kontakt@eppcom.de</p>
        <p class="mt-3">Ihre Daten werden ausschließlich zur Bearbeitung Ihrer Anfrage verwendet und nicht an Dritte weitergegeben. Sie haben das Recht auf Auskunft, Berichtigung, Löschung und Widerspruch gemäß DSGVO.</p>
      </div>
    </div>
  </div>

  <!-- Automatisierungsfinder-Modal -->
  <div id="finderModal" class="modal" role="dialog" aria-modal="true" aria-label="Automatisierungsfinder"
    onclick="if(event.target===this)closeModal('finderModal')">
    <div class="modal-content" style="max-width:640px">
      <div class="modal-header">
        <h3 class="text-xl font-bold">Automatisierungsfinder</h3>
        <button class="close" onclick="closeModal('finderModal')" aria-label="Schließen">&times;</button>
      </div>
      <div class="modal-body">
        <p class="mb-4">Beantworten Sie 3 Fragen – wir zeigen Ihnen, welches Paket am besten passt.</p>
        <div id="finderStep1">
          <label class="form-label">Wie viele Mitarbeiter hat Ihr Unternehmen?</label>
          <div class="grid grid-cols-2 gap-3 mt-2">
            <button class="service-card p-4 text-center" onclick="finderNext(1,'1-9')">1–9 Mitarbeiter</button>
            <button class="service-card p-4 text-center" onclick="finderNext(1,'10-49')">10–49 Mitarbeiter</button>
            <button class="service-card p-4 text-center" onclick="finderNext(1,'50-249')">50–249 Mitarbeiter</button>
            <button class="service-card p-4 text-center" onclick="finderNext(1,'250+')">250+ Mitarbeiter</button>
          </div>
        </div>
        <div id="finderStep2" style="display:none">
          <label class="form-label">Was ist Ihr primäres Ziel?</label>
          <div class="grid grid-cols-1 gap-3 mt-2">
            <button class="service-card p-4 text-left" onclick="finderNext(2,'entlastung')">⚡ Schnelle Entlastung in einem Bereich (Quick Win)</button>
            <button class="service-card p-4 text-left" onclick="finderNext(2,'vernetzung')">🔗 Mehrere Systeme verbinden und Abläufe vernetzen</button>
            <button class="service-card p-4 text-left" onclick="finderNext(2,'strategie')">🗺️ Komplette KI-Strategie mit Roadmap</button>
          </div>
        </div>
        <div id="finderStep3" style="display:none">
          <label class="form-label">Wie hoch ist Ihr Budget-Rahmen?</label>
          <div class="grid grid-cols-2 gap-3 mt-2">
            <button class="service-card p-4 text-center" onclick="finderResult('mini')">bis 2.000 €</button>
            <button class="service-card p-4 text-center" onclick="finderResult('basis')">bis 5.000 €</button>
            <button class="service-card p-4 text-center" onclick="finderResult('profi')">bis 10.000 €</button>
            <button class="service-card p-4 text-center" onclick="finderResult('enterprise')">10.000 € +</button>
          </div>
        </div>
        <div id="finderResult" style="display:none" class="mt-4 p-5 rounded-xl" style="background:rgba(102,126,234,.15); border:1px solid rgba(102,126,234,.4)"></div>
      </div>
    </div>
  </div>

  <!-- ===== VOICEBOT-WIDGET ===== -->
  <style>
    #voiceWidget { position:fixed; bottom:24px; right:24px; z-index:8000; }
    #voiceWidgetBtn {
      width:60px; height:60px; border-radius:50%; border:none; cursor:pointer;
      background:linear-gradient(135deg,var(--accent),var(--accent-2));
      box-shadow:0 4px 20px rgba(102,126,234,.55);
      display:flex; align-items:center; justify-content:center;
      transition:transform .2s, box-shadow .2s;
    }
    #voiceWidgetBtn:hover { transform:scale(1.08); box-shadow:0 6px 28px rgba(102,126,234,.7); }
    #voiceWidgetBtn svg { width:28px; height:28px; fill:#fff; }
    #voiceWidgetBadge {
      position:absolute; top:-2px; right:-2px;
      background:#10b981; width:14px; height:14px;
      border-radius:50%; border:2px solid #000;
      display:none;
    }
    #voiceWidgetBadge.active { display:block; }
    #voiceWidgetPanel {
      display:none; position:absolute; bottom:72px; right:0;
      width:340px;
      background:rgba(17,24,39,.97);
      border:1px solid var(--glass-border);
      border-radius:20px;
      box-shadow:0 8px 40px rgba(0,0,0,.6);
      backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px);
      overflow:hidden;
    }
    #voiceWidgetPanel.open { display:block; }
    .vw-header {
      background:linear-gradient(135deg,var(--accent),var(--accent-2));
      padding:14px 16px; display:flex; align-items:center; justify-content:space-between;
    }
    .vw-header-left { display:flex; align-items:center; gap:10px; }
    .vw-header img { height:28px; filter:brightness(0) invert(1); }
    .vw-title { font-weight:700; color:#fff; font-size:.95rem; }
    .vw-subtitle { font-size:.75rem; color:rgba(255,255,255,.8); }
    .vw-close { background:none; border:none; color:#fff; font-size:22px; cursor:pointer; line-height:1; padding:0 4px; }
    .vw-chat {
      background:rgba(0,0,0,.25); padding:12px;
      height:200px; overflow-y:auto; display:flex; flex-direction:column; gap:8px;
    }
    .vw-chat::-webkit-scrollbar { width:4px; }
    .vw-chat::-webkit-scrollbar-thumb { background:rgba(255,255,255,.2); border-radius:4px; }
    .vw-bubble {
      max-width:85%; padding:8px 12px; border-radius:14px;
      font-size:.83rem; line-height:1.45; word-break:break-word;
      animation:fadeIn .2s ease;
    }
    .vw-bubble.bot { background:rgba(102,126,234,.35); color:#e2e8f0; align-self:flex-start; border-bottom-left-radius:4px; }
    .vw-bubble.user { background:rgba(255,255,255,.12); color:#f8fafc; align-self:flex-end; border-bottom-right-radius:4px; }
    .vw-proc {
      display:none; align-items:center; gap:8px; padding:6px 12px;
      background:rgba(251,191,36,.1); border-top:1px solid rgba(251,191,36,.2);
      font-size:.8rem; color:#fbbf24;
    }
    .vw-proc.active { display:flex; }
    .vw-dots span { display:inline-block; width:5px; height:5px; border-radius:50%; background:#fbbf24; animation:blink 1.2s infinite; }
    .vw-dots span:nth-child(2){animation-delay:.2s} .vw-dots span:nth-child(3){animation-delay:.4s}
    .vw-controls { padding:14px 16px; display:flex; align-items:center; justify-content:center; gap:12px; }
    .vw-mic {
      width:56px; height:56px; border-radius:50%; border:none; cursor:pointer;
      background:linear-gradient(135deg,var(--accent),var(--accent-2));
      display:flex; align-items:center; justify-content:center;
      transition:all .2s; box-shadow:0 4px 16px rgba(102,126,234,.4);
    }
    .vw-mic:hover { transform:scale(1.06); }
    .vw-mic:disabled { opacity:.4; cursor:not-allowed; transform:none; }
    .vw-mic.listening { background:linear-gradient(135deg,#dc2626,#ef4444); box-shadow:0 4px 16px rgba(239,68,68,.5); animation:vwPulse 1.5s infinite; }
    .vw-mic.speaking { background:linear-gradient(135deg,#059669,#10b981); box-shadow:0 4px 16px rgba(16,185,129,.5); }
    @keyframes vwPulse { 0%,100%{box-shadow:0 4px 16px rgba(239,68,68,.5)} 50%{box-shadow:0 4px 28px rgba(239,68,68,.8),0 0 0 8px rgba(239,68,68,.1)} }
    .vw-mic svg { width:26px; height:26px; fill:#fff; }
    .vw-info { display:flex; flex-direction:column; gap:2px; }
    .vw-label { font-size:.83rem; color:#e2e8f0; font-weight:600; }
    .vw-wave { display:none; gap:3px; align-items:center; height:20px; }
    .vw-wave.active { display:flex; }
    .vw-wave span { display:inline-block; width:3px; border-radius:2px; background:var(--accent); animation:wave 1s infinite ease-in-out; }
    .vw-wave.speaking span { background:#10b981; }
    .vw-wave span:nth-child(1){animation-delay:0s;height:6px} .vw-wave span:nth-child(2){animation-delay:.1s;height:14px}
    .vw-wave span:nth-child(3){animation-delay:.2s;height:20px} .vw-wave span:nth-child(4){animation-delay:.1s;height:14px}
    .vw-wave span:nth-child(5){animation-delay:0s;height:6px}
    .vw-end { background:none; border:1px solid rgba(255,255,255,.2); color:rgba(255,255,255,.6); padding:5px 14px; border-radius:8px; font-size:.78rem; cursor:pointer; transition:all .15s; }
    .vw-end:hover { border-color:#ef4444; color:#ef4444; }
    .vw-footer { font-size:.72rem; color:rgba(255,255,255,.3); text-align:center; padding:0 16px 12px; }
    @media(max-width:400px) { #voiceWidgetPanel { width:calc(100vw - 32px); right:-8px; } }
  </style>

  <div id="voiceWidget">
    <div id="voiceWidgetPanel">
      <div class="vw-header">
        <div class="vw-header-left">
          <img src="/assets/images/Logo.webp" alt="EPPCOM" onerror="this.style.display='none'">
          <div>
            <div class="vw-title">Nexo – KI-Assistent</div>
            <div class="vw-subtitle">Sprich mit Nexo über EPPCOM Solutions</div>
          </div>
        </div>
        <button class="vw-close" onclick="closeVoiceWidget()" aria-label="Widget schließen">×</button>
      </div>
      <div class="vw-chat" id="vwChat">
        <div class="vw-bubble bot">Klick auf den Knopf und stell mir eine Frage!</div>
      </div>
      <div class="vw-proc" id="vwProc">
        <div class="vw-dots"><span></span><span></span><span></span></div>
        <span id="vwProcLabel">Nexo denkt nach…</span>
        <span id="vwProcTimer" style="margin-left:auto;font-weight:700">0s</span>
      </div>
      <div class="vw-controls">
        <button class="vw-mic" id="vwMicBtn" onclick="vwToggleCall()">
          <svg viewBox="0 0 24 24"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg>
        </button>
        <div class="vw-info">
          <div class="vw-label" id="vwLabel">Klicken zum Starten</div>
          <div class="vw-wave" id="vwWave"><span></span><span></span><span></span><span></span><span></span></div>
        </div>
        <button class="vw-end" id="vwEndBtn" style="display:none" onclick="vwEndCall()">Beenden</button>
      </div>
      <div class="vw-footer">Powered by EPPCOM Solutions</div>
    </div>
    <button id="voiceWidgetBtn" onclick="toggleVoiceWidget()" aria-label="Voicebot öffnen" title="Nexo – KI-Assistent">
      <svg viewBox="0 0 24 24"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg>
    </button>
    <div id="voiceWidgetBadge"></div>
  </div>
  <div id="vwAudio" style="display:none"></div>

  <script src="https://cdn.jsdelivr.net/npm/livekit-client/dist/livekit-client.umd.js" defer></script>
  <script>
  /* Voicebot Widget */
  const VW_TOKEN_URL = 'https://appdb.eppcom.de/api/lk-token';
  const VW_ROOM = 'eppcom-voice';
  let vwRoom = null, vwConnected = false, vwProcInterval = null, vwProcStart = null, vwWaitingResp = false;

  function toggleVoiceWidget() {
    const p = document.getElementById('voiceWidgetPanel');
    p.classList.toggle('open');
  }
  function closeVoiceWidget() {
    document.getElementById('voiceWidgetPanel').classList.remove('open');
    if (vwConnected) vwEndCall();
  }
  function vwAddBubble(text, who) {
    const c = document.getElementById('vwChat');
    const el = document.createElement('div');
    el.className = 'vw-bubble ' + who;
    el.textContent = text;
    c.appendChild(el);
    c.scrollTop = c.scrollHeight;
  }
  function vwStartProc() {
    vwProcStart = Date.now();
    document.getElementById('vwProcTimer').textContent = '0s';
    document.getElementById('vwProcLabel').textContent = 'Nexo denkt nach…';
    document.getElementById('vwProc').classList.add('active');
    vwProcInterval = setInterval(() => {
      const s = Math.floor((Date.now() - vwProcStart) / 1000);
      document.getElementById('vwProcTimer').textContent = s + 's';
      if (s >= 3) document.getElementById('vwProcLabel').textContent = 'Antwort wird generiert…';
    }, 500);
  }
  function vwStopProc() {
    clearInterval(vwProcInterval); vwProcInterval = null;
    document.getElementById('vwProc').classList.remove('active');
  }
  function vwSetState(state) {
    const btn = document.getElementById('vwMicBtn');
    const lbl = document.getElementById('vwLabel');
    const wave = document.getElementById('vwWave');
    const end = document.getElementById('vwEndBtn');
    const badge = document.getElementById('voiceWidgetBadge');
    btn.className = 'vw-mic';
    wave.className = 'vw-wave';
    if (state === 'idle') { btn.disabled=false; lbl.textContent='Klicken zum Starten'; end.style.display='none'; vwStopProc(); badge.classList.remove('active'); }
    else if (state === 'connecting') { btn.disabled=true; lbl.textContent='Verbinde…'; }
    else if (state === 'listening') { btn.disabled=false; btn.classList.add('listening'); wave.classList.add('active'); lbl.textContent='Höre zu…'; end.style.display='block'; vwStopProc(); badge.classList.add('active'); }
    else if (state === 'processing') { btn.disabled=false; lbl.textContent='Verarbeite…'; end.style.display='block'; vwStartProc(); }
    else if (state === 'speaking') { btn.disabled=false; btn.classList.add('speaking'); wave.classList.add('active','speaking'); lbl.textContent='Nexo antwortet'; end.style.display='block'; vwStopProc(); }
    else if (state === 'ended') { btn.disabled=false; lbl.textContent='Klicken zum Starten'; end.style.display='none'; vwStopProc(); badge.classList.remove('active'); }
  }
  async function vwToggleCall() { if (vwConnected) { await vwEndCall(); } else { await vwStartCall(); } }
  async function vwStartCall() {
    vwSetState('connecting');
    try {
      const resp = await fetch(`${VW_TOKEN_URL}?room=${encodeURIComponent(VW_ROOM)}&user=widget-visitor`);
      if (!resp.ok) throw new Error('Token-Server HTTP ' + resp.status);
      const data = await resp.json();
      const { Room, RoomEvent, Track } = LivekitClient;
      vwRoom = new Room({ adaptiveStream:false, dynacast:false });
      vwRoom.on(RoomEvent.Connected, () => { vwConnected=true; vwSetState('listening'); });
      vwRoom.on(RoomEvent.Disconnected, () => { vwConnected=false; vwSetState('ended'); vwRoom=null; document.getElementById('vwAudio').innerHTML=''; });
      vwRoom.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind !== Track.Kind.Audio) return;
        const el = track.attach(); el.setAttribute('autoplay','');
        document.getElementById('vwAudio').appendChild(el);
        const elapsed = vwProcStart ? Date.now()-vwProcStart : 9999;
        if (vwWaitingResp && elapsed < 2500) { document.getElementById('vwProcLabel').textContent='Einen Moment…'; }
        else { vwWaitingResp=false; vwSetState('speaking'); }
      });
      vwRoom.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach().forEach(el => el.remove());
        if (vwWaitingResp) { document.getElementById('vwProcLabel').textContent='Antwort wird generiert…'; }
        else if (vwConnected) { vwSetState('listening'); }
      });
      vwRoom.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        const userSpeaking = speakers.some(s => s.isLocal);
        if (!userSpeaking && vwConnected) {
          setTimeout(() => {
            if (vwConnected && document.getElementById('vwMicBtn').classList.contains('listening')) {
              vwWaitingResp=true; vwSetState('processing');
            }
          }, 300);
        }
      });
      vwRoom.on(RoomEvent.DataReceived, (payload) => {
        try {
          const msg = JSON.parse(new TextDecoder().decode(payload));
          if (msg.type==='user_speech' && msg.text) { vwAddBubble(msg.text,'user'); vwSetState('processing'); }
          else if (msg.type==='agent_speech' && msg.text) { vwAddBubble(msg.text,'bot'); }
        } catch(_) {}
      });
      const lkUrl = data.livekit_url || data.url || 'wss://appdb.eppcom.de/lk';
      await vwRoom.connect(lkUrl, data.token, { autoSubscribe:true });
      await vwRoom.localParticipant.setMicrophoneEnabled(true);
    } catch(e) {
      vwConnected=false; vwSetState('idle');
      vwAddBubble('Verbindungsfehler: ' + e.message, 'bot');
    }
  }
  async function vwEndCall() {
    if (vwRoom) await vwRoom.disconnect();
    vwConnected=false; vwSetState('idle');
    vwAddBubble('Gespräch beendet. Bis bald!', 'bot');
  }
  </script>
  <!-- /VOICEBOT-WIDGET -->

  <!-- ===== HAUPTSKRIPT ===== -->
  <script>
  /* -------------------------------------------------------
     Cookie / Consent Management (DSGVO-konform)
  ------------------------------------------------------- */
  const CONSENT_VERSION = '1.1';
  const CONSENT_KEY     = 'eppcom_consent';

  function getConsent() {
    try { const s = localStorage.getItem(CONSENT_KEY); return s ? JSON.parse(s) : null; }
    catch(e) { return null; }
  }
  function saveConsent(prefs, stats, mkt) {
    const c = { version: CONSENT_VERSION, timestamp: new Date().toISOString(),
                necessary: true, preferences: prefs, statistics: stats, marketing: mkt };
    localStorage.setItem(CONSENT_KEY, JSON.stringify(c));
    return c;
  }
  function initCookieBanner() {
    const c = getConsent();
    if (!c || c.version !== CONSENT_VERSION) {
      document.getElementById('cookieBanner').style.display = 'block';
    } else {
      applyConsent(c);
    }
  }
  function applyConsent(c) {
    if (c.statistics) loadStatisticsScripts();
    if (c.marketing)  loadMarketingScripts();
  }
  function loadStatisticsScripts() {
    // Hier Analytics-Script laden, z. B.:
    // const s = document.createElement('script'); s.src='...'; document.head.appendChild(s);
  }
  function loadMarketingScripts() {
    // Hier Marketing-Pixel laden
  }
  function acceptAll() {
    const c = saveConsent(true, true, true);
    document.getElementById('cookieBanner').style.display = 'none';
    applyConsent(c);
  }
  function acceptNecessaryOnly() {
    saveConsent(false, false, false);
    document.getElementById('cookieBanner').style.display = 'none';
  }
  function acceptSelection() {
    const stats = document.getElementById('toggle_statistics').checked;
    const prefs = document.getElementById('toggle_preferences').checked;
    const mkt   = document.getElementById('toggle_marketing').checked;
    const c = saveConsent(prefs, stats, mkt);
    document.getElementById('cookieBanner').style.display = 'none';
    applyConsent(c);
  }
  function reopenCookieBanner() {
    const c = getConsent();
    if (c) {
      document.getElementById('toggle_preferences').checked = c.preferences || false;
      document.getElementById('toggle_statistics').checked  = c.statistics  || false;
      document.getElementById('toggle_marketing').checked   = c.marketing   || false;
    }
    switchCookieTab('consent');
    document.getElementById('cookieBanner').style.display = 'block';
  }
  function switchCookieTab(tab) {
    ['consent','details','about'].forEach(t => {
      document.getElementById('cb-tab-'+t).classList.toggle('cb-tab-active', t === tab);
      document.getElementById('cb-panel-'+t).style.display = t === tab ? 'block' : 'none';
    });
  }
  function track(event, data) {
    const c = getConsent();
    if (!c || !c.statistics) return;
    if (typeof gtag !== 'undefined') gtag('event', event, data || {});
  }

  /* -------------------------------------------------------
     Mehrstufiges Kontaktformular
  ------------------------------------------------------- */
  function goToStep2() {
    const t = document.getElementById('a_time_cost').value.trim();
    const o = document.getElementById('a_tools').value.trim();
    const d = document.getElementById('a_dept').value.trim();
    const s = document.getElementById('a_strategy').value;
    if (!t || !o || !d || !s) {
      alert('Bitte füllen Sie alle Felder aus.'); return;
    }
    document.getElementById('h_time_cost').value = t;
    document.getElementById('h_tools').value     = o;
    document.getElementById('h_dept').value      = d;
    document.getElementById('h_strategy').value  = s;
    document.getElementById('h_urgency').value   = document.getElementById('a_urgency').value;

    document.getElementById('contactStep1').style.display = 'none';
    document.getElementById('contactStep2').style.display = 'block';
    document.getElementById('step1Dot').className = 'step-dot done';
    document.getElementById('step2Dot').className = 'step-dot active';
    document.getElementById('stepLine').classList.add('done');
    document.getElementById('step2Dot').closest('div').querySelector('.step-label').style.color = '#fff';

    document.getElementById('contact').scrollIntoView({ behavior:'smooth', block:'start' });
  }
  function goToStep1() {
    document.getElementById('contactStep1').style.display = 'block';
    document.getElementById('contactStep2').style.display = 'none';
    document.getElementById('step1Dot').className = 'step-dot active';
    document.getElementById('step2Dot').className = 'step-dot inactive';
    document.getElementById('stepLine').classList.remove('done');
  }
  function submitForm(e) {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    document.getElementById('submitText').classList.add('hidden');
    document.getElementById('submitLoading').classList.remove('hidden');
    btn.disabled = true;
    fetch('?action=contact', { method:'POST', body: new FormData(document.getElementById('contactForm')) })
      .then(r => r.json())
      .then(res => {
        if (res.ok) {
          document.getElementById('successMessage').classList.remove('hidden');
          document.getElementById('contactForm').reset();
          document.getElementById('contactStep1').style.display = 'block';
          document.getElementById('contactStep2').style.display = 'none';
          document.getElementById('step1Dot').className = 'step-dot active';
          document.getElementById('step2Dot').className = 'step-dot inactive';
          document.getElementById('stepLine').classList.remove('done');
        } else {
          document.getElementById('errorMessage').classList.remove('hidden');
        }
      })
      .catch(() => document.getElementById('errorMessage').classList.remove('hidden'))
      .finally(() => {
        btn.disabled = false;
        document.getElementById('submitText').classList.remove('hidden');
        document.getElementById('submitLoading').classList.add('hidden');
      });
    return false;
  }

  /* -------------------------------------------------------
     ROI-Rechner
  ------------------------------------------------------- */
  /* Industry-dependent package prices */
  const INDUSTRY_PACKAGES = {
    'IT- und Technologieunternehmen':         [{v:1490,l:'Mini: 1.490 €'},{v:3990,l:'Basis: 3.990 €',s:true},{v:7990,l:'Profi: 7.990 €'},{v:13990,l:'Enterprise: 13.990 €'}],
    'Dienstleistungsunternehmen':             [{v:1490,l:'Mini: 1.490 €'},{v:3490,l:'Basis: 3.490 €',s:true},{v:6990,l:'Profi: 6.990 €'},{v:11990,l:'Enterprise: 11.990 €'}],
    'Handelsunternehmen / -dienstleister':    [{v:1390,l:'Mini: 1.390 €'},{v:3290,l:'Basis: 3.290 €',s:true},{v:6490,l:'Profi: 6.490 €'},{v:10990,l:'Enterprise: 10.990 €'}],
    'Handwerksbetrieb':                       [{v:990, l:'Starter: 990 €'},{v:2490,l:'Basis: 2.490 €',s:true},{v:4990,l:'Profi: 4.990 €'},{v:8990,l:'Enterprise: 8.990 €'}],
    'Produktionsunternehmen / Industrie':     [{v:1690,l:'Mini: 1.690 €'},{v:4490,l:'Basis: 4.490 €',s:true},{v:8490,l:'Profi: 8.490 €'},{v:13990,l:'Enterprise: 13.990 €'}],
    'Immobilien- und Bauwirtschaft':          [{v:1290,l:'Starter: 1.290 €'},{v:3290,l:'Basis: 3.290 €',s:true},{v:5990,l:'Profi: 5.990 €'},{v:9990,l:'Enterprise: 9.990 €'}],
    'Anwalts- / Steuerberatungskanzlei':      [{v:1490,l:'Mini: 1.490 €'},{v:3990,l:'Basis: 3.990 €',s:true},{v:7490,l:'Profi: 7.490 €'},{v:12990,l:'Enterprise: 12.990 €'}],
    'Gesundheitswesen / Arztpraxis':          [{v:990, l:'Starter: 990 €'},{v:2490,l:'Basis: 2.490 €',s:true},{v:4990,l:'Profi: 4.990 €'},{v:8990,l:'Enterprise: 8.990 €'}],
    'Gastronomie & Hotellerie':               [{v:790, l:'Starter: 790 €'},{v:1990,l:'Basis: 1.990 €',s:true},{v:3990,l:'Profi: 3.990 €'},{v:6990,l:'Enterprise: 6.990 €'}],
    'Öffentlicher Sektor / Bildung / Verwaltung': [{v:1490,l:'Mini: 1.490 €'},{v:3490,l:'Basis: 3.490 €',s:true},{v:6990,l:'Profi: 6.990 €'},{v:11990,l:'Enterprise: 11.990 €'}],
    'Sonstige Branche':                       [{v:1490,l:'Mini: 1.490 €'},{v:3490,l:'Basis: 3.490 €',s:true},{v:6990,l:'Profi: 6.990 €'},{v:11990,l:'Enterprise: 11.990 €'}],
    '_default':                               [{v:1490,l:'Mini: 1.490 €'},{v:3490,l:'Basis: 3.490 €',s:true},{v:6990,l:'Profi: 6.990 €'},{v:11990,l:'Enterprise: 11.990 €'}],
  };
  function updatePackagesForIndustry() {
    const ind = document.getElementById('roi_industry').value;
    const pkgs = INDUSTRY_PACKAGES[ind] || INDUSTRY_PACKAGES['_default'];
    const sel = document.getElementById('roi_package');
    const curVal = sel.value;
    sel.innerHTML = pkgs.map(p => `<option value="${p.v}"${p.s?' selected':''}>${p.l}</option>`).join('');
    // keep current selection if same value exists
    const matching = pkgs.find(p => String(p.v) === curVal);
    if (matching) sel.value = curVal;
  }

  function calcROI() {
    const hours = parseFloat(document.getElementById('roi_hours').value) || 0;
    const wage  = parseFloat(document.getElementById('roi_wage').value)  || 0;
    const level = parseFloat(document.getElementById('roi_level').value) || 0.7;
    const pkg   = parseFloat(document.getElementById('roi_package').value) || 3490;
    const pkgM  = {990:0.80,790:0.75,1290:0.82,1390:0.83,1490:0.85,1690:0.87,1990:0.80,2490:0.92,3290:0.97,3490:1.0,3990:1.05,4490:1.08,4990:1.12,5990:1.18,6490:1.20,6990:1.22,7490:1.25,7990:1.28,8490:1.30,8990:1.32,9990:1.36,10990:1.38,11990:1.40,12990:1.42,13990:1.45}[pkg] || 1.0;
    const eff   = Math.min(level * pkgM, 0.95);
    const saved = hours * eff;
    const wkly  = saved * wage;
    const mthly = wkly * 52 / 12;
    const yrly  = wkly * 52;
    const yROI  = yrly - pkg;
    const pct   = pkg > 0 ? Math.round(yROI / pkg * 100) : 0;
    const pays  = mthly > 0 ? pkg / mthly : 999;

    const eur = v => new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(v);
    const payTxt = pays > 120 ? '> 10 Jahre' : pays < 1 ? '< 1 Monat' : pays.toFixed(1) + ' Monate';

    document.getElementById('weekly_savings').textContent = eur(wkly);
    document.getElementById('monthly_savings').textContent = eur(mthly);
    document.getElementById('payback_time').textContent = payTxt;
    document.getElementById('time_saved').textContent = saved.toFixed(1) + ' Std/Wo';
    document.getElementById('yearly_roi').textContent = eur(yROI) + ' (+' + pct + '%)';

    document.getElementById('roi_weekly_h').value    = eur(wkly);
    document.getElementById('roi_monthly_h').value   = eur(mthly);
    document.getElementById('roi_yearly_h').value    = eur(yROI) + ' (+' + pct + '%)';
    document.getElementById('roi_payback_h').value   = payTxt;
    document.getElementById('roi_time_saved_h').value = saved.toFixed(1) + ' Std/Woche';
  }
  function submitROI(e) { e.preventDefault(); captureROIAndGoToContact(); return false; }
  function captureROIAndGoToContact() {
    const map = {
      roi_enabled:'1', roi_employees:'roi_employees', roi_industry:'roi_industry',
      roi_hours:'roi_hours', roi_wage:'roi_wage', roi_level:'roi_level', roi_package:'roi_package',
      roi_weekly:'roi_weekly_h', roi_monthly:'roi_monthly_h', roi_yearly:'roi_yearly_h',
      roi_payback:'roi_payback_h', roi_time_saved:'roi_time_saved_h'
    };
    document.getElementById('contact_roi_enabled').value = '1';
    ['employees','industry','hours','wage','level','package'].forEach(k => {
      const el = document.getElementById('roi_'+k); if (el) document.getElementById('c_roi_'+k).value = el.value;
    });
    ['weekly','monthly','yearly','payback','time_saved'].forEach(k => {
      const el = document.getElementById('roi_'+k+'_h'); if (el) document.getElementById('c_roi_'+k).value = el.value;
    });
    track('roi_to_contact');
    document.getElementById('contact').scrollIntoView({ behavior:'smooth' });
  }

  /* -------------------------------------------------------
     Pricing
  ------------------------------------------------------- */
  let billingMode = 'yearly';
  /* ── Marktgerechte Preise 2025 (KMU-fokussiert, inkl. Startup-Einstieg) ── */
  const PRICING = {
    workflow:   { plans:[
      {name:'Starter',   yearly:1490,  monthly:133,  badge:'Einstieg',  features:['1 automatisierter Prozess','E-Mail-Routing & Priorisierung','Dashboard-Zugriff','E-Mail-Support','Setup inklusive'], h:false},
      {name:'Basis',     yearly:3490,  monthly:315,  badge:'Empfohlen', features:['3 automatisierte Prozesse','3 Systemintegrationen','Monitoring & KPIs','Priority-Support','Governance-Beratung'], h:true},
      {name:'Profi',     yearly:6990,  monthly:629,  badge:'',          features:['7 automatisierte Prozesse','7 Systemintegrationen','Advanced Monitoring','Dedicated Support','Quarterly Review','Fördermittel-Check'], h:false},
      {name:'Enterprise',yearly:11990, monthly:1079, badge:'',          features:['Unbegrenzte Prozesse','Unbegrenzte Integrationen','24/7 Monitoring','Dedicated Consultant','SLA garantiert','EU AI Act Compliance'], h:false},
    ]},
    chatbots:   { plans:[
      {name:'Starter',   yearly:990,   monthly:89,   badge:'Einstieg',  features:['1 Chatbot','300 Konversationen/Mo','Website-Einbindung','E-Mail-Support','Kostenlose Einrichtung'], h:false},
      {name:'Basis',     yearly:2990,  monthly:269,  badge:'Empfohlen', features:['2 Chatbots','2.500 Konversationen/Mo','CRM-Übergabe','WhatsApp oder Voice','Priority-Support'], h:true},
      {name:'Profi',     yearly:5990,  monthly:539,  badge:'',          features:['5 Chatbots','10.000 Konversationen/Mo','Multi-Channel','CRM & Helpdesk','Dedicated Support'], h:false},
      {name:'Enterprise',yearly:9990,  monthly:899,  badge:'',          features:['Unbegrenzte Bots','Unbegrenzte Konversationen','Alle Kanäle','Custom Integrationen','SLA garantiert'], h:false},
    ]},
    webmarketing:{ plans:[
      {name:'Starter',   yearly:1490,  monthly:133,  badge:'Einstieg',  features:['1 Landingpage','SEO-Grundoptimierung','Basis-Tracking','E-Mail-Support','Erstes Audit inklusive'], h:false},
      {name:'Basis',     yearly:3490,  monthly:315,  badge:'Empfohlen', features:['3 Landingpages','SEO-Cluster (5 Seiten)','A/B-Testing','Chatbot-Integration','Monthly Report'], h:true},
      {name:'Profi',     yearly:6490,  monthly:585,  badge:'',          features:['10 Landingpages','Full SEO-Cluster','Automatisierte Redaktion','Multi-Channel-Tracking','Bi-weekly Review'], h:false},
      {name:'Enterprise',yearly:10990, monthly:989,  badge:'',          features:['Unbegrenzte Seiten','Full Content-Automation','Custom Tracking','Dedicated Consultant','SLA garantiert'], h:false},
    ]},
  };
  const TRAINING = [
    {name:'Halbtags-Workshop',  price:790,  dur:'4 Stunden', badge:'Einstieg',  features:['KI-Grundlagen für Ihr Team','Potenziale identifizieren','Prioritätenliste & Handout','kostenlose Nachberatung 30 Min.']},
    {name:'Tages-Workshop',     price:1490, dur:'1 Tag',     badge:'',          features:['Alles aus Halbtags-Workshop','Detaillierte Prozessanalyse','Quick-Win-Roadmap','Fördermittel-Überblick','30 Tage E-Mail-Support']},
    {name:'Kompakt-Strategie',  price:3490, dur:'3 Tage',    badge:'Empfohlen', features:['Alles aus Tages-Workshop','KI-Roadmap (6 Monate)','Governance-Konzept','Fördermittel-Antrag','60 Tage E-Mail-Support']},
    {name:'Full-Service',       price:6990, dur:'4 Wochen',  badge:'',          features:['Alles aus Kompakt','Vollständige Strategie (12 Mo.)','Implementierungsbegleitung','Schulung aller Mitarbeiter','90 Tage Support & Review','EU AI Act Dokumentation']},
  ];

  function renderPricing() {
    const focus = document.getElementById('serviceFocus').value;
    const grid  = document.getElementById('pricingGrid');
    const tgrid = document.getElementById('trainingGrid');
    const helps = {workflow:'Backoffice-Automatisierung ab 1.490 € / Jahr – Starter-Einstieg möglich.',chatbots:'KI-Chatbots ab 990 € / Jahr – der günstigste Einstieg.',webmarketing:'Landingpages & SEO ab 1.490 € / Jahr – inkl. erstem Audit.',training:'KI-Workshops ab 790 € (Halbtag) – kein langes Vorab-Commitment.'};
    document.getElementById('serviceHelp').textContent = helps[focus] || '';
    document.getElementById('billingToggle').style.display = focus === 'training' ? 'none' : 'inline-flex';

    if (focus === 'training') {
      grid.innerHTML = '';
      tgrid.innerHTML = TRAINING.map(p => `
        <div class="price-card p-6 text-center${p.badge?' border-2':''}">
          ${p.badge?`<div class="badge mb-2">${p.badge}</div>`:''}
          <h3 class="text-xl font-bold mb-1">${p.name}</h3>
          <div class="text-sm mb-3" style="color:#94a3b8">${p.dur}</div>
          <div class="text-3xl font-extrabold mb-4">${p.price.toLocaleString('de-DE')} €</div>
          <ul class="text-left space-y-2 mb-6">${p.features.map(f=>`<li class="flex gap-2"><span style="color:var(--ok)">✓</span>${f}</li>`).join('')}</ul>
          <a href="#contact" class="btn-primary block text-center">Anfragen</a>
        </div>`).join('');
    } else {
      tgrid.innerHTML = '';
      const data = PRICING[focus]; if (!data) return;
      grid.innerHTML = data.plans.map(p => {
        const price  = billingMode === 'yearly' ? p.yearly : p.monthly;
        const suffix = billingMode === 'yearly' ? '€ / Jahr' : '€ / Mo.';
        const incl   = Math.round(price * 1.19);
        const inclSuffix = billingMode === 'yearly' ? '€/J. inkl. MwSt.' : '€/Mo. inkl. MwSt.';
        const aprNote = billingMode === 'monthly' ? `<div class="text-xs mt-1" style="color:#94a3b8">Jahrespreis ${p.yearly.toLocaleString('de-DE')} € inkl. APR</div>` : '';
        return `<div class="price-card p-6 text-center${p.h?' border-2':''}">
          ${p.badge?`<div class="badge mb-2">${p.badge}</div>`:''}
          <h3 class="text-xl font-bold mb-1">${p.name}</h3>
          <div class="text-3xl font-extrabold mb-1">${price.toLocaleString('de-DE')} <span class="text-base font-normal">${suffix}</span></div>
          <div class="text-xs mb-1" style="color:#94a3b8">(${incl.toLocaleString('de-DE')} ${inclSuffix})</div>
          ${aprNote}
          <ul class="text-left space-y-2 mt-4 mb-6">${p.features.map(f=>`<li class="flex gap-2"><span style="color:var(--ok)">✓</span>${f}</li>`).join('')}</ul>
          <a href="#contact" class="btn-primary block text-center">Anfragen</a>
        </div>`;
      }).join('');
    }
  }
  function toggleBilling() {
    billingMode = billingMode === 'yearly' ? 'monthly' : 'yearly';
    const btn = document.getElementById('billingToggle');
    btn.textContent = 'Preise pro: ' + (billingMode === 'yearly' ? 'Jahr' : 'Monat');
    btn.setAttribute('aria-pressed', billingMode === 'monthly' ? 'true' : 'false');
    renderPricing();
  }

  /* -------------------------------------------------------
     Service-Modals
  ------------------------------------------------------- */
  const SERVICE_CONTENT = {
    workflow: { title:'Workflow-Automatisierung', body:`
      <p>Wir analysieren Ihre Prozesse und automatisieren die zeitintensivsten Abläufe – von der E-Mail-Klassifizierung bis zur automatischen Rechnungsverarbeitung.</p>
      <h4 class="font-bold mt-4 mb-2">Was wir automatisieren:</h4>
      <ul class="list-disc list-inside space-y-1"><li>E-Mail-Routing & Priorisierung (8 h → 1 h/Woche)</li><li>Rechnungsprüfung & Freigabeworkflow</li><li>Dateneingabe, Reporting & Statusupdates</li><li>Eskalations- und Benachrichtigungsregeln</li></ul>
      <h4 class="font-bold mt-4 mb-2">Vorgehen:</h4>
      <ol class="list-decimal list-inside space-y-1"><li>Prozessanalyse & Quick-Win-Identifikation (Woche 1)</li><li>Aufbau & Test der Automatisierungen (Wochen 2–4)</li><li>Übergabe, Schulung & laufendes Monitoring</li></ol>
      <video class="w-full rounded-xl mt-4" controls preload="none" poster="/assets/images/services/KI-workflow_automation.webp">
        <source src="/assets/videos/KI-Workflowautomatisierung-KMU.mp4" type="video/mp4">
      </video>` },
    chatbots: { title:'KI-Chatbots', body:`
      <p>Von der ersten Anfrage bis zur CRM-Übergabe – vollautomatisch, rund um die Uhr.</p>
      <h4 class="font-bold mt-4 mb-2">Kanaloptionen:</h4>
      <ul class="list-disc list-inside space-y-1"><li>Website-Chat (eingebettet, anpassbar)</li><li>WhatsApp Business API</li><li>Voice-Bot (Telefon & VoIP)</li></ul>
      <h4 class="font-bold mt-4 mb-2">Funktionen:</h4>
      <ul class="list-disc list-inside space-y-1"><li>Lead-Qualifizierung & Vorfilterung</li><li>Terminbuchung & Kalenderintegration</li><li>Übergabe an CRM, Helpdesk oder E-Mail</li><li>Eskalation an menschliche Mitarbeiter</li></ul>
      <video class="w-full rounded-xl mt-4" controls preload="none" poster="/assets/images/services/KI-Chatbots.webp">
        <source src="/assets/videos/KI-Chatbots.mp4" type="video/mp4">
      </video>` },
    strategy: { title:'KI-Strategie & Schulungen', body:`
      <p>KI funktioniert nur mit klarer Strategie. Wir analysieren Ihr Potenzial, priorisieren nach ROI und befähigen Ihr Team zur eigenständigen Weiterführung.</p>
      <h4 class="font-bold mt-4 mb-2">Leistungsumfang:</h4>
      <ul class="list-disc list-inside space-y-1"><li>KI-Potenzialanalyse mit ROI-Bewertung</li><li>12-Monats-Roadmap mit Meilensteinen</li><li>Governance: Rollen, Regeln, Verantwortlichkeiten</li><li>Team-Workshop & individuelle Schulungen</li><li>Fördermittel-Check & Antragsbegleitung</li></ul>
      <video class="w-full rounded-xl mt-4" controls preload="none" poster="/assets/images/services/KI-Strategie+Schulungen.webp">
        <source src="/assets/videos/KI-Strategie_fuer_Ihre_IT.mp4" type="video/mp4">
      </video>` },
    webmarketing: { title:'KI-Webdesign & Marketing', body:`
      <p>Mehr qualifizierte Leads durch KI-optimierte Inhalte, strukturierte Daten und automatisierte Content-Prozesse.</p>
      <h4 class="font-bold mt-4 mb-2">Leistungen:</h4>
      <ul class="list-disc list-inside space-y-1"><li>SEO-Cluster & strukturierte Daten (Schema.org)</li><li>Landingpages mit A/B-Testing</li><li>Chatbot-Vorqualifizierung für höhere Conversions</li><li>Automatisierte Content-Erstellung & -Pflege</li><li>Tracking, Analytics & monatliche Reports</li></ul>
      <video class="w-full rounded-xl mt-4" controls preload="none" poster="/assets/images/services/KI-Webdesign+Marketing.webp">
        <source src="/assets/videos/ki-webdesign.mp4" type="video/mp4">
      </video>` },
    'real-estate': { title:'Digitaler Real-Estate-Service iAD', body:`
      <p>Provisionsbasierter Rundum-Service für Immobilienverkauf und -vermietung – digital, transparent und rechtssicher.</p>
      <h4 class="font-bold mt-4 mb-2">Leistungsumfang:</h4>
      <ul class="list-disc list-inside space-y-1"><li>Bewertung & Marktanalyse</li><li>Professionelles Exposé & 360°-Tour</li><li>Vermarktung auf allen relevanten Portalen</li><li>Besichtigungsorganisation & Interessentenmanagement</li><li>Verhandlung & rechtssichere Abwicklung</li></ul>
      <p class="mt-3"><strong>Provision:</strong> Nur bei erfolgreichem Abschluss.</p>
      <video class="w-full rounded-xl mt-4" controls preload="none" poster="/assets/images/services/IAD-logo.png">
        <source src="/assets/videos/iad.mp4" type="video/mp4">
      </video>` }
  };
  function openServiceModal(type) {
    const c = SERVICE_CONTENT[type]; if (!c) return;
    document.getElementById('modalTitle').textContent = c.title;
    document.getElementById('modalBody').innerHTML    = c.body;
    document.getElementById('serviceModal').style.display = 'flex';
    document.body.classList.add('modal-open');
    track('service_modal', { type });
  }

  /* -------------------------------------------------------
     Case-Modals
  ------------------------------------------------------- */
  const CASE_CONTENT = {
    email:        { title:'Praxisbeispiel: E-Mail-Postfach', body:`<div class="grid md:grid-cols-2 gap-6"><div class="service-card p-4"><h4 class="font-bold mb-2 text-red-400">Vorher</h4><ul class="space-y-2 text-sm"><li>8 Stunden/Woche manuelle E-Mail-Bearbeitung</li><li>Wichtige Anfragen werden übersehen</li><li>Keine Priorisierung oder Struktur</li></ul></div><div class="service-card p-4"><h4 class="font-bold mb-2 text-green-400">Nachher</h4><ul class="space-y-2 text-sm"><li>1 Stunde/Woche für Ausnahmen</li><li>Automatische Klassifizierung & Weiterleitung</li><li>Prioritätsalerts für kritische Anfragen</li></ul></div></div><div class="mt-4 p-4 rounded-lg" style="background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.3)"><strong>Ergebnis:</strong> 87 % weniger Aufwand. Amortisation in 2 Monaten.</div>` },
    invoice:      { title:'Praxisbeispiel: Rechnungsverarbeitung', body:`<div class="grid md:grid-cols-2 gap-6"><div class="service-card p-4"><h4 class="font-bold mb-2 text-red-400">Vorher</h4><ul class="space-y-2 text-sm"><li>Rechnungen manuell aus PDFs extrahieren</li><li>4–6 h/Woche Buchhaltungsvorbereitung</li><li>Fehlerquote ~5 %</li></ul></div><div class="service-card p-4"><h4 class="font-bold mb-2 text-green-400">Nachher</h4><ul class="space-y-2 text-sm"><li>Automatische Extraktion & Validierung</li><li>30 Min/Woche für Ausnahmen</li><li>Fehlerrate < 0,5 %</li></ul></div></div><div class="mt-4 p-4 rounded-lg" style="background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.3)"><strong>Ergebnis:</strong> 90 % weniger Aufwand. ROI nach 6 Wochen.</div>` },
    leads:        { title:'Praxisbeispiel: Kundenanfragen', body:`<div class="grid md:grid-cols-2 gap-6"><div class="service-card p-4"><h4 class="font-bold mb-2 text-red-400">Vorher</h4><ul class="space-y-2 text-sm"><li>Unstrukturierte Anfragen über alle Kanäle</li><li>Wartezeiten bis 48 Stunden</li><li>Leads gehen verloren</li></ul></div><div class="service-card p-4"><h4 class="font-bold mb-2 text-green-400">Nachher</h4><ul class="space-y-2 text-sm"><li>Chatbot qualifiziert 24/7 vor</li><li>Automatische CRM-Übergabe mit Scoring</li><li>30 % mehr qualifizierte Leads</li></ul></div></div><div class="mt-4 p-4 rounded-lg" style="background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.3)"><strong>Ergebnis:</strong> 30 % mehr qualifizierte Leads. Reaktionszeit von 48 h auf &lt; 5 Min.</div>` },
    steuerkanzlei:{ title:'Praxisbeispiel: Steuerkanzlei', body:`<div class="grid md:grid-cols-2 gap-6"><div class="service-card p-4"><h4 class="font-bold mb-2 text-red-400">Vorher</h4><ul class="space-y-2 text-sm"><li>Mandantenkommunikation unstrukturiert</li><li>Fristen manuell gepflegt</li><li>Dokumente per E-Mail ohne Zuordnung</li></ul></div><div class="service-card p-4"><h4 class="font-bold mb-2 text-green-400">Nachher</h4><ul class="space-y-2 text-sm"><li>Automatische Fristenerinnerungen</li><li>Dokumente automatisch zugeordnet</li><li>Fokus auf Beratung statt Verwaltung</li></ul></div></div><div class="mt-4 p-4 rounded-lg" style="background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.3)"><strong>Ergebnis:</strong> 70 % weniger Verwaltungsaufwand. 0 verpasste Fristen seit Einführung.</div>` },
    arztpraxis:   { title:'Praxisbeispiel: Arztpraxis', body:`<div class="grid md:grid-cols-2 gap-6"><div class="service-card p-4"><h4 class="font-bold mb-2 text-red-400">Vorher</h4><ul class="space-y-2 text-sm"><li>Rezeption täglich überlastet</li><li>Lange Wartezeiten am Telefon</li><li>Manuelle Terminerinnerungen fehleranfällig</li></ul></div><div class="service-card p-4"><h4 class="font-bold mb-2 text-green-400">Nachher</h4><ul class="space-y-2 text-sm"><li>Voice-Bot nimmt Terminanfragen entgegen</li><li>Automatische SMS/E-Mail-Erinnerungen</li><li>Rezeption fokussiert auf Patienten vor Ort</li></ul></div></div><div class="mt-4 p-4 rounded-lg" style="background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.3)"><strong>Ergebnis:</strong> 65 % weniger Telefonaufkommen. Termineinhaltung verbesserte sich um 22 %.</div>` },
    immobilien:   { title:'Praxisbeispiel: Immobilienmakler', body:`<div class="grid md:grid-cols-2 gap-6"><div class="service-card p-4"><h4 class="font-bold mb-2 text-red-400">Vorher</h4><ul class="space-y-2 text-sm"><li>Anfragen manuell filtern</li><li>Exposés 2–3 h pro Objekt</li><li>Besichtigungen per E-Mail organisieren</li></ul></div><div class="service-card p-4"><h4 class="font-bold mb-2 text-green-400">Nachher</h4><ul class="space-y-2 text-sm"><li>Chatbot qualifiziert Interessenten vor</li><li>Exposé-Generierung in 15 Minuten</li><li>Automatische Terminbuchung & Bestätigung</li></ul></div></div><div class="mt-4 p-4 rounded-lg" style="background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.3)"><strong>Ergebnis:</strong> 85 % schnellere Exposé-Erstellung. 40 % mehr verwertbare Besichtigungstermine.</div>` },
    handwerk:     { title:'Praxisbeispiel: Handwerk', body:`<div class="grid md:grid-cols-2 gap-6"><div class="service-card p-4"><h4 class="font-bold mb-2 text-red-400">Vorher</h4><ul class="space-y-2 text-sm"><li>Angebote manuell in Word/Excel</li><li>Nachkalkulation oft vergessen</li><li>Keine einheitliche Auftragsübersicht</li></ul></div><div class="service-card p-4"><h4 class="font-bold mb-2 text-green-400">Nachher</h4><ul class="space-y-2 text-sm"><li>Angebote in Minuten aus Vorlagen</li><li>Automatische Nachkalkulation</li><li>Digitale Auftragsübersicht mit Status</li></ul></div></div><div class="mt-4 p-4 rounded-lg" style="background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.3)"><strong>Ergebnis:</strong> Angebotserstellung von 1 h auf 10 Min. Nachkalkulation von 0 % auf 100 % Abdeckung.</div>` },
    it:           { title:'Praxisbeispiel: IT-Services', body:`<div class="grid md:grid-cols-2 gap-6"><div class="service-card p-4"><h4 class="font-bold mb-2 text-red-400">Vorher</h4><ul class="space-y-2 text-sm"><li>Tickets per E-Mail ohne Priorisierung</li><li>Doku veraltet oder fehlend</li><li>Support mit Routinefragen überlastet</li></ul></div><div class="service-card p-4"><h4 class="font-bold mb-2 text-green-400">Nachher</h4><ul class="space-y-2 text-sm"><li>Automatische Ticket-Klassifizierung & Routing</li><li>KI generiert Lösungsvorschläge</li><li>Doku-Updates automatisch vorgeschlagen</li></ul></div></div><div class="mt-4 p-4 rounded-lg" style="background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.3)"><strong>Ergebnis:</strong> 55 % weniger Routinetickets. Erstlösungsrate stieg von 40 % auf 78 %.</div>` },
    anwaltskanzlei:{ title:'Praxisbeispiel: Anwaltskanzlei', body:`<div class="grid md:grid-cols-2 gap-6"><div class="service-card p-4"><h4 class="font-bold mb-2 text-red-400">Vorher</h4><ul class="space-y-2 text-sm"><li>Mandantenaufnahme per Hand & E-Mail</li><li>Aktenanlage 30–60 Minuten</li><li>Erstgespräch-Vorbereitung zeitaufwendig</li></ul></div><div class="service-card p-4"><h4 class="font-bold mb-2 text-green-400">Nachher</h4><ul class="space-y-2 text-sm"><li>Intake-Formular mit automatischer Aktenanlage</li><li>Akte in 5 Minuten vollständig</li><li>Strukturierte Fallübersicht vor dem Gespräch</li></ul></div></div><div class="mt-4 p-4 rounded-lg" style="background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.3)"><strong>Ergebnis:</strong> Aktenanlage von 45 Min. auf 5 Min. Kanzlei gewinnt 3+ Stunden täglich zurück.</div>
      <video class="w-full rounded-xl mt-4" controls preload="none" poster="/assets/images/services/KI-Strategie+Schulungen.webp">
        <source src="/assets/videos/KI_in_Ihrer_Kanzlei.mp4" type="video/mp4">
      </video>
      <video class="w-full rounded-xl mt-4" controls preload="none">
        <source src="/assets/videos/KI-E-Mail-Mgmt.mp4" type="video/mp4">
      </video>` }
  };
  function openCase(type) {
    const c = CASE_CONTENT[type]; if (!c) return;
    document.getElementById('modalTitle').textContent = c.title;
    document.getElementById('modalBody').innerHTML    = c.body;
    document.getElementById('serviceModal').style.display = 'flex';
    document.body.classList.add('modal-open');
  }

  /* -------------------------------------------------------
     Weitere Modals
  ------------------------------------------------------- */
  function openPrivacyModal() {
    document.getElementById('privacyModal').style.display = 'flex';
    document.body.classList.add('modal-open');
  }
  function openFinder() {
    ['finderStep2','finderStep3','finderResult'].forEach(id => document.getElementById(id).style.display = 'none');
    document.getElementById('finderStep1').style.display = 'block';
    window._finderData = {};
    document.getElementById('finderModal').style.display = 'flex';
    document.body.classList.add('modal-open');
  }
  function closeModal(id) {
    document.getElementById(id).style.display = 'none';
    document.body.classList.remove('modal-open');
  }

  /* -------------------------------------------------------
     Automatisierungsfinder
  ------------------------------------------------------- */
  function finderNext(step, value) {
    window._finderData['step'+step] = value;
    document.getElementById('finderStep'+step).style.display = 'none';
    if (step < 3) document.getElementById('finderStep'+(step+1)).style.display = 'block';
  }
  function finderResult(pkg) {
    window._finderData.budget = pkg;
    document.getElementById('finderStep3').style.display = 'none';
    const recs = { mini:'Starter-Paket (ab 990 €) – ideal für einen fokussierten Quick Win mit schnellem ROI.',
                   basis:'Basis-Paket (ab 2.990 €) – unser meistgebuchtes KMU-Paket mit 3 Prozessen & CRM.',
                   profi:'Profi-Paket (ab 5.990 €) – für vernetzte Abläufe und mehr Systemintegration.',
                   enterprise:'Enterprise-Paket (ab 9.990 €) – vollständige Prozessintegration mit SLA & Compliance.' };
    document.getElementById('finderResult').innerHTML =
      `<p class="font-bold text-white mb-2">Unsere Empfehlung für Sie:</p>
       <p class="text-lg text-green-300 font-bold mb-3">${recs[pkg]}</p>
       <a href="#contact" class="btn-primary inline-block" onclick="closeModal('finderModal')">Jetzt unverbindlich anfragen</a>`;
    document.getElementById('finderResult').style.display = 'block';
  }
  </script>
</body>
</html>
