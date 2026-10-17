import { resolve } from "node:path";
import neo4j from "neo4j-driver";
import { getNeo4jConfig } from "../config/neo4j.js";
import { parseMoviesCsv } from "../data/movieCsvParser.js";
import { indexMoviesInNeo4j } from "../services/neo4jMovieIndexer.js";

const csvPath = resolve(process.argv[2] || "./src/data/movies.csv");
const movies = await parseMoviesCsv(csvPath);
const { uri, username, password } = getNeo4jConfig();
const driver = neo4j.driver(uri, neo4j.auth.basic(username, password));

try {
  await driver.verifyConnectivity();
  await indexMoviesInNeo4j(driver, movies);
  console.log(`Indexed ${movies.length} movies into Neo4j.`);
} finally {
  // Always release the driver, including when connectivity or indexing fails.
  await driver.close();
}