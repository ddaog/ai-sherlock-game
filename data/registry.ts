export type { CaseConfig as StoryConfig } from '@/data/stories/1/config'; // Generic configuration type
import type { CaseConfig } from '@/data/stories/1/config';

/**
 * Story Registry
 * Central registry mapping story IDs to their configurations.
 */

// Define the shape of a generic Story Display Config
export interface StoryDisplayConfig {
    VICTIM_NAME: string;
    SYNOPSIS: {
        short: string;
        full: string;
    };
    defaultSuggestions: string[];
}

export interface StoryEntry {
    id: string;
    isFree: boolean;
    asyncGetConfig: () => Promise<CaseConfig>;
    asyncGetDisplay: () => Promise<StoryDisplayConfig>;
}

export const STORIES_REGISTRY: Record<string, StoryEntry> = {
    '1': {
        id: '1',
        isFree: true,
        asyncGetConfig: async () => (await import('@/data/stories/1/config')).CASE_CONFIG,
        asyncGetDisplay: async () => await import('@/data/stories/1/display'),
    },
    // Add fallback or placeholders for 2,3,4,5,6 to match what's in StoryGrid
    '2': {
        id: '2',
        isFree: false,
        asyncGetConfig: async () => (await import('@/data/stories/1/config')).CASE_CONFIG, // fallback for now
        asyncGetDisplay: async () => await import('@/data/stories/1/display'), // fallback for now
    },
    '3': {
        id: '3',
        isFree: false,
        asyncGetConfig: async () => (await import('@/data/stories/1/config')).CASE_CONFIG, // fallback for now
        asyncGetDisplay: async () => await import('@/data/stories/1/display'), // fallback for now
    },
    '4': {
        id: '4',
        isFree: false,
        asyncGetConfig: async () => (await import('@/data/stories/1/config')).CASE_CONFIG, // fallback for now
        asyncGetDisplay: async () => await import('@/data/stories/1/display'), // fallback for now
    },
    '5': {
        id: '5',
        isFree: false,
        asyncGetConfig: async () => (await import('@/data/stories/1/config')).CASE_CONFIG, // fallback for now
        asyncGetDisplay: async () => await import('@/data/stories/1/display'), // fallback for now
    },
    '6': {
        id: '6',
        isFree: false,
        asyncGetConfig: async () => (await import('@/data/stories/1/config')).CASE_CONFIG, // fallback for now
        asyncGetDisplay: async () => await import('@/data/stories/1/display'), // fallback for now
    },
};

export async function getStoryConfig(storyId: string): Promise<CaseConfig | undefined> {
    const story = STORIES_REGISTRY[storyId];
    if (!story) return undefined;
    return await story.asyncGetConfig();
}

export async function getStoryDisplay(storyId: string): Promise<StoryDisplayConfig | undefined> {
    const story = STORIES_REGISTRY[storyId];
    if (!story) return undefined;
    return await story.asyncGetDisplay();
}
