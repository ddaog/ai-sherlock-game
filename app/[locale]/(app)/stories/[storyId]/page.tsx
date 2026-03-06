"use client";

import { useState, useRef, useEffect } from "react";
import type { Hypothesis } from "@/lib/game/hypothesesSimple";
import { useTranslations } from 'next-intl';
import { Lock, ChevronLeft } from 'lucide-react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useTokenSystem } from '@/lib/hooks/useTokenSystem';
import { getStoryDisplay, type StoryDisplayConfig } from '@/data/registry';
import { Link } from '@/lib/i18n/routing';

const MAX_HYPOTHESES = 5;
const MAX_HINTS = 3;

const getHintDesc = (hintCount: number) => {
    if (hintCount >= 3) return "사용불가";
    return `${3 - hintCount}회 남음`;
};

function getSlashCommands(hintCount: number) {
    const base = [
        { cmd: "/가설", desc: "가설 기록" },
        { cmd: "/추리", desc: "결론 제출" },
        { cmd: "/힌트", desc: `힌트 (${getHintDesc(hintCount)})` },
    ];
    if (hintCount >= MAX_HINTS) {
        base.push({ cmd: "/포기", desc: "정답 공개 및 포기" });
    }
    return base;
}

const isCompleteCommand = (v: string) =>
    v.startsWith("/가설") || v.startsWith("/추리") || v.startsWith("/힌트") || v.startsWith("/포기");

function highlightVictim(text: string, victim: string, aliases: string[] = []) {
    if (!text || (!victim && aliases.length === 0)) return text;
    const namesMatched = [victim, ...aliases].filter(Boolean).sort((a, b) => b.length - a.length);
    if (namesMatched.length === 0) return text;

    const regex = new RegExp(`(${namesMatched.join('|')})`, "g");
    const parts = text.split(regex);
    return parts.map((part, i) =>
        namesMatched.includes(part) ? (
            <span key={i} className="text-archive-accent font-semibold">
                {part}
            </span>
        ) : (
            part
        )
    );
}

function highlightMessageContent(text: string, victim: string, aliases: string[] = []) {
    if (!text) return text;
    const namesMatched = [victim, ...aliases].filter(Boolean).sort((a, b) => b.length - a.length);
    const namesRegexPart = namesMatched.length > 0 ? namesMatched.join('|') + '|' : '';

    const parts = text.split(new RegExp(`(${namesRegexPart}/가설|/추리|/힌트|/포기)`, "g"));
    return parts.map((part, i) =>
        namesMatched.includes(part) ? (
            <span key={i} className="text-archive-accent font-semibold">
                {part}
            </span>
        ) : ["/가설", "/추리", "/힌트", "/포기"].includes(part) ? (
            <span key={i} className="text-archive-accent font-mono font-semibold">
                {part}
            </span>
        ) : (
            part
        )
    );
}

function formatInputWithCommands(text: string) {
    const parts = text.split(/(\/가설|\/추리|\/힌트|\/포기)/g);
    return parts.map((part, i) =>
        ["/가설", "/추리", "/힌트", "/포기"].includes(part) ? (
            <span key={i} className="text-archive-accent font-mono font-semibold">
                {part}
            </span>
        ) : (
            part
        )
    );
}

function Typewriter({
    text,
    onType,
    victim,
    aliases = [],
}: {
    text: string;
    onType?: () => void;
    victim?: string;
    aliases?: string[];
}) {
    const [displayedText, setDisplayedText] = useState("");
    const onTypeRef = useRef(onType);

    useEffect(() => {
        onTypeRef.current = onType;
    }, [onType]);

    useEffect(() => {
        let index = 0;
        setDisplayedText("");
        const interval = setInterval(() => {
            setDisplayedText(text.slice(0, index + 1));
            index++;
            if (onTypeRef.current) onTypeRef.current();
            if (index >= text.length) clearInterval(interval);
        }, 20);
        return () => clearInterval(interval);
    }, [text]);

    return (
        <>
            {victim ? highlightVictim(displayedText, victim, aliases) : displayedText}
            {displayedText.length < text.length && (
                <span className="inline-block w-2 h-4 bg-archive-accent ml-1 -mb-0.5 align-baseline animate-pulse"></span>
            )}
        </>
    );
}

interface Message {
    role: "user" | "assistant";
    content?: string;
    response?: string;
    badge?: { title: string; condition: string };
    sources?: string[];
    suggestions?: string[];
}

