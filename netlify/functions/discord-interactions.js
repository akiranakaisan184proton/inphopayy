/**
 * Function dedicada ao Discord: nao carrega Express/serverless-http.
 * Corpo bruto do evento fica intacto para verificacao Ed25519 (PING e comandos).
 */
const { handleDiscordLambdaEvent } = require("../../backend/src/discordLambdaInteraction");

module.exports.handler = async (event) => {
  const method = String(event.httpMethod || event.requestContext?.http?.method || "GET").toUpperCase();
  if (method !== "POST") {
    return { statusCode: 405, headers: { "Content-Type": "text/plain; charset=utf-8" }, body: "Method Not Allowed" };
  }
  return await handleDiscordLambdaEvent(event);
};
