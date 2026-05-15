/**
 * Registra comandos slash no Discord (guild = rapido; global = sem DISCORD_GUILD_ID, pode demorar ~1h).
 *
 * Uso (na pasta backend, com .env):
 *   node scripts/registerDiscordCommands.js
 *
 * Env: DISCORD_BOT_TOKEN, DISCORD_APPLICATION_ID
 * Opcional: DISCORD_GUILD_ID — se definido, registra so nesse servidor.
 */
const path = require("path");
const backendEnv = path.join(__dirname, "..", ".env");
const rootEnv = path.join(__dirname, "..", "..", ".env");
require("dotenv").config({ path: backendEnv });
require("dotenv").config({ path: rootEnv });

const token = String(process.env.DISCORD_BOT_TOKEN || "").trim();
const appId = String(process.env.DISCORD_APPLICATION_ID || "").trim();
const guildId = String(process.env.DISCORD_GUILD_ID || "").trim();

const missing = [];
if (!token) missing.push("DISCORD_BOT_TOKEN");
if (!appId) missing.push("DISCORD_APPLICATION_ID");
if (missing.length) {
  console.error("Faltam variaveis (vazias ou ausentes):", missing.join(", "));
  console.error("Coloque em backend/.env (ou na raiz do projeto em .env) os mesmos valores da Netlify, depois:");
  console.error("  cd backend && npm run register-discord");
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
  const url = guildId
    ? `https://discord.com/api/v10/applications/${appId}/guilds/${guildId}/commands`
    : `https://discord.com/api/v10/applications/${appId}/commands`;

  if (!guildId) {
    console.warn(
      "DISCORD_GUILD_ID vazio: registrando comandos GLOBAIS (podem demorar ate ~1h para aparecer em todos os servidores).",
    );
  }

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
