require("dotenv").config();

const serverless = require("serverless-http");
const { app } = require("../../backend/src/server");
const { handleDiscordLambdaEvent, shouldHandleDiscordInteractions } = require("../../backend/src/discordLambdaInteraction");

const handler = serverless(app, {
  request(request) {
    if (typeof request.url === "string") {
      request.url = request.url.replace(/^\/\.netlify\/functions\/api/, "") || "/";
      request.url = request.url.replace(/^\/api/, "") || "/";
    }
  },
});

module.exports.handler = async (event, context) => {
  if (event && shouldHandleDiscordInteractions(event)) {
    return handleDiscordLambdaEvent(event);
  }

  if (event && typeof event.path === "string") {
    event.path = event.path.replace(/^\/\.netlify\/functions\/api/, "").replace(/^\/api/, "") || "/";
  }

  return handler(event, context);
};
