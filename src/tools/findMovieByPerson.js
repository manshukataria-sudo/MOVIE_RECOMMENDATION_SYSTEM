import { tool } from "@langchain/core/tools";
import { z } from "zod";

// In Neo4j, person's name is stored in the "name" property of the Actor or Director node. 
// The queries below are case-insensitive and will match the person's name regardless of capitalization. 
// The queries return up to five movies, ordered by IMDb rating (highest first) and then by title (alphabetically). 
// Each movie includes its ID, title, year, director, IMDb rating, and the type(s) of person associated with it (actor or director).
const findByActorQuery = `
  MATCH (person:Actor)-[:ACTED_IN]->(movie:Movie)
  WHERE toLower(person.name) = toLower($person)
  RETURN {
    movieId: movie.movieId,
    title: movie.title,
    year: movie.year,
    director: movie.director,
    imdbRating: movie.imdbRating
  } AS movie, ["actor"] AS personTypes
  ORDER BY movie.imdbRating DESC, movie.title
  LIMIT toInteger($limit)
`;

const findByDirectorQuery = `
  MATCH (person:Director)-[:DIRECTED]->(movie:Movie)
  WHERE toLower(person.name) = toLower($person)
  RETURN {
    movieId: movie.movieId,
    title: movie.title,
    year: movie.year,
    director: movie.director,
    imdbRating: movie.imdbRating
  } AS movie, ["director"] AS personTypes
  ORDER BY movie.imdbRating DESC, movie.title
  LIMIT toInteger($limit)
`;

const findByPersonQuery = `
  CALL {
    MATCH (person:Actor)-[:ACTED_IN]->(movie:Movie)
    WHERE toLower(person.name) = toLower($person)
    RETURN movie, "actor" AS personType

    UNION ALL

    MATCH (person:Director)-[:DIRECTED]->(movie:Movie)
    WHERE toLower(person.name) = toLower($person)
    RETURN movie, "director" AS personType
  }
  WITH movie, collect(DISTINCT personType) AS personTypes
  RETURN {
    movieId: movie.movieId,
    title: movie.title,
    year: movie.year,
    director: movie.director,
    imdbRating: movie.imdbRating
  } AS movie, personTypes
  ORDER BY movie.imdbRating DESC, movie.title
  LIMIT toInteger($limit)
`;

function toJavaScriptNumber(value) {
  if (value && typeof value.toNumber === "function") {
    return value.toNumber();
  }

  return value ?? null;
}

function formatMovie(record) {
  const movie = record.get("movie");

  return {
    movieId: movie.movieId ?? null,
    title: movie.title ?? null,
    year: toJavaScriptNumber(movie.year),
    director: movie.director ?? null,
    imdbRating: movie.imdbRating ?? null,
    personTypes: record.get("personTypes")
  };
}

const inputSchema = z.object({
  person: z.string().trim().min(1).describe("The actor or director's name."),
  personType: z
    .enum(["actor", "director"])
    .optional()
    .describe("Use actor or director only when the user's query makes the role clear.")
});

export function createFindMovieByPersonTool(driver) {
  return tool(
    async ({ person, personType }) => {
      const session = driver.session();

      try {
        let query = findByPersonQuery;

        if (personType === "actor") {
          query = findByActorQuery;
        } else if (personType === "director") {
          query = findByDirectorQuery;
        }

        const result = await session.executeRead((transaction) =>
          transaction.run(query, { person, limit: 5 }),
        );
        const movies = result.records.map(formatMovie);

        if (movies.length === 0) {
          return JSON.stringify({
            found: false,
            message: `No movies were found for ${personType || "an actor or director"} "${person}". Apologize politely and let the user know.`
          });
        }

        return JSON.stringify({ found: true, person, movies });
      } finally {
        await session.close();
      }
    },
    {
      name: "find_movie_by_person",
      description:
        "Find up to five movies featuring an actor or directed by a director. Provide the person's name and set personType to actor or director only when known; otherwise omit personType to search both.",
      schema: inputSchema
    }
  );
}
