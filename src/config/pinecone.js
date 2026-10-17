import dotenv from "dotenv";

dotenv.config();

// Keep Pinecone credentials out of the indexing and retrieval logic.
export function getPineconeConfig() {
  const apiKey = process.env.PINECONE_API_KEY;
  const indexName = process.env.PINECONE_INDEX_NAME;

  const missing = [
    ["PINECONE_API_KEY", apiKey],
    ["PINECONE_INDEX_NAME", indexName]
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(`Missing Pinecone configuration: ${missing.join(", ")}.`);
  }

  return { apiKey, indexName };
}
