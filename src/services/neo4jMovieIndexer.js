const batchSize = 100;

// Stable identifiers keep this import safe to rerun without duplicate nodes.
const constraints = [
  "CREATE CONSTRAINT movie_movieId_unique IF NOT EXISTS FOR (node:Movie) REQUIRE node.movieId IS UNIQUE",
  "CREATE CONSTRAINT actor_name_unique IF NOT EXISTS FOR (node:Actor) REQUIRE node.name IS UNIQUE",
  "CREATE CONSTRAINT director_name_unique IF NOT EXISTS FOR (node:Director) REQUIRE node.name IS UNIQUE",
  "CREATE CONSTRAINT theme_name_unique IF NOT EXISTS FOR (node:Theme) REQUIRE node.name IS UNIQUE",
  "CREATE CONSTRAINT genre_name_unique IF NOT EXISTS FOR (node:Genre) REQUIRE node.name IS UNIQUE"
];

const queries = {
  movies: `
    UNWIND $movies AS movie
    MERGE (node:Movie {movieId: movie.movieId})
    SET node.title = movie.title,
        node.year = movie.year,
        node.runtime = movie.runtime,
        node.imdbRating = movie.imdbRating,
        node.gross = movie.gross,
        node.metascore = movie.metaScore
  `,
  actors: `
    UNWIND $items AS item
    MATCH (movie:Movie {movieId: item.movieId})
    MERGE (actor:Actor {name: item.name})
    MERGE (actor)-[:ACTED_IN]->(movie)
  `,
  directors: `
    UNWIND $items AS item
    MATCH (movie:Movie {movieId: item.movieId})
    MERGE (director:Director {name: item.name})
    MERGE (director)-[:DIRECTED]->(movie)
  `,
  genres: `
    UNWIND $items AS item
    MATCH (movie:Movie {movieId: item.movieId})
    MERGE (genre:Genre {name: item.name})
    MERGE (movie)-[:HAS_GENRE]->(genre)
  `,
  themes: `
    UNWIND $items AS item
    MATCH (movie:Movie {movieId: item.movieId})
    MERGE (theme:Theme {name: item.name})
    MERGE (movie)-[:EXPLORES_THEME]->(theme)
  `
};

function makeRelationItems(movies, propertyName) {
  return movies.flatMap((movie) =>
    movie[propertyName]
      .filter((name) => name.length > 0)
      .map((name) => ({ movieId: movie.movieId, name }))
  );
}

function makeDirectorItems(movies) {
  return movies
    .filter((movie) => movie.director.length > 0)
    .map((movie) => ({ movieId: movie.movieId, name: movie.director }));
}

async function writeBatch(transaction, movies) {
  const movieRows = movies.map((movie) => ({
    movieId: movie.movieId,
    title: movie.title,
    year: movie.year,
    runtime: movie.runtime,
    imdbRating: movie.imdbRating,
    gross: movie.gross,
    metaScore: movie.metaScore
  }));

  await transaction.run(queries.movies, { movies: movieRows });

  // Build each relationship family separately so every query uses one stable shape.
  const relationSets = [
    ["actors", makeRelationItems(movies, "actors")],
    ["directors", makeDirectorItems(movies)],
    ["genres", makeRelationItems(movies, "genre")],
    ["themes", makeRelationItems(movies, "themes")]
  ];

  for (const [relationType, items] of relationSets) {
    if (items.length > 0) {
      await transaction.run(queries[relationType], { items });
    }
  }
}

// movies array received from parseMoviesCsv, driver is a neo4j driver instance
export async function indexMoviesInNeo4j(driver, movies) {
  const session = driver.session();

  try {
    // Constraints are idempotent and must exist before MERGE relies on uniqueness.
    for (const constraint of constraints) {
      await session.run(constraint);
    }

    for (let start = 0; start < movies.length; start += batchSize) {
      const batch = movies.slice(start, start + batchSize);
      // Each batch is transactional so its nodes and relationships stay consistent.
      await session.executeWrite((transaction) => writeBatch(transaction, batch));
    }
  } finally {
    await session.close();
  }
}
