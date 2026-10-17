import dotenv from "dotenv";

dotenv.config();

export function getGoogleLlmConfig() {
  const apiKey = process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    throw new Error("Missing Google configuration: GOOGLE_API_KEY.");
  }

  return {
    apiKey,
    // Chat model configuration is separate from the embedding model.
    model: process.env.GOOGLE_CHAT_MODEL || "gemini-2.5-flash"
  };
}
