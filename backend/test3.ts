import { createDeepSeek } from "@ai-sdk/deepseek";
import { streamText } from "ai";
import { SYSTEM_PROMPT } from "./prompts.ts";
import { config } from "dotenv";

config();

async function main() {
    const deepseek = createDeepSeek({ apiKey: process.env.DEEPSEEK_API_KEY });
    
    try {
        const result = streamText({
            model: deepseek('deepseek-chat'),
            prompt: "What is the capital of France?",
            system: SYSTEM_PROMPT
        });
        
        let full = "";
        for await (const t of result.textStream) {
            full += t;
        }
        console.log("Full response length:", full.length);
    } catch (e) {
        console.error("Caught error in stream:", e);
    }
}

main();
