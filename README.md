# Movie Recommender

A movie recommendation project. The current implementation is the Node.js and
Express backend foundation. The recommendation engine and indexing pipeline
have not been implemented yet.

## Current functionality

- Express server using JavaScript ES modules.
- Environment variable loading with `dotenv`.
- `GET /health` endpoint, which responds with:

  ```json
  { "status": "ok" }
  ```

- Automated health endpoint test using Node.js's built-in test runner.
- A reusable CSV parser that reads and normalizes movie records.

The CSV parser is a utility and is not invoked automatically by the server.
It does not write data to Pinecone or Neo4j.

## Requirements

- Node.js with ES module support.
- npm.

## Setup

Install the project dependencies:

```sh
npm install
```

Create a local `.env` file from the example:

```sh
cp .env.example .env
```

The server reads these settings:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | Port used by the HTTP server. Must be an integer from 1 to 65535. |
| `NODE_ENV` | `development` | Environment name included in the startup log. |

`.env` is ignored by Git. Do not put secrets in committed files.

## Movie CSV parser

`parseMoviesCsv(filePath)` in `src/data/movieCsvParser.js` reads a CSV file and
returns an array of normalized movie records. Actors, genres, and themes are
returned as arrays; numeric fields are converted to numbers, and missing
`gross` or `meta score` values become `null`. The parser checks that all
expected CSV columns are present and reports invalid numeric values with their
row number.

The parser does not connect to or write to a database. For example, it can be
called from a future indexing script:

```js
import { parseMoviesCsv } from "./src/data/movieCsvParser.js";

const movies = await parseMoviesCsv("./movies_1000.csv");
```

## Run

Start the server:

```sh
npm start
```

Start in watch mode during development:

```sh
npm run dev
```

Check the health endpoint:

```sh
curl http://localhost:3000/health
```

## Tests

Run the automated tests:

```sh
npm test
```

## Project structure

```text
src/
  app.js                 Express application and middleware setup
  server.js              HTTP server startup
  config/
    env.js               Environment variable loading and validation
  data/
    movieCsvParser.js    CSV reading and movie record normalization
  routes/
    health.js            Health-check route
test/
  health.test.js         Health endpoint test
  movieCsvParser.test.js CSV parser test
  fixtures/
    movies.csv           Small CSV fixture for parser tests
.env.example             Example local configuration
package.json             Dependencies and npm scripts
```

## Not implemented yet

- Movie data ingestion or indexing into databases.
- Pinecone vector index integration.
- Neo4j graph database integration.
- Query interpretation, retrieval, ranking, or recommendation endpoints.
- React frontend.
