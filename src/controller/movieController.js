import { runAgent } from "../scripts/chatWithMovies.js";

export async function getRecommendedMovies(request, response) {
  const query = request.body?.query;

  if (typeof query !== "string" || query.trim() === "") {
    return response.status(400).json({
      error: "Please provide a non-empty query.",
    });
  }

  try {
    const result = await runAgent(query.trim());
    return response.status(200).json(result);
  } catch (error) {
    console.error("Unable to process movie query:", error);
    return response.status(500).json({
      error: "Unable to process the movie query right now.",
    });
  }
}