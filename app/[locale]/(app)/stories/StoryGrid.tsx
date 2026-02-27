"use client";

import { useTranslations } from 'next-intl';
import { Link } from '@/lib/i18n/routing';
import { Lock, FileText } from 'lucide-react';
import { useTokenSystem } from '@/lib/hooks/useTokenSystem';

const STORIES = [
    { id: '1', title: 'The Vanishing Detective', isFree: true },
    { id: '2', title: 'A Study in Cyan', isFree: false },
    { id: '3', title: 'The Hound of Silicon Valley', isFree: false },
    { id: '4', title: 'Sign of the Four Bytes', isFree: false },
    { id: '5', title: 'The Final Variable', isFree: false },
    { id: '6', title: 'The Empty Server', isFree: false },
];

export default function StoryGrid({ userId }: { userId: string }) {
    const t = useTranslations('Stories');
    const { isDebugMode, isLoaded } = useTokenSystem(userId);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {STORIES.map((story) => {
                // To prevent layout shift hydration mismatch, we default to the server state 
                // but unlock if debug mode is confirmed
                const isLocked = !story.isFree && (!isLoaded || !isDebugMode);

                return (
                    <Link
                        key={story.id}
                        href={isLocked ? '#' : `/stories/${story.id}`}
                        className={`relative group block rounded-sm border p-6 transition-all duration-300 ${isLocked
                            ? 'border-archive-border-subtle bg-black/40 cursor-not-allowed opacity-60'
                            : 'border-archive-border hover:border-archive-accent bg-archive-surface/80 hover:bg-[#1a0a0a] hover:shadow-[0_0_20px_rgba(173,0,0,0.2)] hover:scale-[1.02] focus:outline-none ring-1 ring-white/5 shadow-xl'
                            }`}
                    >
                        <div className="flex justify-between items-start mb-6">
                            <div className={`p-3 rounded-sm border ${isLocked ? 'bg-black/80 border-archive-border-subtle text-archive-muted-deep' : 'bg-archive-bg border-archive-border text-archive-text group-hover:text-archive-accent group-hover:border-archive-accent/50 transition-colors'}`}>
                                <FileText className="w-5 h-5" />
                            </div>
                            {isLocked && (
                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-black/80 rounded-sm border border-archive-border-subtle">
                                    <Lock className="w-3.5 h-3.5 text-archive-muted-deep" />
                                    <span className="text-xs font-bold font-mono tracking-widest text-archive-muted-deep uppercase">{t('locked')}</span>
                                </div>
                            )}
                        </div>

                        <h3 className={`text-xl font-bold mb-3 tracking-wide ${isLocked ? 'text-archive-muted-deep' : 'text-archive-text'}`}>
                            {story.title}
                        </h3>

                        {!isLocked && (
                            <div className="mt-8 flex items-center text-[11px] font-bold font-mono tracking-[0.2em] uppercase text-archive-muted group-hover:text-archive-accent transition-colors">
                                {t('play')}
                                <svg className="ml-2 w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M5 12h14M12 5l7 7-7 7" />
                                </svg>
                            </div>
                        )}

                        {/* Blur overlay for locked items */}
                        {isLocked && (
                            <div className="absolute inset-0 backdrop-blur-[2px] rounded-2xl z-10 pointers-events-none" />
                        )}
                    </Link>
                );
            })}
        </div>
    );
}
