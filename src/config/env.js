import dotenv from "dotenv";

dotenv.config();

const port = Number(process.env.PORT || 3000);

// Fail at startup rather than allowing an invalid port to break server binding.
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port
};
