import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { Pinecone } from "@pinecone-database/pinecone";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { getGoogleEmbeddingsConfig } from "../config/googleEmbeddings.js";
import { getGoogleLlmConfig } from "../config/googleLlm.js";
import { getPineconeConfig } from "../config/pinecone.js";
import { createMovieAssistant } from "../services/movieAssistant.js";
import { createRecommendSimilarMoviesTool } from "../tools/recommendSimilarMovies.js";

function formatResponse(content) {
  if (typeof content === "string") {
    return content;
  }

  return content
    .map((part) => (typeof part === "string" ? part : part.text || ""))
    .join("");
}

const config = getGoogleLlmConfig();
const googleEmbeddingsConfig = getGoogleEmbeddingsConfig();
const pineconeConfig = getPineconeConfig();
const pinecone = new Pinecone({ apiKey: pineconeConfig.apiKey });
const indexDescription = await pinecone.indexes.describe(
  pineconeConfig.indexName,
);

// The chat and indexing pipelines must use vectors with the same dimensions.
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
// Bind the configured retrieval dependencies into the tool before exposing it to the model.
const recommendSimilarMoviesTool = createRecommendSimilarMoviesTool({
  embeddings,
  index,
});

const model = new ChatGoogleGenerativeAI({
  apiKey: config.apiKey,
  model: config.model,
  temperature: 0.3,
}).bindTools([recommendSimilarMoviesTool]);

const assistant = createMovieAssistant(model, [recommendSimilarMoviesTool]);
const terminal = createInterface({ input: stdin, output: stdout });

console.log("Movie assistant ready. Enter a query, or type 'exit' to quit.");

try {
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
      console.error("Unable to process the query:", error.message);
    }
  }
} finally {
  terminal.close();
}
