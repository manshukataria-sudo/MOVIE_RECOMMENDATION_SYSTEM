import { ToolMessage } from "@langchain/core/messages";

const systemPrompt = [
  "You are a movie recommendation assistant.",
  "If user ask any non related question, politely decline and explain that you are a movie recommendation assistant.",
  "For a request based on a named movie, call recommend_similar_movies with the movie title in the title argument.",
  "For a request based on desired movie characteristics or a plot/theme description, call the tool with a concise description in the description argument and omit title.",
  "When asked for movies by a person, call find_movie_by_person with their name. Set personType to actor or director only when the request makes the role clear; otherwise omit it.",
  "If neither a movie title nor a useful description was provided, ask the user a clarifying question rather than calling the tool.",
  "After a tool call, base your answer only on the tool result and do not invent movie recommendations.",
  "If any tool says no movie or recommendations were found, apologize politely and explain that the catalog had no match.",
].join(" ");

export function createMovieAssistant(model, movieTools) {
  // Create a map of tools by name for easy lookup
  const toolsByName = new Map(
    movieTools.map((movieTool) => [movieTool.name, movieTool]),
  );

  return {
    async answerQuery(query) {
      const messages = [
        ["system", systemPrompt],
        ["human", query],
      ];
      const modelResponse = await model.invoke(messages);
      const toolCalls = modelResponse.tool_calls || [];

      if (toolCalls.length === 0) {
        return { content: modelResponse.content, toolNames: [] };
      }

      messages.push(modelResponse);
      const toolNames = [];

      for (const toolCall of toolCalls) {
        const selectedTool = toolsByName.get(toolCall.name);

        if (!selectedTool) {
          throw new Error(
            `The model selected an unsupported tool: ${toolCall.name}.`,
          );
        }

        const result = await selectedTool.invoke(toolCall.args);
        toolNames.push(toolCall.name);
        messages.push(
          new ToolMessage({
            content: result,
            name: toolCall.name,
            tool_call_id: toolCall.id,
          }),
        );
      }

      // The second model call turns retrieved tool data into the user-facing answer.
      const finalResponse = await model.invoke(messages);

      return { content: finalResponse.content, toolNames };
    },
  };
}
