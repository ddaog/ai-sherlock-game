import { getEmbedding, type EmbeddingUsage } from "./openai";
import {
  getStoryEvidence,
  getStoryEmbeddings,
  saveStoryEmbeddings,
  type StoryEmbeddingRecord,
  type StoryEvidenceRecord,
} from "@/lib/stories/store";

export type Evidence = StoryEvidenceRecord;
export type EvidenceWithEmbedding = StoryEmbeddingRecord;

function getEmbeddingText(ev: Evidence): string {
  return [
    ev.id,
    ev.type,
    ev.time_range,
    ev.entities.join(" "),
    ev.tags.join(" "),
    ev.text,
  ].join(" ");
}

export async function loadEvidence(storyId: string): Promise<Evidence[]> {
  return getStoryEvidence(storyId);
}

export async function ensureEmbeddings(
  storyId: string
): Promise<EvidenceWithEmbedding[]> {
  const cached = await getStoryEmbeddings(storyId);
  const evidence = await getStoryEvidence(storyId);

  if (cached && cached.length === evidence.length) {
    const ids = new Set(cached.map((e) => e.id));
    const allMatch = evidence.every((e) => ids.has(e.id));
    if (allMatch) {
      return cached;
    }
  }

  const results: EvidenceWithEmbedding[] = [];
  for (const ev of evidence) {
    const text = getEmbeddingText(ev);
    const { embedding } = await getEmbedding(text);
    results.push({ ...ev, embedding });
  }

  await saveStoryEmbeddings(storyId, results);
  return results;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export async function getTopKEvidence(
  storyId: string,
  query: string,
  k: number = 10
): Promise<{ evidence: Evidence[]; embeddingUsage: EmbeddingUsage }> {
  const withEmbeddings = await ensureEmbeddings(storyId);
  const { embedding: queryEmbedding, usage: embeddingUsage } = await getEmbedding(query);

  const scored = withEmbeddings.map((ev) => ({
    evidence: ev,
    score: cosineSimilarity(ev.embedding, queryEmbedding),
  }));

  scored.sort((a, b) => b.score - a.score);
  const evidence = scored.slice(0, k).map((s) => {
    const { embedding, ...rest } = s.evidence;
    return rest;
  });
  return { evidence, embeddingUsage };
}
