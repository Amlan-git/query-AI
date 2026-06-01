import { config } from "dotenv";

config();

async function main() {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GOOGLE_GENERATIVE_AI_API_KEY}`);
        const data = await response.json();
        console.log("Available models:");
        for (const model of data.models) {
            console.log(model.name, " - ", model.supportedGenerationMethods);
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

main();
