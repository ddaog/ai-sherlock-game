import { useState, useEffect, useCallback } from 'react';

const MAX_TOKENS = 99;
const DAILY_REGEN = 33;

export function useTokenSystem(userId: string | undefined) {
    const [tokens, setTokens] = useState<number>(MAX_TOKENS);
    const [isDebugMode, setIsDebugMode] = useState<boolean>(false);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        if (!userId) return;

        const checkTokens = () => {
            const tokenKey = `sherlock_tokens_${userId}`;
            const dateKey = `sherlock_last_reset_${userId}`;
            const debugKey = `sherlock_debug_${userId}`;

            const savedTokens = localStorage.getItem(tokenKey);
            const savedDate = localStorage.getItem(dateKey);
            const savedDebug = localStorage.getItem(debugKey) === 'true';

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
                setTokens(MAX_TOKENS);
            } else {
                let currentTokens = parseInt(savedTokens, 10);
                if (savedDate !== today) {
                    // Different day, regenerate
                    currentTokens = Math.min(currentTokens + DAILY_REGEN, MAX_TOKENS);
                    localStorage.setItem(tokenKey, String(currentTokens));
                    localStorage.setItem(dateKey, today);
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
        if (!userId) return;
        localStorage.setItem(`sherlock_debug_${userId}`, 'true');
        localStorage.setItem(`sherlock_tokens_${userId}`, String(MAX_TOKENS));
        setIsDebugMode(true);
        setTokens(MAX_TOKENS);
    }, [userId]);

    return {
        tokens,
        isDebugMode,
        isLoaded,
        decreaseToken,
        triggerDebugMode
    };
}
