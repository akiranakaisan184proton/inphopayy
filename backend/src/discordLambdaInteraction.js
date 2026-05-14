/**
 * Tratamento de POST /discord/interactions na Netlify/AWS sem passar pelo serverless-http,
 * para preservar o corpo bruto exigido pela verificação Ed25519 do Discord.
 */
require("dotenv").config();
const { verifyKey } = require("discord-interactions");

const InteractionType = { PING: 1, APPLICATION_COMMAND: 2 };
const InteractionResponseType = { PONG: 1, CHANNEL_MESSAGE_WITH_SOURCE: 4 };

function ephemeralMessage(content) {
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content, flags: 64 },
  };
}

function lowerHeaders(headers, multiValueHeaders) {
  const out = {};
  if (multiValueHeaders) {
    for (const [k, arr] of Object.entries(multiValueHeaders)) {
      if (arr && arr.length) out[String(k).toLowerCase()] = String(arr[arr.length - 1]);
    }
  }
  if (headers) {
    for (const [k, v] of Object.entries(headers)) {
      const key = String(k).toLowerCase();
      if (out[key] != null) continue;
      const val = Array.isArray(v) ? v[v.length - 1] : v;
      if (val != null) out[key] = String(val);
    }
  }
  return out;
}

function getRawBodyBuffer(event) {
  if (event.body == null || event.body === "") return Buffer.alloc(0);
  if (Buffer.isBuffer(event.body)) return event.body;
  if (typeof event.body === "string") {
    return event.isBase64Encoded ? Buffer.from(event.body, "base64") : Buffer.from(event.body, "utf8");
  }
  return null;
}

function jsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: typeof payload === "string" ? payload : JSON.stringify(payload),
  };
}

async function handleDiscordLambdaEvent(event) {
  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  if (!publicKey) {
    return { statusCode: 503, headers: { "Content-Type": "text/plain; charset=utf-8" }, body: "DISCORD_PUBLIC_KEY nao configurado." };
  }

  const headers = lowerHeaders(event.headers, event.multiValueHeaders);
  const signature = headers["x-signature-ed25519"];
  const timestamp = headers["x-signature-timestamp"];
  if (!signature || !timestamp) {
    return { statusCode: 401, headers: { "Content-Type": "text/plain; charset=utf-8" }, body: "Missing signature headers" };
  }

  const rawBody = getRawBodyBuffer(event);
  if (rawBody === null) {
    return { statusCode: 401, headers: { "Content-Type": "text/plain; charset=utf-8" }, body: "Invalid body encoding" };
  }

  let ok;
  try {
    ok = verifyKey(rawBody, signature, timestamp, publicKey);
  } catch {
    ok = false;
  }
  if (!ok) {
    return { statusCode: 401, headers: { "Content-Type": "text/plain; charset=utf-8" }, body: "Invalid signature" };
  }

  let body;
  try {
    body = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return jsonResponse(400, { error: "Invalid JSON" });
  }

  if (body.type === InteractionType.PING) {
    return jsonResponse(200, { type: InteractionResponseType.PONG });
  }

  if (body.type === InteractionType.APPLICATION_COMMAND) {
    const { handleDiscordApplicationCommand } = require("./discordInteractions");
    const reply = await handleDiscordApplicationCommand(body);
    return jsonResponse(200, reply);
  }

  return jsonResponse(200, ephemeralMessage("Tipo de interacao nao suportado."));
}

function normalizeNetlifyPath(event) {
  let p =
    event.path ||
    event.rawPath ||
    event.requestContext?.http?.path ||
    (event.pathParameters?.proxy ? `/${event.pathParameters.proxy}` : "") ||
    "/";
  p = String(p).split("?")[0];
  p = p.replace(/^\/\.netlify\/functions\/api/, "");
  p = p.replace(/^\/api/, "");
  if (!p.startsWith("/")) p = `/${p}`;
  return p === "" ? "/" : p;
}

function netlifyHttpMethod(event) {
  return String(
    event.httpMethod || event.requestContext?.http?.method || event.requestContext?.requestMethod || "GET",
  ).toUpperCase();
}

function shouldHandleDiscordInteractions(event) {
  return normalizeNetlifyPath(event) === "/discord/interactions" && netlifyHttpMethod(event) === "POST";
}

module.exports = { handleDiscordLambdaEvent, normalizeNetlifyPath, netlifyHttpMethod, shouldHandleDiscordInteractions };
