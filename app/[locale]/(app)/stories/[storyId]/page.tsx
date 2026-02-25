"use client";

import { useState, useRef, useEffect } from "react";
import type { Hypothesis } from "@/lib/game/hypothesesSimple";
import { useTranslations } from 'next-intl';
import { Lock } from 'lucide-react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const VICTIM_NAME = "김도윤";
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

function highlightVictim(text: string, victim: string) {
    if (!victim || !text) return text;
    const parts = text.split(new RegExp(`(${victim})`, "g"));
    return parts.map((part, i) =>
        part === victim ? (
            <span key={i} className="text-archive-accent font-semibold">
                {part}
            </span>
        ) : (
            part
        )
    );
}

function highlightMessageContent(text: string, victim: string) {
    if (!text) return text;
    const parts = text.split(new RegExp(`(${victim}|/가설|/추리|/힌트|/포기)`, "g"));
    return parts.map((part, i) =>
        part === victim ? (
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
}: {
    text: string;
    onType?: () => void;
    victim?: string;
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
            {victim ? highlightVictim(displayedText, victim) : displayedText}
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
    const storyId = Array.isArray(params.storyId) ? params.storyId[0] : params.storyId;

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

    // SaaS Specific: Paywall and Credits
    const [showPaywall, setShowPaywall] = useState(false);
    const [queriesLeft, setQueriesLeft] = useState(99);
    const [isCheckingEntitlements, setIsCheckingEntitlements] = useState(true);

    const logEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const inputOverlayRef = useRef<HTMLDivElement>(null);
    const paletteRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const checkEntitlements = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                if (storyId !== '1') setShowPaywall(true);
                setIsCheckingEntitlements(false);
                return;
            }
            const { data: sub } = await supabase
                .from('subscriptions')
                .select('plan, status')
                .eq('user_id', session.user.id)
                .single();

            const isPremium = sub?.status === 'active' && sub?.plan !== 'free';

            if (storyId === '1') {
                setQueriesLeft(isPremium ? Infinity : 99);
            } else {
                if (!isPremium) {
                    setShowPaywall(true);
                } else {
                    setQueriesLeft(Infinity);
                }
            }
            setIsCheckingEntitlements(false);
        };
        checkEntitlements();
    }, [storyId, supabase]);

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

    const handlePaywallUpgrade = () => {
        alert("Upgrade options coming soon!");
    };

    const handleSubmit = async () => {
        const trimmed = input.trim();
        if (!trimmed || loading || solved || showPaywall) return;

        if (queriesLeft <= 0) {
            setShowPaywall(true);
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

        setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
        setShowCommandPalette(false);
        setInput("");
        setLoading(true);

        if (queriesLeft !== Infinity) {
            setQueriesLeft(prev => prev - 1);
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
                        suggestions: [
                            "7월 18일 당시 별관 출입 기록은?",
                            "피해자 김도윤과 관련된 인물은?",
                        ],
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

            // Trigger Paywall if 0 credits
            if (queriesLeft - 1 === 0) {
                setShowPaywall(true);
            }

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

    if (isCheckingEntitlements) {
        return <div className="flex-1 flex items-center justify-center bg-archive-bg"><span className="w-5 h-5 border-2 border-archive-muted-deep border-t-archive-accent rounded-full animate-spin"></span></div>;
    }

    return (
        <div className="flex flex-col h-full w-full bg-archive-bg relative text-archive-text font-serif scanlines overflow-hidden">
            <div className="max-w-3xl w-full mx-auto flex flex-col h-full bg-archive-bg/95 shadow-none md:shadow-2xl relative z-10 md:border-x border-archive-border-subtle">
                <header className="shrink-0 py-2.5 px-4 border-b border-archive-border flex items-center justify-between gap-4 font-mono z-10 relative bg-black/70 backdrop-blur-md">
                    <h1 className="text-[13px] font-bold text-archive-text flex items-center gap-2 tracking-wide uppercase">
                        <span className="w-1.5 h-3 bg-archive-accent caret-blink inline-block mr-2"></span>
                        Story File #{storyId}
                    </h1>
                    {queriesLeft !== Infinity && !showPaywall && (
                        <span className="text-[11px] font-mono text-archive-accent px-2 py-0.5 border border-archive-accent/30 rounded-sm bg-archive-accent/10">
                            QUERIES REMAINING: {queriesLeft}
                        </span>
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
                                        <span className="font-bold mr-1">{h.id}</span> {highlightVictim(h.text, VICTIM_NAME)}
                                        <span className="text-archive-muted-deep ml-1.5 text-[11px] font-mono tracking-tight">
                                            (지지 {h.support} / 충돌 {h.conflict})
                                        </span>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <div className="shrink-0 px-5 py-5 bg-archive-surface/20 border-b border-archive-border text-[13px] md:text-[14px] text-archive-text/90 space-y-4 z-10 relative font-serif">
                    <p className="leading-snug">
                        시스템은 사건 기록을 보관하고 있으며, 당신의
                        질문에 따라 기록 일부를 열람할 수 있습니다. <span className="text-archive-accent opacity-90 ml-1">기록을 연결해 전말을 재구성하세요.</span>
                    </p>
                    <div className="bg-[#050505] border border-archive-border/80 p-5 rounded-sm text-[13px] md:text-[14px] font-mono leading-relaxed relative overflow-hidden shadow-inner mt-2">
                        <div className="absolute top-0 left-0 w-1 h-full bg-archive-accent"></div>
                        <p className="font-bold mb-3 text-archive-accent text-[11px] tracking-widest uppercase">
                            &gt; [SYNOPSIS]
                        </p>
                        <p className="text-archive-text">
                            {highlightVictim(
                                "7월 18일 밤, 회사 별관 3층에서 CFO 김도윤이 의식불명 상태로 발견되었다. 외부 침입 흔적은 없으며, 당시 출입 인원은 총 7명. (다음날 내부 감사 예정)",
                                VICTIM_NAME
                            )}
                        </p>
                    </div>
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
                                        ? "max-w-[85%] rounded-md px-5 py-3 bg-archive-surface border border-archive-border shadow-lg shadow-black/60"
                                        : `max-w-[95%] w-full ${showPaywall && msg.role === "assistant" && i === messages.length - 1 ? 'blur-md select-none opacity-80' : ''}`
                                }
                            >
                                {msg.role === "user" ? (
                                    <p className="text-[16px] text-archive-text font-serif leading-relaxed tracking-wide">
                                        {highlightMessageContent(msg.content ?? "", VICTIM_NAME)}
                                    </p>
                                ) : (
                                    <div className="space-y-5 text-[16px] font-serif">
                                        {msg.response && (
                                            <div className="text-archive-text leading-[1.8] whitespace-pre-wrap px-5 py-4 bg-black/40 border-l-2 border-archive-accent rounded-r-md shadow-md">
                                                {i === messages.length - 1 && !loading ? (
                                                    <Typewriter
                                                        text={msg.response}
                                                        onType={() => logEndRef.current?.scrollIntoView({ behavior: "auto" })}
                                                        victim={VICTIM_NAME}
                                                    />
                                                ) : (
                                                    highlightVictim(msg.response, VICTIM_NAME)
                                                )}
                                            </div>
                                        )}
                                        {msg.badge && (
                                            <div className="px-5 py-3 mt-4 rounded-md bg-archive-accent/10 border border-archive-accent/30">
                                                <p className="font-mono text-[13px] font-semibold text-archive-accent tracking-wider">
                                                    [업적] {msg.badge.title} : {highlightVictim(msg.badge.condition, VICTIM_NAME)}
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
                                                            {highlightVictim(s, VICTIM_NAME)}
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

                    {loading && (
                        <div className="flex justify-start animate-fade-in px-5 py-2">
                            <p className="text-archive-accent/80 text-[13px] font-mono tracking-widest flex items-center gap-3 uppercase">
                                <span className="w-1.5 h-3.5 bg-archive-accent caret-blink inline-block"></span> 기록 조회 중 ...
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
                            <h3 className="font-bold text-[15px] font-mono tracking-widest text-archive-text uppercase mb-3">Restricted Access</h3>
                            <p className="text-[13px] text-archive-muted mb-8 px-2 leading-relaxed">
                                {storyId === '1' ? "You have exhausted your free queries for this story. " : "This case file requires higher clearance. "}
                                {t('upgradePrompt')}
                            </p>

                            <div className="w-full flex flex-col gap-3 font-mono text-[13px] tracking-widest uppercase font-bold">
                                <button onClick={handlePaywallUpgrade} className="w-full py-3 px-4 bg-archive-surface text-archive-text border border-archive-border hover:bg-archive-accent/10 transition-colors rounded-sm">
                                    Lestrade Plan - $1.99
                                </button>
                                <button onClick={handlePaywallUpgrade} className="w-full py-3 px-4 bg-archive-accent text-white hover:opacity-90 transition-opacity shadow-md rounded-sm border border-archive-accent">
                                    Sherlock Plan - $8.99
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="shrink-0 p-4 md:p-6 border-t border-archive-border bg-black/95 backdrop-blur-xl z-20 relative">
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
                                <div className="flex items-stretch rounded-sm border border-archive-border/80 bg-[#0a0a0a] focus-within:border-archive-accent focus-within:ring-1 focus-within:ring-archive-accent/50 max-h-32 overflow-hidden shadow-inner">
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
                                        className="shrink-0 px-3 text-archive-muted-deep hover:text-archive-accent transition-colors font-mono text-lg disabled:opacity-50"
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
                                            placeholder={showPaywall ? "ACCESS DENIED..." : "질문해서 사건을 파악해보세요."}
                                            className="absolute inset-0 w-full min-h-[52px] max-h-32 px-2 py-3.5 bg-transparent text-transparent caret-archive-accent placeholder:text-archive-muted/80 focus:outline-none resize-none text-[15px] md:text-[16px] font-serif leading-[1.5]"
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
