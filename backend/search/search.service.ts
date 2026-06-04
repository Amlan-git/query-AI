import { tavily } from "@tavily/core";

export type SearchResult = {
    title: string;
    url: string;
    content: string;
    rawContent?: string | null;
};

type TavilyImage = {
    url?: string;
    description?: string;
} | string;

export type SearchResponse = {
    results: SearchResult[];
    images: string[];
};

function normalizeImages(images: TavilyImage[] | undefined) {
    return (images || [])
        .map((image) => typeof image === "string" ? image : image.url)
        .filter((url): url is string => Boolean(url))
        .slice(0, 4);
}

export async function performSearch(query: string): Promise<SearchResponse> {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
        throw new Error("Missing TAVILY_API_KEY");
    }

    const tavilyClient = tavily({ apiKey });
    const response = await tavilyClient.search(query, {
        searchDepth: "advanced",
        includeImages: true
    });

    return {
        results: response.results.map((result) => ({
            title: result.title || "Untitled source",
            url: result.url || "",
            content: result.content || result.rawContent || "",
            rawContent: result.rawContent || null
        })),
        images: normalizeImages(response.images)
    };
}
