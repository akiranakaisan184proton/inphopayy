require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { z } = require("zod");

const repo = require("./repo");
const { signToken, requireAuth } = require("./auth");
const { createPixTransaction } = require("./tribopay");
const { discordInteractionHandler } = require("./discordInteractions");
const discordNotify = require("./discordNotify");
const path = require("path");
const { renderCheckoutPage } = require("./checkoutPage");

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET nao configurado. Defina em backend/.env.");
}

const app = express();
const allowedOrigins = (
  process.env.CORS_ORIGIN || "http://localhost:5173,http://localhost:5174"
)
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      const isLocalDevOrigin =
        typeof origin === "string" &&
        (/^http:\/\/localhost:\d+$/.test(origin) || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin));
      if (!origin || allowedOrigins.includes(origin) || isLocalDevOrigin) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
  }),
);

app.post(
  "/discord/interactions",
  express.raw({ type: "application/json" }),
  (req, res, next) => {
    Promise.resolve(discordInteractionHandler(req, res)).catch(next);
  },
);

app.use(express.json());

const publicDir = path.join(__dirname, "..", "public");
app.use(express.static(publicDir));

function toMoney(cents) {
  return Number(cents) / 100;
}
function makeApiKey() {
  return `inpho_${crypto.randomBytes(24).toString("hex")}`;
}
function hashKey(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
function publicBase(req) {
  return (
    process.env.PUBLIC_BASE_URL ||
    `${req.protocol}://${req.get("host")}`
  );
}
function extractTriboError(error) {
  return String(
    error?.response?.data?.message ||
      error?.response?.data?.error ||
      (typeof error?.response?.data === "string" ? error.response.data : null) ||
      error?.message ||
      "erro desconhecido",
  );
}

async function requireApiKey(req, res, next) {
  const apiKey = req.headers["x-inphopay-key"];
  if (!apiKey || typeof apiKey !== "string") {
    return res.status(401).json({ error: "API key ausente." });
  }
  try {
    const keyHash = hashKey(apiKey);
    const keyRow = await repo.findApiKeyByHash(keyHash);
    if (!keyRow || keyRow.active !== 1) {
      return res.status(401).json({ error: "API key invalida." });
    }
    const approval = keyRow.approval_status || "approved";
    if (approval !== "approved") {
      return res.status(403).json({ error: "Conta nao aprovada para uso da API." });
    }
    req.apiUser = keyRow;
    next();
  } catch (error) {
    return res.status(500).json({ error: "Falha na validacao da API key.", details: String(error.message) });
  }
}

async function requireApprovedUser(req, res, next) {
  try {
    const user = await repo.findUserById(req.user.sub);
    if (!user) return res.status(401).json({ error: "Usuario nao encontrado." });
    if (user.role === "admin") return next();
    const st = user.approval_status || "approved";
    if (st === "pending") {
      return res.status(403).json({ code: "PENDING_APPROVAL", error: "Conta em analise. Aguarde aprovacao." });
    }
    if (st === "rejected") {
      return res.status(403).json({
        code: "REJECTED",
        error: user.rejection_reason || "Cadastro nao aprovado.",
      });
    }
    return next();
  } catch (error) {
    return res.status(500).json({ error: "Falha ao validar conta.", details: String(error.message) });
  }
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "inphopay-backend" });
});

