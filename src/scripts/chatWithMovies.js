import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import neo4j from "neo4j-driver";
import { Pinecone } from "@pinecone-database/pinecone";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { getGoogleEmbeddingsConfig } from "../config/googleEmbeddings.js";
import { getGoogleLlmConfig } from "../config/googleLlm.js";
import { getNeo4jConfig } from "../config/neo4j.js";
import { getPineconeConfig } from "../config/pinecone.js";
import { createMovieAssistant } from "../services/movieAssistant.js";
import { createFindMovieByPersonTool } from "../tools/findMovieByPerson.js";
import { createRecommendSimilarMoviesTool } from "../tools/recommendSimilarMovies.js";

function formatResponse(content) {
  if (typeof content === "string") {
    return content;
  }

  return content
    .map((part) => (typeof part === "string" ? part : part.text || ""))
    .join("");
}

async function runChat() {
  const googleChatConfig = getGoogleLlmConfig();
  const googleEmbeddingsConfig = getGoogleEmbeddingsConfig();
  const pineconeConfig = getPineconeConfig();
  const neo4jConfig = getNeo4jConfig();
  const neo4jDriver = neo4j.driver(
    neo4jConfig.uri,
    neo4j.auth.basic(neo4jConfig.username, neo4jConfig.password),
  );
  let terminal;

  try {
    await neo4jDriver.verifyConnectivity();

    const pinecone = new Pinecone({ apiKey: pineconeConfig.apiKey });
    const indexDescription = await pinecone.indexes.describe(
      pineconeConfig.indexName,
    );

    // Both query embeddings and the Pinecone index must use the same dimensions.
    if (!indexDescription.status.ready) {
      throw new Error(`Pinecone index "${pineconeConfig.indexName}" is not ready.`);
    }

    if (indexDescription.dimension !== googleEmbeddingsConfig.dimensions) {
      throw new Error(
        `Pinecone index "${pineconeConfig.indexName}" must have ${googleEmbeddingsConfig.dimensions} dimensions; found ${indexDescription.dimension}.`,
      );
    }

    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: googleEmbeddingsConfig.apiKey,
      model: googleEmbeddingsConfig.model,
      outputDimensionality: googleEmbeddingsConfig.dimensions,
      taskType: "RETRIEVAL_QUERY",
    });
    const index = pinecone.index({ name: pineconeConfig.indexName });

    const movieTools = [
      createRecommendSimilarMoviesTool({ embeddings, index }),
      createFindMovieByPersonTool(neo4jDriver),
    ];
    const model = new ChatGoogleGenerativeAI({
      apiKey: googleChatConfig.apiKey,
      model: googleChatConfig.model,
      temperature: 0.3,
    }).bindTools(movieTools);
    const assistant = createMovieAssistant(model, movieTools);

    terminal = createInterface({ input: stdin, output: stdout });
    console.log("Movie assistant ready. Enter a query, or type 'exit' to quit.");

    while (true) {
      const query = (await terminal.question("You: ")).trim();

      if (query.toLowerCase() === "exit" || query.toLowerCase() === "quit") {
        break;
      }

      if (!query) {
        continue;
      }

      try {
        const response = await assistant.answerQuery(query);

        for (const toolName of response.toolNames) {
          console.log(`Selected tool: ${toolName}`);
        }

        console.log(`Assistant: ${formatResponse(response.content)}`);
      } catch (error) {
        console.error("Unable to process the query:", error);
      }
    }
  } finally {
    if (terminal) {
      terminal.close();
    }

    // Release Neo4j connections even when setup or a query fails.
    await neo4jDriver.close();
  }
}

await runChat();
