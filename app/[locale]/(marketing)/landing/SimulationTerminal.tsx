'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';

export default function SimulationTerminal() {
    const t = useTranslations('Landing');

    const [turnIndex, setTurnIndex] = useState(0);
    const [typingStats, setTypingStats] = useState({ qLength: 0, aLength: 0, phase: 'idle' });

    // Use a function to dynamically fetch translations on every render safely
    const turns = [
        { qCmd: "", qText: t('sim_q1'), aText: t('sim_a1') },
        { qCmd: "", qText: t('sim_q2'), aText: t('sim_a2') },
        { qCmd: t('sim_q3_cmd'), qText: t('sim_q3_text'), aText: t('sim_a3') },
        { qCmd: "", qText: t('sim_q4'), aText: t('sim_a4') }
    ];

    useEffect(() => {
        let isCancelled = false;

        const runTurn = async () => {
            const currentTurn = turns[turnIndex];

            // Immediately reset typing stats to 0 to hide text on new turn
            setTypingStats({ qLength: 0, aLength: 0, phase: 'idle' });

            // Initial delay before first typing starts for smoother looping
            await new Promise(r => setTimeout(r, 500));
            if (isCancelled) return;

            // Phase 1: Type Q
            setTypingStats(prev => ({ ...prev, phase: 'typing_q' }));
            for (let i = 1; i <= currentTurn.qText.length; i++) {
                if (isCancelled) return;
                setTypingStats(prev => ({ ...prev, qLength: i }));
                await new Promise(r => setTimeout(r, 40));
            }

            // Wait before A
            if (isCancelled) return;
            setTypingStats(prev => ({ ...prev, phase: 'waiting_a' }));
            await new Promise(r => setTimeout(r, 600));

            // Phase 2: Type A
            if (isCancelled) return;
            setTypingStats(prev => ({ ...prev, phase: 'typing_a' }));
            for (let i = 1; i <= currentTurn.aText.length; i++) {
                if (isCancelled) return;
                setTypingStats(prev => ({ ...prev, aLength: i }));
                await new Promise(r => setTimeout(r, 20)); // faster typing for AI
            }

            // Wait before next turn
            if (isCancelled) return;
            setTypingStats(prev => ({ ...prev, phase: 'done' }));
            await new Promise(r => setTimeout(r, 2500)); // 2.5 seconds to read

            // Proceed to next turn
            if (isCancelled) return;
            setTurnIndex((prev) => (prev + 1) % turns.length);
        };

        runTurn();

        return () => { isCancelled = true; };
    }, [turnIndex]); // Excluded `turns` from dependency to prevent infinite fetch loop, but it relies on turnIndex.

    const currentTurn = turns[turnIndex];

    return (
        <div className="text-left bg-[#080808]/90 border border-archive-border rounded-sm p-6 md:p-8 shadow-[0_0_30px_rgba(0,0,0,1)] max-w-2xl mx-auto font-mono text-[14px] md:text-[15px] h-[450px] flex flex-col relative overflow-hidden">
            <p className="text-archive-accent font-bold tracking-widest uppercase text-xs mb-6 border-b border-archive-border-subtle pb-3 shrink-0 z-10">
                [SYSTEM LOG]
            </p>
            <div className="shrink-0 space-y-4">
                <p className="text-archive-muted-deep/80">&gt; INITIALIZING AI DETECTIVE ENGINE...</p>
                <p className="text-archive-text drop-shadow-[0_0_8px_rgba(245,245,245,0.2)]">
                    &gt; LOADING CASE FILE: <span className="text-archive-accent font-bold tracking-widest ml-2">MURDER AT THE MANSION</span>
                </p>
                <p className="text-archive-muted-deep/80 border-b border-archive-border/30 pb-5">
                    &gt; AWAITING INVESTIGATOR INPUT...
                </p>
            </div>

            <div className="flex-1 flex flex-col pt-6 relative" key={turnIndex}>
                {/* Question Typewriter */}
                {typingStats.phase !== 'idle' && (
                    <div className="mb-4">
                        {currentTurn.qCmd ? (
                            <span className="mr-3 text-archive-accent font-bold drop-shadow-[0_0_5px_rgba(173,0,0,0.5)]">
                                {currentTurn.qCmd}
                            </span>
                        ) : (
                            <span className="text-archive-muted-deep mr-3">&gt;</span>
                        )}
                        <span className="text-archive-text/80">
                            {currentTurn.qText.slice(0, typingStats.qLength)}
                            {typingStats.phase === 'typing_q' && (
                                <span className="inline-block w-2.5 h-4 bg-archive-text ml-1 align-middle caret-blink shadow-[0_0_10px_rgba(245,245,245,0.8)]"></span>
                            )}
                        </span>
                    </div>
                )}

                {/* Answer Typewriter */}
                {(typingStats.phase === 'typing_a' || typingStats.phase === 'done' || typingStats.phase === 'waiting_a') && (
                    <div className="leading-relaxed mt-2">
                        {turnIndex === 2 ? (
                            <span className="text-archive-text font-bold drop-shadow-[0_0_5px_rgba(245,245,245,0.2)]">{currentTurn.aText.slice(0, typingStats.aLength)}</span>
                        ) : turnIndex === 3 ? (
                            <span className="text-archive-accent opacity-90 tracking-wide">{currentTurn.aText.slice(0, typingStats.aLength)}</span>
                        ) : (
                            <span className="text-archive-muted">{currentTurn.aText.slice(0, typingStats.aLength)}</span>
                        )}
                        {typingStats.phase === 'typing_a' && (
                            <span className="inline-block w-2.5 h-4 bg-archive-accent ml-1 align-middle caret-blink"></span>
                        )}
                    </div>
                )}

                {/* Idle Cursor awaiting next input */}
                {typingStats.phase === 'done' && (
                    <div className="pt-6 animate-fade-in">
                        <span className="text-archive-muted-deep mr-3 text-lg">&gt;</span>
                        <span className="w-2.5 h-5 bg-archive-text caret-blink inline-block align-middle shadow-[0_0_10px_rgba(245,245,245,0.8)]"></span>
                    </div>
                )}
            </div>

            {/* Visual gradient to fade out bottom cleanly if tall */}
            <div className="absolute bottom-0 left-0 w-full h-8 bg-gradient-to-t from-[#080808]/90 to-transparent pointer-events-none"></div>
        </div>
    );
}
