import { createDeepSeek } from "@ai-sdk/deepseek";
import { streamText, generateText } from "ai";
import { SYSTEM_PROMPT } from "./prompts.ts";
import { config } from "dotenv";

config(); // Load .env

async function main() {
    const deepseek = createDeepSeek({ apiKey: process.env.DEEPSEEK_API_KEY });
    
    try {
        const { text } = await generateText({
            model: deepseek('deepseek-chat'),
            prompt: "What is the capital of France?",
            system: SYSTEM_PROMPT
        });
        console.log("Response:", text);
    } catch (e) {
        console.error("Error:", e);
    }
}

main();
