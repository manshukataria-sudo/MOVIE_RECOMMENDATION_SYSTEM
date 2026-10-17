import assert from "node:assert/strict";
import { test } from "node:test";
import { indexMovieVectors } from "../src/services/pineconeMovieIndexer.js";

function makeMovie(movieId) {
  return {
    movieId,
    title: "Example Movie",
    year: 2020,
    director: "Example Director",
    actors: ["Actor One", "Actor Two"],
    genre: ["Sci-Fi", "Drama"],
    themes: ["Space exploration"],
    description: "A story about space exploration.",
    runtime: 120,
    imdbRating: 8.1,
    gross: null,
    metaScore: 75
  };
}

test("embeds movie fields and upserts vectors using CSV IDs and metadata", async () => {
  let receivedTexts;
  let upsertRequest;
  const embeddings = {
    async embedDocuments(texts) {
      receivedTexts = texts;
      return [Array(768).fill(0.25)];
    }
  };
  const index = {
    async upsert(request) {
      upsertRequest = request;
    }
  };

  await indexMovieVectors({
    movies: [makeMovie("csv-movie-id")],
    embeddings,
    index
  });

  assert.match(receivedTexts[0], /Title: Example Movie/);
  assert.match(receivedTexts[0], /Actors: Actor One, Actor Two/);
  assert.match(receivedTexts[0], /Director: Example Director/);
  assert.match(receivedTexts[0], /Themes: Space exploration/);
  assert.match(receivedTexts[0], /Genres: Sci-Fi, Drama/);
  assert.match(receivedTexts[0], /Description: A story about space exploration\./);
  assert.deepEqual(upsertRequest.records, [
    {
      id: "csv-movie-id",
      values: Array(768).fill(0.25),
      metadata: {
        title: "Example Movie",
        genre: ["Sci-Fi", "Drama"],
        year: 2020,
        director: "Example Director",
        runtime: 120,
        imdbRating: 8.1,
        actors: ["Actor One", "Actor Two"],
        metascore: 75
      }
    }
  ]);
});

test("waits between embedding chunks and validates dimensions", async () => {
  const embeddingCalls = [];
  const upsertCalls = [];
  const pauses = [];
  const embeddings = {
    async embedDocuments(texts) {
      embeddingCalls.push(texts);
      return texts.map(() => Array(768).fill(0));
    }
  };
  const index = {
    async upsert(request) {
      upsertCalls.push(request.records);
    }
  };

  await indexMovieVectors({
    movies: [makeMovie("first"), makeMovie("second")],
    embeddings,
    index,
    batchSize: 1,
    delayMs: 60_000,
    async pause(milliseconds) {
      // Record the requested wait without delaying the test itself.
      pauses.push(milliseconds);
    }
  });

  assert.equal(embeddingCalls.length, 2);
  assert.equal(upsertCalls.length, 2);
  assert.deepEqual(pauses, [60_000]);
});

test("rejects embeddings with the wrong number of dimensions", async () => {
  const index = {
    async upsert() {
      assert.fail("Should not upsert an invalid embedding.");
    }
  };

  await assert.rejects(
    indexMovieVectors({
      movies: [makeMovie("bad-vector")],
      embeddings: {
        async embedDocuments() {
          return [Array(767).fill(0)];
        }
      },
      index
    }),
    /must contain 768 finite numbers/
  );
});
