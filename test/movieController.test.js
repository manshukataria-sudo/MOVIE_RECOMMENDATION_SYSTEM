import assert from "node:assert/strict";
import { test } from "node:test";
import { createMovieController } from "../src/controller/movieController.js";

function createResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

test("controller sends a valid query to the assistant and returns its result", async () => {
  let receivedQuery;
  const controller = createMovieController(async (query) => {
    receivedQuery = query;
    return { answer: "Here are some movies.", tools: [] };
  });
  const response = createResponse();

  await controller({ body: { query: "  Recommend movies  " } }, response);

  assert.equal(receivedQuery, "Recommend movies");
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    answer: "Here are some movies.",
    tools: []
  });
});

test("controller rejects a missing or empty query", async () => {
  let agentCalled = false;
  const controller = createMovieController(async () => {
    agentCalled = true;
  });
  const response = createResponse();

  await controller({ body: { query: "  " } }, response);

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.body, {
    error: "Please provide a non-empty query."
  });
  assert.equal(agentCalled, false);
});

test("controller returns an error response when the assistant fails", async () => {
  const controller = createMovieController(async () => {
    throw new Error("Provider is unavailable.");
  });
  const response = createResponse();

  await controller({ body: { query: "Recommend a movie" } }, response);

  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.body, {
    error: "Unable to process the movie query right now."
  });
});