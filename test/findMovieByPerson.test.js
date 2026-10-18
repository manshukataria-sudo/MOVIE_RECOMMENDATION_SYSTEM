import assert from "node:assert/strict";
import { test } from "node:test";
import { createFindMovieByPersonTool } from "../src/tools/findMovieByPerson.js";

function createDriver(records) {
  const calls = [];
  let closed = false;
  const driver = {
    session() {
      return {
        async executeRead(work) {
          return work({
            async run(query, parameters) {
              calls.push({ query, parameters });
              return { records };
            }
          });
        },
        async close() {
          closed = true;
        }
      };
    }
  };

  return { driver, calls, isClosed: () => closed };
}

function makeRecord(title, personTypes = ["actor"]) {
  const movie = {
    movieId: "movie-1",
    title,
    year: { toNumber: () => 2020 },
    director: "Example Director",
    runtime: { toNumber: () => 120 },
    imdbRating: 8.1,
    gross: 100,
    metascore: { toNumber: () => 75 }
  };

  return {
    get(key) {
      if (key === "movie") {
        return movie;
      }

      if (key === "personTypes") {
        return personTypes;
      }

      return undefined;
    }
  };
}

test("finds actor movies with a Cypher relationship query and a five-movie limit", async () => {
  const { driver, calls, isClosed } = createDriver([makeRecord("Example Movie")]);
  const movieTool = createFindMovieByPersonTool(driver);
  const response = JSON.parse(
    await movieTool.invoke({ person: "Example Actor", personType: "actor" })
  );

  assert.equal(response.found, true);
  assert.equal(response.movies[0].title, "Example Movie");
  assert.equal(response.movies[0].year, 2020);
  assert.equal(response.movies[0].runtime, 120);
  assert.match(calls[0].query, /\(person:Actor\)-\[:ACTED_IN\]->\(movie:Movie\)/);
  assert.deepEqual(calls[0].parameters, { person: "Example Actor", limit: 5 });
  assert.equal(isClosed(), true);
});

test("finds director movies with the directed relationship", async () => {
  const { driver, calls } = createDriver([makeRecord("Directed Movie", ["director"])]);
  const movieTool = createFindMovieByPersonTool(driver);

  await movieTool.invoke({ person: "Example Director", personType: "director" });

  assert.match(calls[0].query, /\(person:Director\)-\[:DIRECTED\]->\(movie:Movie\)/);
});

test("searches both actor and director relationships when person type is omitted", async () => {
  const { driver, calls } = createDriver([
    makeRecord("Example Movie", ["actor", "director"])
  ]);
  const movieTool = createFindMovieByPersonTool(driver);

  await movieTool.invoke({ person: "Jordan Lee" });

  assert.match(calls[0].query, /UNION ALL/);
  assert.match(calls[0].query, /:ACTED_IN/);
  assert.match(calls[0].query, /:DIRECTED/);
});

test("returns a not-found result and closes the session when no movie matches", async () => {
  const { driver, isClosed } = createDriver([]);
  const movieTool = createFindMovieByPersonTool(driver);
  const response = JSON.parse(await movieTool.invoke({ person: "Unknown Person" }));

  assert.equal(response.found, false);
  assert.match(response.message, /Unknown Person/);
  assert.match(response.message, /Apologize politely/);
  assert.equal(isClosed(), true);
});
