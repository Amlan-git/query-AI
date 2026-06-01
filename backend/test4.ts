import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import { config } from "dotenv";

config();

async function main() {
    const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY });
    
    try {
        const { text } = await generateText({
            model: google('gemini-1.5-pro-latest'),
            prompt: "What is the capital of France?",
        });
        console.log("Response:", text);
    } catch (e) {
        console.error("Error:", e);
    }
}

main();
