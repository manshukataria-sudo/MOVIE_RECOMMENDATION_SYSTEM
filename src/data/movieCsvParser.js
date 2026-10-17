import { readFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";

const requiredColumns = [
  "title",
  "year",
  "director",
  "actors",
  "genre",
  "themes",
  "description",
  "runtime",
  "imdb rating",
  "gross",
  "meta score",
  "movieId"
];

function parseNumber(value, column, rowNumber, optional = false) {
  if (value === "" && optional) {
    return null;
  }

  if (value === "") {
    throw new Error(`Missing number in "${column}" on CSV row ${rowNumber}.`);
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new Error(`Invalid number in "${column}" on CSV row ${rowNumber}.`);
  }

  return number;
}

function splitList(value, separator) {
  return value
    .split(separator)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toMovie(row, rowNumber) {
  const title = row.title.trim();
  const movieId = row.movieId.trim();

  if (!title || !movieId) {
    throw new Error(`Movie title and movieId are required on CSV row ${rowNumber}.`);
  }

  return {
    movieId,
    title,
    year: parseNumber(row.year, "year", rowNumber),
    director: row.director.trim(),
    actors: splitList(row.actors, ","),
    genre: splitList(row.genre, ","),
    // Theme values in the supplied CSV are separated with semicolons.
    themes: splitList(row.themes, ";"),
    description: row.description.trim(),
    runtime: parseNumber(row.runtime, "runtime", rowNumber),
    imdbRating: parseNumber(row["imdb rating"], "imdb rating", rowNumber),
    gross: parseNumber(row.gross, "gross", rowNumber, true),
    metaScore: parseNumber(row["meta score"], "meta score", rowNumber, true)
  };
}

/**
 * Reads and normalizes movie records from the supplied CSV file.
 * This function only parses data; it does not write to any database.
 */
export async function parseMoviesCsv(filePath) {
  const csvText = await readFile(filePath, "utf8");
  const rows = parse(csvText, {
    bom: true,
    columns: (headers) => {
      const normalizedHeaders = headers.map((header) => header.trim());
      const missingColumns = requiredColumns.filter(
        (column) => !normalizedHeaders.includes(column)
      );

      if (missingColumns.length > 0) {
        throw new Error(`CSV is missing required columns: ${missingColumns.join(", ")}.`);
      }

      return normalizedHeaders;
    },
    skip_empty_lines: true,
    trim: true
  });
  return rows.map((row, index) => toMovie(row, index + 2));
}