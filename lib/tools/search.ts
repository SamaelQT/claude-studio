import { tavily } from "@tavily/core";

export async function searchWeb(query: string, maxResults = 5) {
  const client = tavily({ apiKey: process.env.TAVILY_API_KEY! });
  const response = await client.search(query, {
    maxResults,
    searchDepth: "basic",
  });
  return response.results.map((r) => ({
    title: r.title,
    url: r.url,
    content: r.content,
  }));
}
