export const embeddingDimensions = 768;
export const movieBatchSize = 50;
export const delayBetweenBatchesMs = 60_000;

// Put the same searchable fields into each document in a predictable format.
function createEmbeddingText(movie) {
  return [
    `Title: ${movie.title}`,
    `Actors: ${movie.actors.join(", ")}`,
    `Director: ${movie.director}`,
    `Themes: ${movie.themes.join(", ")}`,
    `Genres: ${movie.genre.join(", ")}`,
    `Description: ${movie.description}`
  ].join("\n");
}

// Pinecone metadata omits null values because they are not useful filter fields.
function createMetadata(movie) {
  const metadata = {
    title: movie.title,
    year: movie.year,
    director: movie.director,
    runtime: movie.runtime,
    imdbRating: movie.imdbRating
  };

  if (movie.genre.length > 0) {
    metadata.genre = movie.genre;
  }

  if (movie.actors.length > 0) {
    metadata.actors = movie.actors;
  }

  if (movie.gross !== null) {
    metadata.gross = movie.gross;
  }

  if (movie.metaScore !== null) {
    metadata.metascore = movie.metaScore;
  }

  return metadata;
}

function validateEmbedding(vector, movieId) {
  if (
    !Array.isArray(vector) ||
    vector.length !== embeddingDimensions ||
    vector.some((value) => !Number.isFinite(value))
  ) {
    throw new Error(
      `Embedding for movie "${movieId}" must contain ${embeddingDimensions} finite numbers.`
    );
  }
}

function wait(milliseconds) {
  console.log(`Waiting ${milliseconds / 1000} seconds before processing the next batch...`);
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function indexMovieVectors({
  movies,
  embeddings,
  index,
  batchSize = movieBatchSize,
  delayMs = delayBetweenBatchesMs,
  pause = wait
}) {
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error("Batch size must be a positive integer.");
  }

  for (let start = 0; start < movies.length; start += batchSize) {
    const batch = movies.slice(start, start + batchSize);
    const texts = batch.map(createEmbeddingText);
    const vectors = await embeddings.embedDocuments(texts);

    if (vectors.length !== batch.length) {
      throw new Error(
        `Embedding model returned ${vectors.length} vectors for ${batch.length} movies.`
      );
    }

    // Validate the complete batch before upserting any of its vectors.
    const records = batch.map((movie, indexInBatch) => {
      const values = vectors[indexInBatch];
      validateEmbedding(values, movie.movieId);

      return {
        id: movie.movieId,
        values,
        metadata: createMetadata(movie)
      };
    });

    await index.upsert({ records });
    console.log(
      `Indexed ${Math.min(start + batch.length, movies.length)} of ${movies.length} movies.`
    );

    if (start + batch.length < movies.length) {
      // Wait only between chunks; there is no next request after the final chunk.
      await pause(delayMs);
    }
  }
}