/**
 * Envia mensagens ao Discord (API REST) para canais configurados.
 * Requer DISCORD_BOT_TOKEN e IDs de canal (DISCORD_CHANNEL_REGISTRATIONS, DISCORD_CHANNEL_WITHDRAWALS).
 */

function isConfigured() {
  return Boolean(process.env.DISCORD_BOT_TOKEN);
}

async function postToChannel(channelId, payload) {
  if (!process.env.DISCORD_BOT_TOKEN || !channelId) return;
  const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.warn("Discord post falhou:", res.status, text);
  }
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

async function notifyNewRegistration(user) {
  const ch = process.env.DISCORD_CHANNEL_REGISTRATIONS;
  if (!isConfigured() || !ch) return;
  await postToChannel(ch, registrationEmbed(user));
}

async function notifyWithdrawalRequest(row, user) {
  const ch = process.env.DISCORD_CHANNEL_WITHDRAWALS;
  if (!isConfigured() || !ch) return;
  await postToChannel(ch, withdrawalEmbed(row, user));
}

module.exports = { isConfigured, notifyNewRegistration, notifyWithdrawalRequest };
