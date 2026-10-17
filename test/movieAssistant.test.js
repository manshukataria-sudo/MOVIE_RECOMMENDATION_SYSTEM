import assert from "node:assert/strict";
import { test } from "node:test";
import { createMovieAssistant } from "../src/services/movieAssistant.js";
import { createRecommendSimilarMoviesTool } from "../src/tools/recommendSimilarMovies.js";

function makeMatches() {
  return Array.from({ length: 12 }, (_, index) => ({
    id: `movie-${index}`,
    score: 0.99 - index * 0.01,
    metadata: {
      title: `Movie ${index}`,
      year: 2000 + index,
      genre: ["Sci-Fi"],
      director: `Director ${index}`,
      imdbRating: 8,
      actors: [`Actor ${index}`]
    }
  }));
}

test("title search finds the catalog vector and returns up to ten similar movies", async () => {
  const queries = [];
  const fetches = [];
  const embeddings = {
    async embedQuery(text) {
      assert.equal(text, "Interstellar");
      return [0.1, 0.2];
    }
  };
  const index = {
    async query(options) {
      queries.push(options);
      // The title-filtered lookup identifies the source; the next query returns neighbors.
      if (options.filter) {
        return {
          matches: [
            {
              id: "interstellar-id",
              metadata: { title: "Interstellar" }
            }
          ]
        };
      }

      return {
        matches: [
          {
            id: "interstellar-id",
            score: 1,
            metadata: { title: "Interstellar" }
          },
          ...makeMatches()
        ]
      };
    },
    async fetch(options) {
      fetches.push(options);
      return { records: { "interstellar-id": { values: [0.3, 0.4] } } };
    }
  };
  const movieTool = createRecommendSimilarMoviesTool({ embeddings, index });
  const response = JSON.parse(await movieTool.invoke({ title: "Interstellar" }));

  assert.equal(response.found, true);
  assert.equal(response.sourceTitle, "Interstellar");
  assert.equal(response.recommendations.length, 10);
  assert.ok(response.recommendations.every((movie) => movie.title !== "Interstellar"));
  assert.deepEqual(queries[0].filter, { title: { $eq: "Interstellar" } });
  assert.equal(queries[0].includeMetadata, true);
  assert.deepEqual(fetches, [{ ids: ["interstellar-id"] }]);
  assert.deepEqual(queries[1].vector, [0.3, 0.4]);
  assert.equal(queries[1].topK, 11);
});

test("description search embeds the description and returns ten results", async () => {
  const queryOptions = [];
  let embeddedText;
  const movieTool = createRecommendSimilarMoviesTool({
    embeddings: {
      async embedQuery(text) {
        embeddedText = text;
        return [0.5, 0.6];
      }
    },
    index: {
      async query(options) {
        queryOptions.push(options);
        return { matches: makeMatches() };
      }
    }
  });

  const response = JSON.parse(
    await movieTool.invoke({ description: "A thoughtful space exploration story" })
  );

  assert.equal(embeddedText, "A thoughtful space exploration story");
  assert.equal(response.recommendations.length, 10);
  assert.deepEqual(queryOptions, [
    { vector: [0.5, 0.6], topK: 10, includeMetadata: true }
  ]);
});

test("title that is absent from the catalog returns a not-found result", async () => {
  let fetchCalled = false;
  const movieTool = createRecommendSimilarMoviesTool({
    embeddings: {
      async embedQuery() {
        return [0.1];
      }
    },
    index: {
      async query() {
        return { matches: [] };
      },
      async fetch() {
        fetchCalled = true;
        return { records: {} };
      }
    }
  });

  const response = JSON.parse(await movieTool.invoke({ title: "Unknown Movie" }));

  assert.equal(response.found, false);
  assert.match(response.message, /Unknown Movie/);
  assert.equal(fetchCalled, false);
});

test("tool input requires either title or description", async () => {
  const movieTool = createRecommendSimilarMoviesTool({
    embeddings: {},
    index: {}
  });

  await assert.rejects(movieTool.invoke({}), /Provide either a movie title or a movie description/);
});

test("assistant executes the selected tool and sends its result back to the model", async () => {
  const modelInputs = [];
  const model = {
    async invoke(messages) {
      modelInputs.push(messages);

      if (modelInputs.length === 1) {
        return {
          content: "",
          tool_calls: [
            {
              id: "tool-call-1",
              name: "recommend_similar_movies",
              args: { description: "a space exploration movie" }
            }
          ]
        };
      }

      return {
        content: "Here are movies similar to that description.",
        tool_calls: []
      };
    }
  };
  const movieTool = createRecommendSimilarMoviesTool({
    embeddings: {
      async embedQuery() {
        return [0.5];
      }
    },
    index: {
      async query() {
        return {
          matches: [
            {
              id: "movie-1",
              score: 0.9,
              metadata: { title: "Example", year: 2020 }
            }
          ]
        };
      }
    }
  });
  const assistant = createMovieAssistant(model, [movieTool]);

  const response = await assistant.answerQuery("Find me a space exploration movie.");

  assert.deepEqual(response, {
    content: "Here are movies similar to that description.",
    toolNames: ["recommend_similar_movies"]
  });
  assert.equal(modelInputs.length, 2);

  const toolMessage = modelInputs[1].at(-1);
  assert.equal(toolMessage.name, "recommend_similar_movies");
  assert.equal(toolMessage.tool_call_id, "tool-call-1");
  assert.match(toolMessage.content, /Example/);
});

test("assistant returns a direct model response when no tool is selected", async () => {
  const assistant = createMovieAssistant(
    {
      async invoke() {
        return { content: "Which movie do you mean?", tool_calls: [] };
      }
    },
    []
  );

  const response = await assistant.answerQuery("Recommend similar movies.");

  assert.deepEqual(response, {
    content: "Which movie do you mean?",
    toolNames: []
  });
});
