import { useState, useEffect, useCallback } from 'react';

const MAX_TOKENS = 99;
const DAILY_REGEN = 33;
const AD_REWARD_AMOUNT = 20;
const MAX_DAILY_ADS = 3;

export function useTokenSystem(userId: string | undefined) {
    const [tokens, setTokens] = useState<number>(MAX_TOKENS);
    const [adsWatched, setAdsWatched] = useState<number>(0);
    const [isDebugMode, setIsDebugMode] = useState<boolean>(false);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        if (!userId) {
            // Guest Flow: Initial Tokens loaded to React State, unmanipulatable by local storage edit
            setTokens(33);
            setIsLoaded(true);
            return;
        }

        const debugKey = `sherlock_debug_${userId}`;
        const adCountKey = `sherlock_ad_watched_${userId}`;
        const savedDebug = localStorage.getItem(debugKey) === 'true';
        setIsDebugMode(savedDebug);

        if (savedDebug) {
            setTokens(MAX_TOKENS);
            setIsLoaded(true);
            return;
        }

        // Sync from server for authenticated users
        fetch('/api/credits')
            .then((res) => res.ok ? res.json() : null)
            .then((data) => {
                if (data && typeof data.remaining === 'number') {
                    setTokens(data.remaining);
                    localStorage.setItem(`sherlock_tokens_${userId}`, String(data.remaining));
                    localStorage.setItem(`sherlock_last_reset_${userId}`, new Date().toISOString().split('T')[0]);
                } else {
                    // Fallback to localStorage if server unavailable
                    const tokenKey = `sherlock_tokens_${userId}`;
                    const dateKey = `sherlock_last_reset_${userId}`;
                    const savedTokens = localStorage.getItem(tokenKey);
                    const savedDate = localStorage.getItem(dateKey);
                    const today = new Date().toISOString().split('T')[0];
                    if (!savedDate || !savedTokens) {
                        setTokens(MAX_TOKENS);
                    } else if (savedDate !== today) {
                        setTokens(Math.min(parseInt(savedTokens, 10) + DAILY_REGEN, MAX_TOKENS));
                    } else {
                        setTokens(parseInt(savedTokens, 10));
                    }
                }
            })
            .catch(() => {
                // Network error — keep localStorage value
            })
            .finally(() => {
                const savedAdCount = localStorage.getItem(adCountKey);
                setAdsWatched(savedAdCount ? parseInt(savedAdCount, 10) : 0);
                setIsLoaded(true);
            });

        // Listen for storage events in case of multiple tabs
        const handleStorage = (e: StorageEvent) => {
            if (e.key === `sherlock_tokens_${userId}`) {
                setTokens(e.newValue ? parseInt(e.newValue, 10) : MAX_TOKENS);
            } else if (e.key === `sherlock_debug_${userId}`) {
                setIsDebugMode(e.newValue === 'true');
                if (e.newValue === 'true') {
                    setTokens(MAX_TOKENS);
                }
            } else if (e.key === `sherlock_ad_watched_${userId}`) {
                setAdsWatched(e.newValue ? parseInt(e.newValue, 10) : 0);
            }
        };

        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, [userId]);

    const decreaseToken = useCallback(() => {
        if (isDebugMode) return true;

        if (tokens > 0) {
            const newTokens = tokens - 1;
            setTokens(newTokens);
            if (userId) {
                localStorage.setItem(`sherlock_tokens_${userId}`, String(newTokens));
            }
            return true;
        }
        return false;
    }, [userId, tokens, isDebugMode]);

    const triggerDebugMode = useCallback(() => {
        if (!userId) return false;
        const newDebugState = !isDebugMode;
        localStorage.setItem(`sherlock_debug_${userId}`, String(newDebugState));
        if (newDebugState) {
            localStorage.setItem(`sherlock_tokens_${userId}`, String(MAX_TOKENS));
            setTokens(MAX_TOKENS);
        }
        setIsDebugMode(newDebugState);
        return newDebugState;
    }, [userId, isDebugMode]);

    const setTokensForDebug = useCallback((amount: number) => {
        if (!userId) return;
        localStorage.setItem(`sherlock_tokens_${userId}`, String(amount));
        setTokens(amount);
    }, [userId]);

    const claimAdReward = useCallback(() => {
        if (!userId) return false;
        if (adsWatched >= MAX_DAILY_ADS) return false;

        const newAdCount = adsWatched + 1;
        const newTokens = Math.min(tokens + AD_REWARD_AMOUNT, MAX_TOKENS);

        setAdsWatched(newAdCount);
        setTokens(newTokens);

        localStorage.setItem(`sherlock_ad_watched_${userId}`, String(newAdCount));
        localStorage.setItem(`sherlock_tokens_${userId}`, String(newTokens));
        return true;
    }, [userId, adsWatched, tokens]);

    // Sync token count from server (called after API responses with remainingCredits)
    const syncTokens = useCallback((remaining: number) => {
        if (isDebugMode) return;
        setTokens(remaining);
        if (userId) {
            localStorage.setItem(`sherlock_tokens_${userId}`, String(remaining));
        }
    }, [userId, isDebugMode]);

    return {
        tokens,
        adsWatched,
        isDebugMode,
        isLoaded,
        decreaseToken,
        triggerDebugMode,
        setTokensForDebug,
        claimAdReward,
        syncTokens,
    };
}
