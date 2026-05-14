const { verifyKey } = require("discord-interactions");
const repo = require("./repo");

const InteractionType = {
  PING: 1,
  APPLICATION_COMMAND: 2,
};

const InteractionResponseType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
};

function jsonResponse(res, body, status = 200) {
  res.status(status).setHeader("Content-Type", "application/json").send(JSON.stringify(body));
}

function isDiscordAdmin(interaction) {
  const uid = interaction.member?.user?.id;
  if (!uid) return false;
  const allowList = (process.env.DISCORD_ADMIN_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowList.length) return allowList.includes(uid);
  const raw = interaction.member?.permissions;
  if (raw == null) return false;
  try {
    const perms = BigInt(String(raw));
    const admin = 1n << 3n;
    return (perms & admin) === admin;
  } catch {
    return false;
  }
}

function ephemeralMessage(content) {
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content, flags: 64 },
  };
}

async function handleCommand(interaction) {
  const name = interaction.data?.name;
  const opts = interaction.data?.options || [];
  const getNum = (n) => {
    const o = opts.find((x) => x.name === n);
    return o?.value != null ? Number(o.value) : null;
  };
  const getStr = (n) => {
    const o = opts.find((x) => x.name === n);
    return o?.value != null ? String(o.value) : "";
  };

  if (!isDiscordAdmin(interaction)) {
    return ephemeralMessage("Sem permissao para usar estes comandos neste servidor.");
  }

  try {
    if (name === "conta_aprovar") {
      const userId = getNum("usuario_id");
      if (!userId || !Number.isFinite(userId)) return ephemeralMessage("usuario_id invalido.");
      const u = await repo.findUserById(userId);
      if (!u) return ephemeralMessage("Usuario nao encontrado.");
      if (u.role === "admin") return ephemeralMessage("Nao e possivel alterar aprovacao de admin assim.");
      await repo.setUserApproval({ user_id: userId, approval_status: "approved", rejection_reason: null });
      return ephemeralMessage(`Conta **${u.username}** (id ${userId}) aprovada.`);
    }

    if (name === "conta_reprovar") {
      const userId = getNum("usuario_id");
      const motivo = getStr("motivo") || "Cadastro nao aprovado.";
      if (!userId || !Number.isFinite(userId)) return ephemeralMessage("usuario_id invalido.");
      const u = await repo.findUserById(userId);
      if (!u) return ephemeralMessage("Usuario nao encontrado.");
      if (u.role === "admin") return ephemeralMessage("Nao e possivel reprovar admin.");
      await repo.setUserApproval({ user_id: userId, approval_status: "rejected", rejection_reason: motivo });
      return ephemeralMessage(`Conta **${u.username}** (id ${userId}) reprovada.`);
    }

    if (name === "saque_concluir") {
      const wid = getNum("saque_id");
      if (!wid || !Number.isFinite(wid)) return ephemeralMessage("saque_id invalido.");
      const row = await repo.getWithdrawalById(wid);
      if (!row) return ephemeralMessage("Saque nao encontrado.");
      if (row.status !== "processing") return ephemeralMessage(`Saque ja esta: ${row.status}`);
      await repo.setWithdrawalStatus({ id: wid, status: "completed", admin_note: null });
      return ephemeralMessage(`Saque #${wid} marcado como **concluido** (PIX enviado).`);
    }

    if (name === "saque_rejeitar") {
      const wid = getNum("saque_id");
      const motivo = getStr("motivo") || "Saque recusado.";
      if (!wid || !Number.isFinite(wid)) return ephemeralMessage("saque_id invalido.");
      const row = await repo.getWithdrawalById(wid);
      if (!row) return ephemeralMessage("Saque nao encontrado.");
      if (row.status !== "processing") return ephemeralMessage(`Saque ja esta: ${row.status}`);
      await repo.setWithdrawalStatus({
        id: wid,
        status: "rejected",
        admin_note: motivo || null,
      });
      return ephemeralMessage(`Saque #${wid} **rejeitado**. Saldo devolvido ao usuario.`);
    }

    return ephemeralMessage("Comando desconhecido.");
  } catch (e) {
    console.error("discord command error", e);
    return ephemeralMessage(`Erro: ${String(e.message || e)}`);
  }
}

async function discordInteractionHandler(req, res) {
  const signature = req.get("X-Signature-Ed25519");
  const timestamp = req.get("X-Signature-Timestamp");
  const publicKey = process.env.DISCORD_PUBLIC_KEY;

  if (!publicKey) {
    return res.status(503).send("DISCORD_PUBLIC_KEY nao configurado.");
  }
  if (!signature || !timestamp) {
    return res.status(401).send("Missing signature headers");
  }

  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(String(req.body || ""), "utf8");

  const ok = verifyKey(rawBody, signature, timestamp, publicKey);
  if (!ok) {
    return res.status(401).send("Invalid signature");
  }

  let body;
  try {
    body = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return res.status(400).send("Invalid JSON");
  }

  if (body.type === InteractionType.PING) {
    return jsonResponse(res, { type: InteractionResponseType.PONG });
  }

  if (body.type === InteractionType.APPLICATION_COMMAND) {
    const reply = await handleCommand(body);
    return jsonResponse(res, reply);
  }

  return jsonResponse(res, ephemeralMessage("Tipo de interacao nao suportado."));
}

module.exports = { discordInteractionHandler };
