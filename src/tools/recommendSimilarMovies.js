import { tool } from "@langchain/core/tools";
import { z } from "zod";

const inputSchema = z
  .object({
    description: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe("A description of the kind of movie the user wants."),
    title: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe("The exact catalog movie title to find similar movies for.")
  })
  .refine((input) => Boolean(input.title || input.description), {
    message: "Provide either a movie title or a movie description."
  });

function formatRecommendations(matches, excludedId) {
  return matches
    .filter((match) => match.id !== excludedId)
    .slice(0, 10)
    .map((match) => ({
      title: match.metadata?.title || "Unknown title",
      year: match.metadata?.year ?? null,
      genre: match.metadata?.genre ?? [],
      director: match.metadata?.director ?? null,
      imdbRating: match.metadata?.imdbRating ?? null,
      actors: match.metadata?.actors ?? [],
      score: match.score ?? null
    }));
}

function createResultMessage(title, recommendations) {
  if (recommendations.length === 0) {
    return JSON.stringify({
      found: false,
      message: title
        ? `No similar movies were found for "${title}". Apologize politely and let the user know.`
        : "No matching movies were found for that description. Apologize politely and let the user know."
    });
  }

  return JSON.stringify({
    found: true,
    sourceTitle: title || null,
    recommendations
  });
}

export function createRecommendSimilarMoviesTool({ embeddings, index }) {
  return tool(
    async ({ description, title }) => {
      let queryVector;
      let sourceId;

      if (title) {
        // Embed the title to power Pinecone's metadata-filtered exact-title lookup.
        const titleVector = await embeddings.embedQuery(title);
        const titleMatches = await index.query({
          vector: titleVector,
          topK: 10,
          includeMetadata: true,
          filter: { title: { $eq: title } }
        });
        const sourceMovie = titleMatches.matches[0];

        if (!sourceMovie) {
          return JSON.stringify({
            found: false,
            message: `No movie with the exact title "${title}" exists in the catalog. Apologize politely and ask the user to check the title or provide a description.`
          });
        }

        sourceId = sourceMovie.id;
        // Use the catalog vector rather than the title embedding for similarity results.
        const fetchedMovies = await index.fetch({ ids: [sourceId] });
        queryVector = fetchedMovies.records[sourceId]?.values;

        if (!queryVector) {
          throw new Error(`Pinecone did not return a vector for movie "${title}".`);
        }
      } else {
        queryVector = await embeddings.embedQuery(description);
      }

      // Request one extra candidate for title searches so the source can be excluded.
      const searchResults = await index.query({
        vector: queryVector,
        topK: title ? 11 : 10,
        includeMetadata: true
      });
      const recommendations = formatRecommendations(searchResults.matches, sourceId);

      return createResultMessage(title, recommendations);
    },
    {
      name: "recommend_similar_movies",
      description:
        "Find up to 10 similar catalog movies using either a movie title or a description of the kind of movie the user wants. Provide title for title-based similarity, or description for semantic search.",
      schema: inputSchema
    }
  );
}