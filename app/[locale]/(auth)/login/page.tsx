'use client';

import { createClient } from '@/lib/supabase/client';
import { useTranslations } from 'next-intl';
import { Search, AlertCircle, ArrowRight } from 'lucide-react';
import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function LoginContent() {
    const t = useTranslations('Auth');
    const supabase = createClient();
    const searchParams = useSearchParams();
    const router = useRouter();
    const errorMsg = searchParams.get('error');
    const [loading, setLoading] = useState(false);

    const handleGoogleLogin = async () => {
        setLoading(true);
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
            },
        });
    };

    return (
        <div className="flex flex-col items-center justify-center h-full overflow-y-auto w-full bg-archive-bg px-4 font-serif">
            <div className="w-full max-w-md p-8 md:p-10 my-8 bg-[#080808]/90 border border-archive-border rounded-sm shadow-[0_0_30px_rgba(0,0,0,1)] relative z-10 shrink-0">

                <div className="flex flex-col items-center text-center space-y-8 relative z-10">
                    <div className="p-4 bg-black/60 rounded-sm border border-archive-border shadow-inner">
                        <Search className="w-8 h-8 text-archive-accent drop-shadow-[0_0_8px_rgba(173,0,0,0.6)]" />
                    </div>

                    <h2 className="text-2xl font-black tracking-widest text-archive-text uppercase font-mono drop-shadow-[0_0_10px_rgba(245,245,245,0.2)]">
                        {t('welcomeTitle')}
                    </h2>

                    <p className="text-archive-muted-deep text-[14px] leading-relaxed font-sans">
                        {t('welcomeDesc')}
                    </p>

                    {errorMsg && (
                        <div className="w-full p-4 bg-archive-accent/10 border border-archive-accent/50 text-archive-accent text-[13px] font-mono rounded-sm flex items-center gap-3 text-left shadow-[0_0_10px_rgba(173,0,0,0.2)]">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <span>{t('authFailed')}</span>
                        </div>
                    )}

                    <button
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-4 px-6 py-4 bg-archive-surface hover:bg-archive-accent disabled:opacity-50 transition-all rounded-sm border border-archive-border hover:border-archive-accent hover:text-white hover:shadow-[0_0_15px_rgba(173,0,0,0.5)] text-archive-text font-mono text-[14px] tracking-widest uppercase shadow-lg shadow-black/80 ring-1 ring-white/5"
                    >
                        {loading ? (
                            <span className="w-5 h-5 border-2 border-archive-muted-deep border-t-archive-text rounded-full animate-spin" />
                        ) : (
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                        )}
                        {t('loginWithGoogle')}
                    </button>

                    <button
                        onClick={() => router.push('/stories')}
                        className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-transparent hover:bg-archive-surface transition-all rounded-sm border border-archive-border-subtle hover:border-archive-border text-archive-muted-deep hover:text-archive-text font-mono text-[14px] tracking-widest uppercase"
                    >
                        {t('continueAsGuest')}
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
            <LoginContent />
        </Suspense>
    );
}
