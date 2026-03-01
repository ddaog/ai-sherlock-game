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
        if (!userId) return;

        const checkTokens = () => {
            const tokenKey = `sherlock_tokens_${userId}`;
            const dateKey = `sherlock_last_reset_${userId}`;
            const debugKey = `sherlock_debug_${userId}`;
            const adCountKey = `sherlock_ad_watched_${userId}`;

            const savedTokens = localStorage.getItem(tokenKey);
            const savedDate = localStorage.getItem(dateKey);
            const savedDebug = localStorage.getItem(debugKey) === 'true';
            const savedAdCount = localStorage.getItem(adCountKey);

            setIsDebugMode(savedDebug);

            const today = new Date().toISOString().split('T')[0];

            if (savedDebug) {
                setTokens(MAX_TOKENS);
                setIsLoaded(true);
                return;
            }

            if (!savedDate || !savedTokens) {
                // First time user
                localStorage.setItem(tokenKey, String(MAX_TOKENS));
                localStorage.setItem(dateKey, today);
                localStorage.setItem(adCountKey, "0");
                setTokens(MAX_TOKENS);
                setAdsWatched(0);
            } else {
                let currentTokens = parseInt(savedTokens, 10);
                if (savedDate !== today) {
                    // Different day, regenerate
                    currentTokens = Math.min(currentTokens + DAILY_REGEN, MAX_TOKENS);
                    localStorage.setItem(tokenKey, String(currentTokens));
                    localStorage.setItem(dateKey, today);
                    localStorage.setItem(adCountKey, "0");
                    setAdsWatched(0);
                } else {
                    setAdsWatched(savedAdCount ? parseInt(savedAdCount, 10) : 0);
                }
                setTokens(currentTokens);
            }
            setIsLoaded(true);
        };

        checkTokens();

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
        if (!userId) return false;
        if (isDebugMode) return true;

        if (tokens > 0) {
            const newTokens = tokens - 1;
            setTokens(newTokens);
            localStorage.setItem(`sherlock_tokens_${userId}`, String(newTokens));
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

    return {
        tokens,
        adsWatched,
        isDebugMode,
        isLoaded,
        decreaseToken,
        triggerDebugMode,
        setTokensForDebug,
        claimAdReward
    };
}
