import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import axios from "axios";
import { QRCodeSVG } from "qrcode.react";
import "./App.css";

type Session = {
  token: string;
  user: { id: number; username: string; name: string };
};

type Wallet = { balance: number };

type Tx = {
  id: number;
  amount: number;
  status: string;
  created_at: string;
  customer_email?: string;
};

type CheckoutLink = {
  id: number;
  title: string;
  amount: number;
  checkout_url: string;
  status: string;
};

type WithdrawalRow = {
  id: number;
  amount: number;
  amount_cents?: number;
  pix_key: string;
  status: string;
  admin_note?: string | null;
  created_at: string;
  updated_at?: string;
};

type ApiKeyEntry = {
  id: number;
  key_hint: string;
  active: number;
  created_at: string;
};

type NavKey =
  | "inicio"
  | "perfil"
  | "gerar_pix"
  | "extrato"
  | "transacoes"
  | "transferencia"
  | "sacar"
  | "docs_api"
  | "notificacoes"
  | "configuracoes";

type ExtratoTab = "pagamentos" | "saques" | "transferencias";

const resolveApiBase = () => {
  const fromEnv = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined" && window.location.hostname !== "localhost") {
    return "";
  }
  return "http://localhost:4000";
};

const apiBaseUrl = resolveApiBase();

const api = axios.create({
  baseURL: apiBaseUrl,
});

const NAV_GROUPS: { section: string; items: { key: NavKey; label: string }[] }[] = [
  {
    section: "PRINCIPAL",
    items: [
      { key: "inicio", label: "Início" },
      { key: "perfil", label: "Perfil" },
      { key: "gerar_pix", label: "Gerar PIX" },
    ],
  },
  {
    section: "FINANCEIRO",
    items: [
      { key: "extrato", label: "Extrato" },
      { key: "transacoes", label: "Transações" },
      { key: "transferencia", label: "Transferência" },
      { key: "sacar", label: "Sacar" },
    ],
  },
  {
    section: "DESENVOLVEDOR",
    items: [{ key: "docs_api", label: "Documentação API" }],
  },
  {
    section: "CONTA",
    items: [
      { key: "notificacoes", label: "Notificações" },
      { key: "configuracoes", label: "Configurações" },
    ],
  },
];

const PAGE_TITLES: Record<NavKey, string> = {
  inicio: "Dashboard",
  perfil: "Meu Perfil",
  gerar_pix: "Gerar PIX",
  extrato: "Extrato",
  transacoes: "Transações",
  transferencia: "Transferência",
  sacar: "Saques",
  docs_api: "Documentação da API",
  notificacoes: "Notificações",
  configuracoes: "Configurações",
};

