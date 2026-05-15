/**
 * Envia mensagens ao Discord (API REST) para canais configurados.
 * Requer DISCORD_BOT_TOKEN e IDs de canal (DISCORD_CHANNEL_REGISTRATIONS, DISCORD_CHANNEL_WITHDRAWALS).
 */

function isConfigured() {
  return Boolean(String(process.env.DISCORD_BOT_TOKEN || "").trim());
}

/**
 * @returns {Promise<{ ok: boolean, skipped?: boolean, code?: string }>}
 */
async function postToChannel(channelId, payload) {
  const token = String(process.env.DISCORD_BOT_TOKEN || "").trim();
  const id = String(channelId || "").trim().replace(/^["']|["']$/g, "");
  if (!token) {
    console.warn("Discord: DISCORD_BOT_TOKEN ausente ou vazio.");
    return { ok: false, skipped: true, code: "missing_bot_token" };
  }
  if (!id) {
    console.warn("Discord: ID do canal ausente.");
    return { ok: false, skipped: true, code: "missing_channel_id" };
  }
  const res = await fetch(`https://discord.com/api/v10/channels/${id}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.warn("Discord post falhou:", res.status, text.slice(0, 500));
    if (res.status === 403) return { ok: false, code: "forbidden" };
    if (res.status === 404) return { ok: false, code: "unknown_channel" };
    return { ok: false, code: `http_${res.status}` };
  }
  return { ok: true };
}

function registrationEmbed(user) {
  return {
    embeds: [
      {
        title: "Novo cadastro InphoPay",
        color: 0x7c3aed,
        fields: [
          { name: "ID usuario", value: String(user.id), inline: true },
          { name: "Usuario", value: String(user.username || "—"), inline: true },
          { name: "Nome", value: String(user.name || "—"), inline: true },
          { name: "Email", value: String(user.email || "—"), inline: false },
          {
            name: "Comandos",
            value:
              "`/conta_aprovar usuario_id:`" +
              user.id +
              " — ou — `/conta_reprovar usuario_id:`" +
              user.id +
              " motivo:...",
            inline: false,
          },
        ],
        footer: { text: "Status no site: em analise ate voce aprovar." },
      },
    ],
  };
}

function withdrawalEmbed(row, user) {
  return {
    embeds: [
      {
        title: "Pedido de saque",
        color: 0xf59e0b,
        fields: [
          { name: "ID saque", value: String(row.id), inline: true },
          { name: "ID usuario", value: String(row.user_id), inline: true },
          { name: "Usuario", value: String(user?.username || "—"), inline: true },
          { name: "Nome", value: String(user?.name || "—"), inline: true },
          { name: "Valor (centavos)", value: String(row.amount_cents), inline: true },
          { name: "Chave PIX", value: String(row.pix_key || "—"), inline: false },
          {
            name: "Comandos",
            value:
              "`/saque_concluir saque_id:`" +
              row.id +
              " — ou — `/saque_rejeitar saque_id:`" +
              row.id +
              " motivo:...",
            inline: false,
          },
        ],
        footer: { text: "Saldo ja foi reservado; conclua o PIX manualmente e marque como concluido." },
      },
    ],
  };
}

/** @returns {Promise<{ ok: boolean, skipped?: boolean, code?: string }>} */
async function notifyNewRegistration(user) {
  const ch = String(process.env.DISCORD_CHANNEL_REGISTRATIONS || "").trim();
  if (!isConfigured() || !ch) {
    if (!ch) console.warn("Discord: DISCORD_CHANNEL_REGISTRATIONS nao definido.");
    return { ok: false, skipped: true, code: !isConfigured() ? "missing_bot_token" : "missing_channel_id" };
  }
  return postToChannel(ch, registrationEmbed(user));
}

/** @returns {Promise<{ ok: boolean, skipped?: boolean, code?: string }>} */
async function notifyWithdrawalRequest(row, user) {
  const ch = String(process.env.DISCORD_CHANNEL_WITHDRAWALS || "").trim();
  if (!isConfigured() || !ch) {
    if (!ch) console.warn("Discord: DISCORD_CHANNEL_WITHDRAWALS nao definido.");
    return { ok: false, skipped: true, code: !isConfigured() ? "missing_bot_token" : "missing_channel_id" };
  }
  return postToChannel(ch, withdrawalEmbed(row, user));
}

/** Texto curto para o usuario (sem segredos). */
function hintForRegistrationDiscord(code) {
  switch (code) {
    case "missing_bot_token":
      return "Aviso no Discord nao enviado: configure DISCORD_BOT_TOKEN na Netlify (escopo Functions).";
    case "missing_channel_id":
      return "Aviso no Discord nao enviado: configure DISCORD_CHANNEL_REGISTRATIONS com o ID do canal de texto (Modo desenvolvedor > copiar ID).";
    case "forbidden":
      return "Aviso no Discord nao enviado: o bot nao pode postar nesse canal (adicione-o ao servidor, cargo com Ver canal + Enviar mensagens).";
    case "unknown_channel":
      return "Aviso no Discord nao enviado: ID do canal invalido ou o bot nao esta nesse servidor.";
    default:
      if (String(code || "").startsWith("http_")) {
        return "Aviso no Discord nao enviado: erro da API do Discord (veja logs da function na Netlify).";
      }
      return "Aviso no Discord nao enviado (veja logs na Netlify).";
  }
}

function hintForWithdrawalDiscord(code) {
  switch (code) {
    case "missing_bot_token":
      return "Aviso de saque no Discord nao enviado: DISCORD_BOT_TOKEN na Netlify.";
    case "missing_channel_id":
      return "Aviso de saque no Discord nao enviado: DISCORD_CHANNEL_WITHDRAWALS (ID do canal).";
    case "forbidden":
      return "Aviso de saque no Discord nao enviado: sem permissao no canal de saques.";
    case "unknown_channel":
      return "Aviso de saque no Discord nao enviado: canal invalido ou bot fora do servidor.";
    default:
      if (String(code || "").startsWith("http_")) {
        return "Aviso de saque no Discord nao enviado (API Discord).";
      }
      return "Aviso de saque no Discord nao enviado.";
  }
}

module.exports = {
  isConfigured,
  notifyNewRegistration,
  notifyWithdrawalRequest,
  hintForRegistrationDiscord,
  hintForWithdrawalDiscord,
};
