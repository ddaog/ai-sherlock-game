import * as fs from 'fs';
import * as path from 'path';

// Define minimalist mock of local getEmbedding by directly reading .env.local 
import { config } from 'dotenv';
config({ path: path.join(__dirname, '../.env.local') });

// In order to call the backend function directly without issues, we replicate the specific generation part.
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const getEvidencePath = (storyId: string) => path.join(process.cwd(), "data", "stories", storyId, "evidence.json");
const getEmbeddingsPath = (storyId: string) => path.join(process.cwd(), "data", "stories", storyId, "embeddings.json");

async function generate() {
    console.log("Loading evidence for story 2...");
    const raw = fs.readFileSync(getEvidencePath("2"), "utf-8");
    const evidence = JSON.parse(raw);

    const results = [];
    for (const ev of evidence) {
        const text = [
            ev.id,
            ev.type,
            ev.time_range,
            ev.entities.join(" "),
            ev.tags.join(" "),
            ev.text,
        ].join(" ");

        console.log(`Generating embedding for ${ev.id}...`);
        const response = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: text,
            dimensions: 1536
        });

        results.push({ ...ev, embedding: response.data[0].embedding });
    }

    fs.writeFileSync(getEmbeddingsPath("2"), JSON.stringify(results, null, 2), "utf-8");
    console.log("Successfully generated embeddings for 40 items.");
}

generate().catch(console.error);
