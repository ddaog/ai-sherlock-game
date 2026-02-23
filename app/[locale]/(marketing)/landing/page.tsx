import { useTranslations } from 'next-intl';
import { Link } from '@/lib/i18n/routing';
import SimulationTerminal from './SimulationTerminal';

export default function LandingPage() {
    const t = useTranslations('Landing');

    return (
        <div className="flex flex-col h-screen w-full bg-archive-bg relative text-archive-text font-serif scanlines overflow-hidden">
            <div className="max-w-3xl w-full mx-auto flex flex-col h-full bg-archive-bg/95 shadow-2xl relative z-10 border-x border-archive-border-subtle">
                <header className="shrink-0 py-3 px-6 border-b border-archive-border flex items-center justify-between gap-4 font-mono z-10 relative bg-black/80 backdrop-blur-md">
                    <h1 className="text-lg font-bold text-archive-text flex items-center gap-2 tracking-widest uppercase">
                        <span className="w-2 h-4 bg-archive-accent caret-blink inline-block"></span>
                        AI Sherlock <span className="text-archive-accent opacity-80 text-xs ml-1 font-sans font-bold">V0.1</span>
                    </h1>
                    <div className="flex gap-3 text-xs font-medium text-archive-muted-deep">
                        <Link href="/landing" locale="en" className="hover:text-archive-accent transition-colors">EN</Link>
                        <Link href="/landing" locale="kr" className="hover:text-archive-accent transition-colors">KR</Link>
                        <Link href="/landing" locale="jp" className="hover:text-archive-accent transition-colors">JP</Link>
                    </div>
                </header>

                <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-8 z-10 relative">
                    <div className="w-full text-center space-y-12">
                        <div className="space-y-4">
                            <h2 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-widest text-archive-text drop-shadow-[0_0_15px_rgba(245,245,245,0.3)]">
                                {t('title')}
                            </h2>
                            <p className="text-lg md:text-xl text-archive-muted-deep max-w-2xl mx-auto leading-relaxed font-sans">
                                {t('subtitle')}
                            </p>
                        </div>

                        {/* Terminal Simulation Box */}
                        <SimulationTerminal />

                        <div className="pt-8">
                            <Link
                                href="/login"
                                className="inline-block px-12 py-4 rounded-sm bg-archive-surface text-archive-text font-bold font-mono tracking-[0.2em] text-sm md:text-base border border-archive-border hover:bg-archive-accent hover:text-white hover:border-archive-accent hover:shadow-[0_0_20px_rgba(173,0,0,0.4)] hover:scale-[1.02] transition-all uppercase shadow-2xl shadow-black/80 ring-1 ring-white/5"
                            >
                                {t('startFree')}
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
