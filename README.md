# Movie Recommender

A movie recommendation project with a Node.js and Express backend, a reusable
movie CSV parser, and a standalone Neo4j graph indexing command. Query handling
and recommendation generation have not been implemented yet. A separate
Pinecone indexing command creates movie embeddings from the catalog.

## Current functionality

- Express server using JavaScript ES modules.
- Environment variable loading with `dotenv`.
- `GET /health` endpoint, which responds with:

  ```json
  { "status": "ok" }
  ```

- Automated health endpoint test using Node.js's built-in test runner.
- A reusable CSV parser that reads and normalizes movie records.
- A standalone Neo4j indexing script for the movie CSV catalog.
- A standalone Pinecone indexing script using Google Generative AI embeddings.

These indexing scripts are not invoked automatically by the server.

## Requirements

- Node.js with ES module support.
- Node.js 22 or later for the Pinecone SDK.
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

The server reads `PORT` and `NODE_ENV`. Indexing scripts use their respective
database and provider settings:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | Port used by the HTTP server. Must be an integer from 1 to 65535. |
| `NODE_ENV` | `development` | Environment name included in the startup log. |
| `NEO4J_URI` | — | Neo4j connection URI used by the indexing script. |
| `NEO4J_USERNAME` | — | Neo4j username used by the indexing script. |
| `NEO4J_PASSWORD` | — | Neo4j password used by the indexing script. |
| `GOOGLE_API_KEY` | — | Google Generative AI key used to create embeddings. |
| `PINECONE_API_KEY` | — | Pinecone API key used by the vector indexing script. |
| `PINECONE_INDEX_NAME` | — | Name of an existing Pinecone index with 768 dimensions. |

`.env` is ignored by Git. Do not put secrets in committed files.

## Movie CSV parser

`parseMoviesCsv(filePath)` in `src/data/movieCsvParser.js` reads a CSV file and
returns an array of normalized movie records. Actors, genres, and themes are
returned as arrays; numeric fields are converted to numbers, and missing
`gross` or `meta score` values become `null`. The parser checks that all
expected CSV columns are present and reports invalid numeric values with their
row number.

The parser does not connect to or write to a database. It is used by the
Neo4j indexing script and can also be reused by future indexing tools:

```js
import { parseMoviesCsv } from "./src/data/movieCsvParser.js";

const movies = await parseMoviesCsv("./movies.csv");
```

## Neo4j graph indexing

The `index:neo4j` script reads the CSV and creates or updates graph data. It
uses `movieId` and entity names as stable identities and creates uniqueness
constraints for `Movie.movieId` and the `name` property on `Actor`, `Director`,
`Theme`, and `Genre`. Re-running the script merges nodes and relationships
instead of creating duplicates. Movies are written in batches of 100.

Relationships created:

- `(:Actor)-[:ACTED_IN]->(:Movie)`
- `(:Director)-[:DIRECTED]->(:Movie)`
- `(:Movie)-[:HAS_GENRE]->(:Genre)`
- `(:Movie)-[:EXPLORES_THEME]->(:Theme)`

Movie nodes store `movieId`, `title`, `year`, `runtime`, `imdbRating`,
`gross`, and `metascore`. Missing optional `gross` and `meta score` values
are not stored as Neo4j properties. The CSV `description` field is currently
not stored in the graph.

Configure `NEO4J_URI`, `NEO4J_USERNAME`, and `NEO4J_PASSWORD` in `.env`, then
run from the project root:

```sh
npm run index:neo4j
```

By default this reads `src/data/movies.csv`. To use another CSV file:

```sh
npm run index:neo4j -- ./path/to/movies.csv
```

## Pinecone vector indexing

Create a Pinecone index in advance with a dimension of **768**, then set
`GOOGLE_API_KEY`, `PINECONE_API_KEY`, and `PINECONE_INDEX_NAME` in `.env`. The
script checks that the configured index exists, is ready, and has the expected
dimension before writing vectors.

Run from the project root:

```sh
npm run index:pinecone
```

By default the script reads `src/data/movies.csv`. Pass an optional CSV path
to index another file:

```sh
npm run index:pinecone -- ./path/to/movies.csv
```

For each movie, the script embeds its title, actors, director, themes, genres,
and description using LangChain's `GoogleGenerativeAIEmbeddings` with
`gemini-embedding-001` and a 768-dimensional output. It upserts the result using
the CSV `movieId` as the Pinecone vector ID (common in both Neo4j as well Pinecone). 
Metadata contains `title`,`genre`, `year`, `director`, `runtime`, `imdbRating`, `gross`,
`metascore` and `actors`; missing optional values and empty lists are omitted.

Movies are embedded in batches of 50. After each batch is embedded and
upserted, the script waits 60 seconds before requesting embeddings for the
next batch. It does not wait after the final batch. Re-running the script
upserts the same IDs, replacing those vectors and their metadata.

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
    googleEmbeddings.js  Google embedding configuration
    neo4j.js             Neo4j connection configuration
    pinecone.js          Pinecone connection configuration
  data/
    movieCsvParser.js    CSV reading and movie record normalization
  routes/
    health.js            Health-check route
  scripts/
    indexMoviesToNeo4j.js CSV-to-Neo4j indexing command
    indexMoviesToPinecone.js CSV-to-Pinecone indexing command
  services/
    neo4jMovieIndexer.js Graph constraints, nodes, and relationship writes
    pineconeMovieIndexer.js Movie embedding and vector upsert batches
test/
  health.test.js         Health endpoint test
  movieCsvParser.test.js CSV parser test
  neo4jMovieIndexer.test.js Neo4j graph indexing behavior test
  pineconeMovieIndexer.test.js Pinecone vector indexing behavior test
  fixtures/
    movies.csv           Small CSV fixture for parser tests
.env.example             Example local configuration
package.json             Dependencies and npm scripts
```

## Not implemented yet

- Query interpretation, retrieval, ranking, or recommendation endpoints.
- React frontend.
