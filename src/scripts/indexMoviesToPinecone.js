import { resolve } from "node:path";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { Pinecone } from "@pinecone-database/pinecone";
import { getGoogleEmbeddingsConfig } from "../config/googleEmbeddings.js";
import { getPineconeConfig } from "../config/pinecone.js";
import { parseMoviesCsv } from "../data/movieCsvParser.js";
import {
  delayBetweenBatchesMs,
  embeddingDimensions,
  indexMovieVectors,
  movieBatchSize
} from "../services/pineconeMovieIndexer.js";

// Read the full catalog before making remote embedding or vector calls.
const csvPath = resolve(process.argv[2] || "./src/data/movies.csv");
const movies = await parseMoviesCsv(csvPath);

const googleConfig = getGoogleEmbeddingsConfig();
const pineconeConfig = getPineconeConfig();

const pinecone = new Pinecone({ apiKey: pineconeConfig.apiKey });

const indexDescription = await pinecone.indexes.describe(pineconeConfig.indexName);

// Reject incompatible indexes before spending on embedding requests.
if (!indexDescription.status.ready) {
  throw new Error(`Pinecone index "${pineconeConfig.indexName}" is not ready.`);
}

if (indexDescription.dimension !== embeddingDimensions) {
  throw new Error(
    `Pinecone index "${pineconeConfig.indexName}" must have ${embeddingDimensions} dimensions; found ${indexDescription.dimension}.`
  );
}

// Embeddings are generated later by indexMovieVectors in bounded batches.
const embeddings = new GoogleGenerativeAIEmbeddings({
  apiKey: googleConfig.apiKey,
  model: googleConfig.model,
  outputDimensionality: googleConfig.dimensions,
  taskType: "RETRIEVAL_DOCUMENT"
});

const index = pinecone.index({ name: pineconeConfig.indexName });

console.log(
  `Indexing ${movies.length} movies in batches of ${movieBatchSize}; waiting ${delayBetweenBatchesMs / 1000} seconds between embedding batches.`
);

// The service pauses between batches to reduce provider rate-limit pressure.
await indexMovieVectors({ movies, embeddings, index });
