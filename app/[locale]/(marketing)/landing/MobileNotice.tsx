'use client';

import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { useTranslations } from 'next-intl';
import { MonitorOff } from 'lucide-react';

export default function MobileNotice() {
    const isMobile = useIsMobile();
    const t = useTranslations('Landing');

    if (!isMobile) return null;

    return (
        <div className="mx-auto mt-4 px-4 py-3 bg-archive-accent/10 border border-archive-accent/30 rounded-sm flex items-center gap-3 animate-fade-in max-w-lg z-20 relative">
            <MonitorOff className="w-5 h-5 text-archive-accent shrink-0" />
            <p className="text-[13px] text-archive-accent font-mono font-bold tracking-tight uppercase">
                {t('mobileNotice')}
            </p>
        </div>
    );
}