function fmt(value: number) {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  );
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  const [registerName, setRegisterName] = useState("");
  const [pendingApproval, setPendingApproval] = useState<{ username: string; password: string } | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [withdrawPixKey, setWithdrawPixKey] = useState("");
  const [links, setLinks] = useState<CheckoutLink[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKeyEntry[]>([]);
  const [activeNav, setActiveNav] = useState<NavKey>("inicio");
  const [extratoTab, setExtratoTab] = useState<ExtratoTab>("pagamentos");
  const [amount, setAmount] = useState("100.00");
  const [pixDescricao, setPixDescricao] = useState("");
  const [linkTitle, setLinkTitle] = useState("Pagamento");
  const [pixCode, setPixCode] = useState("");
  const [lastCheckoutUrl, setLastCheckoutUrl] = useState("");
  const [freshApiKey, setFreshApiKey] = useState("");
  const [message, setMessage] = useState("Ambiente privado — acesso por indicação.");
  const [pwdCurrent, setPwdCurrent] = useState("");
  const [pwdNew, setPwdNew] = useState("");
  const [pwdConfirm, setPwdConfirm] = useState("");

  const authHeader = useMemo(
    () => (session ? { Authorization: `Bearer ${session.token}` } : {}),
    [session],
  );

  const approved = transactions.filter((tx) => tx.status !== "pending");
  const pending = transactions.filter((tx) => tx.status === "pending");
  const approvedTotal = approved.reduce((s, tx) => s + tx.amount, 0);
  const displayName = session?.user.name || session?.user.username || "Usuário";
  const processingWithdrawals = withdrawals.filter((w) => w.status === "processing").length;

  useEffect(() => {
    if (!pendingApproval) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const response = await api.post("/auth/login", pendingApproval);
        if (cancelled) return;
        const currentSession = response.data as Session;
        setSession(currentSession);
        setPendingApproval(null);
        setMessage("Conta aprovada. Bem-vindo.");
        await refreshData(currentSession);
      } catch (error: unknown) {
        const err = error as { response?: { status?: number; data?: { code?: string; error?: string } } };
        const code = err?.response?.data?.code;
        if (err?.response?.status === 403 && code === "REJECTED") {
          setPendingApproval(null);
          setMessage(err?.response?.data?.error || "Cadastro nao aprovado.");
        }
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [pendingApproval]);

  useEffect(() => {
    if (!session || activeNav !== "sacar") return;
    const id = window.setInterval(() => {
      void refreshData(session);
    }, 5000);
    return () => window.clearInterval(id);
  }, [session, activeNav]);

  async function refreshData(currentSession: Session) {
    const headers = { Authorization: `Bearer ${currentSession.token}` };
    const [walletRes, txRes, linksRes, keysRes, wdRes] = await Promise.all([
      api.get("/wallet", { headers }),
      api.get("/transactions", { headers }),
      api.get("/checkout-links", { headers }),
      api.get("/api-keys", { headers }),
      api.get("/withdrawals", { headers }),
    ]);
    setWallet(walletRes.data.wallet);
    setTransactions(txRes.data.transactions || []);
    setLinks(linksRes.data.links || []);
    setApiKeys(keysRes.data.keys || []);
    setWithdrawals(wdRes.data.withdrawals || []);
  }

  async function handleAuth(event: FormEvent) {
    event.preventDefault();
    try {
      const response = await api.post("/auth/login", { username, password });
      const currentSession = response.data as Session;
      setSession(currentSession);
      setMessage("Acesso autorizado.");
      await refreshData(currentSession);
    } catch (error: unknown) {
      const err = error as {
        response?: { status?: number; data?: { error?: string; code?: string } };
      };
      const code = err?.response?.data?.code;
      if (err?.response?.status === 403 && code === "PENDING_APPROVAL") {
        setPendingApproval({ username, password });
        setMessage("Conta em analise. Atualizando automaticamente quando for aprovada...");
        return;
      }
      const apiMessage = err?.response?.data?.error || "Falha de autenticação.";
      setMessage(apiMessage);
    }
  }

  async function handleRegister(event: FormEvent) {
    event.preventDefault();
    try {
      const response = await api.post("/auth/register", {
        username,
        name: registerName || username,
        password,
      });
      if (response.data?.pending) {
        setPendingApproval({ username, password });
        setMessage(response.data?.message || "Cadastro em analise. Aguarde aprovacao.");
        return;
      }
      const currentSession = response.data as Session;
      setSession(currentSession);
      setMessage("Conta criada.");
      await refreshData(currentSession);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string; details?: string } } };
      const d = err?.response?.data;
      const line = [d?.error, d?.details].filter(Boolean).join(" — ");
      setMessage(line || "Falha ao criar conta.");
    }
  }

  async function requestWithdraw() {
    if (!session) return;
    const amountCents = Math.round(Number(amount.replace(",", ".")) * 100);
    const pixKey = withdrawPixKey.trim();
    if (!pixKey) {
      setMessage("Informe a chave PIX.");
      return;
    }
    try {
      await api.post("/withdrawals", { amountCents, pixKey }, { headers: authHeader });
      setMessage("Saque solicitado. Status: em processamento ate confirmacao.");
      setWithdrawPixKey("");
      await refreshData(session);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { details?: string; error?: string } } };
      const details = err?.response?.data?.details || err?.response?.data?.error;
      setMessage(details ? `Erro: ${details}` : "Erro ao solicitar saque.");
    }
  }

  async function createPix() {
    if (!session) return;
    try {
      const amountCents = Math.round(Number(amount.replace(",", ".")) * 100);
      const response = await api.post("/pix/create", { amountCents }, { headers: authHeader });
      setPixCode(response.data.pix.pix_qr_code);
      setMessage(pixDescricao ? `PIX gerado. Ref: ${pixDescricao}` : "Cobrança PIX gerada.");
      await refreshData(session);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { details?: string; error?: string } } };
      const details = err?.response?.data?.details || err?.response?.data?.error;
      setMessage(details ? `Erro: ${details}` : "Erro ao gerar PIX.");
    }
  }

  async function copyPixCode() {
    if (!pixCode) return;
    await navigator.clipboard.writeText(pixCode);
    setMessage("Código PIX copiado.");
  }

  function downloadQrImage() {
    const svg = document.getElementById("pix-qr-svg");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "inphopay-pix-qr.svg";
    link.click();
    URL.revokeObjectURL(url);
    setMessage("QR baixado.");
  }

  async function createCheckoutLink() {
    if (!session) return;
    try {
      const amountCents = Math.round(Number(amount.replace(",", ".")) * 100);
      const response = await api.post(
        "/checkout-links",
        { title: linkTitle || pixDescricao || "Pagamento", amountCents },
        { headers: authHeader },
      );
      const url = response.data.link.checkout_url as string;
      setLastCheckoutUrl(url);
      await navigator.clipboard.writeText(url);
      setMessage("Link de checkout criado e copiado.");
      await refreshData(session);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { details?: string; error?: string } } };
      const details = err?.response?.data?.details || err?.response?.data?.error;
      setMessage(details ? `Falha: ${details}` : "Falha ao criar link.");
    }
  }

  async function createApiKey() {
    if (!session) return;
    try {
      const response = await api.post("/api-keys/create", {}, { headers: authHeader });
      setFreshApiKey(response.data.apiKey);
      setMessage("Novo token gerado. Salve agora.");
      await refreshData(session);
    } catch {
      setMessage("Erro ao gerar token.");
    }
  }

  async function revokeApiKey(id: number) {
    if (!session) return;
    await api.post(`/api-keys/${id}/revoke`, {}, { headers: authHeader });
    setMessage("Token revogado.");
    await refreshData(session);
  }

  async function simulateCredit() {
    if (!session) return;
    const amountCents = Math.round(Number(amount.replace(",", ".")) * 100);
    await api.post("/wallet/simulate-credit", { amountCents }, { headers: authHeader });
    await refreshData(session);
    setMessage("Saldo atualizado (simulação).");
  }

  function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setMessage(
      "Alteração de senha: em breve no backend privado. Por ora use outro usuário ou redefina no banco.",
    );
    setPwdCurrent("");
    setPwdNew("");
    setPwdConfirm("");
  }

  const apiExampleBase = apiBaseUrl || (typeof window !== "undefined" ? window.location.origin : "");

  if (!session) {
    return (
      <main className="login-screen">
        <section className="login-card">
          <div className="brand-row brand-row--logo-only" style={{ border: "none", margin: "0 0 8px", padding: "0 0 16px" }}>
            <img src="/inphopay-logo.png" alt="" className="brand-logo" width={200} height={56} decoding="async" />
          </div>
          <div className="info-box blue" style={{ marginBottom: 16, textAlign: "left" }}>
            <strong>Operação via Discord:</strong> cada novo cadastro e cada pedido de saque notifica o time no
            servidor. Enquanto a conta não for aprovada ou o saque não for concluído pelo operador, o painel mostra
            “em análise” ou “em processamento”.
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button
              type="button"
              className={authTab === "login" ? "btn-primary" : "btn-ghost"}
              style={{ flex: 1 }}
              onClick={() => setAuthTab("login")}
            >
              Entrar
            </button>
            <button
              type="button"
              className={authTab === "register" ? "btn-primary" : "btn-ghost"}
              style={{ flex: 1 }}
              onClick={() => setAuthTab("register")}
            >
              Criar conta
            </button>
          </div>
          {pendingApproval ? (
            <>
              <h1>Conta em analise</h1>
              <p className="muted small">
                Seu cadastro foi enviado. A pagina verifica automaticamente a cada poucos segundos se o administrador
                aprovou no Discord.
              </p>
              <p className="muted small" style={{ marginTop: 12 }}>
                Usuario: <strong>{pendingApproval.username}</strong>
              </p>
            </>
          ) : authTab === "login" ? (
            <>
              <h1>Entrar</h1>
              <p className="muted small">Acesso privado — usuario e senha.</p>
              <form onSubmit={handleAuth} className="login-form">
                <label>Usuario</label>
                <input value={username} onChange={(e) => setUsername(e.target.value)} required autoComplete="username" />
                <label>Senha</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button type="submit" className="btn-primary">
                  Entrar
                </button>
              </form>
            </>
          ) : (
            <>
              <h1>Criar conta</h1>
              <p className="muted small">Apos o cadastro, a conta fica em analise ate aprovacao.</p>
              <form onSubmit={handleRegister} className="login-form">
                <label>Nome completo</label>
                <input
                  value={registerName}
                  onChange={(e) => setRegisterName(e.target.value)}
                  required
                  minLength={2}
                  autoComplete="name"
                />
                <label>Usuario</label>
                <input value={username} onChange={(e) => setUsername(e.target.value)} required autoComplete="username" />
                <label>Senha</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
                <button type="submit" className="btn-primary">
                  Enviar cadastro
                </button>
              </form>
            </>
          )}
          {pendingApproval && (
            <button
              type="button"
              className="btn-ghost"
              style={{ marginTop: 12, width: "100%" }}
              onClick={() => {
                setPendingApproval(null);
                setMessage("Voce saiu da espera. Pode tentar entrar de novo quando for aprovado.");
              }}
            >
              Cancelar espera
            </button>
          )}
          <p className="muted small" style={{ marginTop: 14 }}>
            {message}
          </p>
        </section>
      </main>
    );
  }

  const recentTx = [...transactions].slice(0, 8);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-row brand-row--logo-only">
          <img src="/inphopay-logo.png" alt="" className="brand-logo brand-logo--sidebar" width={160} height={44} decoding="async" />
        </div>

        <nav className="nav-scroll">
          {NAV_GROUPS.map((group) => (
            <div key={group.section}>
              <div className="nav-section-label">{group.section}</div>
              {group.items.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`nav-item ${activeNav === item.key ? "active" : ""}`}
                  onClick={() => setActiveNav(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
          <button
            type="button"
            className="nav-item logout"
            onClick={() => {
              setSession(null);
              setPixCode("");
              setWallet(null);
              setTransactions([]);
              setWithdrawals([]);
              setPendingApproval(null);
            }}
          >
            Sair
          </button>
        </nav>

        <div className="sidebar-user">
          <div className="av">{displayName.slice(0, 1).toUpperCase()}</div>
          <div className="nm">
            <div>{displayName}</div>
            <div className="muted small">@{session.user.username}</div>
          </div>
        </div>
      </aside>

      <main className="main">
        <div className="toast-bar">{message}</div>

        <header className="page-header">
          <h1>{PAGE_TITLES[activeNav]}</h1>
          <div className="page-header-actions">
            {activeNav === "inicio" && (
              <button type="button" className="btn-primary" onClick={() => setActiveNav("gerar_pix")}>
                Gerar PIX
              </button>
            )}
            {activeNav === "docs_api" && (
              <button type="button" className="btn-outline" onClick={() => setActiveNav("configuracoes")}>
                Meu token
              </button>
            )}
            {activeNav === "transacoes" && (
              <button type="button" className="btn-primary" onClick={() => setActiveNav("gerar_pix")}>
                + Nova cobrança
              </button>
            )}
            <button type="button" className="icon-btn" aria-label="Notificações" onClick={() => setActiveNav("notificacoes")}>
              <BellIcon />
            </button>
          </div>
        </header>

        <div className="page-body">
          {activeNav === "inicio" && (
            <>
              <div className="dash-top">
                <div className="balance-hero">
                  <div className="label">SALDO DISPONÍVEL</div>
                  <div className="value">R$ {fmt(wallet?.balance || 0)}</div>
                  <div className="status-line">
                    <span className="dot-g" />
                    Conta verificada e ativa.
                  </div>
                  <div className="row-btns">
                    <button type="button" className="btn-ghost" onClick={() => setActiveNav("sacar")}>
                      Sacar
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => setActiveNav("transferencia")}>
                      Transferir
                    </button>
                  </div>
                </div>
                <div className="card status-list">
                  <div className="card-title">Status da Conta</div>
                  <div className="row">
                    <span>Conta verificada</span>
                    <span className="pill-ok">ATIVA</span>
                  </div>
                  <div className="row">
                    <span>Gerar PIX</span>
                    <span className="pill-ok">HABILITADO</span>
                  </div>
                  <div className="row">
                    <span>Sacar</span>
                    <span className="pill-ok">HABILITADO</span>
                  </div>
                  <div className="row">
                    <span>Telegram</span>
                    <span className="pill-ok">NÃO VINCULADO</span>
                  </div>
                </div>
              </div>

              <div className="stat-row">
                <div className="stat-mini">
                  <div className="ic" />
                  <div className="num">{transactions.length}</div>
                  <div className="lbl">Pagamentos gerados</div>
                </div>
                <div className="stat-mini">
                  <div className="ic" />
                  <div className="num">{approved.length}</div>
                  <div className="lbl">Pagamentos confirmados</div>
                </div>
                  <div className="stat-mini">
                  <div className="ic" />
                  <div className="num">{withdrawals.length}</div>
                  <div className="lbl">Saques solicitados</div>
                </div>
                <div className="stat-mini">
                  <div className="ic" />
                  <div className="num">R$ {fmt(approvedTotal)}</div>
                  <div className="lbl">Volume líquido recebido</div>
                </div>
              </div>

              <div className="card table-card">
                <div className="head">
                  <span className="card-title" style={{ margin: 0 }}>
                    Últimos Pagamentos
                  </span>
                  <button type="button" className="link" onClick={() => setActiveNav("transacoes")}>
                    Ver todos
                  </button>
                </div>
                {recentTx.length === 0 ? (
                  <div className="empty-center">
                    <BellIcon />
                    <div className="big">Nenhum pagamento ainda.</div>
                    <p className="muted small">Gere sua primeira cobrança PIX agora.</p>
                    <button type="button" className="btn-primary" style={{ marginTop: 12 }} onClick={() => setActiveNav("gerar_pix")}>
                      Gerar PIX
                    </button>
                  </div>
                ) : (
                  <table className="data">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Valor</th>
                        <th>Status</th>
                        <th>Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentTx.map((tx) => (
                        <tr key={tx.id}>
                          <td>#{tx.id}</td>
                          <td>R$ {fmt(tx.amount)}</td>
                          <td>
                            <span className={`tag ${tx.status === "pending" ? "warn" : "ok"}`}>{tx.status}</span>
                          </td>
                          <td className="muted small">{new Date(tx.created_at).toLocaleString("pt-BR")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}

          {activeNav === "perfil" && (
            <>
              <div className="perfil-grid">
                <div className="card">
                  <div className="perfil-head">
                    <div className="av-lg">{displayName.slice(0, 1).toUpperCase()}</div>
                    <div>
                      <div style={{ fontWeight: 700 }}>{displayName}</div>
                      <div className="muted small">{session.user.username}@conta.local</div>
                    </div>
                  </div>
                  <table className="data">
                    <tbody>
                      <tr>
                        <td className="muted">Nome</td>
                        <td>{displayName}</td>
                      </tr>
                      <tr>
                        <td className="muted">Usuário</td>
                        <td>{session.user.username}</td>
                      </tr>
                      <tr>
                        <td className="muted">Saldo</td>
                        <td style={{ color: "var(--green)", fontWeight: 800 }}>R$ {fmt(wallet?.balance || 0)}</td>
                      </tr>
                      <tr>
                        <td className="muted">Telegram</td>
                        <td>—</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="card status-list">
                  <div className="card-title">Permissões</div>
                  <div className="row">
                    <span>Conta verificada</span>
                    <span className="pill-ok">ATIVA</span>
                  </div>
                  <div className="row">
                    <span>Gerar PIX</span>
                    <span className="pill-ok">HABILITADO</span>
                  </div>
                  <div className="row">
                    <span>Sacar</span>
                    <span className="pill-ok">HABILITADO</span>
                  </div>
                  <div className="row">
                    <span>Bloqueada</span>
                    <span className="pill-ok">NÃO</span>
                  </div>
                </div>
              </div>
              <div className="card">
                <div className="card-title">Taxas (referência operacional)</div>
                <div className="tax-row">
                  <div>
                    <div className="big">—</div>
                    <div className="lbl">Definidas pela TriboPay / operação</div>
                  </div>
                  <div>
                    <div className="big">—</div>
                    <div className="lbl">Saques / liquidação</div>
                  </div>
                  <div>
                    <div className="big">—</div>
                    <div className="lbl">PIX mínimo (ajuste no painel)</div>
                  </div>
                </div>
                <div className="tax-footer">Valores reais dependem da sua conta na adquirente.</div>
              </div>
            </>
          )}

          {activeNav === "gerar_pix" && (
            <div className="hist-split">
              <div className="card">
                <div className="card-title">Nova Cobrança PIX</div>
                <div className="info-box blue">Gere cobrança via TriboPay. Descrição é apenas para seu controle local (não enviada à API nesta versão).</div>
                <label className="field-label">VALOR (R$)</label>
                <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />
                <label className="field-label" style={{ marginTop: 14 }}>
                  DESCRIÇÃO (OPCIONAL)
                </label>
                <input
                  value={pixDescricao}
                  onChange={(e) => setPixDescricao(e.target.value)}
                  placeholder="Ex: Plano mensal"
                />
                <button type="button" className="btn-primary" style={{ width: "100%", marginTop: 18 }} onClick={createPix}>
                  Gerar Cobrança
                </button>
                <p className="muted small" style={{ marginTop: 12 }}>
                  Checkout rápido: use o mesmo valor abaixo em &quot;Link de checkout&quot;.
                </p>
                <label className="field-label">Título do link</label>
                <input value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} />
                <button type="button" className="btn-outline" style={{ width: "100%", marginTop: 10 }} onClick={createCheckoutLink}>
                  Criar link de checkout (copia URL)
                </button>
                {lastCheckoutUrl && (
                  <p className="mono small" style={{ marginTop: 10 }}>
                    {lastCheckoutUrl}
                  </p>
                )}
                {pixCode && (
                  <>
                    <div className="qr-wrap">
                      <QRCodeSVG id="pix-qr-svg" value={pixCode} size={200} />
                    </div>
                    <textarea readOnly value={pixCode} rows={4} />
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <button type="button" className="btn-ghost" onClick={copyPixCode}>
                        Copiar código
                      </button>
                      <button type="button" className="btn-ghost" onClick={downloadQrImage}>
                        Baixar QR
                      </button>
                    </div>
                  </>
                )}
              </div>
              <div className="card">
                <div className="head">
                  <span className="card-title" style={{ margin: 0 }}>
                    Histórico
                  </span>
                  <span className="muted small">{transactions.length}</span>
                </div>
                {transactions.length === 0 && links.length === 0 ? (
                  <div className="empty-center">
                    <div className="big">Nenhuma cobrança</div>
                    <p className="muted small">Suas cobranças e links aparecerão aqui.</p>
                  </div>
                ) : (
                  <>
                    {transactions.length > 0 && (
                      <>
                        <p className="field-label" style={{ marginTop: 8 }}>
                          PIX gerados
                        </p>
                        <table className="data">
                          <thead>
                            <tr>
                              <th>ID</th>
                              <th>Valor</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {transactions.slice(0, 12).map((tx) => (
                              <tr key={tx.id}>
                                <td>#{tx.id}</td>
                                <td>R$ {fmt(tx.amount)}</td>
                                <td>
                                  <span className={`tag ${tx.status === "pending" ? "warn" : "ok"}`}>{tx.status}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    )}
                    {links.length > 0 && (
                      <>
                        <p className="field-label" style={{ marginTop: 16 }}>
                          Checkout links
                        </p>
                        <table className="data">
                          <thead>
                            <tr>
                              <th>Título</th>
                              <th>Valor</th>
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {links.slice(0, 8).map((l) => (
                              <tr key={l.id}>
                                <td>{l.title}</td>
                                <td>R$ {fmt(l.amount)}</td>
                                <td>
                                  <button type="button" className="link" onClick={() => navigator.clipboard.writeText(l.checkout_url)}>
                                    Copiar URL
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {activeNav === "extrato" && (
            <div className="card">
              <div className="tabs">
                <button
                  type="button"
                  className={`tab ${extratoTab === "pagamentos" ? "active" : ""}`}
                  onClick={() => setExtratoTab("pagamentos")}
                >
                  Pagamentos
                </button>
                <button
                  type="button"
                  className={`tab ${extratoTab === "saques" ? "active" : ""}`}
                  onClick={() => setExtratoTab("saques")}
                >
                  Saques
                </button>
                <button
                  type="button"
                  className={`tab ${extratoTab === "transferencias" ? "active" : ""}`}
                  onClick={() => setExtratoTab("transferencias")}
                >
                  Transferências
                </button>
              </div>
              {extratoTab === "pagamentos" && (
                <>
                  <div className="card-title">Pagamentos Recebidos</div>
                  {transactions.length === 0 ? (
                    <div className="empty-center">
                      <div className="big">Nenhum pagamento</div>
                      <p className="muted small">Gere sua primeira cobrança PIX.</p>
                      <button type="button" className="btn-primary" style={{ marginTop: 12 }} onClick={() => setActiveNav("gerar_pix")}>
                        Gerar PIX
                      </button>
                    </div>
                  ) : (
                    <table className="data">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Valor</th>
                          <th>Status</th>
                          <th>Data</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((tx) => (
                          <tr key={tx.id}>
                            <td>#{tx.id}</td>
                            <td>R$ {fmt(tx.amount)}</td>
                            <td>
                              <span className={`tag ${tx.status === "pending" ? "warn" : "ok"}`}>{tx.status}</span>
                            </td>
                            <td className="muted small">{new Date(tx.created_at).toLocaleString("pt-BR")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              )}
              {extratoTab === "saques" && (
                <>
                  {withdrawals.length === 0 ? (
                    <div className="empty-center">
                      <div className="big">Nenhum saque</div>
                      <p className="muted small">Solicite um saque na aba Sacar.</p>
                    </div>
                  ) : (
                    <table className="data">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Valor</th>
                          <th>Status</th>
                          <th>Chave PIX</th>
                          <th>Data</th>
                        </tr>
                      </thead>
                      <tbody>
                        {withdrawals.map((w) => (
                          <tr key={w.id}>
                            <td>#{w.id}</td>
                            <td>R$ {fmt(w.amount)}</td>
                            <td>
                              <span
                                className={`tag ${
                                  w.status === "completed" ? "ok" : w.status === "rejected" ? "err" : "warn"
                                }`}
                              >
                                {w.status === "processing"
                                  ? "em processamento"
                                  : w.status === "completed"
                                    ? "concluido"
                                    : w.status}
                              </span>
                            </td>
                            <td className="muted small mono">{w.pix_key}</td>
                            <td className="muted small">{new Date(w.created_at).toLocaleString("pt-BR")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              )}
              {extratoTab === "transferencias" && (
                <div className="empty-center">
                  <div className="big">Nenhuma transferência</div>
                  <p className="muted small">Transferências internas podem ser adicionadas na próxima versão.</p>
                </div>
              )}
            </div>
          )}

          {activeNav === "transacoes" && (
            <>
              <div className="stat-row">
                <div className="stat-mini">
                  <div className="ic" />
                  <div className="num">{transactions.length}</div>
                  <div className="lbl">Total gerado</div>
                </div>
                <div className="stat-mini">
                  <div className="ic" />
                  <div className="num">{approved.length}</div>
                  <div className="lbl">Confirmados</div>
                </div>
                <div className="stat-mini">
                  <div className="ic" />
                  <div className="num">{pending.length}</div>
                  <div className="lbl">Pendentes</div>
                </div>
                <div className="stat-mini">
                  <div className="ic" />
                  <div className="num">R$ {fmt(approvedTotal)}</div>
                  <div className="lbl">Recebido líquido</div>
                </div>
              </div>
              <div className="card table-card">
                <div className="head">
                  <span className="card-title" style={{ margin: 0 }}>
                    Todas as transações
                  </span>
                  <span className="muted small">{transactions.length}</span>
                </div>
                {transactions.length === 0 ? (
                  <div className="empty-center">
                    <div className="big">Nenhuma transação registrada</div>
                    <button type="button" className="link" style={{ marginTop: 12 }} onClick={() => setActiveNav("gerar_pix")}>
                      Gere sua primeira cobrança
                    </button>
                  </div>
                ) : (
                  <table className="data">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Valor</th>
                        <th>Status</th>
                        <th>Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx) => (
                        <tr key={tx.id}>
                          <td>#{tx.id}</td>
                          <td>R$ {fmt(tx.amount)}</td>
                          <td>
                            <span className={`tag ${tx.status === "pending" ? "warn" : "ok"}`}>{tx.status}</span>
                          </td>
                          <td className="muted small">{new Date(tx.created_at).toLocaleString("pt-BR")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}

          {activeNav === "transferencia" && (
            <div className="grid-2">
              <div className="balance-hero">
                <div className="label">SALDO DISPONÍVEL</div>
                <div className="value">R$ {fmt(wallet?.balance || 0)}</div>
              </div>
              <div />
              <div className="card" style={{ gridColumn: "1 / -1" }}>
                <div className="card-title">Transferir saldo</div>
                <div className="info-box blue">Transferências entre contas internas ainda não estão ativas nesta build.</div>
                <label className="field-label">E-MAIL DO DESTINATÁRIO</label>
                <input placeholder="destino@email.com" disabled />
                <label className="field-label" style={{ marginTop: 12 }}>
                  VALOR (R$)
                </label>
                <input placeholder="0,00" disabled />
                <p className="muted small">Mínimo: R$ 1,00 | Disponível: R$ {fmt(wallet?.balance || 0)}</p>
                <button type="button" className="btn-primary" style={{ width: "100%", marginTop: 16 }} disabled>
                  Confirmar transferência
                </button>
              </div>
            </div>
          )}

          {activeNav === "sacar" && (
            <div className="grid-2">
              <div className="balance-hero">
                <div className="label">SALDO DISPONÍVEL</div>
                <div className="value">R$ {fmt(wallet?.balance || 0)}</div>
                <div className="status-line">
                  <span className="dot-g" />
                  {processingWithdrawals > 0
                    ? `${processingWithdrawals} saque(s) em processamento — atualizando a cada 5s.`
                    : "Nenhum saque pendente de confirmacao."}
                </div>
              </div>
              <div />
              <div className="card" style={{ gridColumn: "1 / -1" }}>
                <div className="card-title">Solicitar saque</div>
                <div className="info-box blue">
                  O valor e debitado na hora. O administrador recebe a chave PIX no Discord e marca como concluido
                  quando transferir. Enquanto isso, o status fica em processamento.
                </div>
                <label className="field-label">VALOR (R$)</label>
                <input value={amount} onChange={(e) => setAmount(e.target.value)} />
                <p className="muted small">Minimo R$ 1,00 | Disponivel: R$ {fmt(wallet?.balance || 0)}</p>
                <label className="field-label" style={{ marginTop: 12 }}>
                  CHAVE PIX
                </label>
                <input
                  placeholder="CPF, e-mail, telefone ou chave aleatoria"
                  value={withdrawPixKey}
                  onChange={(e) => setWithdrawPixKey(e.target.value)}
                />
                <button type="button" className="btn-primary" style={{ width: "100%", marginTop: 16 }} onClick={requestWithdraw}>
                  Solicitar saque
                </button>
                <p className="muted small" style={{ marginTop: 12 }}>
                  Para testar saldo: use &quot;Simular credito&quot; no painel dev (abaixo).
                </p>
                <button type="button" className="btn-ghost" onClick={simulateCredit}>
                  Simular credito (dev)
                </button>
              </div>
              <div className="card" style={{ gridColumn: "1 / -1" }}>
                <div className="card-title">Historico de saques</div>
                {withdrawals.length === 0 ? (
                  <div className="empty-center">
                    <div className="big">Nenhum saque ainda</div>
                    <p className="muted small">Seus saques aparecem aqui apos a solicitacao.</p>
                  </div>
                ) : (
                  <table className="data">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Valor</th>
                        <th>Status</th>
                        <th>Chave PIX</th>
                        <th>Atualizado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {withdrawals.map((w) => (
                        <tr key={w.id}>
                          <td>#{w.id}</td>
                          <td>R$ {fmt(w.amount)}</td>
                          <td>
                            <span
                              className={`tag ${
                                w.status === "completed" ? "ok" : w.status === "rejected" ? "err" : "warn"
                              }`}
                            >
                              {w.status === "processing"
                                ? "em processamento"
                                : w.status === "completed"
                                  ? "concluido"
                                  : w.status}
                            </span>
                          </td>
                          <td className="muted small mono">{w.pix_key}</td>
                          <td className="muted small">
                            {(w.updated_at || w.created_at) &&
                              new Date(w.updated_at || w.created_at).toLocaleString("pt-BR")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {activeNav === "notificacoes" && (
            <div className="card">
              <div className="head">
                <span className="card-title" style={{ margin: 0 }}>
                  Central de Notificações
                </span>
                <span className="muted small">0</span>
              </div>
              <div className="empty-center">
                <BellIcon />
                <div className="big">Sem notificações</div>
                <p className="muted small">Você não tem nenhuma notificação no momento.</p>
              </div>
            </div>
          )}

          {activeNav === "configuracoes" && (
            <>
              <div className="settings-grid">
                <div className="card">
                  <div className="card-title">Alterar Senha</div>
                  <form onSubmit={handleChangePassword}>
                    <label className="field-label">SENHA ATUAL</label>
                    <input type="password" value={pwdCurrent} onChange={(e) => setPwdCurrent(e.target.value)} />
                    <label className="field-label" style={{ marginTop: 12 }}>
                      NOVA SENHA
                    </label>
                    <input type="password" value={pwdNew} onChange={(e) => setPwdNew(e.target.value)} />
                    <label className="field-label" style={{ marginTop: 12 }}>
                      CONFIRMAR NOVA SENHA
                    </label>
                    <input type="password" value={pwdConfirm} onChange={(e) => setPwdConfirm(e.target.value)} />
                    <button type="submit" className="btn-primary" style={{ width: "100%", marginTop: 16 }}>
                      Alterar Senha
                    </button>
                  </form>
                </div>
                <div className="card">
                  <div className="card-title">Discord (cadastros e saques)</div>
                  <div className="info-box blue" style={{ textAlign: "left" }}>
                    O administrador recebe alertas nos canais do servidor: um para <strong>novos cadastros</strong> e
                    outro para <strong>pedidos de saque</strong> (com chave PIX). No Discord, use os comandos slash{" "}
                    <span className="mono">/conta_aprovar</span>, <span className="mono">/conta_reprovar</span>,{" "}
                    <span className="mono">/saque_concluir</span> e <span className="mono">/saque_rejeitar</span> com
                    os IDs que aparecem na mensagem.
                  </div>
                  <p className="muted small" style={{ marginTop: 12 }}>
                    Este painel consulta o servidor automaticamente enquanto você aguarda aprovação ou a conclusão de
                    um saque.
                  </p>
                </div>
              </div>
              <div className="card">
                <div className="card-title">Token de API</div>
                <div className="info-box orange">
                  Mantenha seu token seguro. Não compartilhe. Se comprometido, revogue e gere outro.
                </div>
                {freshApiKey ? (
                  <div className="code-block" style={{ marginBottom: 12 }}>
                    {freshApiKey}
                  </div>
                ) : (
                  <p className="muted small">Gere um token para integrar seus sistemas.</p>
                )}
                <button type="button" className="btn-outline" onClick={createApiKey}>
                  Gerar token de API
                </button>
                <table className="data" style={{ marginTop: 16 }}>
                  <thead>
                    <tr>
                      <th>Chave</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {apiKeys.map((k) => (
                      <tr key={k.id}>
                        <td className="mono">{k.key_hint}</td>
                        <td>
                          <span className={`tag ${k.active ? "ok" : "warn"}`}>{k.active ? "ativa" : "revogada"}</span>
                        </td>
                        <td>
                          {k.active ? (
                            <button type="button" className="btn-ghost" onClick={() => revokeApiKey(k.id)}>
                              Revogar
                            </button>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="muted small" style={{ marginTop: 12 }}>
                  Uso na documentação: header <code className="mono">x-inphopay-key</code>.
                </p>
              </div>
            </>
          )}

          {activeNav === "docs_api" && (
            <div className="card docs-layout">
              <div className="docs-toc">
                <div className="tl">CONTEÚDO</div>
                <button type="button" className="on">
                  Introdução
                </button>
                <button type="button" disabled style={{ opacity: 0.5 }}>
                  Autenticação
                </button>
                <button type="button" disabled style={{ opacity: 0.5 }}>
                  Gerar pagamento
                </button>
              </div>
              <div className="docs-content">
                <h2 id="intro">Introdução</h2>
                <p>
                  A API expõe geração de cobrança PIX para a sua operação white-label. Todas as rotas abaixo usam
                  o mesmo domínio do painel em produção.
                </p>
                <div className="field-label">BASE URL</div>
                <div className="code-block">{apiExampleBase || "(mesmo host do painel)"}</div>

                <h2>Autenticação</h2>
                <p>
                  Envie o token no header <strong style={{ color: "var(--accent)" }}>x-inphopay-key</strong> (não use Bearer
                  nesta versão).
                </p>
                {!apiKeys.length && !freshApiKey && (
                  <div className="info-box orange">Você ainda não possui um token. Gere em Configurações.</div>
                )}
                <div className="field-label">EXEMPLO DE HEADER</div>
                <div className="code-block">{`x-inphopay-key: inpho_sua_chave_aqui`}</div>

                <h2>Gerar pagamento</h2>
                <p>
                  <strong>POST</strong> <span className="mono">/api/v1/pix/create</span>
                </p>
                <div className="field-label">BODY (JSON)</div>
                <div className="code-block">{`{
  "amountCents": 4000
}`}</div>
                <p className="muted small">Resposta inclui pix_qr_code para QR e copia-e-cola.</p>

                <h2>Checkout público</h2>
                <p className="muted small">
                  Links criados em Gerar PIX retornam URL <span className="mono">/checkout/:token</span> no mesmo host.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