app.post("/auth/register", async (req, res) => {
  const schema = z.object({
    username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
    name: z.string().min(2),
    password: z.string().min(6),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dados invalidos." });

  if (
    process.env.AWS_LAMBDA_FUNCTION_NAME &&
    (!String(process.env.SUPABASE_URL || "").trim() || !String(process.env.SUPABASE_SERVICE_KEY || "").trim())
  ) {
    return res.status(503).json({
      error: "Banco de dados nao configurado no servidor.",
      details:
        "Na Netlify defina SUPABASE_URL (ex.: https://xxx.supabase.co, sem /rest/v1/) e SUPABASE_SERVICE_KEY com escopo Functions + Production.",
    });
  }

  const { username, name, password } = parsed.data;
  try {
    const existing = await repo.findUserByUsername(username);
    if (existing) return res.status(409).json({ error: "Usuario ja cadastrado." });

    const passwordHash = await bcrypt.hash(password, 10);
    const email = `${username}@inphopay.local`;
    const user = await repo.createUser({ username, name, email, password_hash: passwordHash });
    await repo.createWallet(user.id);
    const full = await repo.findUserById(user.id);
    try {
      await discordNotify.notifyNewRegistration(full || user);
    } catch (e) {
      console.warn("Discord notify registration:", e?.message || e);
    }
    return res.status(201).json({
      pending: true,
      message: "Cadastro recebido. Sua conta esta em analise.",
      user: { id: user.id, username, name },
    });
  } catch (error) {
    if (String(error.message || "").toLowerCase().includes("unique")) {
      return res.status(409).json({ error: "Usuario ja cadastrado." });
    }
    const msg = String(error.message || error);
    let hint = "";
    if (/does not exist|relation.*users/i.test(msg)) {
      hint =
        " Tabelas ausentes no Supabase: rode o SQL em supabase/schema.sql (e migration_*.sql se precisar) no SQL Editor do projeto.";
    } else if (/row-level security|violates row-level security/i.test(msg)) {
      hint = " RLS bloqueou o insert: use a service_role key e/ou desative RLS nas tabelas internas (veja schema.sql).";
    } else if (/invalid api key|jwt|fetch failed|ENOTFOUND/i.test(msg)) {
      hint = " Confira SUPABASE_URL (sem /rest/v1/) e SUPABASE_SERVICE_KEY no Netlify (Functions + Production).";
    }
    return res.status(500).json({ error: "Falha ao criar usuario.", details: msg + hint });
  }
});

app.post("/auth/login", async (req, res) => {
  const schema = z.object({
    username: z.string().min(3),
    password: z.string().min(6),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Credenciais invalidas." });

  try {
    const { username, password } = parsed.data;
    const user = await repo.findUserByUsername(username);
    if (!user) return res.status(401).json({ error: "Login invalido." });

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) return res.status(401).json({ error: "Login invalido." });

    if (user.role !== "admin") {
      const st = user.approval_status || "approved";
      if (st === "pending") {
        return res.status(403).json({
          code: "PENDING_APPROVAL",
          error: "Conta em analise. Aguarde aprovacao pelo administrador.",
        });
      }
      if (st === "rejected") {
        return res.status(403).json({
          code: "REJECTED",
          error: user.rejection_reason || "Cadastro nao aprovado.",
        });
      }
    }

    const token = signToken(user);
    return res.json({
      token,
      user: { id: user.id, username: user.username, name: user.name, role: user.role },
    });
  } catch (error) {
    return res.status(500).json({ error: "Falha no login.", details: String(error.message) });
  }
});

app.get("/me", requireAuth, requireApprovedUser, async (req, res) => {
  try {
    const user = await repo.findUserById(req.user.sub);
    if (!user) return res.status(404).json({ error: "Usuario nao encontrado." });
    res.json({
      user: { id: user.id, username: user.username, name: user.name, role: user.role, created_at: user.created_at },
    });
  } catch (error) {
    res.status(500).json({ error: "Falha ao carregar usuario.", details: String(error.message) });
  }
});

app.get("/wallet", requireAuth, requireApprovedUser, async (req, res) => {
  try {
    const wallet = await repo.getWalletWithUser(req.user.sub);
    if (!wallet) return res.status(404).json({ error: "Carteira nao encontrada." });
    res.json({ wallet: { ...wallet, balance: toMoney(wallet.balance_cents) } });
  } catch (error) {
    res.status(500).json({ error: "Falha ao carregar carteira.", details: String(error.message) });
  }
});

app.get("/transactions", requireAuth, requireApprovedUser, async (req, res) => {
  try {
    const rows = await repo.listTransactions(req.user.sub);
    res.json({
      transactions: rows.map((row) => ({ ...row, amount: toMoney(row.amount_cents) })),
    });
  } catch (error) {
    res.status(500).json({ error: "Falha ao listar transacoes.", details: String(error.message) });
  }
});

app.get("/checkout-links", requireAuth, requireApprovedUser, async (req, res) => {
  try {
    const links = await repo.listCheckoutLinks(req.user.sub);
    const base = publicBase(req);
    res.json({
      links: links.map((item) => ({
        ...item,
        amount: toMoney(item.amount_cents),
        checkout_url: `${base}/checkout/${item.token}`,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: "Falha ao listar checkouts.", details: String(error.message) });
  }
});

app.post("/checkout-links", requireAuth, requireApprovedUser, async (req, res) => {
  const schema = z.object({
    title: z.string().min(2).max(80).default("Pagamento InphoPay"),
    amountCents: z.number().int().positive().min(100),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Payload invalido." });

  try {
    const token = crypto.randomBytes(18).toString("hex");
    const created = await repo.createCheckoutLink({
      user_id: req.user.sub,
      token,
      title: parsed.data.title,
      amount_cents: parsed.data.amountCents,
    });
    res.status(201).json({
      link: {
        id: created.id,
        token,
        title: parsed.data.title,
        amount: toMoney(parsed.data.amountCents),
        checkout_url: `${publicBase(req)}/checkout/${token}`,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Falha ao criar checkout link.", details: String(error.message) });
  }
});

app.get("/api-keys", requireAuth, requireApprovedUser, async (req, res) => {
  try {
    const keys = await repo.listApiKeys(req.user.sub);
    res.json({ keys });
  } catch (error) {
    res.status(500).json({ error: "Falha ao listar API keys.", details: String(error.message) });
  }
});

app.post("/api-keys/create", requireAuth, requireApprovedUser, async (req, res) => {
  try {
    const rawKey = makeApiKey();
    const keyHash = hashKey(rawKey);
    const hint = `${rawKey.slice(0, 10)}...${rawKey.slice(-4)}`;
    await repo.createApiKey({ user_id: req.user.sub, key_hash: keyHash, key_hint: hint });
    res.status(201).json({
      apiKey: rawKey,
      note: "Salve agora. Ela nao sera exibida novamente.",
    });
  } catch (error) {
    res.status(500).json({ error: "Falha ao criar API key.", details: String(error.message) });
  }
});

app.post("/api-keys/:id/revoke", requireAuth, requireApprovedUser, async (req, res) => {
  try {
    await repo.revokeApiKey({ id: req.params.id, user_id: req.user.sub });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: "Falha ao revogar API key.", details: String(error.message) });
  }
});

app.post("/api/v1/pix/create", requireApiKey, async (req, res) => {
  if (!process.env.TRIBOPAY_API_TOKEN) {
    return res.status(500).json({ error: "TRIBOPAY_API_TOKEN nao configurado no servidor." });
  }
  const schema = z.object({ amountCents: z.number().int().positive().min(100) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Payload invalido." });

  try {
    const customer = {
      name: req.apiUser.name || req.apiUser.username || "Cliente InphoPay",
      email: `${req.apiUser.username || "cliente"}@inphopay.local`,
      phone_number: "11999999999",
      document: "09115751031",
      street_name: "Rua Inpho",
      number: "100",
      complement: "",
      neighborhood: "Centro",
      city: "Sao Paulo",
      state: "SP",
      zip_code: "00000000",
    };
    const result = await createPixTransaction({ amountCents: parsed.data.amountCents, customer });
    const tx = await repo.createPixTransactionRecord({
      user_id: req.apiUser.user_id,
      amount_cents: parsed.data.amountCents,
      status: "pending",
      tribopay_transaction_id: result.transactionId,
      tribopay_offer_hash: result.offerHash,
      tribopay_product_hash: result.productHash,
      pix_qr_code: result.pixQrCode,
      customer_email: customer.email,
    });
    res.status(201).json({
      transaction: { id: tx.id, amount: toMoney(parsed.data.amountCents), status: "pending" },
      pix: { pix_qr_code: result.pixQrCode },
    });
  } catch (error) {
    res
      .status(502)
      .json({ error: "Falha ao gerar PIX na InphoPay API.", details: extractTriboError(error) });
  }
});

app.post("/pix/create", requireAuth, requireApprovedUser, async (req, res) => {
  if (!process.env.TRIBOPAY_API_TOKEN) {
    return res.status(500).json({ error: "TRIBOPAY_API_TOKEN nao configurado no servidor." });
  }
  const schema = z.object({ amountCents: z.number().int().positive().min(100) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Payload invalido." });

  try {
    const user = await repo.findUserById(req.user.sub);
    const customer = {
      name: user?.name || user?.username || "Cliente InphoPay",
      email: `${user?.username || "cliente"}@inphopay.local`,
      phone_number: "11999999999",
      document: "09115751031",
      street_name: "Rua Inpho",
      number: "100",
      complement: "",
      neighborhood: "Centro",
      city: "Sao Paulo",
      state: "SP",
      zip_code: "00000000",
    };
    const result = await createPixTransaction({ amountCents: parsed.data.amountCents, customer });
    const tx = await repo.createPixTransactionRecord({
      user_id: req.user.sub,
      amount_cents: parsed.data.amountCents,
      status: "pending",
      tribopay_transaction_id: result.transactionId,
      tribopay_offer_hash: result.offerHash,
      tribopay_product_hash: result.productHash,
      pix_qr_code: result.pixQrCode,
      customer_email: customer.email,
    });
    res.status(201).json({
      transaction: { id: tx.id, amount: toMoney(parsed.data.amountCents), status: "pending" },
      pix: { pix_qr_code: result.pixQrCode },
    });
  } catch (error) {
    res.status(502).json({ error: "Falha ao gerar PIX na TriboPay.", details: extractTriboError(error) });
  }
});

app.post("/wallet/simulate-credit", requireAuth, requireApprovedUser, async (req, res) => {
  const schema = z.object({ amountCents: z.number().int().positive() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Valor invalido." });
  try {
    const wallet = await repo.addToWallet(req.user.sub, parsed.data.amountCents);
    res.json({ wallet: { ...wallet, balance: toMoney(wallet.balance_cents) } });
  } catch (error) {
    res.status(500).json({ error: "Falha ao creditar carteira.", details: String(error.message) });
  }
});

app.get("/withdrawals", requireAuth, requireApprovedUser, async (req, res) => {
  try {
    const rows = await repo.listWithdrawalsByUser(req.user.sub);
    res.json({
      withdrawals: rows.map((r) => ({
        id: r.id,
        amount: toMoney(r.amount_cents),
        amount_cents: r.amount_cents,
        pix_key: r.pix_key,
        status: r.status,
        admin_note: r.admin_note,
        created_at: r.created_at,
        updated_at: r.updated_at,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: "Falha ao listar saques.", details: String(error.message) });
  }
});

app.post("/withdrawals", requireAuth, requireApprovedUser, async (req, res) => {
  const schema = z.object({
    amountCents: z.number().int().positive().min(100),
    pixKey: z.string().min(3).max(180),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dados do saque invalidos." });

  try {
    const row = await repo.createWithdrawal({
      user_id: req.user.sub,
      amount_cents: parsed.data.amountCents,
      pix_key: parsed.data.pixKey.trim(),
    });
    const user = await repo.findUserById(req.user.sub);
    try {
      await discordNotify.notifyWithdrawalRequest(row, user);
    } catch (e) {
      console.warn("Discord notify withdrawal:", e?.message || e);
    }
    res.status(201).json({
      withdrawal: {
        id: row.id,
        amount: toMoney(row.amount_cents),
        status: row.status,
        pix_key: row.pix_key,
        created_at: row.created_at,
      },
    });
  } catch (error) {
    if (String(error.message) === "INSUFFICIENT_FUNDS") {
      return res.status(400).json({ error: "Saldo insuficiente para este saque." });
    }
    if (String(error.message) === "WALLET_NOT_FOUND") {
      return res.status(400).json({ error: "Carteira nao encontrada." });
    }
    res.status(500).json({ error: "Falha ao solicitar saque.", details: String(error.message) });
  }
});

app.get("/public/checkout/:token", async (req, res) => {
  try {
    const link = await repo.getCheckoutLinkByToken(req.params.token);
    if (!link) return res.status(404).json({ error: "Checkout nao encontrado." });
    const seller = await repo.findUserById(link.user_id);
    const sellerOk =
      seller && (seller.role === "admin" || String(seller.approval_status || "approved") === "approved");
    if (!sellerOk) {
      return res.status(403).json({ error: "Checkout indisponivel. Conta do vendedor em analise." });
    }
    res.json({
      token: link.token,
      title: link.title,
      amount: toMoney(link.amount_cents),
      status: link.status,
      pix_qr_code: link.pix_qr_code || null,
    });
  } catch (error) {
    res.status(500).json({ error: "Falha ao carregar checkout.", details: String(error.message) });
  }
});

app.post("/public/checkout/:token/pay", async (req, res) => {
  try {
    const link = await repo.getCheckoutLinkByToken(req.params.token);
    if (!link) return res.status(404).json({ error: "Checkout nao encontrado." });

    const seller = await repo.findUserById(link.user_id);
    const sellerOk =
      seller && (seller.role === "admin" || String(seller.approval_status || "approved") === "approved");
    if (!sellerOk) {
      return res.status(403).json({ error: "Checkout indisponivel. Conta do vendedor em analise." });
    }

    if (link.pix_qr_code) {
      return res.json({
        pix: { pix_qr_code: link.pix_qr_code },
        transaction: { id: link.id, amount: toMoney(link.amount_cents), status: link.status },
      });
    }

    const user = await repo.findUserById(link.user_id);
    const customer = {
      name: user?.name || user?.username || "Cliente InphoPay",
      email: `${user?.username || "cliente"}@inphopay.local`,
      phone_number: "11999999999",
      document: "09115751031",
      street_name: "Rua Inpho",
      number: "100",
      complement: "",
      neighborhood: "Centro",
      city: "Sao Paulo",
      state: "SP",
      zip_code: "00000000",
    };
    const result = await createPixTransaction({ amountCents: link.amount_cents, customer });
    await repo.updateCheckoutLinkPix(link.id, {
      tribopay_transaction_id: result.transactionId,
      pix_qr_code: result.pixQrCode,
    });
    await repo.createPixTransactionRecord({
      user_id: link.user_id,
      amount_cents: link.amount_cents,
      status: "pending",
      tribopay_transaction_id: result.transactionId,
      tribopay_offer_hash: result.offerHash,
      tribopay_product_hash: result.productHash,
      pix_qr_code: result.pixQrCode,
      customer_email: customer.email,
    });
    res.status(201).json({
      pix: { pix_qr_code: result.pixQrCode },
      transaction: { id: link.id, amount: toMoney(link.amount_cents), status: "pending" },
    });
  } catch (error) {
    res.status(502).json({ error: "Falha ao gerar PIX para checkout.", details: extractTriboError(error) });
  }
});

app.get("/checkout/:token", (req, res) => {
  res.type("html").send(renderCheckoutPage(req.params.token));
});

module.exports = { app };

// Local server only when not running as a serverless function
if (require.main === module) {
  const port = Number(process.env.PORT || 4000);
  (async () => {
    try {
      const useSupabase = Boolean(
        process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY,
      );
      if (!useSupabase) {
        const username = process.env.DEFAULT_USERNAME || "inphoadmin";
        const password = process.env.DEFAULT_PASSWORD || "inpho123";
        const existing = await repo.findUserByUsername(username);
        if (!existing) {
          const passwordHash = await bcrypt.hash(password, 10);
          const email = `${username}@inphopay.local`;
          const user = await repo.createUser({
            username,
            name: "Inpho Admin",
            email,
            password_hash: passwordHash,
            approval_status: "approved",
          });
          await repo.createWallet(user.id);
          console.log(`Acesso inicial criado: usuario=${username} senha=${password}`);
        }
      }
    } catch (error) {
      console.warn("Bootstrap warning:", error.message);
    }
    app.listen(port, () => {
      console.log(`InphoPay backend ativo em http://localhost:${port}`);
    });
  })();
}