export default function StoryPlayPage() {
    const t = useTranslations('Game');
    const params = useParams();
    const supabase = createClient();
    const storyIdParam = Array.isArray(params.storyId) ? params.storyId[0] : params.storyId;
    const storyId = storyIdParam || "1"; // Fallback to 1 if undefined

    const [displayConfig, setDisplayConfig] = useState<StoryDisplayConfig | null>(null);
    const VICTIM_NAME = displayConfig?.VICTIM_NAME || "";
    const VICTIM_ALIASES = displayConfig?.VICTIM_ALIASES || [];

    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(false);
    const [hypotheses, setHypotheses] = useState<Hypothesis[]>([]);
    const [seenRecordIds, setSeenRecordIds] = useState<string[]>([]);
    const [triggeredBadges, setTriggeredBadges] = useState<string[]>([]);
    const [solved, setSolved] = useState(false);
    const [pendingHypothesisReplace, setPendingHypothesisReplace] = useState<{ newText: string; matchedHypothesisId: string } | undefined>(undefined);
    const [pendingReset, setPendingReset] = useState(false);
    const [suggestionIndex, setSuggestionIndex] = useState(-1);
    const [hintCount, setHintCount] = useState(0);
    const [showCommandPalette, setShowCommandPalette] = useState(false);
    const [commandPaletteIndex, setCommandPaletteIndex] = useState(0);
    const [isSynopsisOpen, setIsSynopsisOpen] = useState(true);

    // Solve Form States (Terminal Style)
    const [solveStep, setSolveStep] = useState<0 | 1 | 2 | 3>(0);
    const [solveForm, setSolveForm] = useState({ culprit: '', motive: '', method: '' });

    const prevMessagesLength = useRef(0);

    useEffect(() => {
        const fetchConfig = async () => {
            const config = await getStoryDisplay(storyId);
            if (config) {
                setDisplayConfig(config);
            }
        };
        fetchConfig();
    }, [storyId]);

    useEffect(() => {
        if (prevMessagesLength.current === 0 && messages.length > 0) {
            setIsSynopsisOpen(false);
        }
        prevMessagesLength.current = messages.length;
    }, [messages.length]);

    // SaaS Specific: Paywall and Credits
    const [userId, setUserId] = useState<string | undefined>();
    const [isPremium, setIsPremium] = useState(false);
    const [isCheckingEntitlements, setIsCheckingEntitlements] = useState(true);

    const { tokens, adsWatched, isDebugMode, isLoaded: isTokenLoaded, decreaseToken, setTokensForDebug, claimAdReward } = useTokenSystem(userId);
    const [queriesClickCount, setQueriesClickCount] = useState(0);
    const [isWatchingAd, setIsWatchingAd] = useState(false);

    const actualQueriesLeft = isPremium || isDebugMode ? Infinity : tokens;
    const showPaywall = !isCheckingEntitlements && isTokenLoaded && ((storyId !== '1' && !isPremium && !isDebugMode) || actualQueriesLeft <= 0);

    const logEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const inputOverlayRef = useRef<HTMLDivElement>(null);
    const paletteRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const checkEntitlements = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                setIsCheckingEntitlements(false);
                return;
            }

            setUserId(session.user.id);

            const { data: sub } = await supabase
                .from('subscriptions')
                .select('plan, status')
                .eq('user_id', session.user.id)
                .single();

            const isPremiumSub = sub?.status === 'active' && sub?.plan !== 'free';
            setIsPremium(isPremiumSub);
            setIsCheckingEntitlements(false);
        };
        checkEntitlements();
    }, [supabase]);

    // Simplified load state since we don't have localStorage persistence built-in for MVP port
    // In a full SaaS app this would come from Supabase DB `game_sessions` table
    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, loading]);

    const lastSuggestions =
        [...messages]
            .reverse()
            .find((m) => m.role === "assistant" && m.suggestions?.length)
            ?.suggestions ?? [];

    const lastAssistantIsResetConfirm = (() => {
        const last = [...messages].reverse().find((m) => m.role === "assistant");
        return last?.response?.includes("초기화를 진행할까요") ?? false;
    })();

    const handleRestart = () => {
        setSolved(false);
        setMessages([]);
        setHypotheses([]);
        setSeenRecordIds([]);
        setTriggeredBadges([]);
        setHintCount(0);
        setInput("");
        setPendingHypothesisReplace(undefined);
        setPendingReset(false);
        setShowCommandPalette(false);
    };

    const handlePaywallUpgrade = (plan: 'lestrade' | 'sherlock' | 'holmes') => {
        if (!userId) return;
        let productId = "";
        if (plan === 'lestrade') productId = process.env.NEXT_PUBLIC_POLAR_LESTRADE_ID || "";
        if (plan === 'sherlock') productId = process.env.NEXT_PUBLIC_POLAR_SHERLOCK_ID || "";
        if (plan === 'holmes') productId = process.env.NEXT_PUBLIC_POLAR_HOLMES_ID || "";

        if (!productId) {
            alert("Pricing packages are not fully configured yet.");
            return;
        }

        window.location.href = `/api/checkout?products=${productId}&customerExternalId=${userId}`;
    };

    const handleWatchAd = () => {
        if (!userId) {
            alert(t('loginRequiredForAd'));
            return;
        }
        if (adsWatched >= 3) return;
        setIsWatchingAd(true);
        // Simulate ad watching for 2 seconds
        setTimeout(() => {
            const success = claimAdReward();
            if (success) {
                setIsWatchingAd(false);
            } else {
                alert(t('adLimitReached'));
                setIsWatchingAd(false);
            }
        }, 2000);
    };

    const handleSubmit = async () => {
        const trimmed = input.trim();
        if (!trimmed || loading || solved || showPaywall) return;

        if (actualQueriesLeft <= 0) {
            return;
        }

        const isY = /^(y|yes|예|네|ㅇ)$/i.test(trimmed);
        const isN = /^(n|no|아니오|아니요|ㄴ)$/i.test(trimmed);
        const awaitingResetConfirm = pendingReset || (lastAssistantIsResetConfirm && (isY || isN));

        if (awaitingResetConfirm && !pendingHypothesisReplace && (isY || isN)) {
            if (isY) {
                handleRestart();
            } else {
                setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
                setMessages((prev) => [...prev, { role: "assistant", response: "취소되었습니다." }]);
            }
            setPendingReset(false);
            setInput("");
            return;
        }

        if (/^\/초기화$/i.test(trimmed)) {
            setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
            setMessages((prev) => [
                ...prev,
                { role: "assistant", response: "초기화를 진행할까요? 기존 데이터가 삭제됩니다. (Y: 실행, N: 취소)" },
            ]);
            setPendingReset(true);
            setInput("");
            return;
        }

        if (trimmed === "/추리" || trimmed.startsWith("/추리 ")) {
            setSolveStep(1);
            setSolveForm({ culprit: '', motive: '', method: '' });
            setInput("");
            setShowCommandPalette(false);
            return;
        }

        setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
        setShowCommandPalette(false);
        setInput("");
        setLoading(true);

        if (!isPremium && !isDebugMode) {
            decreaseToken();
        }

        try {
            const history = messages
                .filter((m) => m.content)
                .map((m) => ({
                    role: m.role,
                    content:
                        m.role === "user"
                            ? m.content!
                            : [
                                m.response || "",
                                m.sources?.length ? "SOURCES: " + m.sources.join(", ") : "",
                                m.suggestions?.length ? "SUGGESTION: " + m.suggestions.join("; ") : "",
                            ]
                                .filter(Boolean)
                                .join("\n"),
                }));

            const res = await fetch(`/api/stories/${storyId}/query`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    query: trimmed,
                    history,
                    hypotheses,
                    seenRecordIds,
                    triggeredBadges,
                    sessionState: {
                        solved,
                        solvedAt: solved ? new Date().toISOString() : undefined,
                        hintCount,
                        ...(pendingHypothesisReplace && { pendingHypothesisReplace }),
                    },
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                if (Array.isArray(data.hypotheses)) setHypotheses(data.hypotheses.slice(0, MAX_HYPOTHESES));
                if (Array.isArray(data.seenRecordIds)) setSeenRecordIds(data.seenRecordIds);
                if (Array.isArray(data.triggeredBadges)) setTriggeredBadges(data.triggeredBadges);
                setMessages((prev) => [
                    ...prev,
                    {
                        role: "assistant",
                        response: data.error || "오류가 발생했습니다.",
                        suggestions: displayConfig?.defaultSuggestions || [],
                    },
                ]);
                setSuggestionIndex(-1);
                setLoading(false);
                return;
            }

            if (Array.isArray(data.hypotheses)) setHypotheses(data.hypotheses.slice(0, MAX_HYPOTHESES));
            if (Array.isArray(data.seenRecordIds)) setSeenRecordIds(data.seenRecordIds);
            if (Array.isArray(data.triggeredBadges)) setTriggeredBadges(data.triggeredBadges);
            if (data.solved === true) setSolved(true);
            setPendingHypothesisReplace(data.sessionState?.pendingHypothesisReplace);
            if (typeof data.sessionState?.hintCount === "number") {
                setHintCount(data.sessionState.hintCount);
            }

            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    response: data.response,
                    badge: data.badge,
                    sources: data.sources || [],
                    suggestions: data.suggestions || [],
                },
            ]);
            setSuggestionIndex(-1);

        } catch {
            setMessages((prev) => [
                ...prev,
                { role: "assistant", response: "연결 오류가 발생했습니다. 다시 시도해 주세요.", suggestions: [] },
            ]);
        } finally {
            setLoading(false);
            inputRef.current?.focus();
        }
    };

    const handleSolveSubmit = async () => {
        if (!solveForm.culprit.trim() || !solveForm.motive.trim() || !solveForm.method.trim() || loading || solved || showPaywall) return;

        const combinedQuery = `/추리 [범인] ${solveForm.culprit.trim()} \n[동기] ${solveForm.motive.trim()} \n[방법] ${solveForm.method.trim()}`;

        setSolveStep(0);
        setSolveForm({ culprit: '', motive: '', method: '' });

        // Directly process as a normal submit with the combined query
        const previousInput = input;
        setInput(combinedQuery);
        // We need to use functional state update or pass string directly to a submit helper,
        // but since handleSubmit reads from `input` state, we'll temporarily hack it by
        // running the exact same logic but using `combinedQuery` instead of `input`.

        setMessages((prev) => [...prev, { role: "user", content: combinedQuery }]);
        setShowCommandPalette(false);
        setInput("");
        setLoading(true);

        if (!isPremium && !isDebugMode) {
            decreaseToken();
        }

        try {
            const history = messages
                .filter((m) => m.content)
                .map((m) => ({
                    role: m.role,
                    content:
                        m.role === "user"
                            ? m.content!
                            : [
                                m.response || "",
                                m.sources?.length ? "SOURCES: " + m.sources.join(", ") : "",
                                m.suggestions?.length ? "SUGGESTION: " + m.suggestions.join("; ") : "",
                            ]
                                .filter(Boolean)
                                .join("\n"),
                }));

            const res = await fetch(`/api/stories/${storyId}/query`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    query: combinedQuery,
                    history,
                    hypotheses,
                    seenRecordIds,
                    triggeredBadges,
                    sessionState: {
                        solved,
                        solvedAt: solved ? new Date().toISOString() : undefined,
                        hintCount,
                        ...(pendingHypothesisReplace && { pendingHypothesisReplace }),
                    },
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                if (Array.isArray(data.hypotheses)) setHypotheses(data.hypotheses.slice(0, MAX_HYPOTHESES));
                if (Array.isArray(data.seenRecordIds)) setSeenRecordIds(data.seenRecordIds);
                if (Array.isArray(data.triggeredBadges)) setTriggeredBadges(data.triggeredBadges);
                setMessages((prev) => [
                    ...prev,
                    {
                        role: "assistant",
                        response: data.error || "오류가 발생했습니다.",
                        suggestions: displayConfig?.defaultSuggestions || [],
                    },
                ]);
                setSuggestionIndex(-1);
                setLoading(false);
                return;
            }

            if (Array.isArray(data.hypotheses)) setHypotheses(data.hypotheses.slice(0, MAX_HYPOTHESES));
            if (Array.isArray(data.seenRecordIds)) setSeenRecordIds(data.seenRecordIds);
            if (Array.isArray(data.triggeredBadges)) setTriggeredBadges(data.triggeredBadges);
            if (data.solved === true) setSolved(true);
            setPendingHypothesisReplace(data.sessionState?.pendingHypothesisReplace);
            if (typeof data.sessionState?.hintCount === "number") {
                setHintCount(data.sessionState.hintCount);
            }

            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    response: data.response,
                    badge: data.badge,
                    sources: data.sources || [],
                    suggestions: data.suggestions || [],
                },
            ]);
            setSuggestionIndex(-1);

        } catch {
            setMessages((prev) => [
                ...prev,
                { role: "assistant", response: "연결 오류가 발생했습니다. 다시 시도해 주세요.", suggestions: [] },
            ]);
        } finally {
            setLoading(false);
            inputRef.current?.focus();
        }
    };

    const handleSelectCommand = (cmd: string) => {
        setInput(cmd + " ");
        setShowCommandPalette(false);
        setCommandPaletteIndex(0);
        inputRef.current?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "/") e.stopPropagation();

        if (showCommandPalette) {
            if (e.key === "Escape") {
                setShowCommandPalette(false);
                return;
            }
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setCommandPaletteIndex((i) => (i + 1) % getSlashCommands(hintCount).length);
                return;
            }
            if (e.key === "ArrowUp") {
                e.preventDefault();
                setCommandPaletteIndex((i) => (i - 1 + getSlashCommands(hintCount).length) % getSlashCommands(hintCount).length);
                return;
            }
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSelectCommand(getSlashCommands(hintCount)[commandPaletteIndex].cmd);
                return;
            }
        }
        if (e.key === "Enter" && !e.shiftKey) {
            if (e.nativeEvent.isComposing) return;
            e.preventDefault();
            handleSubmit();
            return;
        }
        if (e.key === "ArrowUp" && lastSuggestions.length > 0 && !showCommandPalette) {
            e.preventDefault();
            const next = suggestionIndex <= 0 ? lastSuggestions.length - 1 : suggestionIndex - 1;
            setSuggestionIndex(next);
            setInput(lastSuggestions[next]);
            return;
        }
        if (e.key === "ArrowDown" && lastSuggestions.length > 0 && !showCommandPalette) {
            e.preventDefault();
            const next = suggestionIndex >= lastSuggestions.length - 1 ? 0 : suggestionIndex + 1;
            setSuggestionIndex(next);
            setInput(lastSuggestions[next]);
            return;
        }
    };

    if (isCheckingEntitlements || !displayConfig) {
        return <div className="flex-1 flex items-center justify-center bg-archive-bg"><span className="w-5 h-5 border-2 border-archive-muted-deep border-t-archive-accent rounded-full animate-spin"></span></div>;
    }

    return (
        <div className="flex flex-col h-full w-full bg-archive-bg relative text-archive-text font-serif scanlines overflow-hidden">
            <div className="max-w-3xl w-full mx-auto flex flex-col h-full bg-archive-bg/95 shadow-none md:shadow-2xl relative z-10 md:border-x border-archive-border-subtle">
                <header className="shrink-0 py-2.5 px-4 border-b border-archive-border flex items-center justify-between gap-4 font-mono z-10 relative bg-black/70 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <Link href="/stories" className="text-archive-muted hover:text-archive-accent transition-colors flex items-center pr-2 border-r border-archive-border/50">
                            <ChevronLeft className="w-4 h-4" />
                        </Link>
                        <h1 className="text-[13px] font-bold text-archive-text flex items-center gap-2 tracking-wide uppercase">
                            <span className="w-1.5 h-3 bg-archive-accent caret-blink inline-block mr-2"></span>
                            Story File #{storyId}
                            {isDebugMode && <span className="ml-2 px-1.5 py-0.5 bg-[#ffcc00]/20 border border-[#ffcc00]/50 text-[#ffcc00] text-[9px] rounded-sm font-bold">DEBUG</span>}
                        </h1>
                    </div>
                    {actualQueriesLeft !== Infinity && !showPaywall && (
                        <button
                            onClick={() => {
                                const nextCount = queriesClickCount + 1;
                                if (nextCount >= 5) {
                                    setTokensForDebug(5);
                                    setQueriesClickCount(0);
                                } else {
                                    setQueriesClickCount(nextCount);
                                }
                            }}
                            className="text-[11px] font-mono text-archive-accent px-2 py-0.5 border border-archive-accent/30 rounded-sm bg-archive-accent/10 whitespace-nowrap cursor-pointer hover:bg-archive-accent/20 transition-colors"
                        >
                            QUERIES REMAINING: {actualQueriesLeft}
                        </button>
                    )}
                </header>

                {hypotheses.length > 0 && (
                    <div className="shrink-0 px-4 py-2 bg-archive-surface/60 border-b border-archive-border text-xs backdrop-blur-sm z-10 relative">
                        <p className="text-archive-accent mb-1 font-mono text-[10px] tracking-widest font-bold uppercase">
                            [CURRENT HYPOTHESES]
                        </p>
                        <ul className="space-y-1 text-archive-text font-serif leading-snug">
                            {hypotheses.map((h) => (
                                <li key={h.id} className="text-[13px] flex items-start gap-1.5">
                                    <span className="text-archive-muted shrink-0 mt-0.5">-</span>
                                    <span>
                                        <span className="font-bold mr-1">{h.id}</span> {highlightVictim(h.text, VICTIM_NAME, VICTIM_ALIASES)}
                                        <span className="text-archive-muted-deep ml-1.5 text-[11px] font-mono tracking-tight">
                                            (지지 {h.support} / 충돌 {h.conflict})
                                        </span>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <div className="shrink-0 px-5 py-5 bg-[#121212] border-b border-archive-border text-[13px] md:text-[14px] text-[#dddddd] space-y-4 z-10 relative font-serif transition-all">
                    <button
                        onClick={() => setIsSynopsisOpen(!isSynopsisOpen)}
                        className="w-full flex items-center justify-between text-left transition-colors group"
                    >
                        {isSynopsisOpen ? (
                            <p className="leading-snug flex-1 group-hover:text-white transition-colors">
                                시스템은 사건 기록을 보관하고 있으며, 당신의
                                질문에 따라 기록 일부를 열람할 수 있습니다. <span className="text-archive-accent opacity-90 ml-1">기록을 연결해 전말을 재구성하세요.</span>
                            </p>
                        ) : (
                            <p className="leading-snug flex-1 text-[#f0f0f0] truncate w-full pr-4 group-hover:text-white transition-colors">
                                <span className="font-bold text-archive-accent text-[11px] tracking-widest uppercase mr-3">&gt; [SYNOPSIS]</span>
                                {highlightVictim(displayConfig.SYNOPSIS.short, VICTIM_NAME, VICTIM_ALIASES)}
                            </p>
                        )}
                        <span className="ml-4 font-mono text-archive-accent bg-archive-accent/10 border border-archive-accent/30 px-2 py-1 rounded-sm text-[10px] tracking-widest shrink-0 group-hover:bg-archive-accent group-hover:text-white transition-colors">
                            {isSynopsisOpen ? 'CLOSE' : 'OPEN'}
                        </span>
                    </button>
                    {isSynopsisOpen && (
                        <div className="bg-[#1c1c1c] border border-archive-border p-5 rounded-sm text-[13px] md:text-[14px] font-mono leading-relaxed relative overflow-hidden mt-4 animate-fade-in shadow-inner">
                            <div className="absolute top-0 left-0 w-1 h-full bg-archive-accent"></div>
                            <p className="font-bold mb-3 text-archive-accent text-[11px] tracking-widest uppercase">
                                &gt; [SYNOPSIS]
                            </p>
                            <p className="text-[#f0f0f0]">
                                {highlightVictim(
                                    displayConfig.SYNOPSIS.full,
                                    VICTIM_NAME,
                                    VICTIM_ALIASES
                                )}
                            </p>
                        </div>
                    )}
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6 space-y-8 z-10 relative scroll-smooth">
                    {messages.length === 0 && (
                        <div className="text-archive-text/90 text-[14px] md:text-[15px] font-serif space-y-4 pb-6 animate-fade-in leading-relaxed">
                            <p className="font-mono text-archive-accent font-bold text-[12px] tracking-widest uppercase mb-4">[플레이 방법]</p>
                            <p><span className="font-mono text-archive-accent font-bold">/가설</span> 가설 기록. 예: <span className="font-mono truncate text-archive-accent opacity-80 text-[13px] md:text-[14px]">/가설 박지훈이 범인인 것 같아</span></p>
                            <p><span className="font-mono text-archive-accent font-bold">/추리</span> 결론 제출. 예: <span className="font-mono truncate text-archive-accent opacity-80 text-[13px] md:text-[14px]">/추리 박지훈이 비자금 때문...</span></p>
                            <p><span className="font-mono text-archive-accent font-bold">/힌트</span> 적당한 힌트 제공 (3회 제한)</p>
                        </div>
                    )}

                    {messages.map((msg, i) => (
                        <div
                            key={i}
                            className={`flex animate-fade-in ${msg.role === "user" ? "justify-end" : "justify-start"
                                }`}
                        >
                            <div
                                className={
                                    msg.role === "user"
                                        ? "max-w-[85%] rounded-md px-5 py-3 bg-[#181818] border border-archive-border"
                                        : `max-w-[95%] w-full ${showPaywall && msg.role === "assistant" && i === messages.length - 1 ? 'blur-md select-none opacity-80' : ''}`
                                }
                            >
                                {msg.role === "user" ? (
                                    <p className="text-[16px] text-white font-serif leading-relaxed tracking-wide">
                                        {highlightMessageContent(msg.content ?? "", VICTIM_NAME, VICTIM_ALIASES)}
                                    </p>
                                ) : (
                                    <div className="space-y-5 text-[16px] font-serif">
                                        {msg.response && (
                                            <div className="text-white leading-[1.8] whitespace-pre-wrap px-5 py-4 bg-[#141414] border-l-2 border-archive-accent rounded-r-md">
                                                {i === messages.length - 1 && !loading ? (
                                                    <Typewriter
                                                        text={msg.response}
                                                        onType={() => logEndRef.current?.scrollIntoView({ behavior: "auto" })}
                                                        victim={VICTIM_NAME}
                                                        aliases={VICTIM_ALIASES}
                                                    />
                                                ) : (
                                                    highlightVictim(msg.response, VICTIM_NAME, VICTIM_ALIASES)
                                                )}
                                            </div>
                                        )}
                                        {msg.badge && (
                                            <div className="px-5 py-3 mt-4 rounded-md bg-archive-accent/10 border border-archive-accent/30">
                                                <p className="font-mono text-[13px] font-semibold text-archive-accent tracking-wider">
                                                    [업적] {msg.badge.title} : {highlightVictim(msg.badge.condition, VICTIM_NAME, VICTIM_ALIASES)}
                                                </p>
                                            </div>
                                        )}
                                        {msg.sources && msg.sources.length > 0 && (
                                            <p className="text-archive-muted text-[13px] font-mono tracking-wide px-5">
                                                <span className="text-archive-muted-deep uppercase tracking-widest text-[11px] mr-2">출처:</span>
                                                {msg.sources.map((id) => `[${id}]`).join(", ")}
                                            </p>
                                        )}
                                        {msg.suggestions && msg.suggestions.length > 0 && (
                                            <div className="px-5 py-4 bg-archive-surface/40 rounded-md border border-archive-border-subtle mt-5 shadow-sm">
                                                <p className="text-archive-muted-deep mb-3 text-[11px] font-mono tracking-widest uppercase">[SUGGESTED QUERIES]</p>
                                                <ul className="list-disc list-inside text-archive-accent/90 space-y-2">
                                                    {msg.suggestions.map((s, j) => (
                                                        <li key={j} className="text-archive-text/90 text-[15px] pl-1 cursor-pointer hover:text-archive-accent" onClick={() => setInput(s)}>
                                                            {highlightVictim(s, VICTIM_NAME, VICTIM_ALIASES)}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {solveStep > 0 && (
                        <div className="flex justify-start animate-fade-in w-full">
                            <div className="max-w-[95%] w-full rounded-sm border border-archive-accent bg-black/60 p-6 font-mono space-y-6 relative overflow-hidden shadow-[0_0_20px_rgba(255,204,0,0.05)]">
                                <div className="absolute top-0 left-0 w-1 h-full bg-archive-accent"></div>
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-archive-accent text-[12px] font-bold tracking-[0.2em] uppercase">
                                        &gt; CASE_CONCLUSION_REPORT_V1.0
                                    </h3>
                                    <button
                                        onClick={() => setSolveStep(0)}
                                        className="text-archive-muted-deep hover:text-archive-accent text-[10px] tracking-widest uppercase transition-colors"
                                    >
                                        [ESC] EXIT
                                    </button>
                                </div>

                                <div className="space-y-6">
                                    {/* Step 1: Culprit */}
                                    <div className={`transition-opacity duration-300 ${solveStep >= 1 ? 'opacity-100' : 'opacity-20'}`}>
                                        <div className="flex items-center gap-3 text-[13px] mb-2 font-bold">
                                            <span className="text-archive-accent">STEP_01</span>
                                            <span className="text-archive-text">범인 (CULPRIT)</span>
                                        </div>
                                        {solveStep === 1 ? (
                                            <div className="flex items-center gap-2 bg-archive-surface/40 p-3 border-l border-archive-accent/50 group focus-within:bg-archive-accent/5 transition-all">
                                                <span className="text-archive-accent animate-pulse">&gt;</span>
                                                <input
                                                    autoFocus
                                                    className="bg-transparent border-none outline-none text-white w-full placeholder:text-archive-muted-deep/50 text-[14px]"
                                                    placeholder="ENTITY_NAME..."
                                                    value={solveForm.culprit}
                                                    onChange={(e) => setSolveForm(f => ({ ...f, culprit: e.target.value }))}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && solveForm.culprit.trim()) setSolveStep(2);
                                                        if (e.key === 'Escape') setSolveStep(0);
                                                    }}
                                                />
                                            </div>
                                        ) : (
                                            <div className="text-archive-accent p-3 font-bold border-l border-archive-accent/20 bg-archive-accent/5 text-[14px]">
                                                {solveForm.culprit}
                                            </div>
                                        )}
                                    </div>

                                    {/* Step 2: Motive */}
                                    <div className={`transition-opacity duration-300 ${solveStep >= 2 ? 'opacity-100' : 'opacity-0'}`}>
                                        <div className="flex items-center gap-3 text-[13px] mb-2 font-bold">
                                            <span className="text-archive-accent">STEP_02</span>
                                            <span className="text-archive-text">범행 동기 (MOTIVE)</span>
                                        </div>
                                        {solveStep === 2 ? (
                                            <div className="flex items-start gap-2 bg-archive-surface/40 p-3 border-l border-archive-accent/50 focus-within:bg-archive-accent/5 transition-all">
                                                <span className="text-archive-accent animate-pulse mt-1">&gt;</span>
                                                <textarea
                                                    autoFocus
                                                    className="bg-transparent border-none outline-none text-white w-full h-24 resize-none placeholder:text-archive-muted-deep/50 text-[14px] leading-relaxed"
                                                    placeholder="REASONING_AND_LOGIC..."
                                                    value={solveForm.motive}
                                                    onChange={(e) => setSolveForm(f => ({ ...f, motive: e.target.value }))}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && !e.shiftKey && solveForm.motive.trim()) {
                                                            e.preventDefault();
                                                            setSolveStep(3);
                                                        }
                                                    }}
                                                />
                                            </div>
                                        ) : solveStep > 2 ? (
                                            <div className="text-archive-accent p-3 font-bold border-l border-archive-accent/20 bg-archive-accent/5 text-[14px] whitespace-pre-wrap leading-relaxed">
                                                {solveForm.motive}
                                            </div>
                                        ) : null}
                                    </div>

                                    {/* Step 3: Method */}
                                    <div className={`transition-opacity duration-300 ${solveStep >= 3 ? 'opacity-100' : 'opacity-0'}`}>
                                        <div className="flex items-center gap-3 text-[13px] mb-2 font-bold">
                                            <span className="text-archive-accent">STEP_03</span>
                                            <span className="text-archive-text">범행 방법 (METHOD)</span>
                                        </div>
                                        {solveStep === 3 ? (
                                            <div className="flex flex-col gap-4">
                                                <div className="flex items-start gap-2 bg-archive-surface/40 p-3 border-l border-archive-accent/50 focus-within:bg-archive-accent/5 transition-all">
                                                    <span className="text-archive-accent animate-pulse mt-1">&gt;</span>
                                                    <textarea
                                                        autoFocus
                                                        className="bg-transparent border-none outline-none text-white w-full h-24 resize-none placeholder:text-archive-muted-deep/50 text-[14px] leading-relaxed"
                                                        placeholder="EXECUTION_DETAILS..."
                                                        value={solveForm.method}
                                                        onChange={(e) => setSolveForm(f => ({ ...f, method: e.target.value }))}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' && !e.shiftKey && solveForm.method.trim()) {
                                                                e.preventDefault();
                                                                handleSolveSubmit();
                                                            }
                                                        }}
                                                    />
                                                </div>
                                                <div className="flex gap-3">
                                                    <button
                                                        onClick={handleSolveSubmit}
                                                        disabled={!solveForm.method.trim()}
                                                        className="flex-1 bg-archive-accent text-black font-bold py-3 text-[12px] tracking-[0.2em] hover:bg-white transition-all disabled:opacity-30 disabled:grayscale uppercase"
                                                    >
                                                        Finalize Submission
                                                    </button>
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>

                                <div className="mt-8 pt-4 border-t border-archive-border/50 text-[10px] text-archive-muted-deep font-mono flex items-center gap-4">
                                    <span className="flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span> SYSTEM_READY
                                    </span>
                                    <span>ENCRYPTION: AES-256</span>
                                    {solveStep < 3 && <span className="animate-fade-in italic">Enter를 눌러 다음 단계로 진행하세요.</span>}
                                </div>
                            </div>
                        </div>
                    )}

                    {loading && (
                        <div className="flex justify-start animate-fade-in px-5 py-2">
                            <p className="text-archive-accent/80 text-[13px] font-mono tracking-widest flex items-center gap-3 uppercase">
                                <span className="w-1.5 h-3.5 bg-archive-accent caret-blink inline-block"></span> {t('searchingLogs')}
                            </p>
                        </div>
                    )}
                    <div ref={logEndRef} className="h-6" />
                </div>

                {/* Blur Paywall Overlay */}
                {showPaywall && (
                    <div className="absolute inset-x-0 bottom-[100px] top-[15%] z-20 flex flex-col items-center justify-end pb-12 bg-gradient-to-t from-black via-black/95 to-transparent">
                        <div className="bg-archive-surface/95 border border-archive-border p-8 rounded-sm shadow-2xl flex flex-col items-center max-w-sm text-center backdrop-blur-xl animate-fade-in shadow-black">
                            <div className="w-12 h-12 bg-archive-accent/10 border border-archive-accent/20 rounded-full flex items-center justify-center mb-5">
                                <Lock className="w-5 h-5 text-archive-accent" />
                            </div>
                            <h3 className="font-bold text-[15px] font-mono tracking-widest text-archive-text uppercase mb-3">{t('restrictedAccess')}</h3>
                            <p className="text-[13px] text-archive-muted mb-8 px-2 leading-relaxed">
                                {storyId === '1' ? t('exhaustedQueries') + " " : t('higherClearance') + " "}
                                {t('upgradePrompt')}
                            </p>

                            <div className="w-full flex flex-col gap-3 font-mono text-[12px] tracking-widest uppercase font-bold">
                                {adsWatched < 3 && (
                                    <button
                                        onClick={handleWatchAd}
                                        disabled={isWatchingAd}
                                        className="w-full py-4 bg-[#ffcc00] text-black hover:bg-[#ffcc00]/90 transition-colors shadow-lg rounded-sm flex justify-center items-center mb-2 disabled:opacity-50"
                                    >
                                        {isWatchingAd ? (
                                            <span className="flex items-center gap-2">
                                                <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
                                                {t('watchingAd')}
                                            </span>
                                        ) : (
                                            <span>{t('watchAdForQueries', { watched: adsWatched, max: 3 })}</span>
                                        )}
                                    </button>
                                )}
                                <button onClick={() => handlePaywallUpgrade('lestrade')} className="w-full py-3 px-4 bg-archive-surface text-archive-text border border-archive-border hover:bg-archive-accent/10 transition-colors rounded-sm flex justify-between items-center">
                                    <span>Lestrade Plan</span>
                                    <span className="text-archive-accent">$4.99</span>
                                </button>
                                <button onClick={() => handlePaywallUpgrade('sherlock')} className="w-full py-3 px-4 bg-archive-accent text-white hover:opacity-90 transition-opacity shadow-md rounded-sm border border-archive-accent flex justify-between items-center">
                                    <span>Sherlock Plan</span>
                                    <span>$9.99</span>
                                </button>
                                <button onClick={() => handlePaywallUpgrade('holmes')} className="w-full py-3 px-4 bg-archive-surface text-archive-accent border border-archive-accent hover:bg-archive-accent hover:text-white transition-colors rounded-sm flex justify-between items-center">
                                    <span>Holmes Plan</span>
                                    <span>$19.99</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="shrink-0 p-4 md:p-6 border-t border-archive-border bg-[#101010] z-20 relative">
                    {solved ? (
                        <div className="text-center space-y-4">
                            <p className="text-archive-accent font-semibold text-[15px]">사건이 종결되었습니다. 수고하셨습니다 셜록.</p>
                            <button
                                onClick={handleRestart}
                                className="px-10 py-3 md:py-2.5 rounded-sm bg-archive-surface text-archive-text font-bold font-mono border border-archive-border hover:bg-archive-accent hover:text-white hover:border-archive-accent transition-all text-[13px] active:scale-95"
                            >
                                다시 시작
                            </button>
                        </div>
                    ) : (
                        <div className="flex gap-3 md:gap-4">
                            <div className="flex-1 relative">
                                <div className="flex items-stretch rounded-sm border border-[#333333] bg-[#1a1a1a] focus-within:border-archive-accent focus-within:ring-1 focus-within:ring-archive-accent/50 max-h-32 overflow-hidden">
                                    <button
                                        type="button"
                                        disabled={showPaywall}
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            if (showPaywall) return;
                                            setInput("/");
                                            setShowCommandPalette(true);
                                            setCommandPaletteIndex(0);
                                            inputRef.current?.focus();
                                        }}
                                        className="shrink-0 px-3 text-[#bbbbbb] hover:text-archive-accent transition-colors font-mono text-lg disabled:opacity-50"
                                    >
                                        /
                                    </button>
                                    <div className="flex-1 relative min-h-[52px]">
                                        <div
                                            ref={inputOverlayRef}
                                            className="absolute inset-0 px-2 py-3.5 pointer-events-none overflow-auto text-archive-text text-[15px] md:text-[16px] font-serif leading-[1.5] whitespace-pre-wrap break-words"
                                            aria-hidden
                                        >
                                            {input ? formatInputWithCommands(input) : null}
                                        </div>
                                        <textarea
                                            ref={inputRef}
                                            value={input}
                                            onScroll={() => {
                                                if (inputRef.current && inputOverlayRef.current) {
                                                    inputOverlayRef.current.scrollTop = inputRef.current.scrollTop;
                                                    inputOverlayRef.current.scrollLeft = inputRef.current.scrollLeft;
                                                }
                                            }}
                                            onChange={(e) => {
                                                const v = e.target.value;
                                                setInput(v);
                                                setSuggestionIndex(-1);
                                                setShowCommandPalette(v.startsWith("/") && !isCompleteCommand(v));
                                                if (v.startsWith("/") && !isCompleteCommand(v)) setCommandPaletteIndex(0);
                                            }}
                                            onKeyDown={handleKeyDown}
                                            onFocus={() => {
                                                if (input.startsWith("/") && !isCompleteCommand(input)) setShowCommandPalette(true);
                                            }}
                                            onBlur={() => {
                                                setTimeout(() => setShowCommandPalette(false), 150);
                                            }}
                                            placeholder={showPaywall ? "ACCESS DENIED..." : "질문해서 사건을 파악해보세요. (/추리 입력 시 추리 제출 폼 등장)"}
                                            className="absolute inset-0 w-full min-h-[52px] max-h-32 px-2 py-3.5 bg-transparent text-transparent caret-archive-accent placeholder:text-[#999999] focus:outline-none resize-none text-[15px] md:text-[16px] font-serif leading-[1.5]"
                                            rows={1}
                                            disabled={loading || showPaywall}
                                        />
                                    </div>
                                </div>
                                {showCommandPalette && (
                                    <div
                                        ref={paletteRef}
                                        className="absolute bottom-full left-0 mb-1 w-full rounded-sm border border-archive-border bg-archive-surface shadow-xl overflow-hidden z-20"
                                    >
                                        <p className="px-4 py-2 text-archive-muted-deep text-[11px] font-mono tracking-widest uppercase border-b border-archive-border">
                                            명령어
                                        </p>
                                        {getSlashCommands(hintCount).map(({ cmd, desc }, i) => (
                                            <button
                                                key={cmd}
                                                type="button"
                                                onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    handleSelectCommand(cmd);
                                                }}
                                                className={`w-full px-4 py-2.5 text-left flex items-center gap-3 transition-colors ${i === commandPaletteIndex
                                                    ? "bg-archive-accent/20 text-archive-accent"
                                                    : "text-archive-text hover:bg-archive-surface/80"
                                                    }`}
                                            >
                                                <span className="font-mono text-archive-accent">{cmd}</span>
                                                <span className="text-sm text-archive-muted">{desc}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={handleSubmit}
                                disabled={loading || !input.trim() || showPaywall}
                                className="shrink-0 px-5 md:px-8 py-2 md:py-2 rounded-sm bg-archive-surface text-archive-text font-bold font-mono tracking-widest hover:bg-archive-accent hover:text-white hover:border-archive-accent disabled:opacity-40 disabled:bg-black/40 disabled:text-archive-muted-deep transition-all border border-archive-border shadow-sm uppercase text-[12px] md:text-[13px] active:scale-95"
                            >
                                <span className="hidden md:inline">Submit</span>
                                <span className="md:hidden">Send</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
