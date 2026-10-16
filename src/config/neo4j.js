import dotenv from "dotenv";

dotenv.config();

export function getNeo4jConfig() {
  const uri = process.env.NEO4J_URI;
  const username = process.env.NEO4J_USERNAME;
  const password = process.env.NEO4J_PASSWORD;

  const missing = [
    ["NEO4J_URI", uri],
    ["NEO4J_USERNAME", username],
    ["NEO4J_PASSWORD", password]
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(`Missing Neo4j configuration: ${missing.join(", ")}.`);
  }

  return { uri, username, password };
}
