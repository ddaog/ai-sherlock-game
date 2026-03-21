import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seedStories() {
  const storiesDir = path.join(process.cwd(), 'data', 'stories');
  const storyIds = fs.readdirSync(storiesDir).filter(f => fs.statSync(path.join(storiesDir, f)).isDirectory());

  console.log(`Found stories: ${storyIds.join(', ')}`);

  for (const id of storyIds) {
    console.log(`Processing story ${id}...`);
    
    const storyPath = path.join(storiesDir, id);
    
    // Import config and display (using absolute paths for reliability in tsx)
    const { CASE_CONFIG } = await import(path.join(storyPath, 'config.ts'));
    const displayModule = await import(path.join(storyPath, 'display.ts'));
    
    const display = {
      VICTIM_NAME: displayModule.VICTIM_NAME,
      VICTIM_ALIASES: displayModule.VICTIM_ALIASES,
      SYNOPSIS: displayModule.SYNOPSIS,
      defaultSuggestions: displayModule.defaultSuggestions,
    };

    const evidence = JSON.parse(fs.readFileSync(path.join(storyPath, 'evidence.json'), 'utf-8'));
    
    let embeddings = null;
    const embeddingsPath = path.join(storyPath, 'embeddings.json');
    if (fs.existsSync(embeddingsPath)) {
      embeddings = JSON.parse(fs.readFileSync(embeddingsPath, 'utf-8'));
    }

    const { data, error } = await supabase
      .from('stories')
      .upsert({
        id: id,
        title: CASE_CONFIG.briefing?.title || `Story ${id}`,
        is_free: id === '1', // Hardcoded rule for now
        config: CASE_CONFIG,
        display: display,
        evidence: evidence,
        embeddings: embeddings,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.error(`Error upserting story ${id}:`, error);
    } else {
      console.log(`Successfully seeded story ${id}`);
    }
  }
}

seedStories().catch(err => {
  console.error('Seed script failed:', err);
  process.exit(1);
});
