import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { parseMoviesCsv } from "../src/data/movieCsvParser.js";

const fixturePath = fileURLToPath(new URL("./fixtures/movies.csv", import.meta.url));

// The fixture includes quoted commas and a missing optional numeric value.
test("parses and normalizes movie CSV records", async () => {
  const movies = await parseMoviesCsv(fixturePath);

  assert.deepEqual(movies, [
    {
      movieId: "movie-sample-2020",
      title: "Sample, Movie",
      year: 2020,
      director: "Jane Director",
      actors: ["Actor One", "Actor Two"],
      genre: ["Sci-Fi", "Drama"],
      themes: ["Space and exploration", "Friendship"],
      description: "A sample movie, with commas.",
      runtime: 120,
      imdbRating: 8.2,
      gross: null,
      metaScore: 75
    }
  ]);
});
