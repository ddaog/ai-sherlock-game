export type { CaseConfig as StoryConfig } from '@/data/stories/1/config';
import type { CaseConfig } from '@/data/stories/1/config';

export interface StoryDisplayConfig {
    VICTIM_NAME: string;
    VICTIM_ALIASES?: string[];
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

/**
 * Static fallback registry for local development and seeding.
 * Runtime reads should go through `@/lib/stories/store`.
 */
export const STORIES_REGISTRY: Record<string, StoryEntry> = {
    '1': {
        id: '1',
        isFree: true,
        asyncGetConfig: async () => (await import('@/data/stories/1/config')).CASE_CONFIG,
        asyncGetDisplay: async () => await import('@/data/stories/1/display'),
    },
    '2': {
        id: '2',
        isFree: false,
        asyncGetConfig: async () => (await import('@/data/stories/2/config')).CASE_CONFIG,
        asyncGetDisplay: async () => await import('@/data/stories/2/display'),
    },
    '3': {
        id: '3',
        isFree: false,
        asyncGetConfig: async () => (await import('@/data/stories/3/config')).CASE_CONFIG,
        asyncGetDisplay: async () => await import('@/data/stories/3/display'),
    },
};
