import assert from "node:assert/strict";
import { test } from "node:test";
import { indexMoviesInNeo4j } from "../src/services/neo4jMovieIndexer.js";

test("creates graph constraints and movie relationships", async () => {
  // Capture driver calls so graph writes can be checked without a live Neo4j server.
  const statements = [];
  let sessionClosed = false;
  const session = {
    async run(query, parameters) {
      statements.push({ query, parameters });
    },
    async executeWrite(work) {
      return work({
        async run(query, parameters) {
          statements.push({ query, parameters });
        }
      });
    },
    async close() {
      sessionClosed = true;
    }
  };
  const driver = { session: () => session };
  const movies = [
    {
      movieId: "movie-1",
      title: "Example",
      year: 2020,
      runtime: 120,
      imdbRating: 8.1,
      gross: null,
      metaScore: 75,
      actors: ["Actor One", "Actor Two"],
      director: "Director One",
      genre: ["Sci-Fi"],
      themes: ["Space exploration"]
    }
  ];

  await indexMoviesInNeo4j(driver, movies);

  const constraints = statements.filter(({ query }) => query.startsWith("CREATE CONSTRAINT"));
  assert.equal(constraints.length, 5);
  assert.ok(constraints.some(({ query }) => query.includes("Movie")));
  assert.ok(constraints.some(({ query }) => query.includes("Actor")));
  assert.ok(constraints.some(({ query }) => query.includes("Director")));
  assert.ok(constraints.some(({ query }) => query.includes("Theme")));
  assert.ok(constraints.some(({ query }) => query.includes("Genre")));

  const movieWrite = statements.find(({ query }) => query.includes("MERGE (node:Movie"));
  assert.deepEqual(movieWrite.parameters.movies, [
    {
      movieId: "movie-1",
      title: "Example",
      year: 2020,
      runtime: 120,
      imdbRating: 8.1,
      gross: null,
      metaScore: 75
    }
  ]);

  assert.ok(statements.some(({ query }) => query.includes("[:ACTED_IN]")));
  assert.ok(statements.some(({ query }) => query.includes("[:DIRECTED]")));
  assert.ok(statements.some(({ query }) => query.includes("[:HAS_GENRE]")));
  assert.ok(statements.some(({ query }) => query.includes("[:EXPLORES_THEME]")));
  assert.equal(sessionClosed, true);
});
