import dotenv from "dotenv";

dotenv.config();

export function getGoogleEmbeddingsConfig() {
  const apiKey = process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    throw new Error("Missing Google configuration: GOOGLE_API_KEY.");
  }

  return {
    apiKey,
    model: "gemini-embedding-001",
    // This must match the configured Pinecone index dimension.
    dimensions: 768
  };
}