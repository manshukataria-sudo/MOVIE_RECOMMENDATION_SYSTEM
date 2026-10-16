# Movie Recommender

A movie recommendation project with a Node.js and Express backend, a reusable
movie CSV parser, and a standalone Neo4j graph indexing command. Query handling
and recommendation generation have not been implemented yet.

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

The parser and Neo4j indexer are not invoked automatically by the server.
Pinecone indexing is not implemented.

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

The server reads `PORT` and `NODE_ENV`. The Neo4j indexing script uses these
additional settings:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | Port used by the HTTP server. Must be an integer from 1 to 65535. |
| `NODE_ENV` | `development` | Environment name included in the startup log. |
| `NEO4J_URI` | — | Neo4j connection URI used by the indexing script. |
| `NEO4J_USERNAME` | — | Neo4j username used by the indexing script. |
| `NEO4J_PASSWORD` | — | Neo4j password used by the indexing script. |

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

By default this reads `movies.csv`. To use another CSV file:

```sh
npm run index:neo4j -- ./path/to/movies.csv
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
    neo4j.js             Neo4j connection configuration
  data/
    movieCsvParser.js    CSV reading and movie record normalization
  routes/
    health.js            Health-check route
  scripts/
    indexMoviesToNeo4j.js CSV-to-Neo4j indexing command
  services/
    neo4jMovieIndexer.js Graph constraints, nodes, and relationship writes
test/
  health.test.js         Health endpoint test
  movieCsvParser.test.js CSV parser test
  neo4jMovieIndexer.test.js Neo4j graph indexing behavior test
  fixtures/
    movies.csv           Small CSV fixture for parser tests
.env.example             Example local configuration
package.json             Dependencies and npm scripts
```

## Not implemented yet

- Pinecone vector index integration.
- Query interpretation, retrieval, ranking, or recommendation endpoints.
- React frontend.
