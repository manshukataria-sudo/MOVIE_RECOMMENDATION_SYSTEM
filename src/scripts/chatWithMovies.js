import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import neo4j from "neo4j-driver";
import { Pinecone } from "@pinecone-database/pinecone";
import { getGoogleEmbeddingsConfig } from "../config/googleEmbeddings.js";
import { getGoogleLlmConfig } from "../config/googleLlm.js";
import { getNeo4jConfig } from "../config/neo4j.js";
import { getPineconeConfig } from "../config/pinecone.js";
import { createMovieAssistant } from "../services/movieAssistant.js";
import { createFindMovieByPersonTool } from "../tools/findMovieByPerson.js";
import { createRecommendSimilarMoviesTool } from "../tools/recommendSimilarMovies.js";

let assistantPromise;

async function createAssistant() {
  const googleChatConfig = getGoogleLlmConfig();
  const googleEmbeddingsConfig = getGoogleEmbeddingsConfig();
  const pineconeConfig = getPineconeConfig();
  const neo4jConfig = getNeo4jConfig();
  const neo4jDriver = neo4j.driver(
    neo4jConfig.uri,
    neo4j.auth.basic(neo4jConfig.username, neo4jConfig.password),
  );

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

    return createMovieAssistant(model, movieTools);
  } catch (error) {
    await neo4jDriver.close();
    throw error;
  }
}

// this is **IMPORTANT** promise caching or single flight initialization
async function getAssistant() {
  if (!assistantPromise) {
    assistantPromise = createAssistant();    
    // here saved the unresolved promise, so that if multiple requests come in at the same time, 
    // they will all wait for the same promise to resolve instead of creating multiple instances of the assistant.
  }

  try {
    return await assistantPromise;
  } catch (error) {
    // Let a later request retry, if first-time provider setup failed.
    // we cannot use the half initialized assistant, to fetch the query
    // so, it restarts the initialization process for the next request
    assistantPromise = undefined;
    throw error;
  }
}

// Reuse the same configured model and database connections for each request.
// i.e why initialised once and reused for each request. 
// This avoids the overhead of reinitializing the model and database connections for every request,
// which can be time-consuming and resource-intensive. 
// By reusing the same instances, we can improve performance and reduce latency for subsequent requests.
export async function runAgent(query) {
  const assistant = await getAssistant();
  const result = await assistant.answerQuery(query);

  return {
    answer: result.content,
    tools: result.toolNames
  };
}