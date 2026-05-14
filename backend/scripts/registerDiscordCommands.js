/**
 * Registra comandos slash de guild (aparecem rapido no servidor).
 *
 * Uso (na pasta backend, com .env carregado):
 *   node scripts/registerDiscordCommands.js
 *
 * Env: DISCORD_BOT_TOKEN, DISCORD_APPLICATION_ID, DISCORD_GUILD_ID
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const token = process.env.DISCORD_BOT_TOKEN;
const appId = process.env.DISCORD_APPLICATION_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !appId || !guildId) {
  console.error("Defina DISCORD_BOT_TOKEN, DISCORD_APPLICATION_ID e DISCORD_GUILD_ID no backend/.env");
  process.exit(1);
}

const commands = [
  {
    name: "conta_aprovar",
    description: "Aprovar cadastro InphoPay",
    options: [
      {
        type: 4,
        name: "usuario_id",
        description: "ID numerico do usuario (veja a notificacao no canal)",
        required: true,
      },
    ],
  },
  {
    name: "conta_reprovar",
    description: "Reprovar cadastro InphoPay",
    options: [
      {
        type: 4,
        name: "usuario_id",
        description: "ID numerico do usuario",
        required: true,
      },
      {
        type: 3,
        name: "motivo",
        description: "Motivo (opcional)",
        required: false,
      },
    ],
  },
  {
    name: "saque_concluir",
    description: "Marcar saque como pago (PIX feito)",
    options: [
      {
        type: 4,
        name: "saque_id",
        description: "ID do pedido de saque",
        required: true,
      },
    ],
  },
  {
    name: "saque_rejeitar",
    description: "Rejeitar saque e devolver saldo",
    options: [
      {
        type: 4,
        name: "saque_id",
        description: "ID do pedido de saque",
        required: true,
      },
      {
        type: 3,
        name: "motivo",
        description: "Motivo (opcional)",
        required: false,
      },
    ],
  },
];

async function main() {
  const url = `https://discord.com/api/v10/applications/${appId}/guilds/${guildId}/commands`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(res.status, text);
    process.exit(1);
  }
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : [];
  } catch {
    console.error("Resposta invalida:", text);
    process.exit(1);
  }
  console.log("Comandos registrados:", Array.isArray(parsed) ? parsed.length : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
