import * as fs from "fs";
import * as path from "path";
import type { CaseConfig } from "@/data/stories/1/config";
import { STORIES_REGISTRY, type StoryDisplayConfig } from "@/data/registry";
import { createAdminClient } from "@/lib/supabase/admin";

export interface StoryEvidenceRecord {
  id: string;
  type: string;
  time_range: string;
  entities: string[];
  tags: string[];
  text: string;
}

export interface StoryEmbeddingRecord extends StoryEvidenceRecord {
  embedding: number[];
}

export interface StoryBundle {
  id: string;
  title: string;
  isFree: boolean;
  config: CaseConfig;
  display: StoryDisplayConfig;
  evidence: StoryEvidenceRecord[];
  embeddings: StoryEmbeddingRecord[] | null;
}

export interface StorySummary {
  id: string;
  title: string;
  isFree: boolean;
}

export type StorySource = "db" | "static";

export interface AdminStorySummary extends StorySummary {
  createdAt: string | null;
  hasStaticFallback: boolean;
  source: StorySource;
}

export interface AdminStoryBundle extends StoryBundle {
  hasStaticFallback: boolean;
  source: StorySource;
}

export interface AdminEditableStory {
  id: string;
  title: string;
  isFree: boolean;
  config: unknown;
  display: unknown;
  evidence: unknown;
  embeddings: unknown | null;
  hasStaticFallback: boolean;
  source: StorySource;
}

interface SerializedRegExp {
  __type: "RegExp";
  source: string;
  flags: string;
}

const getEvidencePath = (storyId: string) =>
  path.join(process.cwd(), "data", "stories", storyId, "evidence.json");
const getEmbeddingsPath = (storyId: string) =>
  path.join(process.cwd(), "data", "stories", storyId, "embeddings.json");

function canUseStoriesDb() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function normalizeEvidence(value: unknown): StoryEvidenceRecord[] {
  return Array.isArray(value) ? (value as StoryEvidenceRecord[]) : [];
}

function normalizeEmbeddings(value: unknown): StoryEmbeddingRecord[] | null {
  return Array.isArray(value) ? (value as StoryEmbeddingRecord[]) : null;
}

function normalizeDisplay(value: unknown): StoryDisplayConfig {
  if (
    value &&
    typeof value === "object" &&
    "displayStruct" in (value as Record<string, unknown>)
  ) {
    return (value as { displayStruct: StoryDisplayConfig }).displayStruct;
  }

  const display = value as Partial<StoryDisplayConfig>;
  return {
    VICTIM_NAME: display.VICTIM_NAME ?? "",
    VICTIM_ALIASES: display.VICTIM_ALIASES,
    SYNOPSIS: display.SYNOPSIS ?? { short: "", full: "" },
    defaultSuggestions: display.defaultSuggestions ?? [],
  };
}

function isSerializedRegExp(value: unknown): value is SerializedRegExp {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    (value as { __type?: unknown }).__type === "RegExp" &&
    typeof (value as { source?: unknown }).source === "string" &&
    typeof (value as { flags?: unknown }).flags === "string"
  );
}

function encodeSpecialTypes(value: unknown): unknown {
  if (value instanceof RegExp) {
    return {
      __type: "RegExp",
      source: value.source,
      flags: value.flags,
    } satisfies SerializedRegExp;
  }

  if (Array.isArray(value)) {
    return value.map((item) => encodeSpecialTypes(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => [
        key,
        encodeSpecialTypes(entryValue),
      ])
    );
  }

  return value;
}

function decodeSpecialTypes(value: unknown): unknown {
  if (isSerializedRegExp(value)) {
    return new RegExp(value.source, value.flags);
  }

  if (Array.isArray(value)) {
    return value.map((item) => decodeSpecialTypes(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => [
        key,
        decodeSpecialTypes(entryValue),
      ])
    );
  }

  return value;
}

async function loadStaticStoryBundle(storyId: string): Promise<StoryBundle | undefined> {
  const story = STORIES_REGISTRY[storyId];
  if (!story) return undefined;

  const config = await story.asyncGetConfig();
  const display = normalizeDisplay(await story.asyncGetDisplay());
  const evidence = JSON.parse(
    fs.readFileSync(getEvidencePath(storyId), "utf-8")
  ) as StoryEvidenceRecord[];

  let embeddings: StoryEmbeddingRecord[] | null = null;
  const embeddingsPath = getEmbeddingsPath(storyId);
  if (fs.existsSync(embeddingsPath)) {
    embeddings = JSON.parse(
      fs.readFileSync(embeddingsPath, "utf-8")
    ) as StoryEmbeddingRecord[];
  }

  return {
    id: storyId,
    title: config.briefing?.title || `Story ${storyId}`,
    isFree: story.isFree,
    config,
    display,
    evidence,
    embeddings,
  };
}

function mapDbStoryToBundle(data: {
  id: string;
  title: string;
  is_free: boolean;
  config: unknown;
  display: unknown;
  evidence: unknown;
  embeddings: unknown;
}): AdminStoryBundle {
  return {
    id: data.id,
    title: data.title,
    isFree: data.is_free,
    config: decodeSpecialTypes(data.config) as CaseConfig,
    display: normalizeDisplay(decodeSpecialTypes(data.display)),
    evidence: normalizeEvidence(decodeSpecialTypes(data.evidence)),
    embeddings: normalizeEmbeddings(decodeSpecialTypes(data.embeddings)),
    hasStaticFallback: Boolean(STORIES_REGISTRY[data.id]),
    source: "db",
  };
}

function toAdminEditableStory(story: AdminStoryBundle): AdminEditableStory {
  return {
    id: story.id,
    title: story.title,
    isFree: story.isFree,
    config: encodeSpecialTypes(story.config),
    display: encodeSpecialTypes(story.display),
    evidence: encodeSpecialTypes(story.evidence),
    embeddings: encodeSpecialTypes(story.embeddings),
    hasStaticFallback: story.hasStaticFallback,
    source: story.source,
  };
}

async function loadDbStoryBundle(
  storyId: string
): Promise<AdminStoryBundle | undefined> {
  if (!canUseStoriesDb()) return undefined;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("stories")
      .select("id, title, is_free, config, display, evidence, embeddings")
      .eq("id", storyId)
      .single();

    if (!error && data) {
      return mapDbStoryToBundle(data);
    }
  } catch {
    // Fall back to static files.
  }

  return undefined;
}

async function getStaticAdminStories(): Promise<AdminStorySummary[]> {
  const storyIds = Object.keys(STORIES_REGISTRY);
  const bundles = await Promise.all(
    storyIds.map((storyId) => loadStaticStoryBundle(storyId))
  );

  return bundles
    .filter((bundle): bundle is StoryBundle => Boolean(bundle))
    .map((bundle) => ({
      id: bundle.id,
      title: bundle.title,
      isFree: bundle.isFree,
      createdAt: null,
      hasStaticFallback: true,
      source: "static" as const,
    }));
}

async function getDbAdminStories(): Promise<AdminStorySummary[]> {
  if (!canUseStoriesDb()) return [];

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("stories")
      .select("id, title, is_free, created_at")
      .order("created_at", { ascending: false });

    if (!error && data) {
      return data.map((story) => ({
        id: story.id,
        title: story.title,
        isFree: story.is_free,
        createdAt: story.created_at ?? null,
        hasStaticFallback: Boolean(STORIES_REGISTRY[story.id]),
        source: "db" as const,
      }));
    }
  } catch {
    // Fall back to static files.
  }

  return [];
}

export async function getAdminStoryBundle(
  storyId: string
): Promise<AdminEditableStory | undefined> {
  const dbStory = await loadDbStoryBundle(storyId);
  if (dbStory) return toAdminEditableStory(dbStory);

  const staticStory = await loadStaticStoryBundle(storyId);
  if (!staticStory) return undefined;

  return toAdminEditableStory({
    ...staticStory,
    hasStaticFallback: true,
    source: "static",
  });
}

export async function getAllAdminStories(): Promise<AdminStorySummary[]> {
  const [staticStories, dbStories] = await Promise.all([
    getStaticAdminStories(),
    getDbAdminStories(),
  ]);

  const mergedStories = new Map<string, AdminStorySummary>();

  for (const story of staticStories) {
    mergedStories.set(story.id, story);
  }

  for (const story of dbStories) {
    mergedStories.set(story.id, story);
  }

  return Array.from(mergedStories.values()).sort((a, b) => {
    if (a.source !== b.source) return a.source === "db" ? -1 : 1;
    if (a.createdAt && b.createdAt) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    return a.title.localeCompare(b.title);
  });
}

export async function getStoryBundle(
  storyId: string
): Promise<StoryBundle | undefined> {
  const dbStory = await loadDbStoryBundle(storyId);
  if (dbStory) {
    return dbStory;
  }

  return loadStaticStoryBundle(storyId);
}

export async function getStoryConfig(
  storyId: string
): Promise<CaseConfig | undefined> {
  return (await getStoryBundle(storyId))?.config;
}

export async function getStoryDisplay(
  storyId: string
): Promise<StoryDisplayConfig | undefined> {
  return (await getStoryBundle(storyId))?.display;
}

export async function getStoryEvidence(
  storyId: string
): Promise<StoryEvidenceRecord[]> {
  return (await getStoryBundle(storyId))?.evidence ?? [];
}

export async function getStoryEmbeddings(
  storyId: string
): Promise<StoryEmbeddingRecord[] | null> {
  return (await getStoryBundle(storyId))?.embeddings ?? null;
}

export async function saveStoryEmbeddings(
  storyId: string,
  embeddings: StoryEmbeddingRecord[]
): Promise<void> {
  if (!canUseStoriesDb()) return;

  try {
    const supabase = createAdminClient();
    await supabase
      .from("stories")
      .update({
        embeddings,
        updated_at: new Date().toISOString(),
      })
      .eq("id", storyId);
  } catch {
    // Ignore persistence errors. Runtime can still proceed with generated embeddings.
  }
}

export async function getAllStories(): Promise<StorySummary[]> {
  const stories = await getAllAdminStories();
  return stories.map((story) => ({
    id: story.id,
    title: story.title,
    isFree: story.isFree,
  }));
}
